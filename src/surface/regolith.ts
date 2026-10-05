import * as THREE from 'three';
import { SUN_XZ } from '../render/lights';
import { ANISO } from '../render/renderer';
import { regolithData } from './regolith.pixels';
import { offThread } from '../util/texgen';
import { VIEW } from '../worlds/views';

function regolithTextures(d) {
  const tex = (data, srgb) => {
    const t = new THREE.DataTexture(data, d.S, d.S, THREE.RGBAFormat);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    t.anisotropy = ANISO;
    t.needsUpdate = true;
    return t;
  };
  return { map: tex(d.alb, true), normalMap: tex(d.nrm, false), mean: d.mean,
           meanC: new THREE.Color(d.mR, d.mean, d.mB) };
}

// One set per world, built the first time off the main thread and
// kept — half a second of generation that should neither freeze the
// page nor be repeated every time you hop bodies. The worker gets only
// the fields of the view it reads.
export const regoCache = new Map(), regoJobs = new Map();
const regoArgs = (id) => {
  const v = VIEW[id];
  return { v: { grey: v.grey, mapTint: v.mapTint, pits: v.pits, grain: v.grain, pebbles: v.pebbles, clods: v.clods, plate: v.plate, ripple: v.ripple },
           hx: SUN_XZ.x, hy: SUN_XZ.y };
};
export function regolithAsync(id) {
  if (regoCache.has(id)) return Promise.resolve(regoCache.get(id));
  let job = regoJobs.get(id);
  if (!job) {
    const a = regoArgs(id);
    job = offThread('regolithData', a.v, a.hx, a.hy)
      .then((d) => { const m = regolithTextures(d); regoCache.set(id, m); return m; });
    regoJobs.set(id, job);
  }
  return job;
}
export function regolithFor(id) {
  let m = regoCache.get(id);
  if (!m) { const a = regoArgs(id); regoCache.set(id, m = regolithTextures(regolithData(a.v, a.hx, a.hy))); }
  return m;
}
// What the ground holds until its world's set arrives. Never drawn —
// the loading screen covers it — but it gives the material the same
// texture slots, and so the same program, from the start.
export const REGO_BLANK = regolithTextures({ S: 4, alb: new Uint8Array(64).fill(128), nrm: new Uint8Array(64).fill(128), mean: 0.2, mR: 0.2, mB: 0.2 });
