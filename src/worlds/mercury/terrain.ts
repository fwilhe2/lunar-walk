import type { TerrainDef } from '../types';
import { AUX } from '../../kernel/terrain';
import { ccSlot, cellCraters, cellRnd, craterAt, rayBrightness } from '../../kernel/craters';
import { fbm, hash2, sstep, valueNoise } from '../../kernel/noise';
import { CRATER_LAYERS, HOL_LI, WORLD } from '../../kernel/world';

/* ── Mercury ────────────────────────────────────────────────────
   Most of Mercury is intercrater plains: old, rolling ground between
   and over the craters, laid down early and cratered ever since. In
   patches it gives way to smooth plains, lava floods younger and
   flatter than anything around them, wrinkled by ridges where they
   shrank as they cooled.

   Then the whole planet shrank. As its iron core cooled Mercury lost
   some seven kilometres of radius (Byrne et al. 2014), and the crust,
   with nowhere to go, broke in thrust faults: lobate scarps, the
   landform Mercury is known for. One side of the fault rode up over
   the other, so each is a cliff a kilometre or two high facing one
   way, with a long gentle back behind it, running for hundreds of
   kilometres in arcs that bulge toward the lower side — Discovery
   Rupes, Beagle Rupes, Enterprise Rupes. They cut straight through
   craters, which is how anyone knows they are young. Drawn in lanes,
   the same trick as Charon's graben, one scarp at most per lane, face
   and back limb kept inside it.

   And the strangest thing on Mercury is small: hollows. Shallow,
   flat-floored pits with no rims, tens of metres to a kilometre
   across and a few tens of metres deep, bright and faintly blue, in
   clusters on crater floors, walls and peaks — where some volatile in
   the rock is still subliming away into space (Blewett et al. 2011).
   They are among the youngest things on the planet; some may be
   growing now. Each cluster is a field of cells; a hollow's outline is
   ragged, and where two meet they merge rather than stack. MH_HOL is
   how much of one is at the last query point, for the colour pass. */
var MH_LANE = 70000;
var MH_TC = Math.cos(0.22), MH_TS = Math.sin(0.22);    // scarp strike, a little east of north
var MH_HCELL = 260;                                    // hollow cell
// The site: out on intercrater plains seven kilometres west of the
// face of a scarp a kilometre and a half high, which the opening view
// looks at, among craters full of hollows. Craters stay put, so the
// spawn fade holds.
var MH_OX = -107750, MH_OZ = -400000;
export var MH_HOL = 0;

// Where the smooth plains lie. Shared with the colour pass: they are
// the brighter, redder unit.
function mercPlains(x: number, z: number) {
  return sstep(0.55, 0.68, fbm(x * 0.000032 + 4.4, z * 0.000032 - 1.7, 3));
}

// Where hollows gather: in craters (the classes flagged hol), on their
// floors, walls and peaks, and only in some of them — a coarse field
// of provinces decides which. 1 on a crater floor inside one.
function mercHollowField(x: number, z: number) {
  var f = sstep(0.55, 0.65, fbm(x * 0.00006 - 7.1, z * 0.00006 + 2.3, 2));
  if (f <= 0) return 0;
  var k = 0;
  for (var hi = 0; hi < HOL_LI.length; hi++) {
    var li = HOL_LI[hi]!, L = CRATER_LAYERS[li]!;
    var ccx = Math.floor(x / L.cell), ccz = Math.floor(z / L.cell);
    for (var dz = -1; dz <= 1; dz++) {
      for (var dx = -1; dx <= 1; dx++) {
        var list = cellCraters(li, ccx + dx, ccz + dz);
        for (var i = 0; i < list.length; i++) {
          var c = list[i]!, ox = x - c.x, oz = z - c.z, rr = c.r * 1.15;
          if (ox * ox + oz * oz > rr * rr) continue;
          // Fresh craters have not had time to grow any; old ones have
          // lost theirs to the regolith.
          var q = (1 - sstep(0.8, 1.15, Math.sqrt(ox * ox + oz * oz) / c.r)) * sstep(0.2, 0.45, c.age) * (1 - sstep(0.85, 0.97, c.age));
          if (q > k) k = q;
        }
      }
    }
  }
  return f * k;
}

// Each lane's constants, for the lane last asked about: a mesh build
// stays in one lane for thousands of queries, and the seven hashes cost
// as much as the rest of the scarp together. A pure function of the
// lane, so a miss just recomputes.
var SC_LI = 0.5, SC = { on: false, H: 0, k: 0, A: 0, ph: 0, fr: 0, lb: 0 };
function scarpLane(li: number) {
  if (li === SC_LI) return SC;
  SC_LI = li;
  SC.on = cellRnd(li, 0, 97, 0) <= 0.6;
  SC.H = 700 + cellRnd(li, 0, 97, 1) * 1100;
  SC.k = 0.00010 + cellRnd(li, 0, 97, 2) * 0.00008;
  SC.A = 900 + cellRnd(li, 0, 97, 3) * 1600;
  SC.ph = cellRnd(li, 0, 97, 4) * 6.28;
  SC.fr = (li + 0.16 + cellRnd(li, 0, 97, 5) * 0.1) * MH_LANE;
  SC.lb = 9000 + 4000 * cellRnd(li, 0, 97, 6);
  return SC;
}

function mercScarp(x: number, z: number) {
  var u = x * MH_TC + z * MH_TS, s = z * MH_TC - x * MH_TS;
  var li = Math.floor(u / MH_LANE);
  var P = scarpLane(li);
  if (!P.on) return 0;
  // A scarp runs for a few hundred kilometres, rising out of nothing
  // at each end, and its height wanders along it.
  var seg = sstep(0.34, 0.52, valueNoise(s * 0.000006 + li * 5.3, li * 0.71));
  if (seg <= 0) return 0;
  var H = P.H * seg * (0.7 + 0.3 * valueNoise(s * 0.00004, li * 2.9));
  // The trace: a broad swing over a hundred kilometres or so, and on it
  // arcs bulging toward the footwall (west), cusped between, of
  // uneven length.
  var ph = s * P.k + valueNoise(s * 0.000025, li * 3.7) * 4 + P.ph;
  var sn = Math.sin(ph);
  var fr = P.fr + P.A * (1 - (sn < 0 ? -sn : sn))
         + (valueNoise(s * 0.0000085 + li * 7.9, li * 1.3) - 0.5) * 16000;
  // The slope of the arcs along strike, so the distance is taken across
  // the scarp and not across the lane — a face running at an angle would
  // otherwise come out wider than one running straight. The broad swing
  // turns it by ten degrees at most, which is left out.
  var sl = P.A * P.k * Math.cos(ph) * (sn < 0 ? 1 : -1);
  var t = (u - fr) / Math.sqrt(1 + sl * sl);
  // Face: a kilometre of rise over two or three, then the crest, and a
  // back limb that sags away over tens. The widest it reaches, front
  // to taper, stays inside the lane.
  var wf = 800 + H * 2;
  if (t < -0.15 * wf || t > 32000) return 0;
  var g = sstep(-0.15 * wf, wf, t);
  if (t > wf) g *= Math.exp(-(t - wf) / P.lb) * (1 - sstep(22000, 32000, t));
  return H * g;
}

/* One hollow per cell at most, decided at its own centre — whether a
   hollow province and a crater are there — so it is a pure function of
   the cell and cached like the craters are, direct-mapped: the crater
   test behind it scans three classes. false: no hollow in that cell. */
var HC_BITS = 12, HC_SIZE = 1 << HC_BITS;
var hcX = new Int32Array(HC_SIZE), hcZ = new Int32Array(HC_SIZE), hcL = new Array(HC_SIZE).fill(null);
function hollowCacheReset() { hcL.fill(null); }
function hollowCell(ix: number, iz: number) {
  var slot = ccSlot(ix, iz, HC_BITS);
  var hit = hcL[slot];
  if (hit !== null && hcX[slot] === ix && hcZ[slot] === iz) return hit;
  var out: false | { x: number; z: number; r: number; dep: number } = false;
  var px = (ix + 0.1 + cellRnd(ix, iz, 59, 2) * 0.8) * MH_HCELL;
  var pz = (iz + 0.1 + cellRnd(ix, iz, 59, 3) * 0.8) * MH_HCELL;
  var f = mercHollowField(px, pz);
  if (f > 0 && cellRnd(ix, iz, 59, 0) <= f * 0.8) {
    var r = 35 + Math.pow(cellRnd(ix, iz, 59, 1), 1.6) * 190 * (0.5 + 0.5 * f);
    // Steep-walled, but not sheer, and the small ones shallower.
    out = { x: px, z: pz, r: r, dep: Math.min(14 + cellRnd(ix, iz, 59, 4) * 22, r * 0.3) };
  }
  hcX[slot] = ix; hcZ[slot] = iz; hcL[slot] = out;
  return out;
}

function mercHollows(x: number, z: number) {
  MH_HOL = 0;
  // Hollows only stand inside a province (fbm over 0.55), and reach at
  // most 400 m from their centres, over which the field can fall by
  // 0.07 at the steepest: past that margin there are none to find.
  if (fbm(x * 0.00006 - 7.1, z * 0.00006 + 2.3, 2) < 0.48) return 0;
  var cx = Math.floor(x / MH_HCELL), cz = Math.floor(z / MH_HCELL);
  var best = 0, halo = 0;
  for (var dz = -1; dz <= 1; dz++) {
    for (var dx = -1; dx <= 1; dx++) {
      var c = hollowCell(cx + dx, cz + dz);
      if (c === false) continue;
      var ox = x - c.x, oz = z - c.z;
      var d2 = ox * ox + oz * oz;
      if (d2 > c.r * c.r * 3.2) continue;
      // Ragged outlines: the edge wanders by a third of the radius.
      var d = Math.sqrt(d2) / c.r * (1 + (valueNoise(x * 0.018 + (cx + dx) * 3.1, z * 0.018 - (cz + dz) * 2.7) - 0.5) * 0.7);
      var dep = c.dep * (1 - sstep(0.62, 1.0, d));
      if (dep > best) best = dep;
      var hk = 1 - sstep(0.9, 1.75, d);
      if (hk > halo) halo = hk;
    }
  }
  // Floors bright, and a halo of the same bright stuff around them.
  MH_HOL = best > 0 ? 0.6 + 0.4 * (best / 36) : halo * 0.55;
  if (MH_HOL > 1) MH_HOL = 1;
  // Merged, not stacked: the deepest of the pits here.
  return -best;
}

function mercWrinkles(x: number, z: number) {
  var u = (x * MH_TS - z * MH_TC) / 11000 + valueNoise(x * 0.00012, z * 0.00012) * 1.7;
  var lane = Math.floor(u);
  if (hash2(lane, 733) > 0.55) return 0;
  var tt = u - lane - 0.5;
  // Asymmetric, like the lunar ones: a broad arch and a narrow ridge on it.
  return Math.exp(-tt * tt * 30) * (40 + hash2(lane, 734) * 60) + Math.exp(-(tt - 0.04) * (tt - 0.04) * 400) * (18 + hash2(lane, 735) * 30);
}

function hMercury(x0: number, z0: number) {
  var x = x0 + MH_OX, z = z0 + MH_OZ;
  var nx = x * 0.00012, nz = z * 0.00012;
  var pk = mercPlains(x, z), ik = 1 - pk;
  // Intercrater plains roll over tens of kilometres; the floods have
  // drowned most of that.
  var h = (fbm(nx, nz, 4) - 0.5) * 700 * (1 - 0.7 * pk) - pk * 150;
  h += (fbm(nx * 8 + 13, nz * 8 - 6, 3) - 0.5) * 90 * (0.3 + 0.7 * ik);   // hummocky ground
  h += (fbm(x * 0.0021 - 8, z * 0.0021 + 3, 3) - 0.5) * 12;             // swales
  h += (fbm(x * 0.012, z * 0.012, 2) - 0.5) * 1.5;                       // metre relief
  h += (fbm(x * 0.03 + 5, z * 0.03 - 2, 2) - 0.5) * 0.6;                 // regolith grain
  if (pk > 0.004) h += mercWrinkles(x, z) * pk;
  h += mercScarp(x, z);
  // Hollows grow in craters, so they stay with the craters, unshifted.
  h += mercHollows(x0, z0);
  return h + craterAt(x0, z0);
}

function tintMercury(x: number, z: number, h: number, slope: number, fresh: number, dark: number, yel: number, hol: number, out: number[]) {
  var v;
  // Mercury is grey, a little brighter than the Moon on average and
  // a little less brown, and its colour units are subtle: the smooth
  // plains are brighter and redder, and the low-reflectance material
  // — dark, bluish, rich in graphite (Peplowski et al. 2016), dug up
  // from depth by craters — lies in broad patches over the rest.
  // Fresh craters are brighter and bluer still, rays and all, and
  // brightest of anything are the hollows, bluish-white, with a halo
  // of the same stuff round every cluster.
  var pl = mercPlains(x + MH_OX, z + MH_OZ);
  var lrm = sstep(0.52, 0.7, fbm(x * 0.00011 - 6.1, z * 0.00011 + 3.9, 3)) * (1 - pl);
  var cl = fresh * WORLD.halo! + rayBrightness(x, z);
  v = 0.78 + pl * 0.10 - lrm * 0.20 + slope * 0.26 + cl;
  v *= 0.9 + valueNoise(x * 0.0012 + 3, z * 0.0012) * 0.12 + valueNoise(x * 0.07, z * 0.07) * 0.08;
  var hb = hol * hol;
  v *= 1 + hb * 1.3;
  v = v < 0.35 ? 0.35 : v > 2.2 ? 2.2 : v;
  var blue = lrm * 0.05 + cl * 0.04 + hb * 0.10 - pl * 0.035;
  out[0] = v * (1.012 - blue * 0.6); out[1] = v; out[2] = v * (0.965 + blue);
}

/* Mercury: the Moon's cratering under two and a third times the
   gravity. Everything thrown out lands closer — ejecta blankets are
   narrower, and the secondaries fall in dense clusters and chains
   near their parent instead of spreading thin (Gault et al. 1975),
   which is what the clumped class draws. The equilibrium population
   at small sizes is the Moon's; the bowls are as deep for their
   width. Fresh craters wear bright rays, and Mercury has some of the
   longest in the solar system. See hMercury(). */
export const terrain: TerrainDef = {
  id: 'mercury', seed: 19740329,
  g: 3.70, R: 2439700,
  lander: [33.9, -3.1],
  craters: [
    { cell: 40960, salt: 35, rMin: 2500, rMax: 15000, count: 1, prob: 0.45, ageK: 1.0, rays: 1, hol: 1 },
    { cell: 2560, salt:  7, rMin: 230, rMax: 620, count: 1, prob: 0.40, ageK: 1.3, rays: 1, hol: 1 },
    { cell:  640, salt: 11, rMin:  60, rMax: 230, count: 2, prob: 0.50, ageK: 1.6, rocks: 1, rays: 1, hol: 1 },
    { cell:  320, salt: 19, rMin:  10, rMax:  40, count: 3, prob: 0.85, ageK: 1.5, clump: 7000, rocks: 1 },
    { cell:  160, salt: 23, rMin:  16, rMax:  60, count: 2, prob: 0.70, ageK: 2.0, rocks: 1 },
    { cell:   40, salt: 37, rMin:   4, rMax:  16, count: 2, prob: 0.62, ageK: 2.4, rocks: 1 },
    { cell:    8, salt: 53, rMin: 1.6, rMax:   4, count: 1, prob: 0.40, ageK: 2.6, rocks: 1 },
    { cell:  3.2, salt: 67, rMin: 0.8, rMax: 1.6, count: 1, prob: 0.32, ageK: 2.8 },
  ],
  craterAmp: 1, depthK: 1, rampart: 0,
  // Pike (1988) put the transition at about 10 km, against 15–20 on
  // the Moon: the stronger gravity collapses a bowl sooner. Set in the
  // same proportion to it as the Moon's is.
  Dtr: 7000,
  halo: 0.5,
  height(x, z) { var h = hMercury(x, z); AUX[2] = MH_HOL; return h; },
  tint: tintMercury,
  reset() { hollowCacheReset(); SC_LI = 0.5; },
};
