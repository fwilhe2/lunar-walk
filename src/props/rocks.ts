import * as THREE from 'three';
import { cellCraters } from '../kernel/craters';
import { hash2, smoothT } from '../kernel/noise';
import { terrainHeight } from '../kernel/terrain';
import { CRATER_LAYERS, WORLD } from '../kernel/world';
import { scene } from '../render/renderer';
import { DEG, hapkeUniforms } from '../surface/hapke';
import { surfacePatch } from '../surface/patch';
import { dropAt } from '../terrain/anchor';
import { world } from '../worlds/index';
import { moonRille } from '../worlds/moon/terrain';
import { tiGravel } from '../worlds/titan/terrain';

/* ═════════════════════════════════════════════════════════════
   6. ROCKS — streamed with the ground, clustered on crater rims
   where ejecta actually lands, and concentrated around the young
   craters: a fresh crater is ringed with blocks, an old one has
   ground its own down to soil. Deterministic per chunk, so a
   boulder you walked past is still there when you come back.

   The shapes are fractured blocks rather than lumps. Each prototype
   is an ellipsoid roughened with 3D noise and then cut by a handful
   of random planes, which is how rock actually breaks: flat fracture
   faces meeting at edges, rounded a little by the smooth normals the
   way micrometeorite erosion rounds them. Three levels of detail,
   by size, and several shapes in each.

   A rock rests on a low side with a small tilt, and is sunk by its
   real lowest point below the lowest ground under its footprint, so
   no edge of it ever floats — which is also what keeps its shadow
   joined to it.
   ═════════════════════════════════════════════════════════════ */
export const rockSystem = (() => {
  // Lattice-hashed 3D value noise, for shaping.
  const n3 = (x, y, z) => {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const u = smoothT(x - xi), v = smoothT(y - yi), w = smoothT(z - zi);
    const h = (i, j, k) => hash2(Math.imul(i, 73) + Math.imul(k, 1931), Math.imul(j, 151) - Math.imul(k, 571));
    const l = (j, k) => h(xi, yi + j, zi + k) * (1 - u) + h(xi + 1, yi + j, zi + k) * u;
    return (l(0, 0) * (1 - v) + l(1, 0) * v) * (1 - w) + (l(0, 1) * (1 - v) + l(1, 1) * v) * w;
  };

  // round: a cobble, not a block — worn smooth by rolling along a
  // stream bed, the way Titan's water-ice gravel is (§1, hTitan).
  function makeRock(seed, detail, fresh, cuts = 0, round = false) {
    let s = seed; const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    for (let i = 0; i < 5; i++) rnd();
    const src = new THREE.IcosahedronGeometry(1, detail);
    const sp = src.attributes.position;
    // Weld the polyhedron's duplicated corners, so the displaced
    // surface stays closed and shades smoothly across faces.
    const ids = new Map(), verts = [], index = [];
    for (let i = 0; i < sp.count; i++) {
      const key = Math.round(sp.getX(i) * 1e4) + ',' + Math.round(sp.getY(i) * 1e4) + ',' + Math.round(sp.getZ(i) * 1e4);
      let id = ids.get(key);
      if (id === undefined) { id = verts.length / 3; ids.set(key, id); verts.push(sp.getX(i), sp.getY(i), sp.getZ(i)); }
      index.push(id);
    }
    src.dispose();

    const ax = 0.85 + rnd() * 0.4, ay = (round ? 0.62 : 0.7) + rnd() * 0.35, az = 0.85 + rnd() * 0.4;
    const off = rnd() * 100;
    const planes = [];
    const nCut = round ? 0 : 5 + cuts + Math.floor(rnd() * 6);
    for (let k = 0; k < nCut; k++) {
      const zc = rnd() * 2 - 1, th = rnd() * 6.2832, r = Math.sqrt(1 - zc * zc);
      planes.push([Math.cos(th) * r, zc, Math.sin(th) * r, 0.36 + rnd() * 0.4]);
    }
    planes.push([0, -1, 0, (round ? 0.6 : 0.4) + rnd() * 0.2]);     // a bed to lie on
    // Fresh fractures stay flat and sharp; weathered ones are
    // sandblasted back toward the lump they were cut from.
    const keep = round ? 0.4 : fresh ? 1 : 0.72;
    for (let i = 0; i < verts.length; i += 3) {
      let x = verts[i] * ax, y = verts[i + 1] * ay, z = verts[i + 2] * az;
      const n = n3(x * 2.1 + off, y * 2.1, z * 2.1) * 0.55 + n3(x * 5.3, y * 5.3 + off, z * 5.3) * 0.3
              + n3(x * 13, y * 13, z * 13 + off) * 0.15;
      const f = 1 + (n - 0.5) * (round ? 0.14 : 0.42);
      x *= f; y *= f; z *= f;
      for (const [px, py, pz, d] of planes) {
        const e = x * px + y * py + z * pz - d;
        if (e > 0) { x -= px * e * keep; y -= py * e * keep; z -= pz * e * keep; }
      }
      verts[i] = x; verts[i + 1] = y; verts[i + 2] = z;
    }
    // Normalise: unit horizontal radius, bottom at y = 0 before burial.
    let r2 = 0, minY = 1e9;
    for (let i = 0; i < verts.length; i += 3) {
      r2 = Math.max(r2, verts[i] * verts[i] + verts[i + 2] * verts[i + 2]);
      minY = Math.min(minY, verts[i + 1]);
    }
    const k = 1 / Math.sqrt(r2);
    for (let i = 0; i < verts.length; i += 3) {
      verts[i] *= k; verts[i + 1] = (verts[i + 1] - minY) * k; verts[i + 2] *= k;
    }
    // Creased normals: each corner averages only the neighbouring
    // faces within ~32° of its own, so fracture faces meet at a real
    // edge while the gentle curvature between them stays smooth.
    const nF = index.length / 3, fn = new Float32Array(nF * 3);
    const around = Array.from({ length: verts.length / 3 }, () => []);
    for (let f = 0; f < nF; f++) {
      const a = index[f * 3] * 3, b = index[f * 3 + 1] * 3, c = index[f * 3 + 2] * 3;
      const ux = verts[b] - verts[a], uy = verts[b + 1] - verts[a + 1], uz = verts[b + 2] - verts[a + 2];
      const vx = verts[c] - verts[a], vy = verts[c + 1] - verts[a + 1], vz = verts[c + 2] - verts[a + 2];
      // Unnormalised: the length is twice the area, which weights the sum.
      fn[f * 3] = uy * vz - uz * vy; fn[f * 3 + 1] = uz * vx - ux * vz; fn[f * 3 + 2] = ux * vy - uy * vx;
      for (let k = 0; k < 3; k++) around[index[f * 3 + k]].push(f);
    }
    const pos = new Float32Array(nF * 9), nrm = new Float32Array(nF * 9);
    const COS = Math.cos((round ? 80 : 32) * DEG);
    for (let f = 0; f < nF; f++) {
      const fx = fn[f * 3], fy = fn[f * 3 + 1], fz = fn[f * 3 + 2];
      const fl = Math.hypot(fx, fy, fz) || 1;
      for (let k = 0; k < 3; k++) {
        const vi = index[f * 3 + k], o = (f * 3 + k) * 3;
        pos[o] = verts[vi * 3]; pos[o + 1] = verts[vi * 3 + 1]; pos[o + 2] = verts[vi * 3 + 2];
        let sx = 0, sy = 0, sz = 0;
        for (const g of around[vi]) {
          const gx = fn[g * 3], gy = fn[g * 3 + 1], gz = fn[g * 3 + 2];
          if ((gx * fx + gy * fy + gz * fz) / ((Math.hypot(gx, gy, gz) || 1) * fl) < COS) continue;
          sx += gx; sy += gy; sz += gz;
        }
        const sl = Math.hypot(sx, sy, sz) || 1;
        nrm[o] = sx / sl; nrm[o + 1] = sy / sl; nrm[o + 2] = sz / sl;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    g.computeBoundingSphere();
    return { geo: g, pts: new Float32Array(verts) };
  }

  // Size classes, by horizontal radius in metres.
  const CLASSES = [
    { max: 0.09, detail: 1, protos: [11, 23, 37].map((sd) => makeRock(sd, 1, true)), shadow: true, receive: false },
    { max: 0.45, detail: 3, protos: [41, 53, 67, 71, 83].map((sd, i) => makeRock(sd, 3, i % 2 === 0)), shadow: true, receive: true },
    { max: 1e9, detail: 6, protos: [97, 101, 113, 127, 131, 139].map((sd, i) => makeRock(sd, 6, i % 3 !== 2, 5)), shadow: true, receive: true },
  ];
  // Cobbles, for a world with world.rockRound, made the first time one
  // is needed. Same classes, same draw structure, smooth shapes.
  let ROUND = null;
  const classesFor = () => {
    if (!world.rockRound) return CLASSES;
    if (!ROUND) ROUND = CLASSES.map((C, ci) => ({ ...C,
      protos: [7, 19, 29, 43].map((sd) => makeRock(sd + ci * 100, [2, 3, 5][ci], false, 0, true)) }));
    for (let ci = 0; ci < 3; ci++) ROUND[ci].shadow = CLASSES[ci].shadow;
    return ROUND;
  };

  // Freshly exposed rock is a little brighter than the mature soil
  // around it — it has had less time in the solar wind — and dust
  // settles on whatever faces up. On Mars the dust is the bright part.
  const rockHapke = hapkeUniforms();
  const ROCK_U = { rkSoil: { value: new THREE.Vector4(0.1, 0.1, 0.1, 0.5) } };
  const rockMat = surfacePatch(new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0 }), 'rock', rockHapke, ROCK_U);
  const prevCompile = rockMat.onBeforeCompile;
  rockMat.onBeforeCompile = (shader) => {
    prevCompile(shader);
    shader.vertexShader = shader.vertexShader
      .replace('varying vec3 vWPos;', 'varying vec3 vWPos;\nvarying vec3 vRk;')
      .replace('vWPos = ( modelMatrix * wq ).xyz;', `vWPos = ( modelMatrix * wq ).xyz;
          #ifdef USE_INSTANCING
            // Rock-local, at world scale, offset per rock: small numbers
            // for the noise, so it does not band far from the origin.
            vRk = wq.xyz - instanceMatrix[ 3 ].xyz + fract( instanceMatrix[ 3 ].xyz * 0.0137 ) * 97.0;
          #else
            vRk = transformed;
          #endif`);
    shader.fragmentShader = shader.fragmentShader
      .replace('varying vec3 vWPos;', `varying vec3 vWPos;
        varying vec3 vRk;
        uniform vec4 rkSoil;
        float rkH( vec3 p ) { p = fract( p * 0.3183099 + 0.1 ); p *= 17.0; return fract( p.x * p.y * p.z * ( p.x + p.y + p.z ) ); }
        float rkN( vec3 x ) {
          vec3 i = floor( x ), f = fract( x ); f = f * f * ( 3.0 - 2.0 * f );
          return mix( mix( mix( rkH( i ), rkH( i + vec3( 1, 0, 0 ) ), f.x ), mix( rkH( i + vec3( 0, 1, 0 ) ), rkH( i + vec3( 1, 1, 0 ) ), f.x ), f.y ),
                      mix( mix( rkH( i + vec3( 0, 0, 1 ) ), rkH( i + vec3( 1, 0, 1 ) ), f.x ), mix( rkH( i + vec3( 0, 1, 1 ) ), rkH( i + vec3( 1, 1, 1 ) ), f.x ), f.y ), f.z );
        }
        vec3 rkGrad( vec3 p ) {
          float c = rkN( p );
          return vec3( rkN( p + vec3( 0.1, 0, 0 ) ) - c, rkN( p + vec3( 0, 0.1, 0 ) ) - c, rkN( p + vec3( 0, 0, 0.1 ) ) - c ) * 10.0;
        }`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          // Pitted, vesicular surface detail, and dust on the up faces.
          vec3 wN = inverseTransformDirection( normal, viewMatrix );
          #ifndef RK_CHEAP
          float fade = 1.0 - smoothstep( 6.0, 40.0, length( vViewPosition ) );
          if ( fade > 0.0 ) {
            vec3 g = ( rkGrad( vRk * 7.0 ) * 0.6 + rkGrad( vRk * 23.0 ) * 0.3 + rkGrad( vRk * 61.0 ) * 0.15 ) * fade;
            g -= dot( g, wN ) * wN;
            vec3 bN = normalize( wN - g * 0.1 );
            normal = normalize( ( viewMatrix * vec4( bN, 0.0 ) ).xyz );
          }
          #endif
          float dusty = smoothstep( 0.45, 0.92, wN.y ) * rkSoil.a * ( 0.7 + 0.3 * rkN( vRk * 3.0 ) );
          diffuseColor.rgb = mix( diffuseColor.rgb, rkSoil.rgb, dusty );
        }`);
  };

  const SIZE = 256, EXT = 1, MAXR = 900;
  // Rocks this big or bigger are solid to the walker and the rover;
  // smaller ones are pressed into the soil or rolled over unnoticed.
  const SOLID_MIN = 0.15, SG = 16, SGC = SIZE / SG;
  // A chunk's solid rocks, binned on a 16 m grid by their reach.
  function solidGrid(list, x0, z0) {
    const cells = Array.from({ length: SG * SG }, () => []);
    for (const r of list) {
      const R = r.R + 0.5;   // room for the body around the point asked
      const i0 = Math.max(0, Math.floor((r.x - R - x0) / SGC)), i1 = Math.min(SG - 1, Math.floor((r.x + R - x0) / SGC));
      const j0 = Math.max(0, Math.floor((r.z - R - z0) / SGC)), j1 = Math.min(SG - 1, Math.floor((r.z + R - z0) / SGC));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) cells[j * SG + i].push(r);
    }
    return cells;
  }
  // Stones under this size are pressed into the soil by a boot or a
  // wheel (§8); anything bigger you would step over or drive round.
  const PRESS_MAX = 0.12;
  // Every live print and track, by its slot in the stamp ring: an
  // oriented rectangle (centre, heading, half extents). Kept here so a
  // chunk rebuilt after you walked away and came back presses its
  // stones under the prints still lying on it.
  const marks = new Map();
  let pebbles = 1;            // carpet density, lowered on weak GPUs
  let shapes = 99;            // prototypes per class: each is a draw call per chunk
  const live = new Map();   // "cx:cz" → Group of InstancedMeshes
  let lastCell = null;
  let version = 0;          // bumped whenever the set of live chunks changes

  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  const scl = new THREE.Vector3(), p = new THREE.Vector3(), zero = new THREE.Vector3();

  function buildChunk(cx, cz) {
    const x0 = cx * SIZE, z0 = cz * SIZE;
    let s = (Math.imul(cx, 73856093) ^ Math.imul(cz, 19349663) ^ 0x2545f49) & 0x7fffffff;
    const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

    const slots = [];   // { x, z, size }
    const LS = WORLD.lander;
    const consider = (x, z, size) => {
      if (x < x0 || x >= x0 + SIZE || z < z0 || z >= z0 + SIZE) return;
      // Nothing under the lander: it came down on a clear patch, and its
      // engine swept the pebbles out from under it.
      if (LS && (x - LS[0]) ** 2 + (z - LS[1]) ** 2 < 42) return;
      if (slots.length >= (world.rockMax || MAXR)) return;
      // Nothing under a sea: the liquid's surface is drawn over the
      // ground beneath it, and a stone would show through it unwet.
      if (world.sea !== undefined && terrainHeight(x, z) < world.sea + 0.1) return;
      slots.push({ x, z, size });
    };

    // Ejecta blankets: rings of debris outside nearby crater rims —
    // many and large around a fresh crater, few around an old one.
    const nMul = world.rockN;
    for (let li = 0; li < CRATER_LAYERS.length; li++) {
      const L = CRATER_LAYERS[li];
      if (!L.rocks) continue;
      const c0x = Math.floor((x0 - 64) / L.cell), c1x = Math.floor((x0 + SIZE + 64) / L.cell);
      const c0z = Math.floor((z0 - 64) / L.cell), c1z = Math.floor((z0 + SIZE + 64) / L.cell);
      for (let gz = c0z; gz <= c1z; gz++) {
        for (let gx = c0x; gx <= c1x; gx++) {
          for (const c of cellCraters(li, gx, gz)) {
            const fresh = c.age * c.age * c.age;
            const n = Math.min(64, Math.floor(c.r * (0.12 + 2.4 * fresh) * nMul));
            for (let i = 0; i < n; i++) {
              const a = rnd() * 6.2832, d = c.r * (0.8 + Math.pow(rnd(), 2) * 1.5);
              consider(c.x + Math.cos(a) * d, c.z + Math.sin(a) * d,
                       0.05 + Math.pow(rnd(), 2.6) * Math.min(3.2, c.r * (0.03 + 0.07 * fresh)));
            }
          }
        }
      }
    }
    // Talus. Where the rock comes from steep faces rather than from
    // craters — on Europa, the flanks of every ridge and the scarps
    // round every chaos raft — blocks lie where slopes shed them.
    for (let i = 0; i < (world.talus || 0); i++) {
      const x = x0 + rnd() * SIZE, z = z0 + rnd() * SIZE, e = 2, h0 = terrainHeight(x, z);
      const sl = Math.hypot(terrainHeight(x + e, z) - h0, terrainHeight(x, z + e) - h0) / e;
      if (rnd() < (sl - 0.13) * 4) consider(x, z, 0.08 + Math.pow(rnd(), 2.4) * 1.8);
    }
    // Rille walls. Lava cut Hadley Rille down through the mare's own
    // layers, and its walls are strewn with blocks shed off the ledges
    // near the rim — Apollo 15 photographed them from the edge, boulders
    // metres across all the way down to the floor. Candidates are tested
    // on the rille term alone, which is zero, and cheap, nearly everywhere.
    if (world.rilleTalus) {
      for (let i = 0; i < world.rilleTalus; i++) {
        const x = x0 + rnd() * SIZE, z = z0 + rnd() * SIZE, r0 = moonRille(x, z);
        if (r0 === 0) continue;
        const e = 3, sl = Math.hypot(moonRille(x + e, z) - r0, moonRille(x, z + e) - r0) / e;
        if (rnd() < (sl - 0.1) * 3) consider(x, z, 0.1 + Math.pow(rnd(), 2.4) * 3.2);
      }
    }
    // Big blocks, where a world has them lying about for other reasons
    // than craters: Enceladus's ice blocks, tens of metres across.
    for (let i = 0; i < (world.blocks || 0); i++)
      consider(x0 + rnd() * SIZE, z0 + rnd() * SIZE, 1.5 + Math.pow(rnd(), 2.2) * 11);
    // Cobbles, in patches where liquid has sorted them, on a world
    // that has them: a patch is tried anywhere and kept as often as
    // the ground under it says gravel lies there.
    if (world.cobbles) {
      const cb = world.cobbles;
      for (let i = 0; i < cb.patches; i++) {
        const px = x0 + rnd() * SIZE, pz = z0 + rnd() * SIZE;
        const keep = 0.15 + 0.85 * tiGravel(px, pz, terrainHeight(px, pz));
        if (rnd() > keep) continue;
        const n = Math.floor(cb.per * (0.4 + rnd()));
        for (let k = 0; k < n; k++) {
          const a = rnd() * 6.2832, d = cb.r * Math.sqrt(rnd());
          consider(px + Math.cos(a) * d, pz + Math.sin(a) * d, cb.size[0] + Math.pow(rnd(), 2.2) * (cb.size[1] - cb.size[0]));
        }
      }
    }
    // Background scatter, and a carpet of pebbles.
    for (let i = 0; i < 40 * nMul; i++)
      consider(x0 + rnd() * SIZE, z0 + rnd() * SIZE, 0.12 + Math.pow(rnd(), 3.4) * 2.0);
    for (let i = 0; i < 420 * nMul * pebbles; i++)
      consider(x0 + rnd() * SIZE, z0 + rnd() * SIZE, 0.03 + Math.pow(rnd(), 2) * 0.12);

    // Venusian rock does not come from impacts, it comes from lava
    // that cooled in sheets and then cracked, so it lies about in
    // plates rather than lumps — the flagstones in every Venera
    // panorama. rockFlat squashes them, and their bedding with them.
    const flat = world.rockFlat || 1;
    const CLS = classesFor();
    const buckets = CLS.map((C) => C.protos.map(() => []));
    const solids = [];
    for (const r of slots) {
      const ci = r.size < CLS[0].max ? 0 : r.size < CLS[1].max ? 1 : 2;
      const pi = Math.floor(rnd() * Math.min(CLS[ci].protos.length, shapes));
      const proto = CLS[ci].protos[pi];
      // Resting pose: any heading, a modest tilt — more for the big
      // ejecta blocks, which land where they land.
      const tilt = (ci === 2 ? 0.35 : 0.22) * flat;
      e.set((rnd() - 0.5) * tilt, rnd() * 6.2832, (rnd() - 0.5) * tilt);
      q.setFromEuler(e);
      scl.set(r.size, r.size * (0.6 + rnd() * 0.5) * flat, r.size);
      m.compose(zero, q, scl);
      // Lowest point of this rock, as posed.
      const pts = proto.pts, el = m.elements;
      let low = 1e9;
      for (let i = 0; i < pts.length; i += 3) {
        const y = el[1] * pts[i] + el[5] * pts[i + 1] + el[9] * pts[i + 2];
        if (y < low) low = y;
      }
      // Lowest ground under its footprint.
      const rr = r.size * 0.8;
      let g = terrainHeight(r.x, r.z);
      g = Math.min(g, terrainHeight(r.x + rr, r.z), terrainHeight(r.x - rr, r.z),
                      terrainHeight(r.x, r.z + rr), terrainHeight(r.x, r.z - rr));
      const height = scl.y;
      const bury = height * (0.12 + rnd() * 0.28);
      p.set(r.x, g - dropAt(r.x, r.z) - low - bury, r.z);
      m.setPosition(p);
      // Rock albedo, as a fraction: rockAlb is [base, spread].
      const a = world.rockAlb[0] + Math.pow(rnd(), 1.6) * world.rockAlb[1];
      buckets[ci][pi].push(m.clone(), a, r);
      // Anything you would notice underfoot is solid: its crown, in
      // physics' frame (raw heights, no curvature drop), and how far
      // it reaches out at the ground.
      if (r.size >= SOLID_MIN) {
        let high = -1e9, reach = 0;
        for (let i = 0; i < pts.length; i += 3) {
          const x = pts[i], y = pts[i + 1], z = pts[i + 2];
          const py = el[1] * x + el[5] * y + el[9] * z;
          if (py > high) high = py;
          const px = el[0] * x + el[4] * y + el[8] * z, pz = el[2] * x + el[6] * y + el[10] * z;
          reach = Math.max(reach, px * px + pz * pz);
        }
        solids.push({ x: r.x, z: r.z, R: Math.sqrt(reach), top: g - low - bury + high, g });
      }
    }

    const group = new THREE.Group();
    const tint = world.rockTint;
    // Stones small enough for a boot or a wheel to press into the
    // soil, so a print laid over them can push them down (press()).
    const small = group.userData.small = [];
    group.userData.solids = solidGrid(solids, x0, z0);
    CLS.forEach((C, ci) => {
      C.protos.forEach((proto, pi) => {
        const list = buckets[ci][pi];
        const n = list.length / 3;
        if (!n) return;
        const mesh = new THREE.InstancedMesh(proto.geo, rockMat, n);
        mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
        for (let i = 0; i < n; i++) {
          mesh.setMatrixAt(i, list[i * 3]);
          const a = list[i * 3 + 1], r = list[i * 3 + 2];
          mesh.instanceColor.setXYZ(i, a * tint[0], a * tint[1], a * tint[2]);
          if (r.size < PRESS_MAX) small.push({ mesh, i, pts: proto.pts, x: r.x, z: r.z, pressed: false });
        }
        mesh.castShadow = C.shadow;
        mesh.receiveShadow = C.receive;
        // Stones by the shore show in the sea's mirror (§10), on the one
        // world with a sea; elsewhere the layer would cost nothing anyway.
        if (world.sea !== undefined) mesh.layers.enable(1);
        mesh.computeBoundingSphere();
        group.add(mesh);
      });
    });
    for (const mk of marks.values()) pressGroup(group, mk, x0, z0);
    return group;
  }

  /* Pressing a stone: flatten it to a third of its height and set its
     crown 3 mm above the print floor, measured on the stone's own
     posed geometry and on the drawn mesh (mk.ground, from §8), so it
     shows as a flush cap that casts next to no shadow — the way
     pebbles show in the floor of every Apollo boot print, pressed in
     rather than pushed aside. */
  const pm = new THREE.Matrix4(), squash = new THREE.Matrix4().makeScale(1, 0.35, 1);
  function pressGroup(group, mk, x0, z0) {
    if (mk.x + mk.r < x0 || mk.x - mk.r > x0 + SIZE || mk.z + mk.r < z0 || mk.z - mk.r > z0 + SIZE) return;
    for (const st of group.userData.small) {
      if (st.pressed) continue;
      const dx = st.x - mk.x, dz = st.z - mk.z;
      if (Math.abs(dx * mk.c - dz * mk.s) > mk.hw || Math.abs(dx * mk.s + dz * mk.c) > mk.hh) continue;
      st.mesh.getMatrixAt(st.i, pm);
      pm.multiply(squash);
      const el = pm.elements, pts = st.pts;
      let top = -1e9;
      for (let i = 0; i < pts.length; i += 3) {
        const y = el[1] * pts[i] + el[5] * pts[i + 1] + el[9] * pts[i + 2];
        if (y > top) top = y;
      }
      el[13] = mk.ground(st.x, st.z) + 0.003 - top;
      st.mesh.setMatrixAt(st.i, pm);
      st.mesh.instanceMatrix.needsUpdate = true;
      st.pressed = true;
    }
  }

  function drop(group) {
    version++;
    scene.remove(group);
    for (const mesh of group.children) mesh.dispose();
  }

  return {
    hapke: rockHapke,
    soil: ROCK_U.rkSoil,
    get version() { return version; },
    material: rockMat,
    // Pebble density, and whether pebbles cast shadows: thousands of
    // tiny casters in two shadow maps are a real cost on an iGPU.
    setDetail(density, pebbleShadows, protoLimit) {
      if (density === pebbles && CLASSES[0].shadow === pebbleShadows && protoLimit === shapes) return;
      pebbles = density;
      shapes = protoLimit;
      CLASSES[0].shadow = pebbleShadows;
      this.reset();
    },
    reset() {
      for (const g of live.values()) drop(g);
      live.clear();
      lastCell = null;
    },
    // Lay a print or track over the ground: presses the stones under
    // it now, and in any chunk built later. `key` is its ring slot, so
    // a print that is overwritten stops pressing chunks built after.
    press(key, x, z, yaw, hw, hh, ground) {
      const mk = { x, z, c: Math.cos(yaw), s: Math.sin(yaw), hw, hh, r: Math.hypot(hw, hh), ground };
      marks.set(key, mk);
      for (const [cell, g] of live) {
        const [cx, cz] = cell.split(':').map(Number);
        pressGroup(g, mk, cx * SIZE, cz * SIZE);
      }
    },
    clearMarks() { marks.clear(); },
    // The solid rocks whose reach covers (x, z). A rock is a dome over
    // its footprint: its height at distance d from its centre is
    // top − (top − g)·(1 − √(1 − d²/R²)), which is all a boot or a
    // tyre needs. Rocks overhanging a chunk edge are binned in the
    // chunk they were placed in, so the neighbours are asked too.
    solidsAt(x, z, out, pad = 0) {
      out.length = 0;
      const cx = Math.floor(x / SIZE), cz = Math.floor(z / SIZE);
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        const g = live.get((cx + dx) + ':' + (cz + dz));
        if (!g || !g.userData.solids) continue;
        // Off this chunk's edge, its edge cells still hold what overhangs.
        const i = Math.floor((x - (cx + dx) * SIZE) / SGC), j = Math.floor((z - (cz + dz) * SIZE) / SGC);
        if (i < -1 || j < -1 || i > SG || j > SG) continue;
        const cell = g.userData.solids[Math.min(SG - 1, Math.max(0, j)) * SG + Math.min(SG - 1, Math.max(0, i))];
        for (const r of cell) {
          const ex = x - r.x, ez = z - r.z, R = r.R + pad;
          if (ex * ex + ez * ez < R * R) out.push(r);
        }
      }
      return out;
    },
    update(px, pz) {
      const ccx = Math.floor(px / SIZE), ccz = Math.floor(pz / SIZE);
      const cell = ccx + ':' + ccz;
      if (cell === lastCell) return;
      lastCell = cell;
      const want = new Set();
      for (let dz = -EXT; dz <= EXT; dz++)
        for (let dx = -EXT; dx <= EXT; dx++) want.add((ccx + dx) + ':' + (ccz + dz));
      // The curvature drop is baked into each instance matrix, so on
      // a body small enough for that drop to move when the anchor
      // does — tens of metres per cell on the moonlets, a tenth of
      // one on the Moon — every chunk has to be rebuilt, not just
      // the newly entered ones.
      const restale = WORLD.R < 100000;
      for (const [key, g] of live) {
        if (want.has(key) && !restale) continue;
        drop(g);
        live.delete(key);
      }
      for (const key of want) {
        if (live.has(key)) continue;
        const [cx, cz] = key.split(':').map(Number);
        const g = buildChunk(cx, cz);
        version++;
        live.set(key, g);
        scene.add(g);
      }
    },
  };
})();
