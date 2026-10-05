import * as THREE from 'three';
import { terrainHeight } from '../kernel/terrain';
import { WORLD } from '../kernel/world';
import { scene } from '../render/renderer';
import { surfacePatch } from '../surface/patch';
import { dropAt } from '../terrain/anchor';
import { world } from '../worlds/index';

/* ═════════════════════════════════════════════════════════════
   6c. THE LANDER — the lunar module you came down in, where the
   world's row says it stands (WORLD.lander): built from primitives to
   the real thing's dimensions, as the rover is.

   The descent stage is an octagon 4.2 m across in crinkled gold
   Kapton, black on its upper deck, with the engine bell under it;
   four legs on 0.94 m footpads spread 9.4 m corner to corner, three
   with their contact probes bent over on the ground; the porch, and
   a ladder that stops a long step short of the forward pad. On it
   the ascent stage, still there because you have not left yet: the
   crew cabin with its two triangular windows and the hatch below
   them, the aft equipment bay, the docking tunnel, four RCS quads
   and the dishes. Seven metres in all.

   Each pad stands on the ground where it is. The stage is levelled
   on the plane through the four, and the legs' crushable struts take
   up the rest, as the real ones did. The group follows the ground's
   curvature drop around the streaming anchor, so it stays on the
   drawn mesh from any distance, and it keeps walkers and the rover
   out of its body and off its pads.
   ═════════════════════════════════════════════════════════════ */
export const lander = (() => {
  const group = new THREE.Group();
  scene.add(group);
  let site = null, baseH = 0, yaw = 0, K = null;

  // Gold foil is never flat: a normal map of creases, generated.
  const crinkle = (() => {
    const S = 256, hgt = new Float32Array(S * S);
    let sd = 1969;
    const rnd = () => (sd = (sd * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    for (let k = 0; k < 900; k++) {
      // A crease: a short ridge or trough, at any angle.
      const cx = rnd() * S, cy = rnd() * S, a = rnd() * Math.PI, len = 6 + rnd() * 26, w = 1 + rnd() * 3, amp = (rnd() - 0.5) * 2;
      const ca = Math.cos(a), sa = Math.sin(a);
      for (let y = -len; y <= len; y++) for (let x = -w * 2; x <= w * 2; x++) {
        const px = Math.round(cx + ca * y - sa * x), py = Math.round(cy + sa * y + ca * x);
        const i = ((py % S + S) % S) * S + ((px % S + S) % S);
        hgt[i] += amp * Math.max(0, 1 - Math.abs(x) / (w * 2)) * (1 - Math.abs(y) / len);
      }
    }
    const data = new Uint8Array(S * S * 4);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const i = y * S + x;
      const dx = hgt[y * S + ((x + 1) % S)] - hgt[y * S + ((x + S - 1) % S)];
      const dy = hgt[((y + 1) % S) * S + x] - hgt[((y + S - 1) % S) * S + x];
      const nx = -dx * 0.9, ny = -dy * 0.9, l = 1 / Math.hypot(nx, ny, 1);
      data[i * 4] = (nx * l * 0.5 + 0.5) * 255; data[i * 4 + 1] = (ny * l * 0.5 + 0.5) * 255;
      data[i * 4 + 2] = (l * 0.5 + 0.5) * 255; data[i * 4 + 3] = 255;
    }
    const t = new THREE.DataTexture(data, S, S);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.needsUpdate = true;
    return t;
  })();

  const obj = (o) => surfacePatch(new THREE.MeshStandardMaterial(o), 'object');
  const M = {
    gold: obj({ color: 0xc79a3c, metalness: 0.9, roughness: 0.32, normalMap: crinkle, normalScale: new THREE.Vector2(0.6, 0.6) }),
    black: obj({ color: 0x1c1d20, metalness: 0.1, roughness: 0.7 }),
    silver: obj({ color: 0xaab0b6, metalness: 0.65, roughness: 0.42 }),
    white: obj({ color: 0xdcdcd6, metalness: 0.05, roughness: 0.65 }),
    foil: obj({ color: 0xc8ccd0, metalness: 0.85, roughness: 0.3, normalMap: crinkle, normalScale: new THREE.Vector2(0.5, 0.5) }),
    orange: obj({ color: 0xb8622a, metalness: 0.1, roughness: 0.6 }),
    grey: obj({ color: 0x5a5f66, metalness: 0.45, roughness: 0.5 }),
    bell: obj({ color: 0x3b3a38, metalness: 0.6, roughness: 0.45, side: THREE.DoubleSide }),
    glass: obj({ color: 0x0c0f14, metalness: 0.2, roughness: 0.08 }),
  };

  // Cylinder from a to b (local coordinates), radius r.
  const _up = new THREE.Vector3(0, 1, 0), _d = new THREE.Vector3();
  function rod(parent, mat, a, b, r, seg = 8) {
    _d.subVectors(b, a);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, _d.length(), seg), mat);
    m.position.addVectors(a, b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(_up, _d.normalize());
    parent.add(m);
    return m;
  }
  function box(parent, mat, w, h, d, x, y, z, ry = 0) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); m.rotation.y = ry;
    parent.add(m);
    return m;
  }
  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  // pads[k]: how far pad k sits above the stage's plane (the struts
  // absorb it). Local frame: +x forward, the ladder leg.
  function buildLM(pads) {
    const FOOT_R = 4.72;
    const g = new THREE.Group();
    const Y0 = 1.42, Y1 = 3.07;                      // descent stage, bottom and top
    // Descent stage: the octagon, its black deck, the engine bell.
    const oct = new THREE.Mesh(new THREE.CylinderGeometry(2.11, 2.11, Y1 - Y0, 8, 1), M.gold);
    oct.rotation.y = Math.PI / 8; oct.position.y = (Y0 + Y1) / 2; g.add(oct);
    const deck = new THREE.Mesh(new THREE.CylinderGeometry(2.13, 2.13, 0.08, 8, 1), M.black);
    deck.rotation.y = Math.PI / 8; deck.position.y = Y1 - 0.02; g.add(deck);
    const under = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.0, 0.06, 8, 1), M.black);
    under.rotation.y = Math.PI / 8; under.position.y = Y0; g.add(under);
    const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.78, 1.15, 24, 1, true), M.bell);
    bell.position.y = Y0 - 0.55; g.add(bell);
    // Black panels on alternate faces of the stage.
    for (let k = 0; k < 4; k++) {
      const a = k * Math.PI / 2 + Math.PI / 4;
      box(g, M.black, 0.06, 1.1, 1.3, Math.cos(a) * 1.96, (Y0 + Y1) / 2, -Math.sin(a) * 1.96, a);
    }
    // Legs.
    for (let k = 0; k < 4; k++) {
      const a = k * Math.PI / 2, ca = Math.cos(a), sa = -Math.sin(a);
      const L = (r, y) => V(ca * r, y, sa * r);
      const Lt = (r, y, t) => V(ca * r - sa * t, y, sa * r + ca * t);   // t: across the leg
      const py = pads[k];
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.47, 0.38, 0.16, 18), M.silver);
      pad.position.copy(L(FOOT_R, py + 0.05)); g.add(pad);
      // The primary strut, gold-wrapped, and its two secondaries.
      rod(g, M.gold, L(2.08, 2.55), L(FOOT_R, py + 0.2), 0.085);
      for (const t of [-1, 1]) rod(g, M.silver, Lt(FOOT_R - 0.45, py + 0.65, 0), Lt(1.75, Y0 + 0.05, t * 1.05), 0.045);
      // The deployment truss up to the deck.
      for (const t of [-1, 1]) rod(g, M.silver, L(3.1, 1.75 + py * 0.5), Lt(2.0, Y1 - 0.15, t * 0.8), 0.03);
      if (k !== 0) {
        // A contact probe, bent over on landing and lying out behind the pad.
        rod(g, M.silver, L(FOOT_R + 0.3, py + 0.02), Lt(FOOT_R + 1.9, py + 0.02, 0.35), 0.018, 5);
      }
    }
    // Porch and ladder on the forward leg.
    box(g, M.silver, 0.9, 0.05, 1.05, 2.55, Y1 - 0.1, 0);
    for (const t of [-0.48, 0.48]) rod(g, M.silver, V(2.2, Y1 + 0.85, t), V(2.95, Y1 + 0.85, t), 0.015, 5);
    for (const t of [-0.48, 0.48]) rod(g, M.silver, V(2.95, Y1 - 0.1, t), V(2.95, Y1 + 0.85, t), 0.015, 5);
    const top = V(2.95, Y1 - 0.12, 0), bot = V(3.95, 1.0 + pads[0] * 0.8, 0);
    for (const t of [-0.24, 0.24]) rod(g, M.silver, V(top.x, top.y, t), V(bot.x, bot.y, t), 0.02, 6);
    for (let i = 1; i < 9; i++) {
      const f = i / 9;
      rod(g, M.silver, V(top.x + (bot.x - top.x) * f, top.y + (bot.y - top.y) * f, -0.24), V(top.x + (bot.x - top.x) * f, top.y + (bot.y - top.y) * f, 0.24), 0.012, 5);
    }
    // Ascent stage.
    const A0 = Y1 + 0.05;
    box(g, M.grey, 1.9, 1.55, 2.5, -0.15, A0 + 0.78, 0);                          // midsection
    const cab = new THREE.Mesh(new THREE.CylinderGeometry(1.17, 1.17, 1.35, 20), M.silver);
    cab.rotation.z = Math.PI / 2; cab.position.set(0.55, A0 + 1.35, 0); g.add(cab);   // crew cabin
    box(g, M.silver, 0.12, 1.95, 2.3, 1.22, A0 + 1.05, 0);                        // its front face
    box(g, M.black, 0.1, 0.82, 0.82, 1.3, A0 + 0.5, 0);                           // the hatch
    for (const t of [-1, 1]) {
      // Two triangular windows, canted inward.
      const tri = new THREE.Shape();
      tri.moveTo(0, 0); tri.lineTo(0.62, 0); tri.lineTo(0.31 * (1 - t * 0.6), 0.55); tri.closePath();
      const w = new THREE.Mesh(new THREE.ShapeGeometry(tri), M.glass);
      w.position.set(1.29, A0 + 1.25, t * 0.08 + (t < 0 ? -0.7 : 0.08));
      w.rotation.y = Math.PI / 2 + t * 0.35;
      g.add(w);
    }
    box(g, M.black, 1.0, 1.4, 2.0, -1.55, A0 + 0.95, 0);                          // aft equipment bay
    box(g, M.gold, 0.9, 0.5, 1.7, -1.5, A0 + 1.85, 0);
    const tun = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.55, 16), M.silver);
    tun.position.set(0, A0 + 2.4, 0); g.add(tun);                                 // docking tunnel
    for (const [x, z] of [[0.95, 1.25], [0.95, -1.25], [-1.05, 1.25], [-1.05, -1.25]]) {
      // RCS quads: a housing and four small nozzles each.
      box(g, M.grey, 0.32, 0.32, 0.32, x, A0 + 1.95, z);
      for (const [nx, ny, nz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0]]) {
        rod(g, M.black, V(x + nx * 0.14, A0 + 1.95 + ny * 0.14, z), V(x + nx * 0.34, A0 + 1.95 + ny * 0.34, z), 0.04, 6);
      }
    }
    // The rendezvous radar dish up front, the S-band dish on its mast.
    const dish = (x, y, z, r, tx, ty) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 6, 0, Math.PI * 2, 0, 0.9), M.silver);
      m.position.set(x, y, z); m.rotation.set(tx, 0, ty); g.add(m);
    };
    dish(1.0, A0 + 2.35, 0.55, 0.32, 0, -1.0);
    rod(g, M.silver, V(-0.5, A0 + 1.9, -1.0), V(-0.5, A0 + 2.8, -1.0), 0.03);
    dish(-0.5, A0 + 2.85, -1.0, 0.34, 0.5, 0.2);
    for (const z of [-0.6, 0.6]) rod(g, M.silver, V(-0.9, A0 + 1.9, z), V(-1.2, A0 + 2.9, z * 1.4), 0.012, 4);  // VHF
    for (const m of g.children) m.castShadow = m.receiveShadow = true;
    return g;
  }

  /* Viking, as it stood in Chryse Planitia in 1976 and Utopia after it:
     a hexagonal equipment bus 1.5 m across on three legs, the two RTGs
     in their wind covers on its flanks, the camera turrets up front,
     the high-gain dish on its mast, the weather boom, and the sampler
     arm reaching out to the trench it dug. About two metres high. */
  function buildViking(pads) {
    const g = new THREE.Group();
    const R = 1.15;
    const bus = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.46, 6), M.white);
    bus.position.y = 0.7; bus.rotation.y = Math.PI / 6; g.add(bus);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.82, 0.82, 0.04, 6), M.grey);
    lid.position.y = 0.94; lid.rotation.y = Math.PI / 6; g.add(lid);
    for (let k = 0; k < 3; k++) {
      const a = k * 2 * Math.PI / 3 + Math.PI / 3, ca = Math.cos(a), sa = -Math.sin(a);
      const L = (r, y) => V(ca * r, y, sa * r), py = pads[k];
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.13, 0.06, 14), M.silver);
      pad.position.copy(L(R, py + 0.03)); g.add(pad);
      rod(g, M.silver, L(0.7, 0.62), L(R, py + 0.08), 0.04);
      rod(g, M.silver, L(0.55, 0.48), L(R - 0.05, py + 0.1), 0.025);
    }
    // RTG wind covers, port and starboard.
    for (const t of [-1, 1]) box(g, M.grey, 0.42, 0.34, 0.24, -0.1, 1.05, t * 0.62);
    // Camera turrets, a stereo pair a metre apart.
    for (const t of [-0.5, 0.5]) {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.42, 12), M.silver);
      c.position.set(0.55, 1.15, t); g.add(c);
      const h = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.16, 12), M.grey);
      h.position.set(0.55, 1.42, t); g.add(h);
      box(g, M.black, 0.06, 0.05, 0.08, 0.66, 1.42, t);
    }
    // The high-gain dish on its mast, aft.
    rod(g, M.silver, V(-0.45, 0.95, 0), V(-0.45, 1.7, 0), 0.03);
    const dish = new THREE.Mesh(new THREE.SphereGeometry(0.42, 18, 6, 0, Math.PI * 2, 0, 0.75), M.white);
    dish.position.set(-0.45, 1.78, 0); dish.rotation.set(0, 0, 0.9); g.add(dish);
    // Meteorology boom, folded out to one side.
    rod(g, M.silver, V(0.1, 0.95, -0.5), V(0.1, 1.85, -0.75), 0.015, 5);
    rod(g, M.silver, V(0.1, 1.85, -0.75), V(0.45, 1.85, -0.8), 0.012, 5);
    box(g, M.grey, 0.08, 0.06, 0.06, 0.48, 1.85, -0.8);
    // UHF antenna, and the sampler arm out to its trench.
    rod(g, M.silver, V(-0.2, 0.95, 0.4), V(-0.2, 1.5, 0.4), 0.012, 5);
    box(g, M.grey, 0.3, 0.16, 0.2, 0.62, 0.84, 0.15);
    rod(g, M.silver, V(0.75, 0.84, 0.15), V(2.2, 0.12 + pads[0] * 0.3, 0.6), 0.025, 6);
    box(g, M.grey, 0.12, 0.08, 0.1, 2.25, 0.1 + pads[0] * 0.3, 0.62);
    for (const m of g.children) m.castShadow = m.receiveShadow = true;
    return g;
  }

  /* Venera 13, which landed in 1982 and worked for 127 minutes at
     457 °C and 89 bar: a titanium sphere holding the electronics, on a
     crushable landing ring 2 m across, under the disc of its drag plate
     — at this density a disc is all the air brake it needed for the
     last fifty kilometres — and the helical antenna on top. Its camera
     ports look out of the sphere at the ground either side; its colour
     chart and the arm of its penetrometer lie on the ring. */
  function buildVenera() {
    const g = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.16, 10, 40), M.grey);
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.16; g.add(ring);
    for (let k = 0; k < 8; k++) {
      const a = k * Math.PI / 4;
      rod(g, M.silver, V(Math.cos(a) * 0.95, 0.28, Math.sin(a) * 0.95), V(Math.cos(a) * 0.4, 0.62, Math.sin(a) * 0.4), 0.035, 6);
    }
    const sph = new THREE.Mesh(new THREE.SphereGeometry(0.62, 28, 18), M.white);
    sph.position.y = 1.02; g.add(sph);
    // Two camera ports, each looking down at the ground beside the ring.
    for (const t of [-1, 1]) {
      const port = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.14, 12), M.black);
      port.position.set(0, 0.86, t * 0.56); port.rotation.x = t * 1.1; g.add(port);
    }
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.32, 0.3, 16), M.silver);
    neck.position.y = 1.68; g.add(neck);
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(1.08, 1.08, 0.05, 40), M.white);
    plate.position.y = 1.86; g.add(plate);
    const lip = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 0.98, 0.12, 40, 1, true), M.grey);
    lip.position.y = 1.8; g.add(lip);
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.55, 14), M.grey);
    ant.position.y = 2.17; g.add(ant);
    for (let k = 0; k < 6; k++) {
      const h = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.012, 4, 20), M.silver);
      h.rotation.x = Math.PI / 2 + 0.12; h.position.y = 1.96 + k * 0.08; g.add(h);
    }
    // The colour chart and the penetrometer arm, on the ring.
    box(g, M.orange, 0.32, 0.03, 0.12, 1.05, 0.34, 0.25);
    rod(g, M.silver, V(0.9, 0.3, -0.3), V(1.55, 0.05, -0.45), 0.02, 5);
    for (const m of g.children) m.castShadow = m.receiveShadow = true;
    return g;
  }

  /* Everywhere else nobody has landed yet, so this is what you came
     down in: a crewed lander of the size the Apollo one was — a crew
     cabin on a descent stage, four legs spread 7.8 m, a ladder, the
     engine bell, radiators and a dish — in white paint and silver foil
     rather than the LM's gold. About six and a half metres high. */
  function buildGeneric(pads) {
    const g = new THREE.Group();
    const FR = 3.9, Y0 = 1.35, Y1 = 2.55;
    const stage = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.0, Y1 - Y0, 8), M.foil);
    stage.rotation.y = Math.PI / 8; stage.position.y = (Y0 + Y1) / 2; g.add(stage);
    const deck = new THREE.Mesh(new THREE.CylinderGeometry(2.02, 2.02, 0.07, 8), M.grey);
    deck.rotation.y = Math.PI / 8; deck.position.y = Y1; g.add(deck);
    const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.72, 1.0, 24, 1, true), M.bell);
    bell.position.y = Y0 - 0.48; g.add(bell);
    // Spherical tanks showing between the stage panels.
    for (let k = 0; k < 4; k++) {
      const a = k * Math.PI / 2 + Math.PI / 4;
      const t = new THREE.Mesh(new THREE.SphereGeometry(0.62, 16, 12), M.silver);
      t.position.set(Math.cos(a) * 1.55, (Y0 + Y1) / 2, -Math.sin(a) * 1.55); g.add(t);
    }
    for (let k = 0; k < 4; k++) {
      const a = k * Math.PI / 2, ca = Math.cos(a), sa = -Math.sin(a);
      const L = (r, y) => V(ca * r, y, sa * r);
      const Lt = (r, y, t) => V(ca * r - sa * t, y, sa * r + ca * t);
      const py = pads[k];
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.36, 0.14, 18), M.silver);
      pad.position.copy(L(FR, py + 0.05)); g.add(pad);
      rod(g, M.white, L(1.95, 2.3), L(FR, py + 0.18), 0.09);
      for (const t of [-1, 1]) rod(g, M.silver, Lt(FR - 0.4, py + 0.55, 0), Lt(1.7, Y0 + 0.05, t * 0.95), 0.04);
    }
    // Crew cabin, its windows, the hatch facing the ladder, the docking
    // port on top.
    const cab = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.55, 2.4, 24), M.white);
    cab.position.y = Y1 + 1.25; g.add(cab);
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 1.45, 0.7, 24), M.white);
    cone.position.y = Y1 + 2.8; g.add(cone);
    const dock = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.3, 18), M.silver);
    dock.position.y = Y1 + 3.3; g.add(dock);
    box(g, M.black, 0.08, 1.1, 0.8, 1.52, Y1 + 0.75, 0);                        // hatch
    for (const t of [-0.55, 0.55]) box(g, M.glass, 0.06, 0.32, 0.42, 1.47, Y1 + 1.75, t, -t * 0.6);
    // Radiators and a dish.
    for (const t of [-1, 1]) box(g, M.white, 0.06, 1.6, 1.1, -0.2, Y1 + 1.3, t * 1.62, Math.PI / 2);
    rod(g, M.silver, V(-1.0, Y1 + 2.4, 0.4), V(-1.2, Y1 + 3.4, 0.6), 0.03);
    const dish = new THREE.Mesh(new THREE.SphereGeometry(0.45, 18, 6, 0, Math.PI * 2, 0, 0.8), M.white);
    dish.position.set(-1.25, Y1 + 3.5, 0.6); dish.rotation.set(0.4, 0, 0.7); g.add(dish);
    // Porch and ladder down the forward leg.
    box(g, M.silver, 0.8, 0.05, 1.0, 2.35, Y1 - 0.05, 0);
    const top = V(2.7, Y1 - 0.08, 0), bot = V(3.45, 0.95 + pads[0] * 0.8, 0);
    for (const t of [-0.24, 0.24]) rod(g, M.silver, V(top.x, top.y, t), V(bot.x, bot.y, t), 0.02, 6);
    for (let i = 1; i < 8; i++) {
      const f = i / 8;
      rod(g, M.silver, V(top.x + (bot.x - top.x) * f, top.y + (bot.y - top.y) * f, -0.24), V(top.x + (bot.x - top.x) * f, top.y + (bot.y - top.y) * f, 0.24), 0.012, 5);
    }
    for (const m of g.children) m.castShadow = m.receiveShadow = true;
    return g;
  }

  /* What each kind stands on and how big it is to walk into: pads (or
     a ring's sample points) at footR, n of them; a body of radius bodyR
     up to height top. */
  const KINDS = {
    lm: { n: 4, footR: 4.72, bodyR: 2.3, top: 6.5, padR: 0.5, build: buildLM },
    viking: { n: 3, footR: 1.15, bodyR: 0.85, top: 1.8, padR: 0.16, build: buildViking },
    venera: { n: 6, footR: 1.0, bodyR: 1.15, top: 2.4, padR: 0, build: buildVenera },
    generic: { n: 4, footR: 3.9, bodyR: 2.1, top: 6.3, padR: 0.45, build: buildGeneric },
  };
  const padAngle = (k) => (K.n === 3 ? k * 2 * Math.PI / 3 + Math.PI / 3 : k * 2 * Math.PI / K.n);

  function mergeByMaterial(g) {
    const byMat = new Map();
    g.updateMatrixWorld(true);
    for (const m of [...g.children]) {
      const geo = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone());
      geo.applyMatrix4(m.matrix);
      if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
      if (!byMat.has(m.material)) byMat.set(m.material, []);
      byMat.get(m.material).push(geo);
      m.geometry.dispose();
    }
    const out = new THREE.Group();
    for (const [mat, list] of byMat) {
      const n = list.reduce((a, q) => a + q.attributes.position.count, 0);
      const pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3), uv = new Float32Array(n * 2);
      let o = 0;
      for (const q of list) {
        pos.set(q.attributes.position.array, o * 3);
        nrm.set(q.attributes.normal.array, o * 3);
        uv.set(q.attributes.uv.array, o * 2);
        o += q.attributes.position.count;
        q.dispose();
      }
      // Foil is crinkled at its own scale, not stretched over whatever
      // primitive it wraps: map it in metres, across each face.
      if (mat.normalMap) {
        for (let i = 0; i < n; i++) {
          const nx = nrm[i * 3], ny = nrm[i * 3 + 1], nz = nrm[i * 3 + 2];
          const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
          if (Math.abs(ny) > 0.7) { uv[i * 2] = x * 0.9; uv[i * 2 + 1] = z * 0.9; }
          else { const l = Math.hypot(nx, nz) || 1; uv[i * 2] = (x * -nz + z * nx) / l * 0.9; uv[i * 2 + 1] = y * 0.9; }
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = mesh.receiveShadow = true;
      out.add(mesh);
    }
    return out;
  }

  return {
    place() {
      for (const m of group.children) m.traverse((o) => o.geometry && o.geometry.dispose());
      group.clear();
      site = WORLD.lander || null;
      K = KINDS[world.lander || 'lm'];
      if (!site) return;
      const [x, z] = site;
      // The LM faces south-west, porch and ladder turned toward the
      // landing site, three-quarters on; the others turn the same way
      // toward wherever the site is from them.
      yaw = WORLD.id === 'moon' ? -2.443 : Math.atan2(z, -x) + 0.5;
      const lp = [], h = [];
      for (let k = 0; k < K.n; k++) {
        const a = padAngle(k), lx = Math.cos(a) * K.footR, lz = -Math.sin(a) * K.footR;
        const wa = yaw + a;
        lp.push([lx, lz]);
        h.push(terrainHeight(x + Math.cos(wa) * K.footR, z - Math.sin(wa) * K.footR) - 0.04);   // pads sink a few cm
      }
      // The plane through the pads, by least squares: its centre and its
      // tilt fore-aft and across; what is left over the struts take up.
      let hc = 0, sx = 0, sz = 0, sxx = 0, szz = 0;
      for (let k = 0; k < K.n; k++) hc += h[k] / K.n;
      for (let k = 0; k < K.n; k++) {
        sx += lp[k][0] * (h[k] - hc); sz += lp[k][1] * (h[k] - hc);
        sxx += lp[k][0] * lp[k][0]; szz += lp[k][1] * lp[k][1];
      }
      const bx = sx / sxx, bz = sz / szz;
      const res = h.map((hk, k) => hk - (hc + bx * lp[k][0] + bz * lp[k][1]));
      const lm = mergeByMaterial(K.build(res));
      lm.rotation.set(-Math.atan(bz), 0, Math.atan(bx), 'YXZ');
      const holder = new THREE.Group();
      holder.rotation.y = yaw;
      holder.add(lm);
      group.add(holder);
      group.traverse((o) => o.layers.enable(1));   // and in the sea's mirror (§10)
      baseH = hc;
      group.position.set(x, hc, z);
      this.update();
    },
    // Once a frame: ride the drawn mesh's curvature drop.
    update() { if (site) group.position.y = baseH - dropAt(site[0], site[1]); },
    // Keep a body of radius r at p (feet at feetY) out of the stage and
    // off the pads; true on contact, with the outward normal in n.
    push(p, r, feetY, n) {
      if (!site) return false;
      const dx = p.x - site[0], dz = p.z - site[1], d = Math.hypot(dx, dz);
      if (d > K.footR + 1.5) return false;
      let hit = false;
      const out = (cx, cz, R) => {
        const ex = p.x - cx, ez = p.z - cz, e = Math.hypot(ex, ez);
        if (e < R + r && e > 1e-6) {
          const k = (R + r) / e; p.x = cx + ex * k; p.z = cz + ez * k; hit = true;
          if (n) n.set(ex / e, 0, ez / e);
        }
      };
      // Physics stands on raw heights, so compare against the pads' plane.
      if (feetY < baseH + K.top) out(site[0], site[1], K.bodyR);
      if (K.padR > 0 && feetY < baseH + 0.3) {
        for (let k = 0; k < K.n; k++) {
          const a = yaw + padAngle(k);
          out(site[0] + Math.cos(a) * K.footR, site[1] - Math.sin(a) * K.footR, K.padR);
        }
      }
      return hit;
    },
  };
})();
