# Surface Walk

A first-person planetary surface simulator with four bodies in it — **the Moon, Mars, Phobos and Deimos**. Three.js, no build step, nothing fetched at runtime: every texture in the scene is generated in the browser at load, and the surface itself is generated forever as you travel. Walk, drive a rover, or fly.

## Run

ES modules need HTTP, so `file://` won't work:

```sh
python3 -m http.server 8000
```

Then open http://localhost:8000 and click to lock the pointer. The "GENERATING" screen is the opening rings of terrain being built in workers — a few seconds of CPU work, not a download.

## Controls

| Key | |
|---|---|
| `W A S D` | move / drive / thrust |
| `Shift` | bounding lope (EVA) · boost (flight) |
| `Space` | jump (EVA) · climb (flight) · suit jet up (moonlets) |
| `C` | descend (flight) · suit jet down (moonlets) |
| `R` | board / leave the rover |
| `F` | flight mode on / off |
| `1` `2` `3` `4` | Moon · Mars · Phobos · Deimos |
| `0` | demo mode on / off |
| Mouse | look (EVA, flight) · orbit camera (rover) |
| `[` `]` | sun elevation |
| `G` | toggle surface / Earth gravity |
| `Esc` | release pointer |

Sun elevation is the interesting one. At 5° the craters are all rim and shadow; at 60° an airless surface flattens into a grey wash and you can barely read the ground — which is exactly the problem Apollo crews had judging distance near lunar noon. On Mars it does something else entirely: the whole sky dims and deepens with it, because the sky *is* the sunlit dust.

## The four bodies

| | gravity | radius | sun | surface | sky |
|---|---|---|---|---|---|
| **Moon** | 1.62 m/s² | 1737 km | 0.53°, 1361 W/m² | mare basalt, 7% | black |
| **Mars** | 3.72 m/s² | 3390 km | 0.35°, 586 W/m² | ferric dust 28% over basaltic sand 10% | butterscotch |
| **Phobos** | 0.0057 m/s² | 11.1 km | 0.35°, 586 W/m² | D-type regolith, 7.1% | black, and 42% Mars |
| **Deimos** | 0.0030 m/s² | 6.2 km | 0.35°, 586 W/m² | D-type regolith, 6.8% | black, and 17% Mars |

One kernel generates all four. Everything that differs between them — gravity, radius, crater populations, the shape of the ground and the colour of the dirt — is a row in a table that is shared **verbatim** with the mesh workers, so a chunk built off-thread and a footstep tested on the main thread never disagree about which world they are on.

## The surface is unbounded

There is no map, on any of them. Craters are never stored — they are re-derived on demand from integer cell coordinates through a hash, in four to six size classes per body, each class on its own uniform grid sized so a query touches only the 3×3 neighbourhood. Any coordinate you ever visit resolves the same craters, so each surface is infinite yet permanent: drive 30 km out, come back, and your tracks end at the same crater you left.

- **One height function** (`terrainHeight`, shared verbatim between the main thread and the mesh workers) drives the visible mesh, walking collision, all four rover wheels, rock placement and footprints, so you always stand exactly on what you see.
- **Chunk streaming**: nested levels of terrain chunks (256 m at 1 m resolution near you, out to 16 km chunks at 512 m resolution) build in Web Workers and follow you. The Moon and Mars stream ±40 km; Phobos and Deimos stop at ±3.5 km, because on a body 22 km across everything past that is kilometres below the horizon and would be pure waste.
- **The horizon is real.** Chunks curve away by d²/2R at each body's true radius. On the Moon that puts the edge of the world below the horizon at ~2.4 km; on Phobos, with a radius of 11 km, the ground falls half a kilometre away from you inside 3.5 km and the horizon closes to a few hundred metres.
- **Craters** are a parabolic bowl plus a raised gaussian ejecta rim at roughly the real 1:5 depth-to-diameter ratio, power-law distributed. Age flattens old ones; fresh large ones keep terraced slump walls.

### What makes each one look like itself

- **Moon** — mare basalt saturated with craters at every scale, because four billion years of bombardment had nothing to erase any of it. A continental-scale mask decides where the mare gives way to ridged anorthosite massifs, so a long traverse crosses plains, then mountains, then plains. Fresh large craters throw bright ejecta rays.
- **Mars** — wind does the work impacts do elsewhere. Craters under a few metres do not survive at all and the survivors are shallow, half filled with sand. Fresh ones end in a **rampart**: a distal ridge where the ejecta, fluidised by ground ice, flowed out as a sheet and stopped. Transverse **dunes** gather in the lows with a long stoss slope and a slip face at the angle of repose, transverse aeolian ridges cover everything between them, and layered mesas terrace into ~9 m beds where wind has cut into the stratigraphy. Every crater trails a dark **wind streak** downwind of itself, where sand has scoured the bright dust off its lee side — the most obvious thing about Mars from orbit.
- **Phobos** — saturated at every scale, and cut by the **grooves**: parallel troughs a couple of hundred metres wide, running in families at three bearings and breaking into chains of pits along their length. They are spaced a few hundred metres apart, as the real ones are, which matters more here than it sounds: any wider and they would be further apart than Phobos's own horizon, and you could walk around the moon without ever finding one.
- **Deimos** — the same rock with a thicker blanket on it. Metres of regolith drape and infill every crater, so it reads visibly smoother, and it has no grooves. Two thirds of its surface is under 5° of slope; on Phobos it is one fifth.

## The light

- On the three airless bodies: one hard sun, near-black shadows, a black sky at noon. What weak fill remains stands in for regolith bounce, earthshine — and on Phobos, **marsshine**, a 42°-wide disc of reflected sunlight overhead worth about 2% of the direct beam and the only thing in a shadow there. Deimos, seven times further out, gets a seventh of that.
- **Regolith is not Lambertian.** Its BRDF backscatters strongly — looking down-sun the ground brightens sharply because every particle hides its own shadow. That opposition surge, the halo around the photographer's shadow in every Apollo surface photo, is patched into the standard material via `onBeforeCompile`. It is strongest on Phobos and nearly absent on Mars, where skylight fills the inter-particle shadows before they can hide.
- **It sparkles** — on the airless bodies. Sparse micro-facets of impact glass catch the sun within a dozen metres of your boots, gated by the lit colour so nothing glints inside a shadow. Mars has none: that glass is made by micrometeorite melting, and Mars has air.
- Albedo tracks slope, elevation, and province, and the sign flips between bodies. On the Moon scoured slopes expose brighter material; on Mars they are *darker*, because what slopes shed there is the bright dust, leaving dark basalt.
- HDR sun disc at its true angular size — 0.53° from the Moon, 0.35° from Mars and its moons, where it also delivers 43% of the flux — with bloom and a corona, then a mild visor grade: vignette, faint grain, a little colour split at the edges.

## The sky

- The **Milky Way** crosses the sky at a slant: a generated band with patchy star clouds, dark dust lanes, and a warm bulge, kept dim enough that it reads only against the black.
- **9,000 stars** with a power-law magnitude distribution and blackbody colours — dim ones skew red, beacons skew blue — rendered as hard round points, because there is no air to twinkle.
- On Mars, both are switched off and a dust-scattering dome switched on. Six millibars of CO₂ scatters next to nothing by itself; what you see is the micron ferric aerosol it carries, at an optical depth around 0.5 on a clear sol. That inverts Earth's sky in every respect: dust scatters long wavelengths, so the bulk of it is butterscotch — but the particles are large compared to the wavelength, so their forward-scattering lobe is narrow and comparatively neutral and piles up in a halo a few degrees around the sun, which therefore reads **blue** against an orange sky. Nobody predicted it; Viking 1 photographed it in 1976. The same dust hazes the distance, so the fog takes the sky's own colour and both dim together as the sun goes down.

## What hangs overhead

Every companion body sits on the same 6,200 m shell and is stated at an angular size, so they are comparable to each other. All of them are placed anti-sunward, because a body on the sun's side of the sky shows you its night.

- **Earth from the Moon** — 1.9° across, drawn at 4.8° on purpose. Coastlines as coarse lon/lat polygons rasterised to an equirectangular map, then coloured per-pixel: ice caps, boreal green, the two desert belts at ±25°, continental shelf shading off the coasts. A custom shader handles the rest — a soft terminator, specular glint off ocean and only off ocean, a cloud sheet banded by Hadley circulation with spiral cyclones stirred in, city lights on the night side dimmed under cloud, and Rayleigh haze thickening toward the limb.
- **Mars from Phobos** — 42° of sky, drawn at true size because it needs no help. At that size the map is magnified far past anything a canvas could hold, so it is built in three layers, each covering a scale the one before cannot:
  - **albedo** — the classic map, Syrtis Major and Acidalia and Mare Erythraeum and the rest, painted over the global ferric dust that gets redistributed every dust season, plus Valles Marineris, the Tharsis shields with their dark calderas, both polar caps, and a steep power law of craters that survive on the ancient southern highlands and are mostly buried under the young northern plains;
  - **elevation** — what the albedo cannot carry: the crustal dichotomy, the Tharsis bulge with Olympus standing off it, Hellas and Argyre and Isidis. It is what lets the terminator rake across real topography instead of a painted ball;
  - **procedural detail** — generated per fragment in the shader from 3D noise on the sphere, so it stays sharp however close you get, and bends the normal along with the baked relief.

  Phobos is tidally locked, so Mars hangs in one place and never rises or sets — but it turns underneath, one Martian day against the 7h39m Phobos takes to go round. From Deimos the same view is 17°. The atmospheric shell is 1.2% of the radius, not Earth's 3.5%: Mars's scale height barely stands off its limb.
- **Phobos and Deimos from Mars** — 0.20° and 2 arcminutes. Phobos is drawn at 2.5×, the same exaggeration as Earth; Deimos is left as what it is, a bright star. Phobos crosses the sky *westward* in about four hours and Deimos keeps the real ratio to it, creeping.

Every phase follows the sun, so `[` and `]` change all of them.

## The rover

An LRV-style buggy built from primitives: aluminium frame, gold MLI boxes, webbing seats, mesh wheels under orange fenders, and a high-gain dish that stays pointed at the relay while you drive. Bicycle-model steering with no authority at rest, wheels that follow the terrain individually, a chassis that rides on soft suspension, chevron wheel tracks stamped into the regolith, and rooster-tails of dust off the wheels at speed. It rolls downhill if you park it badly, and it stays parked where you leave it.

It is available on the Moon and Mars. On Phobos and Deimos pressing `R` tells you why not: a wheel needs weight on it to make traction, and at six thousandths of a g there is none to be had — spin a wheel there and you lift the rover, not the regolith.

## Physics

Gravity is each body's real value. The jump is a takeoff velocity, not a fixed height: the same suited push gives roughly the same launch speed whatever you are standing on, and the difference in gravity does the rest.

| | takeoff | apex | hang time |
|---|---|---|---|
| Moon | 2.65 m/s | 2.15 m | 3.27 s |
| Mars | 3.10 m/s | 1.27 m | 1.67 s |
| Earth (`G`) | 4.20 m/s | 0.86 m | 0.85 s |
| Phobos | 0.117 m/s | 1.20 m | 41.1 s |
| Deimos | 0.085 m/s | 1.20 m | 56.7 s |

On the two Martian moons that model stops working, because a full leg push there is not a jump, it is a launch: 2.65 m/s on Phobos is an apex of six hundred metres and a quarter of an hour in the air, and on Deimos, whose escape velocity is 5.6 m/s, it would simply be the last thing you ever did on Deimos. So there you push with a toe — the table's 1.2 m — and use the suit jets to get around and to come back down. An MMU gives a suited astronaut about 0.35 m/s² in any direction, which is sixty times the local gravity, so it works equally well on the ground and off it. That is not a game concession; it is what EVA on a body this small would actually be.

Traction is proportional to weight, so acceleration, braking and mid-flight steering all scale with gravity — sluggish on the Moon, crisper on Mars, absent on the moonlets. Press `G` to feel any of them against Earth.

Landing throws dust. In vacuum it flies in clean parabolas and drops, with no billowing, because there is no air to suspend it. Mars is the exception in the set: six millibars is not much, but it is not nothing, so fine grains feel drag and the plume lags, spreads and hangs. Boot prints and wheel tracks stay where you put them.

Flight mode is the one deliberate fiction — there is no lunar aircraft to model — capped per body, as height above the ground beneath you rather than an absolute altitude, so the streamed horizon always reaches past what you can see wherever you are.

## Demo mode

`0`, or the link on the opening screen, and it plays itself: a clean background with no crosshair and no readouts.

It holds no privileges. It presses the same keys and turns the same head a player does, and everything downstream of that — traction, jump arcs, suit jets, the rover's steering, chunk streaming — runs exactly as it would under a pair of hands, so what you are watching is the simulation rather than a scripted flythrough. It works in acts: walk somewhere, stop and look at whatever is overhead, take the rover out, go up for the vista, and every few minutes move on to the next body. On the moonlets it hovers on the jets a couple of metres up instead of walking, because that is what you would do. The sun creeps the whole time, since on an airless world the shadows are the scenery.

Any key, or a click, hands the controls back.

## Files

- `index.html` — everything: generation, streaming, shaders, physics, HUD.
- `three.module.js` — vendored Three.js r160 (MIT).
- `jsm/` — vendored Three.js post-processing addons (MIT).
