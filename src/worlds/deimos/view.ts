import type { WorldView } from '../view-types';
import { L2 } from '../levels';

export const view = {
  site: 'Voltaire rim',
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
  // Distance from the sun, AU: sets the zodiacal light (sky/stars.ts).
  zodiacal: 1.524,
} satisfies WorldView;
