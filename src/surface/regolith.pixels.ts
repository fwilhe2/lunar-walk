import { CUBE_0, CUBE_K } from '../kernel/craters';
import { clamp01, hash2, smoothT } from '../kernel/noise';
import type { WorldView } from '../worlds/view-types';

/** The fields of a world's view the regolith is made from. */
export type RegolithSpec = Pick<WorldView, 'grey' | 'mapTint' | 'pits' | 'grain' | 'pebbles' | 'clods' | 'plate' | 'ripple'>;

// Pure: arrays only, so it runs in a worker too (regolithAsync in regolith.ts).
// hx, hy: the sun's azimuth, for the baked micro-horizon. Every index
// into h, a, alb, nrm and site below is wrapped or bounded by S or G.
export function regolithData(v: RegolithSpec, hx: number, hy: number) {
  const S = 1024, MM = 3000 / S, N = S * S;
  const h = new Float32Array(N);             // height, mm
  const a = new Float32Array(N).fill(1);     // albedo multiplier
  const wrap = (i: number) => i & (S - 1);
  let s = 4711; const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

  // Periodic value noise: lattice coordinates wrap at P, so the
  // field tiles exactly with the texture.
  const pn = (x: number, y: number, P: number) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const u = smoothT(x - xi), w = smoothT(y - yi);
    const x0 = ((xi % P) + P) % P, y0 = ((yi % P) + P) % P;
    const x1 = (x0 + 1) % P, y1 = (y0 + 1) % P;
    return (hash2(x0, y0) * (1 - u) + hash2(x1, y0) * u) * (1 - w)
         + (hash2(x0, y1) * (1 - u) + hash2(x1, y1) * u) * w;
  };
  const pfbm = (x: number, y: number, P: number, oct: number) => {
    let sum = 0, amp = 0.5, f = 1, n = 0;
    for (let i = 0; i < oct; i++) { sum += amp * pn(x * f, y * f, P * f); n += amp; amp *= 0.5; f *= 2; }
    return sum / n;
  };
  // A radial feature, wrapped at the tile edge. prof(d) adds height,
  // alb(d) multiplies albedo; d is distance over radius.
  const stamp = (cx: number, cy: number, r: number, prof: (d: number) => number, alb: ((d: number) => number) | null) => {
    const R = Math.ceil(r * 1.9) + 1, ix = Math.floor(cx), iy = Math.floor(cy);
    for (let y = iy - R; y <= iy + R; y++) {
      const dy = y - cy, row = wrap(y) * S;
      for (let x = ix - R; x <= ix + R; x++) {
        const dx = x - cx, d = Math.sqrt(dx * dx + dy * dy) / r;
        if (d >= 1.9) continue;
        const k = row + wrap(x);
        h[k]! += prof(d);
        if (alb) a[k]! *= alb(d);
      }
    }
  };
  // The kernel's crater profile, at millimetre scale: bowl, crest,
  // inverse-cube blanket, rounded with age.
  const crater = (D: number, H: number, k: number) => (d: number) => {
    const hin = (D + H) * d * d - D, dd = Math.max(d, 0.5);
    let hh = Math.min(hin, H * (1 / (dd * dd * dd) - CUBE_0) * CUBE_K);
    const gap = Math.abs(hin - H * (1 / (dd * dd * dd) - CUBE_0) * CUBE_K);
    if (gap < k) { const q = (k - gap) / k; hh -= q * q * k * 0.25; }
    return hh;
  };
  const grain = v.grain;

  // Soft undulation under everything.
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      h[y * S + x] = (pfbm(x / S * 4, y / S * 4, 4, 5) - 0.5) * 9 * grain;
    }
  }
  // Clods and grains: tens of thousands of millimetre lumps, each a
  // shade lighter or darker than the next. Isotropic by construction,
  // which is what value noise alone cannot manage — it is what made
  // the old texture read as woven cloth.
  const nG = Math.round(52000 * (v.clods ?? 1));
  for (let i = 0; i < nG; i++) {
    const r = 0.8 + rnd() * rnd() * 2.6;
    const ht = (0.2 + rnd() * 0.8) * r * MM * 0.26 * grain;
    const m = 0.88 + rnd() * 0.24;
    stamp(rnd() * S, rnd() * S, r, (d) => (d < 1 ? ht * (1 - d * d) * (1 - d * d) : 0), (d) => (d < 1 ? m : 1));
  }
  // Aggregates: the soil clumps into loose lumps a centimetre or two
  // across — soft, low, and the main thing the eye reads up close.
  for (let i = 0; i < Math.round(5000 * (v.clods ?? 1)); i++) {
    const r = 3 + rnd() * rnd() * 9;
    const ht = (0.2 + rnd() * 0.6) * r * MM * 0.22 * grain;
    stamp(rnd() * S, rnd() * S, r, (d) => (d < 1 ? ht * (1 - d * d) * (1 - d * d) * (1 - d * d) : 0), null);
  }
  // Pebbles: centimetre rock fragments, angular and half-buried, a
  // little brighter than the soil — rock surfaces weather more slowly
  // than fines do. A polygonal outline (the largest of a few random
  // projections) and a flat-topped profile, so they read as chips of
  // rock rather than droplets.
  for (let i = 0; i < (v.pebbles ?? 0); i++) {
    const r = 3 + Math.pow(rnd(), 2.2) * 12;
    const ht = r * MM * (0.12 + 0.22 * rnd());
    const m = 1.04 + rnd() * 0.2;
    const k = 3 + Math.floor(rnd() * 3), a0 = rnd() * 6.2832, dirs: [number, number, number][] = [];
    for (let j = 0; j < k; j++) { const a = a0 + j * 3.1416 / k + (rnd() - 0.5) * 0.5; dirs.push([Math.cos(a), Math.sin(a), 0.8 + rnd() * 0.4]); }
    const cx = rnd() * S, cy = rnd() * S;
    const R = Math.ceil(r * 1.5) + 1, ix = Math.floor(cx), iy = Math.floor(cy);
    for (let y = iy - R; y <= iy + R; y++) {
      for (let x = ix - R; x <= ix + R; x++) {
        let d = 0;
        for (const [dx, dy, sc] of dirs) d = Math.max(d, Math.abs((x - cx) * dx + (y - cy) * dy) * sc / r);
        if (d >= 1) continue;
        const kk = wrap(y) * S + wrap(x);
        h[kk]! += ht * Math.min(1, (1 - d) * 3.5);
        a[kk]! *= m;
      }
    }
  }
  // Micro-craters, the reason airless regolith reads as porous up
  // close. On Venus the same loop draws vesicles instead — nothing has
  // hit this ground in 500 Myr, but the lava it came out of was full
  // of gas bubbles, and they pit it at about the same scale.
  for (let i = 0; i < v.pits; i++) {
    const r = 3 + Math.pow(rnd(), 3.4) * 36, age = Math.pow(rnd(), 2.4);
    // A vesicle is a hole, not a crater: no ejecta, so no rim.
    const D = r * MM * (0.035 + 0.33 * Math.pow(age, 1.3)), H = v.plate ? 0 : r * MM * (0.004 + 0.062 * age);
    const k = (D + H) * (0.05 + 0.85 * (1 - age) * (1 - age)) + 1e-3;
    const m = age > 0.7 ? 1.12 : 1;
    stamp(rnd() * S, rnd() * S, r, crater(D, H, k), m > 1 ? (d) => (d < 1.2 ? m : 1) : null);
  }
  // Wind ripples: on Mars the last centimetres of relief are not
  // impact-made at all. Crests every ~10 cm across the same wind that
  // builds the dunes (an integer wave vector, so the tile still wraps),
  // wandering with the local sand supply.
  if (v.ripple) {
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const q = (x * 27 + y * 12) / S + pfbm(x / S * 6, y / S * 6, 6, 3) * 1.6;
        const f = q - Math.floor(q);
        const supply = smoothT(clamp01((pfbm(x / S * 3 + 0.5, y / S * 3, 3, 3) - 0.3) * 2.5));
        h[y * S + x]! += (f < 0.7 ? smoothT(f / 0.7) : 1 - (f - 0.7) / 0.3) * 20 * v.ripple * supply;
      }
    }
  }
  // Plates. Venusian lava cooled into slabs and then sat at 464 °C
  // being chemically weathered for half a billion years with no
  // water, no frost and no wind worth the name to break them up, so
  // the ground Venera 13 and 14 photographed is a pavement: flat
  // plates a few tens of centimetres across, parted by cracks, each
  // lying at its own slightly different level. A jittered-grid
  // Voronoi, wrapped, cracked along the F2−F1 ridge.
  if (v.plate) {
    const G = 7, gs = S / G;                       // ≈43 cm plates on a 3 m tile
    const site = new Float32Array(G * G * 3);
    for (let j = 0; j < G; j++) {
      for (let i = 0; i < G; i++) {
        const k = (j * G + i) * 3;
        site[k]     = (i + 0.18 + hash2(i, j) * 0.64) * gs;
        site[k + 1] = (j + 0.18 + hash2(j + 41, i - 17) * 0.64) * gs;
        site[k + 2] = hash2(i * 31 + 7, j * 17 - 3) - 0.5;   // that plate's level
      }
    }
    for (let y = 0; y < S; y++) {
      const gj = Math.floor(y / gs);
      for (let x = 0; x < S; x++) {
        const gi = Math.floor(x / gs);
        let f1 = 1e9, f2 = 1e9, own = 0;
        for (let dj = -1; dj <= 1; dj++) {
          for (let di = -1; di <= 1; di++) {
            const ii = (gi + di + G) % G, jj = (gj + dj + G) % G;
            const k = (jj * G + ii) * 3;
            // Offset the wrapped copy rather than the sample, so the
            // tile is seamless at the edges.
            const dx = site[k]! + (gi + di - ii) * gs - x;
            const dy = site[k + 1]! + (gj + dj - jj) * gs - y;
            const d = dx * dx + dy * dy;
            if (d < f1) { f2 = f1; f1 = d; own = site[k + 2]!; }
            else if (d < f2) f2 = d;
          }
        }
        const edge = (Math.sqrt(f2) - Math.sqrt(f1)) / (gs * 0.16);
        h[y * S + x]! += (own * 26 - (1 - smoothT(clamp01(edge))) * 34) * v.plate;
      }
    }
  }

  // Normals from the height field, in real units; and the horizon
  // toward the sun's azimuth, marched a texel at a time and then in
  // pairs, out to 14 cm.
  const alb = new Uint8Array(N * 4), nrm = new Uint8Array(N * 4);
  const steps: number[] = [];
  for (let t = 1; t <= 16; t++) steps.push(t);
  for (let t = 18; t <= 48; t += 2) steps.push(t);
  const sx = steps.map((t) => Math.round(t * hx)), sy = steps.map((t) => Math.round(t * hy));
  // sx, sy and sd run parallel to steps.
  const sd = steps.map((t, i) => 1 / (Math.hypot(sx[i]!, sy[i]!) * MM || 1));
  let meanLin = 0, mR = 0, mB = 0;
  const toLin = (c: number) => Math.pow(c / 255, 2.2);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = y * S + x, o = i * 4;
      const g = Math.min(255, v.grey * a[i]!);
      alb[o] = Math.min(255, g * v.mapTint[0]);
      alb[o + 1] = Math.min(255, g * v.mapTint[1]);
      alb[o + 2] = Math.min(255, g * v.mapTint[2]);
      alb[o + 3] = 255;
      meanLin += toLin(alb[o + 1]!); mR += toLin(alb[o]!); mB += toLin(alb[o + 2]!);

      const nx = (h[y * S + wrap(x - 1)]! - h[y * S + wrap(x + 1)]!) / (2 * MM);
      const ny = (h[wrap(y - 1) * S + x]! - h[wrap(y + 1) * S + x]!) / (2 * MM);
      const len = Math.hypot(nx, ny, 1);
      nrm[o] = (nx / len * 0.5 + 0.5) * 255;
      nrm[o + 1] = (ny / len * 0.5 + 0.5) * 255;
      nrm[o + 2] = (1 / len * 0.5 + 0.5) * 255;

      const h0 = h[i]!;
      let best = 0;
      for (let k = 0; k < steps.length; k++) {
        const tn = (h[wrap(y + sy[k]!) * S + wrap(x + sx[k]!)]! - h0) * sd[k]!;
        if (tn > best) best = tn;
      }
      nrm[o + 3] = Math.min(255, best / 1.5 * 255);
    }
  }

  return { S, alb, nrm, mean: meanLin / N, mR: mR / N, mB: mB / N };
}
