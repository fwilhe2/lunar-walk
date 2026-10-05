import { JOBS } from '../workers/texgen.jobs';

/* Run one of the pure texture generators (workers/texgen.jobs.ts) in a
   worker of its own, falling back to the main thread if one cannot be
   started. */
export function offThread(fn, ...args) {
  return new Promise((resolve) => {
    const here = () => resolve(JOBS[fn](...args));
    let w;
    try { w = new Worker(new URL('../workers/texgen.worker.ts', import.meta.url), { type: 'module' }); } catch (err) { here(); return; }
    w.onmessage = (e) => { w.terminate(); resolve(e.data); };
    w.onerror = () => { w.terminate(); here(); };
    w.postMessage({ fn, args });
  });
}
