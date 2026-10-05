import type { TerrainDef } from '../types';
import { cellRnd, craterAt } from '../../kernel/craters';
import { fbm, ridged, smoothT, sstep, valueNoise } from '../../kernel/noise';
import { WORLD } from '../../kernel/world';

/* ── Triton ─────────────────────────────────────────────────────
   Two terrains meet at the site. To the south is the polar cap,
   Uhlanga Regio: a deposit of nitrogen ice, bright and faintly pink,
   smooth at every scale the ground below it has relief, streaked dark
   in fans tens of kilometres long that all point the same way — dust
   blown downwind from the geysers that erupt where the sun stands high
   on the cap (Soderblom et al. 1990). To the north is the cantaloupe
   terrain of Bubembe Regio, the strangest landscape Voyager found:
   dimples 25–35 km across, each a shallow depression a few hundred
   metres deep ringed by ridges, packed edge to edge like the rind of
   the melon, most likely diapirs — blobs of warmer ice that rose
   through the crust (Schenk & Jackson 1993) — crossed by double
   ridges like Europa's (Prockter et al. 2005).

   The dimples are cells of a jittered grid, drawn from the two
   nearest centres (a Voronoi diagram), so they tile the ground along
   ridged seams. TR_CAP is how much cap there is at the last query
   point, TR_CV how near a dimple's rim, for the colour pass. */
var TR_OX = -1250, TR_OZ = 1000, TR_CELL = 30000;
export var TR_CAP = 0, TR_CV = 0;
// The cap's margin, wandering east–west a few kilometres south of the
// site, lobed and ragged.
function trCap(x, z) {
  return sstep(-1500, 1500, z - 4000 + (fbm(x * 0.00006 + 2.1, z * 0.00006, 3) - 0.5) * 22000 + (valueNoise(x * 0.0005, z * 0.0005 + 7) - 0.5) * 2500);
}
function trCantaloupe(x, z) {
  var cx = Math.floor(x / TR_CELL), cz = Math.floor(z / TR_CELL);
  var d1 = 1e12, d2 = 1e12, dep = 0;
  for (var dz = -1; dz <= 1; dz++) {
    for (var dx = -1; dx <= 1; dx++) {
      var px = (cx + dx + 0.15 + cellRnd(cx + dx, cz + dz, 79, 0) * 0.7) * TR_CELL;
      var pz = (cz + dz + 0.15 + cellRnd(cx + dx, cz + dz, 79, 1) * 0.7) * TR_CELL;
      var ox = x - px, oz = z - pz, d = ox * ox + oz * oz;
      if (d < d1) { d2 = d1; d1 = d; dep = cellRnd(cx + dx, cz + dz, 79, 2); }
      else if (d < d2) d2 = d;
    }
  }
  d1 = Math.sqrt(d1); d2 = Math.sqrt(d2);
  // Distance to the seam between the two nearest cells.
  var e = (d2 - d1) * 0.5;
  TR_CV = Math.exp(-e * e / 2.5e6);
  // A dish, deepest in the middle, and a ridged rim on the seam.
  var w = e / (TR_CELL * 0.32);
  return -(180 + 220 * dep) * smoothT(w > 1 ? 1 : w) + 150 * TR_CV + 140 * Math.exp(-e * e / 1.6e5);
}
// Double ridges across the cantaloupe terrain: two crests and a trough,
// a few kilometres across, one at most per 45 km lane.
var TR_RC = Math.cos(0.8), TR_RS = Math.sin(0.8);
function trRidge(x, z) {
  var s = x * TR_RC + z * TR_RS, t = z * TR_RC - x * TR_RS;
  var li = Math.floor(t / 45000);
  if (cellRnd(li, 0, 83, 0) > 0.6) return 0;
  var c = (li + 0.5) * 45000 + (valueNoise(s * 0.00002, li * 1.7) - 0.5) * 20000;
  var a = (t - c) / (1500 + cellRnd(li, 0, 83, 1) * 1000);
  if (a < -3 || a > 3) return 0;
  var H = 150 + cellRnd(li, 0, 83, 2) * 200;
  return H * (Math.exp(-(a - 0.8) * (a - 0.8) * 2.2) + Math.exp(-(a + 0.8) * (a + 0.8) * 2.2)) * sstep(0.3, 0.45, valueNoise(s * 0.00001 + li, li * 0.3));
}

function hTriton(x0, z0) {
  var x = x0 + TR_OX, z = z0 + TR_OZ;
  var cap = trCap(x, z), cn = 1 - cap;
  TR_CAP = cap;
  var h = (fbm(x * 0.00003 + 5, z * 0.00003 - 2, 4) - 0.5) * 500;
  // The cap stands a little proud of what it lies on, and smooths it.
  h += cap * 60;
  if (cn > 0) {
    h += (trCantaloupe(x, z) + trRidge(x, z)) * cn;
    h += (fbm(x * 0.0004 - 3, z * 0.0004 + 8, 3) - 0.5) * 70 * cn;     // hummocky rind
    h += (ridged(x * 0.0011 + 4, z * 0.0011 - 6, 3) - 0.3) * 60 * cn;    // and knobbly on it
  } else TR_CV = 0;
  h += (fbm(x * 0.003 + 1, z * 0.003, 2) - 0.5) * (8 - 5 * cap);
  h += (fbm(x * 0.03, z * 0.03 + 3, 2) - 0.5) * (1.2 - 0.7 * cap);
  h += (fbm(x * 0.15 - 2, z * 0.15, 2) - 0.5) * (0.2 - 0.12 * cap);
  return h + craterAt(x0, z0);
}

function tintTriton(x, z, h, slope, fresh, dark, yel, hol, out) {
  var v;
  // Triton's cap is nitrogen ice, the brightest ground in the outer
  // solar system after Enceladus, faintly pink-cream from organics
  // made in it by sunlight (Thompson & Sagan 1990), streaked with dark
  // fans laid downwind by the geysers — all pointing north-east, the
  // way the surface wind blew. The cantaloupe terrain is greyer,
  // faintly blue-green, its dimple rims a little brighter. Fresh
  // craters are bright.
  var x1 = x + TR_OX, z1 = z + TR_OZ;
  var cap = trCap(x1, z1);
  var n1 = valueNoise(x * 0.0006 + 2.2, z * 0.0006 - 1.1), n2 = valueNoise(x * 0.05, z * 0.05);
  // Streaks: noise stretched twenty to one along the wind.
  var su = x1 * 0.766 - z1 * 0.643, sv = x1 * 0.643 + z1 * 0.766;
  var stk = sstep(0.55, 0.75, valueNoise(su * 0.00025 + 3.3, sv * 0.0000125)) * sstep(0.25, 0.5, valueNoise(su * 0.00003, sv * 0.00003 + 9));
  var cl = fresh * WORLD.halo;
  var cv = 0;
  if (cap < 1) { trCantaloupe(x1, z1); cv = TR_CV; }
  var vc = (1.35 + (n1 - 0.5) * 0.12 + (n2 - 0.5) * 0.06) * (1 - stk * 0.42);
  var vt = (1.05 + (n1 - 0.5) * 0.18 + (n2 - 0.5) * 0.08 + cv * 0.12 + slope * 0.2);
  v = vt + (vc - vt) * cap + cl;
  var pk = cap * (1 - stk * 0.5);
  out[0] = v * (0.97 + pk * 0.04); out[1] = v * (0.985 - pk * 0.02); out[2] = v * (1.0 - pk * 0.07);
}

/* Triton: one of the youngest surfaces in the solar system, tens of
   millions of years by its craters (Schenk & Zahnle 2007), so they are
   few and fresh; the largest Voyager saw, Mazomba, is 27 km. See
   hTriton(). Seed: 25 August 1989, Voyager 2's closest approach, the
   last new world it showed anyone. */
export const terrain: TerrainDef = {
  id: 'triton', seed: 19890825,
  g: 0.779, R: 1353400,
  lander: [30.4, -15.2],
  craters: [
    { cell: 40000, salt:  7, rMin: 2000, rMax: 13000, count: 1, prob: 0.08, ageK: 0.8 },
    { cell:  8000, salt: 13, rMin:  300, rMax:  2000, count: 1, prob: 0.15, ageK: 0.9 },
    { cell:  1000, salt: 29, rMin:   30, rMax:   300, count: 1, prob: 0.08, ageK: 1.1, rocks: 1 },
  ],
  craterAmp: 1, depthK: 0.8, rampart: 0, halo: 0.25,
  Dtr: 8000,
  height: hTriton,
  tint: tintTriton,
};
