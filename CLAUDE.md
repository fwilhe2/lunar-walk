# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A first-person planetary surface simulator — Mercury, Venus, Moon, Mars, Phobos, Deimos, Io, Europa, Pluto, Charon, in order out from the sun — with an **unbounded, streamed surface** and three locomotion modes (EVA / rover / flight). Three.js r160, **no build step, no package manager, no tests, no network at runtime** — every texture is generated in the browser at load, and terrain chunks are generated forever in Web Workers as the player moves. `README.md` documents the physical modelling decisions (crater morphometry, Hapke photometry, terrain shadows, eye adaptation, curvature, Earth's phase); read it before changing anything that claims to be realistic, since most constants there are deliberate rather than tuned by eye.

## Running

```sh
python3 -m http.server 8000    # ES module imports are blocked over file://
```

There is nothing to build, lint, or test. Verification is visual, plus a Node check on the terrain kernel — see *Verifying changes* below. `tools/` is dev tooling; nothing in the app loads it.

## Layout

- `index.html` — the entire application, ~5,600 lines, in numbered sections (`1. TERRAIN KERNEL` … `13. DEMO`, plus `1b`, `4b`, `5b`). Grep for `^   [0-9]*[b]*\. [A-Z]` to jump between them.
- `three.module.js` — vendored Three.js r160 (MIT).
- `jsm/postprocessing/`, `jsm/shaders/` — vendored Three.js addons for the composer, resolved via the `three/addons/` importmap entry.

Sections are ordered by dependency: terrain kernel → per-world view table (1b) → worker source → renderer and lights → regolith textures (4) → surface-light library (4b) → chunk streamer (5) → terrain shadows (5b) → rocks → sky, Earth and companions → footprints → dust → post → rover → player/loop → demo. Anything added mid-file must respect that; in particular §4b must precede every material that calls `surfacePatch()`.

## The central invariant

All terrain math lives in the `TERRAIN_SOURCE` string (§1). It is eval'd into the main thread **and** prepended to the mesh-worker blob (§2), so both sides compute byte-identical heights. `terrainHeight(x, z)` is the single source of truth for the surface. It feeds:

- chunk mesh vertices (built in workers, §2/§5)
- walking collision, flight floor, and all four rover wheels (§11/§12 — the wheels via the drawn-mesh reconstruction below)
- footprint and wheel-track placement (§8) and `terrainNormal()`, which finite-differences it
- rock placement (§6) and the flag base

Never introduce a second height source, displace the mesh in a vertex shader, or add terrain math outside `TERRAIN_SOURCE` — the CPU and the workers must keep agreeing on where the ground is. If you change anything in `TERRAIN_SOURCE`, every streamed chunk and every physics query changes together; that is the point.

Two things look like exceptions and are not:

- **Terrain shadows (§5b)** render the *chunk meshes themselves* top-down into height clipmaps. That is the drawn mesh, curvature drop and LOD included, so shadows land on exactly what is visible. Do not replace this with calls to `terrainHeight()` on the GPU or CPU.
- **Sub-metre relief** — the regolith normal map and the procedural micro-craters in the ground shader (§4b) — only bends normals and darkens light. It never moves geometry and physics never sees it, like any normal map.
- **Prints and tracks (§8)** sit on the *drawn* mesh, not on `terrainHeight()`: each is a 5×7 grid whose points are placed on the chunk triangle beneath them, rebuilt from the same lattice (`chunkStreamer.stepAt()`), the same b–c diagonal as `gridIndex()` and the same curvature drop. That is a reconstruction of the mesh, like §5b's height pass, not a second height source — if you change the triangulation or the vertex placement in §2/§5, change `meshHeight()` with it, or prints float again.
- **Rover wheels (§11)** stand on the same reconstruction: `meshHeight(x, z, s, vtx)` is one top-level function, and the caller supplies the lattice corners. The rover's `wheelGround()` lets each tyre down as a circle onto it (seven points over the contact patch, highest wins), so wheels neither drop into craters the 1–2 m mesh does not draw nor follow holes narrower than the tyre. Its corners are raw `terrainHeight()` without the curvature drop, cached direct-mapped on integer keys; `rover.despawn()` clears the cache, since another world is another ground.
- **Prints are a factor, not a colour.** They render with `dst × src` blending, and the 'print' kind of `surfacePatch()` outputs (pressed-soil light) / (undisturbed-ground light) under the same sun, shadow and ambient — the ground's Hapke set comes in as `gpk*` via `hapkeRG()`, cut from `GLSL_HAPKE` by string replacement so there is one copy of the maths. Albedo cancels; `uStampK` (`stampColor` / `soil`, linear) puts back what pressing changes. Fog in that shader mixes toward 1, not the fog colour. Prints also press stones under `PRESS_MAX` into the soil (`rockSystem.press()`): flattened to 35 % and crowned 3 mm above the drawn mesh, measured on the posed geometry, and rock chunks built later re-apply every live print, so the effect survives walking away and back.

**Craters are not stored.** `cellCraters(layer, cx, cz)` re-derives them on demand from hashed integer cell coordinates in size classes (`CRATER_LAYERS`), cached in a **direct-mapped** table per layer (`ccX`/`ccZ`/`ccList`, reset by `craterCacheReset()`). A miss or collision just recomputes, which is safe because the list is a pure function of (layer, cell) — but a collision *inside* one 3×3 scan misses on every query there, so keep the slot hash free of them (an xor of two products sent (1, 1) and (−1, −1) to the same slot, right around the origin where every world lands you). Don't go back to a string-keyed `Map`: building 45 string keys per `terrainHeight()` call cost more than everything else in it. If you add a class or grow `rMax`, keep `rMax * 1.9 < cell`, and keep ray extent under `cell * 0.88` for the classes scanned by `rayBrightness()`. Crater age is skewed per class (`ageK`) toward old and shallow — equilibrium populations are mostly degraded — and `craterField()` also writes `CR_ALB`, a side output for the worker's colour pass (fresh-ejecta halos); physics ignores it. A class with `clump` set (Europa's secondaries) only populates cells inside a coarse noise field — still a pure function of the cell.

**Europa (`hEuropa`, kind 4)** is tectonic, not cratered. `euPre()` is everything older than the chaos — ridge families (`EU_FAM`, lanes that each hold at most one ridge kept inside the lane, so lane boundaries never seam), a band, the youngest ridges. Inside a chaos raft it is evaluated a **second time** at the raft's rotated and shifted coordinates, which is why rafts carry misaligned ridges; the rafts are Voronoi cells, and everything about them depends only on the cell except the gap and rotation, which scale with the chaos mask at the query point (continuous by construction). Two more side outputs, `EU_DARK` (non-ice material, −1 frost … +1 dark) and `EU_YEL` (salt), are read by the worker after each `terrainHeight()` and passed to `surfaceTint()`; they are zero on every other body. `EU_OX`/`EU_OZ` shift the tectonic field to put the landing site on a chaos margin; craters are not shifted, so the spawn fade still holds. A height query costs ~1.3–1.5× the Moon's.

**Pluto (`hPluto`, kind 5)** is simple by comparison: regional relief, gated ridged ranges (`plutoRange`), sparse large craters, little metre-scale roughness (the tholin mantle), and methane frost in the colour pass above `PL_FROST`. `PL_OX`/`PL_OZ` put the landing site on flat ground west of a range so Charon clears it; if you change the range or the offset, recheck the skyline toward `CHARON.dir` in Node.

**Mercury (`hMercury`, kind 7)** is intercrater plains with smooth-plains patches (`mercPlains`, shared with the colour pass), lobate scarps in 70 km lanes (`mercScarp`, one per lane, face and back limb kept inside it; each lane's hashed constants are cached for the last lane asked, `scarpLane()`), and hollows (`mercHollows`). A hollow is decided at its own cell's centre — a province noise times whether a crater of a class flagged `hol` is there — so it is a pure function of the cell, and cached direct-mapped like the craters (`hollowCell`, reset in `setWorld()`); don't evaluate that gate at the query point, it scans three crater classes. Hollows and craters are unshifted; `MH_OX`/`MH_OZ` shift only the tectonics, to put a scarp face 7 km east of the landing site. `MH_HOL` is a third side output (hollow floor and halo brightness), captured by the worker like `EU_DARK` and passed to `surfaceTint()` as `hol`. A height query costs ~1.2× the Moon's.

**Io (`hIo`, kind 8)** has no craters at all (`craters: []`; `craterField` returns 0). Plains with layered benches, lava flows (`ioFlows`, shared with the colour pass), paterae (`ioPatera`, one per 56 km cell, centre in the middle 40% and outline plus colour halo inside the rest, so only the query's own cell is asked) and tilted-block mountains (`ioMountain`, one per 110 km cell, same rule). The colour pass calls `ioPatera`/`ioMountain` again for their side outputs (`IO_PAT` floor, `IO_PH` halo, `IO_PK` halo kind, `IO_MT`) rather than capturing more worker arrays; both are a single cell, so it is cheap. `IO_OX`/`IO_OZ` shift everything but the paterae, which have their own `IO_PX`/`IO_PZ`, so the mountain and a patera could be placed independently. Plumes (`plumes`, §7, `world.plumes`) are vertical billboards 80 km out, past the streamed ground, scaled to true size at true distance and dropped by the curve there, re-aimed each frame; their shell is a closed-form line integral (a sampled one banded). Companions with `kepler.frame` (`IOJ`) circle in Io's frame instead of Europa's (`JOV`).

**Enceladus (`hEnceladus`, kind 9)**: tiger stripes in 35 km lanes (`enStripe`, the signed distance across the lane's stripe, also used by the colour pass and by `curtains` to follow the trough), funiscular ridges, a snow mantle, one sparse crater class. `EN_OX`/`EN_OZ` put the site 5 km from a stripe. Streams on its own short level set (`LE`, ±14 km). The jet curtain (`curtains`, §7, `world.curtain` is its gain) is a ribbon of world-space quads along the stripe, re-placed when the curvature anchor moves; below the horizon `uShadowZ` lifts the moon's shadow up it. Large ice blocks come from `world.blocks` in the rock system.

**Saturn's rings** are a companion capability: `rings: [inner, outer]` in planet radii adds an annulus in the group's equatorial plane, profiled by `saturnRingProfile()` (colour in RGB, optical depth / `RING_TAU` in alpha, returned as `T.ring` by the body's map generator), lit by single scattering with Saturn's shadow, and adds the rings' shadow to the globe shader (ray to the ring plane, using varyings `vC`/`vP` for centre and pole). From Enceladus they are edge-on by geometry, not by choice.

**Charon (`hCharon`, kind 6)** is Vulcan Planitia: flat flood plains, graben in lanes (`charonGraben`, one trough per `CH_LANE` lane, kept inside it like Europa's ridges), and rare mountains in moats (`charonMassifs`, one 60 km cell in fourteen). A massif's outline is noise-perturbed by up to 15%, so its early-out reach is 1.8 / 0.85 of its axis — shrink that and the moat and lip seam. `CH_MK` is a side output (1 inside a moat) that keeps graben off the massifs. `CH_OX`/`CH_OZ` put the landing site 16 km west-south-west of a 4 km massif, which stands under Pluto (`PLUTO.dir`, from `siteFrame(-15, -45)`); `world.look` opens the view on both.

## The sun's azimuth is fixed — and must stay fixed

`SUN_AZ` never changes; only `sunElev` does. Three systems depend on that:

- the terrain horizon maps (§5b) store, per texel, the skyline toward that azimuth — moving the sun in elevation costs nothing, moving it in azimuth would invalidate every map;
- the regolith normal map's alpha (§4) is a baked micro-horizon toward the same azimuth, in texture space (chunk UVs are world x/3, z/3);
- the hex tiling in the ground shader therefore uses translation-only offsets — a rotated copy of the tile would point its baked horizon the wrong way.

If the sun ever has to move in azimuth, all three need rebuilding for the new direction.

**Night uses the same trick with a different fixed direction.** Below the horizon, on the bodies with a `world.night` row, the key light becomes the primary overhead (`updateKey()`): `KEY_DIR`/`KEY_XZ` replace `SUN_DIR`/`SUN_XZ` for the light, its shadow rigs, the horizon march (`hzU.uDir`), `TS.sunXZ`, `tsSun.x`/`.y` and `uSunView`, while `SUN_DIR` keeps driving phases and the sky. A locked moon's primary never moves, so the horizon maps are rebuilt once when the key switches (`terrainShadows.invalidate()`); the regolith map's baked micro-horizon points at the sun's azimuth, so grain shadows (`rgMicro.z`) are off at night. Night is drawn in its own units: the key keeps the sun's intensity times the planet's phase, the companions and haze are raised by `KEY.U` (1 / planetshine ratio), and the eye's key drops to a quarter — never dim the key and let the eye open instead, which magnifies the HDR dithering into speckle. Stars take a per-world `night.stars` factor, because their gain was never physical.

## Surface materials (§4b)

Every `MeshStandardMaterial` in the scene goes through `surfacePatch(material, kind, hapke, extra)`, kinds `ground` / `print` / `rock` / `object`:

- **Terrain shadow**: one fetch from the horizon maps (`tsFetch`/`terrainShadow`), compared against the sun's true angular radius. `rock` and `object` kinds pass `lifted = true`, which uses the stored distance-to-skyline to see over it from above the ground.
- **Hapke photometry** replaces Lambert for the three regolith kinds (`RE_Direct_Regolith`). `setHapke()` normalises each parameter set so it matches Lambert at i=30°, e=0°, g=30°; the JS `hapkeJS()` must stay identical to the GLSL `hapkeR()`. Per-world parameters are `world.hapke`; prints and rocks derive theirs in `applyWorld()`.
- **Lighting chunk rewrite**: `LIGHTS_BEGIN` replaces r160's directional-light loop. It assumes `directionalLights[0]` is the sun and `[1]` the far shadow cascade (`sunFar`, zero intensity). three sorts shadow-casting lights first, so **`sun` and `sunFar` must always cast (or not) together** — `applyWorld()` keeps them in step.
- `customProgramCacheKey` is set per kind; if you add a variant with different shader code, give it its own key, or three will reuse the wrong program.

Painted relief has no geometry to hide behind, so the ground shader corrects for it: normals facing away from the viewer are bent back, grain shadows fade toward zero phase angle, and micro-craters test their own near rim against the eye (`mcRim`) the same way they test it against the sun.

## The chunk streamer (§5)

Four nested levels of absolutely-aligned chunks (256 m / 1 km / 4 km / 16 km; steps 1–2–4 m, 16 m, 64 m, 256 m), finer LOD near the player, covering ±40 km. Things that are easy to break:

- **Curvature anchor.** Chunks curve away by d²/2R around the requesting player cell (`ax`, `az`). This is what buries the streamed edge below the horizon and keeps physics (which uses raw heights) aligned with the visible mesh near the player. Don't make the anchor global, and don't remove the drop.
- **Purge discipline.** Stale chunks are removed only when their level has nothing pending, so motion never opens holes. Remove through `drop()`, which disposes the geometry, keeps the built-cell index and re-cuts the coarse chunks above; the material is shared.
- **Skirts.** Each chunk's outer vertex ring is clamped to the edge and dropped to hide LOD seams; the (n+3)² height grid exists so edge normals are finite-differenced from true out-of-chunk samples.
- **Coarse chunks are cut where finer ground stands.** A coarse chunk that finer ground partly covers gets its own index buffer (`holeIndex`) leaving out every quad under a *built* finer chunk — or under a finer cell that is itself fully covered, which matters on low, where `LOD_COARSE` trims the 1 km ring and 4 km chunks run right up to the player. The cut edge gets a wall from a row of dropped vertices the worker appends after the grid, one row per possible cut line (`d.m`). Cuts follow built chunks, never desired ones, so a hole never opens before the ground under it exists; `recut()` runs on every add and purge and bumps `version`. Before holes, coarse levels overlapped the finer ones sunk by metres, and poked through every crater floor they could not follow, on the visible ground and in §5b's height pass — and at low sun each level edge was a sunk step that threw a line of shadow. No level overlaps another now, so **nothing is sunk**: don't reintroduce a per-level sink; seams are closed by skirts and walls from both sides. Index buffers are shared across chunks, so detach a geometry's index (`setIndex(null)`) before disposing it — three frees the index's GL buffer on dispose.
- **Depth is split in two ranges** (`SplitRenderPass`, §10): the scene is drawn past `DEPTH_SPLIT` (400 m) with the near plane pushed out, then the depth is cleared and the near range drawn. One 24-bit buffer over 5 cm … 90 km resolves only ~20 m at 4 km, and distant slopes shimmered as you moved. Consequences: the sun's shadow maps are rendered once per frame by hand (`shadowMap.autoUpdate = false`, `needsUpdate` set by the pass), `scene.background` is lifted for the second range (a colour background makes three clear on every render call), and nothing additive should sit near 400 m, where the ranges overlap by 2%. Chosen over a logarithmic depth buffer, which would need every `ShaderMaterial` patched, defeats the prints' `polygonOffset` and costs early-z under the ground shader.
- `chunkStreamer.version` bumps on every mesh add/remove; §5b watches it to know when to rebuild the shadow maps.

## Terrain shadows (§5b)

Four clipmap levels (512 m … 32 km at 1024² each). A rebuild renders `chunkGroup` into half-float height targets (borrowed into a private scene with an override material, then returned to `scene`), then marches each horizon texel toward the sun (~190 steps to 16 km, 3 km on the moonlets; the step grows with range, so reach is cheap). It runs only when the chunk set changes or you leave the middle of the finest level, spread over five frames; `update(…, true)` forces it into one frame and is used once when a world finishes loading. Heights are stored relative to `refY` so half floats keep centimetre precision near the player. Venus turns the whole system off (`world.shadows === false`).

## Exposure, tone mapping, bloom (§10)

- `eyePass` meters each frame on the GPU (luminance-weighted mean, centre-weighted, sun clipped), adapts through a pair of 1×1 targets and writes the exposed image. Per-world `eye: [key, min, max]`. Nothing reads it back except `eyePass.readback()`, which is for tuning.
- Tone mapping is per world (`world.tone`): AgX by default, ACES where the sky's own colour matters (Mars, Venus).
- Bloom runs **after** exposure, on a frame clamped at 6, with a threshold in perceived units. UnrealBloom's blur is truncated at one sigma and draws a visible box around anything much brighter than its threshold; the wide sun glare is the corona sprite instead, which divides the exposure back out (`EYE_TEX`) so it looks the same however open the eye is. Sprites and anything else additive near the sun need `fog: false` or the fog colour paints the whole quad.
- Stars and the Milky Way have a physical gain (`world.starGain`): invisible under daylight adaptation, visible only when the eye opens up with no lit ground in view.

## Quality tiers (§10b)

`quality.set('high' | 'medium' | 'low')` reconfigures everything live; nothing needs a reload. Things that depend on it:

- Shader variants by define, each changing the program: `RG_CHEAP` (ground: one texture fetch per octave instead of the hex-tiled three), `RK_CHEAP` (rocks: no procedural bump), `HPK_LUT` (ground, rocks, prints: Hapke from the 32³ table `setHapke()` builds, instead of `hapkeR()`). Keep the table and the function in step — it is filled from `hapkeJS()`.
- `LOD_COARSE` doubles the terrain step beyond the nearest ring and trims the 1 km ring by one chunk where a coarser level follows. Steps are part of the chunk key, so `chunkStreamer.refresh()` just re-plans; the purge discipline keeps the ground solid while the new set builds.
- `terrainShadows.configure(n, gap)` reallocates the clipmaps and forces a one-frame rebuild; `rockSystem.setDetail()` rebuilds rock chunks; shadow-map sizes are changed by disposing `light.shadow.map`; MSAA by changing `samples` on the composer's targets and disposing them.
- With bloom off, the eye pass skips its write and the grade pass applies the exposure (`uExpose`) — one full-resolution half-float pass fewer.
- The governor (`quality.tick()`, once per frame) changes the pixel ratio; `quality.auto = false` stops it, which the probe needs, since at a frame a minute it would otherwise drop straight to the floor. It must run **before** `composer.render()`: resizing a canvas clears its drawing buffer, so a resize after drawing presents a blank frame — that was a visible flicker every time the resolution changed. It decides on the median frame interval, so streaming stalls don't make it hunt.
- The rover is built as ~150 meshes for readability and then merged by material per rigid part (`mergeInto`): chassis, crew, and per wheel the spinning part, steering knuckle, upright and each wishbone. New rover parts that must move on their own need their own parent group, or they will be folded into the chassis. Its chassis is a rigid body on four springs, substepped at 240 Hz inside `rover.step()`; a parked rover is stepped too (`parked = true`, brake on).

Draw calls matter as much as pixels on an integrated GPU with Firefox: terrain is ~230 chunk draws, rocks one draw per prototype per chunk, and everything that casts is drawn again per cascade.

## Load-time and per-frame budget

Boot builds the opening rings in workers (a few seconds on real hardware); after that chunk builds ride on player movement. `terrainHeight()` runs ~67k times for one near chunk — about 2.5 µs a call on the Moon once warm — so a cheap-looking addition costs real stutter on every 256 m boundary crossing. Existing optimisations that are easy to undo by accident:

- The ridged-highlands terms are skipped when the continental mask is closed (`hl <= 0.004`) — they cost more than the rest of the function combined.
- `cellCraters` results are cached (direct-mapped, see above); anything that varies crater output per query would have to bypass the cache (don't).
- `hash2()` is an integer bit-mix taking **lattice coordinates only**. For hashing a float position use `hashF()` (see the boulder deformation, which needs shared icosahedron corners to agree).
- The ground shader skips the fine regolith octave past ~140 m, where it would only mip-average to its mean (`rgMeanC`).
- Europa's talus rocks (`world.talus`) sample slope with three `terrainHeight()` calls per candidate on the main thread; the count is what keeps a rock chunk inside the lunar budget.

**Switching worlds is two-phase.** `applyWorld(id)` first prepares what is costly the first time — the regolith set and the companions' maps — while the loading screen shows and the page stays live, then calls `applyWorldNow(id)`, which does everything at once as before; it returns a promise, and `goTo()` and the probe's `at()` wait on it. Texture generators that are pure pixel loops (`regolithData`, `jupiterPixels`, `galileanPixels`, `charonPixels`, `plutoPixels`) run in a worker via `offThread()`: they must not touch `THREE`, the DOM or module constants (they get `TERRAIN_SOURCE` for `hash2()`, `fbm()` and friends), and are listed in `OFF_THREAD` and, for companions, `TEXGEN_OFF`. The rest still draws on canvases on the main thread, one body per task after the picker's zoom (`companionsAsync()`). A new body's map generator should be written the pure way and registered there, or it freezes the page the first time someone visits.

Profile in Node rather than guessing — `node tools/check.mjs` extracts `TERRAIN_SOURCE`, evals it and times `terrainHeight()` per world against a baseline; for anything finer, do the same by hand (warm up first: the first few thousand calls run unoptimised and mislead).

## Three.js r160 specifics

These are version-pinned and will silently break on upgrade:

- **`onBeforeCompile` uniforms need a hand-written GLSL declaration.** Registering `shader.uniforms.foo` binds the value but declares nothing; without a prepended `uniform vec3 foo;` the program fails to link and the material silently falls back. This already bit once.
- The ground material patches the chunks `map_fragment`, `normal_fragment_maps`, `lights_fragment_begin` and `tonemapping_fragment`, relying on r160's names (`vMapUv`, `vNormalMapUv`, `tbn`, `vViewPosition`, `geometryNormal`, `directionalLights`, `directionalLightShadows`, `vDirectionalShadowCoord`, `getShadow`, `receiveShadow`). Variables declared in one patched chunk (`rgUv`, `rgDist`, `microLit`, `surfShadow` …) are read in later ones — they all live in the same `main()`. `LIGHTS_BEGIN` is built by slicing `THREE.ShaderChunk.lights_fragment_begin` and throws if its layout changed. Verify against `three.module.js` before editing — the chunk sources are greppable there.
- **Tone mapping and the composer**: three applies `renderer.toneMapping` *only* when rendering to the canvas, not into a render target. So inside `EffectComposer` everything renders linear HDR and the trailing `OutputPass` does tone mapping and colour conversion. Custom `ShaderMaterial`s must still end with `#include <tonemapping_fragment>` and `#include <colorspace_fragment>` — no-ops inside the composer.
- Clear colours set while a render target is bound stay in linear working space (`getUnlitUniformColorSpace`), which is what lets §5b clear its height targets to −30,000.
- Both Earth shaders (§7) work in **world space**; `earthGroup.userData.sync()` supplies a world-space sun direction, and the whole group follows the camera each frame so Earth shows no parallax. Don't reintroduce an inverse-matrix transform. The atmosphere shell renders `BackSide`, so its normals point *with* the sun on the lit limb — `dot(N, L)`, not `dot(-N, L)`.
- Companion options added for Europa: `pole` orients the globe's +Y (Jupiter's north is the orbit normal, `JOV.Z`); `oblate` scales the globe's y and corrects the normal by `c²` in the vertex shader (M already holds the scale once); `limb` is a Minnaert exponent; `kepler` places a moon from the two-orbit geometry each tick (direction, and group scale from its true distance) and draws it at 4.6 km when nearer than Europa's orbit, 7.8 km when further, so transits and occultations of Jupiter (at 6.2 km) sort correctly. `face` turns a globe on its pole so the middle of its map (u = 0.5, where the Pluto and Charon maps put longitude 0) looks along a scene direction — the hemisphere a locked body keeps toward its partner. `JOV`, `CHARON` and `PLUTO` come from `siteFrame(lat, lon)` — change the site and the primary, its tilt and the moons' arc all follow. `CHARON` and `PLUTO` include the observer's parallax (the pair are 16 Pluto radii apart); `JOV` ignores it (0.1°).
- **Companions sit behind the sky, not in front of it.** Each globe outputs `col * skyTrans(D) + skyRadiance(D)`: its own light dimmed by the air (`world.sky.tau`, vertical optical depth), plus the sky the air scatters in front of it, so a night side is exactly the sky's colour. Both functions come from `skyDome.glsl`, and the companions share the dome's uniform *objects* (spread, not cloned) — keep them on the same function, or the night side shows as a disc. The globe stays opaque so it still hides the stars behind it (Pluto shows stars by day); the additive atmosphere shell takes only the dimming. `updateSkyColors()` zeroes `uGain` and `uTau` on worlds without a sky, which is what makes both terms vanish there — hiding the dome is not enough.
- **Light units are per world.** Europa's row is in units ten times the Moon's (sun 1.26, not 0.126) and Pluto's and Charon's a thousand times (sun 3.4, not 0.003), with star gain and eye range scaled to match — except that Pluto's stars are deliberately visible by day, since its ground is lit at twilight levels. Sky domes also work without air: `world.sky` is independent of `world.air`, which is how Pluto gets a haze glow and stars together. In the lunar scale the ground's radiance is so small that the eye's exposure amplifies three's ±½/255 output dithering into coloured speckle. Keep absolute scene radiances within an order of magnitude of the Moon's.

## Input (§12)

Physics never reads `keys` directly: `readInput()` folds keys, a standard-mapping gamepad and the touch controls into `input` (`fwd`/`side` −1..1, `run`, `jump`, `pushCap`, `down`, `zoom`) once a frame, at the top of `step()`. Analog all the way — `wish` is only normalised when longer than 1, jet Δv is spent by axis magnitude, and the rover's `step()` takes `{ throttle, steer }`. The demo still drives by setting `keys`, which is what keeps it honest. One-shot actions live in `press(code)`, shared by keydown, pad buttons (edge-detected) and touch buttons.

## The lander (§6c)

`WORLD.lander` (kernel row) is where `lander.place()` stands the lander, of the kind `world.lander` names (`KINDS`: `lm` by default, `viking`, `venera`, `generic`; each gives pad count, pad radius and the body to collide with). Positions were picked in Node for level ground with a line of sight from the site. On the Moon it is also, in the colour pass, the centre of the blast-zone brightening — a colour-only term like `CR_ALB`; physics never sees it. The rock system keeps pebbles off its footprint. The LM is ~110 primitives merged by material into six draws; its foil is mapped in metres per face, so a primitive's 0–1 UVs don't stretch the crinkle map. `lander.update()` follows `dropAt()` every frame (the drawn ground drops with the streaming anchor; the flag doesn't bother, at 14 m it can't matter), and `lander.push()` does the walker's and rover's collision against raw physics heights, not the drawn ones.

## Sound (§11b)

`sound` is procedural Web Audio: a suit bus (helmet ring and lowpass: everything conducted through the body) and an air bus (zero in vacuum, quiet and dull on Mars, full on Venus), fed by continuous voices (fan, breath, jets, motors, wind) that `stepSound()` steers once a frame and by one-shot `sound.step(k)` footfalls from the physics. Nothing is created until a real click or key press calls `sound.unlock()` — keep it that way: the headless probe runs on the desktop and must never make noise. To test, build the same graph offline: `sound._offline(new OfflineAudioContext(…), VIEW.moon)` returns the voices and one-shots to schedule at explicit times; render and measure RMS per window.

## Verifying changes

There is no headless GPU here, but Firefox is installed and renders under software GL (`LIBGL_ALWAYS_SOFTWARE=1 MOZ_HEADLESS=1`). `--screenshot` is too slow to complete; the working approach is a **reporting probe**, which lives in `tools/probe/`:

```sh
tools/probe/run.sh DRIVER.js OUT_DIR [960x540] [timeout_s]   # → OUT_DIR/probe.log, OUT_DIR/shots/*.jpg
node tools/check.mjs [--save] [world…]                       # terrain kernel: NaNs, purity, µs per call
```

- `run.sh` builds `probe.html` from `index.html` (`mkprobe.py` — every anchor must match exactly once, so if `index.html` moves one, fix the anchor there), starts `server.py` and a headless Firefox with its own profile under `OUT_DIR`, waits for `DONE` in the log, then kills only the processes it started and deletes `probe.html`.
- A driver is a file defining `async function drive(probe)`. It is appended inside the page's module script, so it sees `applyWorld`, `player`, `yawObj`, `pitchObj`, `keys`, `setMode`, `sunElev`, `chunkStreamer`, `quality` and the rest directly. `probe` (`lib.js`) has `at({ world, x, z, h, yaw, pitch, mode, sun })`, `idle()` (loading done, nothing pending, then a few frames for the shadow pass), `frames(n)`, `snap(name)` and `log(msg)`. See `tools/probe/drivers/worlds.js`.
- The probe runs on **low** (`quality.set('low', false)`, which does not overwrite the remembered tier) at 960×540: 1–2 fps under software GL on the Fedora box in September 2026, booting in about 15 s. Medium runs at about 0.1 fps; set `window.__probeQuality` in a driver only if a tier-specific bug needs it.
- Errors, warnings, worker errors and unhandled rejections are reported to the log. Never start a second probe while one is running (they share a port and the profile lock).
- `check.mjs` compares against `tools/perf-baseline.json`, recorded on this machine. Don't run it while a probe is going; software GL loads every core. Re-record with `--save` only after a change you meant to cost something.

`snap()` sets `eyePass.uniforms.uReset.value = 1` before each shot: at the probe's frame rate adaptation would otherwise never converge. For the same reason judge motion by position deltas, not expected speeds. A debug view is easiest to get by string-replacing a line into the ground shader's `tonemapping_fragment` patch that writes an intermediate (`surfShadow`, `microLit`, a normal) to `gl_FragColor`, with the eye range pinned to `[1, 1]` — or, for geometry, by swapping each chunk's material for a flat `MeshBasicMaterial` per level (`mesh.userData.level`), which shows cracks as sky. `probe.html` is scaffolding, not a deliverable; `run.sh` deletes it.

Physics is verifiable numerically in the same probe: hold `keys.Space` for a second, release, and measure apex and hang time (currently 0.87 m / 2.05 s lunar at the probe's 50 ms frames, against 0.82 m / 2.02 s from `pushSpeed()`; the suited astronaut cannot leave the ground under `G_EARTH`). Walking settles at `sqrt(Fr·g·L)` from `SUIT`. On-foot physics has no tuning constants beyond `SUIT`, `JET` and each world's `mu`; if a number feels wrong, find which of those is wrong rather than adding a factor. The rover's grip scales with its spring load (`st.load`), which is zero in the air.

## Environment

- The shell has `noclobber` **on**: `> file` fails if the file exists. Use `rm -f` first, or `>|`.
- `pkill -f <pattern>` and `pgrep -f` match the invoking shell's own command line — `pkill` will kill your Bash call mid-command (observed with `firefox` and `server.py`). Kill by PID, or split the pattern so it doesn't match itself. The user may have their own Firefox open; only ever kill the PID you launched and its children.
