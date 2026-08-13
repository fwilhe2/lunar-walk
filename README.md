# Lunar Walk

A first-person lunar surface simulator. Three.js, no build step, nothing fetched at runtime — every texture in the scene is generated in the browser at load, and the surface itself is generated forever as you travel. Walk, drive an LRV-style rover, or fly.

## Run

ES modules need HTTP, so `file://` won't work:

```sh
python3 -m http.server 8000
```

Then open http://localhost:8000 and click to lock the pointer. The "GENERATING SURFACE" screen is the opening rings of terrain being built in workers — a few seconds of CPU work, not a download.

## Controls

| Key | |
|---|---|
| `W A S D` | move / drive / thrust |
| `Shift` | bounding lope (EVA) · boost (flight) |
| `Space` | jump (EVA) · climb (flight) |
| `C` | descend (flight) |
| `R` | board / leave the rover |
| `F` | flight mode on / off |
| Mouse | look (EVA, flight) · orbit camera (rover) |
| `[` `]` | sun elevation |
| `G` | toggle Moon / Earth gravity |
| `Esc` | release pointer |

Sun elevation is the interesting one. At 5° the craters are all rim and shadow; at 60° the surface flattens into a grey wash and you can barely read the ground — which is exactly the problem Apollo crews had judging distance near lunar noon.

## The surface is unbounded

There is no map. Craters are never stored — they are re-derived on demand from integer cell coordinates through a hash, in five size classes from metre-wide pits to 600 m basins, each class on its own uniform grid sized so a query touches only the 3×3 neighbourhood. Any coordinate you ever visit resolves the same craters, so the surface is infinite yet permanent: drive 30 km out, come back, and your tracks end at the same crater you left.

- **One height function** (`terrainHeight`, shared verbatim between the main thread and the mesh workers) drives the visible mesh, walking collision, all four rover wheels, rock placement and footprints, so you always stand exactly on what you see.
- **Chunk streaming**: four nested levels of terrain chunks (256 m at 1 m resolution near you, out to 16 km chunks at 512 m resolution) build in Web Workers and follow you, covering ±40 km at any moment. Skirts hide the LOD seams; stale chunks are only purged after their replacements arrive, so motion never opens holes.
- **The horizon is real.** Chunks curve away by d²/2R with the true lunar radius, so the world drops below the horizon at ~2.4 km eye height exactly as it should, and from altitude you see the curve.
- **Craters** are a parabolic bowl plus a raised gaussian ejecta rim at roughly the real 1:5 depth-to-diameter ratio, power-law distributed. Age flattens old ones; fresh large ones keep terraced slump walls and bright ejecta rays.
- **Highland provinces**: a continental-scale mask decides where the mare gives way to ridged anorthosite massifs, so a long traverse crosses plains, then mountains, then plains again.
- **Boulders** stream with the ground and cluster on crater rims where ejecta actually lands, down to a carpet of pebbles.

## The light

- One hard sun, near-black shadows, a black sky at noon. A vacuum has nothing to scatter fill light; the weak ambient that remains stands in for regolith bounce and earthshine.
- **Regolith is not Lambertian.** Its BRDF backscatters strongly — looking down-sun the ground brightens sharply because every particle hides its own shadow. That opposition surge, the halo around the photographer's shadow in every Apollo surface photo, is patched into the standard material via `onBeforeCompile`.
- **It sparkles.** Sparse micro-facets of impact glass catch the sun within a dozen metres of your boots — gated by the lit colour so nothing glints inside a shadow.
- Albedo tracks slope, elevation, ray systems and province: scoured slopes expose brighter material, crater floors pool dark fines, highlands are anorthosite rather than mare basalt (~0.13 vs ~0.08 reflectance, so the ground is charcoal, not white).
- HDR sun disc at its true 0.53° with bloom and a corona, then a mild visor grade: vignette, faint grain, a little colour split at the edges.

## The sky

- The **Milky Way** crosses the sky at a slant: a generated band with patchy star clouds, dark dust lanes, and a warm bulge, kept dim enough that it reads only against the black.
- **9,000 stars** with a power-law magnitude distribution and blackbody colours — dim ones skew red, beacons skew blue — rendered as hard round points, because there is no air to twinkle.

## Earth

Built from coarse lon/lat coastline polygons rasterised to an equirectangular map, then coloured per-pixel: ice caps, boreal green, the two desert belts at ±25°, continental shelf shading off the coasts. A custom shader handles the rest —

- a soft terminator, because the atmosphere scatters light past the geometric edge;
- specular sun glint off ocean and only off ocean;
- a cloud sheet banded by Hadley circulation with spiral cyclones stirred in, drifting over a slowly turning globe;
- city lights on the night side, dense in the temperate band and hugging the coasts, dimmed under cloud;
- Rayleigh haze thickening toward the limb, plus an additive shell for the blue arc that stands off the edge.

Earth's phase follows the sun, so `[` and `]` change it. It hangs fixed in the sky and never rises or sets — the Moon is tidally locked, so from any one spot Earth just sits there.

## The rover

An LRV-style buggy built from primitives: aluminium frame, gold MLI boxes, webbing seats, mesh wheels under orange fenders, and a high-gain dish that stays pointed at Earth while you drive. Bicycle-model steering with no authority at rest, wheels that follow the terrain individually, a chassis that rides on soft suspension, chevron wheel tracks stamped into the regolith, and rooster-tails of dust off the wheels at speed. It rolls downhill if you park it badly, and it stays parked where you leave it. Top speed ~17 km/h, like the real one.

## Physics

Gravity is 1.62 m/s². Measured in-engine, the same leg push gives:

| | apex | hang time |
|---|---|---|
| Moon | 2.15 m | 3.23 s |
| Earth | 0.86 m | 0.82 s |

Low weight also means low traction, so acceleration and stopping are sluggish and mid-flight steering is almost nil — you commit to a direction before your boots leave the ground. Press `G` to feel the difference.

Landing throws dust that flies in clean parabolas and drops. No billowing: there's no air to suspend it. Boot prints and wheel tracks stay where you put them, because there's no wind or rain to erase them.

Flight mode is the one deliberate fiction — there is no lunar aircraft to model — capped at 400 m so the streamed horizon always reaches past what you can see.

## Files

- `index.html` — everything: generation, streaming, shaders, physics, HUD.
- `three.module.js` — vendored Three.js r160 (MIT).
- `jsm/` — vendored Three.js post-processing addons (MIT).
