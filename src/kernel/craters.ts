import { hash2, sstep, valueNoise } from './noise';
import { CRATER_LAYERS, RAY_LI, WORLD } from './world';

// Decorrelated random streams per cell: k picks the stream.
export function cellRnd(cx, cz, salt, k) {
  return hash2(Math.imul(cx, 73) + Math.imul(salt, 151) + Math.imul(k, 7919),
               Math.imul(cz, 89) + Math.imul(salt, 197) - Math.imul(k, 104729));
}

/* Craters for one cell of one layer, cached — mesh generation hits
   the same cells hundreds of times in a row. The cache is direct-
   mapped on a hash of the integer cell, one table per layer: a
   lookup is two integer compares, where a string key cost more
   than everything else in terrainHeight() put together. A miss or
   a collision just recomputes, which is always safe, because the
   list is a pure function of (layer, cell). */
var CC_BITS = 13, CC_SIZE = 1 << CC_BITS, CC_SHIFT = 32 - CC_BITS;
var ccX = [], ccZ = [], ccList = [];
export function craterCacheReset() {
  ccX = []; ccZ = []; ccList = [];
  for (var li = 0; li < CRATER_LAYERS.length; li++) {
    ccX.push(new Int32Array(CC_SIZE));
    ccZ.push(new Int32Array(CC_SIZE));
    ccList.push(new Array(CC_SIZE).fill(null));
  }
}

export function cellCraters(li, cx, cz) {
  // Multiply, add, multiply: an xor of the two products sends (1, 1)
  // and (-1, -1) to the same slot, and that pair sits in the 3×3 scan
  // around the origin — where every world lands you — so it missed
  // four times a query there. This mix leaves no 3×3 window within
  // 300 cells of the origin with a collision in it.
  var slot = Math.imul(Math.imul(cx, 0x27d4eb2d) + cz, 0x165667b1) >>> CC_SHIFT;
  var hit = ccList[li][slot];
  if (hit !== null && ccX[li][slot] === cx && ccZ[li][slot] === cz) return hit;

  var L = CRATER_LAYERS[li];
  var dK = WORLD.depthK;
  var out = [];
  // Secondaries arrive in clusters, all thrown out by one distant
  // impact, so a class with clump set only fills the cells that fall
  // inside a coarse field of clusters. Still a function of the cell.
  var prob = L.prob;
  if (L.clump) {
    var cq = L.cell / L.clump;
    prob *= sstep(0.64, 0.80, valueNoise(cx * cq + L.salt, cz * cq - L.salt));
  }
  for (var k = 0; k < L.count; k++) {
    if (cellRnd(cx, cz, L.salt, k * 6) > prob) continue;
    var u = cellRnd(cx, cz, L.salt, k * 6 + 1);
    // u² biases toward the small end of the class — the power law.
    var r = L.rMin + (L.rMax - L.rMin) * u * u;
    var j = cellRnd(cx, cz, L.salt, k * 6 + 5);
    // Freshness, 1 = new. Skewed old, and more so the smaller the
    // class: at equilibrium most small craters on a surface have been
    // sandblasted by everything that came after them — four in five
    // are shallow dimples with no rim to speak of — and only a few
    // per cent are young enough to be crisp. ageK sets the skew.
    var age = Math.pow(cellRnd(cx, cz, L.salt, k * 6 + 2), L.ageK || 2.2);
    var px = (cx + 0.08 + cellRnd(cx, cz, L.salt, k * 6 + 3) * 0.84) * L.cell;
    var pz = (cz + 0.08 + cellRnd(cx, cz, L.salt, k * 6 + 4) * 0.84) * L.cell;
    // Classes flagged old predate something that wiped them where it
    // formed (Ganymede's grooves, Miranda's corona, Ceres's Occator):
    // decided at the crater's centre, so still a function of the cell.
    if (L.old && WORLD.oldVeto && WORLD.oldVeto(px, pz)) continue;
    // Simple-crater morphometry (Pike 1977): a fresh bowl is 1:5 of
    // its diameter deep — 0.4 r — under a rim standing 0.036 D, and
    // degradation takes both down toward a shallow dimple with no
    // rim to speak of. depthK carries the body: Martian floors are
    // half filled with sand, Venusian ones are barely there at all.
    var depth = r * (0.035 + 0.365 * Math.pow(age, 1.3)) * (0.9 + 0.2 * j) * dK;
    var H = r * (0.004 + 0.068 * age) * (0.8 + 0.4 * j) * dK;
    // Complex craters. Past the body's transition diameter the bowl
    // collapses as it forms: shallower for its width, a flat floor, a
    // central peak, walls slumped into terraces. Depth, rim height and
    // floor width follow Pike's (1977) lunar power laws in Holsapple's
    // continuous form, each joining the simple bowl exactly at the
    // transition, so the population has no step in it; other bodies
    // scale by their own transition. s is the diameter in transitions.
    var s = WORLD.Dtr ? 2 * r / WORLD.Dtr : 0, cpx = null;
    if (s > 1) {
      depth *= Math.pow(s, -0.699);                      // d ∝ D^0.301
      if (s > 2.15) H *= Math.pow(s / 2.15, -0.601);     // h ∝ D^0.399, from 22.8 km on the Moon
      var jp = cellRnd(cx, cz, L.salt, k * 6 + 7);
      cpx = {
        ff: Math.min(0.62, 0.292 * Math.pow(s - 1, 1.249) / s),   // flat floor, as a fraction of r
        e: 2 - 0.35 * sstep(1, 2.5, s),                           // walls steepen toward the crest
        // A peak about a third of the depth high at Tycho's size,
        // growing out of nothing at the transition; worn down with age.
        hp: depth * 0.36 * sstep(1.15, 2.6, s) * (0.45 + 0.55 * age) * (0.75 + 0.5 * jp),
        pr: 0.22 + 0.06 * jp,                                     // its base, as a fraction of r
        nt: s > 1.7 ? Math.min(4, 1 + Math.floor((s - 1.7) * 1.4)) : 0,
        // Central pits instead (pitD, Ganymede and Callisto): a pit a
        // fifth of the crater across, with a low raised rim, taking
        // over from the peak over a band around pitD (Schenk 1993).
        pd: 0,
        ta: sstep(1.7, 2.4, s) * (0.25 + 0.75 * age),             // how crisp the terraces still are
        nx: jp * 97.3, nz: j * 53.1,
      };
    }
    if (cpx !== null && WORLD.pitD) {
      var pk = sstep(0.8, 1.2, 2 * r / WORLD.pitD);
      cpx.pd = depth * 0.4 * pk * (0.5 + 0.5 * age);
      cpx.hp *= 1 - pk;
      if (pk > 0) cpx.pr = 0.18 + 0.05 * jp;
    }
    var o = 1 - age;
    out.push({
      x: px, z: pz, r: r, depth: depth, H: H, cx: cpx,
      // Bowl curvature, so the parabola lands on the crest at d = 1.
      dh: depth + H,
      // How far the crest is rounded off: a knife edge when fresh,
      // a soft swell once the rim has been gardened for an aeon.
      k: (depth + H) * (0.05 + 0.85 * o * o) + 1e-4,
      age: age,
      rim: 0.26 + j * 0.24,          // ray phase and rover scatter
    });
  }
  ccX[li][slot] = cx; ccZ[li][slot] = cz; ccList[li][slot] = out;
  return out;
}

/* Crater profile. Inside, a parabolic bowl that climbs to the rim
   crest at d = 1; outside, an ejecta blanket thinning as the inverse
   cube of range, which is what the blankets around real simple
   craters do (McGetchin et al. 1973), pinned to zero at the 1.9 r
   cutoff so nothing leaves a seam there. The two meet at the crest
   in a kink — the sharp rim of a fresh crater — and a polynomial
   smooth-min rounds that kink off in proportion to age.

   CR_ALB is a side output for the colour pass: how much fresh,
   immature ejecta is at this point. Nothing on the physics side
   reads it. */
export var CR_ALB = 0;
export var CUBE_K = 1 / (1 - 1 / (1.9 * 1.9 * 1.9)), CUBE_0 = 1 / (1.9 * 1.9 * 1.9);

export function craterField(x, z) {
  var h = 0, alb = 0;
  var ramp = WORLD.rampart;
  for (var li = 0; li < CRATER_LAYERS.length; li++) {
    var L = CRATER_LAYERS[li];
    var inv = 1 / L.cell;
    var ccx = Math.floor(x * inv), ccz = Math.floor(z * inv);
    for (var dz = -1; dz <= 1; dz++) {
      for (var dx = -1; dx <= 1; dx++) {
        var list = cellCraters(li, ccx + dx, ccz + dz);
        for (var i = 0; i < list.length; i++) {
          var c = list[i];
          var ox = x - c.x, oz = z - c.z;
          var d2 = ox * ox + oz * oz;
          var reach = c.r * 1.9;
          if (d2 > reach * reach) continue;

          var d = Math.sqrt(d2) / c.r;
          // Polygonal craters (poly): straight stretches of rim along
          // the crust's fractures, as on Ceres — the distance measured
          // half toward a hexagon's, turned per crater.
          if (L.poly && d > 0.3) {
            var pa = c.rim * 10, pm = 0;
            for (var pk = 0; pk < 3; pk++) {
              var pp = (ox * Math.cos(pa + pk * 1.0472) + oz * Math.sin(pa + pk * 1.0472)) / c.r;
              if (pp < 0) pp = -pp; if (pp > pm) pm = pp;
            }
            d += (pm * 1.07 - d) * 0.6 * sstep(0.3, 0.7, d) * (1 - sstep(1.3, 1.85, d));
          }
          var hin, X = c.cx;
          if (X === null) {
            hin = c.dh * d * d - c.depth;
          } else {
            // A complex rim slumps in arcs, so it is scalloped, not a
            // circle. The wobble dies out before the 1.9 r cutoff.
            var u = ox / c.r, w = oz / c.r;
            if (d < 1.8) d *= 1 + (valueNoise(u * 2.3 + X.nx, w * 2.3 + X.nz) - 0.5) * 0.09 * (1 - sstep(1.2, 1.8, d));
            var t = (d - X.ff) / (1 - X.ff);
            if (t <= 0) {
              // The floor: flat, and hummocky with slumped debris and
              // the melt sheet, fading into the foot of the wall.
              hin = -c.depth + c.depth * 0.05 * (valueNoise(u * 7 + X.nz, w * 7 + X.nx) - 0.5) * (1 - sstep(X.ff * 0.7, X.ff, d));
            } else {
              // The wall, in terraces: flat benches between steep risers,
              // softening with age toward a plain slope.
              if (t < 1 && X.nt > 0) {
                var tn = t * X.nt, ti = Math.floor(tn);
                t += ((ti + sstep(0.45, 1, tn - ti)) / X.nt - t) * X.ta;
              }
              hin = c.dh * Math.pow(t, X.e) - c.depth;
            }
            if (d < X.pr && X.hp > 0) {
              var qp = 1 - d / X.pr;
              hin += X.hp * Math.pow(qp, 1.4) * (0.45 + 1.1 * valueNoise(u * 9 + X.nx, w * 9 - X.nz));
            }
            if (X.pd > 0 && d < X.pr * 1.6) {
              var qq = d / X.pr;
              hin += qq < 1 ? X.pd * (0.25 - (1 - qq * qq)) : X.pd * 0.25 * (1 - sstep(1, 1.6, qq));
            }
          }
          var dd = d < 0.5 ? 0.5 : d;
          var hout = c.H * (1 / (dd * dd * dd) - CUBE_0) * CUBE_K;
          var hh = hin < hout ? hin : hout;
          var gap = hin - hout;
          if (gap < 0) gap = -gap;
          if (gap < c.k) { var q = (c.k - gap) / c.k; hh -= q * q * c.k * 0.25; }
          h += hh;

          // Rampart ejecta: on Mars the blanket flows out as a sheet
          // and stops at a ridge, so there is a second, low rim well
          // outside the first. Kept narrow enough to die out before
          // the 1.9 r cutoff, or it would leave a seam there.
          if (ramp > 0 && d > 1.0) {
            var gr = (d - 1.45) / 0.22;
            h += c.depth * 0.11 * ramp * Math.exp(-gr * gr);
          }

          // Immature ejecta: only the youngest quarter of craters show
          // it, brightest on the walls and fading out over the blanket.
          if (c.age > 0.62) {
            var fr = (c.age - 0.62) * 2.63;
            alb += fr * fr * (d < 1 ? 0.55 + 0.45 * d : 1 - (d - 1) * 1.111);
          }
        }
      }
    }
  }
  CR_ALB = alb > 1 ? 1 : alb;
  return h * WORLD.craterAmp;
}

/* Craters, levelled over the last few metres around the origin so
   whichever world you are on, the landing site itself is walkable.
   Levelled to the crater field's own value at the site, not to zero:
   a landing site on the ejecta of a big crater, or on saturated
   ground, stands tens of metres off zero, and fading that away dug a
   pit round the flag with walls steeper than anything you could walk. */
export var CF0 = 0;
export function craterAt(x, z) {
  var cf = craterField(x, z);
  var d0 = x * x + z * z;
  if (d0 < 900) { var f0 = sstep(12, 30, Math.sqrt(d0)); cf = CF0 + (cf - CF0) * f0; CR_ALB *= f0; }
  return cf;
}

/* Bright ejecta rays streaking away from fresh large impacts.
   Only the classes flagged rays are scanned; extent is capped below
   the cell size so the 3×3 neighbourhood still finds everything. */
export function rayBrightness(x, z) {
  var b = 0;
  for (var ri = 0; ri < RAY_LI.length; ri++) {
    var li = RAY_LI[ri], L = CRATER_LAYERS[li];
    var inv = 1 / L.cell;
    var ccx = Math.floor(x * inv), ccz = Math.floor(z * inv);
    for (var dz = -1; dz <= 1; dz++) {
      for (var dx = -1; dx <= 1; dx++) {
        var list = cellCraters(li, ccx + dx, ccz + dz);
        for (var i = 0; i < list.length; i++) {
          var c = list[i];
          if (c.age < 0.82) continue;
          var ox = x - c.x, oz = z - c.z;
          var far = Math.min(c.r * 7, L.cell * 0.88);
          var d2 = ox * ox + oz * oz;
          if (d2 > far * far) continue;
          var d = Math.sqrt(d2) / c.r;
          if (d < 0.9) continue;
          var a = Math.atan2(oz, ox) + c.rim * 26;   // rim doubles as phase
          var arms = 5 + ((c.age * 997) | 0) % 9;
          var arm = Math.abs(Math.sin(a * arms * 0.5));
          var a2 = arm * arm, a4 = a2 * a2;
          arm = a4 * a2 * arm;                                  // narrow spokes: ^7
          arm *= 0.55 + 0.45 * valueNoise(a * 9, d * 3.4);      // broken, not clean
          var reach = far / c.r;
          b += arm * (1 - (d - 0.9) / (reach - 0.9)) * 0.55;
        }
      }
    }
  }
  return b < 0 ? 0 : b > 0.7 ? 0.7 : b;
}

// The crater field's own level at the landing site, for craterAt().
export function levelSite() { CF0 = craterField(0, 0); }
