import { hSmall, tintMoonlet } from '../common/moonlet';

/* Deimos is the same rock with a thicker blanket on it: metres of
   regolith drape and infill every crater, so it reads visibly
   smoother than Phobos, and it has no grooves at all.           */
export const terrain = {
  id: 'deimos', seed: 18770812,
  g: 0.003, R: 6200,
  craters: [
    { cell: 5120, salt:  3, rMin: 300, rMax: 900, count: 1, prob: 0.40 },
    { cell: 1280, salt: 17, rMin:  90, rMax: 300, count: 1, prob: 0.60, rocks: 1 },
    { cell:  320, salt: 31, rMin:  25, rMax:  90, count: 2, prob: 0.85, rocks: 1 },
    { cell:   80, salt: 43, rMin:   7, rMax:  25, count: 1, prob: 0.70, rocks: 1 },
    { cell:   20, salt: 59, rMin: 1.6, rMax:   7, count: 1, prob: 0.28, rocks: 1 },
  ],
  craterAmp: 0.66, depthK: 0.80, rampart: 0,
  relief: 78, groove: 0, fine: 0.62, albedoK: 0.96, halo: 0.22,
  height: hSmall,
  tint: tintMoonlet,
};
