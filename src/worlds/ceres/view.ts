import type { WorldView } from '../types';
import { L4 } from '../levels';

/* Ceres is 2.77 AU out: 177 W/m², an eighth of the Moon's, from a sun
   0.19° across. Light is kept in Europa's units, ten times the Moon's,
   so the numbers sit near the Moon's (a sun of 4.5 rather than 3.4).
   The ground is as dark as lunar mare, so everything else is the
   Moon's: black sky, black shadows filled only from the ground round
   them. Nothing hangs overhead; the horizon is a kilometre off at eye
   height, and Occator's rim stands round it, forty kilometres away,
   its foot already below the curve. */
export const view: WorldView = {
  site: 'Occator',
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
  // Distance from the sun, AU: sets the zodiacal light (sky/stars.ts).
  zodiacal: 2.77,
};
