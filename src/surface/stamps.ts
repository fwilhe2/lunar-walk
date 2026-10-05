import * as THREE from 'three';
import { terrainHeight } from '../kernel/terrain';
import { rockSystem } from '../props/rocks';
import { scene } from '../render/renderer';
import { groundHapke } from './ground';
import { hapkeUniforms } from './hapke';
import { surfacePatch } from './patch';
import { dropAt, terrainNormal } from '../terrain/anchor';
import { chunkStreamer } from '../terrain/streamer';

/* ═════════════════════════════════════════════════════════════
   FOOTPRINTS & WHEEL TRACKS
   Regolith takes a crisp print and holds it. On the airless
   bodies nothing will ever erase it. On Mars the wind eventually
   will — Spirit's tracks faded over years, not minutes — which is
   far longer than you are going to stand here, so they persist
   the same way and are only tinted differently: disturbing bright
   dust exposes the darker soil underneath, which is why every
   rover on Mars drives in a dark stripe of its own making.
   ═════════════════════════════════════════════════════════════ */
export const stampSystems: StampSystem[] = [];
// Pressed soil loses the open, fairy-castle structure that makes the
// opposition surge: a print is barely there across the sun and turns
// visibly darker looking down-sun, which is how the Apollo prints
// show up in photographs. Set per world in applyWorld().
export const printHapke = hapkeUniforms();
// What a print is measured against: the ground's own Hapke set, shared
// by reference, and the albedo pressing leaves (applyWorld()).
export const PRINT_U = {
  gpkA: groundHapke.hpkA, gpkB: groundHapke.hpkB, gpkN: groundHapke.hpkN,
  uStampK: { value: new THREE.Color(1, 1, 1) },
};

/* A print is a patch of pressed soil: drawSole marks where the soil
   was pressed, drawTread what the sole's cleats left standing inside
   it. Both are drawn on a 64-unit canvas. The relief becomes a normal
   map in real millimetres, so a low sun rakes across the edges of
   every print and picks out its tread.

   It is not painted on. The print is drawn multiplied into the ground
   already on screen, by the ratio of how pressed soil reflects to how
   the undisturbed soil around it does (surfacePatch 'print'), so it
   keeps the ground's own grain, colour and tint and changes only what
   pressing changes: the opposition surge and the relief — plus, per
   world, the albedo, where stampColor against soil says a boot turns
   up darker material (Mars) or merely compacts it (the Moon).

   And it lies on the triangles actually drawn. terrainHeight() is the
   true surface, but the chunk under your feet is a 1 m mesh of it, and
   between vertices the two differ by centimetres — enough to float a
   decal or bury half of it. So each print is a small grid, and every
   grid point is put on the mesh triangle beneath it, reconstructed
   from the same lattice, the same diagonal and the same curvature
   drop the chunk was built with (terrain/streamer.ts). */
const PRINT_GX = 5, PRINT_GY = 7;
export const TRACK_L = 0.62;   // length of one wheel-track stamp

// Height of the drawn mesh at (x, z): the chunk lattice of spacing s,
// split along the b–c diagonal as gridIndex() splits it. vtx(i, j, s)
// gives the height of lattice corner (i, j) — the caller decides how
// it is cached and whether the curvature drop goes in. The one copy
// of the triangulation outside the worker: prints and the rover's
// wheels both stand on it (here, and vehicles/rover.ts).
export function meshHeight(x: number, z: number, s: number, vtx: (i: number, j: number, s: number) => number) {
  const gx = x / s, gz = z / s, i = Math.floor(gx), j = Math.floor(gz);
  const fx = gx - i, fz = gz - j;
  const hb = vtx(i + 1, j, s), hc = vtx(i, j + 1, s);
  if (fx + fz <= 1) { const ha = vtx(i, j, s); return ha + fx * (hb - ha) + fz * (hc - ha); }
  const hd = vtx(i + 1, j + 1, s);
  return hd + (1 - fx) * (hc - hd) + (1 - fz) * (hb - hd);
}
type Draw = (x: CanvasRenderingContext2D) => void;
/** One kind of print: stamp(x, z, yaw) lays the next one, oldest replaced first. */
export interface StampSystem {
  (px: number, pz: number, yaw: number): void;
  material: THREE.MeshStandardMaterial;
  reset: () => void;
}
function makeStampSystem(maxCount: number, drawSole: Draw, drawTread: Draw, w: number, h: number, sole: [number, number]) {
  const S = 128;
  const draw = (blur: number, fn: Draw) => {
    const c = document.createElement('canvas'); c.width = c.height = S;
    const x = c.getContext('2d')!;   // a new canvas always has one
    x.fillStyle = '#000'; x.fillRect(0, 0, S, S);
    x.scale(S / 64, S / 64);
    x.filter = 'blur(' + blur + 'px)';
    fn(x);
    return x.getImageData(0, 0, S, S).data;
  };
  const A = draw(0.9, (x) => { x.fillStyle = '#fff'; drawSole(x); });
  const Hd = draw(0.6, (x) => { x.fillStyle = '#fff'; drawSole(x); x.fillStyle = '#6a6a6a'; drawTread(x); });
  const alpha = new Uint8Array(S * S * 4), nrm = new Uint8Array(S * S * 4);
  const mmX = w * 1000 / S, mmY = h * 1000 / S, DEPTH = 16;
  // A, Hd, alpha and nrm are S × S × 4; every index is clamped or in the loop's range.
  const hAt = (x: number, y: number) => -Hd[(Math.min(S - 1, Math.max(0, y)) * S + Math.min(S - 1, Math.max(0, x))) * 4]! / 255 * DEPTH;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = (y * S + x) * 4;
      alpha[i] = alpha[i + 1] = alpha[i + 2] = A[i]!; alpha[i + 3] = 255;
      const nx = (hAt(x - 1, y) - hAt(x + 1, y)) / (2 * mmX);
      const ny = (hAt(x, y - 1) - hAt(x, y + 1)) / (2 * mmY);
      const l = Math.hypot(nx, ny, 1);
      nrm[i] = (nx / l * 0.5 + 0.5) * 255; nrm[i + 1] = (ny / l * 0.5 + 0.5) * 255;
      nrm[i + 2] = (1 / l * 0.5 + 0.5) * 255; nrm[i + 3] = 255;
    }
  }
  const tex = (d: Uint8Array<ArrayBuffer>) => {
    const t = new THREE.DataTexture(d, S, S, THREE.RGBAFormat);
    t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true; t.needsUpdate = true;
    return t;
  };
  // Multiplied into the target: dst × src, and the target's alpha left
  // alone. White is "no change", which is what the sole's soft edge
  // fades to.
  const material = surfacePatch(new THREE.MeshStandardMaterial({
    color: 0xffffff, alphaMap: tex(alpha), normalMap: tex(nrm), transparent: true,
    roughness: 1, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
    blendSrc: THREE.ZeroFactor, blendDst: THREE.SrcColorFactor,
    blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
  }), 'print', printHapke, PRINT_U);

  // One grid of PRINT_GX × PRINT_GY points per slot, in world space.
  const NV = PRINT_GX * PRINT_GY;
  const pos = new Float32Array(maxCount * NV * 3), nor = new Float32Array(maxCount * NV * 3);
  const uv = new Float32Array(maxCount * NV * 2);
  const idx = new Uint32Array(maxCount * (PRINT_GX - 1) * (PRINT_GY - 1) * 6);
  for (let k = 0, o = 0; k < maxCount; k++) {
    for (let j = 0; j < PRINT_GY; j++) {
      for (let i = 0; i < PRINT_GX; i++) {
        const v = k * NV + j * PRINT_GX + i;
        uv[v * 2] = i / (PRINT_GX - 1); uv[v * 2 + 1] = j / (PRINT_GY - 1);
        if (i < PRINT_GX - 1 && j < PRINT_GY - 1) {
          const a = v, b = v + 1, c = v + PRINT_GX, d = c + 1;
          idx[o++] = a; idx[o++] = b; idx[o++] = c;
          idx[o++] = b; idx[o++] = d; idx[o++] = c;
        }
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage);
  const norAttr = new THREE.BufferAttribute(nor, 3).setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', posAttr);
  geo.setAttribute('normal', norAttr);
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  const mesh = new THREE.Mesh(geo, material);
  mesh.frustumCulled = false;
  mesh.receiveShadow = true;
  scene.add(mesh);

  const sysId = stampSystems.length;
  let cursor = 0;
  // Lattice corners for meshHeight(), with the drop applied per vertex
  // as the worker applies it; cleared per print.
  const vh = new Map<string, number>();
  const vtx = (i: number, j: number, s: number) => {
    const k = i + ',' + j + ',' + s;
    let y = vh.get(k);
    if (y === undefined) {
      const x = i * s, z = j * s;
      vh.set(k, y = terrainHeight(x, z) - dropAt(x, z));
    }
    return y;
  };

  const stamp = (px: number, pz: number, yaw: number) => {
    const s = chunkStreamer.stepAt(px, pz);
    const n = terrainNormal(px, pz, 0.4);
    const c = Math.cos(yaw), sn = Math.sin(yaw);
    vh.clear();
    for (let j = 0; j < PRINT_GY; j++) {
      // The texture's v runs along the print; +v is forward, which is
      // -z before the heading is applied.
      const ly = (j / (PRINT_GY - 1) - 0.5) * h;
      for (let i = 0; i < PRINT_GX; i++) {
        const lx = (i / (PRINT_GX - 1) - 0.5) * w;
        const x = px + lx * c - ly * sn, z = pz - lx * sn - ly * c;
        const v = (cursor * NV + j * PRINT_GX + i) * 3;
        pos[v] = x; pos[v + 1] = meshHeight(x, z, s, vtx) + 0.002; pos[v + 2] = z;
        nor[v] = n.x; nor[v + 1] = n.y; nor[v + 2] = n.z;
      }
    }
    posAttr.needsUpdate = true;
    norAttr.needsUpdate = true;
    // The stones under the sole are pressed to the same drawn surface.
    // Kept by the rock system for chunks it builds later, so the
    // lookup must not depend on this print's vertex cache.
    rockSystem.press(sysId + ':' + cursor, px, pz, yaw, w * sole[0] / 2, h * sole[1] / 2,
                     (x: number, z: number) => { vh.clear(); return meshHeight(x, z, s, vtx); });
    cursor = (cursor + 1) % maxCount;
  };
  stamp.material = material;
  stamp.reset = () => {
    pos.fill(0);
    posAttr.needsUpdate = true;
    cursor = 0;
    rockSystem.clearMarks();
  };
  stampSystems.push(stamp);
  return stamp;
}

export const prints = (() => {
  const stamp = makeStampSystem(300,
    (x) => { x.beginPath(); x.roundRect(14, 8, 36, 48, 12); x.fill(); },          // sole
    (x) => { for (let i = 0; i < 7; i++) x.fillRect(14, 11 + i * 6.4, 36, 2.6); }, // tread ribs
    0.34, 0.5, [36 / 64, 48 / 64]);
  let side = 1;
  return {
    place(x0: number, z0: number, yaw: number) {
      side = -side;
      const ox = Math.cos(yaw) * 0.17 * side, oz = -Math.sin(yaw) * 0.17 * side;
      stamp(x0 + ox, z0 + oz, yaw);
    },
  };
})();

/* Chevron wheel tracks, stamped in pairs behind the rover's front
   wheels, end to end: the band runs the full length of the stamp, so
   one stamp takes over where the last left off (vehicles/rover.ts lays them). */
export const tracks = (() => {
  const stamp = makeStampSystem(500,
    (x) => { x.fillRect(18, 0, 28, 64); },
    (x) => {
      for (let i = 0; i < 9; i++) {   // chevron tread
        x.beginPath();
        x.moveTo(19, 4 + i * 7); x.lineTo(32, 8 + i * 7); x.lineTo(45, 4 + i * 7);
        x.lineTo(45, 6.4 + i * 7); x.lineTo(32, 10.4 + i * 7); x.lineTo(19, 6.4 + i * 7);
        x.closePath(); x.fill();
      }
    }, 0.26, TRACK_L, [28 / 64, 1]);
  return {
    place(x0: number, z0: number, yaw: number, half: number) {   // half = track gauge / 2
      const ox = Math.cos(yaw) * half, oz = -Math.sin(yaw) * half;
      stamp(x0 + ox, z0 + oz, yaw);
      stamp(x0 - ox, z0 - oz, yaw);
    },
  };
})();
