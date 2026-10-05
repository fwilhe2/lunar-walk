import type { WorldView } from '../view-types';
import { LE } from '../levels';

export const view = {
  site: 'Baghdad Sulcus',
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
} satisfies WorldView;
