# Surface Walk

A first-person planetary surface simulator with seven bodies in it, from the sun outward — **Venus, the Moon, Mars, Phobos, Deimos, Europa and Pluto**. Three.js, no build step, nothing fetched at runtime: every texture in the scene is generated in the browser at load, and the surface itself is generated forever as you travel. Walk, drive a rover, or fly.

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
| `1` `2` `3` `4` `5` `6` `7` | Venus · Moon · Mars · Phobos · Deimos · Europa · Pluto |
| `0` | demo mode on / off |
| Mouse | look (EVA, flight) · orbit camera (rover) |
| `[` `]` | sun elevation |
| `G` | toggle surface / Earth gravity |
| `Q` | rendering quality: high · medium · low |
| `Esc` | release pointer |

Sun elevation is the interesting one. At 5° the craters are all rim and shadow, and every shadow is a black pool that reaches across the ground; at 60° an airless surface flattens into a grey wash and you can barely read the ground — which is exactly the problem Apollo crews had judging distance near lunar noon. Turn your back to the sun at any elevation and it happens again: the shadows all hide behind whatever casts them, and the ground washes out into a featureless glare around your own shadow. On Mars it does something else entirely: the whole sky dims and deepens with it, because the sky *is* the sunlit dust.

## The seven bodies

| | gravity | radius | sun | surface | sky |
|---|---|---|---|---|---|
| **Venus** | 8.87 m/s² | 6052 km | none — 17 W/m², all of it scattered | flood basalt, 10% | orange, and opaque |
| **Moon** | 1.62 m/s² | 1737 km | 0.53°, 1361 W/m² | mare basalt, 7% | black |
| **Mars** | 3.72 m/s² | 3390 km | 0.35°, 586 W/m² | ferric dust 28% over basaltic sand 10% | butterscotch |
| **Phobos** | 0.0057 m/s² | 11.1 km | 0.35°, 586 W/m² | D-type regolith, 7.1% | black, and 42% Mars |
| **Deimos** | 0.0030 m/s² | 6.2 km | 0.35°, 586 W/m² | D-type regolith, 6.8% | black, and 17% Mars |
| **Europa** | 1.31 m/s² | 1561 km | 0.10°, 50 W/m² | water ice, 67% | black, and 12° of Jupiter |
| **Pluto** | 0.62 m/s² | 1188 km | a point, 1.26 W/m² | tholin 9%, methane frost 80% | black, a faint blue haze, and 3.7° of Charon |

One kernel generates all seven. Everything that differs between them — gravity, radius, crater populations, the shape of the ground and the colour of the dirt — is a row in a table that is shared **verbatim** with the mesh workers, so a chunk built off-thread and a footstep tested on the main thread never disagree about which world they are on.

## The surface is unbounded

There is no map, on any of them. Craters are never stored — they are re-derived on demand from integer cell coordinates through a hash, in one to six size classes per body, each class on its own uniform grid sized so a query touches only the 3×3 neighbourhood. Any coordinate you ever visit resolves the same craters, so each surface is infinite yet permanent: drive 30 km out, come back, and your tracks end at the same crater you left.

- **One height function** (`terrainHeight`, shared verbatim between the main thread and the mesh workers) drives the visible mesh, walking collision, all four rover wheels, rock placement and footprints, so you always stand exactly on what you see.
- **Chunk streaming**: nested levels of terrain chunks (256 m at 1 m resolution near you, out to 16 km chunks at 256 m resolution) build in Web Workers and follow you. The Moon, Mars, Europa and Pluto stream ±40 km; Phobos and Deimos stop at ±3.5 km, because on a body 22 km across everything past that is kilometres below the horizon and would be pure waste; Venus stops at ±10 km, for the opposite reason — the ground is still there, but the air is in front of it.
- **The horizon is real.** Chunks curve away by d²/2R at each body's true radius. On the Moon that puts the edge of the world below the horizon at ~2.4 km; on Phobos, with a radius of 11 km, the ground falls half a kilometre away from you inside 3.5 km and the horizon closes to a few hundred metres. **On Venus it curves the wrong way.** 92 bar of CO₂ bends a horizontal ray on a radius of about 1,100 km, six times tighter than the planet curves under it, so light follows the ground down and then some and the surface never drops out of sight — it climbs. The apparent radius works out at −1,330 km: the ground reaches your eye line two kilometres out and keeps rising, and you stand in the bottom of a shallow bowl. The Venera panoramas show exactly this.
- **Craters** follow real simple-crater morphometry (Pike 1977): a fresh bowl is a fifth of its diameter deep, under a rim standing 3.6% of the diameter above the plain, and its ejecta blanket thins as the inverse cube of range (McGetchin 1973), which is what makes a young crater's rim a sharp crest and not a mound. Age takes the bowl down toward a shallow dimple and rounds the crest away. And most craters are old: below a few hundred metres a mare surface sits at crater **equilibrium** — each new crater erases, on average, one that was there — with a cumulative density close to 0.08 D⁻² per square metre, and at equilibrium four in five small craters are subdued ghosts, a few per cent are crisp. The size classes are set to land on that curve from 1.6 m to a kilometre, and each class skews its ages to match. Fresh craters on the airless bodies also wear a **bright halo** of immature ejecta the solar wind has not yet darkened, and the freshest large ones throw rays.
- **Below the mesh**, down to the millimetre, relief is shading only — nothing you can trip on. Sub-metre craters are generated per pixel in the ground shader, each bending the surface normal, casting its own shadow in closed form (a bowl's highest point along any ray is its rim), and hiding the part of itself its near rim would hide from your eye. The last few centimetres are a generated regolith texture: tens of thousands of clods and grains, soft aggregates, angular half-buried pebbles and a scatter of micrometeorite pits, blended three ways across a hexagonal grid of random offsets so the 3 m tile never visibly repeats.

### What makes each one look like itself

- **Venus** — the atmosphere writes this surface, not by eroding it but by standing in the way of everything that would otherwise hit it. 92 bar shields the ground so well that **there is no crater on Venus under about 1.5 km**: anything that would make one is torn up and stopped on the way in. So there is one crater class, it is enormous, and it is almost never there — the real planet has ~1000 craters on 460 million km², one per 680 km square, because it resurfaced itself with lava around 500 Myr ago and started the count over. What you walk on instead is that lava: sheets a few metres thick ending in steep fronts, **wrinkle ridges** where the cooling plain buckled, and **fracture swarms** where it pulled apart. The old crust survives as **tessera** — the ridge-and-groove terrain Ovda Regio is made of, two fabrics crossing at 60°, the roughest ground on the planet, standing a kilometre above the flows drowning it. Up on its crests is the strangest thing here: Venus has one climate, 464 °C everywhere, but it lapses ~8 K/km, so above **4.75 km** the ground is cool enough for heavy metal sulphides to condense out of the air onto it as a bright coating. Every radar map of the highlands shows that line, ignoring the geology and following the contour. The site sits at 4.3 km, so the crests cross it.
- **Moon** — mare basalt saturated with craters at every scale, because four billion years of bombardment had nothing to erase any of it. A continental-scale mask decides where the mare gives way to ridged anorthosite massifs, so a long traverse crosses plains, then mountains, then plains. Fresh large craters throw bright ejecta rays. The soil is not grey but a faint brown-grey — mare reflectance climbs steadily toward the red — at 7–10% albedo.
- **Mars** — wind does the work impacts do elsewhere. Craters under a few metres do not survive at all and the survivors are shallow, half filled with sand. Fresh ones end in a **rampart**: a distal ridge where the ejecta, fluidised by ground ice, flowed out as a sheet and stopped. Transverse **dunes** gather in the lows with a long stoss slope and a slip face at the angle of repose, transverse aeolian ridges cover everything between them, and layered mesas terrace into ~9 m beds where wind has cut into the stratigraphy. Every crater trails a dark **wind streak** downwind of itself, where sand has scoured the bright dust off its lee side — the most obvious thing about Mars from orbit.
- **Phobos** — saturated at every scale, and cut by the **grooves**: parallel troughs a couple of hundred metres wide, running in families at three bearings and breaking into chains of pits along their length. They are spaced a few hundred metres apart, as the real ones are, which matters more here than it sounds: any wider and they would be further apart than Phobos's own horizon, and you could walk around the moon without ever finding one.
- **Deimos** — the same rock with a thicker blanket on it. Metres of regolith drape and infill every crater, so it reads visibly smoother, and it has no grooves. Two thirds of its surface is under 5° of slope; on Phobos it is one fifth.
- **Europa** — ice, and almost nothing on it made by an impact: the surface is 40–90 million years old, young enough that craters are rare, and most of the small ones are secondaries, which arrive in clusters and are absent everywhere else. What covers it is tectonics, from a shell flexed twice a day by Jupiter's tide. **Ridged plains**: generation after generation of ridges, each grown along a crack that cut through everything older, so every younger ridge buries the ones its flanks rest on — completely if it is the bigger, a notch if not — and which generation dominates changes from place to place. On top of them the **double ridges**, two crests and a central trough, a hundred to three hundred metres high and one or two kilometres across, the youngest wearing the dark flanking margins of a triple band. **Bands**, strips of grooved new ice kilometres wide where the shell pulled apart. **Chaos**, where it nearly melted through: the plains broken into rafts that drifted and turned in a hummocky matrix and froze again, each still carrying its ridges, now out of line with its neighbours — Conamara's jigsaw. The rafts are the cells of a Voronoi diagram, evaluated over the plains as they were before they moved, so they tile the ground along straight fractures and open apart toward the chaos interior. And **lenticulae**, domes and pits and dark spots a few kilometres across, most with a small chaos on top. The ice is nearly white; what darkens it is non-ice material cooked by Jupiter's radiation — reddish-brown along the lineae, and in the chaos the yellow-brown of irradiated sea salt that Hubble found in **Tara Regio**, which is where you land, on the edge of a chaos, with the rafts between you and Jupiter. It lies in the lows as a lag; the crests keep the frost; steep faces shed it and show clean ice, and shed blocks, which lie on them as talus.
- **Pluto** — on the side that faces Charon, which New Horizons saw only on approach, at tens of kilometres a pixel: the dark belt that runs most of the way round the equator, the same old ground as Cthulhu Macula. The crust is water ice, as hard at 40 K as granite, and everything is under a mantle of **tholins** — organic dust made from methane by sunlight in the haze and settling out of it for four billion years — which softens everything below the kilometre scale, so the plains roll. Craters are few for the age, and fewer the smaller they are: the Kuiper belt is short of small bodies (Singer et al. 2019), so there is almost nothing under a few hundred metres. Out of the mantle stand ranges of ice crust a few kilometres high, and on their summits is the strangest thing on Pluto: **methane frost capping them like snow**, but for the opposite reason to snow on an Earth mountain — Pluto's air is warmer higher up, and richer in methane, so above a certain height methane condenses onto the ice rather than off it (Bertrand et al. 2020). It follows height, not geology, with a ragged lower edge. You land on flat ground nine kilometres west of a range, with Charon over it.

## The light

- On Venus there is **no sun in the sky and no shadow on the ground**. Twenty kilometres of sulphuric acid cloud and 92 bar of gas leave about 17 W/m² on the surface — one part in eighty of what the Moon gets — and every photon of it arrives scattered from the whole sky at once. Nobody standing on Venus has ever seen where the sun is, so neither do you; there is only a vague brightening over half the sky. The ground is ordinary grey basalt, and everything orange about it is the light.
- On Europa the sun is five times further off than at the Moon: a disc a tenth of a degree across delivering 50 W/m², one part in twenty-seven. That is still an overcast day's worth of light, falling on ice ten times as reflective as lunar soil, so the eye stops down, and the key it adapts to sits higher than on the dark bodies — an eye anchors white on the brightest surface in view, and ice should read as white, not as the mid-grey the Moon's mare does. The same reflectivity lights the shadows: with no sky to fill them, they are lit by the sunlit ice around them, which returns two-thirds of what it gets, so they are several times brighter against the lit ground than a lunar shadow is — and they are the colour of the ice. Earth's snow shadows are blue because the sky lights them; these are not. Jupitershine adds under 1%.
- Pluto is 33 AU out: 1.26 W/m², a thousandth of the Moon's sunlight, from a sun 58 arcseconds across — **a point, not a disc**, though still some two hundred and fifty full moons bright. Noon there is lit like the first minutes after sunset at home, and at that level, against a black sky, **the brighter stars stay out at noon** with the ground in view. Ten microbars of nitrogen do nothing to the light but hold up a haze — twenty-odd layers of it, to 200 km, the blue ring in New Horizons' departure picture — which from the ground is a faint blue glow low down, strongest toward the sun where it scatters forward, and a trace of blue fill in the shadows; the zenith is all but black. It is modelled as single scattering from a haze of vertical optical depth about 0.005, at the faint end of what is measured. The ground mixes dark tholin and bright frost, so its Hapke set is a compromise and the vertex colours say which is which.
- On the other airless bodies: one hard sun, near-black shadows, a black sky at noon. What reaches into a shadow is light bounced off whatever sunlit ground can see into it — the lit far wall of a crater, the plain around a boulder — so it rises and falls with how much ground the sun is lighting. Earthshine is four thousand times fainter than sunlight and adds nothing you could see; on Phobos, **marsshine**, a 42°-wide disc of reflected sunlight overhead worth about 2% of the direct beam, is the only other thing in a shadow. Deimos, seven times further out, gets a seventh of that.

### Shadows, at every range

The ground shadows itself — every crater and hill, from a pit at your boots to a massif ten kilometres off. It can be done cheaply because the sun here only ever moves in elevation, never in azimuth, so for any point on the surface the question of whether it is lit reduces to one number: how high the skyline stands in the sun's direction. The streamed terrain is rendered top-down into four nested height clipmaps (half a metre a texel near you, 32 m at 16 km), and a GPU pass marches every texel toward the sun and stores that skyline. Each pixel of ground then makes a single texture fetch and compares the skyline against the sun's **true angular radius**, so penumbrae come out sharp at a crater's rim and softening with distance from it, as a 0.53° sun makes them. Rocks, the rover, footprints and dust take the same test, seen from their height above the ground; moving the sun costs nothing at all. The maps are rebuilt only when the ground under them changes.

Below that, shadow maps in two cascades handle what stands on the ground. The near one is ±24 m at 2.3 cm a texel with about a centimetre of depth bias, because the sun's penumbra behind a boulder is a centimetre wide and a rock's shadow has to start exactly where the rock meets the regolith. Your own body casts one too, and nothing else of it is drawn: turn your back to the sun and your shadow stretches out ahead of you, helmet and backpack and all, walking when you walk.

### Regolith is not Lambertian

Nothing about the Moon looks right while its soil is treated as matte paint. It is a fluffy, porous layer of dark grains, and it reflects according to **Hapke's model**, implemented in full in the ground shader with the published lunar parameters (Sato et al. 2014, from LROC):

- a **Lommel–Seeliger** core, which makes a lit surface equally bright from every viewing angle — the reason the full Moon has no limb darkening, and the reason the ground brightens toward the horizon;
- a strongly **backscattering** single-particle phase function, so the same ground is five times brighter looking down-sun as looking across the sun at a low sun, and dark looking into it with every rim picked out in light;
- an **opposition surge** from shadow-hiding over the first few degrees and coherent backscatter inside the first half-degree — the halo around the photographer's shadow in every Apollo surface photograph, which here rings the shadow of your helmet;
- **macroscopic roughness**, ~22°, which fills the surface with shadows too small to resolve and darkens it toward grazing angles.

Each body gets its own set: Phobos has the strongest surge in the set (the darkest, most porous regolith anyone has measured), Mars a weak one because skylight fills the gaps between grains, Venus none, because a surge needs a collimated source, and Europa the brightest grains — a single-scattering albedo of 0.96 (Domingue et al. 1991) — with a surge only a fraction of a degree wide, and grain-scale shadows half as deep, because light scatters into them through the ice. Boot prints are compacted soil, which has lost the porous structure the surge comes from, so they almost vanish looking across the sun and turn dark looking down-sun — as they do in the Apollo pictures.

- **It sparkles** — on the airless bodies. Sparse micro-facets of impact glass catch the sun within a dozen metres of your boots, and only where the sun reaches; on Europa the facets are frost. Mars and Venus have none: that glass is made by micrometeorite melting, and both of them have air.
- Albedo tracks slope, elevation, province and age, and the sign flips between bodies. On the Moon scoured slopes and young ejecta expose brighter material; on Mars they are *darker*, because what slopes shed there is the bright dust, leaving dark basalt.

### Eyes, not a camera

Under a low sun that ground spans a range no fixed exposure holds — five times brighter down-sun than across it, fifty times darker in a crater's shadow than beside it — so the view **adapts** the way an eye does, quickly toward the light and slowly toward the dark. It meters the brightest *surface* in view rather than the average pixel, so half a frame of black sky does not overexpose the ground in the other half. From the sunlit surface the sky is simply black, as it is in every Apollo photograph; look up with no lit ground in view, or stand in a shadow, and over a few seconds the eye opens and the brightest stars come out. The sun is an HDR disc at its true angular size — 0.53° from the Moon, 0.35° from Mars and its moons, where it also delivers 43% of the flux — with the glare an eye gives a point source: a steep scattering core and a fringe of faint radial streaks, and no aureole, because there is no air to make one. Then a mild visor grade: vignette, grain, a little colour split at the edges. The airless bodies tone-map through AgX, which keeps a shadow at 2% of the lit ground a very dark grey you can see into; Mars and Venus through ACES, which keeps the colour in a sky that has one.

## The sky

- The **Milky Way** crosses the sky at a slant: a generated band with patchy star clouds, dark dust lanes, and a warm bulge.
- **9,000 stars** with a power-law magnitude distribution and blackbody colours — dim ones skew red, beacons skew blue — rendered as hard round points, because there is no air to twinkle. Both are drawn at brightnesses the dark-adapted eye can reach and the daylight-adapted one cannot, so they appear only when you look away from everything the sun is lighting.
- On Venus the sky is **inverted from every other body here**: the zenith is the bright part, because that is the short way out, and the horizon is dark, because that way the column never ends. Rayleigh scattering over that much gas is tens of optical depths deep in the blue and thin in the red, so what survives to the ground is orange. The same scattering is what limits you to a few kilometres of visibility, and it is why distance here reads as reddening rather than as fading.
- On Mars, both are switched off and a dust-scattering dome switched on. Six millibars of CO₂ scatters next to nothing by itself; what you see is the micron ferric aerosol it carries, at an optical depth around 0.5 on a clear sol. That inverts Earth's sky in every respect: dust scatters long wavelengths, so the bulk of it is butterscotch — but the particles are large compared to the wavelength, so their forward-scattering lobe is narrow and comparatively neutral and piles up in a halo a few degrees around the sun, which therefore reads **blue** against an orange sky. Nobody predicted it; Viking 1 photographed it in 1976. The same dust hazes the distance, so the fog takes the sky's own colour and both dim together as the sun goes down.

## What hangs overhead

Every companion body is stated at an angular size, so they are comparable to each other, and most sit on the same 6,200 m shell; the Galilean moons are drawn just inside or outside it, so that one crossing in front of Jupiter is in front of it. The fixed ones are placed anti-sunward, because a body on the sun's side of the sky shows you its night.

- **Earth from the Moon** — 1.9° across, drawn at 4.8° on purpose. Coastlines start as coarse lon/lat polygons and are resampled through a fractal displacement field, which turns straight edges into ragged, self-similar coasts, then coloured per-pixel: ice caps, boreal forest, the two desert belts at ±25°, a narrow continental shelf. The clouds come from the general circulation — a convective band at the ITCZ, the dry subtropical highs either side of it, the stormy midlatitudes with their comma-shaped cyclones, the Southern Ocean under an almost unbroken deck — about two thirds of the planet covered, which is what makes Earth from space mostly white and blue. A custom shader does the rest: a soft terminator, specular glint off ocean and only off ocean, city lights on the night side dimmed under cloud, and a Rayleigh veil over the whole day side — the reason the oceans look blue and not black — thickening to a glowing rim at the limb.
- **Mars from Phobos** — 42° of sky, drawn at true size because it needs no help. At that size the map is magnified far past anything a canvas could hold, so it is built in three layers, each covering a scale the one before cannot:
  - **albedo** — the classic map, Syrtis Major and Acidalia and Mare Erythraeum and the rest, painted over the global ferric dust that gets redistributed every dust season, plus Valles Marineris, the Tharsis shields with their dark calderas, both polar caps, and a steep power law of craters that survive on the ancient southern highlands and are mostly buried under the young northern plains;
  - **elevation** — what the albedo cannot carry: the crustal dichotomy, the Tharsis bulge with Olympus standing off it, Hellas and Argyre and Isidis. It is what lets the terminator rake across real topography instead of a painted ball;
  - **procedural detail** — generated per fragment in the shader from 3D noise on the sphere, so it stays sharp however close you get, and bends the normal along with the baked relief.

  Phobos is tidally locked, so Mars hangs in one place and never rises or sets — but it turns underneath, one Martian day against the 7h39m Phobos takes to go round. From Deimos the same view is 17°. The atmospheric shell is 1.2% of the radius, not Earth's 3.5%: Mars's scale height barely stands off its limb.
- **Phobos and Deimos from Mars** — 0.20° and 2 arcminutes. Phobos is drawn at 2.5×, the same exaggeration as Earth; Deimos is left as what it is, a bright star. Phobos crosses the sky *westward* in about four hours and Deimos keeps the real ratio to it, creeping.

- **Jupiter from Europa** — 12.2°, at true size, which is twenty-four times our Moon, and flattened to 0.935 at the poles by its own spin. The map is built the way the planet is: a latitude profile of pale zones and brown belts, displaced by turbulence stretched along the jets and stirred by eddies on every boundary, then the named features — the Great Red Spot in its hollow, oval BA, the String of Pearls, the brown barges of the North Equatorial Belt, and along its southern edge the blue-grey hot spots trailing festoons across the Equatorial Zone. True colour: cream and tan and brown, and only the Red Spot is red. Its limb darkens less than a matte ball's (Minnaert), it has a thin shell of haze, and its brightness is the physical one — sunlight on an albedo like the ice underfoot — so it hangs about as bright as the ground. It never moves. But Europa's orbit, Jupiter's equator and the orbits of the other Galilean moons all lie in one plane, which from Europa's surface is a great circle through Jupiter, and from Tara Regio — 10°S, 75° west of the point beneath Jupiter — that circle climbs almost straight up out of the eastern horizon. So **the bands stand nearly on end**, the Red Spot rides down the disc rather than across it as Jupiter turns, and only from near the line through Europa's poles and the sub-Jovian point would the bands lie level.
- **Io, Ganymede and Callisto from Europa** — at their true sizes and distances as they move, all along that same arc. Each is placed where the geometry of the two orbits puts it: Io swings out to 39° from Jupiter and back, grows to 0.84° — bigger than our Moon — as it passes in front of the disc, and shrinks to 0.19° behind it; Ganymede and Callisto, outside Europa's orbit, go right round the sky. Io is sulphur, black paterae and a red plume ring; Ganymede dark and bright terrain with frost caps; Callisto dark and spattered with bright craters.

- **Charon from Pluto** — 3.65° across, seven Moons, at true size, and it never moves: Pluto and Charon are locked face to face, so it hangs in one place over one hemisphere and is never seen at all from the other, where the famous heart is. Its position is computed from the site — 5°S, 60° west of the point beneath it, 27° above the eastern horizon — including the three degrees of parallax from standing on the surface of a body only sixteen radii away. Its north pole, and Pluto's, points along the horizon, so **Mordor Macula**, the red-brown stain on Charon's pole made from methane that escaped Pluto and froze out there, sits on its left-hand limb, and the canyon belt runs up and down the disc. It is grey water ice at an albedo of 0.4 in the same sunlight as ground at 0.1, so it is the brightest thing in the sky after the sun; its light in a shadow is a tenth of a percent of the sun's.

From Venus, nothing. The cloud deck is opaque in both directions: no Earth, no sun, no stars, and a rover down there talks to an orbiter it cannot see, so its dish sits at the zenith and waits for the pass.

Every phase follows the sun, so `[` and `]` change all of them.

## Rocks

Rocks stream with the ground and cluster where ejecta lands — ringed thick around young craters, all but gone around old ones, which have ground their blocks down to soil. They are fractured blocks rather than lumps: each shape is a noise-roughened ellipsoid cut by a handful of random planes, which is how rock breaks, with normals creased so the fracture faces meet at real edges. Three levels of detail, several shapes each, pebble to boulder. Each rests on a low face with a small tilt and is sunk by its true lowest point below the lowest ground under it, so no edge floats and no shadow comes loose from its rock. Fresh rock is a little brighter than the mature soil around it, dust settles on whatever faces up, and up close the surface is pitted and vesicular.

## The rover

The Lunar Roving Vehicle, built from primitives to its real dimensions: a tubular aluminium chassis on double A-arms; wheels of woven zinc-coated piano wire with titanium chevrons over half the band, the bump-stop frame showing through the mesh; pale fibreglass fenders; two webbing seats with the console and T-handle between them; the LCRU up front under white thermal blankets, with the umbrella high-gain dish, the helical low-gain antenna and the TV camera on their masts; the tool pallet at the back. The weave is cut out of the wheels and the dish, so light — and shadow — passes through it. The high-gain dish stays pointed at the relay while you drive. Bicycle-model steering with no authority at rest, wheels that follow the terrain individually, a chassis that rides on soft suspension, chevron wheel tracks stamped into the regolith, and rooster-tails of dust off the wheels at speed. It rolls downhill if you park it badly, and it stays parked where you leave it.

It is available on the Moon, Mars, Europa, Pluto and Venus, though on Venus it crawls: dragging a rover-sized frontal area through 65 kg/m³ at walking pace takes about a kilowatt, so it tops out at 1.7 m/s and does not coast — it stops. On Phobos and Deimos pressing `R` tells you why not: a wheel needs weight on it to make traction, and at six thousandths of a g there is none to be had — spin a wheel there and you lift the rover, not the regolith.

## Physics

Gravity is each body's real value. The jump is a takeoff velocity, not a fixed height: the same suited push gives roughly the same launch speed whatever you are standing on, and the difference in gravity does the rest.

| | takeoff | apex | hang time |
|---|---|---|---|
| Moon | 2.65 m/s | 2.15 m | 3.27 s |
| Mars | 3.10 m/s | 1.27 m | 1.67 s |
| Venus | 4.00 m/s | 0.85 m | 0.86 s |
| Europa | 2.65 m/s | 2.67 m | 4.03 s |
| Pluto | 2.65 m/s | 5.66 m | 8.55 s |
| Earth (`G`) | 4.20 m/s | 0.86 m | 0.85 s |
| Phobos | 0.117 m/s | 1.20 m | 41.1 s |
| Deimos | 0.085 m/s | 1.20 m | 56.7 s |

On the two Martian moons that model stops working, because a full leg push there is not a jump, it is a launch: 2.65 m/s on Phobos is an apex of six hundred metres and a quarter of an hour in the air, and on Deimos, whose escape velocity is 5.6 m/s, it would simply be the last thing you ever did on Deimos. So there you push with a toe — the table's 1.2 m — and use the suit jets to get around and to come back down. An MMU gives a suited astronaut about 0.35 m/s² in any direction, which is sixty times the local gravity, so it works equally well on the ground and off it. That is not a game concession; it is what EVA on a body this small would actually be.

**On Pluto you weigh a sixteenth of what you do at home** — an 80 kg astronaut weighs what a 5 kg bag does — and under half of what you would on the Moon. The same push that clears two metres there puts you nearly six metres up and keeps you in the air for eight and a half seconds, and with a third of the Moon's traction, starting, stopping and turning all take a long time. Nothing here is slippery the way ice is at home: at 40 K there is no liquid film on anything.

**On Europa the physics is easy and the radiation is not.** The ground is ice at −170 °C, as hard as rock and not slippery — ice is slippery on Earth because it is near its melting point — and the gravity a little under the Moon's, so you lope. But Europa orbits inside Jupiter's radiation belts, and the commonly quoted surface dose is 5.4 Sv a day, against 1.4 mSv on the Moon and 0.64 on Mars; four to five sieverts at once kills half the people who receive it. So there the readout keeps count of your dose from the moment you arrive. Tara Regio is on the leading hemisphere, which is spared some of the electrons the trailing one takes, so here that figure is if anything an overestimate.

Traction is proportional to weight, so acceleration, braking and mid-flight steering all scale with gravity — sluggish on the Moon, crisper on Mars, absent on the moonlets. Press `G` to feel any of them against Earth.

**On Venus gravity is not the problem.** At 0.904 g your weight is nearly what it is at home; what stops you is that 92 bar of CO₂ at 464 °C is not air but a fluid at 65 kg/m³, a twentieth the density of water. Walking there is wading. Pushing a suited walker through it at 2 m/s costs about 200 watts, which is a hard sustained effort for a person, so the ceiling is power rather than traction: a trudge at 1.7 m/s and a shove at 2.3. The drag is quadratic and three-dimensional, so it shortens a jump as well as a stride, and Archimedes gets a say too — that much fluid holds up about 7% of your weight.

Landing throws dust. In vacuum it flies in clean parabolas and drops, with no billowing, because there is no air to suspend it. Mars is one exception: six millibars is not much, but it is not nothing, so fine grains feel drag and the plume lags, spreads and hangs. Venus is the other, four orders of magnitude further along — a 50 µm grain of basalt settles through that fluid at about 20 cm/s, so kicking the soil there throws nothing anywhere. It stands up in a slow cloud around your boots and takes the best part of a minute to come back down. Boot prints and wheel tracks stay where you put them, lie on the ground's own grain rather than over it, and press the pebbles under them into the soil.

Flight mode is the one deliberate fiction on six of these bodies — there is no lunar aircraft to model — and the one place it is not is Venus, where a wing needs a seventh of the speed it does on Earth and the Soviet VEGA balloons flew for two days without trying. It is still capped per body, as height above the ground beneath you rather than an absolute altitude, so the streamed horizon always reaches past what you can see wherever you are.

## Performance

Three quality tiers, guessed from the GPU's name the first time — Intel and other integrated graphics start on **low** — remembered after that, and cycled with `Q`. The `RENDER` line in the readout shows the frame rate, the internal resolution and the tier.

The tiers trade what costs the most on a weak GPU and leave what makes it look like the Moon: Hapke photometry, terrain shadows at every range, the eye's adaptation and the shadow a rock casts are the same on all three. What low gives up is the pixel ratio above 1, MSAA (FXAA instead), bloom, soft shadow filtering, anisotropic filtering beyond 2×, the three-way blending that hides the regolith tile's repeat, a third of the terrain's vertices beyond the nearest 400 m, two thirds of the pebbles and their shadows, and half the resolution of the terrain-shadow maps. Medium and low read Hapke from a precomputed table rather than evaluating it per pixel.

On top of the tier, the internal resolution floats: it is measured once a second and lowered until the frame rate reaches the tier's target — 26 fps on low — then raised again when there is room. It goes by the typical frame rather than the average, so the odd stall while new ground streams in does not make it hunt.

## Demo mode

`0`, or the link on the opening screen, and it plays itself: a clean background with no crosshair and no readouts.

It holds no privileges. It presses the same keys and turns the same head a player does, and everything downstream of that — traction, jump arcs, suit jets, the rover's steering, chunk streaming — runs exactly as it would under a pair of hands, so what you are watching is the simulation rather than a scripted flythrough. It works in acts: walk somewhere, stop and look at whatever is overhead, take the rover out, go up for the vista, and every few minutes move on to the next body. On the moonlets it hovers on the jets a couple of metres up instead of walking, because that is what you would do. The sun creeps the whole time, since on an airless world the shadows are the scenery.

Any key, or a click, hands the controls back.

## Files

- `index.html` — everything: generation, streaming, shaders, physics, HUD.
- `three.module.js` — vendored Three.js r160 (MIT).
- `jsm/` — vendored Three.js post-processing addons (MIT).
