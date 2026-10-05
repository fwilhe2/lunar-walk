import { craterAt } from '../../kernel/craters';
import { fbm, hash2, ridged, sstep, valueNoise } from '../../kernel/noise';

/* ── Venus ──────────────────────────────────────────────────────
   Nothing you can see here was made by an impact, and almost
   nothing by wind. Venus resurfaced itself around 500 Myr ago and
   most of what you are standing on is the flood of basalt that
   did it: sheets a few metres thick that end in steep fronts,
   buckled into wrinkle ridges where the plain shortened as it
   cooled, and pulled open into fracture swarms where it did not.

   The old crust survives as tessera — the ridge-and-groove
   terrain that Ovda Regio is made of, two fabrics crossing at an
   angle, the roughest ground on the planet, standing a kilometre
   above the lava that is drowning it. Half the sky on this world
   is haze, so the tessera is also the only thing far away worth
   looking at.

   The one thing wind does do is nothing you can see from here:
   at 65 kg/m³ the air moves sand at half a metre a second, but
   there is almost no sand to move — two dune fields on the whole
   planet.                                                        */
var TESS_A = 1.05, TESS_C = Math.cos(TESS_A), TESS_S = Math.sin(TESS_A);
var WRNK_C = Math.cos(2.10), WRNK_S = Math.sin(2.10);
var GRB_C = [Math.cos(0.55), Math.cos(1.83)];
var GRB_S = [Math.sin(0.55), Math.sin(1.83)];
var GRB_SP = [1450, 2100];

// Where the old crust still stands above the flows. Shared with the
// colour pass: tessera is swept barer than the plains it interrupts.
function tesseraMask(x, z) {
  return sstep(0.44, 0.62, fbm(x * 0.000085 + 5.5, z * 0.000085 - 2.2, 3));
}

function hVenus(x, z) {
  var nx = x * 0.0011, nz = z * 0.0011;

  var h = (fbm(nx, nz, 5) - 0.5) * 54;                          // regional swell
  h += (fbm(nx * 5.3 + 26, nz * 5.3 - 14, 4) - 0.5) * 7;        // flow-field relief
  h += (fbm(nx * 21 - 6, nz * 21 + 11, 3) - 0.5) * 1.5;         // metre relief
  h += (fbm(nx * 63, nz * 63, 2) - 0.5) * 0.30;                 // slab and soil grain

  // Tessera: two fabrics at ~60° to each other, the coarse one on a
  // three-kilometre wavelength and the fine one on about one. Gated
  // like the lunar highlands and for the same reason — ridged() is
  // the most expensive thing in the kernel.
  var tk = tesseraMask(x, z);
  if (tk > 0.004) {
    var k = tk * tk;
    h += ridged(nx * 0.29 - 62, nz * 0.29 + 38, 4) * k * 620;
    var rx = x * TESS_C + z * TESS_S, rz = z * TESS_C - x * TESS_S;
    h += ridged(rx * 0.00095 + 9, rz * 0.00095 - 51, 3) * k * 115;
  }

  // Everything else belongs to the plains, and fades out where the
  // tessera takes over — the flows lap against it, not over it.
  var pk = 1 - tk;
  if (pk > 0.004) {
    // Lava sheets. Each flow is a few metres thick and ends in a
    // front, so the plain is a stack of low steps rather than a
    // smooth surface: flat for most of each unit, then a scarp.
    var t = fbm(nx * 8.2 + 17, nz * 8.2 - 33, 4) * pk * 7.5;
    var fi = Math.floor(t);
    h += (fi + sstep(0.70, 1.0, t - fi)) * 4.5;

    // Wrinkle ridges: sinuous, and the most common landform on the
    // plains. The real spacing is 15–30 km, which is several times
    // past anything you can see through this air; at 3.5 km you
    // actually meet one, which is the same compression the Phobos
    // grooves get, for the same reason.
    var u = (x * WRNK_C + z * WRNK_S) / 3500 + valueNoise(x * 0.00055, z * 0.00055) * 1.8;
    var lane = Math.floor(u);
    if (hash2(lane, 613) < 0.5) {
      var tt = u - lane - 0.5;
      h += Math.exp(-tt * tt * 42) * pk * (14 + hash2(lane, 811) * 22);
    }

    // Fracture swarms: flat-floored graben a hundred-odd metres
    // across, in two families, cutting the flows they post-date.
    for (var gi = 0; gi < 2; gi++) {
      var gu = (x * GRB_C[gi] + z * GRB_S[gi]) / GRB_SP[gi];
      var gl = Math.floor(gu);
      if (hash2(gl, 419 + gi * 57) > 0.38) continue;
      var gt = gu - gl - 0.5;
      h -= Math.exp(-gt * gt * 900) * 13 * pk;
    }
  }

  return h + craterAt(x, z);
}

/* The frost line. Venus has one climate — 464 °C at the datum,
   everywhere, day and night — but it lapses about 8 K per km, so
   above roughly 4.75 km the ground is cool enough for heavy metal
   sulphides (galena and bismuthinite, most likely) to condense out
   of the air onto it as a bright coating. Every radar map of the
   highlands shows it, as a hard emissivity line that ignores the
   geology and follows the contour.

   The site is on Ovda Regio, whose floor sits at 4.3 km, so the
   line falls at about 420 m in local terms and only the tessera
   crests reach it.                                               */
var FROST_H = 420;

function tintVenus(x, z, h, slope, fresh, dark, yel, hol, out) {
  var v;
  // Venus is one rock. A planet's worth of basalt went down in a
  // single resurfacing and nothing since has had the chance to
  // make a second kind, so what varies is only how much of the
  // dark fine soil has gathered on it: slabs and steep ground are
  // swept bare and read brighter, hollows pool it and go dark.
  // The colour is grey — everything orange about a Venera
  // panorama is the light, not the ground, so none of it is
  // painted in here.
  v = 0.50 + slope * 0.30 + tesseraMask(x, z) * 0.08;
  v *= 0.90 + valueNoise(x * 0.0042, z * 0.0042) * 0.22;   // flow units
  v *= 0.90 + valueNoise(x * 0.06, z * 0.06) * 0.22;       // slabs and soil
  v = v < 0.26 ? 0.26 : v > 0.92 ? 0.92 : v;
  out[0] = v; out[1] = v * 0.985; out[2] = v * 0.955;

  // Above the frost line the rock is under a coat of condensed
  // metal, which is bright and faintly cold-toned against basalt.
  var fr = sstep(FROST_H, FROST_H + 60, h);
  if (fr > 0) {
    var fm = 0.86 + valueNoise(x * 0.02, z * 0.02) * 0.30;
    out[0] += (fm * 0.95 - out[0]) * fr;
    out[1] += (fm * 0.98 - out[1]) * fr;
    out[2] += (fm * 1.06 - out[2]) * fr;
  }
}

/* Venus. The atmosphere writes the whole surface here — not by
   eroding it, the way wind does on Mars, but by standing in the
   way of everything that would otherwise hit it. 92 bar shields
   the ground so completely that there is no impact crater on
   Venus smaller than about 1.5 km: anything that would make one
   is torn apart and decelerated before it arrives. So there is
   exactly one crater class, it is enormous, and it is almost
   never there. Venus has ~1000 craters on 460 million km² — one
   per 680 km square — because the planet resurfaced itself with
   lava around 500 Myr ago and started the count over.

   What is left to look at is that lava, and the crust it
   drowned. See hVenus().

   Rc is the curvature radius the *ground* appears to have, and
   it is negative here; that is not a typo. See curveDrop().    */
export const terrain = {
  id: 'venus', seed: 19751022,
  g: 8.87, R: 6051800, Rc: -1330000,
  lander: [7.5, -27],
  craters: [
    // Skewed young, not old: about 85% of Venus's craters are pristine
    // (Schaber et al. 1992), since little has touched them since.
    { cell: 32768, salt: 7, rMin: 900, rMax: 12000, count: 1, prob: 0.05, ageK: 0.35 },
  ],
  // Venusian craters are shallow for their size — a 24 km bowl is
  // under a kilometre deep — and they end in lobate outflows,
  // fluidised by the atmosphere they punched through, which is
  // what the rampart term draws.
  craterAmp: 1, depthK: 0.18, rampart: 0.8,
  // Nearly every Venusian crater over ~11–15 km is complex, most with
  // a central peak; below that they are irregular, from impactors
  // the air broke up (Schaber et al. 1992).
  Dtr: 11000,
  height: hVenus,
  tint: tintVenus,
};
