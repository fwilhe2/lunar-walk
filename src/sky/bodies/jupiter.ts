import * as THREE from 'three';
import { runJob } from '../../workers/texgen.jobs';
import type { BodyMaps } from './types';

export function jupiterMaps(px?: ImageDataArray): BodyMaps {
  const W = 1024, H = 512;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  // A fresh canvas always has a 2d context.
  const x = c.getContext('2d')!;
  x.putImageData(new ImageData(px || runJob('jupiterPixels', [W, H]), W, H), 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return { day: t };
}
