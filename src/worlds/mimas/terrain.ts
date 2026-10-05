import type { TerrainDef } from '../types';
import { cellRnd, craterAt } from '../../kernel/craters';
import { fbm, sstep, valueNoise } from '../../kernel/noise';
import { WORLD } from '../../kernel/world';

/* ── Mimas ──────────────────────────────────────────────────────
   Craters on craters, and under them a regional swell of kilometres —
   a body 400 km across holds relief like that — with a few troughs, the
   chasmata, cutting across in long shallow lines. */
function hMimas(x: number, z: number) {
  var h = (fbm(x * 0.00002 + 1, z * 0.00002 - 3, 4) - 0.5) * 3000;
  h += (fbm(x * 0.0003 - 4, z * 0.0003 + 2, 3) - 0.5) * 90;
  h += (fbm(x * 0.003 + 6, z * 0.003, 2) - 0.5) * 8;
  h += (fbm(x * 0.03, z * 0.03 - 2, 2) - 0.5) * 1.0;
  h += (fbm(x * 0.15 + 2, z * 0.15, 2) - 0.5) * 0.16;
  // A chasma: a trough a couple of kilometres wide and some hundreds of
  // metres deep, one at most per 40 km lane.
  var t = z * 0.94 - x * 0.34, li = Math.floor(t / 40000);
  if (cellRnd(li, 0, 101, 0) < 0.5) {
    var a = (t - (li + 0.5) * 40000 - (valueNoise(x * 0.00002, li) - 0.5) * 12000) / 1500;
    if (a > -2 && a < 2) h -= 300 * Math.exp(-a * a * 1.5) * sstep(0.3, 0.5, valueNoise(x * 0.00001, li * 1.7 + 3));
  }
  return h + craterAt(x, z);
}

function tintMimas(x: number, z: number, h: number, slope: number, fresh: number, dark: number, yel: number, hol: number, out: number[]) {
  var v;
  // Mimas is clean water ice, the second-brightest of Saturn's inner
  // moons after Enceladus, a little grey; crater walls a shade bluer
  // where fresher ice shows.
  var n1 = valueNoise(x * 0.0008 + 2, z * 0.0008 - 1), n2 = valueNoise(x * 0.05, z * 0.05);
  v = (1.0 + (n1 - 0.5) * 0.08 + (n2 - 0.5) * 0.06) * (1 + slope * 0.12 + fresh * WORLD.halo!);
  out[0] = v * (0.985 - slope * 0.02); out[1] = v * 0.993; out[2] = v * (1.0 + slope * 0.02);
}

/* Mimas: the smallest body known to be round by its own gravity, and
   as cratered as anything that size can be — saturated, the bowls
   deep and fresh-edged, nothing to soften them (Schenk 1989). On this,
   the side facing Saturn, there is no Herschel: that is on the leading
   face, where Saturn is below the horizon. In gravity this weak no
   crater in reach is complex. Seed: 17 September 1789, when William
   Herschel found it. */
export const terrain: TerrainDef = {
  id: 'mimas', seed: 17890917,
  g: 0.064, R: 198200,
  lander: [36.9, -9.2],
  craters: [
    { cell: 32768, salt:  7, rMin: 4000, rMax: 16000, count: 1, prob: 0.60, ageK: 1.3 },
    { cell:  8192, salt: 13, rMin: 1000, rMax:  4000, count: 2, prob: 0.85, ageK: 1.6 },
    { cell:  2048, salt: 29, rMin:  250, rMax:  1000, count: 2, prob: 0.85, ageK: 1.9 },
    { cell:   512, salt: 41, rMin:   60, rMax:   250, count: 2, prob: 0.75, ageK: 2.2, rocks: 1 },
    { cell:   128, salt: 53, rMin:   15, rMax:    60, count: 2, prob: 0.65, ageK: 2.4, rocks: 1 },
    { cell:    32, salt: 61, rMin:    4, rMax:    15, count: 1, prob: 0.40, ageK: 2.5, rocks: 1 },
  ],
  craterAmp: 1, depthK: 1.0, rampart: 0, halo: 0.2,
  Dtr: 40000,
  height: hMimas,
  tint: tintMimas,
};
