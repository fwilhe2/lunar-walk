import type { WorldView } from '../types';
import { L4 } from '../levels';

/* Vesta is 2.36 AU out: 244 W/m², under a fifth of the Moon's, from a
   sun 0.22° across. Kept in the Moon's own units: the ground is basalt
   four times as reflective as lunar mare, so its radiance comes out
   close to the Moon's. Black sky, nothing overhead. The horizon is
   under a kilometre off at eye height, which is why the trough in
   front of you, five kilometres deep, opens right at your feet. */
export const view: WorldView = {
  site: 'Divalia Fossa',
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
  // Distance from the sun, AU: sets the zodiacal light (sky/stars.ts).
  zodiacal: 2.36,
};
