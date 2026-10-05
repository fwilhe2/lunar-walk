import { runJob, type JobArgs, type JobName, type JobResult, type TexgenRequest } from '../workers/texgen.jobs';

/* Run one of the pure texture generators (workers/texgen.jobs.ts) in a
   worker of its own, falling back to the main thread if one cannot be
   started. */
export function offThread<K extends JobName>(fn: K, ...args: JobArgs<K>): Promise<JobResult<K>> {
  return new Promise((resolve) => {
    const here = () => resolve(runJob(fn, args));
    let w: Worker;
    try { w = new Worker(new URL('../workers/texgen.worker.ts', import.meta.url), { type: 'module' }); } catch (err) { here(); return; }
    // The worker runs the same job on the same arguments.
    w.onmessage = (e: MessageEvent<JobResult<K>>) => { w.terminate(); resolve(e.data); };
    w.onerror = () => { w.terminate(); here(); };
    w.postMessage({ fn, args } satisfies TexgenRequest<K>);
  });
}
