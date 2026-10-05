import * as THREE from 'three';
import { neptunePixels } from './neptune.pixels';
import type { BodyMaps } from './types';

export function neptuneMaps(px?: ImageDataArray): BodyMaps {
  const W = 512, H = 256;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  // A fresh canvas always has a 2d context.
  c.getContext('2d')!.putImageData(new ImageData(px || neptunePixels(W, H), W, H), 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return { day: t };
}
