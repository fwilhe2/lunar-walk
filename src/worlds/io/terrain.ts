import type { TerrainDef } from '../types';
import { cellRnd } from '../../kernel/craters';
import { fbm, ridged, sstep, valueNoise } from '../../kernel/noise';

/* ── Io ─────────────────────────────────────────────────────────
   The most volcanic body in the solar system, heated from inside by
   the tide Jupiter raises in it twice every 42 hours, and resurfaced
   so fast that nothing an impact made survives. What you walk on:

   - plains of sulphur and frozen sulphur dioxide, fallen from plumes
     and condensed from the thin air, flat for tens of kilometres and
     layered, the layers ending in scarps where the SO₂ frost that holds
     them has sapped out from underneath (Moore et al. 2001);
   - paterae, the volcanic craters: flat-floored, steep-walled pits a
     few to a few tens of kilometres across and hundreds of metres deep,
     their floors dark with fresh lava — Loki's is a lava lake 200 km
     across that overturns every year or so — and no rims to speak of,
     because they are collapses, not cones;
   - mountains, which are not volcanoes at all: blocks of crust a few
     to seventeen kilometres high thrust up and tilted where the crust,
     loaded by all the lava piling on it, fails in compression
     (Schenk & Bulmer 1998). Each stands alone, with one side a scarp
     and the other a long ramp, landslide aprons round its foot;
   - lava flows, long and lobed, in fields around the vents.

   One patera to a cell and one mountain to a much bigger one, each
   kept inside its cell, so only the cell a point is in need be asked.
   IO_OX/IO_OZ put the landing site on the plains with a mountain 7 km
   high on the skyline and Jupiter over it. */
var IO_PCELL = 56000, IO_MCELL = 110000;
var IO_OX = 679107, IO_OZ = -917795;
// The paterae have their own shift, to put one — red-ringed, 15 km
// across — a few kilometres north of the site without crowding the
// mountain.
var IO_PX = 85221, IO_PZ = -124998;

// A patera: its depth below the plain at (x, z), and in IO_PAT how
// much of its dark floor is there, for the colour pass.
var IO_PAT = 0, IO_PH = 0, IO_PK = 0;
function ioPatera(x: number, z: number) {
  IO_PAT = 0; IO_PH = 0;
  var ix = Math.floor(x / IO_PCELL), iz = Math.floor(z / IO_PCELL);
  if (cellRnd(ix, iz, 43, 0) > 0.5) return 0;
  // Centre in the middle 40% of the cell, and the widest the outline
  // can reach — radius, wobble and wall — under the 30% left: nothing
  // crosses into a neighbour.
  var r = 3000 + Math.pow(cellRnd(ix, iz, 43, 1), 1.4) * 9500;
  var ox = x - (ix + 0.3 + cellRnd(ix, iz, 43, 2) * 0.4) * IO_PCELL;
  var oz = z - (iz + 0.3 + cellRnd(ix, iz, 43, 3) * 0.4) * IO_PCELL;
  var d2 = ox * ox + oz * oz;
  // The patera itself reaches under 1.3 r; its halo of fallout, which
  // is only colour, to 2.3 r or 15 km, whichever is less: still inside
  // the cell.
  var R = r * 2.3 < 15000 ? r * 2.3 : 15000;
  if (d2 > R * R) return 0;
  var D = 250 + cellRnd(ix, iz, 43, 4) * 650;
  // Scalloped: the wall has slumped back in arcs, a few kilometres each.
  var q = Math.sqrt(d2) / (r * (1 + (valueNoise(x * 0.00028 + ix * 7.1, z * 0.00028 - iz * 3.3) - 0.5) * 0.36));
  var w = D * 1.5 / r;                                    // wall width, ~35°
  // For the colour pass: how much of the vent's halo of fallout lies
  // here, and what it threw out — red sulphur, or white SO₂ frost.
  IO_PH = sstep(R, r * 1.05, Math.sqrt(d2)); IO_PH *= IO_PH * (q < 1 ? sstep(0.8, 1, q) : 1);
  IO_PK = cellRnd(ix, iz, 43, 5);
  if (q > 1 + w) return 0;
  var h = -D * (1 - sstep(1, 1 + w, q));
  if (q < 1) {
    // The floor is lava: flat, crusted, with pressure ridges and the
    // odd low island of older floor.
    h += (valueNoise(x * 0.004, z * 0.004) - 0.5) * 8 + (valueNoise(x * 0.03 + 5, z * 0.03) - 0.5) * 1.5;
    IO_PAT = (1 - sstep(0.9, 1.0, q)) * (0.55 + 0.45 * sstep(0.3, 0.6, valueNoise(x * 0.0006 + ix, z * 0.0006 - iz)));
  }
  return h;
}

// A mountain: a tilted block, one edge a scarp and the other a ramp.
// Real ones are bigger than anything here — six kilometres high and
// 150 long on average (Schenk et al. 2001) — which from the ground is
// a wall along a whole quarter of the horizon; these are the smaller
// ones, a few kilometres high and up to forty long, so a whole one
// fits on the skyline.
var IO_MT = 0;
function ioMountain(x: number, z: number) {
  IO_MT = 0;
  var ix = Math.floor(x / IO_MCELL), iz = Math.floor(z / IO_MCELL);
  if (cellRnd(ix, iz, 47, 0) > 0.45) return 0;
  var a = 11000 + cellRnd(ix, iz, 47, 1) * 9000;             // half-length, ≤ 20 km
  var ox = x - (ix + 0.35 + cellRnd(ix, iz, 47, 2) * 0.3) * IO_MCELL;
  var oz = z - (iz + 0.35 + cellRnd(ix, iz, 47, 3) * 0.3) * IO_MCELL;
  // Footprint, apron and wobble together stay under 1.55 a = 31 km,
  // inside the 38.5 km the centre leaves.
  if (ox * ox + oz * oz > a * a * 2.4) return 0;
  var th = cellRnd(ix, iz, 47, 4) * 3.1416, c = Math.cos(th), s = Math.sin(th);
  var b = a * (0.45 + cellRnd(ix, iz, 47, 5) * 0.4);
  var u = (ox * c + oz * s) / a, v = (oz * c - ox * s) / b;
  // A blocky outline — a superellipse — with a ragged edge.
  var au = u < 0 ? -u : u, av = v < 0 ? -v : v;
  var qm = Math.pow(Math.pow(au, 2.6) + Math.pow(av, 2.6), 1 / 2.6)
         * (1 + (valueNoise(x * 0.00022 + ix * 5.3, z * 0.00022 - iz * 1.7) - 0.5) * 0.24);
  if (qm > 1.2) return 0;
  var H = 2500 + cellRnd(ix, iz, 47, 6) * 5000;
  // Tilted across the block: highest along one long edge, which is the
  // scarp, at 40° or so; the far edge a ramp down to the plain.
  var tilt = cellRnd(ix, iz, 47, 7) < 0.5 ? v : -v;
  var up = sstep(-0.5, 0.5, tilt);
  var fw = 0.8 + (Math.min(0.35, H * 1.2 / b) - 0.8) * up;
  var top = H * (0.35 + 0.65 * up) * (0.9 + 0.1 * (1 - au * au));
  var env = sstep(1, 1 - fw, qm);
  var m = top * env;
  // Ridges and gullies, cut deepest down the flanks, and grooves
  // across the top at a kilometre or two.
  var fl = env * (1 - env) * 4;
  m += H * 0.12 * ridged(x * 0.00024 + ix * 3.3, z * 0.00024 - iz * 5.1, 4) * (env * 0.4 + fl);
  m += H * 0.06 * (ridged(x * 0.0007 - 2.2, z * 0.0007 + 4.4, 3) - 0.35) * (env * 0.5 + fl);
  m += 40 * (ridged(x * 0.004 + 1, z * 0.004 - 7, 2) - 0.3) * env;
  // Landslide aprons: lobes of debris spread out past the foot, widest
  // under the scarp.
  var ap = (qm - 1) / 0.2;
  if (ap > -0.3) m += H * 0.05 * up * (1 - sstep(-0.3, 1, ap)) * sstep(0.35, 0.65, valueNoise(x * 0.0005 + 9, z * 0.0005 - 4));
  IO_MT = env;
  return m;
}

// Lava flow fields: long lobes, a few metres to tens thick, run out
// over the plains in the fields around the vents. Shared with the
// colour pass, which draws the young ones dark.
function ioFlows(x: number, z: number) {
  var fk = sstep(0.45, 0.65, valueNoise(x * 0.00004 - 2, z * 0.00004 + 6));
  if (fk <= 0) return 0;
  // Warped, so the lobes wander and bulge instead of following the
  // noise lattice, and stretched along the way they flowed.
  var wx = x + (valueNoise(x * 0.00015, z * 0.00015) - 0.5) * 7000;
  var wz = z + (valueNoise(x * 0.00015 + 7.3, z * 0.00015 - 3.1) - 0.5) * 7000;
  return sstep(0.57, 0.6, fbm(wx * 0.00026 + 3.1, wz * 0.00016 - 1.7, 3)) * fk;
}

function hIo(x0: number, z0: number) {
  var x = x0 + IO_OX, z = z0 + IO_OZ;
  var nx = x * 0.00005, nz = z * 0.00005;
  // Plains: flat over tens of kilometres, a few hundred metres of
  // swell at the longest wavelengths.
  var h = (fbm(nx, nz, 4) - 0.5) * 420;
  h += (fbm(x * 0.0005 + 5, z * 0.0005 - 3, 3) - 0.5) * 30;
  // Layered plains, ending in scarps where their frost sapped out: a
  // bench or two, a couple of hundred metres each.
  var lk = sstep(0.5, 0.62, fbm(x * 0.000045 - 4.4, z * 0.000045 + 8.8, 2));
  if (lk > 0.004) {
    var t = fbm(x * 0.00018 + 2.2, z * 0.00018 - 6.6, 3) * lk * 2.6;
    var ti = Math.floor(t);
    h += (ti + sstep(0.8, 1, t - ti)) * 190;
  }
  // Hummocks and low scarps at the kilometre scale: old flows, sapped
  // frost, fallout drifted into swales.
  h += (ridged(x * 0.0011 + 4.4, z * 0.0011 - 2.2, 3) - 0.35) * 22;
  h += ioFlows(x, z) * 14;
  h += ioPatera(x0 + IO_PX, z0 + IO_PZ);
  h += ioMountain(x, z);
  // Frost and fallout at the metre scale, with little else to rough it.
  h += (fbm(x * 0.006 - 3, z * 0.006 + 1, 3) - 0.5) * 4;
  h += (fbm(x * 0.04, z * 0.04, 2) - 0.5) * 0.7;
  h += (fbm(x * 0.15 + 3, z * 0.15, 2) - 0.5) * 0.2;
  return h;
}

function tintIo(x: number, z: number, h: number, slope: number, fresh: number, dark: number, yel: number, hol: number, out: number[]) {
  var v;
  // Io is the most colourful body in the solar system, and nearly all
  // of it is sulphur in one form or another: cream and pale yellow
  // over most of the plains, frozen SO₂ lying white across whole
  // regions, orange and red where short-chain sulphur has fallen
  // fresh from a plume and not yet reverted to yellow, rings of it
  // round the vents that throw it. Against that the silicate lava is
  // black — the paterae floors, the young flows — and the mountains,
  // which stand above most of the fallout, show tan and brown rock on
  // their steep sides. Albedo is high: a normal reflectance of about
  // 0.6 over the plains.
  var ox = x + IO_OX, oz = z + IO_OZ;
  var f1 = fbm(ox * 0.000025 + 4.1, oz * 0.000025 - 2.2, 3), f2 = fbm(ox * 0.00012 - 3.3, oz * 0.00012 + 7.7, 3);
  var n3 = valueNoise(ox * 0.02, oz * 0.02);
  var frost = sstep(0.5, 0.66, f1 * 0.65 + f2 * 0.35);
  var red = sstep(0.58, 0.72, fbm(ox * 0.00006 - 9, oz * 0.00006 + 3, 3) * 0.75 + f2 * 0.25);
  var f3 = fbm(ox * 0.0009 + 1.1, oz * 0.0009 - 5.5, 3);
  frost = frost * 0.7 + sstep(0.56, 0.7, f3) * 0.45;
  v = 0.93 + (f2 - 0.5) * 0.2 + (f3 - 0.5) * 0.14 + (n3 - 0.5) * 0.08;
  var cr = 1.0, cg = 0.92, cb = 0.46;                       // sulphur plains
  cr += (0.95 - cr) * frost; cg += (0.95 - cg) * frost; cb += (0.91 - cb) * frost;
  cr += (0.92 - cr) * red * 0.7; cg += (0.60 - cg) * red * 0.7; cb += (0.36 - cb) * red * 0.7;
  ioPatera(x + IO_PX, z + IO_PZ);
  // The vent's own ring of fallout: red, or white, fading outward.
  if (IO_PH > 0) {
    var hr = IO_PH * (0.55 + 0.45 * valueNoise(ox * 0.0009, oz * 0.0009));
    if (IO_PK < 0.45) { cr += (0.90 - cr) * hr; cg += (0.50 - cg) * hr; cb += (0.30 - cb) * hr; }
    else if (IO_PK < 0.75) { cr += (0.96 - cr) * hr; cg += (0.96 - cg) * hr; cb += (0.93 - cb) * hr; }
    else { cr += (0.82 - cr) * hr * 0.7; cg += (0.86 - cg) * hr * 0.7; cb += (0.50 - cb) * hr * 0.7; }
  }
  // Steep ground sheds the frost and shows the rock: tan, then brown.
  ioMountain(ox, oz);
  var rk = sstep(0.12, 0.5, slope) * (0.4 + 0.6 * IO_MT) + IO_MT * 0.3;
  rk = rk > 1 ? 1 : rk;
  cr += (0.58 - cr) * rk; cg += (0.44 - cg) * rk; cb += (0.29 - cb) * rk;
  out[0] = v * cr; out[1] = v * cg; out[2] = v * cb;
  // Lava, black against all of it; the older flows are dusted over.
  var fl = ioFlows(ox, oz) * (0.3 + 0.7 * sstep(0.35, 0.7, valueNoise(ox * 0.0001 + 1, oz * 0.0001)));
  var dk = IO_PAT > fl ? IO_PAT : fl;
  var lava = 0.10 + n3 * 0.05;
  out[0] += (lava * 1.05 - out[0]) * dk; out[1] += (lava - out[1]) * dk; out[2] += (lava * 0.92 - out[2]) * dk;
}

/* Io: no craters at all. Four hundred volcanoes resurface it at about
   a centimetre a year, which buries a crater of any size faster than
   impacts can make them, and not one has ever been seen on it. See
   hIo(). */
export const terrain: TerrainDef = {
  id: 'io', seed: 19790309,
  g: 1.796, R: 1821600,
  lander: [30.5, -5.3],
  craters: [],
  craterAmp: 1, depthK: 1, rampart: 0, halo: 0,
  height: hIo,
  tint: tintIo,
};
