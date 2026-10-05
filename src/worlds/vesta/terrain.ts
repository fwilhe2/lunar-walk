import type { TerrainDef } from '../types';
import { cellRnd, craterAt, rayBrightness } from '../../kernel/craters';
import { fbm, ridged, sstep, valueNoise } from '../../kernel/noise';
import { WORLD } from '../../kernel/world';

/* ── Vesta ──────────────────────────────────────────────────────
   Around Vesta's equator runs Divalia Fossa: a set of troughs that
   goes two-thirds of the way round, the largest 465 km long, 20-odd km
   wide and up to 5 km deep (Jaumann et al. 2012), flat-floored graben
   between steep walls. They are concentric to Rheasilvia, the basin
   500 km across that a giant impact punched into the south pole a
   billion years ago; the shock cracked the whole crust. Everything is
   cratered nearly to saturation, and the walls of everything are
   steep — on a body this small slopes of 30° and more hold.

   Troughs in lanes, one at most per 34 km lane, each kept inside its
   lane; the site is on the north rim of one, which drops 4.5 km in
   front of you. VE_DK is how much dark material is at the last query,
   for the colour pass. */
var VE_LANE = 34000, VE_OX = -100000, VE_OZ = 74250;
function veTrough(x0, z) {
  var x = x0 + VE_OX;
  var t = z + VE_OZ + (valueNoise(x * 0.00002, 5.5) - 0.5) * 6000;
  var li = Math.floor(t / VE_LANE);
  if (cellRnd(li, 0, 89, 0) > 0.85) return 0;
  var seg = sstep(0.18, 0.32, valueNoise(x * 0.000008 + li * 2.3, li * 0.9 + 0.5));
  if (seg <= 0) return 0;
  // Half-width at the rim 8–12 km, the floor a third of that; the widest
  // reach, 12 km + 3 km of wander, stays inside the 17 km half-lane.
  var hw = 8000 + 4000 * cellRnd(li, 0, 89, 1), D = (3000 + 2000 * cellRnd(li, 0, 89, 2)) * seg;
  var a = (t - (li + 0.5) * VE_LANE) / hw; if (a < 0) a = -a;
  if (a >= 1) return 0;
  var g = sstep(0.35, 1, a);
  // Walls: steep, degraded, gullied; floor rubble.
  return -D * (1 - g) + D * 0.06 * (ridged(x * 0.0005 + li, z * 0.0005, 3) - 0.35) * g * (1 - g) * 4;
}
function hVesta(x, z) {
  var h = (fbm(x * 0.00002 - 3, z * 0.00002 + 1, 4) - 0.5) * 3500;
  h += veTrough(x, z);
  h += (fbm(x * 0.0003 + 2, z * 0.0003 - 6, 3) - 0.5) * 120;
  h += (fbm(x * 0.003 - 5, z * 0.003, 2) - 0.5) * 10;
  h += (fbm(x * 0.03, z * 0.03 + 4, 2) - 0.5) * 1.2;
  h += (fbm(x * 0.15, z * 0.15 - 1, 2) - 0.5) * 0.2;
  return h + craterAt(x, z);
}

function tintVesta(x, z, h, slope, fresh, dark, yel, hol, out) {
  var v;
  // Vesta is bright for a rocky body, about 0.4 — basalt, its pyroxene
  // giving it a faint warm cast — with dark material, carbonaceous
  // debris from impactors at 0.1, smeared in patches and streaks over
  // it, and bright fresh ejecta and rays where craters dug clean rock
  // out of the slopes (Reddy et al. 2012; McCord et al. 2012).
  var n1 = valueNoise(x * 0.0007 + 4.4, z * 0.0007 - 2), n2 = valueNoise(x * 0.05, z * 0.05);
  var dkm = sstep(0.62, 0.78, fbm(x * 0.00012 + 9, z * 0.00012 - 3, 3)) * (0.6 + 0.4 * n1);
  var cl = fresh * WORLD.halo + rayBrightness(x, z);
  v = (1.0 + (n1 - 0.5) * 0.14 + (n2 - 0.5) * 0.1 + slope * 0.35 + cl) * (1 - dkm * 0.65);
  out[0] = v * 1.04; out[1] = v * 1.0; out[2] = v * 0.93;
}

/* Vesta: a protoplanet that kept its basalt crust — the meteorites
   called HEDs come from it — battered to near saturation, with fresh
   craters bright-rayed and some dark-rayed, where they dug into
   carbonaceous debris from impactors (Reddy et al. 2012). In gravity
   this weak no crater in reach is complex. See hVesta(). Seed: 29
   March 1807, when Heinrich Olbers found it. */
export const terrain: TerrainDef = {
  id: 'vesta', seed: 18070329,
  g: 0.25, R: 262700,
  lander: [8, 17.2],
  craters: [
    { cell: 40960, salt:  7, rMin: 5000, rMax: 20000, count: 1, prob: 0.45, ageK: 1.4 },
    { cell: 10240, salt: 13, rMin: 1200, rMax:  5000, count: 1, prob: 0.70, ageK: 1.8, rays: 1 },
    { cell:  2560, salt: 29, rMin:  300, rMax:  1200, count: 2, prob: 0.70, ageK: 2.0 },
    { cell:   640, salt: 73, rMin:   60, rMax:   300, count: 2, prob: 0.60, ageK: 2.2, rocks: 1 },
    { cell:   160, salt: 53, rMin:   15, rMax:    60, count: 2, prob: 0.60, ageK: 2.4, rocks: 1 },
    { cell:    32, salt: 61, rMin:    3, rMax:    12, count: 1, prob: 0.40, ageK: 2.5, rocks: 1 },
  ],
  craterAmp: 1, depthK: 0.9, rampart: 0, halo: 0.45,
  Dtr: 38000,
  height: hVesta,
  tint: tintVesta,
};
