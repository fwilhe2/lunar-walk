# Roadmap

Features to build, in the suggested order. Each one says why, lists its substeps, and says how to check it's done. Line numbers refer to `index.html` as of `079e0f2`.

Everything visual gets checked with the headless-Firefox probe described in `CLAUDE.md`. Everything touching `TERRAIN_SOURCE` also gets timed in Node before and after.

---

## 1. Fix coarse terrain showing through on the low tier — *bug* ✅

**Why.** On **low**, which is picked automatically for Intel and other integrated GPUs, crater floors show flat, textureless discs with hard edges. The terrain shadows there are also cut by straight lines. Probe shots showed it on Pluto and on the Moon from the air. A bisect confirmed the cause: hiding rocks didn't remove the disc, turning terrain shadows off didn't either, and turning `LOD_COARSE` off did.

**Cause.** `extOf` (line 2999) trims the 1 km ring from ext 4 to ext 3, which makes its coverage box [−3072, 4096] (lopsided around the player's cell). The 4 km chunks spanning [−4096, 0] in x or z are then only partly covered, so they get drawn. They reach right up to the player in three of the four quadrants, at a 128 m step with 6 m of sink. Wherever the real ground sits more than 6 m below that coarse surface (every crater floor bigger than about 100 m), the coarse chunk pokes through. §5b's height pass keeps the highest surface, so the terrain shadows are computed on the coarse chunk there too.

Every tier has a milder version of this, in the partial-overlap band at each level's edge (for example 4–5 km out between the 1 km and 4 km levels).

**Substeps**
- [x] ~~Stopgap: drop the trim in `extOf`.~~ Not needed: with holes the trim is harmless, so low keeps its 32 draws fewer.
- [x] Cut holes instead of sinking: give each coarse chunk (level ≥ 1) that overlaps *built* chunks of the next finer level its own index buffer. The buffer leaves out every quad whose cell lies inside a built finer chunk. Chunks with no overlap keep the shared `gridIndex(W)` buffer.
  - [x] Map grid index to cell the way the worker does: column `i` ↔ `ci = clamp(i − 1, 0, n)`. Keep the skirt quads.
  - [x] Base the hole on chunks that are **built**, not on the desired set. That is the purge discipline again: a hole must never open before the fine ground under it exists.
  - [x] Rebuild the holed indices on `version` bumps, and only for coarse chunks overlapping the finer chunk that changed. The geometry is untouched, so this costs no worker time.
  - [x] Finer chunk edges (multiples of 256, 1024 or 4096 m) are multiples of every coarser step (16–512 m), so the cut is exact. The finer chunks' skirts cover the T-junctions.
- [x] Keep `sink` as it is. It becomes harmless rather than load-bearing.
- [x] Update the §5 header comment and the chunk-streamer section of `CLAUDE.md` ("partial overlaps are sunk").

**Verify.**
- Probe on low: Pluto from 380 m up (yaw −0.95, pitch −0.6) and the Moon's flight view show no flat discs and no straight shadow edges.
- The draw count is unchanged.
- Walk and fly across 256 m and 1 km cell boundaries; no holes open while rings rebuild.

---

## 2. Commit the probe and a Node check as dev tooling ✅

**Why.** Every session rebuilds the probe from scratch, and the Node profiling that `CLAUDE.md` recommends is done by hand. Every later item on this list is verified with both.

**Substeps**
- [x] `tools/probe/server.py`: serves the repo, logs `/report?m=…`, and saves `POST /shot?n=…` data URLs as JPEGs.
- [x] `tools/probe/mkprobe.py`: builds `probe.html` by string replacement. Each anchor is asserted to match exactly once, so it fails loudly when `index.html` changes. It adds error, console and worker-error hooks, a frame hook after `composer.render()`, and starts the driver in place of `overlay.hidden = false`.
- [x] `tools/probe/lib.js`: `frames(n)`, `idle()` (loading done, `pending() === 0`, then 8 frames), and `snap(name)` (sets `uReset`, waits, posts `toDataURL`). Drivers become small files that use these.
- [x] `tools/probe/run.sh`:
  - [x] launch headless Firefox with its own profile and `user.js`;
  - [x] poll for `DONE`;
  - [x] kill only its own PID tree;
  - [x] delete `probe.html`.
- [x] Default drivers to `quality.set('low', false)` at 960×540. Measured under software GL: low runs at 1–2 fps, medium at about 0.1 fps.
- [x] `tools/check.mjs`: extract `TERRAIN_SOURCE` and, for each world:
  - [x] scan a grid for NaN or Infinity;
  - [x] check determinism across `craterCacheReset()`;
  - [x] time µs per call after warm-up against a committed baseline, and warn above +20%.
- [x] Point the "Verifying changes" section of `CLAUDE.md` at it. It is dev tooling and nothing in the app loads it.

**Verify.** A full world sweep runs with one command and leaves the working tree clean.

---

## 3. Complex craters ✅

**Why.** Every crater is a simple bowl (`cellCraters`, line 468: fresh depth 0.4 r, i.e. D/5). That includes Venus's craters up to 24 km, Pluto's and Charon's up to 18 km, and Europa's up to 4.8 km. Above each body's transition diameter, real craters have flat floors, central peaks and terraced walls, and they are shallower for their width.

**Substeps**
- [x] Add a transition diameter `Dtr` to each `WORLDS` row, with values sourced from the literature. For rocky bodies it scales roughly as 1/g; the Moon's is about 15–20 km. Icy bodies and Venus don't follow the rock scaling, so look those up rather than guessing.
- [x] In `cellCraters`, when `2r > Dtr`, derive and store on the crater object:
  - complex depth (Pike's complex-crater power laws for the Moon, scaled per body);
  - floor radius;
  - central-peak height and width;
  - terrace count.

  The cache holds them, so the per-query cost stays in the profile, not the setup.
- [x] Add a complex branch to `craterField`:
  - [x] a flat floor with low hummocky noise;
  - [x] a ridged central peak, varied per crater with `hashF` of its centre;
  - [x] walls as smoothed steps between floor and rim;
  - [x] the same rim, ejecta blanket, 1.9 r cutoff and age rounding as simple craters.
- [x] Blend simple into complex over a band around `Dtr`, so the population has no visible jump.
- [x] Keep `CR_ALB` consistent (fresh halos). (Brightening fresh peaks and walls not done.)
- [x] Check that rock clustering (§6) still looks right on terraces and peaks — moot: rocks cluster only on classes flagged `rocks`, and the kilometre classes carry none.
- [x] Update README ("simple-crater morphometry").

**Verify.**
- In Node: radial height profiles through one crater per affected world, and µs per call before and after for Venus, Europa, Pluto and Charon.
- Probe: fly to a crater picked from `cellCraters` in Node and shoot it at low sun.

---

## 4. Landmarks on the Moon ✅

**Why.** The Moon's largest crater class is 1.2 km across. From the 400 m flight ceiling you can see about 37 km, but nothing on the horizon is bigger than those craters, so the vista reads as uniform.

**Substeps**
- [x] Replace positional conventions with per-class flags, **before** inserting a class. Today three things depend on array position:
  - rays scan the first `RAY_LAYER_MAX` classes;
  - rocks cluster on classes 1–4 (line 3582);
  - Mars wind streaks use classes 0–1.

  Flags such as `rays`, `rocks` and `streak` stop a new class from silently changing which classes carry these.
- [x] Add a rare large class at the top of the Moon's table: craters 10–30 km across with complex morphology from item 3, keeping `rMax * 1.9 < cell`.
- [x] Check in Node that the landing site doesn't sit on the wall of one of these. The Moon has no site offset (unlike `PL_OX` or `CH_OX`), so nudge with an offset or pick a different seed.
- [x] Add a sinuous rille, built in lanes like `charonGraben` (one channel per lane, kept inside it):
  - [x] a meandering centreline from noise along strike;
  - [x] a U-shaped section about a kilometre wide and a few hundred metres deep, like Hadley;
  - [x] segments that start at a source depression;
  - [x] gated to mare (`1 − highlandMask`);
  - [x] craters overprint it.
- [x] Optionally, talus rocks on the rille walls — done later as `world.rilleTalus`: candidates tested on the rille term's own slope, which is zero and cheap nearly everywhere, instead of Europa's three full height queries.
- [x] Measure µs per call in Node. The Moon's hot path is the most expensive one to break.

**Verify.** A probe flight shot from the landing site shows a landmark on the horizon, and the timings stay within budget.

---

**Also found and fixed on the way:**
- The spawn fade levelled crater relief to zero, which dug a pit round the landing site wherever the site stood off zero (the new crater's ejecta; saturated Phobos had 55° walls in the fade ring). It now levels to the crater field's own value at the site.
- Every coarser terrain level was sunk under the finer one (1.5 / 6 / 20 m), and at low sun each level edge threw a line of shadow across the ground. With item 1's holes nothing overlaps, so the sinks are gone.
- The terrain-shadow march stopped at 8 km, too short for kilometre-deep craters; it reaches 16 km (the clipmaps' edge) on the large bodies now, for a few more steps.

## 5. Night, lit by the planet overhead ✅

**Why.** Earth never moves in the lunar sky, so its direction is as fixed as the sun's azimuth. A horizon march toward Earth can reuse §5b's height pass. That makes a lunar night lit by a nearly full Earth possible, with stars out. The same works for Mars from Phobos and Deimos, Jupiter from Europa, Charon from Pluto and Pluto from Charon.

**Substeps**
- [x] Let `sunElev` go below the horizon (for example down to −0.3). The sun's light fades across its angular radius as it sets, and `sunDisc` and `corona` hide below the horizon.
- [x] Add a key direction `KEY_DIR`, separate from `SUN_DIR`: `SUN_DIR` keeps driving phases and the sky; `KEY_DIR` drives the light. When the sun is down, `sun` takes the companion's direction and planetshine intensity. `sunFar` follows it (the two must cast together), and so does `placeShadowRig`.
- [x] Horizon maps: set `hzU.uDir` to the key's azimuth and force one rebuild whenever the key switches. The height pass is reused. The "fixed sun azimuth" invariant becomes "fixed azimuth per key".
- [x] The regolith normal map's alpha is a micro-horizon baked toward `SUN_AZ`. Disable it under the planet key, or bake a second one. Micro-crater rim tests and grain shadows read the key direction.
- [x] Intensity: full Earth from the Moon is about 1/4000 of sunlight (README). Scale by the companion's phase. Colour it by the companion's mean colour.
- [x] Light units: keep absolute radiances within an order of magnitude of the Moon's (see `CLAUDE.md`). At night, switch to night units, the same trick as Pluto's ×1000 row: the key at a sun-like intensity, with stars, Milky Way and companion HDR scaled up by the same factor. Give each world a night eye range.
- [x] Base the airless fill (`updateSkyColors`, currently `sin(sunElev)`) on the key.
- [x] Update the HUD (a negative sun elevation, a "NIGHT · EARTHLIT" note) and the docs (the sun-azimuth section of `CLAUDE.md`, README "The light").

**Verify.**
- Probe on the Moon at `sunElev = −0.2`: shadows point away from Earth, Earth is near full, stars are visible.
- Stepping across sunset with `[` / `]` gives no black frame and at most one shadow rebuild.
- Repeat for each companion world.

---

**As built:** the night key keeps the sun's intensity times the planet's phase, and the eye's key drops to a quarter. The first try dimmed the key to a tenth and let the eye open, and on Phobos that magnified the HDR target's dithering into green/magenta speckle. Stars get a per-world night factor rather than U, because their gain was never physical; scaled by U, the Milky Way pinned at full opacity everywhere.

## 6. Sound ✅

**Why.** There is none at all (no `AudioContext`). It can be generated in Web Audio with no asset files, and what each world sounds like follows from its physics.

**Substeps**
- [x] Create or resume the `AudioContext` on the first click (pointer lock or demo start), to satisfy autoplay policy.
- [x] Give each world a propagation medium:
  - **vacuum** (Moon, Phobos, Deimos, Europa, Pluto, Charon; ten microbars carries nothing): only sound conducted through the suit;
  - **Mars**: outside sounds are quiet and muffled, and low frequencies arrive a little before high ones (two speeds of sound, about 240 and 250 m/s, measured by Perseverance);
  - **Venus**: dense air, loud and carrying.
- [x] Add procedural sources:
  - [x] breathing, with rate and depth following exertion (the walking power cap near line 7078);
  - [x] fan and pump hum from the backpack;
  - [x] footfalls through the boots, keyed to stride phase and landing speed;
  - [x] jet hiss on the moonlets;
  - [x] rover hub-motor whine pitched by wheel speed, and suspension knocks from `st.load`;
  - [x] Quindar tones on HUD notes;
  - [x] wind on Mars and Venus.
- [x] A mute key (`M`) in the key help, remembered. Demo mode plays sound once unlocked by the click that starts it. (No volume control.)

**Verify.** The probe can't listen, so a driver logs `AnalyserNode` levels per source instead: one footfall per stride, no outside sounds in vacuum.

---

## 7. Zoom and photo mode ✅

**Why.** The camera is 72° vertical (`PerspectiveCamera(72, …)`), which is 104° across at 16:9. Charon near a corner of the frame renders about 1.3× stretched, and the sky bodies are small.

**Substeps**
- [x] Hold right mouse (or `Z`) to ease the field of view to a telephoto (around 15°). Scale look sensitivity by the FOV ratio, and ease back on release.
- [x] Audit what depends on the field of view. Zoom is capped at 15°, where distance-chosen LOD still holds; dust already sized itself by the lens (PR #4); stars stay points; the eye meters what the lens is on.
- [x] Screenshot key (`P`):
  - [x] at full resolution scale (the canvas holds no HUD, so nothing needs hiding);
  - [x] capture right after `composer.render()` in the loop (as the probe does) with `toBlob`;
  - [x] download a PNG named by world, position and sun elevation.
- [x] A clean photo mode that reuses the demo's chrome-free view.

**Verify.** Probe zoomed onto Charon from Pluto: round at the frame centre. The screenshot works in Firefox and Chromium.

---

## 8. Shareable views and a compass ✅

**Why.** Everything is deterministic, so world, position, view direction and sun elevation in a URL reproduce a view exactly. A compass helps on a surface with no edge; Apollo 14 walked to within about 20 m of Cone crater's rim without knowing it.

**Substeps**
- [x] Encode `#w=moon&x=…&z=…&yaw=…&pitch=…&sun=…&m=eva`. Update it with `history.replaceState` about once a second, or copy it to the clipboard on a key.
- [x] On boot, parse it: `applyWorld(id)`, then teleport behind the loading screen until `pending() === 0`, the way `applyWorld` does. Reset rocks, prints and dust.
- [x] Precision: chunk vertices are Float32 world coordinates, which quantise to about 8 mm at 100 km and 6 cm at 1000 km. Shared positions are clamped to ±100 km. (No floating origin.)
- [x] HUD compass:
  - [x] a heading tape, with north = −z to match the position readout;
  - [x] bearing and distance to the landmark;
  - [x] a sun-azimuth tick.

**Verify.** A link opened in a fresh probe profile renders the same frame.

---

## 9. Landers ✅

**Why.** The landing site has only a flag or a beacon. A lander, built from primitives like the rover, would be the iconic landmark and a good test object for shadows.

**Substeps**
- [x] Moon: the Apollo LM, complete (ascent stage on, since you're still here), at real dimensions:
  - descent stage about 4.2 m across;
  - four legs with footpads about 0.9 m wide, spread about 9.4 m;
  - gold and black foil, descent engine bell, forward ladder and porch;
  - about 7 m tall in all.

  Placed 24 m east of the site, under Earth in the opening view, on the levellest spot nearby (0.5° tilt).
- [x] Put each footpad on `terrainHeight()` independently, like the rover's wheels, and level the body from the pads. Merge by material (`mergeInto`) to hold draw calls down.
- [x] Materials through `surfacePatch(…, 'object')` (lifted terrain shadows), casting into both cascades.
- [x] Blast zone: a brightened halo around the site (LROC sees one at every Apollo landing). Make it a colour-only side output in the kernel's colour pass, like `CR_ALB`, which physics ignores. No pebbles inside the scoured radius.
- [x] Collision: simple cylinders for pads, legs and body in `stepEVA` and the rover.
- [x] Placement: the opening view (`world.look`) still frames the flag and the companion.
- [x] Later: Viking on Mars, Venera on Venus, a generic crewed lander elsewhere (Mercury, Io, Europa, Enceladus, Pluto, Charon). The beacon stays on the moonlets. Pads levelled by a least-squares plane, so three legs and a landing ring work as four legs do.

**Verify.** Low-sun probe shots: shadows attached at the pads, and no floating pads on slopes.

---

## 10. Mars wind ridges ✅

**Why.** The transverse aeolian ridges are a strict triangle wave (`abs(fract − 0.5) − 0.25`, in `hMars`), and from the air they read as a ploughed field. Real ones branch, vary their spacing and gather in the lows. The shot was on low, where 8 m steps also alias the 26 m wavelength.

**Substeps**
- [x] A sharp-crested profile with broad, flat troughs.
- [x] Spacing and amplitude that drift slowly, a stronger meander, and Y-junctions (blend two phase fields with slightly different wavenumbers in patches).
- [x] More of them in lows and crater floors, fewer on high flat ground.
- [x] Time it in Node. This term runs on every Mars query.

**Verify.** Probe flight shots over Mars on high and on low.

---

**As found:** the stripes in the aerial shot were mostly the transverse dunes (72 m apart, dark slip faces), not the ridges. Both now use two phase trains blended in patches for forks, extra meander octaves, and amplitude that varies along the crest. Mars costs +8% per query.

## 11. Gamepad and touch ✅

**Substeps**
- [x] An input layer: `input.move` (analog x and y), `input.look`, `input.push` (0–1), and buttons. The keyboard and the demo write into it, so the demo's "presses the same keys" keeps holding.
- [x] `stepEVA`, `stepFLY` and `stepROVER` read analog values: walking speed follows stick deflection within the Froude limits, and the rover gets analog throttle and steering.
- [x] Gamepad polling in `step()`:
  - left stick moves, right stick looks;
  - right trigger is push effort (charge follows the trigger, release pushes);
  - bumpers climb and descend in flight;
  - face buttons for `R`, `F` and world change.
- [x] Touch: two virtual sticks and buttons, without pointer lock.

**Verify.** Stub `navigator.getGamepads` in a probe driver and check the push apex against `pushSpeed()`.

---

## 12. New worlds

**Candidates**
- **Io** ✅: Jupiter about 19° across overhead, active plumes, sulphur colours.
- **Mercury** ✅: sun about 1.4° across at 6.7× the Moon's flux, hollows, lobate scarps. It could be a variant of the lunar kernel.
- **Enceladus** ✅ with Saturn and its rings.

**Recipe** (as Charon was added in `52b06c3`)
- [x] A `WORLDS` row and an `hX()` height function of a new kind, dispatched in `terrainHeight()`.
- [x] A `VIEW` row: light units, Hapke set, eye range, tone mapping, levels, companions, landmark.
- [x] Regolith texture parameters.
- [x] `WORLD_IDS`, `G_LIST` and keys: `1`–`9`, `-`, `=` along the number row.
- [x] Site placement checked in Node (skyline toward the companion).
- [x] README and `CLAUDE.md`.
- [x] For Saturn, rings as a new companion capability: a ring shader, the planet's shadow on the rings, the rings' shadow on the globe, and the lit and unlit faces of the rings.

---

**Mercury, as built:** kind 7, keys renumbered so it is `1`. Intercrater plains with smooth-plains patches and wrinkle ridges; lobate scarps in 70 km lanes, a 1.4 km face 7 km east of the site; hollows decided per cell at the cell's centre (in craters of the classes flagged `hol`, inside a province field) and cached, so a hollow is a pure function of its cell; a clumped class of close secondaries. Venus and Earth hang as two stars. About 1.2× the Moon's cost per height query, after caching the hollow cells and the scarp lane's hashes (1.4× before). The opening screen's world buttons are now a two-row grid.

**Io, as built:** kind 8, no craters. Plains with layered benches and lava flows, one patera per 56 km cell (black floor, red or white fallout halo) and one tilted-block mountain per 110 km cell, each kept inside its cell. The site near Kanehekili Fluctus has Jupiter 19.5° across over a 7 km mountain, with the three other Galileans in Io's own frame. Two plumes (a new sky object) stand over the horizon, scattering forward. Night is Jupiter-lit, the dose is 36 Sv a day, and the tone mapping is ACES for the yellow. Keys now run along the number row: `1`–`9`, then `-` (and `=` next).

**Enceladus, as built:** kind 9. Tiger stripes in 35 km lanes with funiscular ridges between, a snow mantle, ice blocks from a new `blocks` rock option, and a short level set (±14 km). The site is 5 km from Baghdad Sulcus. The jet curtain is a ribbon on the stripe's trough, built from the kernel, forward-scattering, with the moon's shadow climbing it after sunset. Saturn is 29° across with rings as a companion capability: profiled annulus, single-scattering lit and unlit faces, the planet's shadow on them, their shadow on the globe. From Enceladus they are edge-on, so the shadow band is what shows. Tethys, Dione, Rhea, Titan and Mimas move along the ring plane. The suit has jets, and there is no rover.

---

## 13. More worlds, and a realism pass over the old ones (overnight run, 2026-10-04)

**Why.** The world picker already shows a dozen solid bodies dimmed as "not yet" — Ganymede, Callisto, Iapetus, Miranda, Triton and the rest — and every one of them is somewhere a suited person could stand. Each new body is chosen for three things: a surface we actually know (spacecraft imaging at metres to hundreds of metres), a landscape that looks like nothing else in the set, and a sky worth looking up at. Realism comes first everywhere: every constant gets a source or a derivation in a comment, as the existing rows do.

**Rules for the whole run**
- One commit per working feature, straight to `main`, never pushed. Tick the box here in the same commit.
- Every new height function: `node tools/check.mjs` (no NaN, pure across cache resets, µs per call recorded in the baseline with `--save` once it is meant to cost that). Budget: no world above ~1.5× the Moon's cost per query.
- Every visual change: a probe shot from the site and from the flight ceiling on low, looked at, before committing. Nothing new in the default view may move the camera (motion sickness — see `CLAUDE.md`).
- Each new world gets its README paragraph (surface, light, sky, physics table row) and its `CLAUDE.md` paragraph in the same commit or the one right after.

### 13a. Plumbing for more than twelve worlds
- [x] Keys: `1`–`9`, `-`, `=`, `⌫` stay the first twelve in solar order; `Shift` + the same keys reach the rest. Update key help, README controls, opening-screen text (`fine:` lines say "change world" generically, not a key list that goes stale).
- [x] Picker: add an asteroid-belt "system" between Mars and Jupiter (Vesta, Ceres) so the belt bodies have a slot; check the strip still packs at 960 px and at phone width.
- [x] `G_LIST`, `WORLD_IDS`, `WORLD_KEYS`, the demo's tour and shared-link parsing pick a new world up from its rows alone — check nothing else hard-codes twelve.
- [x] `tools/probe/drivers/worlds.js` takes an optional list of ids (`PROBE_WORLDS=…`, passed as `?worlds=`) so one world can be shot without the full 25-minute sweep.

### 13b. Callisto — the place a crewed Jovian mission would actually land
Outside Jupiter's radiation belts (≈0.1 mSv/day at the surface, the Moon's order of magnitude), so NASA's HOPE study (Troutman et al. 2003) put the base here.
- [x] Kernel row (kind 11): R 2410.3 km, g 1.235 m/s². The most heavily cratered surface in the solar system, saturated at large sizes — **but depleted below ~1 km** (Moore et al. 1999): sublimation of ice from crater walls degrades small craters into **knobs**, rim remnants 50–100 m high. Dark lag deposit smoothing the lows.
- [x] `hCallisto`: crater classes from 100 m to 30 km, small ones skewed very old and shallow; complex craters past Dtr ≈ 3–4 km (Schenk 2002 transitions on icy Galileans); a knob field term (sharp, isolated hillocks on degraded rims, a pure function of the crater); a smooth dark mantle filling lows.
- [x] Colour: dark lag (albedo ~0.2) with **bright frost on crests and poleward-facing slopes** — a colour-only slope × aspect term in `surfaceTint`, like Pluto's frost line but on aspect. Fresh craters bright.
- [x] VIEW row: sun 50 W/m² (Europa's units), Jupiter 4.35° across (2·atan(71492/1882700)), fixed; Io, Europa and Ganymede all orbit inside Callisto, so **all three transit Jupiter** from here — `kepler` companions in Callisto's frame. Night: Jupiter at 0.08% of the sun. Hapke from Buratti / Domingue for Callisto. Rover yes.
- [x] Site: a plausible base site on the Valhalla ring plains (≈ 15°N), in Node: level, a knob field in view, Jupiter over the horizon.

**As built:** kind 11. Five crater classes, the two smallest at a sixteenth and a quarter of the lunar equilibrium density; complex past 3 km, central pits past ~30 km (`pitD`, a new crater option). Knobs one per 240 m cell, decided at the cell centre from a province noise and the rims of degraded craters, cached. Valhalla's outer graben in 28 km lanes concentric about a centre 775 km east. Frost on knob crests and poleward slopes (`TN_Z`, a new per-vertex input to the colour pass), dark aprons round the knobs. Site at 15°N 75°W: Jupiter 4.35° across at 14° altitude in the east, Io/Europa/Ganymede transiting. 2.1 µs per height query (Moon 2.8).

### 13c. Ganymede — grooved terrain
- [x] Kernel row (kind 12): R 2634.1 km, g 1.428 m/s². Two terrains: ancient **dark regio** (cratered, furrowed, dark lag, frost on crests) and younger **bright sulci** — swaths tens of km wide of parallel **grooves**, 3–10 km wavelength and 100–500 m relief, with finer ~1 km grooves on them, often tilt-block (asymmetric) (Pappalardo et al. 1998, 2004). Groove sets in lanes with different trends; a sulcus boundary cuts the dark terrain.
- [x] Site: at the edge of a sulcus (Uruk-Sulcus-like) facing across it, so the opening view shows grooves marching to the horizon.
- [x] Bright-ray craters (Osiris-like) as the large fresh class; polar frost not at site latitude.
- [x] Sky: Jupiter 7.64° across; Io and Europa inside (transits), Callisto outside. Ganymede has its own magnetosphere: dose ≈ 0.08 Sv/day equatorial — readout like Europa's.

**As built:** kind 12. Sulci in 110 km lanes, groove sets in 22 km patches with their own trend, tilt-block or symmetric profiles plus finer grooves; dark terrain with knobs (half Callisto's density), furrows, and the oldest crater classes (`old` flag, dropped inside sulci, decided at the crater's centre). Site on a groove crest 3 km inside a sulcus margin; Jupiter 7.64° at 34° in the east. 2.9 µs per query. From the ground the grooves are gentle — a few hundred metres over kilometres — and read best from the air or at low sun, as they should.

### 13d. Triton — geysers and cantaloupe terrain, Neptune overhead
- [x] Kernel row (kind 13): R 1353.4 km, g 0.779 m/s². Young (≲ 100 Myr), few craters. **Cantaloupe terrain**: dimples 25–35 km across bounded by ridges, crossed by long double ridges (Croft et al. 1995); site on the south polar cap boundary, smooth frost plains with dark **plume streaks** (100+ km long, all blown the same way by the wind at ~8 km altitude).
- [x] Colour: nitrogen frost, albedo ~0.75, faintly pink-cream; dark streaks a colour-only term aligned to one bearing.
- [x] Geysers: Hili/Mahilani-style plume columns rising 8 km then bending into a horizontal trail downwind for 100+ km (Soderblom et al. 1990), a sky object like Io's plumes but dark and with a shadow side.
- [x] Sky: 14 µbar N₂ with a thin haze (like Pluto's, `world.sky`), sun a point at 30 AU (1.5 W/m², Pluto-scale units), **Neptune 8.0° across**, deep blue, with banding, dark spots and bright methane clouds; it never moves. Neptune texture generator written the pure way (`OFF_THREAD`). Night lit by Neptune.
- [x] Physics table row; rover yes.

**As built:** kind 13. Site at the cap's northern edge on the cantaloupe terrain (Bubembe Regio, 15°S 60°W) rather than deep on the cap, so both terrains are in reach; two geysers on the cap 58 and 96 km out. Geysers are a new sky object: camera-facing ribbons in true metres, curved and proxied in the vertex shader, absorbing and forward-scattering. Neptune in Irwin et al.'s 2024 true colour. 1.1 µs per query.

### 13e. Ceres — Occator's bright faculae
- [x] Kernel row (kind 14): R 470 km, g 0.28 m/s². Dark (albedo 0.09) carbonaceous regolith; craters with **polygonal outlines** and few large basins (relaxed); Dtr ≈ 7–12 km (Hiesinger et al. 2016).
- [x] Site: the floor of an Occator-like 92 km crater, near **Cerealia Facula** — the brightest material on Ceres (sodium carbonate, albedo ~0.5+, De Sanctis et al. 2016), on a fractured central dome (Cerealia Tholus, ~0.7 km high) inside a central pit; floor fractures; lobate flows.
- [x] Sky: black, sun 0.19° at 177 W/m²; no companion. Horizon only ~1 km off at eye height.

**As built:** kind 14. Occator as a fixed landform with its pit, dome and faculae; polygonal crater rims (`poly`, a new crater option). Found on the way: chunk bounding spheres were centred at y = 0 with ~700 m radius, so ground kilometres below zero (Occator's floor) was frustum-culled; they are now fitted to each chunk's heights. Picker gets Vesta and Ceres as systems of their own between Mars and Jupiter. 1.75 µs per query.

### 13f. Iapetus — the two-faced moon and its ridge
- [x] Kernel row (kind 15): R 734.5 km, g 0.223 m/s². **Equatorial ridge** up to 13–20 km high and ~20 km wide (Porco et al. 2005), with the site on its flank so the ridge fills the horizon; huge landslides off crater walls (Singer et al. 2012, long runout); heavily cratered, saturated at large sizes.
- [x] Colour: the boundary of **Cassini Regio** — dark (0.03–0.05) lag on sun-facing, warmer slopes, bright (0.5–0.6) ice on poleward and shaded slopes, with a sharp, patchy transition (thermal segregation, Spencer & Denk 2010). Colour-only.
- [x] Sky: Saturn 1.94° across, **rings open** — Iapetus' orbit is inclined ~15° to Saturn's equator, so the rings show as an ellipse, not a line. Reuse the ring capability; Titan and Hyperion as moving points. Saturn moves? Iapetus is locked, so no.

**As built:** kind 15. Ridge 22 km south, ~6.5 km high at the site's longitude, massifs and saddles along it, base 40 km wide (a 13 km, 20 km-wide ridge would need 50° flanks; heights kept where slopes stay under ~37°). Lag/frost sorting by aspect and noise. Saturn's rings open 12°. Landslides not done. 2.2 µs per query.

### 13g. Miranda — Verona Rupes
- [x] Kernel row (kind 16): R 235.8 km, g 0.079 m/s² (jets, beacon). **Coronae**: concentric bands of parallel ridges and troughs (Inverness's chevron, Arden's racetrack), next to old rolling cratered terrain; **Verona Rupes**, a fault scarp 5–10 km high (Pappalardo et al. 1997) on the skyline.
- [x] Sky: **Uranus 22° across**, pale cyan and nearly featureless, rings dark and almost edge-on, at 19 AU (3.7 W/m²). Uranus texture generator (pure). Ariel/Umbriel/Titania/Oberon as moving discs.

**As built:** kind 16. Site on Inverness Corona's outer bands, a 6 km scarp 12 km NE under Uranus (22.8°); jets and beacon. Uranus and four moons; Uranian moon maps added to the small-moon generator. 1.6 µs per query.

### 13h. Vesta — Rheasilvia and the troughs (if time allows)
- [x] Kernel row: R 262.7 km, g 0.25 m/s²; Divalia Fossa troughs 10–20 km wide, km deep; Rheasilvia central mound. Bright basaltic regolith (albedo 0.4) with dark carbonaceous spots.

**As built:** kind 17. Site on the north rim of a 5 km-deep trough; Rheasilvia itself is 400 km south, below the horizon. 2.3 µs per query.

### 13i. Realism pass over the existing worlds
Each item gets a probe shot before and after.
- [x] **Zodiacal light** on the airless bodies: a cone along the ecliptic above the point where the sun set, visible once the sun is a few degrees below the horizon and the eye has opened — the glow Apollo crews sketched from orbit. Brightness scaled by 1/r² of the body's distance from the sun (invisible past Jupiter against the Milky Way, so only Mercury, Moon, Phobos, Deimos and the belt).
- [ ] **Titan**: rocks and cobbles reflected in the sea (layer 1 on rock meshes, capped by distance); capillary ripples tied to a light wind; optional methane drizzle (Tokano et al. 2006, mm drops falling slowly at ~1.6 m/s) as a sparse screen-space streak layer, off by default if it moves in the view.
- [x] **Mars**: dust-devil tracks — dark sinuous streaks where devils lifted the bright dust (Spirit, HiRISE), colour-only in the kernel's colour pass; a distant dust devil or two on the horizon (Spirit's Gusev movies), as a sky-object column. *(Tracks done, colour-only, `devilTracks`; the devils themselves not yet.)*
- [ ] Venus: the cracked-plate texture reads as a repeating pattern near the eye — check scale against Venera 13/14 slab sizes (decimetre-scale plates) and break up the tiling.
- [ ] Go through each world's site and flight shots for anything wrong (floating objects, seams, banding, colour errors) and fix what's found.

### 13j. Docs
- [ ] README: world count, table rows, controls, a paragraph per new body; `CLAUDE.md`: a paragraph per new kernel kind, and correct the stale "~5,600 lines".
