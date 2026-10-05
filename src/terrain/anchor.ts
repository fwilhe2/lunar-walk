import * as THREE from 'three';
import { curveDrop } from '../kernel/curvature';
import { terrainHeight } from '../kernel/terrain';

export function terrainNormal(x: number, z: number, eps = 0.6) {
  const hL = terrainHeight(x - eps, z), hR = terrainHeight(x + eps, z);
  const hD = terrainHeight(x, z - eps), hU = terrainHeight(x, z + eps);
  return new THREE.Vector3(hL - hR, 2 * eps, hD - hU).normalize();
}

/* The curvature anchor the chunks were last built around. Anything
   placed on the ground outside the workers — rocks, boot prints,
   wheel tracks, the landmark — has to subtract the same drop, or
   it sits at the raw height while the mesh has curved away beneath
   it. Inside the flat cap, which is where you are standing, this
   is exactly zero. */
export let curveAX = 128, curveAZ = 128;
export const dropAt = (x: number, z: number) => curveDrop(x - curveAX, z - curveAZ);

export function setCurveAnchor(ax: number, az: number) { curveAX = ax; curveAZ = az; }
