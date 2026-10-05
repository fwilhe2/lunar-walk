import type { WorldView } from '../view-types';
import { L4 } from '../levels';

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
export const view = {
  site: 'Charon-facing hemisphere',
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
} satisfies WorldView;
