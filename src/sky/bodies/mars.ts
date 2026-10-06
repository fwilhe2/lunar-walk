import * as THREE from 'three';
import { runJob } from '../../workers/texgen.jobs';
import type { JobResult } from '../../workers/texgen.jobs';
import type { BodyMaps } from './types';

/* Mars's maps: the colour map, and the elevation the globe shader
   tilts its normal by. Both are drawn off the main thread
   (mars.pixels.ts); this only hands them to the GPU.

   The elevation goes up as a half-float texture in units of one
   texel's width at the equator, so the shader's finite difference is
   the true slope and `relief` (companions.ts) is plain vertical
   exaggeration. Its mip chain is built here by hand: three cannot
   generate mips for a half-float red texture everywhere, and without
   them Mars from Deimos, a quarter the size, would sparkle. */
export const MARS_W = 2048, MARS_H = 1024;
const R_KM = 3390;

export function marsMaps(px?: JobResult<'marsPixels'>): BodyMaps {
  const W = MARS_W, H = MARS_H;
  const r = px || runJob('marsPixels', [W, H]);
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  // A fresh canvas always has a 2d context.
  c.getContext('2d')!.putImageData(new ImageData(r.day, W, H), 0, 0);
  const day = new THREE.CanvasTexture(c);
  day.wrapS = THREE.RepeatWrapping;
  day.anisotropy = 4;

  // Kilometres → equatorial texel widths, and the rows turned over:
  // a DataTexture's first row is v = 0, the south pole.
  const k = W / (2 * Math.PI * R_KM);
  let w = W, h = H;
  let lv = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    const src = (H - 1 - y) * W, dst = y * W;
    for (let x = 0; x < W; x++) lv[dst + x] = r.elev[src + x]! * k;   // in range: both rows are inside W × H
  }
  // Each level keeps the base's units (texels of level 0), so the
  // shader can difference any of them the same way.
  const mipmaps: { data: Uint16Array<ArrayBuffer>; width: number; height: number }[] = [];
  for (;;) {
    const data = new Uint16Array(w * h);
    for (let i = 0; i < w * h; i++) data[i] = THREE.DataUtils.toHalfFloat(lv[i]!);   // i < w·h
    mipmaps.push({ data, width: w, height: h });
    if (w === 1 && h === 1) break;
    const w2 = Math.max(1, w >> 1), h2 = Math.max(1, h >> 1), nx = new Float32Array(w2 * h2);
    // Box filter; indices clamp to the level above, which is at most
    // twice the size in each direction.
    for (let y = 0; y < h2; y++) {
      const y0 = Math.min(h - 1, y * 2), y1 = Math.min(h - 1, y * 2 + 1);
      for (let x = 0; x < w2; x++) {
        const x0 = Math.min(w - 1, x * 2), x1 = Math.min(w - 1, x * 2 + 1);
        nx[y * w2 + x] = (lv[y0 * w + x0]! + lv[y0 * w + x1]! + lv[y1 * w + x0]! + lv[y1 * w + x1]!) * 0.25;
      }
    }
    lv = nx; w = w2; h = h2;
  }
  const base = mipmaps[0]!;                                  // the loop pushes level 0 first
  const elev = new THREE.DataTexture(base.data, W, H, THREE.RedFormat, THREE.HalfFloatType);
  elev.mipmaps = mipmaps;
  elev.generateMipmaps = false;
  elev.minFilter = THREE.LinearMipmapLinearFilter;
  elev.magFilter = THREE.LinearFilter;
  elev.wrapS = THREE.RepeatWrapping;
  elev.needsUpdate = true;
  return { day, elev };
}
