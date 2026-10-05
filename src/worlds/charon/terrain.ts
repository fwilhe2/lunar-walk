import { cellRnd, craterAt, rayBrightness } from '../../kernel/craters';
import { clamp01, fbm, ridged, smoothT, sstep, valueNoise } from '../../kernel/noise';
import { WORLD } from '../../kernel/world';

/* ── Charon ─────────────────────────────────────────────────────
   Vulcan Planitia is the floor of a flood. When the ocean under
   Charon's crust froze it swelled, split the crust along the belt of
   chasmata to the north, and something — a slurry of water and
   ammonia, most likely — welled up and drowned the southern half of
   the hemisphere in plains a kilometre or two below the old ground
   (Beyer et al. 2019). So it is flat, far flatter than anything else
   on Charon, and rolls only gently over tens of kilometres.

   Two things break it. The first are graben: long, flat-floored
   troughs where the plains pulled apart as they cooled, a few
   hundred metres wide and up to a couple of hundred deep, running
   roughly parallel to the chasma belt. They are drawn in lanes, one
   trough at most per lane and kept inside it, the same trick as
   Europa's ridges, so a lane boundary can never seam.

   The second is the strangest landform on Charon: mountains in
   moats. Blocks of the older crust, a few kilometres high, stand out
   of the plains, and around each one the plain sags into a trench a
   kilometre deep, as if the flood had lapped against them and
   stopped short. Kubrick Mons is 3 km high in a moat 1 km deep. Only
   three are known on the whole plain, so they are rare here too —
   one to every fifty thousand square kilometres — and the landing
   site is put within sight of one, with Pluto standing over it.  */
var CH_MCELL = 60000, CH_LANE = 2600;
var CH_TC = Math.cos(0.30), CH_TS = Math.sin(0.30);   // graben trend, ENE
// The landing site: level plain 16 km west-south-west of a massif
// 4 km high, which stands under Pluto. Craters are left in place, so
// the spawn fade holds.
var CH_OX = -517632, CH_OZ = -142543;
var CH_MK = 0;   // how near the last query was to a massif: 1 inside its moat, 0 out on the plain

function charonMassifs(x, z) {
  var h = 0, mk = 0;
  var cx = Math.floor(x / CH_MCELL), cz = Math.floor(z / CH_MCELL);
  for (var dz = -1; dz <= 1; dz++) {
    for (var dx = -1; dx <= 1; dx++) {
      var ix = cx + dx, iz = cz + dz;
      if (cellRnd(ix, iz, 71, 0) > 0.07) continue;
      var a = 5500 + cellRnd(ix, iz, 71, 1) * 8000;               // semi-major axis
      var ox = x - (ix + 0.3 + cellRnd(ix, iz, 71, 2) * 0.4) * CH_MCELL;
      var oz = z - (iz + 0.3 + cellRnd(ix, iz, 71, 3) * 0.4) * CH_MCELL;
      // The ragged outline below can pull q in by 15%, so this reach
      // is 1.8 / 0.85 of the axis — everything past it is exactly zero.
      if (ox * ox + oz * oz > a * a * 4.6) continue;
      var th = cellRnd(ix, iz, 71, 4) * 3.1416, c = Math.cos(th), s = Math.sin(th);
      var u = (ox * c + oz * s) / a;
      var w = (oz * c - ox * s) / (a * (0.55 + cellRnd(ix, iz, 71, 5) * 0.35));
      var q = Math.sqrt(u * u + w * w) * (1 + (valueNoise(x * 0.0004 + ix * 3.7, z * 0.0004 - iz * 2.9) - 0.5) * 0.3);
      if (q >= 1.8) continue;
      var H = 2000 + cellRnd(ix, iz, 71, 6) * 2200, D = 500 + cellRnd(ix, iz, 71, 7) * 700;
      var m = 0;
      if (q < 1.05) {
        // The block itself: ridged, older ground, crested like the
        // ridges of Oz Terra it once belonged to.
        var env = smoothT(clamp01((1.05 - q) / 0.85));
        m = H * env * (0.30 + 1.05 * ridged(x * 0.00021 + ix * 5.1, z * 0.00021 - iz * 4.3, 5));
        // Spurs and gullies down the flanks, dying out at the foot.
        m += H * 0.09 * env * (1 - env) * 4 * (ridged(x * 0.0011 - 3.3, z * 0.0011 + 7.7, 3) - 0.35);
      }
      var g = (q - 1.12) / 0.2, l = (q - 1.45) / 0.09;
      // The moat, and the low lip where the plain ends at it.
      m += D * (0.1 * Math.exp(-l * l) - Math.exp(-g * g));
      h += m * (1 - sstep(1.62, 1.8, q));
      var k = 1 - sstep(1.15, 1.7, q);
      if (k > mk) mk = k;
    }
  }
  CH_MK = mk;
  return h;
}

function charonGraben(x, z) {
  var s = x * CH_TC + z * CH_TS, t = z * CH_TC - x * CH_TS;
  var li = Math.floor(t / CH_LANE);
  if (cellRnd(li, 0, 83, 0) > 0.5) return 0;
  // Segmented along strike: a trough runs for tens of kilometres,
  // tapers out, and the lane stays empty for a while.
  var seg = sstep(0.48, 0.62, valueNoise(s * 0.00006 + li * 13.7, li * 0.37));
  if (seg <= 0) return 0;
  // Centre and wander kept so the trough, walls and all, stays in its lane.
  var c = (li + 0.35 + cellRnd(li, 0, 83, 1) * 0.3) * CH_LANE + (valueNoise(s * 0.0002, li * 1.7) - 0.5) * 300;
  var w = 150 + cellRnd(li, 0, 83, 2) * 300;
  var tt = Math.abs(t - c) / w;
  if (tt >= 1.4) return 0;
  return -w * (0.25 + cellRnd(li, 0, 83, 3) * 0.3) * seg * (1 - sstep(0.55, 1.4, tt));
}

function hCharon(x0, z0) {
  var x = x0 + CH_OX, z = z0 + CH_OZ;
  var h = (fbm(x * 0.00005, z * 0.00005, 4) - 0.5) * 520;         // the flood's own swell
  h += (fbm(x * 0.0004 + 7, z * 0.0004 - 2, 3) - 0.5) * 45;         // hummocks
  h += (fbm(x * 0.004 - 3, z * 0.004 + 5, 2) - 0.5) * 5;            // swales
  h += charonMassifs(x, z);
  if (CH_MK < 1) h += charonGraben(x, z) * (1 - CH_MK);
  // Regolith of ice grains, a little rougher than Pluto's mantle.
  h += (fbm(x * 0.03 + 2, z * 0.03 - 7, 3) - 0.5) * 2.6;
  h += (fbm(x * 0.14, z * 0.14, 2) - 0.5) * 0.45;
  return h + craterAt(x0, z0);
}

function tintCharon(x, z, h, slope, fresh, dark, yel, hol, out) {
  var v;
  // Charon is water ice, grey and nearly neutral — a reflectance of
  // about 0.4, four times Pluto's tholin — in broad, soft units of
  // slightly brighter and darker plain. Steep walls shed their
  // regolith and show cleaner ice, and fresh craters throw out
  // bright rays of it, except where they dug into ammonia-rich
  // ice, which comes out dark: Organa is the famous one.
  var m1 = valueNoise(x * 0.0009 + 2.1, z * 0.0009 - 5.3);
  var m2 = valueNoise(x * 0.00013 - 4.2, z * 0.00013 + 1.9);
  var m3 = valueNoise(x * 0.06, z * 0.06);
  var org = sstep(0.78, 0.88, valueNoise(x * 0.00021 + 9.3, z * 0.00021 - 3.1));
  var cl = fresh * WORLD.halo + rayBrightness(x, z) * 0.7;
  v = (0.84 + m2 * 0.16 + m1 * 0.10) * (0.94 + m3 * 0.12) + slope * 0.22;
  v += cl * (1 - org * 2.2);
  v = v < 0.45 ? 0.45 : v > 1.45 ? 1.45 : v;
  out[0] = v * 0.975; out[1] = v * 0.985; out[2] = v;
}

/* Charon, on Vulcan Planitia: the smooth plains that cover the
   southern half of the hemisphere New Horizons saw close up, laid
   down from below when an ocean under the crust froze. Craters are
   old and sparse, and short of small ones for the same reason as
   on Pluto — Charon is where that deficit was first measured
   (Singer et al. 2019), below about 13 km. What there is at the
   small end is kept thin. Fresh craters on Charon throw out bright
   rays of clean ice, so the largest class carries them. See
   hCharon(). */
export const terrain = {
  id: 'charon', seed: 19780622,
  g: 0.288, R: 606000,
  lander: [31, 1.2],
  craters: [
    { cell: 24000, salt:  7, rMin: 2500, rMax: 9000, count: 1, prob: 0.50, ageK: 1.4, rays: 1 },
    { cell:  6000, salt: 13, rMin:  500, rMax: 2500, count: 1, prob: 0.50, ageK: 1.6, rocks: 1 },
    { cell:  1500, salt: 29, rMin:  120, rMax:  500, count: 1, prob: 0.26, ageK: 1.9, rocks: 1 },
    { cell:   300, salt: 41, rMin:   20, rMax:  110, count: 1, prob: 0.10, ageK: 2.2, rocks: 1 },
    { cell:    40, salt: 53, rMin:    3, rMax:   15, count: 1, prob: 0.10, ageK: 2.4, rocks: 1 },
  ],
  craterAmp: 1, depthK: 0.8, rampart: 0, halo: 0.4,
  Dtr: 14500,    // 13.5–16 km (Robbins et al. 2021)
  height: hCharon,
  tint: tintCharon,
};
