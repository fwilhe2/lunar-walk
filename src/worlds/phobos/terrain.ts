import { hSmall, tintMoonlet } from '../common/moonlet';

/* Phobos: a 22 km captured asteroid, saturated at every scale,
   and cut by the grooves — parallel troughs, hundreds of metres
   apart and breaking into chains of pits along their length.
   Darkest natural surface in the inner system, albedo 0.071.    */
export const terrain = {
  id: 'phobos', seed: 18770818,
  g: 0.0057, R: 11100,
  craters: [
    { cell: 5120, salt:  3, rMin: 400, rMax: 1300, count: 1, prob: 0.55 },
    { cell: 1280, salt: 17, rMin: 110, rMax:  400, count: 2, prob: 0.70, rocks: 1 },
    { cell:  320, salt: 31, rMin:  30, rMax:  110, count: 2, prob: 0.90, rocks: 1 },
    { cell:   80, salt: 43, rMin:   8, rMax:   30, count: 1, prob: 0.80, rocks: 1 },
    { cell:   20, salt: 59, rMin: 1.8, rMax:    8, count: 1, prob: 0.35, rocks: 1 },
    { cell:    6, salt: 61, rMin: 0.6, rMax:  2.4, count: 1, prob: 0.20 },
  ],
  craterAmp: 1, depthK: 1.05, rampart: 0,
  relief: 130, groove: 17, fine: 1, albedoK: 1, halo: 0.30,
  height: hSmall,
  tint: tintMoonlet,
};
