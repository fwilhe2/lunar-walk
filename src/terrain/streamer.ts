import * as THREE from 'three';
import { scene } from '../render/renderer';
import { groundMat } from '../surface/ground';
import { setCurveAX, setCurveAZ } from './anchor';
import { VIEW } from '../worlds/index';

/* ═════════════════════════════════════════════════════════════
   CHUNK STREAMER
   Four nested levels of absolutely-aligned square chunks:

     L0   256 m chunks, ±4  → ±1.15 km   step 1 m (2 m, 4 m out)
     L1  1024 m chunks, ±4  → ±4.6 km    step 16 m
     L2  4096 m chunks, ±3  → ±14 km     step 64 m
     L3 16384 m chunks, ±2  → ±40 km     step 256 m

   Coarse chunks fully covered by the next-finer level are
   skipped. One only partly covered has a hole cut in it wherever
   finer ground is already built (holeIndex), with a wall hung
   round the cut; left whole, it would run on under the fine mesh
   and show through every crater floor it could not follow. So no
   level overlaps another, none needs sinking under it, and the
   seams are closed by skirts and walls from both sides. Stale chunks are
   purged only once their level has no pending builds, so motion
   never opens holes in the ground.
   With the curvature drop, ±40 km is past the horizon even from
   the flight ceiling: the surface has no visible end.
   ═════════════════════════════════════════════════════════════ */
export const chunkGroup = new THREE.Group();
scene.add(chunkGroup);

let LEVELS = VIEW.moon.levels();
// LOD_COARSE (set by render/quality.ts on low quality) doubles every step past the
// nearest ring: a third of the vertices, for ground far enough away
// that the difference is a pixel or two.
export let LOD_COARSE = false;
const l0Step = (ring) => (ring <= 1 ? 1 : ring <= 2 ? (LOD_COARSE ? 4 : 2) : (LOD_COARSE ? 8 : 4));

export const chunkStreamer = (() => {
  const chunks = new Map();          // key → { mesh, level, x0, z0, W, m, mask }
  const queue = [];                  // jobs waiting for a worker
  const inFlight = new Map();        // job id → job
  const pendingPerLevel = [0, 0, 0, 0];
  let jobSeq = 0;
  let desired = new Map();
  let lastCell = null;
  let activeWorld = 'moon';
  let version = 0;                   // bumped whenever the set of meshes changes

  const workers = [];
  function spawnWorkers() {
    for (let i = 0; i < Math.min(4, navigator.hardwareConcurrency || 2); i++) {
      const w = new Worker(new URL('../workers/mesh.worker.ts', import.meta.url), { type: 'module' }) as Worker & { _idle?: boolean };
      w.onmessage = (e) => onChunkBuilt(e.data, w);
      w._idle = true;
      workers.push(w);
    }
  }
  spawnWorkers();

  // One shared index buffer per grid width.
  const indexCache = new Map();
  function gridIndex(W) {
    let idx = indexCache.get(W);
    if (idx) return idx;
    const arr = new Uint32Array((W - 1) * (W - 1) * 6);
    let o = 0;
    for (let j = 0; j < W - 1; j++) {
      for (let i = 0; i < W - 1; i++) {
        const a = j * W + i, b = a + 1, c = a + W, d = c + 1;
        arr[o++] = a; arr[o++] = c; arr[o++] = b;
        arr[o++] = b; arr[o++] = c; arr[o++] = d;
      }
    }
    idx = new THREE.BufferAttribute(arr, 1);
    indexCache.set(W, idx);
    return idx;
  }

  /* The same grid with a hole in it. A coarse chunk is split into m×m
     cells, one per chunk of the next finer level, and mask has a bit
     set for each cell finer ground already stands on: those quads are
     left out, and a wall is hung along every edge between a cut cell
     and a kept one, facing into the hole, from the dropped vertices
     the worker put after the grid. Without the cut, the coarse mesh
     runs on under the fine one and shows through wherever the ground
     dips below its long chords: every crater floor bigger than the
     coarse step. Shared, like gridIndex. */
  function holeIndex(W, m, mask) {
    const key = W + ':' + m + ':' + mask;
    let idx = indexCache.get(key);
    if (idx) return idx;
    const n = W - 3, per = n / m, V = W * W, out = [];
    const cut = (fx, fz) => (mask >> (fz * m + fx)) & 1;
    const cl = (g) => (g < 0 ? 0 : g > n ? n : g);
    // The cell a quad belongs to, by its centre; skirt quads, which
    // have no width, fall in the cell whose edge they hang from.
    const cellOf = (i) => Math.min(m - 1, Math.floor((cl(i - 1) + cl(i)) / 2 / per));
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
    idx = new THREE.BufferAttribute(new Uint32Array(out), 1);
    indexCache.set(key, idx);
    return idx;
  }

  /* Which cells have ground standing on them: 'level:cx:cz' → the keys
     of the chunks built there (two, briefly, while a refresh rebuilds
     a cell at a new step). A cell is solid if a chunk of its own level
     is built on it, or if every cell of the next finer level inside it
     is solid — on low quality a 4 km chunk runs over 1 km cells that
     were never built, because 256 m chunks already cover them. */
  const built = new Map();
  const cellKey = (li, cx, cz) => li + ':' + cx + ':' + cz;
  function solid(li, cx, cz) {
    if (built.has(cellKey(li, cx, cz))) return true;
    if (li === 0) return false;
    const m = LEVELS[li].size / LEVELS[li - 1].size;
    for (let fz = 0; fz < m; fz++) {
      for (let fx = 0; fx < m; fx++) if (!solid(li - 1, cx * m + fx, cz * m + fz)) return false;
    }
    return true;
  }
  // Re-cut one coarse chunk against what finer ground now stands on it.
  function recut(key) {
    const c = chunks.get(key);
    if (!c || !c.m) return;
    const m = c.m, cx = Math.round(c.x0 / LEVELS[c.level].size), cz = Math.round(c.z0 / LEVELS[c.level].size);
    let mask = 0;
    for (let fz = 0; fz < m; fz++) {
      for (let fx = 0; fx < m; fx++) if (solid(c.level - 1, cx * m + fx, cz * m + fz)) mask |= 1 << (fz * m + fx);
    }
    if (mask === c.mask) return;
    c.mask = mask;
    c.mesh.geometry.setIndex(mask ? holeIndex(c.W, m, mask) : gridIndex(c.W));
    c.mesh.visible = mask !== (1 << (m * m)) - 1;
    version++;
  }
  // A chunk came or went at (x, z): re-cut every coarser chunk over it.
  function recutOver(level, x, z) {
    for (let li = level + 1; li < LEVELS.length; li++) {
      const S = LEVELS[li].size;
      const keys = built.get(cellKey(li, Math.floor(x / S), Math.floor(z / S)));
      if (keys) for (const k of keys) recut(k);
    }
  }
  function drop(key, c) {
    chunkGroup.remove(c.mesh);
    // Detach the shared index first: disposing a geometry frees its
    // index's GL buffer, and every other chunk of that width uses it.
    c.mesh.geometry.setIndex(null);
    c.mesh.geometry.dispose();
    chunks.delete(key);
    const ck = cellKey(c.level, Math.round(c.x0 / LEVELS[c.level].size), Math.round(c.z0 / LEVELS[c.level].size));
    const set = built.get(ck);
    if (set) { set.delete(key); if (!set.size) built.delete(ck); }
    version++;
    recutOver(c.level, c.x0 + 1, c.z0 + 1);
  }

  function computeDesired(px, pz) {
    const out = new Map();
    // Anchor for the curvature drop: the player's current L0 cell
    // centre. Near chunks are rebuilt often enough that the drop at
    // the player's own feet stays under a centimetre.
    const a0x = (Math.floor(px / 256) + 0.5) * 256;
    const a0z = (Math.floor(pz / 256) + 0.5) * 256;
    setCurveAX(a0x); setCurveAZ(a0z);   // everything on the ground shares it

    // On low quality the 1 km ring stops a chunk short where a coarser
    // level follows it: 32 fewer draws, and the 4 km chunks take over.
    const extOf = (li) => LEVELS[li].ext - (LOD_COARSE && li === 1 && LEVELS.length > 2 ? 1 : 0);
    for (let li = 0; li < LEVELS.length; li++) {
      const L = LEVELS[li], ext = extOf(li);
      const ccx = Math.floor(px / L.size), ccz = Math.floor(pz / L.size);
      // Box covered by the previous (finer) level, for skipping.
      let cov = null;
      if (li > 0) {
        const P = LEVELS[li - 1], pe = extOf(li - 1);
        const pcx = Math.floor(px / P.size), pcz = Math.floor(pz / P.size);
        cov = {
          x0: (pcx - pe) * P.size, x1: (pcx + pe + 1) * P.size,
          z0: (pcz - pe) * P.size, z1: (pcz + pe + 1) * P.size,
        };
      }
      for (let dz = -ext; dz <= ext; dz++) {
        for (let dx = -ext; dx <= ext; dx++) {
          const cx = ccx + dx, cz = ccz + dz;
          const x0 = cx * L.size, z0 = cz * L.size;
          if (cov && x0 >= cov.x0 && x0 + L.size <= cov.x1 &&
                     z0 >= cov.z0 && z0 + L.size <= cov.z1) continue;
          const ring = Math.max(Math.abs(dx), Math.abs(dz));
          // The vertex count has to come out whole: the worker sizes
          // its grid as (n+3)² and indexes it as j*W+i, so a
          // fractional n writes NaNs into the position buffer and the
          // chunk comes back as a degenerate triangle across the
          // screen. Derive n first, then the step that fits it, so a
          // size and step that do not divide evenly can never do that.
          const n = Math.max(1, Math.round(L.size / (li === 0 ? l0Step(ring) : L.step * (LOD_COARSE ? 2 : 1))));
          const step = L.size / n;
          out.set(li + ':' + cx + ':' + cz + ':' + step, {
            level: li, x0, z0, step, n,
            ax: a0x, az: a0z, ring: ring + li * 10,
            // Cells per side, one per chunk of the finer level: where a
            // hole can be cut (see holeIndex).
            m: li > 0 ? L.size / LEVELS[li - 1].size : 0,
          });
        }
      }
    }
    return out;
  }

  function dispatch() {
    for (const w of workers) {
      if (!w._idle) continue;
      let job;
      while ((job = queue.shift())) {
        if (desired.has(job.key) && !chunks.has(job.key)) break;   // stale, skip
        pendingPerLevel[job.spec.level]--;
        job = null;
      }
      if (!job) return;
      w._idle = false;
      inFlight.set(job.id, job);
      const s = job.spec;
      w.postMessage({ id: job.id, world: activeWorld, x0: s.x0, z0: s.z0,
                      n: s.n, step: s.step, ax: s.ax, az: s.az, m: s.m });
    }
  }

  function onChunkBuilt(d, w) {
    w._idle = true;
    const job = inFlight.get(d.id);
    inFlight.delete(d.id);
    if (job) {
      const s = job.spec;
      pendingPerLevel[s.level]--;
      if (desired.has(job.key)) {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(d.pos, 3));
        geo.setAttribute('normal', new THREE.BufferAttribute(d.nrm, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(d.col, 3));
        geo.setAttribute('uv', new THREE.BufferAttribute(d.uv, 2));
        geo.setIndex(gridIndex(d.W));
        // Bounds round the heights actually there: a crater floor
        // kilometres down (Occator's is −3.2 km) is outside any sphere
        // centred at zero, and would be culled.
        const half = (s.n * s.step) / 2;
        let yLo = Infinity, yHi = -Infinity;
        for (let i = 1; i < d.pos.length; i += 3) { const y = d.pos[i]; if (y < yLo) yLo = y; if (y > yHi) yHi = y; }
        geo.boundingSphere = new THREE.Sphere(
          new THREE.Vector3(s.x0 + half, (yLo + yHi) / 2, s.z0 + half), Math.hypot(half * 1.42, (yHi - yLo) / 2) + 50);
        const mesh = new THREE.Mesh(geo, groundMat);
        mesh.userData.level = s.level;   // for debugging views; nothing reads it
        mesh.layers.enable(1);            // seen in the sea's mirror (render/sea.ts)
        mesh.receiveShadow = s.level === 0;
        chunks.set(job.key, { mesh, level: s.level, x0: s.x0, z0: s.z0, W: d.W, m: d.m, mask: 0 });
        chunkGroup.add(mesh);
        const ck = cellKey(s.level, Math.round(s.x0 / LEVELS[s.level].size), Math.round(s.z0 / LEVELS[s.level].size));
        if (!built.has(ck)) built.set(ck, new Set());
        built.get(ck).add(job.key);
        version++;
        recut(job.key);
        recutOver(s.level, s.x0 + 1, s.z0 + 1);
      }
      // Purge stale chunks of a level only once it has nothing pending:
      // the old ring keeps the ground solid while the new one builds.
      for (let li = 0; li < LEVELS.length; li++) {
        if (pendingPerLevel[li] > 0) continue;
        for (const [key, c] of chunks) {
          if (c.level !== li || desired.has(key)) continue;
          drop(key, c);
        }
      }
    }
    dispatch();
  }

  return {
    /* Changing world throws everything away. The workers are the
       awkward part: one may be halfway through a chunk of the old
       body, and its reply would arrive keyed to a stale job. Rather
       than track that, terminate them and start clean — it costs a
       few milliseconds behind a loading screen that is already up. */
    setWorld(id) {
      for (const w of workers) w.terminate();
      workers.length = 0;
      spawnWorkers();
      for (const c of chunks.values()) {
        chunkGroup.remove(c.mesh);
        c.mesh.geometry.setIndex(null);   // shared: see drop()
        c.mesh.geometry.dispose();
      }
      chunks.clear();
      built.clear();
      version++;
      queue.length = 0;
      inFlight.clear();
      pendingPerLevel.fill(0);
      desired = new Map();
      lastCell = null;
      activeWorld = id;
      LEVELS = VIEW[id].levels();
    },
    update(px, pz) {
      const cell = Math.floor(px / 256) + ':' + Math.floor(pz / 256);
      if (cell === lastCell) { dispatch(); return; }
      lastCell = cell;
      desired = computeDesired(px, pz);
      const known = new Set(chunks.keys());
      for (const j of queue) known.add(j.key);
      for (const j of inFlight.values()) known.add(j.key);
      for (const [key, spec] of desired) {
        if (known.has(key)) continue;
        queue.push({ id: ++jobSeq, key, spec });
        pendingPerLevel[spec.level]++;
      }
      queue.sort((a, b) => a.spec.ring - b.spec.ring);
      dispatch();
    },
    pending() {
      return pendingPerLevel[0] + pendingPerLevel[1] + pendingPerLevel[2] + pendingPerLevel[3];
    },
    // The vertex spacing of the finest chunk drawn at (x, z), so a
    // decal can sit on the triangles actually on screen (surface/stamps.ts).
    stepAt(x, z) {
      const L = LEVELS[0], cx = Math.floor(x / L.size), cz = Math.floor(z / L.size);
      for (const s of [1, 2, 4, 8]) if (chunks.has('0:' + cx + ':' + cz + ':' + s)) return s;
      return 1;
    },
    // Re-plan around the current position, e.g. after LOD_COARSE
    // changes. New chunks build while the old ones stand, as always.
    refresh() { lastCell = null; },
    get version() { return version; },
  };
})();

export function setLodCoarse(v) { return (LOD_COARSE = v); }
