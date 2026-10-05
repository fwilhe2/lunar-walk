import * as THREE from 'three';
import type { WorldView } from '../worlds/view-types';

/* ═════════════════════════════════════════════════════════════
   SURFACE LIGHT — how regolith reflects light, and where the
   ground shadows itself. Every material that sits on a world goes
   through surfacePatch() below: the ground, footprints and wheel
   tracks, rocks, and the man-made things.

   Two things are patched in. The first is the terrain shadow: the
   horizon maps built in terrain/shadows.ts say, for any point on the surface, how
   high the skyline stands in the direction of the sun, so a single
   texture fetch decides whether that point can see the sun — from a
   pebble's crater to a massif ten kilometres off. The comparison is
   made against the sun's true angular radius, so penumbrae widen
   with distance from their caster exactly as they should.

   The second is the reflectance itself. Regolith is not Lambertian,
   and nothing about the Moon looks right while it is treated as if
   it were. It is a fluffy, porous soil of dark grains, and it
   reflects according to Hapke's model: a Lommel–Seeliger core that
   makes a lit surface look equally bright at every viewing angle —
   the reason the full Moon has no limb darkening — a single-particle
   phase function that throws light back toward the sun, an
   opposition surge where every grain hides its own shadow (the halo
   around the astronaut's shadow in every Apollo photograph), and a
   macroscopic roughness that fills the ground with shadows too small
   to see. The result: looking down-sun the ground washes out to a
   featureless glare, looking up-sun it goes dark with every rim
   picked out in light, and across the sun it looks the way you
   expect it to. The parameters are the published lunar ones (Sato
   et al. 2014, from LROC); everything else here is scaled per body.
   ═════════════════════════════════════════════════════════════ */
export const DEG = Math.PI / 180;
/** A Hapke parameter set: a world's (world.hapke), or one derived from it. */
export type HapkeParams = WorldView['hapke'];
// The eye's adapted exposure (log2), as a texture, for the few things
// that must look the same however open the eye is. Written by render/post.ts.
export const EYE_TEX = new THREE.Uniform<THREE.Texture | null>(null);

// The same Hapke function as the shader below, used once per
// parameter set to normalise it: at the standard i = 30°, e = 0°,
// g = 30° geometry a patch reflects exactly what a Lambertian one of
// the same albedo would, so the albedos the kernel writes keep
// meaning what they say.
function hapkeJS(mu0: number, mu: number, cosg: number, p: HapkeParams) {
  const tt = Math.tan(p.theta * DEG);
  const ci = mu0, ce = mu, si = Math.sqrt(1 - ci * ci), se = Math.sqrt(1 - ce * ce);
  const i = Math.max(Math.acos(ci), 1e-3), e = Math.max(Math.acos(ce), 1e-3);
  const cphi = si * se > 1e-4 ? Math.max(-1, Math.min(1, (cosg - ci * ce) / (si * se))) : 1;
  const phi = Math.min(Math.acos(cphi), Math.PI - 1e-3);
  const chi = 1 / Math.sqrt(1 + Math.PI * tt * tt);
  const E1 = (x: number) => Math.exp(-2 / (Math.PI * tt * Math.tan(x)));
  const E2 = (x: number) => { const t = tt * Math.tan(x); return Math.exp(-1 / (Math.PI * t * t)); };
  const etai = chi * (ci + si * tt * E2(i) / (2 - E1(i)));
  const etae = chi * (ce + se * tt * E2(e) / (2 - E1(e)));
  const s2 = Math.sin(phi / 2) ** 2, f = Math.exp(-2 * Math.tan(phi / 2));
  let m0, m1, S;
  if (i <= e) {
    const den = 2 - E1(e) - phi / Math.PI * E1(i);
    m0 = chi * (ci + si * tt * (cphi * E2(e) + s2 * E2(i)) / den);
    m1 = chi * (ce + se * tt * (E2(e) - s2 * E2(i)) / den);
    S = m1 / etae * ci / etai * chi / (1 - f + f * chi * ci / etai);
  } else {
    const den = 2 - E1(i) - phi / Math.PI * E1(e);
    m0 = chi * (ci + si * tt * (E2(i) - s2 * E2(e)) / den);
    m1 = chi * (ce + se * tt * (cphi * E2(i) + s2 * E2(e)) / den);
    S = m1 / etae * ci / etai * chi / (1 - f + f * chi * ce / etae);
  }
  const b = p.b, c = p.c, b2 = b * b;
  const P = 0.5 * (1 + c) * (1 - b2) / Math.pow(1 - 2 * b * cosg + b2, 1.5)
          + 0.5 * (1 - c) * (1 - b2) / Math.pow(1 + 2 * b * cosg + b2, 1.5);
  const tg = Math.sqrt(Math.max(1 - cosg, 0) / Math.max(1 + cosg, 1e-4));
  const Bs = p.B0 / (1 + tg / p.h);
  const xc = tg / p.hc;
  const Bc = p.Bc0 * (1 + (1 - Math.exp(-xc)) / Math.max(xc, 1e-4)) / (2 * (1 + xc) * (1 + xc));
  const gam = Math.sqrt(1 - p.w);
  const H0 = (1 + 2 * m0) / (1 + 2 * m0 * gam), H1 = (1 + 2 * m1) / (1 + 2 * m1 * gam);
  return p.w / (4 * Math.PI) * m0 / (m0 + m1) * ((1 + Bs) * P + H0 * H1 - 1) * (1 + Bc) * S;
}

/* Hapke is some twenty transcendental operations per pixel — as much
   arithmetic as the rest of the ground shader together — but it only
   ever depends on three numbers: the cosines of incidence and emission
   and the phase angle. So the tiers that cannot afford it per pixel
   (render/quality.ts) read it from a 32³ table instead, one fetch. The phase axis
   runs in √(g/π), which spends most of the samples near zero phase,
   where the opposition surge is. */
const HPK_N = 32;
const hpkLuts = new Map<string, THREE.Data3DTexture>();
function hapkeLut(p: HapkeParams, norm: number) {
  const key = JSON.stringify(p);
  let t = hpkLuts.get(key);
  if (t) return t;
  const N = HPK_N, data = new Uint16Array(N * N * N);
  for (let k = 0; k < N; k++) {
    const u = k / (N - 1), cg = Math.cos(Math.PI * u * u);
    for (let j = 0; j < N; j++) {
      const mu = Math.max(j / (N - 1), 0.02);
      for (let i = 0; i < N; i++) {
        const r = hapkeJS(Math.max(i / (N - 1), 1e-3), mu, cg, p) * norm;
        data[(k * N + j) * N + i] = THREE.DataUtils.toHalfFloat(Number.isFinite(r) ? Math.min(r, 6e4) : 0);
      }
    }
  }
  t = new THREE.Data3DTexture(data, N, N, N);
  t.format = THREE.RedFormat;
  t.type = THREE.HalfFloatType;
  t.minFilter = t.magFilter = THREE.LinearFilter;
  t.wrapS = t.wrapT = t.wrapR = THREE.ClampToEdgeWrapping;
  t.unpackAlignment = 1;
  t.needsUpdate = true;
  hpkLuts.set(key, t);
  return t;
}

/** The uniforms one Hapke set is drawn with; setHapke() fills them. */
export interface HapkeUniforms {
  hpkA: THREE.IUniform<THREE.Vector4>; hpkB: THREE.IUniform<THREE.Vector4>;
  hpkN: THREE.IUniform<number>; hpkLut: THREE.IUniform<THREE.Data3DTexture | null>;
}
export function hapkeUniforms(): HapkeUniforms {
  return { hpkA: { value: new THREE.Vector4() }, hpkB: { value: new THREE.Vector4() },
           hpkN: { value: 1 }, hpkLut: { value: null } };
}
export function setHapke(u: HapkeUniforms, p: HapkeParams) {
  u.hpkA.value.set(p.w, p.b, p.c, p.B0);
  u.hpkB.value.set(p.h, Math.tan(p.theta * DEG), p.Bc0, p.hc);
  const c30 = Math.cos(30 * DEG);
  u.hpkN.value = c30 / Math.PI / hapkeJS(c30, 1, c30, p);
  u.hpkLut.value = hapkeLut(p, u.hpkN.value);
}
