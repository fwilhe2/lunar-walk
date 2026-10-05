import { hash2, smoothT } from '../../kernel/noise';

/* ── Uranus ─────────────────────────────────────────────────────
   As Voyager 2 saw it in 1986, in true colour: a pale greenish cyan
   (Irwin et al. 2024), nearly featureless — a deep haze over clear
   methane — with faint banding, a slightly brighter cap of haze over
   the pole then in sunlight and a darker collar round it near 50°S, and
   a few faint, small clouds. Its rings are narrow and coal-dark: nine
   of them between 41,800 and 51,200 km, the ε ring outermost and
   widest (20–96 km), all with reflectances of a couple of per cent, so
   from Miranda they are a faint dark thread across the planet. */
export function uranusPixels(W, H) {
  const px = new Uint8ClampedArray(W * H * 4);
  const pn = (x, y, P) => {
    const xi = Math.floor(x), yi = Math.floor(y), u = smoothT(x - xi), v = smoothT(y - yi);
    const x0 = ((xi % P) + P) % P, x1 = (x0 + 1) % P;
    return (hash2(x0, yi) * (1 - u) + hash2(x1, yi) * u) * (1 - v) + (hash2(x0, yi + 1) * (1 - u) + hash2(x1, yi + 1) * u) * v;
  };
  for (let y = 0; y < H; y++) {
    const v = (y + 0.5) / H, lat0 = 90 - v * 180;
    for (let x = 0; x < W; x++) {
      const u = (x + 0.5) / W;
      const lat = lat0 + (pn(u * 12, v * 40, 12) - 0.5) * 1.5;
      let r = 172, g = 212, b = 218;
      let k = 1 + Math.cos(lat * 0.18) * 0.015 + Math.cos(lat * 0.45 + 0.7) * 0.012 + (pn(u * 50, v * 150, 50) - 0.5) * 0.015;
      k -= Math.exp(-((lat + 48) * (lat + 48)) / 30) * 0.05;               // the collar
      k += Math.max(0, (-lat - 60) / 30) * 0.06;                           // the polar hood
      r *= k; g *= k; b *= k;
      const cl = Math.exp(-((lat - 28) * (lat - 28)) / 20) * Math.max(0, pn(u * 30, v * 200, 30) - 0.8) / 0.2;
      r += (232 - r) * cl * 0.6; g += (240 - g) * cl * 0.6; b += (240 - b) * cl * 0.6;
      const o = (y * W + x) * 4;
      px[o] = r; px[o + 1] = g; px[o + 2] = b; px[o + 3] = 255;
    }
  }
  return px;
}
