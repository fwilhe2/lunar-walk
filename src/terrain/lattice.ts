/* The chunk triangulation, and the one copy of it outside the GPU.
   Pure: no three, no DOM, so tests/lattice.test.ts can hold the two
   to each other. */

// A W × W vertex grid as triangles, each quad a–b–c–d (a at (i, j),
// b at i + 1, c at j + 1) split along the b–c diagonal, both halves
// counter-clockwise seen from above. terrain/streamer.ts draws every
// chunk with it.
export function gridTriangles(W: number) {
  const arr = new Uint32Array((W - 1) * (W - 1) * 6);
  let o = 0;
  for (let j = 0; j < W - 1; j++) {
    for (let i = 0; i < W - 1; i++) {
      const a = j * W + i, b = a + 1, c = a + W, d = c + 1;
      arr[o++] = a; arr[o++] = c; arr[o++] = b;
      arr[o++] = b; arr[o++] = c; arr[o++] = d;
    }
  }
  return arr;
}

// The same grid with a hole in it (terrain/streamer.ts's holeIndex()):
// W = n + 3 with its skirt ring, split into m × m cells, and every quad
// of a cell whose bit is set in mask left out. A wall is hung along each
// edge between a cut cell and a kept one, facing into the cut, from the
// dropped vertices the worker appends after the grid
// (workers/mesh.worker.ts: one row of n + 1 per cell line, x lines first).
export function holeTriangles(W: number, m: number, mask: number) {
  const n = W - 3, per = n / m, V = W * W, out: number[] = [];
  const cut = (fx: number, fz: number) => (mask >> (fz * m + fx)) & 1;
  const cl = (g: number) => (g < 0 ? 0 : g > n ? n : g);
  // The cell a quad belongs to, by its centre; skirt quads, which
  // have no width, fall in the cell whose edge they hang from.
  const cellOf = (i: number) => Math.min(m - 1, Math.floor((cl(i - 1) + cl(i)) / 2 / per));
  for (let j = 0; j < W - 1; j++) {
    const fz = cellOf(j);
    for (let i = 0; i < W - 1; i++) {
      if (cut(cellOf(i), fz)) continue;
      const a = j * W + i, b = a + 1, c = a + W, d = c + 1;
      out.push(a, c, b, b, c, d);
    }
  }
  for (let L = 1; L < m; L++) {
    // Along x = L·per, between cells L − 1 and L.
    const ci = L * per, xb = V + (L - 1) * (n + 1);
    for (let cj = 0; cj < n; cj++) {
      const fz = Math.floor((cj + 0.5) / per), l = cut(L - 1, fz), r = cut(L, fz);
      if (l === r) continue;
      const t0 = (cj + 1) * W + ci + 1, t1 = t0 + W, b0 = xb + cj, b1 = b0 + 1;
      if (r) out.push(b0, t0, t1, b0, t1, b1);        // faces +x, into the hole
      else out.push(b0, t1, t0, b0, b1, t1);          // faces −x
    }
    // Along z = L·per, between cells L − 1 and L.
    const cj = L * per, zb = V + (m - 1) * (n + 1) + (L - 1) * (n + 1);
    for (let ci2 = 0; ci2 < n; ci2++) {
      const fx = Math.floor((ci2 + 0.5) / per), u = cut(fx, L - 1), v = cut(fx, L);
      if (u === v) continue;
      const t0 = (cj + 1) * W + ci2 + 1, t1 = t0 + 1, b0 = zb + ci2, b1 = b0 + 1;
      if (v) out.push(b0, t1, t0, b0, b1, t1);        // faces +z
      else out.push(b0, t0, t1, b0, t1, b1);          // faces −z
    }
  }
  return new Uint32Array(out);
}

// Height of the drawn mesh at (x, z): the chunk lattice of spacing s,
// split along the b–c diagonal as gridTriangles() splits it. vtx(i, j, s)
// gives the height of lattice corner (i, j) — the caller decides how
// it is cached and whether the curvature drop goes in. Prints and the
// rover's wheels both stand on it (surface/stamps.ts, vehicles/rover.ts).
export function meshHeight(x: number, z: number, s: number, vtx: (i: number, j: number, s: number) => number) {
  const gx = x / s, gz = z / s, i = Math.floor(gx), j = Math.floor(gz);
  const fx = gx - i, fz = gz - j;
  const hb = vtx(i + 1, j, s), hc = vtx(i, j + 1, s);
  if (fx + fz <= 1) { const ha = vtx(i, j, s); return ha + fx * (hb - ha) + fz * (hc - ha); }
  const hd = vtx(i + 1, j + 1, s);
  return hd + (1 - fx) * (hc - hd) + (1 - fz) * (hb - hd);
}
