import type { WorldView } from '../view-types';
import { L4 } from '../levels';

/* Dione has Enceladus's sun, in the same units, on a trailing face
   darkened to about half of Dione's leading-side ice, and cut by
   cliffs of clean ice twice as bright. Saturn is 377,000 km off, 18.4°
   across, 33° up in the south-west from the site (40°N, 45° east of
   the point beneath it), and never moves; at this hour the sun is
   not far from it, so it shows a thick crescent with its rings a
   line across it. Mimas, Enceladus and Tethys pass in front of it; Rhea
   and Titan go round outside. */
export const view = {
  site: 'Padua Chasmata',
  title: 'Dione Walk', sub: 'Padua Chasmata · 0.024 g · surface unbounded',
  fine: 'The wisps Voyager saw on Dione\'s trailing face are cliffs: fresh ice walls hundreds<br>' +
        'of metres high along graben. One drops away in front of you, under Saturn, 18° wide.<br>' +
        '<b>Esc</b> picks another world.',
  air: false, stars: 1,
  sunColor: 0xfff8f2, sunPower: 0.378, sunSize: 5.9, sunHDR: [60, 57, 52],
  corona: 1600, coronaColor: [0.68, 0.66, 0.62],
  hemi: [0x1a1b1e, 0x3e4044, 6.0], amb: [0x000000, 0],
  fog: null, sky: null,
  grey: 210, mapTint: [1.0, 0.995, 0.985], pits: 30, grain: 0.6, clods: 0.5, pebbles: 70,
  // Dione's photometry (Buratti & Veverka 1984; Verbiscer & Veverka
  // 1989): bright, backscattering grains, moderately rough.
  hapke: { w: 0.85, b: 0.30, c: 0.50, B0: 0.8, h: 0.01, theta: 25, Bc0: 0.35, hc: 0.004 },
  micro: [0.3, 0.25, 0.35], sparkle: 2.0,
  levels: L4, fly: 400, rover: true,
  mu: 0.5,
  dustColor: 0xb8b7b4, dustDrag: 0, stampColor: 0xa6a4a0, soil: 0xb5b3b0,
  rockTint: [0.99, 1.0, 1.02], rockAlb: [0.55, 0.25], rockN: 0.4, talus: 400,
  landmark: 'flag', flagColor: 0xc9ccd2,
  lander: 'generic',
  exposure: 1.0, eye: [0.36, 0.05, 15], starGain: 0.006, bloom: [0.5, 0.65, 3.0],
  companions: ['saturn-dio', 'mimas-dio', 'enceladus-dio', 'tethys-dio', 'rhea-dio', 'titan-dio'],
  // Night: Saturn, 18.4° across at albedo 0.47 — 1.2% of the sun.
  night: { ratio: 0.012, radius: 0.161, color: 0xfff0d8, label: 'SATURNLIT', stars: 12 },
  relay: 0.1,
  look: [2.142, 0.3],
} satisfies WorldView;
