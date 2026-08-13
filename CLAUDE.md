# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A first-person lunar surface simulator with an **unbounded, streamed surface** and three locomotion modes (EVA / rover / flight). Three.js r160, **no build step, no package manager, no tests, no network at runtime** — every texture is generated in the browser at load, and terrain chunks are generated forever in Web Workers as the player moves. `README.md` documents the physical modelling decisions (crater geometry, regolith BRDF, lunar curvature, Earth's phase); read it before changing anything that claims to be realistic, since most constants there are deliberate rather than tuned by eye.

## Running

```sh
python3 -m http.server 8000    # ES module imports are blocked over file://
```

There is nothing to build, lint, or test. Verification is visual — see *Verifying changes* below.

## Layout

- `index.html` — the entire application, ~2,100 lines, in 12 numbered sections (`1. TERRAIN KERNEL` … `12. PLAYER, MODES & LOOP`). Grep for `   N. ` to jump between them.
- `three.module.js` — vendored Three.js r160 (MIT).
- `jsm/postprocessing/`, `jsm/shaders/` — vendored Three.js addons for the composer, resolved via the `three/addons/` importmap entry.

Sections are ordered by dependency: terrain kernel → worker source → renderer → textures → chunk streamer → rocks → sky → Earth → footprints/dust → post → rover → player/loop. Anything added mid-file must respect that.

## The central invariant

All terrain math lives in the `TERRAIN_SOURCE` string (§1). It is eval'd into the main thread **and** prepended to the mesh-worker blob (§2), so both sides compute byte-identical heights. `terrainHeight(x, z)` is the single source of truth for the surface. It feeds:

- chunk mesh vertices (built in workers, §2/§5)
- walking collision, flight floor, and all four rover wheels (§11/§12)
- footprint and wheel-track placement (§8) and `terrainNormal()`, which finite-differences it
- rock placement (§6) and the flag base

Never introduce a second height source, displace the mesh in a vertex shader, or add terrain math outside `TERRAIN_SOURCE` — the CPU and the workers must keep agreeing on where the ground is. If you change anything in `TERRAIN_SOURCE`, every streamed chunk and every physics query changes together; that is the point.

**Craters are not stored.** `cellCraters(layer, cx, cz)` re-derives them on demand from hashed integer cell coordinates in five size classes (`CRATER_LAYERS`), cached in `craterCache`. Cell sizes guarantee a crater's full reach (1.9 r) stays inside the 3×3 neighbourhood — if you add a class or grow `rMax`, keep `rMax * 1.9 < cell`, and keep ray extent under `cell * 0.88` for the classes scanned by `rayBrightness()`.

## The chunk streamer (§5)

Four nested levels of absolutely-aligned chunks (256 m / 1 km / 4 km / 16 km), finer LOD near the player, covering ±40 km. Things that are easy to break:

- **Curvature anchor.** Chunks curve away by d²/2R around the requesting player cell (`ax`, `az`). This is what buries the streamed edge below the horizon and keeps physics (which uses raw heights) aligned with the visible mesh near the player. Don't make the anchor global, and don't remove the drop.
- **Purge discipline.** Stale chunks are removed only when their level has nothing pending, so motion never opens holes. Dispose geometry when removing; the material is shared.
- **Skirts.** Each chunk's outer vertex ring is clamped to the edge and dropped to hide LOD seams; the (n+3)² height grid exists so edge normals are finite-differenced from true out-of-chunk samples.
- **Coarse levels sink** (`sink`) a little so partial overlaps with finer levels don't z-fight.

## Load-time and per-frame budget

Boot builds the opening rings in workers (a few seconds); after that chunk builds ride on player movement. `terrainHeight()` runs ~67k times for one near chunk, so a cheap-looking addition costs real stutter on every 256 m boundary crossing. Existing optimisations that are easy to undo by accident:

- The ridged-highlands terms are skipped when the continental mask is closed (`hl <= 0.004`) — they cost more than the rest of the function combined.
- `cellCraters` results are cached; anything that varies crater output per query would have to bypass the cache (don't).
- `hash2()` is an integer bit-mix taking **lattice coordinates only**. For hashing a float position use `hashF()` (see the boulder deformation, which needs shared icosahedron corners to agree).

Profile in Node rather than guessing — extract `TERRAIN_SOURCE`, eval it, and time the functions directly.

## Three.js r160 specifics

These are version-pinned and will silently break on upgrade:

- **`onBeforeCompile` uniforms need a hand-written GLSL declaration.** Registering `shader.uniforms.foo` binds the value but declares nothing; without a prepended `uniform vec3 foo;` the program fails to link and the material silently falls back. This already bit once.
- The ground material patches the chunks `map_fragment`, `normal_fragment_maps` and `tonemapping_fragment`, relying on r160's varying names (`vMapUv`, `vNormalMapUv`, `tbn`, `vViewPosition`). The sparkle/surge block reuses `vDist` declared in the normal-maps patch — both live in the same `main()`. Verify against `three.module.js` before editing — the chunk sources are greppable there.
- **Tone mapping and the composer**: three applies `renderer.toneMapping` *only* when rendering to the canvas, not into a render target. So inside `EffectComposer` everything renders linear HDR and the trailing `OutputPass` does tone mapping and colour conversion. Consequences: bloom thresholds are in linear HDR (the sun disc uses a `Color` with components > 1 deliberately), and custom `ShaderMaterial`s must end with `#include <tonemapping_fragment>` and `#include <colorspace_fragment>` — which become no-ops inside the composer and only matter if something later renders direct to canvas.
- Both Earth shaders (§7/§8) work in **world space**; `earthGroup.userData.sync()` supplies a world-space sun direction, and the whole group follows the camera each frame so Earth shows no parallax. Don't reintroduce an inverse-matrix transform. The atmosphere shell renders `BackSide`, so its normals point *with* the sun on the lit limb — `dot(N, L)`, not `dot(-N, L)`.

## Verifying changes

There is no headless GPU here, but Firefox is installed and renders under software GL (`LIBGL_ALWAYS_SOFTWARE=1 MOZ_HEADLESS=1`). `--screenshot` is too slow to complete; the working approach is a **reporting probe**:

1. Write a scratchpad Python server that serves the repo, appends `GET /report?m=…` to a log, and saves a `POST /shot` data-URL body to a JPEG.
2. Generate a throwaway `probe.html` from `index.html` by string replacement — shrink `l0Step`/level extents and the Earth map size to cut generation time, hook `window.onerror`, `console.error`/`warn` and each worker's `onerror` to `navigator.sendBeacon('/report?…')`, and replace the `overlay.hidden = false;` line with an async driver that removes the overlay, sets `keys.*` flags to drive the live animation loop through EVA / `setMode('ROVER')` / `setMode('FLY')`, and posts `renderer.domElement.toDataURL('image/jpeg')` after a `composer.render()` in the same callback.
3. Launch headless Firefox at the probe, poll the log for a `DONE` sentinel, then `Read` the JPEGs.

This surfaces shader link errors and worker crashes as text and gives real frames to judge. The probe runs at very low FPS under software GL, so drive-by-wall-clock covers little sim time — judge motion by position deltas, not expected top speeds. Delete `probe.html` when finished — it is scaffolding, not a deliverable.

Physics is verifiable numerically in the same probe: drive the loop and measure jump apex and hang time (currently 2.15 m / 3.23 s lunar, 0.86 m / 0.82 s terrestrial).

## Environment

- The shell has `noclobber` **on**: `> file` fails if the file exists. Use `rm -f` first.
- `pkill -f <pattern>` matches the invoking shell's own command line and will kill your Bash call mid-command (observed with `firefox` and `server.py`). Kill by PID, or split the pattern so it doesn't match itself.
