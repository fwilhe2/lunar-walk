import type { WorldView } from '../view-types';
import { L4 } from '../levels';

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
export const view = {
  site: 'Cassini Regio',
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
} satisfies WorldView;
