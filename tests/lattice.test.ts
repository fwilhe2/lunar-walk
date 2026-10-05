/* The chunk triangulation and its one reconstruction. Prints and the
   rover's wheels stand on meshHeight(), which must land on the very
   triangles gridTriangles() hands the GPU — same lattice, same
   diagonal — or prints float and wheels sink. */
import { describe, expect, test } from 'vitest';
import { gridTriangles, holeTriangles, meshHeight } from '../src/terrain/lattice';

// A deterministic, rough height for every lattice corner.
const corner = (i: number, j: number, s: number) =>
  Math.sin(i * 12.9898 + j * 78.233 + s) * 3 + ((i * 7 + j * 13) % 5) * 0.4;

// The drawn height at (x, z): find the triangle of the index buffer
// that contains the point and interpolate its corners, as the GPU does.
function drawnHeight(x: number, z: number, s: number, i0: number, j0: number, W: number, idx: Uint32Array) {
  const px = (v: number) => (i0 + (v % W)) * s, pz = (v: number) => (j0 + Math.floor(v / W)) * s;
  const py = (v: number) => corner(i0 + (v % W), j0 + Math.floor(v / W), s);
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t]!, b = idx[t + 1]!, c = idx[t + 2]!;   // t + 2 < length: whole triangles
    const ax = px(a), az = pz(a), bx = px(b), bz = pz(b), cx = px(c), cz = pz(c);
    const den = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
    const la = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / den;
    const lb = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / den;
    const lc = 1 - la - lb;
    if (la >= -1e-9 && lb >= -1e-9 && lc >= -1e-9) return la * py(a) + lb * py(b) + lc * py(c);
  }
  throw new Error('no triangle under ' + x + ', ' + z);
}

describe('gridTriangles', () => {
  test('two triangles per quad, every index inside the grid', () => {
    const W = 7, idx = gridTriangles(W);
    expect(idx.length).toBe((W - 1) * (W - 1) * 6);
    expect(Math.max(...idx)).toBe(W * W - 1);
  });

  test('every triangle faces up (counter-clockwise seen from +y)', () => {
    const W = 6, idx = gridTriangles(W);
    for (let t = 0; t < idx.length; t += 3) {
      const [a, b, c] = [idx[t]!, idx[t + 1]!, idx[t + 2]!].map((v) => [v % W, Math.floor(v / W)] as const);
      // y of (b − a) × (c − a), in x/z: positive when the face points up
      const ny = (b![1] - a![1]) * (c![0] - a![0]) - (b![0] - a![0]) * (c![1] - a![1]);
      expect(ny).toBeGreaterThan(0);
    }
  });
});

describe('meshHeight', () => {
  test.each([1, 2, 4, 16])('lands on the drawn triangles, step %i m', (s) => {
    const W = 9, i0 = -3, j0 = 5, idx = gridTriangles(W);
    let k = 1;
    for (let n = 0; n < 2000; n++) {
      // points strictly inside the patch the grid covers
      k = (Math.imul(k, 1664525) + 1013904223) | 0;
      const x = (i0 + 0.001 + ((k >>> 0) / 4294967296) * (W - 1.002)) * s;
      k = (Math.imul(k, 1664525) + 1013904223) | 0;
      const z = (j0 + 0.001 + ((k >>> 0) / 4294967296) * (W - 1.002)) * s;
      expect(meshHeight(x, z, s, corner)).toBeCloseTo(drawnHeight(x, z, s, i0, j0, W, idx), 9);
    }
  });

  test('passes through the lattice corners and is continuous across both diagonals', () => {
    const s = 2;
    for (const [i, j] of [[0, 0], [3, -2], [-5, 7]] as const) {
      expect(meshHeight(i * s, j * s, s, corner)).toBeCloseTo(corner(i, j, s), 12);
      const e = 1e-7;
      // across the b–c diagonal at the middle of the quad
      const mx = (i + 0.5) * s, mz = (j + 0.5) * s;
      expect(meshHeight(mx - e, mz - e, s, corner)).toBeCloseTo(meshHeight(mx + e, mz + e, s, corner), 5);
      // across a quad edge
      expect(meshHeight(i * s - e, mz, s, corner)).toBeCloseTo(meshHeight(i * s + e, mz, s, corner), 5);
    }
  });
});

/* The same grid with a hole cut where finer ground stands, and walls
   hung round the cut from the dropped vertices the worker appends after
   the grid (workers/mesh.worker.ts: the x lines first, then the z lines,
   n + 1 vertices each). Positions here mirror the worker's: grid vertex
   (i, j) at its clamped lattice place on y = 0, a wall vertex a metre
   under the grid vertex it copies. */
describe('holeTriangles', () => {
  const place = (W: number, m: number) => {
    const n = W - 3, per = n / m, V = W * W;
    const cl = (g: number) => Math.min(n, Math.max(0, g));
    return (v: number): [number, number, number] => {
      if (v < V) return [cl((v % W) - 1), 0, cl(Math.floor(v / W) - 1)];
      const e = v - V, line = Math.floor(e / (n + 1)), t = e % (n + 1);
      return line < m - 1 ? [(line + 1) * per, -1, t] : [t, -1, (line - m + 2) * per];
    };
  };
  const tris = (idx: ArrayLike<number>, at: (v: number) => [number, number, number]) => {
    const out: [number, number, number][][] = [];
    for (let t = 0; t < idx.length; t += 3) out.push([at(idx[t]!), at(idx[t + 1]!), at(idx[t + 2]!)]);
    return out;
  };
  // (v1 − v0) × (v2 − v0): the front face's normal, counter-clockwise
  const normal = ([a, b, c]: [number, number, number][]) => {
    const u = [b![0] - a![0], b![1] - a![1], b![2] - a![2]], w = [c![0] - a![0], c![1] - a![1], c![2] - a![2]];
    return [u[1]! * w[2]! - u[2]! * w[1]!, u[2]! * w[0]! - u[0]! * w[2]!, u[0]! * w[1]! - u[1]! * w[0]!] as const;
  };

  test('with nothing cut, it is the plain grid', () => {
    expect(Array.from(holeTriangles(19, 4, 0))).toEqual(Array.from(gridTriangles(19)));
  });

  test.each([
    [2, 0b0001], [2, 0b0110], [2, 0b1111], [4, 0b0000_0110_0110_0000], [4, 0b1000_0000_0000_0001], [4, 0xffff],
  ])('m = %i, mask %i: the cut is exactly the masked cells, and walled round', (m, mask) => {
    const W = 19, n = W - 3, per = n / m, at = place(W, m);
    const cut = (fx: number, fz: number) => (mask >> (fz * m + fx)) & 1;
    const cells = (x: number) => Math.min(m - 1, Math.floor(x / per));
    let ground = 0, wall = 0;
    for (const t of tris(holeTriangles(W, m, mask), at)) {
      const [nx, ny, nz] = normal(t);
      if (t.every((p) => p[1] === 0)) {
        // ground: faces up (or is a zero-area skirt), and lies on a kept cell
        expect(ny).toBeGreaterThanOrEqual(0);
        ground += ny / 2;
        if (ny > 0) {
          const cx = (t[0]![0] + t[1]![0] + t[2]![0]) / 3, cz = (t[0]![2] + t[1]![2] + t[2]![2]) / 3;
          expect(cut(cells(cx), cells(cz))).toBe(0);
        }
      } else {
        // a wall: vertical, on a cell line, facing into the cut cell beside it
        expect(ny).toBe(0);
        wall += Math.hypot(nx, nz) / 2;
        const cx = (t[0]![0] + t[1]![0] + t[2]![0]) / 3, cz = (t[0]![2] + t[1]![2] + t[2]![2]) / 3;
        const into = [cx + Math.sign(nx) * per / 2, cz + Math.sign(nz) * per / 2];
        const back = [cx - Math.sign(nx) * per / 2, cz - Math.sign(nz) * per / 2];
        expect(cut(cells(into[0]!), cells(into[1]!))).toBe(1);
        expect(cut(cells(back[0]!), cells(back[1]!))).toBe(0);
      }
    }
    let kept = 0, edges = 0;
    for (let fz = 0; fz < m; fz++) {
      for (let fx = 0; fx < m; fx++) {
        if (!cut(fx, fz)) kept++;
        if (fx > 0 && cut(fx, fz) !== cut(fx - 1, fz)) edges++;
        if (fz > 0 && cut(fx, fz) !== cut(fx, fz - 1)) edges++;
      }
    }
    expect(ground).toBeCloseTo(kept * per * per, 9);   // nothing missing, nothing doubled
    expect(wall).toBeCloseTo(edges * per * 1, 9);      // every seam closed, a metre deep
  });
});
