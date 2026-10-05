import type { TerrainDef } from '../types';
import { cellRnd, craterAt } from '../../kernel/craters';
import { fbm, sstep, valueNoise } from '../../kernel/noise';
import { WORLD } from '../../kernel/world';

/* ── Dione ──────────────────────────────────────────────────────
   Voyager saw bright wisps across Dione's trailing face and took them
   for frost from vents; Cassini came close and found cliffs. The wisps
   are chasmata — sets of parallel graben, troughs a kilometre or two
   wide between fault scarps hundreds of metres high — whose walls are
   fresh, clean ice, bright against plains darkened by the particles
   Saturn's magnetosphere sweeps onto that side (Wagner et al. 2006).
   Two sets cross here, one younger than the other, in lanes of 5 and 7
   km, segment by segment along strike as faults run; the site is on a
   rim, a cliff dropping in front of you. */
var DI_OX = -24800, DI_OZ = -2000;
var DI_F = [[Math.cos(0.25), Math.sin(0.25), 5200, 0.42], [Math.cos(1.35), Math.sin(1.35), 7000, 0.3]];
function diGraben(x, z) {
  var best = 0;
  for (var k = 0; k < 2; k++) {
    var F = DI_F[k], s = x * F[0] + z * F[1], t = z * F[0] - x * F[1];
    var L = F[2], li = Math.floor(t / L);
    if (cellRnd(li, k, 103, 0) > F[3]) continue;
    // Faults run in segments that overlap and step aside.
    var sg = s / 9000 + cellRnd(li, k, 103, 1) * 7, si = Math.floor(sg), sf = sg - si;
    var on = cellRnd(si, li * 7 + k, 103, 2) < 0.7 ? 1 : 0;
    if (!on) continue;
    var taper = sstep(0, 0.15, sf) * (1 - sstep(0.85, 1, sf));
    var cen = (li + 0.5) * L + (cellRnd(si, li * 7 + k, 103, 3) - 0.5) * L * 0.3;
    var w = 500 + 700 * cellRnd(li, k, 103, 4), D = (200 + 350 * cellRnd(si, li * 7 + k, 103, 5)) * taper;
    // Walls about 40°: a scarp as wide as it is deep, on each side.
    var ww = D * 1.1 + 60;
    var a = t - cen; if (a < 0) a = -a;
    if (a > w + ww) continue;
    var g = 1 - sstep(w, w + ww, a);
    if (D * g > best) best = D * g;
  }
  return -best;
}
function hDione(x0, z0) {
  var x = x0 + DI_OX, z = z0 + DI_OZ;
  var h = (fbm(x * 0.00002 + 3, z * 0.00002 - 1, 4) - 0.5) * 2200;
  h += (fbm(x * 0.0003 - 1, z * 0.0003 + 4, 3) - 0.5) * 70;
  h += (fbm(x * 0.003 + 2, z * 0.003 - 3, 2) - 0.5) * 7;
  h += (fbm(x * 0.03, z * 0.03 + 1, 2) - 0.5) * 0.9;
  h += (fbm(x * 0.15 - 3, z * 0.15, 2) - 0.5) * 0.15;
  h += diGraben(x, z);
  return h + craterAt(x0, z0);
}

function tintDione(x, z, h, slope, fresh, dark, yel, hol, out) {
  var v;
  // The trailing face is darkened and reddened by what Saturn's
  // magnetosphere sweeps onto it — plains about 0.5 against Dione's
  // 1.0 leading-side ice — and the chasma walls are clean, fresh ice,
  // the brightest thing in view: the wisps.
  var n1 = valueNoise(x * 0.0007 + 3, z * 0.0007 - 2), n2 = valueNoise(x * 0.05, z * 0.05);
  var cliff = sstep(0.35, 0.75, slope);
  v = (0.62 + (n1 - 0.5) * 0.1 + (n2 - 0.5) * 0.06 + fresh * WORLD.halo) * (1 - cliff) + (1.45 + (n2 - 0.5) * 0.1) * cliff;
  out[0] = v * (1.02 - cliff * 0.04); out[1] = v * (0.99 + cliff * 0.01); out[2] = v * (0.95 + cliff * 0.07);
}

/* Dione: cratered plains, fewer craters on the trailing side, where
   the site is, than on the leading, and cut by the chasmata. See
   hDione(). Seed: 21 March 1684, when Giovanni Cassini found it. */
export const terrain: TerrainDef = {
  id: 'dione', seed: 16840321,
  g: 0.232, R: 561400,
  lander: [-17.2, 27],
  craters: [
    { cell: 40960, salt:  7, rMin: 5000, rMax: 20000, count: 1, prob: 0.35, ageK: 1.3 },
    { cell: 10240, salt: 13, rMin: 1200, rMax:  5000, count: 1, prob: 0.60, ageK: 1.6 },
    { cell:  2560, salt: 29, rMin:  300, rMax:  1200, count: 2, prob: 0.60, ageK: 2.0 },
    { cell:   640, salt: 41, rMin:   60, rMax:   300, count: 2, prob: 0.55, ageK: 2.2, rocks: 1 },
    { cell:   160, salt: 53, rMin:   15, rMax:    60, count: 1, prob: 0.50, ageK: 2.4, rocks: 1 },
  ],
  craterAmp: 1, depthK: 0.9, rampart: 0, halo: 0.3,
  Dtr: 20000,
  height: hDione,
  tint: tintDione,
};
