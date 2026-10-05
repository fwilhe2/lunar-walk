import type { ChunkRequest } from '../workers/mesh.protocol';
import type { StreamLevel } from '../worlds/view-types';

/* Which chunks the streamer (terrain/streamer.ts) wants around the
   player: a pure function of the world's levels, the place and the
   tier, so tests/plan.test.ts can check it covers the ground. */

/** A chunk wanted around the player: what the worker is asked to build,
    plus its level, the ring it is in (build order) and the cells per
    side a hole can be cut in (m, 0 on the finest level). */
export type ChunkSpec = Omit<ChunkRequest, 'id' | 'world' | 'm'> & { level: number; ring: number; m: number };

// coarse is LOD_COARSE (render/quality.ts, on low): every step past the
// nearest ring doubled — a third of the vertices, for ground far
// enough away that the difference is a pixel or two.
const l0Step = (ring: number, coarse: boolean) => (ring <= 1 ? 1 : ring <= 2 ? (coarse ? 4 : 2) : (coarse ? 8 : 4));

export function planChunks(levels: readonly StreamLevel[], px: number, pz: number, coarse: boolean) {
  const out = new Map<string, ChunkSpec>();
  // Anchor for the curvature drop: the player's current L0 cell
  // centre. Near chunks are rebuilt often enough that the drop at
  // the player's own feet stays under a centimetre.
  const a0x = (Math.floor(px / 256) + 0.5) * 256;
  const a0z = (Math.floor(pz / 256) + 0.5) * 256;

  // On low quality the 1 km ring stops a chunk short where a coarser
  // level follows it: 32 fewer draws, and the 4 km chunks take over.
  // li is always a level's index here (hence the !s).
  const extOf = (li: number) => levels[li]!.ext - (coarse && li === 1 && levels.length > 2 ? 1 : 0);
  for (let li = 0; li < levels.length; li++) {
    const L = levels[li]!, ext = extOf(li);
    const ccx = Math.floor(px / L.size), ccz = Math.floor(pz / L.size);
    // Box covered by the previous (finer) level, for skipping.
    let cov: { x0: number; x1: number; z0: number; z1: number } | null = null;
    if (li > 0) {
      const P = levels[li - 1]!, pe = extOf(li - 1);
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
        const n = Math.max(1, Math.round(L.size / (li === 0 ? l0Step(ring, coarse) : L.step! * (coarse ? 2 : 1))));
        const step = L.size / n;
        out.set(li + ':' + cx + ':' + cz + ':' + step, {
          level: li, x0, z0, step, n,
          ax: a0x, az: a0z, ring: ring + li * 10,
          // Cells per side, one per chunk of the finer level: where a
          // hole can be cut (see holeTriangles in terrain/lattice.ts).
          m: li > 0 ? L.size / levels[li - 1]!.size : 0,
        });
      }
    }
  }
  return out;
}
