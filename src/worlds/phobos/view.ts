import type { WorldView } from '../types';
import { L2 } from '../levels';

export const view: WorldView = {
  site: 'near Stickney',
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
  // Distance from the sun, AU: sets the zodiacal light (sky/stars.ts).
  zodiacal: 1.524,
};
