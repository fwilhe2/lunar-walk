import type { WorldView } from '../types';
import { L4 } from '../levels';

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
export const view: WorldView = {
  site: 'Bubembe Regio',
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
};
