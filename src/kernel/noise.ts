export var SEED = 19690720;

// Integer bit-mix rather than the usual sin() trick: this is called
// tens of millions of times while chunks are built, and sin() costs
// several times as much for no better distribution.
export function hash2(x, y) {
  var h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + SEED;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
// Float-domain variant, for hashing a position rather than a lattice cell.
function hashF(x, y) {
  var s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}
export function smoothT(t) { return t * t * (3 - 2 * t); }
export function clamp01(t) { return t < 0 ? 0 : t > 1 ? 1 : t; }
export function sstep(a, b, t) { return smoothT(clamp01((t - a) / (b - a))); }

export function valueNoise(x, y) {
  var xi = Math.floor(x), yi = Math.floor(y);
  var xf = x - xi, yf = y - yi;
  var u = smoothT(xf), v = smoothT(yf);
  var a = hash2(xi, yi), b = hash2(xi + 1, yi);
  var c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

export function fbm(x, y, octaves) {
  var sum = 0, amp = 0.5, freq = 1, norm = 0;
  for (var i = 0; i < octaves; i++) {
    sum += amp * valueNoise(x * freq, y * freq);
    norm += amp; amp *= 0.5; freq *= 2.03;
  }
  return sum / norm;
}

// Ridged multifractal — sharp massifs for the highland provinces.
export function ridged(x, y, octaves) {
  var sum = 0, amp = 0.5, freq = 1, norm = 0;
  for (var i = 0; i < octaves; i++) {
    var n = 1 - Math.abs(valueNoise(x * freq, y * freq) * 2 - 1);
    sum += amp * n * n;
    norm += amp; amp *= 0.5; freq *= 2.11;
  }
  return sum / norm;
}

export function setSeed(v) { SEED = v; }
