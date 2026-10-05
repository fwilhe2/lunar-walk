/* What the chunk streamer (terrain/streamer.ts) and the mesh worker
   (mesh.worker.ts) say to each other. Both are built from the same
   source, so the type is the contract; nothing is checked at run time. */
import type { WorldId } from '../worlds/terrains';

/** Main thread → worker: build one chunk of the named world. */
export interface ChunkRequest {
  id: number;            // job id, echoed back
  world: WorldId;
  x0: number; z0: number;   // chunk origin, m
  n: number;             // quads per side
  step: number;          // m between vertices
  ax: number; az: number;   // curvature anchor
  m?: number;            // finer chunks per side, for the walls of cut holes (0 or absent: none)
}

/** Worker → main thread: the chunk's vertex arrays, transferred. */
export interface ChunkReply {
  id: number;
  W: number;             // grid width, n + 3
  m: number;             // the m the walls were built for (0 if none)
  pos: Float32Array; nrm: Float32Array; col: Float32Array; uv: Float32Array;
}
