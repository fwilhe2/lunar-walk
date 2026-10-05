import { hash2, smoothT } from '../../kernel/noise';

/* ── Neptune ────────────────────────────────────────────────────
   As Voyager 2 saw it in 1989, in true colour: not the deep azure of
   the famous contrast-stretched pictures but a pale greenish blue, a
   shade bluer than Uranus (Irwin et al. 2024) — methane taking the red
   out of sunlight scattered deep in a clear atmosphere. Faint banding,
   a darker belt round the south polar region, and the weather: the
   Great Dark Spot at 20°S, an oval the size of Earth with bright
   methane cirrus hugging its southern edge; the small bright Scooter
   further south; the second dark spot, D2, with a bright core; and
   long streaks of white cirrus stretched along the latitudes by winds
   that blow at 400 m/s, the fastest in the solar system. */
export function neptunePixels(W: number, H: number) {
  const px = new Uint8ClampedArray(W * H * 4);
  const pn = (x: number, y: number, P: number) => {
    const xi = Math.floor(x), yi = Math.floor(y), u = smoothT(x - xi), v = smoothT(y - yi);
    const x0 = ((xi % P) + P) % P, x1 = (x0 + 1) % P;
    return (hash2(x0, yi) * (1 - u) + hash2(x1, yi) * u) * (1 - v) + (hash2(x0, yi + 1) * (1 - u) + hash2(x1, yi + 1) * u) * v;
  };
  // Ovals: [lon °, lat °, half-length °, half-width °, r, g, b, strength]
  const SPOTS = [
    [200, -20, 18, 8, 64, 92, 148, 0.85],     // Great Dark Spot
    [292, -55, 6, 3.5, 84, 112, 166, 0.7],     // D2
    [292, -55, 1.6, 1.2, 226, 234, 240, 0.8],  // its bright core
    [250, -42, 3, 1.4, 236, 240, 244, 0.85],   // the Scooter
  ] as const;
  for (let y = 0; y < H; y++) {
    const v = (y + 0.5) / H, lat0 = 90 - v * 180;
    for (let x = 0; x < W; x++) {
      const u = (x + 0.5) / W, lon = u * 360;
      const lat = lat0 + (pn(u * 16, v * 50, 16) - 0.5) * 2.0;
      // Base colour, with a gentle band structure and the dark belt at
      // 60–70°S, and the brighter polar caps of haze.
      let r = 150, g = 186, b = 222;
      const band = Math.cos(lat * 0.21) * 0.035 + Math.cos(lat * 0.55 + 1) * 0.02;
      const belt = Math.exp(-((lat + 63) * (lat + 63)) / 40) * 0.16;
      const k = 1 + band - belt + (pn(u * 60, v * 160, 60) - 0.5) * 0.03;
      r *= k; g *= k; b *= k;
      // Cirrus streaks: thin, bright, long in longitude, at the
      // latitudes where the jets shear them out.
      const ci = (Math.exp(-((lat + 27) * (lat + 27)) / 30) + Math.exp(-((lat - 25) * (lat - 25)) / 50) * 0.6 + Math.exp(-((lat + 70) * (lat + 70)) / 12) * 0.4)
               * Math.pow(Math.max(0, pn(u * 24, v * 220, 24) - 0.62) / 0.38, 1.6);
      r += (238 - r) * ci; g += (242 - g) * ci; b += (246 - b) * ci;
      for (const sp of SPOTS) {
        let dl = lon - sp[0]; dl -= Math.round(dl / 360) * 360;
        const e = (dl / sp[2]) * (dl / sp[2]) + ((lat0 - sp[1]) / sp[3]) * ((lat0 - sp[1]) / sp[3]);
        if (e < 1.6) { const a = sp[7] * (1 - smoothT(Math.min(1, Math.max(0, (e - 0.6) / 1.0)))); r += (sp[4] - r) * a; g += (sp[5] - g) * a; b += (sp[6] - b) * a; }
      }
      // The Great Dark Spot's companion clouds, along its southern edge.
      { let dl = lon - 200; dl -= Math.round(dl / 360) * 360;
        const e = (dl / 16) * (dl / 16) + ((lat0 + 29.5) / 2.2) * ((lat0 + 29.5) / 2.2);
        if (e < 1) { const a = (1 - e) * 0.9 * Math.max(0, pn(u * 90, v * 200, 90) - 0.25) / 0.75; r += (240 - r) * a; g += (244 - g) * a; b += (248 - b) * a; } }
      const o = (y * W + x) * 4;
      px[o] = r; px[o + 1] = g; px[o + 2] = b; px[o + 3] = 255;
    }
  }
  return px;
}
