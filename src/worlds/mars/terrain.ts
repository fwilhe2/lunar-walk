import type { TerrainDef } from '../types';
import { cellCraters, cellRnd, craterAt } from '../../kernel/craters';
import { fbm, ridged, smoothT, sstep, valueNoise } from '../../kernel/noise';
import { CRATER_LAYERS, STREAK_LI } from '../../kernel/world';

/* ── Mars ───────────────────────────────────────────────────────
   Wind does the work here that impacts do on an airless body.
   The prevailing wind is one fixed bearing for the whole world:
   dune crests lie across it, and every crater trails a streak
   downwind of itself.                                            */
export var WIND_A = 0.9271, WIND_C = Math.cos(WIND_A), WIND_S = Math.sin(WIND_A);

// Where sand has collected deep enough to build dunes. Shared with
// the colour pass, because the sand is a different rock from the
// dust it sits on and has to be shaded differently.
// Across one dune: a long stoss slope, then the slip face at the angle
// of repose. u counts dunes; its fraction is the place in one.
function duneProfile(u) {
  var f = u - Math.floor(u);
  return f < 0.78 ? smoothT(f / 0.78) : 1 - (f - 0.78) / 0.22;
}

function duneMask(x, z) {
  return sstep(0.46, 0.66, fbm(x * 0.00042 + 12.1, z * 0.00042 - 5.4, 3));
}

function hMars(x, z) {
  var nx = x * 0.0016, nz = z * 0.0016;

  var reg = fbm(nx, nz, 5);
  var h = (reg - 0.5) * 46;                                    // regional slopes
  h += (fbm(nx * 5.1 + 21, nz * 5.1 - 8, 4) - 0.5) * 6.0;      // hummocky plains
  h += (fbm(nx * 19 - 4, nz * 19 + 9, 3) - 0.5) * 1.3;         // metre relief

  // Layered terrain: Mars keeps its stratigraphy, and wind cuts it
  // into flat-topped mesas and buttes with talus skirts. Beds are
  // ~9 m thick — flat for most of each, then a scarp. Gated like
  // the lunar highlands, and for the same reason: it is expensive.
  var mk = sstep(0.54, 0.70, fbm(x * 0.00021 - 4.2, z * 0.00021 + 6.6, 3));
  if (mk > 0.004) {
    var t = ridged(nx * 2.9 + 33, nz * 2.9 - 19, 4) * mk * mk * 150 / 9;
    var fi = Math.floor(t);
    h += (fi + sstep(0.62, 1.0, t - fi)) * 9;
  }

  // Transverse dunes: crests across the wind, a long gentle stoss
  // slope and a slip face standing at the angle of repose. Crests
  // meander because the wind is not a ruler.
  // Real dune fields are not combed straight either: crests bend,
  // split where two trains of dunes meet out of step, and rise and
  // fall along their length. Two trains at 72 and 84 m share one
  // meander and are blended in patches, so a slip face forks where
  // they drift apart.
  var dk = duneMask(x, z);
  if (dk > 0.004) {
    var sw = x * WIND_C + z * WIND_S;
    var dm = valueNoise(x * 0.0026, z * 0.0026) * 1.7 + valueNoise(x * 0.0071 + 4, z * 0.0071 - 9) * 0.45;
    var p1 = duneProfile(sw / 72 + dm), p2 = duneProfile(sw / 84 + dm * 1.12 + 0.41);
    var dq = sstep(0.3, 0.7, valueNoise(x * 0.0021 - 11, z * 0.0021 + 5));
    var da = 0.55 + 0.45 * valueNoise(x * 0.0052 + 13, z * 0.0052 + 2);
    h += (p1 + (p2 - p1) * dq - 0.45) * dk * 7.5 * da;
  }

  // Transverse aeolian ridges: the metre-high, tens-of-metres-apart
  // ridges that cover most of the planet between the dune fields.
  // Unlike dunes they are symmetric, and sharp-crested over broad flat
  // troughs, about a fifteenth as tall as they are apart. They are not
  // a ploughed field: they wander, fork and die out. Two sets at
  // slightly different spacings share one meander and are blended in
  // patches, so wherever they drift out of step a ridge forks in two;
  // and they gather in the lows, where the sand that builds them
  // collects.
  var s = x * WIND_C + z * WIND_S;
  var mea = valueNoise(x * 0.004 + 50, z * 0.004) * 2.2 + valueNoise(x * 0.011 - 7, z * 0.011 + 3) * 0.8 +
            valueNoise(x * 0.023 + 2, z * 0.023 - 5) * 0.35;
  var tq = sstep(0.3, 0.7, valueNoise(x * 0.008 + 9, z * 0.008 - 4));
  // Along a crest the ridge grows and dies out every hundred metres or so.
  var ta = 1.25 * (0.35 + 0.65 * valueNoise(x * 0.0016 - 3, z * 0.0016 + 7)) * sstep(0.15, 0.6, valueNoise(x * 0.011 + 31, z * 0.011 - 17))
         * (1 - sstep(0.45, 0.62, reg)) * (1 - dk * 0.6);
  if (ta > 0.002) {
    var v1 = s / 26 + mea, v2 = s / 30 + mea * 1.15 + 0.37;
    // Distance from the crest, 0 on it and 1 mid-trough; squared, the
    // profile has a sharp crest and a flat floor, and a mean of 1/3.
    var q1 = 1 - Math.abs(v1 - Math.floor(v1) - 0.5) * 2, q2 = 1 - Math.abs(v2 - Math.floor(v2) - 0.5) * 2;
    h += ((q1 * q1) + (q2 * q2 - q1 * q1) * tq - 1 / 3) * ta;
  }

  return h + craterAt(x, z);
}

/* Wind streaks: a crater rim shelters the ground behind it, sand
   scours the bright dust off the lee side, and the dark rock
   underneath shows as a tail pointing downwind — the most obvious
   thing about Mars from orbit. Returns how much dust is missing. */
/* Dust-devil tracks: dark lines tens of metres wide and kilometres
   long, looping and crossing, where a whirlwind lifted the bright dust
   off the darker ground underneath — HiRISE sees them by the thousand
   on Amazonis Planitia, and Spirit watched the devils that made them
   cross Gusev (Greeley et al. 2006). Colour only. Each 1.6 km cell
   holds up to two, each a meandering line through a point in the cell,
   kept within a cell of it so the 3×3 scan finds every one. */
var DV_CELL = 1600;
function devilTracks(x, z) {
  var cx = Math.floor(x / DV_CELL), cz = Math.floor(z / DV_CELL), best = 0;
  for (var dz = -1; dz <= 1; dz++) {
    for (var dx = -1; dx <= 1; dx++) {
      var ix = cx + dx, iz = cz + dz;
      for (var k = 0; k < 2; k++) {
        if (cellRnd(ix, iz, 97, k * 8) > 0.55) continue;
        var px = (ix + cellRnd(ix, iz, 97, k * 8 + 1)) * DV_CELL, pz = (iz + cellRnd(ix, iz, 97, k * 8 + 2)) * DV_CELL;
        // Most run with the prevailing wind, some across it.
        var a = WIND_A + (cellRnd(ix, iz, 97, k * 8 + 3) - 0.5) * 1.6;
        var ca = Math.cos(a), sa = Math.sin(a);
        var ox = x - px, oz = z - pz;
        var u = ox * ca + oz * sa, v = oz * ca - ox * sa;
        var L = 700 + cellRnd(ix, iz, 97, k * 8 + 4) * 900;
        if (u < -L || u > L) continue;
        var vc = Math.sin(u * (0.003 + 0.004 * cellRnd(ix, iz, 97, k * 8 + 5)) + k * 2.1) * (60 + 140 * cellRnd(ix, iz, 97, k * 8 + 6));
        var w = 12 + 40 * cellRnd(ix, iz, 97, k * 8 + 7);
        var dd = v - vc; if (dd < 0) dd = -dd;
        if (dd > w) continue;
        // Fresh tracks are dark; older ones are dusting over.
        var q = (1 - sstep(w * 0.4, w, dd)) * (1 - sstep(L * 0.7, L, u < 0 ? -u : u)) * (0.35 + 0.65 * cellRnd(ix, iz, 97, k * 8 + 4));
        if (q > best) best = q;
      }
    }
  }
  return best;
}

function windStreak(x, z) {
  var b = 0;
  for (var si = 0; si < STREAK_LI.length; si++) {
    var li = STREAK_LI[si], L = CRATER_LAYERS[li];
    var inv = 1 / L.cell;
    var ccx = Math.floor(x * inv), ccz = Math.floor(z * inv);
    for (var dz = -1; dz <= 1; dz++) {
      for (var dx = -1; dx <= 1; dx++) {
        var list = cellCraters(li, ccx + dx, ccz + dz);
        for (var i = 0; i < list.length; i++) {
          var c = list[i];
          var ox = x - c.x, oz = z - c.z;
          var far = Math.min(c.r * 6, L.cell * 0.88);
          if (ox * ox + oz * oz > far * far) continue;
          var s = ox * WIND_C + oz * WIND_S;          // along-wind
          if (s <= c.r * 0.5) continue;               // upwind of the rim
          var t = oz * WIND_C - ox * WIND_S;          // cross-wind
          var w = c.r * (0.5 + s / far * 1.0);        // the tail widens out
          var fade = 1 - s / far;
          b += Math.exp(-(t * t) / (w * w)) * fade * fade
             * (0.55 + 0.45 * valueNoise(s * 0.012, t * 0.02)) * 0.8;
        }
      }
    }
  }
  return b > 1 ? 1 : b;
}

function tintMars(x, z, h, slope, fresh, dark, yel, hol, out) {
  var v;
  // Mars is two rocks: bright ferric dust that settles out of the
  // air onto anything flat, and the dark basaltic sand underneath
  // it. Everything the wind touches — slip faces, steep ground,
  // the lee of a crater — loses the dust and goes grey.
  var d = 0.74;
  d -= slope * 0.62;
  d -= duneMask(x, z) * 0.55;
  d -= windStreak(x, z) * 0.5;
  d -= devilTracks(x, z) * 0.4;
  d += valueNoise(x * 0.0055, z * 0.0055) * 0.34 - 0.17;
  d = d < 0 ? 0 : d > 1 ? 1 : d;
  var n = 0.92 + valueNoise(x * 0.07, z * 0.07) * 0.17;
  out[0] = (0.44 + d * 0.62) * n;
  out[1] = (0.36 + d * 0.34) * n;
  out[2] = (0.32 + d * 0.16) * n;
}

/* Mars. Craters below a few metres do not survive: dust settles
   out of the atmosphere and saltating sand planes them off in
   geological no-time, so the small classes are thinned and the
   survivors are shallow. Ejecta is lobate — ground ice fluidises
   it — so fresh craters end in a distal rampart ridge instead of
   a fading blanket.                                             */
export const terrain: TerrainDef = {
  id: 'mars', seed: 19750820,
  g: 3.72, R: 3389500,
  lander: [11.3, -3.9],
  craters: [
    { cell: 3200, salt:  5, rMin: 300, rMax: 780, count: 1, prob: 0.30, streak: 1 },
    { cell:  800, salt: 13, rMin:  70, rMax: 300, count: 1, prob: 0.42, rocks: 1, streak: 1 },
    { cell:  200, salt: 29, rMin:  18, rMax:  72, count: 1, prob: 0.50, rocks: 1 },
    { cell:   50, salt: 41, rMin:   5, rMax:  18, count: 1, prob: 0.22, rocks: 1 },
  ],
  craterAmp: 0.74, depthK: 0.60, rampart: 1,
  Dtr: 7000,
  height: hMars,
  tint: tintMars,
};
