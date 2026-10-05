import { CUBE_0, CUBE_K, craterAt } from '../../kernel/craters';
import { fbm, smoothT, sstep, valueNoise } from '../../kernel/noise';
import { WORLD } from '../../kernel/world';

/* ── Ceres ──────────────────────────────────────────────────────
   On the floor of Occator, 92 km across and four deep, the youngest
   large crater on Ceres — about twenty million years — and the
   brightest place on it. Its floor is lobate material, impact melt and
   brine-soaked rubble that flowed and froze, cut by fractures. In the
   middle is a pit 9 km across and some 800 m deep, and in the pit a
   dome, Cerealia Tholus, 3 km wide and 400 m high, split by
   fractures: and over all of it lies Cerealia Facula, sodium carbonate
   left behind where brine came up from a reservoir below and its
   water boiled off into vacuum (De Sanctis et al. 2016, 2020;
   Nathues et al. 2020) — five times as reflective as the rest of
   Ceres. Out on the eastern floor the Vinalia Faculae are thinner,
   patchy versions of the same.

   Occator is a single landform at a fixed place (OC_X, OC_Z), not a
   member of a crater class; the site is on the pit's western lip, 5 km
   from the centre, looking down into it. OC_FAC is how much facula there is at
   the last query point, for the colour pass. */
var OC_X = 4000, OC_Z = -1400, OC_R = 46000, OC_FAC = 0;
function ceOccator(x, z) {
  var ox = x - OC_X, oz = z - OC_Z, r = Math.sqrt(ox * ox + oz * oz);
  OC_FAC = 0;
  if (r > OC_R * 1.9) return 0;
  var d = r / OC_R;
  // Scalloped, a little polygonal, like the craters around it.
  d *= 1 + (valueNoise(ox * 0.00006 + 3, oz * 0.00006) - 0.5) * 0.06;
  var h;
  if (d > 1) {
    // Rim crest a kilometre up, ejecta thinning as the inverse cube.
    var dd = d < 1 ? 1 : d;
    h = 1000 * (1 / (dd * dd * dd) - CUBE_0) * CUBE_K;
  } else if (d > 0.62) {
    // Walls in terraces, slumped blocks between them.
    var t = (d - 0.62) / 0.38, tn = t * 4, ti = Math.floor(tn);
    t = (ti + sstep(0.4, 1, tn - ti)) / 4 * 0.7 + t * 0.3;
    h = -2800 + 3800 * Math.pow(t, 1.6) + (valueNoise(ox * 0.0008, oz * 0.0008) - 0.5) * 180 * (1 - Math.abs(t * 2 - 1));
  } else {
    // The floor: lobate flows, low and broad, with fronts tens of metres
    // high, and concentric fractures.
    h = -2800 + (fbm(ox * 0.00035 + 7, oz * 0.00035 - 2, 3) - 0.5) * 160;
    var lobe = fbm(ox * 0.0012 - 3, oz * 0.0012 + 5, 2);
    h += sstep(0.48, 0.53, lobe) * 30;
    var fr = Math.abs(Math.sin(r * 0.0021 + valueNoise(ox * 0.0002, oz * 0.0002) * 4));
    h -= (1 - sstep(0.0, 0.05, fr)) * 25 * sstep(0.12, 0.25, d) * sstep(0.45, 0.3, d);
  }
  // The central pit and the dome in it.
  var pr = 4500 * (1 + (valueNoise(ox * 0.0009, oz * 0.0009 + 4) - 0.5) * 0.2);
  if (r < pr * 1.4) {
    var q = r / pr;
    h += 60 * (1 - sstep(1, 1.4, q)) - (q < 1 ? 860 * (1 - smoothT(sstep(0.4, 1, q))) : 0);
    if (r < 1700) {
      var qd = r / 1600;
      var dome = 420 * Math.pow(Math.max(0, 1 - qd * qd), 0.8);
      // Split by radial and concentric fractures.
      var ang = Math.atan2(oz, ox) * 7 + valueNoise(ox * 0.004, oz * 0.004) * 3;
      dome -= (1 - sstep(0, 0.12, Math.abs(Math.sin(ang)))) * 25 * qd;
      h += dome;
    }
    OC_FAC = 1 - sstep(0.75, 1.05, q + (valueNoise(ox * 0.002, oz * 0.002) - 0.5) * 0.35);
  }
  // The Vinalia Faculae: thin, patchy, on the eastern floor.
  if (ox > 5000 && d < 0.55) {
    var v = sstep(0.62, 0.75, fbm(ox * 0.0005 + 1, oz * 0.0005 - 3, 3)) * sstep(5000, 9000, ox) * 0.45;
    if (v > OC_FAC) OC_FAC = v;
  }
  return h;
}

function hCeres(x, z) {
  var h = (fbm(x * 0.00002 + 3, z * 0.00002 - 1, 4) - 0.5) * 2500;
  h += (fbm(x * 0.0003 - 2, z * 0.0003 + 6, 3) - 0.5) * 60;
  h += (fbm(x * 0.003 + 4, z * 0.003, 2) - 0.5) * 7;
  h += (fbm(x * 0.03, z * 0.03 - 2, 2) - 0.5) * 1.1;
  h += (fbm(x * 0.15 + 1, z * 0.15, 2) - 0.5) * 0.18;
  h += ceOccator(x, z);
  return h + craterAt(x, z);
}

function tintCeres(x, z, h, slope, fresh, dark, yel, hol, out) {
  var v;
  // Ceres is dark, a reflectance of about 0.09, and nearly grey —
  // carbonaceous rock, clays and salts. Fresh craters are a little
  // brighter and bluer. The faculae are sodium carbonate, five times
  // brighter than the ground, white with a cream cast.
  ceOccator(x, z);
  var fac = OC_FAC;
  var n1 = valueNoise(x * 0.0008 + 1.7, z * 0.0008 - 2.2), n2 = valueNoise(x * 0.05, z * 0.05);
  var cl = fresh * WORLD.halo;
  v = (0.62 + (n1 - 0.5) * 0.12 + (n2 - 0.5) * 0.08 + slope * 0.18 + cl) ;
  out[0] = v * 1.0; out[1] = v * 0.99; out[2] = v * (0.98 + cl * 0.06);
  if (fac > 0) {
    var fv = 3.4 + (n2 - 0.5) * 0.6;
    var fk = fac * (0.75 + 0.25 * n2);
    out[0] += (fv - out[0]) * fk; out[1] += (fv * 0.99 - out[1]) * fk; out[2] += (fv * 0.95 - out[2]) * fk;
  }
}

/* Ceres, the largest body in the asteroid belt: dark carbonaceous
   regolith, salts and ice, and craters with straight-sided, polygonal
   rims, guided by fractures in the crust (Otto et al. 2016). Large
   craters are fewer than a rocky body this old should keep — the
   ice-rich crust relaxes the biggest away — and the transition to
   complex is at 7.5–12 km (Hiesinger et al. 2016). Classes flagged old
   are absent from Occator's young floor. See hCeres(). Seed: New
   Year's night 1801, when Giuseppe Piazzi found it. */
export const terrain = {
  id: 'ceres', seed: 18010101,
  g: 0.284, R: 469700,
  lander: [13.5, -16.1],
  craters: [
    { cell: 20480, salt:  7, rMin: 2500, rMax: 10000, count: 1, prob: 0.45, ageK: 1.4, old: 1, poly: 1 },
    { cell:  5120, salt: 13, rMin:  600, rMax:  2500, count: 1, prob: 0.60, ageK: 1.8, old: 1, poly: 1 },
    { cell:  1280, salt: 29, rMin:  150, rMax:   600, count: 1, prob: 0.60, ageK: 2.2, old: 1, rocks: 1 },
    { cell:   320, salt: 41, rMin:   30, rMax:   150, count: 1, prob: 0.30, ageK: 2.0, rocks: 1 },
    { cell:    64, salt: 53, rMin:    5, rMax:    30, count: 1, prob: 0.30, ageK: 2.3, rocks: 1 },
  ],
  craterAmp: 1, depthK: 0.9, rampart: 0, halo: 0.35,
  Dtr: 10000,
  height: hCeres,
  tint: tintCeres,
  // Occator's floor is twenty million years old.
  oldVeto(px, pz) { var ocx = px - OC_X, ocz = pz - OC_Z; return ocx * ocx + ocz * ocz < OC_R * OC_R * 0.81; },
};
