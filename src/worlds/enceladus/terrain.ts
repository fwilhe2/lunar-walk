import type { TerrainDef } from '../types';
import { craterAt } from '../../kernel/craters';
import { fbm, sstep, valueNoise } from '../../kernel/noise';

/* ── Enceladus ──────────────────────────────────────────────────
   A 500 km moon with an ocean under its south pole, and the ocean is
   coming out. Four parallel fractures, the tiger stripes — Alexandria,
   Cairo, Baghdad and Damascus Sulci — cross the south polar terrain
   35 km apart, each a trough about 500 m deep and 2 km wide between
   two ridges a hundred-odd metres high, 130 km long. Along them water
   vapour and ice grains jet out of the ocean at hundreds of metres a
   second, most of it falling back as snow, the rest feeding Saturn's
   E ring (Porco et al. 2006; Spitale et al. 2015).

   Between the stripes is funiscular terrain — ropey, parallel ridges
   a kilometre apart and some tens of metres high, bent round in
   places — and blocks of ice tens of metres across lying about,
   broken off the stripes' walls. Everything is mantled in the fallout,
   which is why it is the brightest ground in the solar system: a
   geometric albedo of 1.4, over nearly pure, fine water ice. The
   stripes themselves are coarser-grained, fresher ice, faintly blue.

   Stripes in lanes, as Charon's graben: one per 35 km lane, kept
   inside it. EN_OX/EN_OZ put the landing site 5 km from Baghdad's
   axis, on the side toward Saturn. */
export var EN_LANE = 35000, EN_TC = Math.cos(0.35), EN_TS = Math.sin(0.35);
export var EN_OX = 4286, EN_OZ = -11742;

// Distance across the nearest stripe (m), and its lane, or 1e9.
export function enStripe(x, z) {
  var s = x * EN_TC + z * EN_TS, t = z * EN_TC - x * EN_TS;
  var li = Math.floor(t / EN_LANE);
  // Sinuous, gently, and offset in steps where the fracture jogs.
  var c = (li + 0.5) * EN_LANE + (valueNoise(s * 0.00007, li * 3.1) - 0.5) * 5000
        + (valueNoise(s * 0.0003 + 7, li * 1.7) - 0.5) * 900;
  return t - c;
}

function hEnceladus(x0, z0) {
  var x = x0 + EN_OX, z = z0 + EN_OZ;
  var h = (fbm(x * 0.00008, z * 0.00008, 4) - 0.5) * 360;
  // Funiscular terrain: ropey ridges a kilometre apart, roughly along
  // the stripes, bending about and dying out in places.
  var su = (z * EN_TC - x * EN_TS) / 1050
         + valueNoise(x * 0.00025, z * 0.00025) * 3.2 + valueNoise(x * 0.001 + 3, z * 0.001) * 0.6;
  var fk = 0.35 + 0.65 * sstep(0.3, 0.7, valueNoise(x * 0.0002 - 5, z * 0.0002 + 9));
  var fq = su - Math.floor(su) - 0.5;
  h += (0.25 - fq * fq) * 4 * 32 * fk * (0.6 + 0.4 * valueNoise(x * 0.002, z * 0.002));
  // A tiger stripe: the trough, its twin ridges, and the jets' fresh
  // ice to a few kilometres either side.
  var t = enStripe(x, z), at = t < 0 ? -t : t;
  if (at < 6000) {
    var along = (x * EN_TC + z * EN_TS);
    var dep = 430 + (valueNoise(along * 0.0002, 5.5) - 0.5) * 180;
    var tr = 1 - sstep(150, 1150, at);
    h += -dep * tr * tr * (3 - 2 * tr) * 0.9 - dep * 0.1 * tr;
    var rg = (at - 1500) / 450;
    h += (110 + 60 * valueNoise(along * 0.0005, 2.2)) * Math.exp(-rg * rg) * (1 - tr);
    h -= 40 * (1 - sstep(1800, 5000, at));        // the stripe's broad sag
  }
  // Snow at the metre scale: smooth, a few drifts.
  h += (fbm(x * 0.004 + 1, z * 0.004 - 2, 3) - 0.5) * 9;
  h += (fbm(x * 0.03, z * 0.03, 2) - 0.5) * 0.9;
  h += (fbm(x * 0.14 + 5, z * 0.14, 2) - 0.5) * 0.18;
  return h + craterAt(x0, z0);
}

function tintEnceladus(x, z, h, slope, fresh, dark, yel, hol, out) {
  var v;
  // Enceladus is snow: fine water ice fallen back from the jets, as
  // white as anything in the solar system. Near the stripes it gives
  // way to coarser, fresher ice that reads faintly blue-green, and on
  // their steep walls to cleaner, bluer ice still.
  var n1 = valueNoise(x * 0.0006 + 2, z * 0.0006 - 1), n2 = valueNoise(x * 0.05, z * 0.05);
  var st = enStripe(x + EN_OX, z + EN_OZ);
  var ic = (1 - sstep(700, 5500, st < 0 ? -st : st)) * (0.6 + 0.4 * n1) + slope * 0.5;
  ic = ic > 1 ? 1 : ic;
  v = (0.97 + (n1 - 0.5) * 0.06 + (n2 - 0.5) * 0.04) * (1 - ic * 0.12);
  out[0] = v * (0.985 - ic * 0.12); out[1] = v * (0.995 - ic * 0.03); out[2] = v;
}

export const terrain: TerrainDef = {
  id: 'enceladus', seed: 17890828,
  g: 0.113, R: 252100,
  lander: [21.9, -9.9],
  craters: [
    { cell: 900, salt: 13, rMin: 20, rMax: 120, count: 1, prob: 0.05, ageK: 3.0 },
  ],
  craterAmp: 1, depthK: 0.5, rampart: 0, halo: 0,
  height: hEnceladus,
  tint: tintEnceladus,
};
