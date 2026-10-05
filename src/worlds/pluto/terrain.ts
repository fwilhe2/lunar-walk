import type { TerrainDef } from '../types';
import { craterAt } from '../../kernel/craters';
import { fbm, ridged, sstep, valueNoise } from '../../kernel/noise';
import { WORLD } from '../../kernel/world';

/* ── Pluto ──────────────────────────────────────────────────────
   Pluto's crust is water ice, as hard at 40 K as granite, and on
   this side of it everything is under a mantle of tholins: organic
   dust made from methane by ultraviolet light in the haze, and
   settling out of it for four billion years. That blanket softens
   everything below the kilometre scale, so the ground rolls. Rising
   out of it are mountains, blocks of the ice crust a few kilometres
   high, and the few big, old craters the Kuiper belt had to give.

   On their summits is the strangest thing on Pluto. Methane frost
   caps them like snow on an Earth mountain, but for the opposite
   reason: Pluto's air is warmer higher up, and richer in methane,
   so above a certain height methane condenses onto the ice rather
   than off it (Bertrand et al. 2020). The line follows height, not
   geology — the same thing the frost line on Venus does, for a
   completely different reason. PL_FROST is where it falls here.  */
var PL_FROST = 1200;

// Where the ice crust stands up in ranges. Shared with nothing: the
// colour follows height, not the mask.
function plutoRange(x, z) {
  return sstep(0.51, 0.68, fbm(x * 0.000045 - 6.1, z * 0.000045 + 3.3, 3));
}

// The landing site is put on flat ground nine kilometres west of a
// range, so that Charon, which stands 27° up in the east, hangs clear
// above frost-capped peaks that reach 12°.
// Craters are left where they are, so the spawn fade holds.
var PL_OX = -13000, PL_OZ = -9000;

function hPluto(x0, z0) {
  var x = x0 + PL_OX, z = z0 + PL_OZ;
  var nx = x * 0.00009, nz = z * 0.00009;
  var h = (fbm(nx, nz, 4) - 0.5) * 900;                          // regional relief
  h += (fbm(nx * 6 + 11, nz * 6 - 4, 3) - 0.5) * 140;            // hills under the mantle
  h += (fbm(nx * 40 - 3, nz * 40 + 8, 3) - 0.5) * 14;            // swales
  // Gated like the lunar highlands: ridged() is the dearest thing here.
  var mk = plutoRange(x, z);
  if (mk > 0.004) {
    var k = mk * mk;
    h += ridged(nx * 1.9 + 21, nz * 1.9 - 13, 5) * k * 2600;
    h += ridged(nx * 9 - 5, nz * 9 + 17, 3) * k * 240;
  }
  // The mantle leaves little roughness at the metre scale.
  h += (fbm(x * 0.03 + 2, z * 0.03 - 7, 3) - 0.5) * 2.2;
  h += (fbm(x * 0.14, z * 0.14, 2) - 0.5) * 0.35;
  return h + craterAt(x0, z0);
}

function tintPluto(x, z, h, slope, fresh, dark, yel, hol, out) {
  var v;
  // Tholin is dark and deep red — reflectance under a tenth — in a
  // mottle of darker and more orange patches as the haze fallout
  // has been swept and resettled. Above the frost line it is under
  // bright methane frost, ragged at its lower edge, which is ice
  // that reflects four-fifths of the light.
  var m1 = valueNoise(x * 0.0011 + 3.3, z * 0.0011 - 8.2);
  var m2 = valueNoise(x * 0.00016 - 1.7, z * 0.00016 + 4.4);
  var m3 = valueNoise(x * 0.05, z * 0.05);
  var o = sstep(0.45, 0.75, m2);
  v = (0.82 + m1 * 0.36) * (0.93 + m3 * 0.14) * (1 + fresh * WORLD.halo) * (1 + slope * 0.25);
  out[0] = v * (0.24 + o * 0.14);
  out[1] = v * (0.140 + o * 0.075);
  out[2] = v * (0.095 + o * 0.035);
  var fr = sstep(PL_FROST - 120, PL_FROST + 180, h + (m1 - 0.5) * 420 + (valueNoise(x * 0.007, z * 0.007) - 0.5) * 320 - slope * 160);
  if (fr > 0) {
    var fv = 1.36 + m3 * 0.12;
    out[0] += (fv - out[0]) * fr;
    out[1] += (fv * 0.99 - out[1]) * fr;
    out[2] += (fv * 1.01 - out[2]) * fr;
  }
}

/* Pluto, on the side that faces Charon. New Horizons saw this
   hemisphere only on approach, at tens of kilometres a pixel, but
   what it saw along the equator is the dark belt that runs most of
   the way round — the same old, cratered ground as Cthulhu Macula,
   mantled in tholins. Craters here are few for their age and fewer
   the smaller they are: the Kuiper belt is short of small bodies
   (Singer et al. 2019), so there is almost nothing under a few
   hundred metres. See hPluto(). */
export const terrain: TerrainDef = {
  id: 'pluto', seed: 19300218,
  g: 0.620, R: 1188300,
  lander: [23.9, 2.1],
  craters: [
    { cell: 24000, salt:  7, rMin: 2500, rMax: 9000, count: 1, prob: 0.55, ageK: 1.5 },
    { cell:  6000, salt: 13, rMin:  500, rMax: 2500, count: 1, prob: 0.45, ageK: 1.7, rocks: 1 },
    { cell:  1500, salt: 29, rMin:  120, rMax:  500, count: 1, prob: 0.18, ageK: 2.0, rocks: 1 },
    { cell:   300, salt: 41, rMin:   20, rMax:  110, count: 1, prob: 0.06, ageK: 2.2, rocks: 1 },
  ],
  craterAmp: 1, depthK: 0.55, rampart: 0, halo: 0.2,
  Dtr: 11500,    // 11–12.5 km (Robbins et al. 2021)
  height: hPluto,
  tint: tintPluto,
};
