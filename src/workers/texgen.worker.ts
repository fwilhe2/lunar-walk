import { runJob, type TexgenRequest } from './texgen.jobs';

onmessage = (e: MessageEvent<TexgenRequest>) => {
  const r = runJob(e.data.fn, e.data.args);
  // Typed arrays travel by transfer: the result itself, or those among its fields.
  const views = ArrayBuffer.isView(r) ? [r] : Object.values(r).filter((v) => ArrayBuffer.isView(v));
  // The DOM lib types the global postMessage as a window's; see mesh.worker.ts.
  (postMessage as (msg: unknown, transfer: Transferable[]) => void)(r, views.map((v) => v.buffer as ArrayBuffer));
};
