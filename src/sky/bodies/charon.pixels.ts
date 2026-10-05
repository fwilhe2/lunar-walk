import { fbm } from '../../kernel/noise';

/* ── Charon ─────────────────────────────────────────────────────
   Half Pluto's size, water ice at a reflectance of about 0.4, and
   grey — except for its north pole, Mordor Macula, which is stained
   red-brown by methane that escaped Pluto, froze out onto Charon's
   cold winter pole and was cooked into tholin by sunlight. Around
   its middle runs a belt of canyons, Serenity and Mandjet Chasma,
   where the crust split as an ocean underneath froze and swelled;
   south of it are the smoother plains of Vulcan Planitia, resurfaced
   from below. Charon is locked to Pluto as Pluto is to it, so the
   face you see never changes. */
// Pure, so it can run off the main thread (OFF_THREAD).
export function charonPixels() {
  const W = 512, H = 256, DEG = Math.PI / 180;
  const smoothstep = (v, a, b) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
  const data = new Uint8ClampedArray(W * H * 4);
  let s = 2015; const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const craters = Array.from({ length: 150 }, () =>
    [rnd() * W, Math.acos(1 - 2 * rnd()) / Math.PI * H, 0.8 + Math.pow(rnd(), 3) * 6, rnd()]);
  // The canyon belt: a few long troughs, roughly east–west, wandering.
  const troughs = Array.from({ length: 3 }, () => [4 + rnd() * 16, rnd() * 6.28, 1.6 + rnd() * 1.4]);
  for (let y = 0; y < H; y++) {
    const lat = 90 - (y + 0.5) / H * 180;
    for (let xx = 0; xx < W; xx++) {
      const lon = ((xx + 0.5) / W * 360 + 180) % 360;   // centred on 0, which faces Pluto
      const n1 = fbm(xx * 0.02 + 5, y * 0.02, 4), n2 = fbm(xx * 0.09, y * 0.09 - 3, 3);
      const plains = smoothstep(-lat, 0, 12);
      let v = 160 + (n1 - 0.5) * 50 * (1 - plains * 0.6) + (n2 - 0.5) * 22 + plains * 10;
      let r = v, g = v * 0.99, b = v * 0.975;
      for (const [tl, ph, w] of troughs) {
        const tlat = tl + Math.sin(lon * DEG * 2 + ph) * 3 + Math.sin(lon * DEG * 5 + ph * 2) * 1.2;
        const d = Math.abs(lat - tlat) / w;
        if (d < 2.2) {
          const k = Math.exp(-d * d * 2) * 0.35 - Math.exp(-(d - 1.2) * (d - 1.2) * 6) * 0.15;
          r -= k * 90; g -= k * 90; b -= k * 88;
        }
      }
      const mordor = smoothstep(lat + (n1 - 0.5) * 14, 52, 72);
      r += (104 - r) * mordor; g += (66 - g) * mordor; b += (50 - b) * mordor;
      for (const [cx, cy, cr, ck] of craters) {
        let dx = Math.abs(xx - cx); dx = Math.min(dx, W - dx);
        const d = Math.hypot(dx * Math.max(0.2, Math.cos(lat * DEG)), y - cy) / cr;
        if (d > 3) continue;
        // Most fresh craters are bright; a few, like Organa, threw
        // out dark, ammonia-rich ice instead.
        const tone = ck > 0.92 ? 70 : 225;
        const k = d < 1 ? (1 - d) * 0.7 : Math.max(0, 1 - (d - 1) / 2) * 0.18 * (ck > 0.6 ? 1 : 0);
        r += (tone - r) * k; g += (tone - g) * k; b += (tone * 1.01 - b) * k;
      }
      const o = (y * W + xx) * 4;
      data[o] = r; data[o + 1] = g; data[o + 2] = b; data[o + 3] = 255;
    }
  }
  return data;
}
