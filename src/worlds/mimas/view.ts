import type { WorldView } from '../view-types';
import { LE } from '../levels';

/* Mimas has Enceladus's sun in Enceladus's units, on ice nearly as
   bright. Saturn is 186,000 km off, three of its own radii: 38°
   across, seventy-six full Moons, 50° up in the east from the site
   (5°N, 40° west of the point beneath it), and fixed. The rings are
   a line through it — Mimas orbits 1.6° out of their plane at most —
   and their shadow a band across it; Mimas itself clears a gap in
   them, the Cassini Division, by resonance. Night under Saturn is 5%
   of the sun, the brightest planetshine anywhere here. The gravity is
   a hundred-and-fiftieth of Earth's: jets and the beacon. */
export const view = {
  site: 'Saturn-facing hemisphere',
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
} satisfies WorldView;
