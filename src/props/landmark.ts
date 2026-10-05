import * as THREE from 'three';
import { terrainHeight } from '../kernel/terrain';
import { scene } from '../render/renderer';
import { surfacePatch } from '../surface/patch';
import { dropAt } from '../terrain/anchor';
import type { LandmarkKind } from '../worlds/view-types';

/* A landmark at the landing site, so you can find your way back.

   On the Moon and Mars it is a flag, wire-stiffened along the top
   as the Apollo ones were — six millibars is no more use for
   holding cloth out than vacuum is.

   Venus is the one place in the set that would hold a flag out by
   itself: the surface wind is only half a metre per second, but at
   65 kg/m³ that pushes as hard as a four-metre breeze at home. It
   would not be cloth, though. Nothing woven lasts an afternoon at
   464 °C, so this one is rolled titanium sheet, which is why it
   reads as metal rather than fabric.

   On Phobos and Deimos it is a mast bolted to the ground, because
   at 0.006 g nothing stays put by weight: an unanchored mass on
   Phobos needs only 11 m/s to leave the moon entirely. */
export const landmark = (() => {
  const group = new THREE.Group();
  scene.add(group);

  function clear() {
    for (const m of group.children) {
      if (!(m instanceof THREE.Mesh)) continue;   // landmark() adds only meshes
      m.geometry.dispose();
      m.material.dispose();
    }
    group.clear();
  }

  return (kind: LandmarkKind, color: THREE.ColorRepresentation) => {
    clear();
    const fx = 8, fz = -11, base = terrainHeight(fx, fz) - dropAt(fx, fz);

    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.032, 0.032, 2.6, 8),
      surfacePatch(new THREE.MeshStandardMaterial({ color: 0xb9bcc2, roughness: 0.52, metalness: 0.3 }), 'object')
    );
    pole.position.set(fx, base + 1.3, fz);
    pole.castShadow = true;
    group.add(pole);

    if (kind === 'flag') {
      const cloth = new THREE.Mesh(
        new THREE.PlaneGeometry(0.95, 0.6, 14, 8),
        surfacePatch(new THREE.MeshStandardMaterial({ color, roughness: 0.85, side: THREE.DoubleSide }), 'object')
      );
      const cp = cloth.geometry.attributes.position!;   // a plane always has one
      for (let i = 0; i < cp.count; i++) cp.setZ(i, Math.sin(cp.getX(i) * 5.5) * 0.045);
      cloth.geometry.computeVertexNormals();
      // Hung to catch the sun rather than face away from it, and offset
      // along its own span so it still meets the top of the pole.
      const theta = -1.25;
      cloth.rotation.y = theta;
      cloth.position.set(fx + Math.cos(theta) * 0.475, base + 2.25, fz - Math.sin(theta) * 0.475);
      cloth.castShadow = true;
      group.add(cloth);
    } else {
      // Three guy anchors driven into the regolith, and a corner-cube
      // retroreflector on top — the only landmark worth the mass.
      const anchorMat = surfacePatch(new THREE.MeshStandardMaterial({ color: 0x8d9096, roughness: 0.6, metalness: 0.4 }), 'object');
      for (let i = 0; i < 3; i++) {
        const a = i * 2.0944;
        const guy = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.9, 5), anchorMat);
        guy.position.set(fx + Math.cos(a) * 0.42, base + 0.72, fz + Math.sin(a) * 0.42);
        guy.rotation.set(Math.sin(a) * 0.48, 0, -Math.cos(a) * 0.48);
        guy.castShadow = true;
        group.add(guy);
      }
      const cube = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.22),
        surfacePatch(new THREE.MeshStandardMaterial({ color, roughness: 0.15, metalness: 0.9 }), 'object')
      );
      cube.position.set(fx, base + 2.75, fz);
      cube.castShadow = true;
      group.add(cube);
    }
  };
})();
