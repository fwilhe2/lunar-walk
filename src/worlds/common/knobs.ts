import { cellCraters, cellRnd } from '../../kernel/craters';
import { fbm, sstep, valueNoise } from '../../kernel/noise';
import { CRATER_LAYERS, KNOB_LI, WORLD } from '../../kernel/world';

export var CA_KCELL = 240, CA_KN = 0;
var KC_BITS = 12, KC_SIZE = 1 << KC_BITS, KC_SHIFT = 32 - KC_BITS;
var kcX = new Int32Array(KC_SIZE), kcZ = new Int32Array(KC_SIZE), kcL = new Array(KC_SIZE).fill(null);
// How much of a degraded crater rim is at (x, z): 1 on the crest of an
// old one, falling off a fifth of a radius either side.
function knobRim(x, z) {
  var k = 0;
  for (var ki = 0; ki < KNOB_LI.length; ki++) {
    var li = KNOB_LI[ki], L = CRATER_LAYERS[li];
    var ccx = Math.floor(x / L.cell), ccz = Math.floor(z / L.cell);
    for (var dz = -1; dz <= 1; dz++) {
      for (var dx = -1; dx <= 1; dx++) {
        var list = cellCraters(li, ccx + dx, ccz + dz);
        for (var i = 0; i < list.length; i++) {
          var c = list[i], ox = x - c.x, oz = z - c.z, rr = c.r * 1.35;
          var d2 = ox * ox + oz * oz;
          if (d2 > rr * rr || c.age > 0.55) continue;
          var e = (Math.sqrt(d2) / c.r - 1.04) / 0.2;
          var q = Math.exp(-e * e) * (1 - c.age / 0.55);
          if (q > k) k = q;
        }
      }
    }
  }
  return k;
}
// One knob per cell at most, decided at its own centre, so a pure
// function of the cell; cached direct-mapped like the craters.
function knobCell(ix, iz) {
  var slot = Math.imul(Math.imul(ix, 0x27d4eb2d) + iz, 0x165667b1) >>> KC_SHIFT;
  var hit = kcL[slot];
  if (hit !== null && kcX[slot] === ix && kcZ[slot] === iz) return hit;
  var out = false;
  var px = (ix + 0.2 + cellRnd(ix, iz, 71, 2) * 0.6) * CA_KCELL;
  var pz = (iz + 0.2 + cellRnd(ix, iz, 71, 3) * 0.6) * CA_KCELL;
  var p = (0.015 + 0.06 * sstep(0.5, 0.72, fbm(px * 0.00009 + 3.3, pz * 0.00009 - 1.7, 2)) + 0.4 * knobRim(px, pz)) * (WORLD.knobP || 1);
  // Where a world masks them (Ganymede: its dark terrain only).
  if (WORLD.knobMask && p > 0) p *= WORLD.knobMask(px, pz);
  if (cellRnd(ix, iz, 71, 0) <= p) {
    var u = cellRnd(ix, iz, 71, 1);
    var r = 60 + Math.pow(u, 1.4) * 140;
    // Steep: up to 40° on the flanks, the height of the bigger ones
    // reaching a hundred metres (Moore et al. 1999).
    out = { x: px, z: pz, r: r, H: r * (0.28 + 0.27 * cellRnd(ix, iz, 71, 4)) };
  }
  kcX[slot] = ix; kcZ[slot] = iz; kcL[slot] = out;
  return out;
}
// CA_KN: how far up a knob the point is (1 at the summit, scaled down
// for small ones); with apron set, CA_AP: how much of the dark lag
// that has slumped off it lies around its foot, for the colour pass.
export var CA_AP = 0;
export function callistoKnobs(x, z, apron) {
  CA_KN = 0; CA_AP = 0;
  var cx = Math.floor(x / CA_KCELL), cz = Math.floor(z / CA_KCELL);
  var best = 0, reach = apron ? 1.7 : 1;
  for (var dz = -1; dz <= 1; dz++) {
    for (var dx = -1; dx <= 1; dx++) {
      var c = knobCell(cx + dx, cz + dz);
      if (c === false) continue;
      var ox = x - c.x, oz = z - c.z, d2 = ox * ox + oz * oz, rr = c.r * reach;
      if (d2 > rr * rr) continue;
      // Ragged, not round: what is left of a rim is a broken hill.
      var d = Math.sqrt(d2) / c.r * (1 + (valueNoise(x * 0.025 + (cx + dx) * 3.7, z * 0.025 - (cz + dz) * 1.9) - 0.5) * 0.5);
      if (apron && d > 0.8) { var ap = 1 - sstep(0.9, 1.6, d); if (ap > CA_AP) CA_AP = ap * (c.H > 60 ? 1 : c.H / 60); }
      if (d >= 1) continue;
      // A peak, not a dome: a cone with a slightly concave flank, and
      // crags on it.
      var q = 1 - d;
      var hk = c.H * Math.pow(q, 1.25) * (0.85 + 0.3 * valueNoise(x * 0.07 + c.x, z * 0.07));
      if (hk > best) { best = hk; CA_KN = q * (c.H > 60 ? 1 : c.H / 60); }
    }
  }
  return best;
}

export function knobCacheReset() { kcL.fill(null); }
