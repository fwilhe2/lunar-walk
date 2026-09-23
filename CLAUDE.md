# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A first-person planetary surface simulator — Moon, Mars, Phobos, Deimos, Venus — with an **unbounded, streamed surface** and three locomotion modes (EVA / rover / flight). Three.js r160, **no build step, no package manager, no tests, no network at runtime** — every texture is generated in the browser at load, and terrain chunks are generated forever in Web Workers as the player moves. `README.md` documents the physical modelling decisions (crater morphometry, Hapke photometry, terrain shadows, eye adaptation, curvature, Earth's phase); read it before changing anything that claims to be realistic, since most constants there are deliberate rather than tuned by eye.

## Running

```sh
python3 -m http.server 8000    # ES module imports are blocked over file://
```

There is nothing to build, lint, or test. Verification is visual — see *Verifying changes* below.

## Layout

- `index.html` — the entire application, ~5,600 lines, in numbered sections (`1. TERRAIN KERNEL` … `13. DEMO`, plus `1b`, `4b`, `5b`). Grep for `^   [0-9]*[b]*\. [A-Z]` to jump between them.
- `three.module.js` — vendored Three.js r160 (MIT).
- `jsm/postprocessing/`, `jsm/shaders/` — vendored Three.js addons for the composer, resolved via the `three/addons/` importmap entry.

Sections are ordered by dependency: terrain kernel → per-world view table (1b) → worker source → renderer and lights → regolith textures (4) → surface-light library (4b) → chunk streamer (5) → terrain shadows (5b) → rocks → sky, Earth and companions → footprints → dust → post → rover → player/loop → demo. Anything added mid-file must respect that; in particular §4b must precede every material that calls `surfacePatch()`.

## The central invariant

All terrain math lives in the `TERRAIN_SOURCE` string (§1). It is eval'd into the main thread **and** prepended to the mesh-worker blob (§2), so both sides compute byte-identical heights. `terrainHeight(x, z)` is the single source of truth for the surface. It feeds:

- chunk mesh vertices (built in workers, §2/§5)
- walking collision, flight floor, and all four rover wheels (§11/§12)
- footprint and wheel-track placement (§8) and `terrainNormal()`, which finite-differences it
- rock placement (§6) and the flag base

Never introduce a second height source, displace the mesh in a vertex shader, or add terrain math outside `TERRAIN_SOURCE` — the CPU and the workers must keep agreeing on where the ground is. If you change anything in `TERRAIN_SOURCE`, every streamed chunk and every physics query changes together; that is the point.

Two things look like exceptions and are not:

- **Terrain shadows (§5b)** render the *chunk meshes themselves* top-down into height clipmaps. That is the drawn mesh, curvature drop and LOD sink included, so shadows land on exactly what is visible. Do not replace this with calls to `terrainHeight()` on the GPU or CPU.
- **Sub-metre relief** — the regolith normal map and the procedural micro-craters in the ground shader (§4b) — only bends normals and darkens light. It never moves geometry and physics never sees it, like any normal map.

**Craters are not stored.** `cellCraters(layer, cx, cz)` re-derives them on demand from hashed integer cell coordinates in size classes (`CRATER_LAYERS`), cached in a **direct-mapped** table per layer (`ccX`/`ccZ`/`ccList`, reset by `craterCacheReset()`). A miss or collision just recomputes, which is safe because the list is a pure function of (layer, cell). Don't go back to a string-keyed `Map`: building 45 string keys per `terrainHeight()` call cost more than everything else in it. If you add a class or grow `rMax`, keep `rMax * 1.9 < cell`, and keep ray extent under `cell * 0.88` for the classes scanned by `rayBrightness()`. Crater age is skewed per class (`ageK`) toward old and shallow — equilibrium populations are mostly degraded — and `craterField()` also writes `CR_ALB`, a side output for the worker's colour pass (fresh-ejecta halos); physics ignores it.

## The sun's azimuth is fixed — and must stay fixed

`SUN_AZ` never changes; only `sunElev` does. Three systems depend on that:

- the terrain horizon maps (§5b) store, per texel, the skyline toward that azimuth — moving the sun in elevation costs nothing, moving it in azimuth would invalidate every map;
- the regolith normal map's alpha (§4) is a baked micro-horizon toward the same azimuth, in texture space (chunk UVs are world x/3, z/3);
- the hex tiling in the ground shader therefore uses translation-only offsets — a rotated copy of the tile would point its baked horizon the wrong way.

If the sun ever has to move in azimuth, all three need rebuilding for the new direction.

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
- **Purge discipline.** Stale chunks are removed only when their level has nothing pending, so motion never opens holes. Dispose geometry when removing; the material is shared.
- **Skirts.** Each chunk's outer vertex ring is clamped to the edge and dropped to hide LOD seams; the (n+3)² height grid exists so edge normals are finite-differenced from true out-of-chunk samples.
- **Coarse levels sink** (`sink`) a little so partial overlaps with finer levels don't z-fight — and so the top-down height pass in §5b picks the fine mesh wherever they overlap.
- `chunkStreamer.version` bumps on every mesh add/remove; §5b watches it to know when to rebuild the shadow maps.

## Terrain shadows (§5b)

Four clipmap levels (512 m … 32 km at 1024² each). A rebuild renders `chunkGroup` into half-float height targets (borrowed into a private scene with an override material, then returned to `scene`), then marches each horizon texel toward the sun (~150 steps to 8 km, 3 km on the moonlets). It runs only when the chunk set changes or you leave the middle of the finest level, spread over five frames; `update(…, true)` forces it into one frame and is used once when a world finishes loading. Heights are stored relative to `refY` so half floats keep centimetre precision near the player. Venus turns the whole system off (`world.shadows === false`).

## Exposure, tone mapping, bloom (§10)

- `eyePass` meters each frame on the GPU (luminance-weighted mean, centre-weighted, sun clipped), adapts through a pair of 1×1 targets and writes the exposed image. Per-world `eye: [key, min, max]`. Nothing reads it back except `eyePass.readback()`, which is for tuning.
- Tone mapping is per world (`world.tone`): AgX by default, ACES where the sky's own colour matters (Mars, Venus).
- Bloom runs **after** exposure, on a frame clamped at 6, with a threshold in perceived units. UnrealBloom's blur is truncated at one sigma and draws a visible box around anything much brighter than its threshold; the wide sun glare is the corona sprite instead, which divides the exposure back out (`EYE_TEX`) so it looks the same however open the eye is. Sprites and anything else additive near the sun need `fog: false` or the fog colour paints the whole quad.
- Stars and the Milky Way have a physical gain (`world.starGain`): invisible under daylight adaptation, visible only when the eye opens up with no lit ground in view.

## Load-time and per-frame budget

Boot builds the opening rings in workers (a few seconds on real hardware); after that chunk builds ride on player movement. `terrainHeight()` runs ~67k times for one near chunk — about 2.5 µs a call on the Moon once warm — so a cheap-looking addition costs real stutter on every 256 m boundary crossing. Existing optimisations that are easy to undo by accident:

- The ridged-highlands terms are skipped when the continental mask is closed (`hl <= 0.004`) — they cost more than the rest of the function combined.
- `cellCraters` results are cached (direct-mapped, see above); anything that varies crater output per query would have to bypass the cache (don't).
- `hash2()` is an integer bit-mix taking **lattice coordinates only**. For hashing a float position use `hashF()` (see the boulder deformation, which needs shared icosahedron corners to agree).
- The ground shader skips the fine regolith octave past ~140 m, where it would only mip-average to its mean (`rgMeanC`).

Profile in Node rather than guessing — extract `TERRAIN_SOURCE`, eval it, and time the functions directly (warm them up first: the first few thousand calls run unoptimised and mislead).

## Three.js r160 specifics

These are version-pinned and will silently break on upgrade:

- **`onBeforeCompile` uniforms need a hand-written GLSL declaration.** Registering `shader.uniforms.foo` binds the value but declares nothing; without a prepended `uniform vec3 foo;` the program fails to link and the material silently falls back. This already bit once.
- The ground material patches the chunks `map_fragment`, `normal_fragment_maps`, `lights_fragment_begin` and `tonemapping_fragment`, relying on r160's names (`vMapUv`, `vNormalMapUv`, `tbn`, `vViewPosition`, `geometryNormal`, `directionalLights`, `directionalLightShadows`, `vDirectionalShadowCoord`, `getShadow`, `receiveShadow`). Variables declared in one patched chunk (`rgUv`, `rgDist`, `microLit`, `surfShadow` …) are read in later ones — they all live in the same `main()`. `LIGHTS_BEGIN` is built by slicing `THREE.ShaderChunk.lights_fragment_begin` and throws if its layout changed. Verify against `three.module.js` before editing — the chunk sources are greppable there.
- **Tone mapping and the composer**: three applies `renderer.toneMapping` *only* when rendering to the canvas, not into a render target. So inside `EffectComposer` everything renders linear HDR and the trailing `OutputPass` does tone mapping and colour conversion. Custom `ShaderMaterial`s must still end with `#include <tonemapping_fragment>` and `#include <colorspace_fragment>` — no-ops inside the composer.
- Clear colours set while a render target is bound stay in linear working space (`getUnlitUniformColorSpace`), which is what lets §5b clear its height targets to −30,000.
- Both Earth shaders (§7) work in **world space**; `earthGroup.userData.sync()` supplies a world-space sun direction, and the whole group follows the camera each frame so Earth shows no parallax. Don't reintroduce an inverse-matrix transform. The atmosphere shell renders `BackSide`, so its normals point *with* the sun on the lit limb — `dot(N, L)`, not `dot(-N, L)`.

## Verifying changes

There is no headless GPU here, but Firefox is installed and renders under software GL (`LIBGL_ALWAYS_SOFTWARE=1 MOZ_HEADLESS=1`). `--screenshot` is too slow to complete; the working approach is a **reporting probe**:

1. Write a scratchpad Python server that serves the repo, logs `GET`/`POST /report?m=…` to a file, and saves a `POST /shot` data-URL body to a JPEG.
2. Generate a throwaway `probe.html` from `index.html` by string replacement — optionally shrink `l0Step` and the §5b clipmap resolution (`const N = 1024` → 512) to cut time, hook `window.onerror`, `console.error`/`warn` and each worker's `onerror` to `navigator.sendBeacon('/report?…')`, add a hook after `composer.render()` in the animation loop, and replace the `overlay.hidden = false;` line with an async driver that removes the overlay, sets `keys.*` / `sunElev` / camera yaw and pitch, calls `setMode(…)` or `applyWorld(…)`, waits for `chunkStreamer.pending() === 0` plus a few frames (the shadow pass takes five), and posts `renderer.domElement.toDataURL('image/jpeg')` from the frame hook.
3. Launch headless Firefox with its own `--profile` at the probe, poll the log for a `DONE` sentinel, then `Read` the JPEGs. Never start a second probe while one is running.

Set `eyePass.uniforms.uReset.value = 1` before each shot: at the probe's frame rate (one frame every one to three minutes at 1280×720) adaptation would otherwise never converge. For the same reason judge motion by position deltas, not expected speeds. Boot takes 2.5–5 minutes under software GL. A debug view is easiest to get by string-replacing a line into the ground shader's `tonemapping_fragment` patch that writes an intermediate (`surfShadow`, `microLit`, a normal) to `gl_FragColor`, with the eye range pinned to `[1, 1]`. Delete `probe.html` when finished — it is scaffolding, not a deliverable.

Physics is verifiable numerically in the same probe: drive the loop and measure jump apex and hang time (currently 2.15 m / 3.23 s lunar, 0.86 m / 0.82 s terrestrial).

## Environment

- The shell has `noclobber` **on**: `> file` fails if the file exists. Use `rm -f` first, or `>|`.
- `pkill -f <pattern>` and `pgrep -f` match the invoking shell's own command line — `pkill` will kill your Bash call mid-command (observed with `firefox` and `server.py`). Kill by PID, or split the pattern so it doesn't match itself. The user may have their own Firefox open; only ever kill the PID you launched and its children.
