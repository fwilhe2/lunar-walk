import * as THREE from 'three';
import { quality } from './quality';
import { camera, renderer, scene } from './renderer';
import { LAKE_U } from '../surface/patch';
import { dropAt } from '../terrain/anchor';
import { world } from '../worlds/index';

export const seaMirror = (() => {
  const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType });
  const cam = new THREE.PerspectiveCamera();
  cam.layers.set(1);
  // Bound in its place while drawing into it: a texture can't be read
  // and written in the same draw.
  const blank = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
  blank.needsUpdate = true;
  const bias = new THREE.Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
  const p = new THREE.Vector3(), d = new THREE.Vector3(), u = new THREE.Vector3(), q = new THREE.Quaternion();
  let tick = 0;
  LAKE_U.uLakeMap.value = blank;
  return {
    render() {
      LAKE_U.uLakeHave.value = 0;
      if (world.sea === undefined) return;
      camera.getWorldPosition(p);
      const L = world.sea - dropAt(p.x, p.z);
      if (p.y <= L) return;
      const low = quality.id === 'low';
      // On low it is redrawn every other frame.
      if (low && (tick++ & 1) && rt.width > 4) { LAKE_U.uLakeHave.value = 1; return; }
      camera.getWorldDirection(d);
      u.set(0, 1, 0).applyQuaternion(camera.getWorldQuaternion(q));
      const k = low ? 0.33 : 0.5;
      const w = Math.max(4, Math.round(renderer.domElement.width * k));
      const h = Math.max(4, Math.round(renderer.domElement.height * k));
      if (rt.width !== w || rt.height !== h) rt.setSize(w, h);
      cam.position.set(p.x, 2 * L - p.y, p.z);
      cam.up.set(u.x, -u.y, u.z);
      cam.lookAt(p.x + d.x, 2 * L - p.y - d.y, p.z + d.z);
      cam.fov = camera.fov; cam.aspect = camera.aspect;
      cam.near = 0.3; cam.far = camera.far;
      cam.updateProjectionMatrix();
      cam.updateMatrixWorld();
      LAKE_U.uLakeMat.value.copy(bias).multiply(cam.projectionMatrix).multiply(cam.matrixWorldInverse);
      LAKE_U.uLakeMap.value = blank;
      LAKE_U.uLakeMirror.value = 1;
      const prev = renderer.getRenderTarget();
      renderer.setRenderTarget(rt);
      renderer.clear();
      renderer.render(scene, cam);
      renderer.setRenderTarget(prev);
      LAKE_U.uLakeMirror.value = 0;
      LAKE_U.uLakeMap.value = rt.texture;
      LAKE_U.uLakeHave.value = 1;
    },
  };
})();
