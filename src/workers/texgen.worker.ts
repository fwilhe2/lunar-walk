import { JOBS } from './texgen.jobs';

onmessage = (e) => {
  const r = JOBS[e.data.fn](...e.data.args);
  postMessage(r, (ArrayBuffer.isView(r) ? [r] : Object.values(r).filter((v) => ArrayBuffer.isView(v))).map((v) => v.buffer));
};
