# Lunar Walk

A first-person walking simulator on the lunar surface. Three.js, no build step, nothing fetched at runtime — every texture in the scene is generated in the browser at load.

## Run

ES modules need HTTP, so `file://` won't work:

```sh
python3 -m http.server 8000
```

Then open http://localhost:8000 and click to lock the pointer. First load spends ~4 s generating the terrain and the Earth maps — that's the "GENERATING SURFACE" screen, and it's all CPU work, not a download.

## Controls

| Key | |
|---|---|
| `W A S D` | move |
| `Shift` | bounding lope |
| `Space` | jump |
| Mouse | look |
| `[` `]` | sun elevation |
| `G` | toggle Moon / Earth gravity |
| `Esc` | release pointer |

Sun elevation is the interesting one. At 5° the craters are all rim and shadow; at 60° the surface flattens into a grey wash and you can barely read the ground — which is exactly the problem Apollo crews had judging distance near lunar noon.

## The surface

- **One height function** drives the mesh, the walking collision, and the footprint placement, so you always stand exactly on what you see. It's fBm value noise for the mare swell, wrinkle ridges and regolith grain, plus ~1,430 craters resolved through a uniform grid so a query touches ~17 of them instead of all of them.
- **Craters** are a parabolic bowl of excavated material plus a raised gaussian ejecta rim, at roughly the real 1:5 depth-to-diameter ratio. The size distribution is power-law — a few basins, a great many pits — because a mare surface is saturated at small diameters after four billion years with nothing to erase anything. Age drives the rest: old craters are flattened by gardening, fresh large ones keep terraced slump walls, and the freshest still have bright ejecta rays streaking out to 200 m.
- **Boulders** cluster on crater rims where ejecta actually lands, not uniformly.
- **Highlands** rise toward the map edges, so the world ends in a horizon rather than a boundary.

## The light

- One hard sun, near-black shadows, a black sky at noon. A vacuum has nothing to scatter fill light; the weak ambient that remains stands in for regolith bounce and earthshine.
- **Regolith is not Lambertian.** Its BRDF backscatters strongly — looking down-sun, the ground brightens sharply because every particle hides its own shadow. That opposition surge, the halo around the photographer's shadow in every Apollo surface photo, is patched into the standard material via `onBeforeCompile`.
- Albedo tracks slope, elevation and ray systems: scoured slopes expose brighter material, crater floors pool dark fines, highlands are anorthosite rather than mare basalt (~0.13 vs ~0.08 reflectance, so the ground is charcoal, not white).
- Two octaves of albedo and normal map at different scales, with the fine octave fading out at distance — a 5 m tile stretched over 1 km would otherwise be an obvious grid.
- HDR bloom on the sun disc, sized to its true 0.53°, then a mild visor grade: vignette, faint grain, a little colour split at the edges.

## Earth

Built from coarse lon/lat coastline polygons rasterised to an equirectangular map, then coloured per-pixel: ice caps, boreal green, the two desert belts at ±25°, continental shelf shading off the coasts. A custom shader handles the rest —

- a soft terminator, because the atmosphere scatters light past the geometric edge;
- specular sun glint off ocean and only off ocean;
- a cloud sheet banded by Hadley circulation (wet at the equator and ~55°, dry at ~25°), drifting slowly;
- city lights on the night side, dimmed under cloud;
- Rayleigh haze thickening toward the limb, plus an additive shell for the blue arc that stands off the edge.

Earth's phase follows the sun, so `[` and `]` change it. It hangs fixed in the sky and never rises or sets — the Moon is tidally locked, so from any one spot Earth just sits there.

## Physics

Gravity is 1.62 m/s². Measured in-engine, the same leg push gives:

| | apex | hang time |
|---|---|---|
| Moon | 2.15 m | 3.23 s |
| Earth | 0.86 m | 0.82 s |

Low weight also means low traction, so acceleration and stopping are sluggish and mid-flight steering is almost nil — you commit to a direction before your boots leave the ground. Press `G` to feel the difference.

Landing throws dust that flies in clean parabolas and drops. No billowing: there's no air to suspend it. Boot prints stay where you put them, because there's no wind or rain to erase them.

## Files

- `index.html` — everything: generation, shaders, physics, HUD.
- `three.module.js` — vendored Three.js r160 (MIT).
- `jsm/` — vendored Three.js post-processing addons (MIT).
