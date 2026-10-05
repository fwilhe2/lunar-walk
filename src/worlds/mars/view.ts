import type { WorldView } from '../view-types';
import { L4 } from '../levels';

export const view = {
  site: 'Amazonis Planitia',
  title: 'Mars Walk', sub: 'Amazonis Planitia · 0.379 g · surface unbounded',
  fine: 'Six millibars of CO₂ is enough to hold dust, and dust is what you see.<br>' +
        'The sky is butterscotch, the shadows are filled, and the halo around<br>' +
        'the sun is blue — forward-scattered by the same dust. <b>Esc</b> picks another world.',
  air: true, stars: 0,
  // Dust reddens the beam on the way down and steals about half of it.
  sunColor: 0xffd9b0, sunPower: 1.85, sunSize: 37, sunHDR: [7.2, 5.4, 3.6],
  corona: 5200, coronaColor: [0.72, 0.78, 1.0],
  hemi: [0xd08a4e, 0x54321f, 1.25], amb: [0x7a4c30, 0.42],
  // Visibility on a clear sol is a couple of tens of kilometres,
  // and what fades the distance is the same suspended dust that
  // colours the sky — so the fog takes the sky's own colour, and
  // both dim together as the sun goes down.
  fog: { density: 9e-5 },
  // Linear radiances, not sRGB swatches — the composer renders HDR
  // and tone maps at the very end. Calibrated against the sunlit
  // ground beneath it: near the horizon the Martian sky is roughly
  // as bright as the ground, which is the thing photographs of it
  // get across and descriptions of it never do. Still dark enough
  // that a 7%-albedo moon reads as a bright dot against it. tau is
  // the dust's vertical optical depth on a clear sol, which dims
  // Phobos and Deimos on the way down.
  sky: { zenith: [0.095, 0.055, 0.034], horizon: [0.34, 0.20, 0.115],
         aureole: [0.30, 0.335, 0.44], k: 62, tau: 0.5 },
  grey: 150, mapTint: [1.0, 0.93, 0.86], pits: 70, grain: 0.7, ripple: 0.16,
  pebbles: 600, clods: 0.8,
  // Brighter, less porous soil: skylight fills the gaps between
  // grains, so the opposition surge is weak and the phase curve flat.
  hapke: { w: 0.55, b: 0.25, c: 0.35, B0: 0.6, h: 0.10, theta: 16, Bc0: 0.1, hc: 0.01 },
  micro: [0.25, 0.4], sparkle: 0,
  // A few dust devils walking across the plain with the wind.
  devils: 3,
  levels: L4, fly: 400, rover: true,
  mu: 0.65,
  // Pressing pushes the bright oxidised dust film aside: the tracks
  // of Spirit, Opportunity and Curiosity run a quarter or so darker
  // than the ground beside them, and a little less red.
  dustColor: 0xc08a5e, dustDrag: 0.55, stampColor: 0x8f6c52, soil: 0xa07c61,
  // Dark basalt under a film of the bright dust.
  rockTint: [1.0, 0.86, 0.74], rockAlb: [0.12, 0.13], rockN: 0.85,
  landmark: 'flag', flagColor: 0xd8dce2,
  lander: 'viking',
  // ACES here, not AgX: a sky that is itself coloured needs the
  // saturation AgX gives away in the highlights.
  exposure: 1.0, eye: [0.13, 0.3, 4], tone: 'aces', bloom: [0.42, 0.7, 3.0],
  companions: ['phobos', 'deimos'],
} satisfies WorldView;
