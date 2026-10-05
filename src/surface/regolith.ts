import * as THREE from 'three';
import { SUN_XZ } from '../render/lights';
import { ANISO } from '../render/renderer';
import { regolithData } from './regolith.pixels';
import { offThread } from '../util/texgen';
import { VIEW, type WorldId } from '../worlds/index';


/* ═════════════════════════════════════════════════════════════
   REGOLITH TEXTURES — generated, so nothing is ever fetched.
   One pair per world, built on first visit and kept: the base
   grey is the body's real reflectance carrier (the vertex colours
   from surfaceTint do the rest), and the micro-relief differs
   because the processes do. Lunar and Phobos regolith is a soil of
   clods and grains, pitted by micrometeorites all the way down to
   the millimetre and strewn with pebbles; Martian soil has that
   planed off and wind-ripples written over it; Venus is a cracked
   basalt pavement, which is neither.

   The tile is 3 m of ground on 1024² texels, so ~3 mm a texel, and
   everything is built periodic so it repeats without a seam. The
   height field is in millimetres over millimetres, so the normals
   it produces are real slopes. The normal map's alpha carries a
   *horizon*: for each texel, how steeply the relief rises toward the
   sun's azimuth — which never changes — so the shader can tell
   whether that texel is in the shadow of the grain beside it. At a
   low sun every clod and pit casts one, which is most of what makes
   regolith look like regolith.
   ═════════════════════════════════════════════════════════════ */
function regolithTextures(d: ReturnType<typeof regolithData>) {
  const tex = (data: Uint8Array<ArrayBuffer>, srgb: boolean) => {
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
type RegolithSet = ReturnType<typeof regolithTextures>;
export const regoCache = new Map<WorldId, RegolithSet>(), regoJobs = new Map<WorldId, Promise<RegolithSet>>();
const regoArgs = (id: WorldId) => {
  const v = VIEW[id];
  return { v: { grey: v.grey, mapTint: v.mapTint, pits: v.pits, grain: v.grain, pebbles: v.pebbles, clods: v.clods, plate: v.plate, ripple: v.ripple },
           hx: SUN_XZ.x, hy: SUN_XZ.y };
};
export function regolithAsync(id: WorldId) {
  if (regoCache.has(id)) return Promise.resolve(regoCache.get(id)!);   // has() just said so
  let job = regoJobs.get(id);
  if (!job) {
    const a = regoArgs(id);
    job = offThread('regolithData', a.v, a.hx, a.hy)
      .then((d) => { const m = regolithTextures(d); regoCache.set(id, m); return m; });
    regoJobs.set(id, job);
  }
  return job;
}
export function regolithFor(id: WorldId) {
  let m = regoCache.get(id);
  if (!m) { const a = regoArgs(id); regoCache.set(id, m = regolithTextures(regolithData(a.v, a.hx, a.hy))); }
  return m;
}
// What the ground holds until its world's set arrives. Never drawn —
// the loading screen covers it — but it gives the material the same
// texture slots, and so the same program, from the start.
export const REGO_BLANK = regolithTextures({ S: 4, alb: new Uint8Array(64).fill(128), nrm: new Uint8Array(64).fill(128), mean: 0.2, mR: 0.2, mB: 0.2 });
