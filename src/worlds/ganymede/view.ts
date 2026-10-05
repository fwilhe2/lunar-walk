import type { WorldView } from '../types';
import { L4 } from '../levels';

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
export const view: WorldView = {
  site: 'Nicholson Regio',
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
  // Distance from the sun, AU: sets the zodiacal light (sky/stars.ts).
  zodiacal: 5.2,
};
