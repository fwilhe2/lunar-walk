import { craterAt } from '../../kernel/craters';
import { fbm, hash2, ridged, smoothT, sstep, valueNoise } from '../../kernel/noise';
import { WORLD } from '../../kernel/world';

/* ── Miranda ────────────────────────────────────────────────────
   A moon 470 km across that looks as if it had been broken apart and
   put back together badly. Old, rolling, cratered terrain, mantled soft,
   is interrupted by coronae — Inverness, Arden, Elsinore — great
   polygonal and racetrack-shaped tracts of parallel ridges and troughs
   in alternating bright and dark bands, most likely where the crust
   was dragged down over sinking or rising blobs of warmer ice
   (Pappalardo et al. 1997). Where a corona meets the old ground the
   crust broke in fault scarps, and one of them, Verona Rupes, is the
   tallest cliff known in the solar system: some 5–10 km of relief.

   The site is on the outer bands of Inverness Corona, 35°S; 12 km to
   the north-east, under Uranus, a scarp of that kind rises six
   kilometres to the old cratered plateau. MI_CM is how much corona is
   at the last query point, MI_BAND which band (0 dark … 1 bright),
   for the colour pass. */
var MI_UX = Math.sin(56 * Math.PI / 180), MI_UZ = -Math.cos(56 * Math.PI / 180);
var MI_CM = 0, MI_BAND = 0;
function mirScarp(x, z) {
  // t: across the margin, toward the plateau; s: along it.
  var t = x * MI_UX + z * MI_UZ, s = z * MI_UX - x * MI_UZ;
  t += (valueNoise(s * 0.00004, 2.2) - 0.5) * 5000;
  MI_CM = 1 - sstep(9000, 14000, t);
  // The scarp itself, 6 km at its tallest, dying out along strike over
  // a hundred kilometres either way.
  var H = 6000 * (0.75 + 0.25 * valueNoise(s * 0.00006, 4.4)) * (1 - sstep(50000, 110000, s < 0 ? -s : s));
  var g = sstep(7000, 17000, t);
  var h = H * (g * 0.85 + smoothT(g) * 0.15);
  // Its face is gullied and slumped.
  h += (ridged(x * 0.0006 + 3, z * 0.0006, 3) - 0.35) * 220 * g * (1 - g) * 4;
  // The corona's bands: ridges and troughs parallel to its margin, a
  // few kilometres apart, sharp-crested over broad troughs, bright and
  // dark in alternation.
  if (MI_CM > 0) {
    var lam = 4200 + 1800 * valueNoise(s * 0.00002 + 7, t * 0.00003);
    var u = t / lam + valueNoise(s * 0.00005, 9.9) * 1.5;
    var f = u - Math.floor(u);
    var r = 1 - Math.abs(f * 2 - 1);
    h += (r * r * r - 0.3) * (260 + 200 * valueNoise(s * 0.00007, u * 0.3)) * MI_CM;
    MI_BAND = (Math.floor(u) & 1) ? 0.75 + 0.25 * hash2(Math.floor(u), 513) : 0.25 * hash2(Math.floor(u), 517);
  }
  return h;
}
function hMiranda(x, z) {
  var h = (fbm(x * 0.00003 + 1, z * 0.00003 - 4, 4) - 0.5) * 1800;
  h += mirScarp(x, z);
  var ok = 1 - MI_CM;
  h += (fbm(x * 0.0003 + 6, z * 0.0003, 3) - 0.5) * (40 + 80 * ok);   // the mantle rolls
  h += (fbm(x * 0.003 - 2, z * 0.003 + 1, 2) - 0.5) * 6;
  h += (fbm(x * 0.03, z * 0.03 + 5, 2) - 0.5) * 0.8;
  h += (fbm(x * 0.15 + 3, z * 0.15, 2) - 0.5) * 0.15;
  return h + craterAt(x, z);
}

function tintMiranda(x, z, h, slope, fresh, dark, yel, hol, out) {
  var v;
  // Miranda is grey ice, about 0.3, a little darker than its sister
  // moons. The corona bands alternate, bright ones near 0.4 and dark
  // ones near 0.2; the scarp's face is clean, bright ice.
  mirScarp(x, z);
  var cm = MI_CM, bd = MI_BAND;
  var n1 = valueNoise(x * 0.0008 + 2, z * 0.0008 - 3), n2 = valueNoise(x * 0.05, z * 0.05);
  v = (1.0 + (n1 - 0.5) * 0.14 + (n2 - 0.5) * 0.08) * (1 + cm * (bd - 0.5) * 0.65) + slope * 0.45 + fresh * WORLD.halo;
  out[0] = v * 0.985; out[1] = v * 0.99; out[2] = v;
}

/* Miranda: the old terrain is cratered and mantled, the craters soft
   under metres of regolith; the coronae are younger and carry few.
   Classes flagged old are dropped inside the corona. See hMiranda().
   Seed: 16 February 1948, when Gerard Kuiper found it on a plate taken
   at McDonald Observatory. */
export const terrain = {
  id: 'miranda', seed: 19480216,
  g: 0.079, R: 235800,
  lander: [19.6, -12],
  craters: [
    { cell: 20480, salt:  7, rMin: 2500, rMax: 10000, count: 1, prob: 0.50, ageK: 1.6, old: 1 },
    { cell:  5120, salt: 13, rMin:  600, rMax:  2500, count: 2, prob: 0.70, ageK: 2.0, old: 1 },
    { cell:  1280, salt: 29, rMin:  150, rMax:   600, count: 1, prob: 0.60, ageK: 2.4, old: 1, rocks: 1 },
    { cell:   320, salt: 41, rMin:   30, rMax:   150, count: 1, prob: 0.25, ageK: 2.4, rocks: 1 },
    { cell:    64, salt: 53, rMin:    5, rMax:    30, count: 1, prob: 0.20, ageK: 2.5, rocks: 1 },
  ],
  craterAmp: 1, depthK: 0.7, rampart: 0, halo: 0.3,
  Dtr: 30000,
  height: hMiranda,
  tint: tintMiranda,
  // Old crater classes are gone where the corona formed.
  oldVeto(px, pz) { mirScarp(px, pz); return MI_CM > 0.5; },
};
