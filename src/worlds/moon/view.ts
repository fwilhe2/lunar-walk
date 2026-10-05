import type { WorldView } from '../types';
import { L4 } from '../levels';

export const view: WorldView = {
  site: 'Mare Tranquillitatis',
  title: 'Lunar Walk', sub: 'Mare Tranquillitatis · 0.166 g · surface unbounded',
  fine: 'Sunlight is unfiltered — shadows are black, and the sky stays black at noon.<br>' +
        'Walk in any direction for as long as you like: the surface never ends.<br>' +
        '<b>R</b> drives the rover. <b>F</b> flies. Turn around — Earth does not rise or set.',
  air: false, stars: 1,
  sunColor: 0xfff8f2, sunPower: 3.4, sunSize: 56, sunHDR: [60, 57, 52],
  corona: 2600, coronaColor: [1.6, 1.55, 1.45],
  // Fill at a 16° sun; it scales with how much ground is lit.
  hemi: [0x272624, 0x5f5a55, 1.0], amb: [0x000000, 0],
  fog: null, sky: null,
  // Mare soil is not neutral: its reflectance climbs steadily toward
  // the red, which reads as a faint brown-grey in sunlight.
  grey: 96, mapTint: [1.03, 1.0, 0.955], pits: 110, grain: 1, pebbles: 170,
  // Hapke parameters for lunar soil, after Sato et al. (2014) from
  // LROC: dark grains, strongly backscattering, a shadow-hiding
  // surge over the first few degrees and a narrow coherent one
  // inside the first half-degree, and ~22° of roughness.
  hapke: { w: 0.25, b: 0.23, c: 0.70, B0: 1.4, h: 0.07, theta: 22, Bc0: 0.4, hc: 0.006 },
  micro: [1, 0.45], sparkle: 1.0,
  levels: L4, fly: 400, rover: true,
  // Grip, boot sole on the ground: the ceiling on every horizontal
  // force your legs can make. Regolith is about 0.65. Ice is slippery
  // at home only because it is near melting and wears a film of
  // water; at −170 °C and colder there is none, and it grips about
  // as well as a dry rock floor, a little under soil.
  mu: 0.65,
  dustColor: 0x6e6a64, dustDrag: 0, stampColor: 0x55514c, soil: 0x5a5550,
  // Basalt blocks weather more slowly than soil: 0.12–0.22 against ~0.10.
  rockTint: [1.03, 1.0, 0.95], rockAlb: [0.11, 0.08], rockN: 1,
  landmark: 'flag', flagColor: 0xc9ccd2,
  rilleTalus: 900,
  // Eye adaptation: [key, min, max]. The key puts sunlit mare at a
  // photographic mid-grey; the ceiling is how far the eye opens in
  // the dark, which is just far enough for the brightest stars.
  exposure: 1.0, eye: [0.16, 0.5, 150], starGain: 0.0012, bloom: [0.55, 0.65, 3.0],
  companions: ['earth'],
  // Night: full Earth, 1/4000 of the sun, 1.9° across and faintly blue.
  night: { ratio: 2.5e-4, radius: 0.0166, color: 0xdfe7ff, label: 'EARTHLIT', stars: 120 },
  // Distance from the sun, AU: sets the zodiacal light (sky/stars.ts).
  zodiacal: 1,
};
