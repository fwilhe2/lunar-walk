import { fbm, hash2, sstep, valueNoise } from '../../kernel/noise';

/* ── Titan ──────────────────────────────────────────────────────
   The only other world with liquid standing on its surface: seas and
   lakes of methane and ethane round the north pole, under 1.5 bar of
   nitrogen at 94 K. Ligeia Mare, the second largest, is 400 km
   across and up to 160 m deep, and its liquid is so clear that
   Cassini's radar saw the bottom through it (Mastrogiuseppe et al.
   2014). Its shores are drowned river valleys — Vid Flumina runs in
   to its western shore down canyons a few hundred metres deep, and
   the sea has come up them — and round it is a plateau country cut
   by those valleys and pocked with sharp-edged depressions, steep-
   walled and raised-rimmed, some full of liquid and some dry, their
   floors bright with what the liquid left behind when it went
   (Hayes 2016; Birch et al. 2019). The seas share one level; a small
   lake is full when its floor is below it.

   Here that is: a gently rising coastal plain, sea to the north and
   deepening offshore, plateaus with scarps, canyons and gullies that
   flood where they run below sea level, and depressions one per
   6 km cell at most, each a pure function of its cell. Few craters:
   the air stops small impactors and rain and sediment bury the rest.
   TI_OX/TI_OZ put the landing site on a low point of the coastal
   plain, 135 m from a bay, looking south across it to a plateau 250 m
   high. Height 0 is the sea's surface.                           */
var TI_OX = 8750, TI_OZ = -3750, TI_CELL = 6000;

// Depressions: the nearest one's contribution to the height, given
// the ground it is cut into. Floors sit at a level of their own.
function tiDepress(x, z) {
  var cx = Math.floor(x / TI_CELL), cz = Math.floor(z / TI_CELL), out = 0;
  for (var j = -1; j <= 1; j++) for (var i = -1; i <= 1; i++) {
    var gx = cx + i, gz = cz + j;
    if (hash2(gx * 7 + 3, gz * 13 - 5) > 0.55) continue;
    var px = (gx + 0.25 + 0.5 * hash2(gx, gz + 77)) * TI_CELL;
    var pz = (gz + 0.25 + 0.5 * hash2(gx + 31, gz)) * TI_CELL;
    var r = 500 + 1700 * hash2(gx - 9, gz + 4);
    var dx = x - px, dz = z - pz, d = Math.sqrt(dx * dx + dz * dz);
    if (d > r * 1.6) continue;
    // A scalloped outline: these grow by their walls retreating.
    var a = Math.atan2(dz, dx);
    var rr = r * (1 + 0.12 * Math.sin(a * 3 + gx) + 0.08 * Math.sin(a * 7 + gz) + (valueNoise(a * 2 + gx, gz) - 0.5) * 0.12);
    var q = d / rr;
    var dep = 90 + 160 * hash2(gx + 5, gz - 11);
    var v;
    if (q < 1) {
      // Flat floor, then a steep wall — 20 to 40° — up to the rim.
      var w = sstep(0.72, 1.0, q);
      v = -dep * (1 - w) + 35 * w * w;
    } else {
      // The raised rim, falling away outside.
      var o = (q - 1) / 0.6;
      v = 35 * (1 - o) * (1 - o) * (o < 1 ? 1 : 0);
    }
    // Overlapping, the deeper cut wins; rims only add where nothing cuts.
    out = (v < 0 || out < 0) ? (v < out ? v : out) : (v > out ? v : out);
  }
  return out;
}

// Valleys, as distance from a sinuous line field: width w, depth d.
function tiValley(x, z, f, w, salt) {
  var wx = (valueNoise(x * f * 0.5 + salt, z * f * 0.5) - 0.5) * 1.6;
  var wz = (valueNoise(x * f * 0.5, z * f * 0.5 - salt) - 0.5) * 1.6;
  var n = fbm(x * f + wx, z * f + wz, 2);
  var t = (n - 0.5) / w;
  return t * t < 1 ? (1 - t * t) * (1 - t * t) : 0;
}

// The plateau country: how much of the upland stands at a point.
function tiPlateau(x, z) {
  return sstep(0.50, 0.56, fbm(x * 0.00011 + 4.1, z * 0.00011 - 7.3, 4) + (z + 3000) * 0.000025);
}

// Where liquid has run: channel floors and the strip along the shore,
// 0–1. Gravel lies there — the Huygens site was a field of rounded
// ice cobbles on an outwash plain (Tomasko et al. 2005).
export function tiGravel(x0, z0, h) {
  var x = x0 + TI_OX, z = z0 + TI_OZ;
  var c = tiValley(x, z, 0.00035, 0.035, 2.1) + tiValley(x + 900, z - 400, 0.0021, 0.05, 5.3);
  var sh = h > 0 && h < 3 ? 1 - sstep(0.5, 3, h) : 0;
  c = c + sh;
  return c > 1 ? 1 : c;
}

function hTitan(x0, z0) {
  var x = x0 + TI_OX, z = z0 + TI_OZ;
  // The coast: land rising southward, sea deepening to the north.
  var b = (z + 420) * 0.006 + 10 + (fbm(x * 0.00005 + 1.7, z * 0.00005 - 2.9, 4) - 0.5) * 260
        + (fbm(x * 0.0006, z * 0.0006 + 5.5, 3) - 0.5) * 28;
  var h = b < 0 ? b * (1.6 + 0.8 * sstep(-30, -200, b)) : b;
  // Plateaus, 120–200 m up, behind scarps.
  var pl = tiPlateau(x, z);
  h += pl * (120 + 80 * valueNoise(x * 0.0002, z * 0.0002 + 3.3)) * sstep(-5, 25, b);
  // Canyons, deep in the uplands and shallow on the plain; gullies.
  var cv = tiValley(x, z, 0.00035, 0.035, 2.1);
  h -= cv * (14 + pl * 190);
  h -= tiValley(x + 900, z - 400, 0.0021, 0.05, 5.3) * (2.5 + pl * 18);
  // The depressions.
  h += tiDepress(x, z);
  // Sediment on the plains: soft swells and hummocks, little else —
  // rain and the haze's fallout fill everything small in.
  h += (fbm(x * 0.0035 + 2, z * 0.0035, 3) - 0.5) * 7;
  h += (fbm(x * 0.03, z * 0.03 - 1, 2) - 0.5) * 0.9;
  h += (fbm(x * 0.16 + 4, z * 0.16, 2) - 0.5) * 0.12;
  return h;
}

function tintTitan(x, z, h, slope, fresh, dark, yel, hol, out) {
  var v;
  // Titan's ground is organic sediment — what the haze rains out,
  // sorted and moved by liquid — over water-ice bedrock. Through the
  // infrared windows the plains are dark and brownish, the uplands
  // brighter where ice shows through; channel floors are brighter
  // still with rounded ice gravel, as at the Huygens site; the floors
  // of dry lakes are the brightest thing on Titan, the evaporites the
  // liquid left behind (Barnes et al. 2011); and the shore within a
  // metre or two of the sea, and everything under it, is wet and dark.
  var x1 = x + TI_OX, z1 = z + TI_OZ;
  var n1 = valueNoise(x * 0.0009 + 3.1, z * 0.0009 - 1.4), n2 = valueNoise(x * 0.04, z * 0.04);
  var pl = tiPlateau(x1, z1);
  var ch = tiValley(x1, z1, 0.00035, 0.035, 2.1) * 0.6 + tiValley(x1 + 900, z1 - 400, 0.0021, 0.05, 5.3);
  ch = ch > 1 ? 1 : ch;
  var ev = h > 0.5 ? sstep(-55, -85, tiDepress(x1, z1)) : 0;
  v = (0.80 + (n1 - 0.5) * 0.30 + (n2 - 0.5) * 0.12) * (1 + pl * 0.45 + slope * 0.35 + ch * 0.30);
  var wet = h < 1.5 ? 1 - sstep(-0.5, 1.5, h) : 0;
  v *= 1 - wet * 0.38;
  out[0] = v * 1.0; out[1] = v * (0.92 + pl * 0.03); out[2] = v * (0.82 + pl * 0.06 + ch * 0.05);
  if (ev > 0) {
    var ew = 1.9 + (n2 - 0.5) * 0.3;
    out[0] += (ew - out[0]) * ev;
    out[1] += (ew * 0.97 - out[1]) * ev;
    out[2] += (ew * 0.90 - out[2]) * ev;
  }
}

/* Enceladus, in its south polar terrain: the youngest ground on it,
   and almost without craters — the few there are small and softened
   under the snow that falls back from the jets. See hEnceladus(). */
/* Titan. See hTitan(). Rc is the curvature the ground appears to
   have: cold nitrogen at 5.3 kg/m³ has a refractivity of 1.3e-3
   and a 21 km scale height, which bends a level ray on a 16,000 km
   radius — so the surface looks a fifth flatter than it is, and the
   horizon sits that much further off. Seed: 14 January 2005, when
   Huygens came down through the haze and sent the only pictures
   anyone has from the surface. */
export const terrain = {
  id: 'titan', seed: 20050114,
  g: 1.352, R: 2574700, Rc: 3060000,
  lander: [19, -33],
  craters: [],
  craterAmp: 0, depthK: 0, rampart: 0, halo: 0,
  height: hTitan,
  tint: tintTitan,
};
