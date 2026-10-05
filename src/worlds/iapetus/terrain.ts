import { craterAt } from '../../kernel/craters';
import { fbm, ridged, smoothT, sstep, valueNoise } from '../../kernel/noise';
import { TN_Z } from '../../kernel/terrain';
import { WORLD } from '../../kernel/world';

/* ── Iapetus ────────────────────────────────────────────────────
   Two things nobody expected. Along its equator runs a ridge, a wall
   of mountains up to 13 km high — higher than anything on Earth — and
   tens of kilometres wide, over more than a third of the way round
   the moon, broken into segments and isolated massifs (Porco et al.
   2005; Giese et al. 2008). What raised it is still argued: a spun-
   down bulge frozen in, or the debris of a ring that fell. It is as
   cratered as everything else, so it is old.

   And one hemisphere is dark. The leading side sweeps up dark dust
   spiralling in from Phoebe's ring; dark ground absorbs more sunlight,
   warms, and its ice sublimes and refreezes on colder ground nearby —
   poleward-facing slopes, shaded walls — which brightens that and
   darkens the warm ground further, a runaway that has sorted the
   surface into black lag and bright frost with almost nothing between
   (Spencer & Denk 2010). The site is near the edge of Cassini Regio,
   where both show: dark plains, frost on every slope that faces the
   pole. The ridge's crest is 22 km south; the slope you see faces
   north, and is white. */
var IA_ZR = 21800;
function iaRidge(x, z) {
  var cz = IA_ZR + (valueNoise(x * 0.00001, 3.1) - 0.5) * 6000;
  var t = (z - cz) / 20000; if (t < 0) t = -t;
  if (t >= 1) return 0;
  // Height wanders along it, and now and then it breaks into massifs
  // with saddles between.
  var H = 9000 * (0.5 + 0.5 * valueNoise(x * 0.00003 + 2, 7.7)) * (0.35 + 0.65 * sstep(0.25, 0.45, valueNoise(x * 0.00008, 1.3)));
  var f = 1 - smoothT(sstep(0.08, 1, t));
  var h = H * f;
  // Crags and spurs down its flanks.
  h += H * 0.07 * (ridged(x * 0.0003 + 5, z * 0.0003 - 1, 3) - 0.35) * f * (1 - f) * 4;
  return h;
}
function hIapetus(x, z) {
  var h = (fbm(x * 0.00002 + 4, z * 0.00002 - 2, 4) - 0.5) * 2500;
  h += iaRidge(x, z);
  h += (fbm(x * 0.0003 - 1, z * 0.0003 + 3, 3) - 0.5) * 80;
  h += (fbm(x * 0.003 + 2, z * 0.003, 2) - 0.5) * 8;
  h += (fbm(x * 0.03, z * 0.03 + 1, 2) - 0.5) * 1.0;
  h += (fbm(x * 0.15 - 4, z * 0.15, 2) - 0.5) * 0.16;
  return h + craterAt(x, z);
}

function tintIapetus(x, z, h, slope, fresh, dark, yel, hol, out) {
  var v;
  // Iapetus sorted into two materials with almost nothing between: a
  // reddish-brown lag at 0.03–0.05 and water frost at 0.5–0.6. Frost
  // where it is cold — slopes that face the pole, here north, and
  // steep walls the sun reaches only at a slant — lag everywhere else.
  // Patchy: the boundary is a mottle at every scale (Denk et al. 2010).
  var n1 = valueNoise(x * 0.0009 + 3.1, z * 0.0009 - 1.2), n2 = valueNoise(x * 0.012, z * 0.012), n3 = valueNoise(x * 0.06, z * 0.06);
  var fz = TN_Z * 1.4 + slope * 0.25 + (n1 - 0.5) * 0.35 + (n2 - 0.5) * 0.2 + (n3 - 0.5) * 0.08 - 0.06 + fresh * WORLD.halo;
  var fr = sstep(0.0, 0.12, fz);
  var dkv = 0.16 * (0.9 + n3 * 0.2), fv = 1.75 * (0.95 + n3 * 0.1);
  out[0] = dkv * 1.30 + (fv * 1.0 - dkv * 1.30) * fr;
  out[1] = dkv * 1.00 + (fv * 0.98 - dkv * 1.00) * fr;
  out[2] = dkv * 0.78 + (fv * 0.95 - dkv * 0.78) * fr;
}

/* Iapetus: saturated with craters at every size Cassini could see,
   from basins hundreds of kilometres across down; a weak gravity and
   cold ice put the transition to complex craters far out. See
   hIapetus(). Seed: 25 October 1671, when Giovanni Cassini found it —
   and noticed it vanished every time it went round to one side of
   Saturn, because that side is dark. */
export const terrain = {
  id: 'iapetus', seed: 16711025,
  g: 0.223, R: 734500,
  lander: [16.8, 6.5],
  craters: [
    { cell: 65536, salt:  7, rMin: 8000, rMax: 30000, count: 1, prob: 0.55, ageK: 1.2 },
    { cell: 16384, salt: 13, rMin: 2000, rMax:  8000, count: 2, prob: 0.80, ageK: 1.6 },
    { cell:  4096, salt: 29, rMin:  500, rMax:  2000, count: 2, prob: 0.80, ageK: 2.0 },
    { cell:  1024, salt: 41, rMin:  120, rMax:   500, count: 2, prob: 0.70, ageK: 2.2, rocks: 1 },
    { cell:   256, salt: 53, rMin:   25, rMax:   120, count: 1, prob: 0.60, ageK: 2.4, rocks: 1 },
    { cell:    48, salt: 61, rMin:    4, rMax:    20, count: 1, prob: 0.40, ageK: 2.5, rocks: 1 },
  ],
  craterAmp: 1, depthK: 0.85, rampart: 0, halo: 0.3,
  Dtr: 15000,
  height: hIapetus,
  tint: tintIapetus,
};
