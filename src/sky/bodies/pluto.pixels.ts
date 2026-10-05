import { fbm } from '../../kernel/noise';

/* ── Pluto ──────────────────────────────────────────────────────
   Pluto from Charon shows the face Charon's side of this program
   stands on: the dark equatorial belt, here a string of separate
   dark maculae (the "brass knuckles" of the approach pictures) west
   of Cthulhu, the long dark whale that runs a third of the way round.
   The maculae are tholin, red-brown and reflecting under a tenth of
   the light; everything north of them is pale ice, cream toward the
   equator and greyer over the polar cap, Lowell Regio, which in 2015
   was in the midst of its long summer. The heart — Sputnik Planitia
   and the rest of Tombaugh Regio — is on the far side and never
   turns toward Charon; it is drawn anyway. The south was in polar
   night when New Horizons went by, so nobody has seen it; it is
   given the same pale ice.

   The map is centred on longitude 0, the point that faces Charon,
   so the seam, where the noise does not wrap, is on the far side. */
// Pure, so it can run off the main thread (OFF_THREAD).
export function plutoPixels() {
  const W = 512, H = 256, DEG = Math.PI / 180;
  const smoothstep = (v, a, b) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
  const data = new Uint8ClampedArray(W * H * 4);
  const wrapD = (d) => (d > 180 ? d - 360 : d < -180 ? d + 360 : d);
  // [east longitude, latitude, half-width and half-height in degrees, strength]
  const DARK = [
    [95, -6, 66, 15, 1.0],                                          // Cthulhu
    [283, -11, 12, 8, 0.9], [312, -9, 11, 8, 0.95],                 // the string of maculae
    [340, -12, 12, 9, 0.9], [8, -9, 10, 7, 0.85],
    [255, -8, 16, 12, 0.6],                                         // Krun, and the dark ground by it
  ];
  const BRIGHT = [
    [176, 25, 24, 20, 1.0],                                         // Sputnik Planitia
    [214, 4, 22, 24, 0.8],                                          // Tombaugh Regio's eastern lobe
  ];
  // Tholin does not lie in tidy ovals: the belt frays into smaller
  // patches along its edges and between the big maculae.
  let sd = 1930; const rnd = () => (sd = (sd * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let k = 0; k < 18; k++) {
    const lon = (rnd() < 0.55 ? 250 + rnd() * 150 : 20 + rnd() * 150) % 360, w = 4 + rnd() * 8;
    DARK.push([lon, -24 + rnd() * 26, w, w * (0.3 + rnd() * 0.3), 0.3 + rnd() * 0.35]);
  }
  const blob = (lon, lat, b, n) => {
    const dx = wrapD(lon - b[0]) / b[2], dy = (lat - b[1]) / b[3];
    if (dx * dx + dy * dy > 4) return 0;
    return (1 - smoothstep(Math.sqrt(dx * dx + dy * dy) + (n - 0.5) * 1.1, 0.6, 1.0)) * b[4];
  };
  for (let y = 0; y < H; y++) {
    const lat = 90 - (y + 0.5) / H * 180;
    for (let xx = 0; xx < W; xx++) {
      const lon = ((xx + 0.5) / W * 360 + 180) % 360;
      const n1 = fbm(xx * 0.03 + 5, y * 0.03, 4), n2 = fbm(xx * 0.1, y * 0.1 + 7, 3);
      const n3 = fbm(xx * 0.06 - 9, y * 0.06 + 2, 3), ne = n3 * 0.65 + n1 * 0.35;
      // Pale ice, warmer toward the equator, greyer over the cap, and
      // banded across the northern mid-latitudes.
      let v = 205 + (n1 - 0.5) * 60 + (n2 - 0.5) * 22 + Math.sin(lat * 0.33 + n1 * 4) * 9 * smoothstep(lat, 15, 35);
      const warm = 1 - smoothstep(Math.abs(lat), 15, 55);
      let r = v + warm * 12, g = v * 0.93 - warm * 6, b = v * 0.84 - warm * 16;
      const cap = smoothstep(lat + (n1 - 0.5) * 16, 58, 70);
      r += (184 - r) * cap; g += (178 - g) * cap; b += (170 - b) * cap;
      // The cap's rim is yellower than either side of it.
      const rim = Math.max(0, 1 - Math.abs(lat + (n1 - 0.5) * 16 - 58) / 6) * 0.5;
      r += (222 - r) * rim; g += (202 - g) * rim; b += (150 - b) * rim;
      let k = 0;
      for (const d of DARK) k = Math.max(k, blob(lon, lat, d, ne));
      const dk = 0.86 + (n2 - 0.5) * 0.3;
      r += (96 - r) * k * dk; g += (52 - g) * k * dk; b += (37 - b) * k * dk;
      let bk = 0;
      for (const d of BRIGHT) bk = Math.max(bk, blob(lon, lat, d, n2));
      r += (246 - r) * bk; g += (240 - g) * bk; b += (230 - b) * bk;
      const o = (y * W + xx) * 4;
      data[o] = r; data[o + 1] = g; data[o + 2] = b; data[o + 3] = 255;
    }
  }
  return data;
}
