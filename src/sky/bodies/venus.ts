import * as THREE from 'three';
import { fbm } from '../../kernel/noise';
import type { BodyMaps } from './types';

/* ── Venus, from outside ────────────────────────────────────────
   From Mercury it is a point, so this is only its colour: the cloud
   tops, pale cream and almost featureless in visible light — the
   famous banding is in the ultraviolet — at an albedo of three
   quarters, the brightest planet in the system. */
export function venusMaps(): BodyMaps {
  const W = 128, H = 64;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  // A fresh canvas always has a 2d context.
  const x = c.getContext('2d')!;
  const img = x.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    for (let xx = 0; xx < W; xx++) {
      const v = 226 + (fbm(xx * 0.05, y * 0.12, 3) - 0.5) * 14;
      const o = (y * W + xx) * 4;
      img.data[o] = v; img.data[o + 1] = v * 0.96; img.data[o + 2] = v * 0.84; img.data[o + 3] = 255;
    }
  }
  x.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  return { day: t };
}
