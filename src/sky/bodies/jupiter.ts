import * as THREE from 'three';
import { jupiterPixels } from './jupiter.pixels';

export function jupiterMaps(px) {
  const W = 1024, H = 512;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  x.putImageData(new ImageData(px || jupiterPixels(W, H), W, H), 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return { day: t };
}
