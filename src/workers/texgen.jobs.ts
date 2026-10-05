/* Texture generators that are pure pixel loops — no three, no DOM,
   only the kernel's noise — so they can run in a worker (texgen.worker.ts)
   and, should a worker fail, on the main thread (util/texgen.ts). A new
   body's map generator should be written this way and listed here, or
   it freezes the page the first time someone visits. Call them through
   runJob(), never directly: it fixes the noise seed they draw under. */
import { SEED, SEED_DEFAULT, setSeed } from '../kernel/noise';
import { regolithData } from '../surface/regolith.pixels';
import { charonPixels } from '../sky/bodies/charon.pixels';
import { galileanPixels } from '../sky/bodies/galilean.pixels';
import { jupiterPixels } from '../sky/bodies/jupiter.pixels';
import { neptunePixels } from '../sky/bodies/neptune.pixels';
import { plutoPixels } from '../sky/bodies/pluto.pixels';
import { uranusPixels } from '../sky/bodies/uranus.pixels';

export const JOBS = { regolithData, jupiterPixels, galileanPixels, charonPixels, plutoPixels, neptunePixels, uranusPixels };

type Jobs = typeof JOBS;
export type JobName = keyof Jobs;
export type JobArgs<K extends JobName> = Parameters<Jobs[K]>;
export type JobResult<K extends JobName> = ReturnType<Jobs[K]>;

/** Main thread → texgen worker: run one job; the reply is its result. */
export interface TexgenRequest<K extends JobName = JobName> { fn: K; args: JobArgs<K> }

export function runJob<K extends JobName>(fn: K, args: JobArgs<K>): JobResult<K> {
  // TypeScript cannot tie JOBS[fn] to JobArgs<K> for a generic K (it
  // sees a union of functions), so the lookup is widened once, here.
  const job = JOBS[fn] as (...a: JobArgs<K>) => JobResult<K>;
  // The generators draw from the kernel's noise, whose seed is the
  // world's on the main thread and the default in a worker. A map must
  // not depend on where it was drawn, nor on the world you stand on,
  // so every job runs under the default and puts the world's back.
  const s = SEED;
  setSeed(SEED_DEFAULT);
  try { return job(...args); } finally { setSeed(s); }
}
