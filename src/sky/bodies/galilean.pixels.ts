import { fbm } from '../../kernel/noise';

/* ── The Galilean moons, from each other ────────────────────────
   As Europa and Io see the others: under a degree at best, so a map
   this coarse is already more than the eye gets. Io is sulphur —
   yellow and cream and orange, pocked with black volcanic paterae,
   red rings where the big plumes fall back, darker reddish poles.
   Europa is bright ice under reddish-brown lineae. Ganymede is two
   terrains, old dark ground and younger bright grooved ice, and frost
   caps. Callisto is the darkest, oldest surface of the four,
   spattered with the bright ice of its craters. */
// Pure, so it can run off the main thread (OFF_THREAD): no THREE, no
// module constants.
export function galileanPixels(kind) {
  const W = 512, H = 256, DEG = Math.PI / 180;
  const smoothstep = (v, a, b) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
  const data = new Uint8ClampedArray(W * H * 4);
  let s = kind === 'io' ? 1979 : kind === 'ganymede' ? 1610 : kind === 'europa' ? 1996 : 4242;
  const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const spots = Array.from({ length: kind === 'callisto' ? 260 : 90 }, () =>
    [rnd() * W, Math.acos(1 - 2 * rnd()) / Math.PI * H, 0.8 + Math.pow(rnd(), 3) * 7, rnd()]);
  for (let y = 0; y < H; y++) {
    const lat = 90 - (y + 0.5) / H * 180, alat = Math.abs(lat);
    for (let xx = 0; xx < W; xx++) {
      const n1 = fbm(xx * 0.02 + 3, y * 0.02, 4), n2 = fbm(xx * 0.08, y * 0.08 + 9, 3);
      let r, g, b;
      if (kind === 'io') {
        r = 214 + n1 * 30 - 15; g = 196 + n1 * 26 - 13; b = 128 + n2 * 40 - 20;
        const pole = smoothstep(alat + n1 * 20, 50, 72);
        r += (150 - r) * pole; g += (112 - g) * pole; b += (82 - b) * pole;
        const frost = Math.max(0, n2 - 0.6) * 2;
        r += (236 - r) * frost; g += (232 - g) * frost; b += (216 - b) * frost;
      } else if (kind === 'europa') {
        // Bright ice, crossed by reddish-brown lineae, with chaos in
        // browner patches: from Io it is the brightest of the three.
        let v = 222 + (n1 - 0.5) * 30;
        const lin = Math.max(0, 1 - Math.abs(Math.sin(xx * 0.09 + n1 * 9) * Math.sin(y * 0.13 - n2 * 7)) * 12) * 0.5;
        const chaos = smoothstep(n2, 0.62, 0.72) * 0.6;
        const k = Math.max(lin, chaos);
        r = v + (150 - v) * k; g = v * 0.97 + (110 - v * 0.97) * k; b = v * 0.93 + (80 - v * 0.93) * k;
      } else if (kind === 'ganymede') {
        const bright = smoothstep(n1, 0.47, 0.53);
        r = 112 + bright * 64 + n2 * 20; g = 102 + bright * 62 + n2 * 18; b = 92 + bright * 64 + n2 * 16;
        const cap = smoothstep(alat + n2 * 12, 40, 55);
        r += (206 - r) * cap * 0.7; g += (206 - g) * cap * 0.7; b += (212 - b) * cap * 0.7;
      } else {
        r = 92 + n1 * 26 + n2 * 10; g = 86 + n1 * 24 + n2 * 9; b = 78 + n1 * 20 + n2 * 8;
      }
      for (const [sx, sy, sr, sk] of spots) {
        let dx = Math.abs(xx - sx); dx = Math.min(dx, W - dx);
        const d = Math.hypot(dx * Math.max(0.2, Math.cos(lat * DEG)), y - sy) / sr;
        if (d > 2.4) continue;
        if (kind === 'io') {
          // Black patera, and around the biggest a red plume ring.
          if (d < 1) { const k = (1 - d) * 0.9; r += (40 - r) * k; g += (34 - g) * k; b += (28 - b) * k; }
          if (sr > 4 && sk > 0.6) { const k = Math.max(0, 1 - Math.abs(d - 1.9) / 0.35) * 0.6; r += (200 - r) * k; g += (96 - g) * k; b += (60 - b) * k; }
        } else if (kind === 'europa') {
          // Almost no craters: a handful, young and bright.
          if (d < 0.5 && sk > 0.85) { const k = (1 - d / 0.5) * 0.4; r += (240 - r) * k; g += (240 - g) * k; b += (244 - b) * k; }
        } else if (d < 1.2) {
          // Fresh craters: bright ice, rayed on Callisto.
          const k = (1 - d / 1.2) * (kind === 'callisto' ? 0.8 : 0.6);
          r += (230 - r) * k; g += (230 - g) * k; b += (232 - b) * k;
        }
      }
      const o = (y * W + xx) * 4;
      data[o] = r; data[o + 1] = g; data[o + 2] = b; data[o + 3] = 255;
    }
  }
  return data;
}
