/* Chunk geometry, built off the main thread. Each worker imports the same kernel and the same terrain
   definitions as the main thread, so its heights match the physics
   exactly. A request names a world, a chunk origin, vertex count and
   step; the reply is transferable typed arrays.

   The grid is (n+3)² — one ring of true out-of-chunk samples for
   finite-difference normals, whose vertices are then clamped to
   the chunk edge and dropped to form a skirt that hides LOD
   seams. Chunks also curve away by d²/2R around the requesting
   anchor, at the real radius of whichever body is loaded, which
   is what buries the far edge of the streamed world below the
   horizon — 2.4 km away on the Moon, 190 m on Phobos. */
import { CR_ALB } from '../kernel/craters';
import { curveDrop } from '../kernel/curvature';
import { AUX, setTintNormalZ, surfaceTint, terrainHeight } from '../kernel/terrain';
import { setWorld } from '../worlds/terrains';

var _tint = [0, 0, 0];

onmessage = function (e) {
  var d = e.data;
  setWorld(d.world);
  var n = d.n, step = d.step, x0 = d.x0, z0 = d.z0, ax = d.ax, az = d.az;
  var W = n + 3;
  var V = W * W;

  var hg = new Float32Array(V);          // true heights, incl. 1-ring outside
  var fg = new Float32Array(V);          // fresh-ejecta weight, from the same pass
  var a0 = new Float32Array(V), a1 = new Float32Array(V), a2 = new Float32Array(V);   // the world's side channels
  for (var j = 0; j < W; j++) {
    var pz = z0 + (j - 1) * step;
    for (var i = 0; i < W; i++) {
      hg[j * W + i] = terrainHeight(x0 + (i - 1) * step, pz);
      fg[j * W + i] = CR_ALB;
      a0[j * W + i] = AUX[0]; a1[j * W + i] = AUX[1]; a2[j * W + i] = AUX[2];
    }
  }

  // Walls for holes. Where a finer level stands over part of this
  // chunk, the main thread leaves the covered quads out of the index
  // (terrain/streamer.ts), and the cut edge needs a skirt as the outer edge has. A cut
  // can only fall on the finer level's chunk lines, m − 1 of them each
  // way, so each gets a row of dropped vertices after the grid, unused
  // until a hole needs them.
  var m = d.m || 0;
  if (m > 1 && n % m) m = 0;
  var E = m > 1 ? 2 * (m - 1) * (n + 1) : 0;

  var pos = new Float32Array((V + E) * 3);
  var nrm = new Float32Array((V + E) * 3);
  var col = new Float32Array((V + E) * 3);
  var uv  = new Float32Array((V + E) * 2);
  var skirt = step * 2 + 3;
  var inv2s = 1 / (2 * step);

  for (var j = 0; j < W; j++) {
    var gj = j - 1;
    var cj = gj < 0 ? 0 : gj > n ? n : gj;
    var isSkirtJ = gj !== cj;
    var pz = z0 + cj * step;
    for (var i = 0; i < W; i++) {
      var gi = i - 1;
      var ci = gi < 0 ? 0 : gi > n ? n : gi;
      var isSkirt = isSkirtJ || gi !== ci;
      var px = x0 + ci * step;
      var k = j * W + i;

      // Normals come from the clamped (edge) sample so skirt walls
      // shade like the surface they hang from.
      var kc = (cj + 1) * W + (ci + 1);
      var hC = hg[kc];
      var hL = hg[kc - 1], hR = hg[kc + 1];
      var hD = hg[kc - W], hU = hg[kc + W];
      var nx = (hL - hR) * inv2s, nz2 = (hD - hU) * inv2s;
      var nl = 1 / Math.sqrt(nx * nx + 1 + nz2 * nz2);

      var dropC = curveDrop(px - ax, pz - az);

      pos[k * 3]     = px;
      pos[k * 3 + 1] = hC - dropC - (isSkirt ? skirt : 0);
      pos[k * 3 + 2] = pz;
      nrm[k * 3]     = nx * nl;
      nrm[k * 3 + 1] = nl;
      nrm[k * 3 + 2] = nz2 * nl;
      uv[k * 2]      = px / 3;
      uv[k * 2 + 1]  = pz / 3;

      // Albedo comes from the kernel, so it changes with the body.
      var slope = Math.hypot(hR - hL, hU - hD) * inv2s * 0.7;
      if (slope > 1) slope = 1;
      setTintNormalZ(-nz2 * nl);
      surfaceTint(px, pz, hC, slope, fg[kc], a0[kc], a1[kc], a2[kc], _tint);
      col[k * 3] = _tint[0]; col[k * 3 + 1] = _tint[1]; col[k * 3 + 2] = _tint[2];
    }
  }

  // Lines at x = per, 2 per … first, then the same in z; each is a
  // copy of the surface vertices along it, dropped like the skirt.
  if (E) {
    var per = n / m, xk = V;
    for (var ax2 = 0; ax2 < 2; ax2++) {
      for (var L = 1; L < m; L++) {
        for (var t = 0; t <= n; t++) {
          var ci2 = ax2 === 0 ? L * per : t, cj2 = ax2 === 0 ? t : L * per;
          var src = (cj2 + 1) * W + (ci2 + 1);
          pos[xk * 3] = pos[src * 3];
          pos[xk * 3 + 1] = pos[src * 3 + 1] - skirt;
          pos[xk * 3 + 2] = pos[src * 3 + 2];
          for (var q = 0; q < 3; q++) { nrm[xk * 3 + q] = nrm[src * 3 + q]; col[xk * 3 + q] = col[src * 3 + q]; }
          uv[xk * 2] = uv[src * 2]; uv[xk * 2 + 1] = uv[src * 2 + 1];
          xk++;
        }
      }
    }
  }

  (postMessage as Worker['postMessage'])(
    { id: d.id, W: W, m: m, pos: pos, nrm: nrm, col: col, uv: uv },
    [pos.buffer, nrm.buffer, col.buffer, uv.buffer]
  );
};
