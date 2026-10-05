import { craterAt } from '../../kernel/craters';
import { fbm, hash2, sstep, valueNoise } from '../../kernel/noise';
import { WORLD } from '../../kernel/world';

/* ── Phobos and Deimos ──────────────────────────────────────────
   Captured asteroids with kilometres of relief on a body you
   could walk around in an afternoon, buried under regolith and
   saturated with craters. Phobos also carries the grooves.

   Groove spacings are the real ones — a few hundred metres, over
   most of the body, so from anywhere on Phobos you are standing
   in or beside one. Any wider and they are further apart than
   that body's horizon, and you could never find them at all.    */
var GRV_A = [0.32, 1.19, 2.35];      // three families, three bearings
var GRV_S = [430, 560, 330];         // and three spacings

export function hSmall(x: number, z: number) {
  // Phobos and Deimos, the only worlds that call this, set all four moonlet fields.
  var rel = WORLD.relief!, fine = WORLD.fine!;
  var nx = x * 0.00055, nz = z * 0.00055;

  var h = (fbm(nx, nz, 5) - 0.5) * rel;                          // the body's own shape
  h += (fbm(nx * 4.3 + 15, nz * 4.3 - 22, 4) - 0.5) * rel * 0.22;
  h += (fbm(nx * 31 + 3, nz * 31 + 8, 3) - 0.5) * 2.4 * fine;    // regolith relief
  h += (fbm(nx * 120, nz * 120, 2) - 0.5) * 0.5 * fine;

  // Grooves: parallel troughs 100–200 m wide, only in some lanes,
  // and deepening into chains of pits along their length.
  var gv = WORLD.groove!;
  if (gv > 0) {
    for (var gi = 0; gi < 3; gi++) {
      var a = GRV_A[gi]!, sp = GRV_S[gi]!;
      var u = (x * Math.cos(a) + z * Math.sin(a)) / sp;
      var lane = Math.floor(u);
      if (hash2(lane, 977 + gi * 31) > 0.42) continue;
      var t = u - lane - 0.5;
      var along = z * Math.cos(a) - x * Math.sin(a);
      var amp = 0.35 + valueNoise(along * 0.0045 + gi * 40, gi * 7.3) * 1.15;
      h -= Math.exp(-t * t * 34) * gv * amp;
    }
  }
  return h + craterAt(x, z);
}

export function tintMoonlet(x: number, z: number, h: number, slope: number, fresh: number, dark: number, yel: number, hol: number, out: number[]) {
  var v;
  // Both moons are D-type: near-black, and spectrally red. Phobos
  // has two units, a redder one over most of the body and a bluer
  // one dug out around the big crater; the mask stands in for it.
  v = 0.40 * WORLD.albedoK! + slope * 0.12 + fresh * WORLD.halo! * 0.4;
  v *= 0.86 + valueNoise(x * 0.05, z * 0.05) * 0.30;
  v = v < 0.16 ? 0.16 : v > 0.85 ? 0.85 : v;
  var u = sstep(0.42, 0.62, fbm(x * 0.00035 + 3.3, z * 0.00035 - 9.1, 3));
  out[0] = v * (0.94 + u * 0.18);
  out[1] = v * (0.95 + u * 0.02);
  out[2] = v * (1.00 - u * 0.12);
}
