# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A first-person lunar walking simulator. Three.js r160, **no build step, no package manager, no tests, no network at runtime** — every texture is generated in the browser at load. `README.md` documents the physical modelling decisions (crater geometry, regolith BRDF, Earth's phase); read it before changing anything that claims to be realistic, since most constants there are deliberate rather than tuned by eye.

## Running

```sh
python3 -m http.server 8000    # ES module imports are blocked over file://
```

There is nothing to build, lint, or test. Verification is visual — see *Verifying changes* below.

## Layout

- `index.html` — the entire application, ~1250 lines, in 12 numbered sections (`1. NOISE` … `12. LOOP`). Grep for `   N. ` to jump between them.
- `three.module.js` — vendored Three.js r160 (MIT).
- `jsm/postprocessing/`, `jsm/shaders/` — vendored Three.js addons for the composer, resolved via the `three/addons/` importmap entry.

Sections are ordered by dependency: noise → craters → renderer → textures → terrain mesh → scene objects → post → player → loop. Anything added mid-file must respect that.

## The central invariant

`terrainHeight(x, z)` (§2) is the **single source of truth for the surface**. It feeds, in order:

- the terrain mesh vertices (§5)
- walking collision and ground contact (§12 `step()`)
- footprint placement (§8) and `terrainNormal()`, which finite-differences it
- boulder placement (§6) and the flag base (§7)

Change it and all five move together — that is why the player never floats or sinks. Never introduce a second height source or displace the mesh in a vertex shader; the CPU would no longer know where the ground is.

`craterField()` is backed by a uniform grid (`cells`, `CELL = 48`) so a query touches ~17 craters instead of all ~1,430. Any new crater must be inserted into that grid, not just pushed onto `craters`.

## Load-time budget

Generation is ~4 s of pure JS on the "GENERATING SURFACE" screen, and it is the main cost of any terrain change. Rough split at `SEGMENTS = 512` (263k vertices): terrain ~2.5 s, ray systems ~0.5 s, Earth maps ~0.8 s.

Both hot functions are called once per vertex, so a cheap-looking addition to `terrainHeight()` or `rayBrightness()` costs a quarter-million evaluations. Two optimisations already there are easy to undo by accident:

- `terrainHeight()` skips both `ridged()` calls when `r <= 0.52` — they cost more than the rest of the function combined and contribute nothing over the mare.
- `rayBrightness()` rejects on squared distance against a precomputed `far2` before any `sqrt`/`atan2`/`valueNoise`. Ray extent is capped at 200 m for exactly this reason; uncapping it makes the largest craters' rays cover the whole map and nothing rejects.
- `hash2()` is an integer bit-mix, not the usual `sin()` trick, and takes **lattice coordinates only**. For hashing a float position use `hashF()` (see the boulder deformation, which needs shared icosahedron corners to agree).

Profile in Node rather than guessing — extract the module script, cut it at `3. RENDERER`, stub `THREE.MathUtils`, and time the functions directly.

## Three.js r160 specifics

These are version-pinned and will silently break on upgrade:

- **`onBeforeCompile` uniforms need a hand-written GLSL declaration.** Registering `shader.uniforms.foo` binds the value but declares nothing; without a prepended `uniform vec3 foo;` the program fails to link and the material silently falls back. This already bit once.
- The ground material patches the chunks `map_fragment`, `normal_fragment_maps` and `tonemapping_fragment`, relying on r160's varying names (`vMapUv`, `vNormalMapUv`, `tbn`, `vViewPosition`). Verify against `three.module.js` before editing — the chunk sources are greppable there.
- **Tone mapping and the composer**: three applies `renderer.toneMapping` *only* when rendering to the canvas, not into a render target. So inside `EffectComposer` everything renders linear HDR and the trailing `OutputPass` does tone mapping and colour conversion. Consequences: bloom thresholds are in linear HDR (the sun disc uses a `Color` with components > 1 deliberately), and custom `ShaderMaterial`s must end with `#include <tonemapping_fragment>` and `#include <colorspace_fragment>` — which become no-ops inside the composer and only matter if something later renders direct to canvas.
- Both Earth shaders (§7) work in **world space**; `earthGroup.userData.sync()` supplies a world-space sun direction. Don't reintroduce an inverse-matrix transform. The atmosphere shell renders `BackSide`, so its normals point *with* the sun on the lit limb — `dot(N, L)`, not `dot(-N, L)`.

## Verifying changes

There is no headless GPU here, but Firefox is installed and renders under software GL (`LIBGL_ALWAYS_SOFTWARE=1 MOZ_HEADLESS=1`). `--screenshot` is too slow to complete; the working approach is a **reporting probe**:

1. Write a scratchpad Python server that serves the repo, appends `GET /report?m=…` to a log, and saves a `POST /shot` data-URL body to a JPEG.
2. Generate a throwaway `probe.html` from `index.html` by string replacement — override `SEGMENTS`, the Earth map size and boulder count to cut generation time, hook `window.onerror` and `console.error`/`warn` to `navigator.sendBeacon('/report?…')`, and replace the `overlay.hidden = false;` line with code that removes the overlay, drives `step()` directly, calls `composer.render()`, and posts `renderer.domElement.toDataURL('image/jpeg')`.
3. Launch headless Firefox at the probe, poll the log for a `DONE` sentinel, then `Read` the JPEG.

This surfaces shader link errors as text and gives real frames to judge. Because `toDataURL` needs a live drawing buffer, call `composer.render()` immediately before it in the same callback. Delete `probe.html` when finished — it is scaffolding, not a deliverable.

Physics is verifiable numerically in the same probe: drive `step()` in a loop and measure jump apex and hang time (currently 2.15 m / 3.23 s lunar, 0.86 m / 0.82 s terrestrial).

## Environment

- The shell has `noclobber` **on**: `> file` fails if the file exists. Use `rm -f` first.
- `pkill -f <pattern>` matches the invoking shell's own command line and will kill your Bash call mid-command (observed with `firefox` and `server.py`). Kill by PID, or split the pattern so it doesn't match itself.
