/* The kernel's noise primitives (kernel/noise.ts). */
import { afterEach, describe, expect, test } from 'vitest';
import { SEED, clamp01, fbm, hash2, hashF, ridged, setSeed, sstep, valueNoise } from '../src/kernel/noise';

const SEED0 = SEED;
afterEach(() => setSeed(SEED0));

const pts = (n: number, r: number) => Array.from({ length: n }, (_, i) => [Math.sin(i * 12.9898) * r, Math.cos(i * 78.233) * r] as const);

describe('hash2', () => {
  test('in [0, 1), and evenly spread', () => {
    const bins = new Array<number>(10).fill(0);
    for (let x = -100; x < 100; x++) {
      for (let z = -100; z < 100; z++) {
        const h = hash2(x, z);
        expect(h >= 0 && h < 1).toBe(true);
        bins[Math.floor(h * 10)]!++;   // h < 1: bin 0–9
      }
    }
    for (const b of bins) expect(Math.abs(b - 4000)).toBeLessThan(4000 * 0.06);
  });

  test('lattice coordinates only: a fraction is truncated, so float positions need hashF', () => {
    expect(hash2(3.9, -7.2)).toBe(hash2(3, -7));
  });

  test('neighbours are uncorrelated', () => {
    let sxy = 0, sx = 0, sy = 0, sxx = 0, syy = 0, n = 0;
    for (let x = 0; x < 300; x++) {
      for (let z = 0; z < 300; z++) {
        const a = hash2(x, z), b = hash2(x + 1, z);
        sx += a; sy += b; sxy += a * b; sxx += a * a; syy += b * b; n++;
      }
    }
    const r = (sxy / n - sx / n * sy / n) / Math.sqrt((sxx / n - (sx / n) ** 2) * (syy / n - (sy / n) ** 2));
    expect(Math.abs(r)).toBeLessThan(0.02);
  });

  test('keyed by the world\'s seed', () => {
    const a = hash2(5, 9);
    setSeed(SEED0 + 1);
    expect(hash2(5, 9)).not.toBe(a);
  });
});

test('hashF: in [0, 1) at any position', () => {
  for (const [x, z] of pts(5000, 1e5)) { const h = hashF(x, z); expect(h >= 0 && h < 1).toBe(true); }
});

describe('valueNoise', () => {
  test('the hash at lattice points, inside [0, 1] between', () => {
    for (let x = -5; x <= 5; x++) for (let z = -5; z <= 5; z++) expect(valueNoise(x, z)).toBe(hash2(x, z));
    for (const [x, z] of pts(5000, 300)) { const v = valueNoise(x, z); expect(v >= 0 && v <= 1).toBe(true); }
  });

  test('continuous with a continuous slope across cell lines (smoothstep blend)', () => {
    const e = 1e-6;
    for (const [x, z] of [[3, 0.4], [-2, 7.7], [0, -0.25]] as const) {
      expect(valueNoise(x - e, z)).toBeCloseTo(valueNoise(x + e, z), 5);
      const dl = (valueNoise(x - e, z) - valueNoise(x - 2 * e, z)) / e, dr = (valueNoise(x + 2 * e, z) - valueNoise(x + e, z)) / e;
      expect(dl).toBeCloseTo(dr, 3);
    }
  });
});

test('fbm and ridged stay in [0, 1]', () => {
  for (const [x, z] of pts(3000, 500)) {
    for (const o of [1, 4, 8]) {
      const f = fbm(x, z, o), r = ridged(x, z, o);
      expect(f >= 0 && f <= 1 && r >= 0 && r <= 1).toBe(true);
    }
  }
});

test('sstep: 0 before a, 1 after b, smooth and rising between', () => {
  expect(sstep(2, 5, 1)).toBe(0);
  expect(sstep(2, 5, 6)).toBe(1);
  expect(sstep(2, 5, 3.5)).toBe(0.5);
  let last = 0;
  for (let t = 2; t <= 5; t += 0.01) { const v = sstep(2, 5, t); expect(v).toBeGreaterThanOrEqual(last); last = v; }
  expect(clamp01(-1)).toBe(0); expect(clamp01(2)).toBe(1);
});
