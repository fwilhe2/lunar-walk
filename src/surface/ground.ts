import * as THREE from 'three';
import { hapkeUniforms } from './hapke';
import { surfacePatch } from './patch';
import { REGO_BLANK } from './regolith';

/* The ground. Chunk UVs are world-position / 3, so the tile runs
   seamlessly across chunk borders, and the vertex colours from the
   kernel carry every albedo change bigger than a few metres. */
export const uSunView = { value: new THREE.Vector3() };
export const uSparkle = { value: 0.3 };
export const groundHapke = hapkeUniforms();
export const GROUND_U = {
  rgMean: { value: 0.1 },
  rgMeanC: { value: new THREE.Color(0.1, 0.1, 0.1) },
  rgMicro: { value: new THREE.Vector4(1, 0.85, 0.6, 0) },
  uSunView, uSparkle,
};

export const groundMat = surfacePatch(new THREE.MeshStandardMaterial({
  map: REGO_BLANK.map,
  normalMap: REGO_BLANK.normalMap,
  normalScale: new THREE.Vector2(1, 1),
  vertexColors: true,
  roughness: 1.0,
  metalness: 0.0,
  dithering: true,
  fog: true,
}), 'ground', groundHapke, GROUND_U);
