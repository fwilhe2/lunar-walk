import * as THREE from 'three';
import { fbm, hash2, smoothT } from '../../kernel/noise';

/* ── Saturn ─────────────────────────────────────────────────────
   From Enceladus Saturn is 29° across — fifty-eight full Moons — and
   what shows is how quiet it is next to Jupiter: the same kind of
   belts and zones, but under a deep haze that mutes them to pale
   butterscotch and cream, with far fewer spots. The seasons show
   instead. The hemisphere in winter, tilted away from the sun and
   under the rings' shadow, loses its haze and goes a clear azure at
   high latitudes, as the north did through the Cassini years. At the
   north pole is the hexagon, a jet stream bent into six sides and
   wider than Earth; at the south pole a vortex with an eye. */
export function saturnMaps() {
  const W = 1024, H = 512;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  const img = x.createImageData(W, H);
  const pn = (xx, yy, P) => {
    const xi = Math.floor(xx), yi = Math.floor(yy), u = smoothT(xx - xi), v = smoothT(yy - yi);
    const x0 = ((xi % P) + P) % P, x1 = (x0 + 1) % P;
    return (hash2(x0, yi) * (1 - u) + hash2(x1, yi) * u) * (1 - v) + (hash2(x0, yi + 1) * (1 - u) + hash2(x1, yi + 1) * u) * v;
  };
  // Latitude profile, north to south: [southern edge of the band, r, g, b].
  const BANDS = [
    [74, 112, 132, 160], [66, 150, 168, 186], [56, 176, 186, 190], [46, 198, 192, 172],
    [36, 214, 200, 166], [27, 190, 164, 122], [18, 226, 212, 170], [8, 210, 186, 138],
    [-8, 236, 222, 180], [-18, 214, 186, 138], [-27, 230, 212, 168], [-36, 204, 178, 130],
    [-46, 222, 204, 160], [-58, 200, 176, 130], [-70, 188, 164, 122], [-90, 160, 136, 104],
  ];
  const band = (lat, k) => { let b = 0; while (b < BANDS.length - 1 && lat < BANDS[b][0]) b++; return BANDS[b][k]; };
  const soft = (lat, k) => { let s = 0; for (let d = -3; d <= 3; d++) s += band(lat + d * 0.7, k); return s / 7; };
  for (let y = 0; y < H; y++) {
    const v = (y + 0.5) / H, lat0 = 90 - v * 180;
    for (let xx = 0; xx < W; xx++) {
      const u = (xx + 0.5) / W;
      // Turbulence, weaker than Jupiter's and stretched along the jets.
      const lat = lat0 + (pn(u * 12, v * 40, 12) - 0.5) * 1.6 + (pn(u * 40, v * 120, 40) - 0.5) * 0.5;
      let r = soft(lat, 1), g = soft(lat, 2), b = soft(lat, 3);
      const f = 0.95 + (pn(u * 80, v * 200, 80) - 0.5) * 0.08;
      r *= f; g *= f; b *= f;
      // The hexagon: a dark ribbon at 77°N with six straight sides.
      if (lat0 > 70) {
        const lon = u * 6.2832, side = Math.cos(Math.PI / 6) / Math.cos(((lon % (Math.PI / 3)) + Math.PI / 3) % (Math.PI / 3) - Math.PI / 6);
        const d = Math.abs((90 - lat0) - 13 * side) / 1.3;
        if (d < 1) { const k = (1 - d) * 0.45; r *= 1 - k; g *= 1 - k * 0.8; b *= 1 - k * 0.6; }
      }
      // The south polar vortex's eye.
      if (lat0 < -86) { const k = (lat0 + 86) / -4 * 0.4; r *= 1 - k; g *= 1 - k; b *= 1 - k; }
      const o = (y * W + xx) * 4;
      img.data[o] = r; img.data[o + 1] = g; img.data[o + 2] = b; img.data[o + 3] = 255;
    }
  }
  x.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return { day: t, ring: saturnRingProfile() };
}

/* The rings, as a radial profile from the D ring's inner edge at
   66,900 km to past the F ring at 140,500: colour (the particles'
   reflectance) in RGB and normal optical depth, over RING_TAU, in
   alpha. The C ring is thin and dark, dirtier ice; the B ring bright,
   peach and nearly opaque, full of fine structure; the Cassini
   Division thin again, 4,500 km of it; then the A ring, with the
   Encke Gap near its outer edge, and the thread of the F ring beyond.
   Optical depths after Cassini's occultations (Colwell et al. 2009),
   roughened ring by ring. */
export const RING_KM = [66900, 140500], RING_TAU = 4;
function saturnRingProfile() {
  const N = 2048, data = new Uint8Array(N * 4);
  let sd = 1610; const rnd = () => (sd = (sd * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  let wig = 1;
  for (let i = 0; i < N; i++) {
    const km = RING_KM[0] + (i + 0.5) / N * (RING_KM[1] - RING_KM[0]);
    if (i % 3 === 0) wig = 0.7 + rnd() * 0.6;          // ringlets and waves
    let tau = 0, col = [0.5, 0.48, 0.45];
    if (km < 74500) { tau = 0.002; col = [0.4, 0.38, 0.36]; }
    else if (km < 92000) { tau = (0.05 + 0.1 * ((km - 74500) / 17500)) * wig; col = [0.36, 0.33, 0.30]; }
    else if (km < 117580) { tau = (1.3 + 2.2 * Math.sin((km - 92000) / 25580 * Math.PI)) * wig; col = [0.62, 0.53, 0.43]; }
    else if (km < 122170) { tau = 0.12 * wig; col = [0.40, 0.37, 0.34]; }
    else if (km < 136775) {
      tau = (0.6 + 0.3 * wig) * (km > 133423 && km < 133743 ? 0.02 : 1) * (km > 136485 && km < 136527 ? 0.05 : 1);
      col = [0.58, 0.52, 0.45];
    } else if (km > 140130 && km < 140230) { tau = 0.5; col = [0.55, 0.52, 0.5]; }
    data[i * 4] = col[0] * 255; data[i * 4 + 1] = col[1] * 255; data[i * 4 + 2] = col[2] * 255;
    data[i * 4 + 3] = Math.min(255, tau / RING_TAU * 255);
  }
  const t = new THREE.DataTexture(data, N, 1, THREE.RGBAFormat);
  t.magFilter = t.minFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

/* ── Titan, and Saturn's icy moons ─────────────────────────────
   As Enceladus sees them: points and small discs strung along the
   ring plane. Titan is its haze, featureless orange; the others are
   grey-white ice, Tethys with Odysseus, Mimas with Herschel, Dione and
   Rhea with their bright wispy fractures on the trailing side. */
export function saturnMoonMaps(kind) {
  const W = 256, H = 128;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  const img = x.createImageData(W, H);
  // Uranus's moons too: Ariel brightest, Umbriel darkest, all grey.
  const base = { titan: [214, 150, 72], tethys: [226, 226, 226], dione: [212, 212, 214], rhea: [206, 204, 202], mimas: [196, 196, 198],
    ariel: [214, 212, 208], umbriel: [118, 116, 113], titania: [184, 178, 172], oberon: [168, 160, 152],
    enceladus: [240, 243, 246] }[kind];
  for (let y = 0; y < H; y++) {
    for (let xx = 0; xx < W; xx++) {
      const n = fbm(xx * 0.06 + base[0], y * 0.06, 3);
      let k = kind === 'titan' ? 0.94 + (n - 0.5) * 0.06 + Math.sin(y / H * Math.PI * 3) * 0.02 : 0.86 + (n - 0.5) * 0.3;
      // A big crater each, where they have one.
      const big = kind === 'tethys' ? [0.3, 0.4, 0.22] : kind === 'mimas' ? [0.6, 0.5, 0.18] : null;
      if (big) { const d = Math.hypot((xx / W - big[0]) * 2, y / H - big[1]) / big[2]; if (d < 1) k *= 0.85 + 0.15 * d; }
      if ((kind === 'dione' || kind === 'rhea') && xx > W / 2) k += Math.max(0, 1 - Math.abs(Math.sin(xx * 0.2 + n * 6)) * 8) * 0.15;
      const o = (y * W + xx) * 4;
      img.data[o] = base[0] * k; img.data[o + 1] = base[1] * k; img.data[o + 2] = base[2] * k; img.data[o + 3] = 255;
    }
  }
  x.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  return { day: t };
}
