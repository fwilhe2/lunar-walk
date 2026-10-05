import * as THREE from 'three';
import { RING_TAU } from './saturn';
import { runJob } from '../../workers/texgen.jobs';
import type { BodyMaps } from './types';

export const URING_KM = [41700, 51300] as const;
function uranusRingProfile() {
  const N = 2048, data = new Uint8Array(N * 4), dk = URING_KM[1] - URING_KM[0], per = dk / N;
  // [radius km, width km, optical depth]: 6, 5, 4, α, β, η, γ, δ, λ, ε.
  const R = [[41837, 1.5, 0.3], [42234, 2, 0.5], [42571, 2, 0.3], [44718, 9, 0.4], [45661, 9, 0.3],
             [47176, 1.6, 0.4], [47627, 3, 1.5], [48300, 6, 0.5], [50024, 2, 0.1], [51149, 58, 1.5]] as const;
  // i stays inside the N texels, and j is clamped to them.
  const tau = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const km = URING_KM[0] + (i + 0.5) * per;
    tau[i] = 0.0005;
    // A ring narrower than a texel keeps its equivalent width.
    for (const [rk, w, t] of R) { const d = Math.abs(km - rk); if (d < Math.max(w, per) / 2 + per / 2) tau[i]! += t * Math.min(1, w / per); }
  }
  // From Miranda a pixel spans some 250 km of ring: spread each ring's
  // optical depth over 300 km, keeping its sum, or its shadow on the
  // planet samples into a dotted line.
  const B = 32;
  for (let i = 0; i < N; i++) {
    let sum = 0;
    for (let j = i - B; j <= i + B; j++) sum += tau[Math.min(N - 1, Math.max(0, j))]!;
    data[i * 4] = 0.03 * 255; data[i * 4 + 1] = 0.03 * 255; data[i * 4 + 2] = 0.029 * 255;
    data[i * 4 + 3] = Math.min(255, Math.max(1, sum / (2 * B + 1) / RING_TAU * 255));
  }
  const t = new THREE.DataTexture(data, N, 1, THREE.RGBAFormat);
  t.magFilter = t.minFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}
export function uranusMaps(px?: ImageDataArray): BodyMaps {
  const W = 512, H = 256;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  // A fresh canvas always has a 2d context.
  c.getContext('2d')!.putImageData(new ImageData(px || runJob('uranusPixels', [W, H]), W, H), 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return { day: t, ring: uranusRingProfile() };
}
