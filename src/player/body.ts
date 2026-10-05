import * as THREE from 'three';
import { scene } from '../render/renderer';
import { surfacePatch } from '../surface/patch';

/* Your own body, for the one thing you can ever see of it: its
   shadow. The suit is drawn into the shadow maps and nowhere else.
   Turn your back to the sun and it stretches out ahead of you,
   helmet, backpack and all, walking when you walk — and around the
   shadow of the helmet the ground brightens into the opposition
   surge, because that point is exactly the antisolar point: the halo
   in every Apollo photograph taken with the sun behind the camera. */
export const body = (() => {
  const mat = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
  const g = new THREE.Group();
  // Everything above the hips, which bend: its frame is g's, moved to
  // the hip joint, so parts are placed in g's coordinates less HIP.
  const HIP = 0.9;
  const up = new THREE.Group();
  up.position.y = HIP;
  g.add(up);
  const part = (geo: THREE.BufferGeometry, x: number, y: number, z: number, parent: THREE.Object3D = g) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    parent.add(m);
    return m;
  };
  // The camera looks down -z, so +z is behind you.
  part(new THREE.SphereGeometry(0.17, 16, 12), 0, 1.62 - HIP, 0.02, up);     // helmet
  part(new THREE.BoxGeometry(0.52, 0.62, 0.3), 0, 1.18 - HIP, 0, up);         // torso
  part(new THREE.BoxGeometry(0.48, 0.68, 0.24), 0, 1.24 - HIP, 0.27, up);     // PLSS
  part(new THREE.BoxGeometry(0.34, 0.26, 0.2), 0, 1.66 - HIP, 0.3, up);       // OPS on top of it
  part(new THREE.BoxGeometry(0.3, 0.12, 0.14), 0, 1.02 - HIP, -0.2, up);      // chest controls
  const limb = (x: number, y: number, r: number, len: number, parent: THREE.Object3D) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    part(new THREE.CapsuleGeometry(r, len, 4, 8), 0, -len / 2 - r * 0.6, 0, pivot);
    parent.add(pivot);
    return pivot;
  };
  const legs = [limb(-0.13, 0.86, 0.1, 0.62, g), limb(0.13, 0.86, 0.1, 0.62, g)] as const;
  const arms = [limb(-0.34, 1.42 - HIP, 0.075, 0.5, up), limb(0.34, 1.42 - HIP, 0.075, 0.5, up)] as const;
  arms[0].rotation.z = -0.12; arms[1].rotation.z = 0.12;

  /* What you see of yourself. Look down and there is a body under you:
     the chest of the suit with its control unit standing off it, arms
     and gloves at the sides, legs, and the lunar overshoes with their
     blue silicone soles. Drawn, not cast — the proxies above still
     throw the shadow — and nothing above the shoulders, which the eye
     is inside. The camera is pinned to the helmet, so what you see of
     your legs is where your shadow says they are. */
  const suit = surfacePatch(new THREE.MeshStandardMaterial({ color: 0xe6e3dc, roughness: 0.92 }), 'object');
  const grey = surfacePatch(new THREE.MeshStandardMaterial({ color: 0x9a9ca0, roughness: 0.6, metalness: 0.2 }), 'object');
  const sole = surfacePatch(new THREE.MeshStandardMaterial({ color: 0x4f6487, roughness: 0.8 }), 'object');
  const seen = (geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = g) => {
    const o = new THREE.Mesh(geo, m);
    o.position.set(x, y, z);
    o.receiveShadow = true;
    parent.add(o);
    return o;
  };
  seen(new THREE.CapsuleGeometry(0.19, 0.2, 6, 16), suit, 0, 1.15 - HIP, -0.02, up).scale.set(1.3, 1, 0.78);   // chest
  seen(new THREE.BoxGeometry(0.3, 0.12, 0.14), grey, 0, 1.02 - HIP, -0.2, up);                                    // RCU
  seen(new THREE.CylinderGeometry(0.035, 0.035, 0.02, 12), sole, 0.07, 1.02 - HIP, -0.277, up).rotation.x = Math.PI / 2;  // its dials
  seen(new THREE.CylinderGeometry(0.035, 0.035, 0.02, 12), sole, -0.07, 1.02 - HIP, -0.277, up).rotation.x = Math.PI / 2;
  for (const leg of legs) {
    seen(new THREE.CapsuleGeometry(0.105, 0.6, 4, 12), suit, 0, -0.37, 0, leg);
    seen(new THREE.BoxGeometry(0.16, 0.13, 0.3), suit, 0, -0.79, -0.05, leg);       // overshoe
    seen(new THREE.BoxGeometry(0.165, 0.03, 0.31), sole, 0, -0.865, -0.05, leg);    // its sole
  }
  for (const arm of arms) {
    seen(new THREE.CapsuleGeometry(0.08, 0.48, 4, 12), suit, 0, -0.3, 0, arm);
    seen(new THREE.SphereGeometry(0.065, 12, 8), grey, 0, -0.63, -0.02, arm).scale.set(0.8, 1.3, 1);   // glove
  }
  // Where the eyes are, in the body's frame: in the front of the helmet.
  const EYE_AT = new THREE.Vector3(0, 1.64 - HIP, -0.07), _e = new THREE.Vector3();
  g.visible = false;
  scene.add(g);
  return {
    // Placed by the eye: (x, y, z) is where the camera is.
    // leanF tilts the whole body about the feet; bend, the upper body
    // about the hips.
    update(x: number, y: number, z: number, yaw: number, phase: number, amt: number, leanF = 0, leanS = 0, bend = 0) {
      g.visible = true;
      up.rotation.x = -bend;
      // Pitched forward about the feet: the backpack pulls the body's
      // centre of mass back, and Apollo crews stood and walked leaning
      // into it — 16° on average in video (Chiou-Tan et al. 2026) —
      // more while speeding up.
      g.rotation.set(-(0.2 + leanF), yaw, -leanS, 'YXZ');
      g.position.set(0, 0, 0);
      g.updateMatrixWorld(true);
      _e.copy(EYE_AT).applyMatrix4(up.matrixWorld);
      g.position.set(x - _e.x, y - _e.y, z - _e.z);
      const sw = Math.sin(phase) * amt;
      legs[0].rotation.x = sw * 0.5; legs[1].rotation.x = -sw * 0.5;
      arms[0].rotation.x = -sw * 0.35; arms[1].rotation.x = sw * 0.35;
    },
    hide() { g.visible = false; },
    group: g,
  };
})();

