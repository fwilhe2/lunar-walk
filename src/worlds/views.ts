import { L2, L3, L4, LE } from './levels';

export const VIEW = {
  moon: {
    name: 'MOON', site: 'Mare Tranquillitatis', gTxt: '1.62 m/s²',
    title: 'Lunar Walk', sub: 'Mare Tranquillitatis · 0.166 g · surface unbounded',
    fine: 'Sunlight is unfiltered — shadows are black, and the sky stays black at noon.<br>' +
          'Walk in any direction for as long as you like: the surface never ends.<br>' +
          '<b>R</b> drives the rover. <b>F</b> flies. Turn around — Earth does not rise or set.',
    air: false, stars: 1,
    sunColor: 0xfff8f2, sunPower: 3.4, sunSize: 56, sunHDR: [60, 57, 52],
    corona: 2600, coronaColor: [1.6, 1.55, 1.45],
    // Fill at a 16° sun; it scales with how much ground is lit.
    hemi: [0x272624, 0x5f5a55, 1.0], amb: [0x000000, 0],
    fog: null, sky: null,
    // Mare soil is not neutral: its reflectance climbs steadily toward
    // the red, which reads as a faint brown-grey in sunlight.
    grey: 96, mapTint: [1.03, 1.0, 0.955], pits: 110, grain: 1, pebbles: 170,
    // Hapke parameters for lunar soil, after Sato et al. (2014) from
    // LROC: dark grains, strongly backscattering, a shadow-hiding
    // surge over the first few degrees and a narrow coherent one
    // inside the first half-degree, and ~22° of roughness.
    hapke: { w: 0.25, b: 0.23, c: 0.70, B0: 1.4, h: 0.07, theta: 22, Bc0: 0.4, hc: 0.006 },
    micro: [1, 0.45], sparkle: 1.0,
    levels: L4, fly: 400, rover: true,
    // Grip, boot sole on the ground: the ceiling on every horizontal
    // force your legs can make. Regolith is about 0.65. Ice is slippery
    // at home only because it is near melting and wears a film of
    // water; at −170 °C and colder there is none, and it grips about
    // as well as a dry rock floor, a little under soil.
    mu: 0.65,
    dustColor: 0x6e6a64, dustDrag: 0, stampColor: 0x55514c, soil: 0x5a5550,
    // Basalt blocks weather more slowly than soil: 0.12–0.22 against ~0.10.
    rockTint: [1.03, 1.0, 0.95], rockAlb: [0.11, 0.08], rockN: 1,
    landmark: 'flag', flagColor: 0xc9ccd2,
    rilleTalus: 900,
    // Eye adaptation: [key, min, max]. The key puts sunlit mare at a
    // photographic mid-grey; the ceiling is how far the eye opens in
    // the dark, which is just far enough for the brightest stars.
    exposure: 1.0, eye: [0.16, 0.5, 150], starGain: 0.0012, bloom: [0.55, 0.65, 3.0],
    companions: ['earth'],
    // Night: full Earth, 1/4000 of the sun, 1.9° across and faintly blue.
    night: { ratio: 2.5e-4, radius: 0.0166, color: 0xdfe7ff, label: 'EARTHLIT', stars: 120 },
  },

  mars: {
    name: 'MARS', site: 'Amazonis Planitia', gTxt: '3.72 m/s²',
    title: 'Mars Walk', sub: 'Amazonis Planitia · 0.379 g · surface unbounded',
    fine: 'Six millibars of CO₂ is enough to hold dust, and dust is what you see.<br>' +
          'The sky is butterscotch, the shadows are filled, and the halo around<br>' +
          'the sun is blue — forward-scattered by the same dust. <b>Esc</b> picks another world.',
    air: true, stars: 0,
    // Dust reddens the beam on the way down and steals about half of it.
    sunColor: 0xffd9b0, sunPower: 1.85, sunSize: 37, sunHDR: [7.2, 5.4, 3.6],
    corona: 5200, coronaColor: [0.72, 0.78, 1.0],
    hemi: [0xd08a4e, 0x54321f, 1.25], amb: [0x7a4c30, 0.42],
    // Visibility on a clear sol is a couple of tens of kilometres,
    // and what fades the distance is the same suspended dust that
    // colours the sky — so the fog takes the sky's own colour, and
    // both dim together as the sun goes down.
    fog: { density: 9e-5 },
    // Linear radiances, not sRGB swatches — the composer renders HDR
    // and tone maps at the very end. Calibrated against the sunlit
    // ground beneath it: near the horizon the Martian sky is roughly
    // as bright as the ground, which is the thing photographs of it
    // get across and descriptions of it never do. Still dark enough
    // that a 7%-albedo moon reads as a bright dot against it. tau is
    // the dust's vertical optical depth on a clear sol, which dims
    // Phobos and Deimos on the way down.
    sky: { zenith: [0.095, 0.055, 0.034], horizon: [0.34, 0.20, 0.115],
           aureole: [0.30, 0.335, 0.44], k: 62, tau: 0.5 },
    grey: 150, mapTint: [1.0, 0.93, 0.86], pits: 70, grain: 0.7, ripple: 0.16,
    pebbles: 600, clods: 0.8,
    // Brighter, less porous soil: skylight fills the gaps between
    // grains, so the opposition surge is weak and the phase curve flat.
    hapke: { w: 0.55, b: 0.25, c: 0.35, B0: 0.6, h: 0.10, theta: 16, Bc0: 0.1, hc: 0.01 },
    micro: [0.25, 0.4], sparkle: 0,
    // A few dust devils walking across the plain with the wind.
    devils: 3,
    levels: L4, fly: 400, rover: true,
    mu: 0.65,
    // Pressing pushes the bright oxidised dust film aside: the tracks
    // of Spirit, Opportunity and Curiosity run a quarter or so darker
    // than the ground beside them, and a little less red.
    dustColor: 0xc08a5e, dustDrag: 0.55, stampColor: 0x8f6c52, soil: 0xa07c61,
    // Dark basalt under a film of the bright dust.
    rockTint: [1.0, 0.86, 0.74], rockAlb: [0.12, 0.13], rockN: 0.85,
    landmark: 'flag', flagColor: 0xd8dce2,
    lander: 'viking',
    // ACES here, not AgX: a sky that is itself coloured needs the
    // saturation AgX gives away in the highlights.
    exposure: 1.0, eye: [0.13, 0.3, 4], tone: 'aces', bloom: [0.42, 0.7, 3.0],
    companions: ['phobos', 'deimos'],
  },

  phobos: {
    name: 'PHOBOS', site: 'near Stickney', gTxt: '0.0057 m/s²',
    title: 'Phobos Walk', sub: 'near Stickney · 0.00058 g · surface unbounded',
    fine: 'Gravity is six thousandths of Earth\'s: a full push would be a launch,<br>' +
          'so you push gently and drift, and steer on the jets. Mars fills 42° of<br>' +
          'the sky and never moves. <b>Esc</b> picks another world.',
    air: false, stars: 1,
    sunColor: 0xfff4e8, sunPower: 1.55, sunSize: 37, sunHDR: [30, 28.5, 26],
    corona: 2000, coronaColor: [1.3, 1.26, 1.18],
    // Marsshine: a 42°-wide disc of reflected sunlight overhead,
    // about 2% of the direct beam. Not much, but it is the only
    // thing in a Phobos shadow, and it is rust-coloured.
    hemi: [0x3a1c0e, 0x140a06, 0.55], amb: [0x2a1409, 0.16],
    fog: null, sky: null,
    grey: 120, mapTint: [1.0, 0.965, 0.93], pits: 420, grain: 1.25, pebbles: 260,
    // The darkest, most porous regolith measured anywhere: the
    // strongest opposition surge in the set.
    hapke: { w: 0.08, b: 0.25, c: 0.60, B0: 1.8, h: 0.055, theta: 24, Bc0: 0.5, hc: 0.005 },
    micro: [1.1, 0.9], sparkle: 0.6,
    levels: L2, fly: 150, rover: false,
    mu: 0.6,
    dustColor: 0x4e4a45, dustDrag: 0, stampColor: 0x2e2a26, soil: 0x403c38,
    rockTint: [1.03, 0.99, 0.93], rockAlb: [0.055, 0.04], rockN: 1.35,
    landmark: 'beacon', flagColor: 0xb9bcc2,
    exposure: 1.0, eye: [0.13, 0.5, 150], starGain: 0.0012, bloom: [0.5, 0.65, 3.0],
    companions: ['mars-big', 'deimos-far'],
    // Night: Mars, 42° across, geometric albedo 0.17 — 2.2% of the sun.
    night: { ratio: 0.022, radius: 0.367, color: 0xffb483, label: 'MARSLIT', stars: 200 },
    jets: true,
  },

  deimos: {
    name: 'DEIMOS', site: 'Voltaire rim', gTxt: '0.0030 m/s²',
    title: 'Deimos Walk', sub: 'Voltaire rim · 0.0003 g · surface unbounded',
    fine: 'Smoother than Phobos: metres of regolith drape every crater, and there<br>' +
          'are no grooves. Escape velocity is 5.6 m/s — do not throw anything<br>' +
          'you want back. <b>Esc</b> picks another world.',
    air: false, stars: 1,
    sunColor: 0xfff4e8, sunPower: 1.55, sunSize: 37, sunHDR: [30, 28.5, 26],
    corona: 2000, coronaColor: [1.3, 1.26, 1.18],
    // Seven times further out than Phobos, so seven times less
    // marsshine — the shadows here are nearly as black as the Moon's.
    hemi: [0x1c0e07, 0x0a0604, 0.22], amb: [0x140c08, 0.08],
    fog: null, sky: null,
    grey: 120, mapTint: [1.0, 0.97, 0.94], pits: 260, grain: 0.85, pebbles: 160,
    hapke: { w: 0.08, b: 0.25, c: 0.60, B0: 1.7, h: 0.06, theta: 20, Bc0: 0.5, hc: 0.005 },
    micro: [0.7, 0.8], sparkle: 0.6,
    levels: L2, fly: 120, rover: false,
    mu: 0.6,
    dustColor: 0x4e4a45, dustDrag: 0, stampColor: 0x2e2a26, soil: 0x403c38,
    rockTint: [1.03, 0.99, 0.93], rockAlb: [0.055, 0.04], rockN: 0.6,
    landmark: 'beacon', flagColor: 0xb9bcc2,
    exposure: 1.0, eye: [0.13, 0.5, 150], starGain: 0.0012, bloom: [0.5, 0.65, 3.0],
    companions: ['mars-mid', 'phobos-far'],
    night: { ratio: 0.0036, radius: 0.145, color: 0xffb483, label: 'MARSLIT', stars: 250 },
    jets: true,
  },

  /* Venus is the only body in the set where the sky is the light
     source. Twenty kilometres of sulphuric acid cloud and 92 bar of
     CO₂ between you and the sun leave about 17 W/m² on the ground —
     one part in eighty of what the Moon gets, and every photon of
     it arrives scattered. So: no sun disc, no shadows worth the
     name, no opposition surge, no stars, nothing overhead at all.
     Venera 9 photographed a landscape lit like an overcast
     afternoon, and was surprised by how much it could see.

     The colour is all in the air. Rayleigh scattering over that
     column is optically deep in the blue — tens of optical depths —
     and thin in the red, so what survives to the surface is orange,
     and the ground under it is ordinary grey basalt.

     Sky brightness is inverted from every other body here: the
     zenith is the bright part, because that is the short way out,
     and the horizon is dark, because that way the column never
     ends. On Mars and Earth it is the other way round.            */
  venus: {
    name: 'VENUS', site: 'Ovda Regio', gTxt: '8.87 m/s²',
    title: 'Venus Walk', sub: 'Ovda Regio · 0.904 g · surface unbounded',
    fine: 'Ninety-two bar of CO₂ at 464 °C, which is a fluid, not air: you wade.<br>' +
          'There is no sun in the sky and no shadow on the ground, and the horizon<br>' +
          'bends <b>upward</b> — the air refracts harder than the planet curves.',
    air: true, stars: 0, noSun: true, shadows: false, skyLit: true,
    // The directional term stands for the last trace of solar
    // direction left after 30 optical depths. It is nearly flat
    // light: the hemisphere fill is what shapes the ground.
    sunColor: 0xffb070, sunPower: 0.42, sunSize: 37, sunHDR: [1, 1, 1],
    corona: 1, coronaColor: [1, 1, 1],
    hemi: [0xff9a4e, 0x431806, 2.1], amb: [0xc8662a, 0.55],
    // Horizontal visibility of a few kilometres, which is what the
    // Venera panoramas show and what a Rayleigh optical depth of
    // ~15 over a 15.9 km scale height gives you near the ground.
    fog: { density: 2.2e-4 },
    sky: { zenith: [0.34, 0.135, 0.040], horizon: [0.115, 0.038, 0.012],
           aureole: [0.44, 0.185, 0.055], k: 1.2, amt: 0.30 },
    // No micrometeorites to pit the rock and no sand to ripple it:
    // the last centimetres of Venus are basalt slabs, cracked into
    // plates and vesicular from the gas that came out of the lava.
    grey: 104, mapTint: [1.0, 0.985, 0.96], pits: 190, grain: 0.8, plate: 0.55,
    pebbles: 140, clods: 0.5,
    // Light that arrives from the whole sky at once has no opposition
    // to surge toward; what is left is a plain Lommel–Seeliger basalt.
    hapke: { w: 0.45, b: 0.12, c: 0.10, B0: 0, h: 0.10, theta: 12, Bc0: 0, hc: 0.01 },
    micro: [0, 0], sparkle: 0,
    levels: L3, fly: 400, rover: true, roverTop: 1.7, roverDrag: 0.34,
    mu: 0.7,
    // Wading: you push 65 kg/m³ out of the way to move through it,
    // and it pushes back on the square of your speed — against legs
    // that give a few hundred watts, which is what sets your pace.
    drag: 0.095, buoy: 0.07,
    dustColor: 0x5a5652, dustDrag: 44, dustLife: 3.2, stampColor: 0x33231a, soil: 0x5a5550,
    rockTint: [1.0, 0.97, 0.93], rockAlb: [0.08, 0.07],
    rockN: 0.8, rockFlat: 0.42,
    landmark: 'flag', flagColor: 0xcfc6b4,
    lander: 'venera',
    exposure: 1.0, eye: [0.16, 0.3, 6], tone: 'aces', bloom: [0.2, 0.75, 3.0],
    companions: [],
  },

  /* Europa is five times further from the sun than the Moon: 50 W/m²,
     one part in twenty-seven, from a disc a tenth of a degree across.
     That is still an overcast day's worth of light, and it falls on
     ice ten times as reflective as lunar soil, so the eye stops down
     and this is the brightest ground in the set to stand on.

     The same reflectivity changes the shadows. With no air there is
     no sky to light them, so they are lit by the sunlit ice around
     them, and ice returns two-thirds of what it gets: a shadow here
     sits at a sixth of the lit ground, where a lunar one sits at a
     fiftieth. And it is lit by ice, not by sky, so it is the colour
     of the ice — Earth's snow shadows are blue, and these are not.
     Jupitershine adds under 1%, which is nothing next to that.

     Tara Regio is chaos on the leading hemisphere, 75° west of the
     point under Jupiter, which puts Jupiter 15° above the eastern
     horizon. See the jupiter companion for why it looks the way it
     does from here. */
  europa: {
    name: 'EUROPA', site: 'Tara Regio', gTxt: '1.31 m/s²',
    title: 'Europa Walk', sub: 'Tara Regio · 0.134 g · surface unbounded',
    fine: 'Ice at −170 °C, hard as rock, under a sun a twenty-seventh as bright.<br>' +
          'Jupiter hangs 12° wide over the chaos to the east, bands on end, and never<br>' +
          'moves. The dose out here is about 5 Sv a day. <b>Esc</b> picks another world.',
    air: false, stars: 1,
    // Light here is kept in units ten times the Moon's — a sun of
    // 1.26 rather than 0.126 — and the stars and the eye's range are
    // scaled to match, so every ratio is the physical one. In the
    // Moon's units the ground's radiance is small enough that the
    // eye's exposure amplifies the output dither into coloured noise.
    sunColor: 0xfff8f2, sunPower: 1.26, sunSize: 10.7, sunHDR: [60, 57, 52],
    corona: 2000, coronaColor: [0.68, 0.66, 0.62],
    // Bounce off the ice, a third of the Moon's in absolute terms: a
    // twenty-seventh of the sun, off ground seven times as bright,
    // bounced again off the ground it lands on.
    hemi: [0x181715, 0x37383a, 10.0], amb: [0x000000, 0],
    fog: null, sky: null,
    grey: 214, mapTint: [0.985, 1.0, 1.02], pits: 18, grain: 0.55, clods: 0.5, pebbles: 110,
    // Europa's photometry (Domingue et al. 1991): bright grains, w =
    // 0.96, backscattering, and an opposition surge a fraction of a
    // degree wide — much narrower than the Moon's, as fine frost
    // gives. Multiple scattering in ice this bright fills in what
    // roughness would shade, so theta is small.
    hapke: { w: 0.96, b: 0.35, c: 0.80, B0: 0.5, h: 0.002, theta: 10, Bc0: 0.25, hc: 0.004 },
    // Grain shadows are filled from inside by the same scattering, so
    // they are half as deep (the third term) as on dark regolith.
    micro: [0.25, 0.22, 0.3], sparkle: 3.0,
    levels: L4, fly: 400, rover: true,
    mu: 0.5,
    dustColor: 0xd3d6db, dustDrag: 0, stampColor: 0xc4cad2, soil: 0xd6d8dc,
    // Blocks of ice, cleaner than the frost around them; few of them
    // come from craters, most are talus shed off steep faces.
    rockTint: [0.97, 0.99, 1.03], rockAlb: [0.50, 0.25], rockN: 0.35, talus: 700,
    landmark: 'flag', flagColor: 0xc9ccd2,
    lander: 'generic',
    // The key sits higher than on the dark bodies: an eye anchors
    // white on the brightest surface in view, and ice this reflective
    // should read as white, not as the mid-grey the Moon's mare does.
    exposure: 1.0, eye: [0.40, 0.05, 15], starGain: 0.012, bloom: [0.5, 0.65, 3.0],
    companions: ['jupiter', 'io', 'ganymede', 'callisto'],
    // Night: Jupiter, 12.2° across at albedo 0.52 — 0.6% of the sun.
    night: { ratio: 0.0059, radius: 0.106, color: 0xfff0dc, label: 'JUPITERLIT', stars: 20 },
    // Earth is never more than 12° from the sun from here, so that is
    // where the rover's dish looks, not at Jupiter: relay is how far
    // along the sky from the sun it points.
    relay: 0.14,
    // Surface dose from Jupiter's trapped electrons and ions: the
    // commonly quoted 5.4 Sv a day, against 1.4 mSv on the Moon (Chang'e
    // 4) and 0.64 on Mars (Curiosity). Four to five sieverts at once
    // kills half the people who receive it. The leading hemisphere,
    // where this is, is spared some of the electrons that the
    // trailing one takes, so here it is if anything an overestimate.
    dose: 5.4,
  },
  /* Vesta is 2.36 AU out: 244 W/m², under a fifth of the Moon's, from a
     sun 0.22° across. Kept in the Moon's own units: the ground is basalt
     four times as reflective as lunar mare, so its radiance comes out
     close to the Moon's. Black sky, nothing overhead. The horizon is
     under a kilometre off at eye height, which is why the trough in
     front of you, five kilometres deep, opens right at your feet. */
  vesta: {
    name: 'VESTA', site: 'Divalia Fossa', gTxt: '0.25 m/s²',
    title: 'Vesta Walk', sub: 'Divalia Fossa · 0.025 g · surface unbounded',
    fine: 'The edge of a trough 20 km wide and 5 km deep, one of the set that rings Vesta\'s<br>' +
          'equator — cracks from the impact that dug a basin 500 km across at its south pole.<br>' +
          'A full push keeps you aloft fourteen seconds. <b>Esc</b> picks another world.',
    air: false, stars: 1,
    sunColor: 0xfff8f2, sunPower: 0.61, sunSize: 23.7, sunHDR: [60, 57, 52],
    corona: 2600, coronaColor: [0.75, 0.73, 0.69],
    hemi: [0x272624, 0x605d58, 0.9], amb: [0x000000, 0],
    fog: null, sky: null,
    grey: 170, mapTint: [1.03, 1.0, 0.95], pits: 80, grain: 0.95, pebbles: 150,
    // Vesta's photometry from Dawn (Li et al. 2013): brighter grains than
    // the Moon's, a modest surge, rough.
    hapke: { w: 0.51, b: 0.24, c: 0.55, B0: 1.0, h: 0.05, theta: 18, Bc0: 0.3, hc: 0.006 },
    micro: [0.8, 0.45, 0.6], sparkle: 0.8,
    levels: L4, fly: 400, rover: true,
    mu: 0.65,
    dustColor: 0x8e877e, dustDrag: 0, stampColor: 0x77716a, soil: 0x8a837a,
    rockTint: [1.04, 1.0, 0.94], rockAlb: [0.36, 0.15], rockN: 0.9,
    landmark: 'flag', flagColor: 0xc9ccd2,
    lander: 'generic',
    exposure: 1.0, eye: [0.24, 0.5, 150], starGain: 0.0012, bloom: [0.55, 0.65, 3.0],
    companions: [],
    relay: 0.4,
    look: [Math.PI, -0.18],
  },

  /* Ceres is 2.77 AU out: 177 W/m², an eighth of the Moon's, from a sun
     0.19° across. Light is kept in Europa's units, ten times the Moon's,
     so the numbers sit near the Moon's (a sun of 4.5 rather than 3.4).
     The ground is as dark as lunar mare, so everything else is the
     Moon's: black sky, black shadows filled only from the ground round
     them. Nothing hangs overhead; the horizon is a kilometre off at eye
     height, and Occator's rim stands round it, forty kilometres away,
     its foot already below the curve. */
  ceres: {
    name: 'CERES', site: 'Occator', gTxt: '0.28 m/s²',
    title: 'Ceres Walk', sub: 'Occator crater · 0.029 g · surface unbounded',
    fine: 'The floor of Occator, 92 km across. Ahead, in the central pit, the brightest ground<br>' +
          'on Ceres: salt left where brine from deep below boiled away into vacuum.<br>' +
          'A full push keeps you aloft twelve seconds. <b>Esc</b> picks another world.',
    air: false, stars: 1,
    sunColor: 0xfff8f2, sunPower: 4.46, sunSize: 20.3, sunHDR: [60, 57, 52],
    corona: 2600, coronaColor: [1.9, 1.85, 1.75],
    hemi: [0x272624, 0x5f5a55, 1.3], amb: [0x000000, 0],
    fog: null, sky: null,
    grey: 96, mapTint: [1.0, 0.995, 0.98], pits: 90, grain: 0.95, pebbles: 150,
    // Ceres's photometry (Li et al. 2016; Ciarniello et al. 2017): dark,
    // strongly backscattering grains with a broad surge, lunar roughness.
    hapke: { w: 0.14, b: 0.37, c: 0.70, B0: 1.6, h: 0.06, theta: 22, Bc0: 0.4, hc: 0.006 },
    micro: [1, 0.45], sparkle: 0.6,
    levels: L4, fly: 400, rover: true,
    mu: 0.6,
    dustColor: 0x5f5d5a, dustDrag: 0, stampColor: 0x4c4a47, soil: 0x585653,
    rockTint: [1.0, 1.0, 0.99], rockAlb: [0.11, 0.07], rockN: 0.8,
    landmark: 'flag', flagColor: 0xc9ccd2,
    lander: 'generic',
    exposure: 1.0, eye: [0.16, 0.05, 15], starGain: 0.012, bloom: [0.55, 0.65, 3.0],
    companions: [],
    // Earth is never more than 21° from the sun from here.
    relay: 0.3,
    look: [-1.23, -0.2],
  },

  /* Ganymede has Europa's sun in Europa's units, on ground between
     Callisto's and Europa's: dark terrain about 0.3, bright grooved
     terrain about 0.5. Jupiter is 7.6° across, fifteen full Moons, 34°
     over the eastern horizon from the site (15°S, 55° west of the point
     beneath it), above the sulcus. Io and Europa orbit inside Ganymede
     and cross Jupiter's face; Callisto, outside, goes behind it.

     Ganymede is the only moon with a magnetic field of its own, and
     the field shelters its low latitudes: the commonly quoted surface
     dose, 0.08 Sv a day, is for the poles, where Jupiter's particles
     come down the open field lines; here it is an upper bound. */
  ganymede: {
    name: 'GANYMEDE', site: 'Nicholson Regio', gTxt: '1.43 m/s²',
    title: 'Ganymede Walk', sub: 'Nicholson Regio · 0.146 g · surface unbounded',
    fine: 'The largest moon in the solar system: old dark crust, torn open in bands of bright<br>' +
          'grooved ice that run to the horizon. Jupiter hangs 8° wide over the grooves to the<br>' +
          'east, and never moves. <b>Esc</b> picks another world.',
    air: false, stars: 1,
    sunColor: 0xfff8f2, sunPower: 1.26, sunSize: 10.7, sunHDR: [60, 57, 52],
    corona: 2000, coronaColor: [0.68, 0.66, 0.62],
    hemi: [0x181716, 0x45464a, 4.0], amb: [0x000000, 0],
    fog: null, sky: null,
    grey: 150, mapTint: [1.02, 1.0, 0.97], pits: 26, grain: 0.65, clods: 0.55, pebbles: 70,
    // Ganymede's photometry (Domingue & Verbiscer 1997): brighter grains
    // than Callisto's, a narrower surge, and nearly as rough.
    hapke: { w: 0.70, b: 0.30, c: 0.65, B0: 0.7, h: 0.03, theta: 28, Bc0: 0.3, hc: 0.005 },
    micro: [0.45, 0.35, 0.45], sparkle: 1.8,
    levels: L4, fly: 400, rover: true,
    mu: 0.55,
    dustColor: 0x7a7672, dustDrag: 0, stampColor: 0x625e5a, soil: 0x77736e,
    rockTint: [1.0, 1.0, 1.0], rockAlb: [0.35, 0.18], rockN: 0.5,
    landmark: 'flag', flagColor: 0xc9ccd2,
    lander: 'generic',
    exposure: 1.0, eye: [0.30, 0.05, 15], starGain: 0.005, bloom: [0.5, 0.65, 3.0],
    companions: ['jupiter-gan', 'io-gan', 'europa-gan', 'callisto-gan'],
    // Night: Jupiter, 7.64° across at albedo 0.52 — 0.23% of the sun.
    night: { ratio: 0.0023, radius: 0.0667, color: 0xfff0dc, label: 'JUPITERLIT', stars: 30 },
    relay: 0.14,
    dose: 0.08,
    look: [-1.392, 0.3],
  },

  /* Callisto is at Jupiter's distance from the sun, so the light is
     Europa's and in Europa's units, ten times the Moon's. It falls on
     ground a third as reflective as Europa's ice — a dark lag, about
     0.2, frosted bright on knobs and poleward slopes — so the shadows
     fill less, and the eye opens wider.

     This is where a crewed mission to Jupiter would land: Callisto
     orbits outside the radiation belts that make Io and Europa lethal,
     and its surface dose is about what the Moon's is, from cosmic rays
     (NASA's HOPE study, Troutman et al. 2003). Jupiter is 4.4° across,
     eight full Moons, 14° over the eastern horizon from the site
     (15°N, 75°W, on Valhalla's outer rings), and never moves. Io,
     Europa and Ganymede all orbit inside Callisto, so all three cross
     Jupiter's face from here, and go behind it. */
  callisto: {
    name: 'CALLISTO', site: 'Valhalla', gTxt: '1.24 m/s²',
    title: 'Callisto Walk', sub: 'Valhalla · 0.126 g · surface unbounded',
    fine: 'The oldest surface in the solar system: craters on craters, worn down by the sun<br>' +
          'until only knobs of frost are left of their rims. Jupiter hangs 4° wide over<br>' +
          'Valhalla\'s rings to the east, its moons crossing it. <b>Esc</b> picks another world.',
    air: false, stars: 1,
    sunColor: 0xfff8f2, sunPower: 1.26, sunSize: 10.7, sunHDR: [60, 57, 52],
    corona: 2000, coronaColor: [0.68, 0.66, 0.62],
    // Bounce off ground twice the Moon's reflectance, in these units.
    hemi: [0x181716, 0x4a4642, 1.6], amb: [0x000000, 0],
    fog: null, sky: null,
    grey: 150, mapTint: [1.03, 1.0, 0.95], pits: 30, grain: 0.7, clods: 0.6, pebbles: 60,
    // Callisto's photometry (Domingue & Verbiscer 1997): dark,
    // backscattering grains, a broad surge, and rougher than any other
    // Galilean surface — the lag between the frost is a rubble.
    hapke: { w: 0.42, b: 0.30, c: 0.60, B0: 1.0, h: 0.05, theta: 30, Bc0: 0.35, hc: 0.006 },
    micro: [0.6, 0.4, 0.55], sparkle: 1.2,
    levels: L4, fly: 400, rover: true,
    mu: 0.55,
    dustColor: 0x5e5650, dustDrag: 0, stampColor: 0x4a4440, soil: 0x5a524c,
    // Few blocks survive: the same sublimation that turns rims to knobs
    // crumbles the ice-cemented blocks around young craters.
    rockTint: [1.05, 1.0, 0.94], rockAlb: [0.22, 0.12], rockN: 0.5,
    landmark: 'flag', flagColor: 0xc9ccd2,
    lander: 'generic',
    // Stars dimmer than Europa's: the gain was never physical, and with
    // the eye open this much wider for the dark ground they would show
    // by day, which on an airless world they only do out at Pluto.
    exposure: 1.0, eye: [0.24, 0.05, 15], starGain: 0.004, bloom: [0.5, 0.65, 3.0],
    companions: ['jupiter-cal', 'io-cal', 'europa-cal', 'ganymede-cal'],
    // Night: Jupiter, 4.35° across at albedo 0.52 — 0.075% of the sun.
    night: { ratio: 7.5e-4, radius: 0.0380, color: 0xfff0dc, label: 'JUPITERLIT', stars: 40 },
    relay: 0.14,
    look: [-1.64, 0.12],
  },

  /* Mimas has Enceladus's sun in Enceladus's units, on ice nearly as
     bright. Saturn is 186,000 km off, three of its own radii: 38°
     across, seventy-six full Moons, 50° up in the east from the site
     (5°N, 40° west of the point beneath it), and fixed. The rings are
     a line through it — Mimas orbits 1.6° out of their plane at most —
     and their shadow a band across it; Mimas itself clears a gap in
     them, the Cassini Division, by resonance. Night under Saturn is 5%
     of the sun, the brightest planetshine anywhere here. The gravity is
     a hundred-and-fiftieth of Earth's: jets and the beacon. */
  mimas: {
    name: 'MIMAS', site: 'Saturn-facing hemisphere', gTxt: '0.064 m/s²',
    title: 'Mimas Walk', sub: 'Saturn-facing hemisphere · 0.007 g · surface unbounded',
    fine: 'Craters on craters on a moon barely big enough to be round. Saturn fills 38° of the<br>' +
          'sky in the east, its rings a line through it, and never moves. A push would keep you<br>' +
          'up for a minute: use the jets. <b>Esc</b> picks another world.',
    air: false, stars: 1,
    sunColor: 0xfff8f2, sunPower: 0.378, sunSize: 5.9, sunHDR: [60, 57, 52],
    corona: 1600, coronaColor: [0.68, 0.66, 0.62],
    hemi: [0x1a1b1e, 0x3e4044, 12.0], amb: [0x000000, 0],
    fog: null, sky: null,
    grey: 222, mapTint: [0.99, 1.0, 1.015], pits: 40, grain: 0.6, clods: 0.45, pebbles: 60,
    // Mimas's photometry (Verbiscer & Veverka 1992): very bright grains,
    // backscattering, rougher than Enceladus.
    hapke: { w: 0.94, b: 0.30, c: 0.45, B0: 0.8, h: 0.006, theta: 25, Bc0: 0.4, hc: 0.003 },
    micro: [0.25, 0.22, 0.3], sparkle: 2.5,
    levels: LE, fly: 400, rover: false, jets: true,
    mu: 0.5,
    dustColor: 0xdfe2e6, dustDrag: 0, stampColor: 0xcdd2d8, soil: 0xe0e3e7,
    rockTint: [0.98, 0.99, 1.02], rockAlb: [0.6, 0.2], rockN: 0.4,
    landmark: 'beacon', flagColor: 0xb9bcc2,
    lander: 'generic',
    exposure: 1.0, eye: [0.40, 0.05, 15], starGain: 0.012, bloom: [0.5, 0.65, 3.0],
    companions: ['saturn-mim', 'enceladus-mim', 'tethys-mim', 'dione-mim', 'rhea-mim', 'titan-mim'],
    // Night: Saturn, 38° across at albedo 0.47 — 5% of the sun.
    night: { ratio: 0.050, radius: 0.331, color: 0xfff0d8, label: 'SATURNLIT', stars: 8 },
    relay: 0.1,
    look: [-1.674, 0.66],
  },

  /* Dione has Enceladus's sun, in the same units, on a trailing face
     darkened to about half of Dione's leading-side ice, and cut by
     cliffs of clean ice twice as bright. Saturn is 377,000 km off, 18.4°
     across, 33° up in the south-west from the site (40°N, 45° east of
     the point beneath it), and never moves; at this hour the sun is
     not far from it, so it shows a thick crescent with its rings a
     line across it. Mimas, Enceladus and Tethys pass in front of it; Rhea
     and Titan go round outside. */
  dione: {
    name: 'DIONE', site: 'Padua Chasmata', gTxt: '0.23 m/s²',
    title: 'Dione Walk', sub: 'Padua Chasmata · 0.024 g · surface unbounded',
    fine: 'The wisps Voyager saw on Dione\'s trailing face are cliffs: fresh ice walls hundreds<br>' +
          'of metres high along graben. One drops away in front of you, under Saturn, 18° wide.<br>' +
          '<b>Esc</b> picks another world.',
    air: false, stars: 1,
    sunColor: 0xfff8f2, sunPower: 0.378, sunSize: 5.9, sunHDR: [60, 57, 52],
    corona: 1600, coronaColor: [0.68, 0.66, 0.62],
    hemi: [0x1a1b1e, 0x3e4044, 6.0], amb: [0x000000, 0],
    fog: null, sky: null,
    grey: 210, mapTint: [1.0, 0.995, 0.985], pits: 30, grain: 0.6, clods: 0.5, pebbles: 70,
    // Dione's photometry (Buratti & Veverka 1984; Verbiscer & Veverka
    // 1989): bright, backscattering grains, moderately rough.
    hapke: { w: 0.85, b: 0.30, c: 0.50, B0: 0.8, h: 0.01, theta: 25, Bc0: 0.35, hc: 0.004 },
    micro: [0.3, 0.25, 0.35], sparkle: 2.0,
    levels: L4, fly: 400, rover: true,
    mu: 0.5,
    dustColor: 0xb8b7b4, dustDrag: 0, stampColor: 0xa6a4a0, soil: 0xb5b3b0,
    rockTint: [0.99, 1.0, 1.02], rockAlb: [0.55, 0.25], rockN: 0.4, talus: 400,
    landmark: 'flag', flagColor: 0xc9ccd2,
    lander: 'generic',
    exposure: 1.0, eye: [0.36, 0.05, 15], starGain: 0.006, bloom: [0.5, 0.65, 3.0],
    companions: ['saturn-dio', 'mimas-dio', 'enceladus-dio', 'tethys-dio', 'rhea-dio', 'titan-dio'],
    // Night: Saturn, 18.4° across at albedo 0.47 — 1.2% of the sun.
    night: { ratio: 0.012, radius: 0.161, color: 0xfff0d8, label: 'SATURNLIT', stars: 12 },
    relay: 0.1,
    look: [2.142, 0.3],
  },

  /* Iapetus is 9.5 AU out with Saturn: 15 W/m², a ninetieth of the
     Moon's. Light is kept in units a hundred times the Moon's, Titan's,
     because the dark lag here is darker than lunar soil and in Europa's
     units its radiance would sit two orders of magnitude under the
     Moon's, where the eye's exposure turns output dither into speckle.

     Saturn is 3.56 million km off: 1.9° across, the rings 4.4° from tip
     to tip, 40° up in the east from the site (1.7°N, 50° west of the
     point beneath it). Iapetus's orbit is the only big moon's tilted
     well out of Saturn's equator — 15° — so from here, unlike from
     every other moon, the rings are seen open. Titan wanders past as a
     small orange disc. */
  iapetus: {
    name: 'IAPETUS', site: 'Cassini Regio', gTxt: '0.22 m/s²',
    title: 'Iapetus Walk', sub: 'Cassini Regio · 0.023 g · surface unbounded',
    fine: 'Half of Iapetus is black and half is white, sorted by the sun. To the south a wall of<br>' +
          'mountains six kilometres high runs along the equator, frosted where it faces the pole.<br>' +
          'Saturn, rings open, hangs in the east. <b>Esc</b> picks another world.',
    air: false, stars: 1,
    sunColor: 0xfff8f2, sunPower: 3.75, sunSize: 5.9, sunHDR: [60, 57, 52],
    corona: 2600, coronaColor: [1.6, 1.55, 1.45],
    hemi: [0x1c1b1a, 0x4c4844, 1.6], amb: [0x000000, 0],
    fog: null, sky: null,
    grey: 150, mapTint: [1.02, 1.0, 0.97], pits: 60, grain: 0.85, clods: 0.6, pebbles: 90,
    // Fitted to Cassini's images of both terrains (Lee et al. 2010): one
    // set cannot serve lag and frost alike; this one leans to the lag.
    hapke: { w: 0.30, b: 0.30, c: 0.60, B0: 1.2, h: 0.05, theta: 25, Bc0: 0.4, hc: 0.005 },
    micro: [0.8, 0.45, 0.6], sparkle: 1.0,
    levels: L4, fly: 400, rover: true,
    mu: 0.55,
    dustColor: 0x3e342c, dustDrag: 0, stampColor: 0x30281f, soil: 0x3a3029,
    rockTint: [1.1, 0.95, 0.85], rockAlb: [0.10, 0.25], rockN: 0.6,
    landmark: 'flag', flagColor: 0xc9ccd2,
    lander: 'generic',
    exposure: 1.0, eye: [0.18, 0.05, 15], starGain: 0.04, bloom: [0.55, 0.65, 3.0],
    companions: ['saturn-iap', 'titan-iap'],
    // Night: Saturn and its open rings, about 0.02% of the sun.
    night: { ratio: 2.0e-4, radius: 0.017, color: 0xfff0d8, label: 'SATURNLIT', stars: 40 },
    relay: 0.1,
    look: [-1.9, 0.38],
  },

  /* Miranda is 19.2 AU out: 3.7 W/m², from a sun 1.7 arcminutes across.
     Light in Titan's units, a hundred times the Moon's; the ground is
     grey ice at 0.3, so its radiance sits near the Moon's.

     Uranus is 129,000 km off, 22.8° across — forty-five full Moons —
     38° up in the north-east from the site (35°S, 40° west of the point
     beneath it), over the scarp, and never moves. Miranda orbits in
     Uranus's equator, 4.3° out of it at most, so the rings are a dark
     thread nearly edge-on. Ariel, Umbriel, Titania and Oberon go round
     outside, Ariel as much as a degree across. At 0.008 g walking is
     out of the question, so the suit has jets and the beacon. */
  miranda: {
    name: 'MIRANDA', site: 'Inverness Corona', gTxt: '0.079 m/s²',
    title: 'Miranda Walk', sub: 'Inverness Corona · 0.008 g · surface unbounded',
    fine: 'A moon broken and put back together badly: banded coronae against old cratered ground,<br>' +
          'and to the north-east a cliff six kilometres high. Uranus fills 23° of the sky over it.<br>' +
          'A full push would keep you up for nearly a minute: use the jets. <b>Esc</b> picks another world.',
    air: false, stars: 1,
    sunColor: 0xfff8f2, sunPower: 0.92, sunSize: 2.9, sunHDR: [60, 57, 52],
    corona: 2000, coronaColor: [0.68, 0.66, 0.62],
    hemi: [0x1a1a1b, 0x4a4a4b, 2.0], amb: [0x000000, 0],
    fog: null, sky: null,
    grey: 160, mapTint: [0.99, 1.0, 1.01], pits: 30, grain: 0.7, clods: 0.6, pebbles: 70,
    // Uranian satellite photometry (Buratti & Mosher 1991): moderately
    // bright grains, backscattering, rough.
    hapke: { w: 0.55, b: 0.30, c: 0.60, B0: 1.0, h: 0.04, theta: 25, Bc0: 0.35, hc: 0.005 },
    micro: [0.5, 0.4, 0.45], sparkle: 1.5,
    levels: L4, fly: 400, rover: false, jets: true,
    mu: 0.5,
    dustColor: 0x8c8c8c, dustDrag: 0, stampColor: 0x777779, soil: 0x8a8a8b,
    rockTint: [0.99, 1.0, 1.01], rockAlb: [0.35, 0.15], rockN: 0.4,
    landmark: 'beacon', flagColor: 0xb9bcc2,
    lander: 'generic',
    exposure: 1.0, eye: [0.2, 0.05, 15], starGain: 0.04, bloom: [0.55, 0.65, 3.0],
    companions: ['uranus-mir', 'ariel-mir', 'umbriel-mir', 'titania-mir', 'oberon-mir'],
    // Night: Uranus, 22.8° across at albedo 0.49 — 1.8% of the sun.
    night: { ratio: 0.0183, radius: 0.199, color: 0xe2f4f6, label: 'URANUSLIT', stars: 10 },
    relay: 0.05,
    look: [-0.97, 0.42],
  },

  /* Triton is 30 AU out: 1.5 W/m², a nine-hundredth of the Moon's
     sunlight, from a sun 64 arcseconds across — a point, as from Pluto.
     Light is kept in Pluto's units, a thousand times the Moon's. It
     falls on nitrogen ice that sends back three-quarters of it, so the
     eye stops down hard and the shadows fill from the bright ground
     around them; and still the brighter stars stay out by day, as on
     Pluto, against a sky that is black but for a faint haze low down.

     Fourteen microbars of nitrogen hold up a thin haze and carry the
     geysers' dust off downwind. Neptune is 8° across, sixteen full
     Moons, 29° up in the east from the site (15°S, 60° west of the
     point beneath it), and never moves: a pale blue-green globe with
     the Great Dark Spot on it. Triton's orbit is retrograde and tilted
     23° to Neptune's equator, so the planet's poles are not where its
     moon's are. */
  triton: {
    name: 'TRITON', site: 'Bubembe Regio', gTxt: '0.78 m/s²',
    title: 'Triton Walk', sub: 'Bubembe Regio · 0.079 g · surface unbounded',
    fine: 'Nitrogen ice at −235 °C, the coldest surface ever measured. Neptune hangs 8° wide<br>' +
          'in the east; geysers stand on the polar cap to the south, their dust trailing<br>' +
          'away west on the wind. <b>Esc</b> picks another world.',
    air: false, stars: 1,
    sunColor: 0xfff8f2, sunPower: 4.06, sunSize: 1.9, sunHDR: [60, 57, 52],
    corona: 2600, coronaColor: [1.6, 1.55, 1.45],
    hemi: [0x1a1b20, 0x40403e, 30.0], amb: [0x000000, 0],
    fog: null,
    // A haze like Pluto's, a shade thinner (Rages & Pollack 1992).
    sky: { zenith: [0.0001, 0.00018, 0.0003], horizon: [0.0013, 0.0021, 0.0038],
           aureole: [0.0045, 0.0065, 0.011], k: 14, amt: 0.9, tau: 0.004 },
    grey: 200, mapTint: [1.0, 0.985, 0.97], pits: 10, grain: 0.5, clods: 0.4, pebbles: 40,
    // Triton's photometry (Hillier et al. 1994): grains that scatter
    // almost everything, a narrow surge, little roughness.
    hapke: { w: 0.96, b: 0.30, c: 0.45, B0: 0.7, h: 0.01, theta: 14, Bc0: 0.4, hc: 0.003 },
    micro: [0.2, 0.2, 0.3], sparkle: 2.5,
    levels: L4, fly: 400, rover: true,
    mu: 0.5,
    dustColor: 0xd8d4d0, dustDrag: 0, stampColor: 0xc8c2bc, soil: 0xdad6d2,
    rockTint: [1.0, 0.99, 0.98], rockAlb: [0.55, 0.2], rockN: 0.3,
    landmark: 'flag', flagColor: 0xc9ccd2,
    lander: 'generic',
    exposure: 1.0, eye: [0.36, 0.3, 20], starGain: 0.03, bloom: [0.55, 0.65, 3.0],
    companions: ['neptune-tri'],
    // Night: Neptune, 8.0° across at albedo 0.44 — 0.2% of the sun.
    night: { ratio: 0.0021, radius: 0.0698, color: 0xc8dcff, label: 'NEPTUNELIT', stars: 25 },
    // Earth is never more than 1.9° from the sun from Neptune.
    relay: 0.03,
    // Geysers on the cap: bearing (°) and distance of the vent, column
    // height, half-width and optical depth, and where the trail goes.
    geysers: [
      { brg: 158, dist: 58000, H: 8000, w: 700, tau: 0.9, tail: { brg: 262, len: 150000 } },
      { brg: 118, dist: 96000, H: 7500, w: 600, tau: 0.8, tail: { brg: 258, len: 120000 } },
    ],
    look: [-1.42, 0.25],
  },

  /* Pluto is 33 AU out: 1.26 W/m², a thousandth of the Moon's
     sunlight, from a sun 58 arcseconds across — a point, not a disc,
     though still some two hundred and fifty full moons bright. Noon
     here is lit like the first minutes after sunset at home. Light
     is kept in units a thousand times the Moon's, so the numbers
     below read like the Moon's; only the stars, which do not care
     what Pluto's sun is doing, are relatively a thousand times
     brighter against the ground. At twilight levels, against a black
     sky, the brighter stars stay out at noon — so they do here, with
     the ground in view.

     The air is a hundred-thousandth of Earth's, ten microbars of
     nitrogen, and does nothing to the light but one thing: its haze.
     Twenty-odd layers of tholin haze stand up to 200 km over the
     surface; they are what made Pluto a blue ring in New Horizons'
     departure picture. From the ground that is a faint blue glow low
     down, strongest toward the sun, where the haze scatters forward,
     and a trace of blue sky-fill in the shadows. The zenith is all
     but black.

     Charon stands 27° above the eastern horizon, 3.65° across — seven
     Moons — and never moves: the two are locked face to face, and
     from Pluto's far side, where the famous heart is, it is never
     seen at all. Its light in a shadow is a tenth of a percent of the
     sun's. */
  pluto: {
    name: 'PLUTO', site: 'Charon-facing hemisphere', gTxt: '0.62 m/s²',
    title: 'Pluto Walk', sub: 'Charon-facing hemisphere · 0.063 g · surface unbounded',
    fine: 'Noon here is dusk: the sun is a point a thousandth as bright, and the<br>' +
          'stars stay out. Charon hangs 3.7° wide in the east and never moves, over<br>' +
          'mountains capped with methane frost. <b>Esc</b> picks another world.',
    air: false, stars: 1,
    sunColor: 0xfff8f2, sunPower: 3.4, sunSize: 1.7, sunHDR: [60, 57, 52],
    corona: 2600, coronaColor: [1.6, 1.55, 1.45],
    hemi: [0x1e1f2a, 0x4a3226, 1.0], amb: [0x000000, 0],
    fog: null,
    // Single scattering off a haze of vertical optical depth about
    // 0.005, strongly forward-scattering: a per cent or two of the
    // ground at the zenith, a tenth of it along the horizon, and around
    // the sun a glow up to half as bright as the ground. Kept at the
    // faint end of what the measured haze allows.
    sky: { zenith: [0.0001, 0.0002, 0.0004], horizon: [0.0015, 0.0026, 0.0052],
           aureole: [0.005, 0.0075, 0.014], k: 14, amt: 0.9, tau: 0.005 },
    grey: 200, mapTint: [1.0, 0.98, 0.96], pits: 30, grain: 0.9, clods: 0.8, pebbles: 120,
    // A compromise between the two materials this ground is made of,
    // dark tholin and bright frost; the vertex colours carry which.
    hapke: { w: 0.45, b: 0.30, c: 0.55, B0: 0.8, h: 0.06, theta: 20, Bc0: 0.3, hc: 0.006 },
    micro: [0.35, 0.3, 0.6], sparkle: 0.6,
    levels: L4, fly: 400, rover: true,
    mu: 0.55,
    dustColor: 0x4a3024, dustDrag: 0, stampColor: 0x3a261c, soil: 0x5a3a2a,
    // Blocks of the water-ice crust, under the same tholin dust.
    rockTint: [1.35, 0.85, 0.62], rockAlb: [0.09, 0.08], rockN: 0.6, talus: 300,
    landmark: 'flag', flagColor: 0xc9ccd2,
    lander: 'generic',
    exposure: 1.0, eye: [0.16, 0.5, 20], starGain: 0.03, bloom: [0.55, 0.65, 3.0],
    companions: ['charon'],
    // Night: Charon, 3.65° across at albedo 0.4 — 0.04% of the sun.
    night: { ratio: 4.1e-4, radius: 0.0319, color: 0xf2f2f6, label: 'CHARONLIT', stars: 30 },
    // Earth is never more than 1.7° from the sun from out here.
    relay: 0.025,
  },

  /* Charon is at Pluto's distance from the sun, so the light is
     Pluto's and is kept in the same units, a thousand times the
     Moon's. What differs is what it falls on: grey water ice at a
     reflectance of about 0.4, four times the tholin's, so the eye
     stops down and the stars that stay out at noon on Pluto are
     fainter against it here — only the brightest survive a view with
     the ground in it. There is no air at all, so no haze and no sky.

     The ice sends two-fifths of the light back up, and with no sky
     that bounce is what fills the shadows: several times fuller than
     Pluto's, grey rather than brown. Plutoshine adds a few parts in a
     thousand of the sun, which is nothing next to it.

     Pluto stands 42° above the east-north-east horizon, 7.1° across —
     fourteen full Moons side by side — and never moves: from here the
     sun sets behind you while Pluto waits. The site is 15°S, 45° west
     of the point beneath it, on the western part of Vulcan Planitia. */
  charon: {
    name: 'CHARON', site: 'Vulcan Planitia', gTxt: '0.29 m/s²',
    title: 'Charon Walk', sub: 'Vulcan Planitia · 0.029 g · surface unbounded',
    fine: 'Water ice at −220 °C under Pluto\'s dusk-dim sun. Pluto hangs 7° wide in<br>' +
          'the east, over a mountain standing in a moat, and never moves. A full<br>' +
          'push keeps you aloft for twelve seconds. <b>Esc</b> picks another world.',
    air: false, stars: 1,
    sunColor: 0xfff8f2, sunPower: 3.4, sunSize: 1.7, sunHDR: [60, 57, 52],
    corona: 2600, coronaColor: [1.6, 1.55, 1.45],
    hemi: [0x141518, 0x58585a, 5.0], amb: [0x000000, 0],
    fog: null, sky: null,
    grey: 176, mapTint: [0.99, 1.0, 1.01], pits: 40, grain: 0.8, clods: 0.6, pebbles: 120,
    // Charon's photometry, fitted to New Horizons and Hubble together
    // down to a two-hundredth of a degree of phase (Verbiscer et al.):
    // bright grains, a phase function more isotropic than other icy
    // moons', a surge a fraction of a degree wide, and rough — 28°.
    hapke: { w: 0.70, b: 0.25, c: 0.45, B0: 1.0, h: 0.0035, theta: 28, Bc0: 0.6, hc: 0.003 },
    micro: [0.5, 0.4, 0.4], sparkle: 1.5,
    levels: L4, fly: 400, rover: true,
    mu: 0.5,
    dustColor: 0xa8a9ab, dustDrag: 0, stampColor: 0x94979c, soil: 0xa9aaac,
    // Blocks of ice, cleaner than the regolith, most of them shed off
    // graben walls and the massif's flanks.
    rockTint: [0.98, 0.99, 1.02], rockAlb: [0.42, 0.2], rockN: 0.5, talus: 400,
    landmark: 'flag', flagColor: 0xc9ccd2,
    lander: 'generic',
    exposure: 1.0, eye: [0.30, 0.3, 20], starGain: 0.03, bloom: [0.55, 0.65, 3.0],
    companions: ['pluto'],
    // Night: Pluto, 7.1° across at albedo 0.55 — 0.2% of the sun.
    night: { ratio: 0.0021, radius: 0.062, color: 0xffe6cc, label: 'PLUTOLIT', stars: 25 },
    relay: 0.025,
    // Arrive facing Pluto and the massif under it, head raised enough
    // to hold both — yaw and pitch, in radians.
    look: [-1.32, 0.3],
  },

  /* Mercury is 0.39 AU from the sun, where the disc is 1.4° across —
     two and a half times the Moon's — and delivers 6.7 times the
     light: 9 kW on every square metre, enough to hold the ground at
     noon over 400 °C. Light is kept in units 6.7 times the Moon's, so
     the numbers below read like the Moon's; only the stars, which do
     not care, are relatively that much fainter.

     There is no air, no night lamp overhead — nothing lights a
     Mercurian night but the stars and Venus — and the ground is
     brighter than the Moon's, a little over a tenth, so shadows are
     black but a shade less so. What hangs in the sky are two stars:
     Venus near opposition, the brightest thing in it after the sun, and
     Earth, with the Moon beside it if you look closely. */
  mercury: {
    name: 'MERCURY', site: 'below Discovery Rupes', gTxt: '3.70 m/s²',
    title: 'Mercury Walk', sub: 'Discovery Rupes · 0.377 g · surface unbounded',
    fine: 'The sun is two and a half times as wide as from the Moon and seven times as bright;<br>' +
          'at noon the ground under it would melt lead. To the east a cliff a kilometre and a<br>' +
          'half high crosses the horizon: the planet shrank, and broke. <b>Esc</b> picks another world.',
    air: false, stars: 1,
    sunColor: 0xfff8f2, sunPower: 3.4, sunSize: 145, sunHDR: [60, 57, 52],
    corona: 3400, coronaColor: [1.6, 1.55, 1.45],
    // Bounce off ground nearly twice as bright as mare basalt.
    hemi: [0x272624, 0x5f5b57, 1.7], amb: [0x000000, 0],
    fog: null, sky: null,
    grey: 108, mapTint: [1.02, 1.0, 0.965], pits: 110, grain: 1, pebbles: 170,
    // MESSENGER's photometry (Domingue et al. 2016) puts Mercury's soil
    // close to the Moon's: grains a little brighter, the same strong
    // backscatter and surge, and a little less rough.
    hapke: { w: 0.28, b: 0.22, c: 0.65, B0: 1.5, h: 0.06, theta: 17, Bc0: 0.4, hc: 0.006 },
    micro: [1, 0.45], sparkle: 0.8,
    levels: L4, fly: 400, rover: true,
    mu: 0.65,
    dustColor: 0x77736d, dustDrag: 0, stampColor: 0x5f5b56, soil: 0x67635e,
    rockTint: [1.02, 1.0, 0.97], rockAlb: [0.13, 0.09], rockN: 1,
    landmark: 'flag', flagColor: 0xc9ccd2,
    lander: 'generic',
    exposure: 1.0, eye: [0.18, 0.5, 150], starGain: 0.00018, bloom: [0.55, 0.65, 3.0],
    // Earth first: it is where the rover's dish looks.
    companions: ['earth-star', 'venus-star'],
  },

  /* Io is at Jupiter's distance from the sun, so the light is
     Europa's and kept in Europa's units, ten times the Moon's. The
     ground is nearly as bright as Europa's ice — sulphur and frost at
     a reflectance of about 0.6 — and yellow, so the shadows fill warm
     from the bounce. Io has an atmosphere, but a nanobar of SO₂ that
     freezes out every night does nothing to the light: the sky is
     black.

     Jupiter is 19.5° across from here and never moves, 40° up in the
     east-north-east, over a mountain seven kilometres high. The other
     three moons go round outside Io's orbit and behind Jupiter. Two
     plumes are up: a Prometheus-type 90 km high over the northern
     horizon, and far to the west a giant like Pele's, 300 km high,
     most of it below the horizon, glowing where it stands toward the
     sun. And the radiation: Io orbits inside the densest part of
     Jupiter's belts, and the surface dose is about 36 Sv a day. */
  io: {
    name: 'IO', site: 'near Kanehekili Fluctus', gTxt: '1.80 m/s²',
    title: 'Io Walk', sub: 'Kanehekili Fluctus · 0.183 g · surface unbounded',
    fine: 'Sulphur and frozen SO₂ over a crust four hundred volcanoes remake so fast that not<br>' +
          'one impact crater survives. Jupiter fills 19° of the sky; plumes stand over the horizon.<br>' +
          'The dose is 36 Sv a day: a lethal one in three hours. <b>Esc</b> picks another world.',
    air: false, stars: 1,
    sunColor: 0xfff8f2, sunPower: 1.26, sunSize: 10.7, sunHDR: [60, 57, 52],
    corona: 2000, coronaColor: [0.68, 0.66, 0.62],
    // Bounce off bright yellow ground, much as on Europa's ice.
    hemi: [0x181610, 0x3a3624, 8.5], amb: [0x000000, 0],
    fog: null, sky: null,
    grey: 200, mapTint: [1.0, 0.985, 0.95], pits: 20, grain: 0.7, clods: 0.7, pebbles: 70,
    // Io's photometry (Simonelli & Veverka 1986; Domingue & Verbiscer
    // 1997): bright grains, a modest surge, and rough — the roughest of
    // the Galilean surfaces.
    hapke: { w: 0.88, b: 0.30, c: 0.60, B0: 0.9, h: 0.04, theta: 30, Bc0: 0.3, hc: 0.005 },
    micro: [0.3, 0.3, 0.45], sparkle: 1.2,
    levels: L4, fly: 400, rover: true,
    mu: 0.55,
    dustColor: 0xcfc390, dustDrag: 0, stampColor: 0xb3a36e, soil: 0xc8bb88,
    // Silicate blocks shed off the mountains and patera walls, under a
    // film of the sulphur that falls on everything.
    rockTint: [1.0, 0.9, 0.72], rockAlb: [0.30, 0.2], rockN: 0.4, talus: 500,
    landmark: 'flag', flagColor: 0xc9ccd2,
    lander: 'generic',
    // ACES, as on Mars: AgX gives away the saturation in the highlights,
    // and here that is the yellow of the sulphur.
    exposure: 1.0, eye: [0.30, 0.05, 15], starGain: 0.012, bloom: [0.5, 0.65, 3.0], tone: 'aces',
    companions: ['jupiter-io', 'europa-io', 'ganymede-io', 'callisto-io'],
    // Night: Jupiter, 19.5° across at albedo 0.52 — 1.5% of the sun.
    night: { ratio: 0.0149, radius: 0.170, color: 0xfff0dc, label: 'JUPITERLIT', stars: 12 },
    relay: 0.14,
    dose: 36,
    // The plumes, as bearing (°) and distance from the landing site.
    plumes: [
      { brg: 22, dist: 170000, H: 90000, W: 130000, shell: 0.05, column: 0.8, col: [0.78, 0.86, 1.0], gain: 0.06 },
      { brg: 262, dist: 700000, H: 320000, W: 550000, shell: 0.08, column: 0.15, col: [0.95, 0.80, 0.65], gain: 0.008 },
    ],
    // Arrive facing Jupiter and the mountain under it.
    look: [-1.2, 0.3],
  },

  /* Enceladus is 9.5 AU out: 15 W/m², a ninetieth of the Moon's, from
     a sun 3.4 arcminutes across — still a disc, just. Light is kept in
     Europa's units, ten times the Moon's. What it falls on is the
     brightest surface in the solar system, fresh snow fallen back from
     the jets, so the eye stops right down and the snow reads white, and
     the shadows fill from it more than anywhere else — a quarter of the
     lit ground, blue-grey only where the bluer stripe ice lights them.

     Saturn is 29° across in the north-east, the rings a razor line
     through it because Enceladus orbits in their plane; their shadow
     lies across the globe. Tethys, Dione, Rhea and Titan wander along
     that line, and Mimas crosses the disc. Along the tiger stripe five
     kilometres north the jets stand in a curtain, bright only toward
     the sun. At a ninth of the Moon's gravity walking is a slow shuffle
     and a jump lasts half a minute, so the suit carries jets, as on
     the Martian moons, with a beacon to recharge them. */
  /* Titan is 9.5 AU out, like Enceladus, but under 1.5 bar of
     nitrogen and a haze 300 km deep. The haze absorbs blue and scatters
     the rest, so what reaches the ground is orange, almost all of it
     diffuse, and about a thousandth of Earth's daylight — Huygens'
     lamp was for colour, not for light (Tomasko et al. 2005). The sun
     shows only as a brighter part of the sky, the ground casts no
     shadow you could see, and Saturn, which stands in this sky and
     never moves, is lost in the haze at every visible wavelength.

     Light is kept in units a hundred times the Moon's: the top of the
     atmosphere gets 3.8, the ground about a tenth of that, nearly all
     of it from the sky, so the hemisphere carries it and the sun's
     term is the last few per cent of direct beam.

     Ligeia Mare's southern shore, at 78° N in the summer the northern
     seas were seen in: the sun stands low, here 16°. You land at the
     head of a bay, with a plateau across it. The liquid level is
     height 0; see hTitan(). */
  titan: {
    name: 'TITAN', site: 'Ligeia Mare', gTxt: '1.35 m/s²',
    title: 'Titan Walk', sub: 'Ligeia Mare · 0.138 g · surface unbounded',
    fine: 'One and a half bar of nitrogen at −179 °C, under a haze that lets through a thousandth<br>' +
          'of Earth\'s daylight, all of it orange and none of it from a visible sun. The bay in<br>' +
          'front of you is liquid methane: walk in. <b>Esc</b> picks another world.',
    air: true, stars: 0, noSun: true, shadows: false, skyLit: true,
    sunColor: 0xffb46a, sunPower: 0.05, sunSize: 5.9, sunHDR: [1, 1, 1],
    corona: 1, coronaColor: [1, 1, 1],
    hemi: [0xffaa58, 0x24170b, 1.8], amb: [0xb07038, 0.08],
    // The lower atmosphere is clearer than the haze over it: Huygens
    // saw the ground sharply from 8 km up. Distance still goes orange
    // over tens of kilometres.
    fog: { density: 3.6e-5 },
    sky: { zenith: [0.135, 0.068, 0.020], horizon: [0.20, 0.112, 0.042],
           aureole: [0.30, 0.19, 0.08], k: 4, amt: 0.30 },
    // Organic sediment, wet with methane and sorted by it: fine, smooth,
    // few pits — rain and the haze's fallout fill them in.
    grey: 92, mapTint: [1.02, 0.98, 0.92], pits: 14, grain: 0.55, clods: 0.2, pebbles: 25,
    // No opposition to surge toward under light from the whole sky.
    hapke: { w: 0.45, b: 0.20, c: 0.30, B0: 0, h: 0.10, theta: 14, Bc0: 0, hc: 0.01 },
    micro: [0, 0], sparkle: 0,
    levels: L4, fly: 400, rover: true, roverDrag: 0.028,
    mu: 0.6,
    // ½ρC_dA/m for a suited walker in 5.3 kg/m³ of nitrogen, and the
    // weight that air holds up — both small at a walk.
    drag: 0.0124, buoy: 0.008,
    medium: { air: 0.9, lp: 7000, wind: 0.12, windLP: 220 },
    dustColor: 0x5c4834, dustDrag: 24, dustLife: 3.0, stampColor: 0x3a2c20, soil: 0x5a4632,
    // Water ice, rounded by rolling, under a film of the organics: a
    // little brighter and greyer than the sand they lie in.
    rockTint: [1.0, 0.95, 0.88], rockAlb: [0.42, 0.2], rockN: 0.25, rockRound: true,
    cobbles: { patches: 160, per: 45, r: 5, size: [0.03, 0.17] }, rockMax: 5000,
    landmark: 'flag', flagColor: 0xd8d2c4,
    lander: 'generic',
    exposure: 1.0, eye: [0.16, 0.3, 14], tone: 'aces', bloom: [0.2, 0.75, 3.0],
    companions: [],
    sea: 0,
    look: [Math.PI, -0.03],
  },

  enceladus: {
    name: 'ENCELADUS', site: 'Baghdad Sulcus', gTxt: '0.113 m/s²',
    title: 'Enceladus Walk', sub: 'Baghdad Sulcus · 0.012 g · surface unbounded',
    fine: 'The brightest ground in the solar system: snow fallen back from jets of an ocean<br>' +
          'underneath, which stand along the tiger stripe to the north. Saturn fills 29° of the<br>' +
          'sky, its rings edge-on. <b>Esc</b> picks another world.',
    air: false, stars: 1,
    sunColor: 0xfff8f2, sunPower: 0.378, sunSize: 5.9, sunHDR: [60, 57, 52],
    corona: 1600, coronaColor: [0.68, 0.66, 0.62],
    hemi: [0x1a1b1e, 0x3e4044, 14.0], amb: [0x000000, 0],
    fog: null, sky: null,
    grey: 232, mapTint: [0.99, 1.0, 1.02], pits: 8, grain: 0.45, clods: 0.35, pebbles: 30,
    // Enceladus's photometry (Verbiscer et al. 2005): grains that
    // scatter nearly everything they get, w close to one, a strong
    // narrow surge, little roughness under the snow.
    hapke: { w: 0.99, b: 0.30, c: 0.40, B0: 0.8, h: 0.002, theta: 12, Bc0: 0.4, hc: 0.002 },
    micro: [0.15, 0.15, 0.2], sparkle: 3.0,
    levels: LE, fly: 400, rover: false, jets: true,
    mu: 0.5,
    dustColor: 0xe4e8ee, dustDrag: 0, stampColor: 0xd4dae2, soil: 0xe6e9ee,
    // Blocks of ice tens of metres across lie all over the south polar
    // terrain, broken off the stripes' walls; smaller ones among them.
    rockTint: [0.97, 0.99, 1.03], rockAlb: [0.7, 0.2], rockN: 0.25, blocks: 6,
    landmark: 'beacon', flagColor: 0xb9bcc2,
    lander: 'generic',
    exposure: 1.0, eye: [0.42, 0.05, 15], starGain: 0.012, bloom: [0.5, 0.65, 3.0],
    companions: ['saturn-enc', 'mimas-enc', 'tethys-enc', 'dione-enc', 'rhea-enc', 'titan-enc'],
    // Night: Saturn, 29° across at albedo 0.47 — 3% of the sun.
    night: { ratio: 0.030, radius: 0.256, color: 0xfff0d8, label: 'SATURNLIT', stars: 10 },
    relay: 0.1,
    curtain: 0.07,
    look: [-0.885, 0.28],
  },
};
