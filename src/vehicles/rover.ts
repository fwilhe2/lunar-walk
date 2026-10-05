import * as THREE from 'three';
import { dust } from '../effects/dust';
import { terrainHeight } from '../kernel/terrain';
import { STEP_UP, rockHeight } from '../player/collision';
import { player } from '../player/player';
import { rockSystem } from '../props/rocks';
import { scene } from '../render/renderer';
import { COMPANION_AIM } from '../sky/frames';
import { surfacePatch } from '../surface/patch';
import { TRACK_L, meshHeight, tracks } from '../surface/stamps';
import { chunkStreamer } from '../terrain/streamer';
import { world } from '../worlds/index';

/* ═════════════════════════════════════════════════════════════
   11. ROVER — the Lunar Roving Vehicle, built from primitives to its
   real dimensions: 3.1 m long, a 2.29 m wheelbase and 1.83 m track,
   wheels 82 cm across. A tubular aluminium chassis on double
   wishbones; wheels with a spun-aluminium hub and a tyre of woven
   zinc-coated piano wire, titanium chevrons riveted over half the
   tread; pale fibreglass fenders; two webbing
   seats with the console and T-handle between them; the LCRU up
   front under white thermal blankets, with the umbrella high-gain
   dish, the helical low-gain antenna and the TV camera on their
   masts; the tool pallet at the back; the commander in the left
   seat while you drive. Ackermann-ish steering, wheels that follow
   the terrain, and it parks where you leave it.
   ═════════════════════════════════════════════════════════════ */
export const rover = (() => {
  const WHEEL_R = 0.41, WHEELBASE = 2.3, TRACK = 1.83;
  const LRV_M = 480, LRV_P = 600;   // kg driven alone; W at the wheels from four 186 W motors
  const CHASSIS_H = 0.46;          // frame height above mean wheel contact
  const WHEEL_CTR = WHEEL_R - 0.035;   // centre height: the tyre sinks a touch into regolith

  const obj = (o) => surfacePatch(new THREE.MeshStandardMaterial(o), 'object');
  // A see-through weave, drawn once: the pattern goes in alphaMap and
  // alphaTest cuts the holes, so light and shadow both pass through.
  function weave(w, h, draw) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d');
    x.fillStyle = '#000'; x.fillRect(0, 0, w, h);
    x.strokeStyle = x.fillStyle = '#fff';
    draw(x, w, h);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 4;
    return t;
  }
  /* The tyre is not see-through. Its mesh is fine enough — a cell or
     so to the centimetre — that from anywhere but arm's length it
     reads as a grey fabric, and cut out with alphaTest it mip-maps
     below the threshold and the whole tyre dissolves into sparkle.
     So the weave is painted, not cut: bright wire over the darker
     inside of the carcass, and the titanium chevrons riveted over
     the middle of the tread. The texture wraps the lathe once: u
     runs round the wheel, v across the profile from rim to rim. */
  const tyreTex = (() => {
    const w = 1024, h = 192;
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d');
    x.fillStyle = '#3a3b3d'; x.fillRect(0, 0, w, h);
    x.strokeStyle = '#a9acb0'; x.lineWidth = 1.5;
    for (let i = -h; i < w + h; i += 6) {             // the diamond wire mesh
      x.beginPath(); x.moveTo(i, 0); x.lineTo(i + h, h); x.stroke();
      x.beginPath(); x.moveTo(i + h, 0); x.lineTo(i, h); x.stroke();
    }
    // Chevrons across the tread (v 0.3…0.7), pointing the way it rolls.
    x.fillStyle = '#c4c2bc';
    const n = 40, v0 = h * 0.3, v1 = h * 0.7, vm = (v0 + v1) / 2;
    for (let k = 0; k < n; k++) {
      const u = k / n * w, d = w / n * 0.42, t = w / n * 0.2;
      x.beginPath();
      x.moveTo(u, v0); x.lineTo(u + d, vm); x.lineTo(u, v1);
      x.lineTo(u + t, v1); x.lineTo(u + d + t, vm); x.lineTo(u + t, v0);
      x.closePath(); x.fill();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = THREE.RepeatWrapping;
    t.anisotropy = 8;
    return t;
  })();
  const dishWeave = weave(128, 128, (x, w) => {
    x.lineWidth = 1.2;
    for (let i = 0; i <= w; i += 5) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, w); x.stroke(); x.beginPath(); x.moveTo(0, i); x.lineTo(w, i); x.stroke(); }
  });
  dishWeave.repeat.set(8, 4);

  const alu     = obj({ color: 0xc8cacf, roughness: 0.42, metalness: 0.75 });
  const aluDull = obj({ color: 0x9fa2a7, roughness: 0.7, metalness: 0.5 });
  const blanket = obj({ color: 0xe6e3dc, roughness: 0.88, metalness: 0 });
  const webbing = obj({ color: 0x9aa6b0, roughness: 0.95, metalness: 0 });
  const dark    = obj({ color: 0x2c2e31, roughness: 0.85, metalness: 0.15 });
  const fender  = obj({ color: 0xbdb8ad, roughness: 0.72, metalness: 0.05 });
  /* Close up the weave opens: where the texture shows the dark gap
     between wires, and the gap spans enough pixels to be drawn without
     shimmer, the fragment is cut away and the bump stop shows through.
     Further off the cut threshold falls to nothing, so the holes shrink
     shut rather than flicker; at the chase camera's distance a cell is
     a pixel and a half, and the tyre is the painted fabric again. The
     sun's shadow maps do not see the holes. */
  const tyre    = obj({ map: tyreTex, roughness: 0.7, metalness: 0.35, side: THREE.DoubleSide });
  {
    const base = tyre.onBeforeCompile;
    tyre.onBeforeCompile = (shader, r) => {
      base(shader, r);
      shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
        {
          vec2 tx = vMapUv * vec2( 1024.0, 192.0 );          // tyreTex texels
          float fp = max( length( dFdx( tx ) ), length( dFdy( tx ) ) );
          float cut = 0.14 * ( 1.0 - smoothstep( 0.6, 1.4, fp ) );
          if ( dot( sampledDiffuseColor.rgb, vec3( 0.2126, 0.7152, 0.0722 ) ) < cut ) discard;
        }`);
    };
    tyre.customProgramCacheKey = () => 'surface-object-weave';
  }
  // Only its outward faces go into the shadow maps: with both, the
  // shallow dish shadows itself in a sawtooth wherever the sun grazes it.
  const hubAlu  = obj({ color: 0xc3c5c9, roughness: 0.35, metalness: 0.8, side: THREE.DoubleSide, shadowSide: THREE.FrontSide });
  const gmesh   = obj({ color: 0xd9b56a, roughness: 0.45, metalness: 0.8, alphaMap: dishWeave, alphaTest: 0.5, side: THREE.DoubleSide });

  const group = new THREE.Group();
  group.visible = false;
  scene.add(group);

  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0, parent = group) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  // A tube between two points.
  const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
  const tube = (x0, y0, z0, x1, y1, z1, r, mat = alu, parent = group) => {
    _a.set(x0, y0, z0); _b.set(x1, y1, z1);
    const len = _a.distanceTo(_b);
    const m = add(new THREE.CylinderGeometry(r, r, len, 8), mat, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, 0, 0, 0, parent);
    m.quaternion.setFromUnitVectors(_up, _b.sub(_a).normalize());
    return m;
  };

  // ── chassis: two long rails and cross members, and the floor
  const RX = 0.62;
  for (const sx of [-RX, RX]) tube(sx, 0.04, -1.45, sx, 0.04, 1.45, 0.024);
  for (const z of [-1.45, -0.95, -0.35, 0.3, 0.85, 1.45]) tube(-RX, 0.04, z, RX, 0.04, z, 0.02);
  add(new THREE.BoxGeometry(1.2, 0.02, 1.25), aluDull, 0, 0.02, -0.02);        // centre floor
  add(new THREE.BoxGeometry(1.2, 0.02, 0.5), aluDull, 0, 0.02, 1.15);          // aft floor

  // ── seats: tube frames, webbing, arm rests and footrests
  for (const sx of [-0.33, 0.33]) {
    add(new THREE.BoxGeometry(0.5, 0.025, 0.46), webbing, sx, 0.3, 0.42);           // seat pan
    add(new THREE.BoxGeometry(0.5, 0.5, 0.025), webbing, sx, 0.55, 0.66, -0.2);     // back
    tube(sx - 0.25, 0.3, 0.2, sx - 0.25, 0.3, 0.65, 0.012);
    tube(sx + 0.25, 0.3, 0.2, sx + 0.25, 0.3, 0.65, 0.012);
    tube(sx - 0.25, 0.04, 0.3, sx - 0.25, 0.3, 0.3, 0.012);
    tube(sx + 0.25, 0.04, 0.3, sx + 0.25, 0.3, 0.3, 0.012);
    tube(sx - 0.25, 0.3, 0.65, sx - 0.25, 0.78, 0.74, 0.012);
    tube(sx + 0.25, 0.3, 0.65, sx + 0.25, 0.78, 0.74, 0.012);
    tube(sx + (sx < 0 ? -0.27 : 0.27), 0.45, 0.25, sx + (sx < 0 ? -0.27 : 0.27), 0.45, 0.6, 0.012);   // arm rest
    add(new THREE.BoxGeometry(0.42, 0.02, 0.24), aluDull, sx, 0.13, -0.55, -0.5);   // footrest
  }
  // Console on its post, and the T-handle hand controller behind it.
  tube(0, 0.04, -0.35, 0, 0.62, -0.35, 0.02);
  add(new THREE.BoxGeometry(0.3, 0.2, 0.05), dark, 0, 0.7, -0.38, -0.5);
  add(new THREE.BoxGeometry(0.08, 0.22, 0.12), dark, 0, 0.36, 0.05);
  tube(0, 0.45, 0.05, 0, 0.62, 0.0, 0.012, dark);
  tube(-0.05, 0.62, 0.0, 0.05, 0.62, 0.0, 0.012, dark);

  // ── forward chassis: batteries and LCRU under thermal blankets
  add(new THREE.BoxGeometry(0.34, 0.2, 0.36), blanket, -0.3, 0.14, -1.18);
  add(new THREE.BoxGeometry(0.34, 0.2, 0.36), blanket, 0.3, 0.14, -1.18);
  add(new THREE.BoxGeometry(0.46, 0.3, 0.3), blanket, 0, 0.42, -1.3);           // LCRU
  add(new THREE.BoxGeometry(0.4, 0.02, 0.26), alu, 0, 0.58, -1.3);              // its radiator mirror
  // TV camera (GCTA) on a short mast, with its sun shade.
  tube(0, 0.58, -1.3, 0, 0.88, -1.38, 0.018);
  add(new THREE.BoxGeometry(0.16, 0.14, 0.26), blanket, 0, 0.95, -1.42);
  add(new THREE.CylinderGeometry(0.045, 0.05, 0.1, 12), dark, 0, 0.95, -1.59, Math.PI / 2);
  // Low-gain antenna: a helix on a thin mast, left front.
  tube(-0.42, 0.3, -1.35, -0.42, 1.05, -1.35, 0.012);
  {
    const pts = [];
    for (let i = 0; i <= 120; i++) { const a = i / 120 * 6.2832 * 7; pts.push(new THREE.Vector3(Math.cos(a) * 0.035, i / 120 * 0.55, Math.sin(a) * 0.035)); }
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 240, 0.004, 5), alu, -0.42, 1.05, -1.35);
  }
  // High-gain antenna: a gold wire-mesh umbrella on a mast, right
  // front, kept pointed at the relay (Earth, from the Moon).
  tube(0.42, 0.3, -1.3, 0.42, 1.25, -1.3, 0.02);
  const dishGeo = new THREE.LatheGeometry(
    Array.from({ length: 9 }, (_, i) => new THREE.Vector2(0.001 + i / 8 * 0.46, (i / 8) * (i / 8) * 0.13)), 32);
  dishGeo.rotateX(Math.PI / 2);          // opening along +z, which lookAt aims
  const dish = add(dishGeo, gmesh, 0.42, 1.38, -1.3);
  for (let k = 0; k < 8; k++) {           // the umbrella's ribs, riding with the dish
    const a = k / 8 * 6.2832;
    tube(0, 0, 0, Math.cos(a) * 0.46, Math.sin(a) * 0.46, 0.13, 0.005, alu, dish);
  }
  tube(0, 0, 0, 0, 0, 0.3, 0.008, alu, dish);   // feed

  // ── aft pallet: sample bags and the geology tools standing in it
  add(new THREE.BoxGeometry(0.9, 0.3, 0.36), aluDull, 0, 0.19, 1.3);
  add(new THREE.BoxGeometry(0.86, 0.1, 0.32), blanket, 0, 0.39, 1.3);
  for (const [tx, tz, h] of [[-0.35, 1.2, 0.7], [-0.2, 1.38, 0.85], [0.28, 1.25, 0.6], [0.36, 1.4, 0.75]]) {
    tube(tx, 0.3, tz, tx + 0.02, 0.3 + h, tz + 0.04, 0.011, alu);
  }
  add(new THREE.BoxGeometry(0.14, 0.05, 0.12), dark, -0.2, 1.17, 1.42);          // scoop head

  // ── the commander, in the left seat: sitting back against the
  // webbing with the backpack over the seat back, boots on the
  // footrest, right hand on the T-handle between the seats. Shown
  // only while you drive; a parked rover is empty.
  const suit  = obj({ color: 0xe4e1d9, roughness: 0.92, metalness: 0 });
  const visor = obj({ color: 0xc99a3c, roughness: 0.12, metalness: 1 });
  const crew = new THREE.Group();
  group.add(crew);
  {
    const cx = -0.33;
    const limb = (x0, y0, z0, x1, y1, z1, r, mat = suit) => {
      _a.set(x0, y0, z0); _b.set(x1, y1, z1);
      const len = _a.distanceTo(_b);
      const m = add(new THREE.CapsuleGeometry(r, len, 4, 10), mat, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, 0, 0, 0, crew);
      m.quaternion.setFromUnitVectors(_up, _b.sub(_a).normalize());
    };
    add(new THREE.BoxGeometry(0.44, 0.52, 0.28), suit, cx, 0.7, 0.36, 0.08, 0, 0, crew);       // torso
    add(new THREE.BoxGeometry(0.42, 0.62, 0.2), blanket, cx, 0.86, 0.58, 0.08, 0, 0, crew);    // PLSS
    add(new THREE.BoxGeometry(0.3, 0.22, 0.18), blanket, cx, 1.26, 0.62, 0.08, 0, 0, crew);    // OPS on top
    add(new THREE.BoxGeometry(0.26, 0.1, 0.12), dark, cx, 0.86, 0.17, 0.08, 0, 0, crew);       // chest controls
    add(new THREE.SphereGeometry(0.16, 20, 14), suit, cx, 1.14, 0.3, 0, 0, 0, crew);           // helmet
    add(new THREE.SphereGeometry(0.165, 20, 10, Math.PI * 1.12, Math.PI * 0.76, Math.PI * 0.3, Math.PI * 0.34),
        visor, cx, 1.14, 0.3, 0, 0, 0, crew);                                                  // gold visor, facing -z
    add(new THREE.BoxGeometry(0.4, 0.16, 0.34), suit, cx, 0.4, 0.44, 0, 0, 0, crew);           // hips on the seat
    for (const dx of [-0.11, 0.11]) {
      limb(cx + dx, 0.42, 0.42, cx + dx * 1.1, 0.46, 0.0, 0.085);                            // thigh
      limb(cx + dx * 1.1, 0.46, 0.0, cx + dx * 1.15, 0.2, -0.44, 0.075);                     // shin
      add(new THREE.BoxGeometry(0.13, 0.1, 0.26), blanket, cx + dx * 1.15, 0.17, -0.5, -0.5, 0, 0, crew);  // boot
    }
    limb(cx - 0.25, 0.9, 0.36, cx - 0.29, 0.62, 0.3, 0.07);                                  // left upper arm
    limb(cx - 0.29, 0.62, 0.3, cx - 0.27, 0.5, 0.02, 0.06);                                  // … forearm on the rest
    limb(cx + 0.25, 0.9, 0.36, cx + 0.28, 0.66, 0.22, 0.07);                                 // right upper arm
    limb(cx + 0.28, 0.66, 0.22, 0.0, 0.64, 0.04, 0.06);                                      // … forearm to the handle
    add(new THREE.SphereGeometry(0.055, 10, 8), dark, 0.0, 0.64, 0.03, 0, 0, 0, crew);        // glove
    add(new THREE.SphereGeometry(0.055, 10, 8), dark, cx - 0.27, 0.49, -0.02, 0, 0, 0, crew);
  }
  crew.visible = false;

  // ── wheels, fenders, suspension. Front pair steers; all four spin.
  /* The wheel, as built: a spun-aluminium hub disc, and bolted to its
     rim a tyre of woven wire shaped like any other tyre — sidewalls
     bulging out from the rim, a flat tread with the chevrons on it.
     The titanium bump stop inside it shows through the weave when you
     are close. Tyre and hub are lathed about +y and then laid on
     their side, so the axle runs along x. */
  const RIM_R = 0.25, TYRE_W = 0.115;
  const tyreProfile = [];
  for (let i = 0; i <= 24; i++) {
    // A superellipse from rim to rim: boxy, like an inflated section.
    const t = i / 24 * Math.PI, c = Math.cos(t), s = Math.sin(t);
    tyreProfile.push(new THREE.Vector2(RIM_R + (WHEEL_R - RIM_R) * Math.pow(s, 0.45),
                                       -TYRE_W * Math.sign(c) * Math.pow(Math.abs(c), 0.45)));
  }
  const tyreGeo = new THREE.LatheGeometry(tyreProfile, 64).rotateZ(Math.PI / 2);
  // The hub: a dished disc on each face, out to the rim, and a cap.
  const hubGeo = new THREE.LatheGeometry([0, 0.06, 0.14, 0.2, RIM_R].map((r, i) =>
    new THREE.Vector2(r + 0.001, TYRE_W - 0.07 + 0.07 * (i / 4) * (i / 4))), 40).rotateZ(Math.PI / 2);
  /* Fenders are fibreglass shells a centimetre and a half thick: an
     annular sector swept across the width of the wheel, with its ends
     closed, arching over the top from ahead of the axle to behind it. */
  const fenderGeo = (() => {
    const r0 = 0.47, r1 = 0.485, a0 = 0.32, a1 = Math.PI - 0.32;
    const sh = new THREE.Shape();
    sh.absarc(0, 0, r1, a0, a1, false);
    sh.absarc(0, 0, r0, a1, a0, true);
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.3, bevelEnabled: false, curveSegments: 24 });
    return g.translate(0, 0, -0.15).rotateY(Math.PI / 2);
  })();

  /* Suspension: double wishbones, upper and lower, pivoting on torsion
     bars that run fore and aft under the chassis. Both arms are the
     same length and swing through the same angle, so the upright they
     carry stays vertical and the wheel moves on an arc — up, and a
     little inboard. The steering knuckle turns on the upright; the
     arms do not steer. */
  const ARM_L = 0.36;                       // pivot to upright
  const KNUCKLE = 0.1;                      // upright, inboard of the wheel centre
  const ARM_PX = TRACK / 2 - KNUCKLE - ARM_L;
  const REST_Y = WHEEL_CTR - CHASSIS_H;     // wheel centre with the chassis at ride height
  const ARM_DY = 0.07;                      // half the spacing of the two arms
  const ARM_MAX = 0.72;                     // swing either way, rad
  /* Mass. What the springs, the tyres and the body's own inertia do is
     what makes it look heavy: at a sixth of a g the suspension swings
     slowly and far, and a rover coming over a crater rim at speed keeps
     going up after the ground has stopped — the Grand Prix footage from
     Apollo 16 has all four wheels off the ground. Everything below is
     per unit mass, so the vehicle's weight itself never appears. */
  const TRAVEL = ARM_L * Math.sin(ARM_MAX); // wheel travel either way from ride height
  const PRELOAD = 0.1;                      // share of its load a wheel still carries at full droop
  const DAMP = 0.4;                         // damping ratio
  const ROLL_BAR = 1.5;                     // anti-roll bar per axle, in units of a wheel's spring
  const STOP_K = 2500, STOP_C = 60;         // the bump stops: stiff, and lossy
  const RP2 = 0.9, RR2 = 0.4;               // radius of gyration², pitch and roll, m²
  const HCG = 0.55;                         // centre of mass above the contact patches
  // Driving and braking grip is 0.6 μ of the load (below). Sideways a
  // wheel does better: it sits a few centimetres into the soil, and
  // sliding it means bulldozing a wall of regolith with its side and
  // shearing the chevrons across the ruts they cut — about 1.3 of the
  // load on lunar soil.
  const MU_SIDE = 2.0;                      // times the world's μ
  const SUB = 1 / 240;                      // physics substep, s
  const SPRAY = 320;                        // grains thrown per wheel per metre, at speed
  const TRACK_LEAD = 0.2;                   // how far a track stamp may run ahead of the wheel

  /* Where a wheel stands. A single height under the hub gets two things
     wrong. terrainHeight() is the true surface, but what you see is the
     chunk mesh built from it, a lattice a metre or two apart with no
     room for a crater a metre across — so the wheel dropped into holes
     that are not drawn. And an 82 cm tyre does not follow a point: it
     bridges anything much narrower than itself and rests on the rims.
     So each wheel is a circle let down onto the drawn mesh (the same
     reconstruction the prints stand on, §8): seven points along and
     across the contact patch, each asking how high the tyre's bottom
     must be to clear it, and the highest wins. */
  const GC = 512;                           // lattice corners, direct-mapped on integer keys
  const gcI = new Int32Array(GC), gcJ = new Int32Array(GC), gcS = new Int8Array(GC), gcY = new Float64Array(GC);
  // Raw heights, without the curvature drop: the rover lives in raw
  // heights like everything physical, and near you the drop is
  // micrometres. So nothing cached here goes stale — until the world
  // changes, and despawn() clears it.
  const gvtx = (i, j, s) => {
    const k = (Math.imul(i, 73856093) ^ Math.imul(j, 19349663) ^ s) & (GC - 1);
    if (gcS[k] === s && gcI[k] === i && gcJ[k] === j) return gcY[k];
    gcI[k] = i; gcJ[k] = j; gcS[k] = s;
    return (gcY[k] = terrainHeight(i * s, j * s));
  };
  // [along, across, how far that point of the circle sits above its bottom]
  const FOOT = [[0, 0], [-0.3, 0], [-0.15, 0], [0.15, 0], [0.3, 0], [0, -0.1], [0, 0.1]]
    .map(([d, l]) => [d, l, WHEEL_R - Math.sqrt(WHEEL_R * WHEEL_R - d * d)]);
  // Where the bottom of a tyre heading (fx, fz) comes to rest at (x, z),
  // on ground drawn with lattice step s.
  // Stones from §6 are ground to a tyre too: it climbs one where the
  // contact patch meets it, as on the mesh. Their lists are cached on
  // half-metre cells around the wheel, eight cells direct-mapped.
  const rkX = new Int32Array(8).fill(0x7fffffff), rkZ = new Int32Array(8), rkV = new Int32Array(8);
  const rkL = Array.from({ length: 8 }, () => []);
  function rocksNear(x, z) {
    const ix = Math.floor(x * 2), iz = Math.floor(z * 2), k = (ix * 3 + iz * 5) & 7;
    if (rkX[k] !== ix || rkZ[k] !== iz || rkV[k] !== rockSystem.version) {
      rkX[k] = ix; rkZ[k] = iz; rkV[k] = rockSystem.version;
      rockSystem.solidsAt((ix + 0.5) / 2, (iz + 0.5) / 2, rkL[k], 1.1);
    }
    return rkL[k];
  }
  function wheelGround(x, z, fx, fz, s) {
    let h = -Infinity;
    const rocks = rocksNear(x, z);
    for (const [d, l, up] of FOOT) {
      const px = x + fx * d - fz * l, pz = z + fz * d + fx * l;
      let g = meshHeight(px, pz, s, gvtx);
      // A tyre climbs a step of about its own radius less a little —
      // the LRV was specified for 0.3 m — and anything taller it meets
      // as a wall, which is the chassis' business (stepROVER).
      const g0 = g;
      for (let i = 0; i < rocks.length; i++) { const r = rockHeight(rocks[i], px, pz); if (r > g && r < g0 + STEP_UP) g = r; }
      if (g - up > h) h = g - up;
    }
    return h;
  }
  const wheels = [];
  for (const [wx, wz, front] of [[-TRACK / 2, -WHEELBASE / 2, 1], [TRACK / 2, -WHEELBASE / 2, 1],
                                 [-TRACK / 2, WHEELBASE / 2, 0], [TRACK / 2, WHEELBASE / 2, 0]]) {
    const side = Math.sign(wx);
    const wg = new THREE.Group();            // the upright: rides the arm ends
    wg.position.set(wx, REST_Y, wz);
    const steer = new THREE.Group();         // the knuckle: turns with the wheel
    wg.add(steer);
    const spin = new THREE.Group();
    steer.add(spin);
    add(tyreGeo.clone(), tyre, 0, 0, 0, 0, 0, 0, spin);
    add(hubGeo.clone(), hubAlu, 0, 0, 0, 0, 0, 0, spin);
    add(hubGeo.clone().rotateY(Math.PI), hubAlu, 0, 0, 0, 0, 0, 0, spin);
    for (const o of [-TYRE_W, TYRE_W]) add(new THREE.TorusGeometry(RIM_R, 0.012, 6, 40), alu, o, 0, 0, 0, Math.PI / 2, 0, spin);
    // The titanium bump stop inside the carcass, on struts off the rim.
    add(new THREE.CylinderGeometry(0.33, 0.33, 0.15, 40, 1, true), aluDull, 0, 0, 0, 0, 0, Math.PI / 2, spin);
    for (let k = 0; k < 8; k++) {
      const a = k / 8 * 6.2832;
      tube(0, Math.cos(a) * RIM_R, Math.sin(a) * RIM_R, 0, Math.cos(a) * 0.33, Math.sin(a) * 0.33, 0.012, aluDull, spin);
    }
    add(new THREE.CylinderGeometry(0.035, 0.035, 0.26, 12), aluDull, 0, 0, 0, 0, 0, Math.PI / 2, spin);   // axle cap
    // Traction drive and the knuckle it hangs on; the fender turns with them.
    add(new THREE.CylinderGeometry(0.09, 0.09, 0.14, 14), aluDull, -side * 0.12, 0, 0, 0, 0, Math.PI / 2, steer);
    add(fenderGeo.clone(), fender, 0, 0.02, 0, 0, 0, 0, steer);
    tube(-side * 0.19, 0, 0, -side * 0.19, 0.3, 0, 0.012, aluDull, steer);       // fender strut
    tube(-side * KNUCKLE, -ARM_DY - 0.02, 0, -side * KNUCKLE, ARM_DY + 0.02, 0, 0.022, aluDull, wg);
    // Wishbones: each an A from two bearings on its torsion bar to a
    // ball joint on the upright.
    const arms = [ARM_DY, -ARM_DY].map(dy => {
      const a = new THREE.Group();
      a.position.set(side * ARM_PX, REST_Y + dy, wz);
      tube(0, 0, -0.22, side * ARM_L, 0, 0, 0.016, alu, a);
      tube(0, 0, 0.22, side * ARM_L, 0, 0, 0.016, alu, a);
      group.add(a);
      // The torsion bar, and a bracket from each end up to the frame.
      tube(side * ARM_PX, REST_Y + dy, wz - 0.25, side * ARM_PX, REST_Y + dy, wz + 0.25, 0.02, aluDull);
      return a;
    });
    for (const dz of [-0.24, 0.24]) tube(side * ARM_PX, 0.03, wz + dz, side * ARM_PX, REST_Y - ARM_DY, wz + dz, 0.014, aluDull);
    group.add(wg);
    wheels.push({ g: wg, steer, spin, arms, front, side, x: wx, z: wz, swing: 0, s: 0, sd: 0, contact: true, land: 0, step: 1 });
  }

  /* Merge by material. Built above as some hundred and fifty meshes —
     every tube its own — which is fine for reading and ruinous for
     drawing: each is a draw call in the scene and in both shadow
     cascades. Whatever does not move relative to its parent is folded
     into one mesh per material: the chassis, and per wheel the
     spinning part, the steering knuckle, the upright and each of the
     two wishbones; and the dish's ribs. */
  function mergeInto(parent) {
    const byMat = new Map();
    for (const m of [...parent.children]) {
      if (!m.isMesh || m === dish) continue;
      m.updateMatrix();
      const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
      g.applyMatrix4(m.matrix);
      if (!byMat.has(m.material)) byMat.set(m.material, []);
      byMat.get(m.material).push(g);
      parent.remove(m);
      m.geometry.dispose();
    }
    for (const [mat, list] of byMat) {
      const n = list.reduce((a, g) => a + g.attributes.position.count, 0);
      const pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3), uv = new Float32Array(n * 2);
      let o = 0;
      for (const g of list) {
        pos.set(g.attributes.position.array, o * 3);
        nrm.set(g.attributes.normal.array, o * 3);
        if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
        o += g.attributes.position.count;
        g.dispose();
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = mesh.receiveShadow = true;
      parent.add(mesh);
    }
  }
  mergeInto(group);
  mergeInto(dish);
  mergeInto(crew);
  for (const w of wheels) { mergeInto(w.spin); mergeInto(w.steer); mergeInto(w.g); w.arms.forEach(mergeInto); }

  const state = {
    spawned: false,
    pos: new THREE.Vector3(),
    yaw: 0, vel: 0, steer: 0,
    pitch: 0, roll: 0, y: 0,   // chassis attitude and height
    vy: 0, pitchRate: 0, rollRate: 0,
    air: 0,                    // seconds with no wheel on the ground
    load: 0,                   // what the tyres carry, per kg of rover (m/s²)
    trackX: 0, trackZ: 0,        // where the last track stamp ended
    sprayAcc: 0,
  };
  const euler = new THREE.Euler(), _q = new THREE.Quaternion();

  function settle() {
    // Rest the chassis on the terrain immediately, and still.
    const a = poseFromWheels();
    state.y = a.y; state.pitch = a.pitch; state.roll = a.roll;
    state.vy = state.pitchRate = state.rollRate = 0;
    state.air = 0; state.load = player.gravity;
    state.trackX = state.pos.x - Math.sin(state.yaw) * WHEELBASE / 2;
    state.trackZ = state.pos.z - Math.cos(state.yaw) * WHEELBASE / 2;
    apply();
  }

  function poseFromWheels() {
    const c = Math.cos(state.yaw), s = Math.sin(state.yaw);
    // Local +z is aft; local x right. World heading of local -z:
    const step = chunkStreamer.stepAt(state.pos.x, state.pos.z);
    const hx = (lx, lz) => wheelGround(
      state.pos.x + lx * c + lz * s,
      state.pos.z - lx * s + lz * c, -s, -c, step
    );
    const hFL = hx(-TRACK / 2, -WHEELBASE / 2), hFR = hx(TRACK / 2, -WHEELBASE / 2);
    const hRL = hx(-TRACK / 2, WHEELBASE / 2),  hRR = hx(TRACK / 2, WHEELBASE / 2);
    return {
      y: (hFL + hFR + hRL + hRR) / 4 + CHASSIS_H,
      pitch: Math.atan2((hFL + hFR - hRL - hRR) / 2, WHEELBASE),
      roll: Math.atan2((hFR + hRR - hFL - hRL) / 2, TRACK),   // +z roll lifts the right (+x) side
      gradeFwd: ((hFL + hFR) - (hRL + hRR)) / (2 * WHEELBASE),
    };
  }

  const _wv = new THREE.Vector3(), _aim = new THREE.Vector3();
  function apply() {
    group.position.set(state.pos.x, state.y, state.pos.z);
    euler.set(state.pitch, state.yaw, state.roll, 'YXZ');
    group.quaternion.setFromEuler(euler);
    // Per-wheel suspension: put each wheel's contact patch on its own
    // ground by swinging its wishbones, as far as they will swing.
    const sMax = Math.sin(ARM_MAX);
    const fx = -Math.sin(state.yaw), fz = -Math.cos(state.yaw);
    for (const w of wheels) {
      _wv.set(w.x, 0, w.z).applyQuaternion(group.quaternion);
      w.step = chunkStreamer.stepAt(state.pos.x + _wv.x, state.pos.z + _wv.z);
      const hW = wheelGround(state.pos.x + _wv.x, state.pos.z + _wv.z, fx, fz, w.step);
      const ly = hW + WHEEL_CTR - state.y - _wv.y;
      w.s = ly - REST_Y;
      w.swing = Math.asin(Math.max(-sMax, Math.min(sMax, w.s / ARM_L)));
      for (const a of w.arms) a.rotation.z = w.side * w.swing;
      w.g.position.set(w.side * (ARM_PX + ARM_L * Math.cos(w.swing) + KNUCKLE),
                       REST_Y + ARM_L * Math.sin(w.swing), w.z);
    }
  }

  /* Rooster tails. The tread picks grains up where it leaves the
     ground and lets them go a little way round the back of the wheel.
     A point on the tyre an angle φ past the contact patch moves, over
     the ground, at v(1 − cos φ) forward and v·sin φ up — so the spray
     leaves slower than the rover and falls behind it, steep and in
     clean parabolas. The fender takes everything released much above
     the axle; what is left goes out between 7° and 50°, mostly low. */
  const _wc = new THREE.Vector3();
  // Released continuously: n grains per wheel this frame, each from its
  // own point along the dist the wheel covered, so the plume is a sheet
  // and not a row of puffs a stride apart.
  function spray(v, n, dist) {
    const fx = -Math.sin(state.yaw) * Math.sign(v), fz = -Math.cos(state.yaw) * Math.sign(v);
    const sp = Math.abs(v);
    group.updateMatrixWorld();
    for (const w of wheels) {
      if (!w.contact) continue;
      w.g.getWorldPosition(_wc);
      const h = terrainHeight(_wc.x, _wc.z);
      // Most of it lets go early, low and slow; the fines that cling to
      // the mesh ride further round and go out faster and steeper.
      for (let i = 0; i < n; i++) {
        const r = Math.random();
        const phi = 0.13 + Math.pow(r, 1.8) * 0.72, k = sp * (0.4 + Math.random() * 0.6);
        const b = WHEEL_R * Math.sin(phi) + Math.random() * dist, lat = (Math.random() - 0.5) * 0.22;
        const vf = k * (1 - Math.cos(phi)), vl = (Math.random() - 0.5) * 0.35 * k;
        dust.grain(_wc.x - fx * b - fz * lat, h + WHEEL_R * (1 - Math.cos(phi)), _wc.z - fz * b + fx * lat,
                   fx * vf - fz * vl, k * Math.sin(phi), fz * vf + fx * vl, h);
      }
    }
  }

  return {
    state, group,
    spawnAt(x, z, yaw) {
      state.spawned = true;
      state.pos.set(x, 0, z);
      state.yaw = yaw; state.vel = 0; state.steer = 0;
      group.visible = true;
      settle();
    },
    // Someone in the seat while you drive; nobody when it is parked.
    setCrew(on) { crew.visible = on; },
    // Left behind when you change body — it does not follow.
    despawn() {
      state.spawned = false;
      group.visible = false;
      gcS.fill(0);     // another world's ground
    },
    /* One frame of driving, or of standing parked (parked: the brake
       is on and nobody is steering, but the chassis still settles,
       and a rover left in the air still comes down). */
    step(dt, ctl, gravity, parked = false) {
      const st = state;
      // Steering: rate-limited toward the held direction. ctl: throttle
      // and steer, −1 to 1 — keys give the ends, a stick anything between.
      const steerTarget = -0.5 * ctl.steer;
      st.steer += (steerTarget - st.steer) * Math.min(1, dt * 6);

      /* Driving is forces, not a speed dial. Four 0.25 hp hub motors
         push 480 kg — rover, you, and your kit — up to the 3.6 m/s
         their gearing allows; faster than that only downhill, which is
         how Apollo 17 logged 18 km/h. Every force the wheels make,
         driving, braking or turning, is capped by their grip: a
         wire-mesh tyre pulls about 0.4 of its load on lunar soil, so
         the LRV takes six seconds to reach full speed on the Moon and
         the better part of a minute on Charon, and stopping takes as
         long. Rolling through soil costs a tenth of the weight. */
      const fwd = ctl.throttle > 0.05, rev = ctl.throttle < -0.05, thr = Math.min(1, Math.abs(ctl.throttle));
      const pose = poseFromWheels();
      const vmax = world.roverTop || 3.6;
      const cosG = 1 / Math.sqrt(1 + pose.gradeFwd * pose.gradeFwd), sinG = pose.gradeFwd * cosG;
      const g = gravity;
      // Springs scaled to the body, so it rides at its design height
      // everywhere: the torsion bars of a Venus rover are not a Moon
      // rover's. What changes with g is how fast it all happens.
      const kW = g * (1 - PRELOAD) / (4 * TRAVEL);
      const cW = DAMP * Math.sqrt(kW);        // 2ζω per wheel, with ω² = 4kW over all four
      const T = Math.min(dt, 0.1), n = Math.ceil(T / SUB), h = T / n;
      for (let i = 0; i < n; i++) {
        // Wheel loads, from where the ground is under each corner.
        euler.set(st.pitch, st.yaw, st.roll, 'YXZ');
        _q.setFromEuler(euler);
        let F = 0, tp = 0, tr = 0, touching = 0;
        const fx = -Math.sin(st.yaw), fz = -Math.cos(st.yaw);
        for (const w of wheels) {
          _wv.set(w.x, 0, w.z).applyQuaternion(_q);
          const sNow = wheelGround(st.pos.x + _wv.x, st.pos.z + _wv.z, fx, fz, w.step)
                     + WHEEL_CTR - st.y - _wv.y - REST_Y;
          w.sd = (sNow - w.s) / h;
          w.s = sNow;
          const on = sNow > -TRAVEL;
          if (on && !w.contact) w.land = Math.max(w.land, w.sd);
          w.contact = on;
        }
        for (let k = 0; k < 4; k++) {
          const w = wheels[k];
          if (!w.contact) continue;
          touching++;
          // Wheels go FL, FR, RL, RR: k ^ 1 is the other end of the axle.
          const o = wheels[k ^ 1], sw = Math.max(w.s, -TRAVEL) - Math.max(o.s, -TRAVEL);
          let f = g / 4 * PRELOAD + kW * (w.s + TRAVEL) + cW * w.sd + kW * ROLL_BAR * sw;
          if (w.s > TRAVEL) f += STOP_K * (w.s - TRAVEL) + STOP_C * w.sd;
          f = Math.max(0, f);
          F += f; tp -= f * w.z; tr += f * w.x;
        }
        st.load = F;

        // Grip is friction, so it goes with how hard the springs are
        // pressing the tyres down — nothing at all when they are not.
        const grip = world.mu * 0.6 * F * cosG;
        const v = st.vel;
        let tyre = 0;                            // what the tyres push with, per kg
        if (touching) {
          const drive = (u) => Math.min(grip, LRV_P / (LRV_M * Math.max(u, 0.5)));
          if (parked) tyre = -Math.sign(v) * Math.min(grip, Math.abs(v) / h);   // brake on, nobody aboard
          else if (fwd && v >= -0.05) { if (v < vmax) tyre = drive(v) * thr; }
          else if (rev && v > 0.05) tyre = -grip * thr;            // brakes
          else if (rev) { if (v > -1.5) tyre = -drive(-v) * thr; }
          else if (fwd) tyre = grip * thr;                         // braking a roll backwards
          const rr = 0.1 * F * cosG;
          if ((parked || (!fwd && !rev)) && Math.abs(v) < 0.05 && Math.abs(g * sinG) <= grip) {
            st.vel = 0; tyre = g * sinG;                           // parking brake holds
          } else if (Math.abs(v) > 1e-3) {
            tyre -= Math.sign(v) * Math.min(rr, Math.abs(v) / h);
          }
        }
        st.vel += (tyre - (touching ? g * sinG : 0)) * h;
        // Aerodynamic drag: nothing at all on seven of these bodies, and
        // the whole design problem on the eighth. Dragging a rover-sized
        // frontal area through 65 kg/m³ at walking pace takes about a
        // kilowatt, so a Venus rover is slow because of what it is
        // driving through, not what it is driving over — and it does
        // not coast, it stops.
        if (world.roverDrag) st.vel -= world.roverDrag * st.vel * Math.abs(st.vel) * h;

        // Bicycle-model yaw; almost no steering authority at rest, and a
        // turn tighter than the tyres can hold just plows wide. In the
        // air, the wheels steer nothing.
        let yawRate = st.vel / WHEELBASE * Math.tan(st.steer);
        const side = MU_SIDE * world.mu * F * cosG;
        if (!touching) yawRate = 0;
        else if (Math.abs(st.vel * yawRate) > side) yawRate = Math.sign(yawRate) * side / Math.max(0.1, Math.abs(st.vel));
        st.yaw += yawRate * h;
        // Local -z is forward; in world that is (-sin yaw, -cos yaw).
        st.pos.x -= Math.sin(st.yaw) * st.vel * h;
        st.pos.z -= Math.cos(st.yaw) * st.vel * h;

        // The chassis: a rigid body on four springs. Weight against the
        // wheel loads; pitch and roll from where those loads act, plus
        // the tyres' own push at the ground, a centre of mass's height
        // below the mass — squat under power, dive under the brake,
        // lean out of a turn.
        st.vy += (F - g) * h;
        st.pitchRate += (tp + tyre * HCG) / RP2 * h;
        st.rollRate += (tr - st.vel * yawRate * HCG) / RR2 * h;
        st.y += st.vy * h;
        st.pitch += st.pitchRate * h;
        st.roll += st.rollRate * h;
      }
      // Nothing here rolls it over; keep a bad landing from trying.
      if (Math.abs(st.pitch) > 0.9) { st.pitch = Math.sign(st.pitch) * 0.9; st.pitchRate = 0; }
      if (Math.abs(st.roll) > 0.7) { st.roll = Math.sign(st.roll) * 0.7; st.rollRate = 0; }
      st.air = wheels.some(w => w.contact) ? 0 : st.air + dt;
      apply();

      // Wheels: spin with speed, front pair follows the steer angle.
      for (const w of wheels) {
        if (w.front) w.steer.rotation.y = st.steer;
        w.spin.rotation.x -= st.vel / WHEEL_R * dt;
      }
      // Keep the high-gain dish on the relay — Earth from the Moon,
      // and from Mars whichever moon is carrying the link.
      dish.lookAt(_aim.copy(group.position).add(COMPANION_AIM));

      // A wheel coming down hard kicks up a ring of soil.
      for (const w of wheels) {
        if (w.land > 0.6) {
          w.g.getWorldPosition(_wc);
          dust.burst(_wc.x, terrainHeight(_wc.x, _wc.z), _wc.z, Math.min(1.2, w.land * 0.3));
        }
        w.land = 0;
      }

      // Tracks, laid under the front wheels (the rear ones run in
      // them) stamp against stamp along the path actually driven. A
      // stamp goes down once the wheel is within LEAD of its far end,
      // so the band starts right under the tyre, not a stamp behind.
      const ax = st.pos.x - Math.sin(st.yaw) * WHEELBASE / 2, az = st.pos.z - Math.cos(st.yaw) * WHEELBASE / 2;
      let tx = ax - st.trackX, tz = az - st.trackZ, td = Math.hypot(tx, tz);
      if (st.air > 0 || td > 5) { st.trackX = ax; st.trackZ = az; td = 0; }   // took off, or was moved
      while (td >= TRACK_L - TRACK_LEAD) {
        tx /= td; tz /= td;
        tracks.place(st.trackX + tx * TRACK_L / 2, st.trackZ + tz * TRACK_L / 2, Math.atan2(-tx, -tz), TRACK / 2);
        st.trackX += tx * TRACK_L; st.trackZ += tz * TRACK_L;
        tx = ax - st.trackX; tz = az - st.trackZ; td = Math.hypot(tx, tz);
      }
      if (Math.abs(st.vel) > 1.2 && st.air === 0) {
        const dist = Math.abs(st.vel) * dt;
        st.sprayAcc += SPRAY * dist;
        const n = Math.floor(st.sprayAcc);
        st.sprayAcc -= n;
        if (n > 0) spray(st.vel, n, dist);
      }
      return pose;
    },
  };
})();
