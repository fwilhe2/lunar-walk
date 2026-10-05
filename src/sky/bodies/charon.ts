import * as THREE from 'three';
import { charonPixels } from './charon.pixels';

export function charonMaps(px) {
  const W = 512, H = 256;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  c.getContext('2d').putImageData(new ImageData(px || charonPixels(), W, H), 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return { day: t };
}
