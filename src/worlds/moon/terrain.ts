import { cellRnd, craterAt, rayBrightness } from '../../kernel/craters';
import { fbm, ridged, sstep, valueNoise } from '../../kernel/noise';
import { WORLD } from '../../kernel/world';

/* ── The Moon ───────────────────────────────────────────────── */
function hMoon(x, z) {
  var nx = x * 0.0021, nz = z * 0.0021;

  var h = (fbm(nx, nz, 5) - 0.5) * 16;                              // broad mare swell
  h += (fbm(nx * 6.4 + 40, nz * 6.4 - 17, 4) - 0.5) * 2.6;          // wrinkle ridges
  h += (fbm(nx * 22 - 8, nz * 22 + 3, 3) - 0.5) * 1.1;              // dune-scale relief
  h += (fbm(nx * 58, nz * 58, 2) - 0.5) * 0.32;                     // regolith grain

  // Highland provinces: a low-frequency continental mask decides
  // where the mare gives way to ridged anorthosite massifs, so a
  // long traverse crosses plains, then mountains, then plains.
  // The ridged terms cost more than everything else combined, so
  // they are skipped entirely where the mask is closed.
  var hl = highlandMask(x, z);
  // Rilles are cut into the mare, so they die out into the highlands.
  if (hl < 0.996) h += moonRille(x, z) * (1 - hl);
  if (hl > 0.004) {
    var k = hl * hl;
    h += ridged(nx * 1.55 - 90, nz * 1.55 + 55, 5) * k * 95;
    h += ridged(nx * 6.2 + 12, nz * 6.2 - 40, 4) * k * 16;   // craggy detail on top
  }
  return h + craterAt(x, z);
}

/* Sinuous rilles: channels a kilometre or two wide and a few hundred
   metres deep, meandering for tens of kilometres across the mare —
   where lava flowed for long enough to melt its way down into the
   ground beneath it. Hadley Rille, which Apollo 15 drove along the
   rim of, is 1.2 km wide and 300 m deep. Each starts in a source
   pit and runs on until it shallows out.

   Drawn in lanes, the same trick as Charon's graben: at most one
   channel per lane, and its meander, its walls and its source pit
   all kept inside the lane, so a lane boundary can never seam. The
   lanes run NNW–SSE, and RL_O puts one channel across the opening
   view a few kilometres from the landing site. */
var RL_LANE = 14000, RL_C = Math.cos(1.1), RL_S = Math.sin(1.1), RL_O = 10750;

export function moonRille(x, z) {
  var s = x * RL_C + z * RL_S, t = z * RL_C - x * RL_S + RL_O;
  var li = Math.floor(t / RL_LANE);
  if (cellRnd(li, 0, 91, 0) > 0.45) return 0;
  // A rille runs for some tens of kilometres, then the lane is empty.
  var sq = s * 0.000016 + li * 7.31;
  var seg = sstep(0.5, 0.6, valueNoise(sq, li * 0.53));
  if (seg <= 0) return 0;
  var w = 450 + cellRnd(li, 0, 91, 1) * 550;             // half-width
  var A = 900 + cellRnd(li, 0, 91, 2) * 1500;            // meander amplitude
  var k = 0.00045 + cellRnd(li, 0, 91, 3) * 0.0004;      // meander wavenumber, rad/m
  var ph = s * k + valueNoise(s * 0.00003, li * 3.3) * 3;
  var cen = (li + 0.5) * RL_LANE + A * Math.sin(ph);
  // Distance across the channel, not across the lane: a bend running
  // diagonally would otherwise come out narrower than the straights.
  var sl = A * k * Math.cos(ph);
  var dist = Math.abs(t - cen) / Math.sqrt(1 + sl * sl);
  // The widest the source pit can make it: A + 1.3 · 1.8 · w stays
  // under half a lane, so nothing crosses a boundary.
  if (dist > w * 2.34) return 0;
  // Near its upstream end — where the segment has only just begun —
  // the channel opens into the pit it was fed from.
  var head = seg * (1 - sstep(0.5, 0.6, valueNoise(sq - 0.048, li * 0.53)));
  w *= (0.6 + 0.4 * seg) * (1 + 0.8 * head);
  if (dist > w * 1.3) return 0;
  var depth = w * (0.28 + 0.14 * cellRnd(li, 0, 91, 4)) * seg * (1 + 0.4 * head);
  // A flat floor of rubble, and walls at the angle of repose or less.
  return -depth * (1 - sstep(0.2, 1.0, dist / w));
}

// Highland mask alone — the worker uses it to colour anorthosite
// brighter than mare basalt.
function highlandMask(x, z) {
  return sstep(0.55, 0.75, fbm(x * 0.00016 + 7.7, z * 0.00016 - 3.1, 3));
}

function tintMoon(x, z, h, slope, fresh, dark, yel, hol, out) {
  var v;
  // Steep walls shed dust and expose brighter bedrock, crater
  // floors pool dark fines, highlands are anorthosite rather
  // than basalt, fresh ejecta rays streak bright, and every young
  // crater sits in a halo of immature soil the solar wind has not
  // had time to darken.
  var elev = h * 0.010;
  v = 0.60 + (elev < -0.14 ? -0.14 : elev > 0.34 ? 0.34 : elev);
  v += slope * 0.30;
  v += rayBrightness(x, z);
  v += highlandMask(x, z) * 0.22;
  v += fresh * WORLD.halo;
  v *= 0.88 + valueNoise(x * 0.07, z * 0.07) * 0.26;
  // The blast zone: LROC sees every Apollo descent stage in a halo of
  // soil some 10% brighter, a hundred-odd metres across, where the
  // engine swept the fluffy top layer away (Clegg et al. 2014).
  if (WORLD.lander) {
    var bx = x - WORLD.lander[0], bz = z - WORLD.lander[1], b2 = bx * bx + bz * bz;
    if (b2 < 32400) v *= 1 + 0.12 * (1 - sstep(35, 180, Math.sqrt(b2)));
  }
  v = v < 0.30 ? 0.30 : v > 1.45 ? 1.45 : v;
  out[0] = v * 1.005; out[1] = v; out[2] = v * 0.975;
}

export const terrain = {
  id: 'moon', seed: 19690720,
  g: 1.62, R: 1737400,
  /* Saturated at small diameters: four billion years of
     bombardment with nothing to erase any of it. Below a few
     hundred metres a mare surface sits at crater *equilibrium* —
     every new crater erases, on average, one old one — where the
     cumulative density is close to N(>D) = 0.08 D⁻² per m². The
     classes below are sized to land on that curve from 1.6 m to
     a kilometre; most of what they make is old and subdued, and
     only a few are fresh. */
  craters: [
    // The big ones, 5 to 30 km across: rare — a mare surface this age
    // has one crater over 10 km in every hundred-kilometre square or so
    // — but past 15 km complex, and what a long traverse or the view
    // from the flight ceiling finds on the horizon.
    { cell: 40960, salt: 35, rMin: 2500, rMax: 15000, count: 1, prob: 0.40, ageK: 1.0, rays: 1 },
    { cell: 2560, salt:  7, rMin: 230, rMax: 620, count: 1, prob: 0.38, ageK: 1.3, rays: 1 },  // basins
    { cell:  640, salt: 11, rMin:  60, rMax: 230, count: 2, prob: 0.55, ageK: 1.6, rocks: 1, rays: 1 },
    { cell:  160, salt: 23, rMin:  16, rMax:  60, count: 2, prob: 0.80, ageK: 2.0, rocks: 1 },
    { cell:   40, salt: 37, rMin:   4, rMax:  16, count: 2, prob: 0.62, ageK: 2.4, rocks: 1 },
    { cell:    8, salt: 53, rMin: 1.6, rMax:   4, count: 1, prob: 0.40, ageK: 2.6, rocks: 1 },
    { cell:  3.2, salt: 67, rMin: 0.8, rMax: 1.6, count: 1, prob: 0.32, ageK: 2.8 },
  ],
  craterAmp: 1, depthK: 1, rampart: 0,
  // Simple-to-complex transition diameter, m: where Pike's (1977)
  // depth fits break. Flat floors are fully developed by 20 km,
  // central peaks and terraces soon after.
  Dtr: 11000,
  // Fresh ejecta is immature — not yet darkened by the solar wind
  // and micrometeorites — so every young crater wears a bright halo.
  halo: 0.55,
  // Where the lunar module stands (§6c). Its descent engine blew the
  // fines off the ground around it; the colour pass brightens that.
  lander: [23.8, -2.9],
  height: hMoon,
  tint: tintMoon,
};
