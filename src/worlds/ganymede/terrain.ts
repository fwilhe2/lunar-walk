import type { TerrainDef } from '../types';
import { cellRnd, craterAt, rayBrightness } from '../../kernel/craters';
import { fbm, smoothT, sstep, valueNoise } from '../../kernel/noise';
import { TN_Z } from '../../kernel/terrain';
import { WORLD } from '../../kernel/world';
import { CA_AP, CA_KN, callistoKnobs, knobCacheReset } from '../common/knobs';

/* ── Ganymede ───────────────────────────────────────────────────
   Dark terrain and bright terrain. The dark is the old crust: heavily
   cratered, dark lag in the lows and frost on the crests as on
   Callisto, a few knobs, and furrows — troughs kilometres wide with
   raised rims, running for hundreds of kilometres in great arcs,
   the oldest tectonics on the moon. The bright terrain is where the
   crust pulled apart and was resurfaced, in sulci — bands tens of
   kilometres wide, set a few hundred metres below the dark terrain
   they cut through, and grooved along their length: ridges and troughs
   at a wavelength of 3–10 km and a few hundred metres of relief, often
   tilted blocks, sawtooth in section, with finer grooves a kilometre
   apart on them (Pappalardo et al. 1998, 2004). Inside a sulcus the
   grooves come in sets, each a domain with its own trend, cut off
   sharply where the next begins.

   Sulci are drawn in lanes, one band at most per lane and all of it
   kept inside, groove sets in patches along the band. GA_M is how
   much sulcus there is at the last query point, GA_GT where on a
   groove (0 trough, 1 crest), for the colour pass. GA_OX/OZ put the
   site in a sulcus three kilometres inside its western margin, the
   grooves running across the view east toward Jupiter and the dark
   terrain's edge behind. */
var GA_A = 1.75, GA_C = Math.cos(GA_A), GA_S = Math.sin(GA_A), GA_LANE = 110000, GA_PL = 22000;
var GA_OX = 270900, GA_OZ = 500;
var GA_M = 0, GA_GT = 0.5;
// One groove set: the height it makes at (sl, tt), which are along
// and across the band, local to the patch and so never large.
function gaGrooves(pi: number, li: number, sl: number, tt: number) {
  var b = (cellRnd(pi, li, 69, 0) - 0.5) * 1.1;
  var u = tt * Math.cos(b) + sl * Math.sin(b);
  var lam = 3000 + cellRnd(pi, li, 69, 1) * 6000, A = 150 + cellRnd(pi, li, 69, 2) * 300;
  var f = u / lam + cellRnd(pi, li, 69, 3) * 7; f -= Math.floor(f);
  // Tilted blocks: a long back slope and a steep face; or symmetric.
  var tb = cellRnd(pi, li, 69, 4);
  var p1 = tb < 0.55 ? (f < 0.78 ? smoothT(f / 0.78) : 1 - smoothT((f - 0.78) / 0.22))
                     : 1 - smoothT(Math.abs(f * 2 - 1));
  var lam2 = 700 + cellRnd(pi, li, 69, 5) * 800;
  var f2 = u / lam2; f2 -= Math.floor(f2);
  var p2 = 1 - Math.abs(f2 * 2 - 1); p2 = p2 * p2 * (3 - 2 * p2);
  var am = 0.55 + 0.45 * valueNoise(sl * 0.00018 + pi * 3.1, tt * 0.00011 + li);
  GA_GT = p1 * 0.7 + p2 * 0.3;
  return (A * (p1 - 0.5) + (30 + A * 0.25) * (p2 - 0.5)) * am;
}
function gaSulcus(x: number, z: number) {
  GA_M = 0; GA_GT = 0.5;
  var s = x * GA_C + z * GA_S, t = z * GA_C - x * GA_S;
  var li = Math.floor(t / GA_LANE);
  if (cellRnd(li, 0, 67, 0) > 0.8) return 0;
  var hw = 9000 + cellRnd(li, 0, 67, 1) * 11000;
  // The band wanders a little; its widest reach, 20 + 6 + 2 + 1.5 km,
  // stays inside the 55 km half-lane.
  var cen = (li + 0.5) * GA_LANE + Math.sin(s * 0.00004 + li * 2.1) * 6000 + (valueNoise(s * 0.00002, li * 1.3) - 0.5) * 4000;
  var tt = t - cen, at = tt < 0 ? -tt : tt;
  if (at > hw + 1500) return 0;
  // A sharp margin, with a boundary trough just inside it.
  var m = 1 - sstep(hw - 900, hw + 400, at);
  GA_M = m;
  var e = (at - hw + 600) / 700;
  var h = -260 * m - 90 * Math.exp(-e * e);
  if (m <= 0) return h;
  var pf = s / GA_PL, pi = Math.floor(pf), fr = pf - pi;
  var g = gaGrooves(pi, li, s - (pi + 0.5) * GA_PL, tt), gt = GA_GT;
  // Where one set meets the next, the younger cuts the older off over
  // a few hundred metres.
  if (fr > 0.97) { var w1 = sstep(0.97, 1, fr); var g1 = gaGrooves(pi + 1, li, s - (pi + 1.5) * GA_PL, tt); g += (g1 - g) * w1; gt += (GA_GT - gt) * w1; }
  else if (fr < 0.03) { var w0 = 1 - sstep(0, 0.03, fr); var g0 = gaGrooves(pi - 1, li, s - (pi - 0.5) * GA_PL, tt); g += (g0 - g) * w0 * 0.5; gt += (GA_GT - gt) * w0 * 0.5; }
  GA_GT = gt;
  // Grooves fade out into the margin.
  return h + g * sstep(hw + 200, hw - 2500, at);
}
// Furrows on the dark terrain: arcuate troughs a few kilometres wide
// with raised rims, one at most per 60 km lane.
var GA_FC = Math.cos(0.35), GA_FS = Math.sin(0.35);
function gaFurrow(x: number, z: number) {
  var s = x * GA_FC + z * GA_FS, t = z * GA_FC - x * GA_FS + s * s * 1.2e-7;
  var li = Math.floor(t / 60000);
  if (cellRnd(li, 0, 73, 0) > 0.5) return 0;
  var cen = (li + 0.5) * 60000 + (valueNoise(s * 0.00003, li * 2.7) - 0.5) * 16000;
  var w = 2000 + cellRnd(li, 0, 73, 1) * 2500, d = 180 + cellRnd(li, 0, 73, 2) * 250;
  var a = (t - cen) / w; if (a < 0) a = -a;
  if (a > 2.2) return 0;
  return -d * (1 - sstep(0.5, 1.05, a)) + d * 0.3 * Math.exp(-(a - 1.25) * (a - 1.25) * 9);
}

function hGanymede(x0: number, z0: number) {
  var x = x0 + GA_OX, z = z0 + GA_OZ;
  var h = (fbm(x * 0.00003 + 2, z * 0.00003, 4) - 0.5) * 800;
  var sul = gaSulcus(x, z), m = GA_M, dk = 1 - m;
  h += sul;
  h += (fbm(x * 0.0003 - 5, z * 0.0003 + 1, 3) - 0.5) * (25 + 40 * dk);
  h += (fbm(x * 0.003 + 7, z * 0.003 - 2, 2) - 0.5) * 6;
  h += (fbm(x * 0.03, z * 0.03, 2) - 0.5) * 0.9;
  h += (fbm(x * 0.15 + 2, z * 0.15, 2) - 0.5) * 0.15;
  if (dk > 0) h += gaFurrow(x, z) * dk;
  h += callistoKnobs(x0, z0);
  return h + craterAt(x0, z0);
}

function tintGanymede(x: number, z: number, h: number, slope: number, fresh: number, dark: number, yel: number, hol: number, out: number[]) {
  var v;
  // Ganymede's dark terrain is Callisto's lag, a little brighter —
  // about 0.3 — with the same frost on crests and poleward slopes. The
  // bright terrain is cleaner ice, about 0.5, and in the grooves the
  // dark material has slid off the crests and walls into the troughs,
  // so the ridges read bright and the troughs grey (Prockter et al.
  // 1998). Bright rays and halos round fresh craters, on both.
  gaSulcus(x + GA_OX, z + GA_OZ);
  var m = GA_M, gt = GA_GT;
  callistoKnobs(x, z, true);
  var n1 = valueNoise(x * 0.0007 + 1.3, z * 0.0007 - 4.4), n2 = valueNoise(x * 0.045, z * 0.045);
  var cl = fresh * WORLD.halo! + rayBrightness(x, z);
  var fz = sstep(0.06, 0.32, TN_Z + (n2 - 0.5) * 0.12) * (0.5 + 0.5 * n1);
  var dkv = (0.85 + (n1 - 0.5) * 0.2) * (0.93 + n2 * 0.14) * (1 - CA_AP * 0.2);
  var brv = (1.75 + (n1 - 0.5) * 0.2 + (gt - 0.5) * 0.5 + slope * 0.4) * (0.95 + n2 * 0.1);
  v = dkv + (brv - dkv) * m;
  out[0] = v * (1.05 - m * 0.06); out[1] = v; out[2] = v * (0.91 + m * 0.10);
  var fr = (fz + sstep(0.4, 0.75, CA_KN + (n2 - 0.5) * 0.25) * 0.9 + sstep(0.3, 0.6, slope) * 0.3) * (1 - m * 0.6) + cl;
  fr = fr > 1 ? 1 : fr;
  var fv = 2.1 + (n2 - 0.5) * 0.3;
  out[0] += (fv - out[0]) * fr; out[1] += (fv - out[1]) * fr; out[2] += (fv * 1.03 - out[2]) * fr;
}

/* Ganymede, the largest moon in the solar system: two terrains. A
   third of it is ancient dark terrain, cratered nearly as densely as
   Callisto; the rest was torn open and resurfaced as bright grooved
   terrain, which is younger and carries a few times fewer craters
   (Zahnle et al. 2003). The classes flagged old only stand on the
   dark terrain. Small craters are not as depleted as on Callisto.
   Transition a little under Callisto's — more gravity — and central
   pits again past ~30 km. See hGanymede(). Seed: 7 January 1610, the
   first night Galileo turned a telescope on Jupiter and saw three of
   its moons, Ganymede among them. */
export const terrain: TerrainDef = {
  id: 'ganymede', seed: 16100107,
  g: 1.428, R: 2634100,
  lander: [24.6, -17.2],
  craters: [
    { cell: 65536, salt:  7, rMin: 8000, rMax: 30000, count: 1, prob: 0.35, ageK: 1.1, old: 1 },
    { cell: 16384, salt: 23, rMin: 2000, rMax:  8000, count: 1, prob: 0.60, ageK: 1.2, rays: 1 },
    { cell:  4096, salt: 47, rMin:  500, rMax:  2000, count: 2, prob: 0.60, ageK: 2.0, old: 1, knob: 1 },
    { cell:  4096, salt: 31, rMin:  500, rMax:  2000, count: 1, prob: 0.25, ageK: 1.5 },
    { cell:  1024, salt: 41, rMin:  120, rMax:   500, count: 1, prob: 0.45, ageK: 2.2, rocks: 1 },
    { cell:   256, salt: 53, rMin:   25, rMax:   120, count: 1, prob: 0.30, ageK: 2.4, rocks: 1 },
    { cell:    48, salt: 61, rMin:    4, rMax:    20, count: 1, prob: 0.25, ageK: 2.5, rocks: 1 },
  ],
  craterAmp: 1, depthK: 0.85, rampart: 0, halo: 0.55,
  Dtr: 2500, pitD: 30000, knobP: 0.5,
  height: hGanymede,
  tint: tintGanymede,
  // Old crater classes and knobs predate the grooved terrain.
  oldVeto(px, pz) { gaSulcus(px + GA_OX, pz + GA_OZ); return GA_M > 0.5; },
  knobMask(px, pz) { gaSulcus(px + GA_OX, pz + GA_OZ); return 1 - GA_M; },
  reset() { knobCacheReset(); },
};
