import { cellRnd, craterAt, rayBrightness } from '../../kernel/craters';
import { fbm, sstep, valueNoise } from '../../kernel/noise';
import { TN_Z } from '../../kernel/terrain';
import { WORLD } from '../../kernel/world';
import { CA_AP, CA_KN, callistoKnobs, knobCacheReset } from '../common/knobs';

/* ── Callisto ───────────────────────────────────────────────────
   On the outer ring zone of Valhalla, the largest multi-ring impact
   structure in the solar system: a bright central plain 600 km across
   and around it rings out to nearly 2,000 km from the centre — on the
   inside ridges, out here graben, troughs a few kilometres wide and a
   few hundred metres deep between inward-facing fault scarps, running
   concentric for hundreds of kilometres in broken segments. The
   centre is 775 km east of the site, so here they run north–south.

   Everything else is what sublimation has done to a saturated
   cratered plain (Moore et al. 1999, 2004): the small craters are
   gone, their rims reduced to knobs — steep, isolated hills tens of
   metres to a hundred high and a few hundred across, frosted bright
   on top — and the lows are filled with the dark lag, so between the
   knobs the ground is smoother at the metre scale than the Moon's.
   Knobs gather on the rims of the degraded craters they came from
   (classes flagged knob), and thinly everywhere else. */
var CA_OX = 0, CA_OZ = 0;
var CA_VX = 775000, CA_VZ = 60000, CA_RL = 28000;
// Arc length along a ring is measured from the line through the site,
// where the angle is near zero, so atan2's wrap falls 1,500 km away.
function caRings(x, z) {
  var dx = x - CA_VX, dz = z - CA_VZ;
  var rho = Math.sqrt(dx * dx + dz * dz);
  var li = Math.floor(rho / CA_RL);
  if (cellRnd(li, 0, 61, 0) > 0.7) return 0;
  var s = Math.atan2(dz, -dx) * CA_VX;
  // A ring is a chain of graben segments tens of kilometres long.
  var seg = sstep(0.36, 0.5, valueNoise(s * 0.000022 + li * 3.1, li * 0.7));
  if (seg <= 0) return 0;
  var w = 1100 + cellRnd(li, 0, 61, 1) * 1900;              // floor half-width
  var D = (220 + cellRnd(li, 0, 61, 2) * 480) * seg;        // depth
  var cen = (li + 0.5) * CA_RL + (valueNoise(s * 0.00004, li * 1.9) - 0.5) * 7000;
  // The widest it reaches, 3 km + 1.2 km of wall + 3.5 km of wander,
  // stays inside the 14 km half-lane.
  var t = rho - cen; if (t < 0) t = -t;
  if (t > w + 1200) return 0;
  // Fault scarps, steep but degraded, the outer one taller: these are
  // inward-facing, the ground beyond stepping up.
  var g = 1 - sstep(w, w + 1200, t);
  return -D * g * g * (3 - 2 * g) + (rho > cen ? D * 0.12 * g : 0);
}

function hCallisto(x0, z0) {
  var x = x0 + CA_OX, z = z0 + CA_OZ;
  var h = (fbm(x * 0.00003, z * 0.00003, 4) - 0.5) * 900;           // regional swells
  h += (fbm(x * 0.0003 + 5, z * 0.0003 - 3, 3) - 0.5) * 70;         // rolling plain
  // The lag fills the lows, so below a hundred metres the plain is
  // smoother than the Moon's.
  h += (fbm(x * 0.003 - 7, z * 0.003 + 2, 2) - 0.5) * 5;
  h += (fbm(x * 0.03, z * 0.03, 2) - 0.5) * 0.7;
  h += (fbm(x * 0.15 + 2, z * 0.15, 2) - 0.5) * 0.12;
  h += caRings(x, z);
  // Knobs came from the craters, so they stay with them, unshifted.
  h += callistoKnobs(x0, z0);
  return h + craterAt(x0, z0);
}

function tintCallisto(x, z, h, slope, fresh, dark, yel, hol, out) {
  var v;
  // Callisto is dark: a lag of non-ice material, grey-brown and a
  // little red, at a reflectance of about 0.2 — what is left when the
  // ice sublimes out of the surface. The ice that sublimes freezes out
  // again where it is coldest, so there is bright frost, reflectance
  // 0.6 and more, on the slopes that face the pole, and on the crests
  // of the knobs (Spencer 1987; Moore et al. 1999) — high, steep, and
  // shedding the lag as fast as it forms. Fresh craters punch through
  // to clean ice: bright halos and rays.
  callistoKnobs(x, z, true);
  var n1 = valueNoise(x * 0.0007 + 1.3, z * 0.0007 - 4.4), n2 = valueNoise(x * 0.045, z * 0.045);
  var cl = fresh * WORLD.halo + rayBrightness(x, z);
  var fz = sstep(0.06, 0.32, TN_Z + (n2 - 0.5) * 0.12) * (0.55 + 0.45 * n1);
  var fr = fz + sstep(0.4, 0.75, CA_KN + (n2 - 0.5) * 0.25) * 0.95 + sstep(0.3, 0.6, slope) * 0.3 + cl;
  fr = fr > 1 ? 1 : fr;
  v = (0.62 + (n1 - 0.5) * 0.16) * (0.93 + n2 * 0.14) * (1 - CA_AP * 0.22);
  out[0] = v * 1.06; out[1] = v; out[2] = v * 0.90;
  var fv = 2.1 + (n2 - 0.5) * 0.3;
  out[0] += (fv - out[0]) * fr; out[1] += (fv - out[1]) * fr; out[2] += (fv * 1.02 - out[2]) * fr;
}

/* Callisto: the most heavily cratered surface in the solar system,
   saturated at the large end — but short of small craters, under
   about a kilometre, by an order of magnitude and more (Moore et al.
   1999; Bierhaus et al.). The ice in a crater's wall sublimes in the
   sun, the dark non-ice part stays behind as a lag that slumps into
   the lows, and the rims break down into isolated knobs, so what
   would be a saturated field of small bowls on the Moon is a smooth
   dark plain with bright knobs on it. Past the transition the
   craters are complex, and past ~30 km they have a pit where a
   rocky body's would have a peak (Schenk 1993). The smallest class
   here is a sixteenth of the lunar density for its size, the next
   a quarter, then the curve. See hCallisto().
   Seed: 13 January 1610, the night Galileo first saw all four. */
export const terrain = {
  id: 'callisto', seed: 16100113,
  g: 1.235, R: 2410300,
  lander: [26.8, 8],
  craters: [
    { cell: 65536, salt:  7, rMin: 8000, rMax: 30000, count: 1, prob: 0.50, ageK: 1.2 },
    { cell: 16384, salt: 13, rMin: 2000, rMax:  8000, count: 2, prob: 0.80, ageK: 1.5, rays: 1, knob: 1 },
    { cell:  4096, salt: 29, rMin:  500, rMax:  2000, count: 2, prob: 0.75, ageK: 2.4, knob: 1 },
    { cell:  1024, salt: 41, rMin:  120, rMax:   500, count: 1, prob: 0.35, ageK: 3.2, rocks: 1 },
    { cell:   256, salt: 59, rMin:   25, rMax:   120, count: 1, prob: 0.12, ageK: 2.6, rocks: 1 },
  ],
  craterAmp: 1, depthK: 0.85, rampart: 0, halo: 0.6,
  // Transition a few kilometres across on Ganymede and Callisto, about
  // half Europa's (Schenk 2002); central pits from ~30 km.
  Dtr: 3000, pitD: 30000,
  height: hCallisto,
  tint: tintCallisto,
  reset() { knobCacheReset(); },
};
