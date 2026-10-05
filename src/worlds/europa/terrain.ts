import type { TerrainDef } from '../types';
import { AUX } from '../../kernel/terrain';
import { craterAt, rayBrightness } from '../../kernel/craters';
import { fbm, hash2, smoothT, sstep, valueNoise } from '../../kernel/noise';
import { WORLD } from '../../kernel/world';

/* ── Europa ─────────────────────────────────────────────────────
   Twenty kilometres of ice over an ocean, flexed twice a day by
   Jupiter's tide, and cracked by it everywhere. Almost nothing
   here was made by an impact. What you walk on is ridged plains:
   generation after generation of ridges, each one grown along a
   crack that cut through everything already there, so every
   younger ridge buries the older ones where its flanks meet them.
   The newest are double ridges — two crests with a trough between
   them, a hundred to three hundred metres high and one or two
   kilometres across, running straight for hundreds of kilometres.

   Three things break the plains up:
   - bands, where the shell pulled apart and the gap filled from
     below with finely grooved new ice, kilometres wide;
   - chaos, where it melted through or nearly: the old plains
     broke into rafts that drifted and turned in a slushy matrix
     and froze again, still carrying their ridges, now out of line
     with their neighbours — the jigsaw Conamara is famous for;
   - lenticulae, domes and pits and dark spots a few kilometres
     across, spaced a dozen or so apart, most with a small chaos on
     top: diapirs of warmer ice rising through the shell.

   Families are the ridge generations, oldest first. Each is a set
   of parallel lanes holding at most one ridge, kept wholly inside
   its lane so no lane boundary can ever leave a seam: bearing,
   spacing, presence, full width (min + spread), height (min +
   spread), central trough depth as a fraction of the crest. The
   background fabric is the first four, and which of them dominates
   changes from place to place (rg), as it does in every Galileo
   close-up; the last is young enough to wear the dark flanking
   margins of a triple band.                                       */
interface RidgeFamily {
  a: number; sp: number; p: number; w0: number; w1: number; h0: number; h1: number; tr: number;
  rg?: number; m: number;
  c: number; s: number; salt: number;
}
// The rows give the first eight (and rg, m where they differ); the loop
// below fills c, s, salt and m in before anything reads them, hence the cast.
var EU_FAM = [
  { a: 0.42, sp: 230,  p: 0.80, w0: 70,   w1: 90,   h0: 3,   h1: 7,   tr: 0.00, rg: 1 },
  { a: 1.63, sp: 290,  p: 0.75, w0: 80,   w1: 110,  h0: 4,   h1: 9,   tr: 0.25, rg: 1 },
  { a: 2.71, sp: 190,  p: 0.70, w0: 60,   w1: 70,   h0: 2.5, h1: 6,   tr: 0.00, rg: 1 },
  { a: 2.98, sp: 1150, p: 0.45, w0: 220,  w1: 300,  h0: 14,  h1: 40,  tr: 0.45, rg: 1 },
  { a: 1.05, sp: 2300, p: 0.38, w0: 450,  w1: 650,  h0: 45,  h1: 110, tr: 0.55 },
  { a: 2.20, sp: 3700, p: 0.45, w0: 650,  w1: 850,  h0: 80,  h1: 140, tr: 0.60 },
  { a: 0.13, sp: 9500, p: 0.50, w0: 1000, w1: 1100, h0: 130, h1: 150, tr: 0.62, m: 2.6 },
] as RidgeFamily[];
for (var fi = 0; fi < EU_FAM.length; fi++) {
  EU_FAM[fi]!.c = Math.cos(EU_FAM[fi]!.a);
  EU_FAM[fi]!.s = Math.sin(EU_FAM[fi]!.a);
  EU_FAM[fi]!.salt = 311 + fi * 97;
  EU_FAM[fi]!.m = EU_FAM[fi]!.m || 1;   // reach, in half-widths: > 1 for dark margins
}
var EU_BAND_C = Math.cos(2.55), EU_BAND_S = Math.sin(2.55), EU_BAND_SP = 26000;
var EU_RAFT = 1500;        // chaos raft cell
var EU_BLOCK = 170;        // matrix block cell
var EU_LENT = 14000;       // lenticula cell

// Side outputs for the colour pass, like CR_ALB. EU_DARK is how much
// non-ice material lies on the surface here, −1 (clean frost) to +1;
// EU_YEL how much of that is the yellow of irradiated sea salt.
export var EU_DARK = 0, EU_YEL = 0;

// Where the shell has broken into chaos. Shared with the colour pass.
function euChaos(x: number, z: number) {
  return fbm(x * 0.000055 + 2.7, z * 0.000055 - 8.4, 4);
}

// Ridge families [f0, f1) over warped coordinates, on top of h.
function euRidges(xw: number, zw: number, f0: number, f1: number, h: number) {
  for (var fi = f0; fi < f1; fi++) {
    var F = EU_FAM[fi]!;
    var u = (xw * F.c + zw * F.s) / F.sp;
    var lane = Math.floor(u);
    if (hash2(lane, F.salt) > F.p) continue;
    var hw = (F.w0 + F.w1 * hash2(lane, F.salt + 1)) * 0.5 / F.sp;
    var t0 = (hash2(lane, F.salt + 2) - 0.5) * (1 - 2 * hw * F.m) * 0.9;
    var s = (u - lane - 0.5 - t0) / hw;
    var as = s < 0 ? -s : s;
    if (as >= F.m) continue;
    if (F.m > 1) {
      // Triple band: dark margins either side of a young ridge, a
      // few kilometres across and brightest-edged at the crest — the
      // dark lineae that cross Europa in every picture from orbit.
      EU_DARK += 0.8 * sstep(F.m, 1.2, as) * sstep(0.35, 0.95, as);
    }
    if (as >= 1) continue;
    var along = (zw * F.c - xw * F.s) / (F.sp * 4 + 600);
    var amp = (F.h0 + F.h1 * hash2(lane, F.salt + 3))
            * (0.45 + valueNoise(along, lane * 1.37 + fi * 17.1));
    if (F.rg) amp *= sstep(0.25, 0.7, valueNoise(xw * 0.00022 + fi * 13.7, zw * 0.00022 - fi * 5.3)) * 1.4 + 0.1;
    var f = 1 - s * s; f *= f;
    var prof = F.tr > 0 ? f * (1 - F.tr * Math.exp(-s * s * 16)) : f;
    // A younger ridge buries the older relief its flanks rest on — all
    // of it if it is the bigger of the two, and only notches it if not.
    var foot = sstep(1, 0.72, as) * amp / (amp + 0.6 * (h < 0 ? -h : h) + 1e-3);
    h = h * (1 - foot) + amp * prof;
    if (F.m > 1) EU_DARK -= 0.3 * prof;
  }
  return h;
}

/* Everything older than the chaos, as relief above the local base:
   the ridge fabric, the bands, and the youngest ridges. A chaos raft
   is a piece of exactly this, moved. */
function euPre(x: number, z: number) {
  var wx = (valueNoise(x * 0.00012 + 3.1, z * 0.00012 - 7.7) - 0.5) * 1300
         + (valueNoise(x * 0.0007, z * 0.0007 + 5.5) - 0.5) * 260;
  var wz = (valueNoise(x * 0.00012 - 11.3, z * 0.00012 + 2.9) - 0.5) * 1300
         + (valueNoise(x * 0.0007 + 8.2, z * 0.0007) - 0.5) * 260;
  var xw = x + wx, zw = z + wz;
  EU_DARK = 0;
  var h = euRidges(xw, zw, 0, 6, 0);

  // A band: a strip of new ice kilometres wide, grooved along its
  // length and cutting straight through every ridge older than it.
  // Young ones are dark; old ones have been frosted over.
  var ub = (xw * EU_BAND_C + zw * EU_BAND_S) / EU_BAND_SP;
  var bl = Math.floor(ub);
  if (hash2(bl, 881) < 0.55) {
    var bhw = (2600 + hash2(bl, 882) * 2600) / EU_BAND_SP;
    var bt0 = (hash2(bl, 883) - 0.5) * (1 - 2.3 * bhw) * 0.9;
    var bs = (ub - bl - 0.5 - bt0) / bhw;
    var bas = bs < 0 ? -bs : bs;
    if (bas < 1.1) {
      var bfoot = sstep(1.1, 0.95, bas);
      var q = bs * bhw * EU_BAND_SP / 330;
      var qf = q - Math.floor(q);
      var grv = smoothT(qf < 0.5 ? qf * 2 : 2 - qf * 2);
      var hb = -14 + grv * 13 * (0.5 + valueNoise(q * 0.35, (xw * EU_BAND_S - zw * EU_BAND_C) * 0.0007))
             - 22 * Math.exp(-bs * bs * 60);
      h = h * (1 - bfoot) + hb * bfoot;
      EU_DARK = EU_DARK * (1 - bfoot) + bfoot * (hash2(bl, 884) < 0.6 ? 0.45 : -0.1);
    }
  }
  return euRidges(xw, zw, 6, 7, h);
}

// The landing site sits on the margin of a chaos, with the rafts
// between you and Jupiter: the tectonic field is shifted to put it
// there. Craters are left where they are, so the spawn fade holds.
var EU_OX = 1500, EU_OZ = 300;

function hEuropa(x0: number, z0: number) {
  var x = x0 + EU_OX, z = z0 + EU_OZ;
  var nx = x * 0.00012, nz = z * 0.00012;
  // The shell is flat at long wavelengths: a few hundred metres of
  // regional relief over tens of kilometres.
  var base = (fbm(nx, nz, 4) - 0.5) * 170;
  base += (fbm(nx * 7.3 + 13, nz * 7.3 - 6, 2) - 0.5) * 22;

  // Lenticulae. Most carry a small chaos on top, which feeds the
  // chaos mask below; spots are dark and flat, pits dark and low.
  // A centre sits in the middle 60% of its cell and reaches at most
  // 0.43 of a cell, so only the 2×2 cells nearest the point can touch it.
  var lc = 0, ldark = 0;
  var lcx = Math.floor(x / EU_LENT - 0.5), lcz = Math.floor(z / EU_LENT - 0.5);
  for (var dz = 0; dz <= 1; dz++) {
    for (var dx = 0; dx <= 1; dx++) {
      var ix = lcx + dx, iz = lcz + dz;
      var k0 = hash2(ix * 7 + 3, iz * 11 - 5);
      if (k0 > 0.55) continue;
      var cxl = (ix + 0.2 + 0.6 * hash2(ix * 13 + 1, iz * 5 + 9)) * EU_LENT;
      var czl = (iz + 0.2 + 0.6 * hash2(ix * 3 - 7, iz * 17 + 2)) * EU_LENT;
      var rl = 2200 + 3800 * hash2(ix * 19 + 4, iz * 23 - 1);
      var ox = x - cxl, oz = z - czl;
      var d2 = (ox * ox + oz * oz) / (rl * rl);
      if (d2 >= 1) continue;
      var pf = (1 - d2) * (1 - d2);
      var ty = k0 / 0.55;
      if (ty < 0.55) {            // dome, broken on top
        base += pf * (40 + 110 * hash2(ix * 29, iz * 31));
        lc = Math.max(lc, sstep(0.55, 0.18, d2) * 0.9);
      } else if (ty < 0.8) {      // pit
        base -= pf * (30 + 60 * hash2(ix * 29, iz * 31));
        ldark = Math.max(ldark, pf * 0.5);
      } else {                    // spot: a small chaos, flush
        lc = Math.max(lc, sstep(0.7, 0.3, d2));
      }
    }
  }

  var pre = euPre(x, z);
  var dark = EU_DARK + ldark;

  // Chaos. cmW grows slowly toward the interior and sets how far the
  // rafts have drifted and how much matrix has opened between them;
  // cmE is the region's edge, which is sharp, as the real ones are.
  var cf = euChaos(x, z);
  var cmE = Math.max(sstep(0.585, 0.600, cf), lc);
  var h;
  if (cmE > 0.004) {
    var cmW = Math.max(sstep(0.59, 0.72, cf), lc * 0.8);
    // The matrix: hummocky, lumpy ice, jumbled with blocks too small
    // to have kept their ridges, standing below the rafts.
    // Each octave on its own rotated lattice, or value noise's grid
    // shows through as rounded squares.
    var b1 = valueNoise((x * 0.88 + z * 0.47) / 260 + 4.1, (z * 0.88 - x * 0.47) / 260 - 2.2) * 2 - 1;
    var b2 = valueNoise((x * 0.36 - z * 0.93) / 95 - 7.3, (z * 0.36 + x * 0.93) / 95 + 1.9) * 2 - 1;
    var b3 = valueNoise((x * 0.97 + z * 0.24) / 34 + 2.6, (z * 0.97 - x * 0.24) / 34 - 8.8) * 2 - 1;
    var mat = (-47 + (1 - (b1 < 0 ? -b1 : b1)) * 42 + (1 - (b2 < 0 ? -b2 : b2)) * 14
                   + (1 - (b3 < 0 ? -b3 : b3)) * 4) * (0.35 + 0.65 * cmW);
    var bcx = Math.floor(x / EU_BLOCK), bcz = Math.floor(z / EU_BLOCK);
    var e1 = 1e9, e2 = 1e9, eh = 0;
    if (cmW > 0.01) for (var dz = -1; dz <= 1; dz++) {
      for (var dx = -1; dx <= 1; dx++) {
        var ix = bcx + dx, iz = bcz + dz;
        var ox = x - (ix + 0.15 + 0.7 * hash2(ix * 5 + 1, iz * 3 - 4)) * EU_BLOCK;
        var oz = z - (iz + 0.15 + 0.7 * hash2(ix * 7 - 2, iz * 11 + 6)) * EU_BLOCK;
        var dd = ox * ox + oz * oz;
        if (dd < e1) { e2 = e1; e1 = dd; eh = hash2(ix * 13 + 5, iz * 17 - 3); }
        else if (dd < e2) e2 = dd;
      }
    }
    if (cmW > 0.01) mat += (eh * 18 - 5) * sstep(4, 50, Math.sqrt(e2) - Math.sqrt(e1)) * cmW;

    // Rafts: the cells of a Voronoi diagram, so they tile the plane
    // and meet along straight fracture lines, shrinking apart as the
    // matrix opens. Each carries the plains that were there, turned
    // and shifted, lifted on its own freeboard with its own tilt.
    var rcx = Math.floor(x / EU_RAFT), rcz = Math.floor(z / EU_RAFT);
    var f1 = 1e9, f2 = 1e9, sx = 0, sz = 0, si = 0, sj = 0;
    for (var dz = -1; dz <= 1; dz++) {
      for (var dx = -1; dx <= 1; dx++) {
        var ix = rcx + dx, iz = rcz + dz;
        var px = (ix + 0.1 + 0.8 * hash2(ix * 31 + 7, iz * 17 - 1)) * EU_RAFT;
        var pz = (iz + 0.1 + 0.8 * hash2(ix * 11 - 3, iz * 29 + 5)) * EU_RAFT;
        var dd = (x - px) * (x - px) + (z - pz) * (z - pz);
        if (dd < f1) { f2 = f1; f1 = dd; sx = px; sz = pz; si = ix; sj = iz; }
        else if (dd < f2) f2 = dd;
      }
    }
    var gap = (Math.sqrt(f2) - Math.sqrt(f1)) * 0.5;
    var r1 = hash2(si * 3 + 1, sj * 7 + 2), r2 = hash2(si * 5 - 3, sj * 3 + 8);
    var half = cmW * EU_RAFT * (0.05 + 0.30 * r1);         // half the matrix gap
    var raft = sstep(half, half + 150, gap);
    var hc = mat;
    if (raft > 0) {
      var th = (r2 - 0.5) * 1.1 * cmW, ct = Math.cos(th), st = Math.sin(th);
      var qx = x - sx, qz = z - sz;
      var tx = sx + qx * ct - qz * st + (hash2(si * 17, sj * 19) - 0.5) * 500 * cmW;
      var tz = sz + qx * st + qz * ct + (hash2(si * 23, sj * 13) - 0.5) * 500 * cmW;
      var lift = 60 + 110 * hash2(si * 41 + 9, sj * 37 - 4);
      var tilt = (qx * (r1 - 0.5) + qz * (r2 - 0.5)) * 0.07 * cmW;
      var rp = euPre(tx, tz);
      hc = mat * (1 - raft) + (lift * cmW + rp + tilt) * raft;
      dark = dark * (1 - cmE) + (EU_DARK * raft + 0.75 * (1 - raft)) * cmE;
    } else {
      dark = dark * (1 - cmE) + 0.75 * cmE;
    }
    h = base + pre * (1 - cmE) + (hc + 25 * cmW) * cmE;
    EU_YEL = cmE * (1 - raft * 0.8);
  } else {
    h = base + pre;
    EU_YEL = 0;
  }

  // Dark lag gathers in the lows and frost on the crests.
  EU_DARK = dark + sstep(20, -30, pre) * 0.25 - sstep(20, 120, pre) * 0.3;

  // Roughness: the ridged plains are corrugated at every scale Galileo
  // could see, and mass wasting has softened none of it smooth. Ridge
  // flanks are lumpier than the flats between them — slumped blocks,
  // talus lobes — and chaos lumpier than either.
  var rq = pre < 0 ? -pre : pre;
  h += (fbm(x * 0.0075 + 1.3, z * 0.0075 - 4.1, 3) - 0.5) * (5 + 0.05 * rq + 12 * EU_YEL);
  h += (fbm(x * 0.028 + 3, z * 0.028 - 5, 2) - 0.5) * (3.2 + 0.02 * rq);
  h += (fbm(x * 0.12, z * 0.12, 2) - 0.5) * 0.45;
  return h + craterAt(x0, z0);
}

function tintEuropa(x: number, z: number, h: number, slope: number, fresh: number, dark: number, yel: number, hol: number, out: number[]) {
  var v;
  // Europa is water ice, and most of it is nearly white: a
  // geometric albedo of 0.67, ten times the Moon's. What darkens it
  // is non-ice material brought up from below and then cooked by
  // Jupiter's radiation — reddish-brown along the lineae, and in
  // chaos the yellow-brown of irradiated sea salt, which is what
  // Hubble found in Tara Regio. It lies in the lows as a lag and
  // off the crests, where frost collects; steep faces shed it and
  // show clean ice, and a fresh crater throws out clean, bluer ice
  // with rays across everything around it.
  var d = dark + (valueNoise(x * 0.00031 + 5.1, z * 0.00031 - 2.3) - 0.5) * 0.34
               + (valueNoise(x * 0.021, z * 0.021) - 0.5) * 0.14;
  var cl = fresh * WORLD.halo! + rayBrightness(x, z) * 0.8;
  d -= slope * 0.25 + cl * 1.4;
  d = d < -1 ? -1 : d > 1 ? 1 : d;
  var t = d > 0 ? d : 0;
  v = (1 - t * 0.58 + (d < 0 ? -d : 0) * 0.14) * (0.94 + valueNoise(x * 0.09, z * 0.09) * 0.12);
  var k = t * 0.85;
  out[0] = v * (0.965 + ((0.80 + 0.07 * yel) - 0.965) * k);
  out[1] = v * (0.982 + ((0.60 + 0.14 * yel) - 0.982) * k);
  out[2] = v * (1.000 + ((0.46 + 0.02 * yel) - 1.000) * k) * (1 + cl * 0.05);
}

/* Europa: a shell of ice over an ocean, and the youngest surface
   in the set after Venus — 40 to 90 Myr, so craters are rare and
   almost everything is tectonic. Most of what is small is not
   even a primary: secondaries, thrown out together by some distant
   impact, land in clusters and are absent everywhere else, which
   is what clump does. Ice craters of this size are about as deep
   for their width as rock ones. See hEuropa().               */
export const terrain: TerrainDef = {
  id: 'europa', seed: 16100108,
  g: 1.315, R: 1560800,
  lander: [30, 0],
  craters: [
    { cell: 20480, salt:  7, rMin: 500, rMax: 2400, count: 1, prob: 0.22, ageK: 1.0, rays: 1 },
    { cell:  5120, salt: 13, rMin: 110, rMax:  500, count: 1, prob: 0.16, ageK: 1.2, rocks: 1 },
    { cell:  1280, salt: 29, rMin:  25, rMax:  110, count: 1, prob: 0.10, ageK: 1.4, rocks: 1 },
    { cell:   160, salt: 41, rMin:   4, rMax:   22, count: 2, prob: 0.85, ageK: 1.1, clump: 5200, rocks: 1 },
    { cell:    24, salt: 53, rMin: 0.8, rMax:    4, count: 1, prob: 0.10, ageK: 1.6, rocks: 1 },
  ],
  craterAmp: 1, depthK: 0.85, rampart: 0, halo: 0.35,
  Dtr: 4500,     // 4–5 km (Moore et al. 2001; Silber et al. 2017)
  height(x, z) { var h = hEuropa(x, z); AUX[0] = EU_DARK; AUX[1] = EU_YEL; return h; },
  tint: tintEuropa,
};
