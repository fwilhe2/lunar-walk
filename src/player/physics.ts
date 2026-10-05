import * as THREE from 'three';
import { sound } from '../audio/sound';
import { dust } from '../effects/dust';
import { terrainHeight } from '../kernel/terrain';
import { WORLD } from '../kernel/world';
import { body } from './body';
import { _solids, rockHeight, rockPush, standHeight } from './collision';
import { EYE, FLY_CEILING, JET, SUIT, pushSpeed } from './constants';
import { EFFORT, effort } from './effort';
import { gait, viewMotion } from './gait';
import { input } from './input';
import { player } from './player';
import { lander } from '../props/lander';
import { rockSystem } from '../props/rocks';
import { camera, pitchObj, yawObj } from '../render/renderer';
import { prints } from '../surface/stamps';
import { hudSpeed, note, setHudSpeed } from '../ui/hud';
import { rover } from '../vehicles/rover';
import { world } from '../worlds/index';

const fwd = new THREE.Vector3(), right = new THREE.Vector3(), wish = new THREE.Vector3();
export const _camWorld = new THREE.Vector3(), _off = new THREE.Vector3(), _e = new THREE.Euler();

/* Falling down. Every Apollo crew that went far on foot fell: Young
   and Cernan tripping at a lope, Duke after his highest jump, when his
   backpack carried him over backwards. A fall here comes only from
   something that would do it: running square into a boulder, a toe
   caught on a stone mid-lope, landing a jump too fast on a downslope,
   and now and then a full-effort straight-up jump, Duke's way. You
   topple at the pace your height and gravity allow, √(L/g) — slow and
   strangely gentle on the Moon — lie a moment, then push yourself back
   up, which is hard work in a stiff suit. None of it on the moonlets,
   where you are hardly standing to begin with. */
const FALL = { hold: 1.2, up: 2.6, getUp: 1800 };   // s down, s getting up, J it costs
function startFall(p, dir, gl) {
  if (p.fall || world.jets) return;
  p.fall = { t: 0, dir, topple: 1.5 * Math.sqrt(SUIT.L / gl), hit: false };
}

export const _demoAhead = new THREE.Vector3(), _demoN = new THREE.Vector3(), _rvEnd = new THREE.Vector3();
const LIQ = { lift: 480 * 0.25 / 171, drag: 0.5 * 480 * 1.0 * 0.6 / 171 };
const _hitN = new THREE.Vector3();
export function stepEVA(dt) {
  const p: typeof player & { subm?: number } = player, v = p.vel;
  // Weight, less what dense air holds up (Venus carries 7% of you),
  // and falling off with height as it really does — which matters
  // only on the moonlets, a few per cent at the top of a long drift.
  const R = WORLD.R, yF = p.pos.y - EYE + p.crouch;
  let gl = p.gravity * (R / (R + yF)) ** 2 * (1 - (world.buoy || 0));
  // Wading, and walking on a sea's floor. Liquid methane is about 480
  // kg/m³; a suited body displaces about a quarter of a cubic metre,
  // so all the way under, the liquid holds up 70% of your weight —
  // you sink, but stand on the bottom at a third of Titan's gravity —
  // and drags at ½ρC_dA/m ≈ 0.84 per metre on what is under.
  p.subm = world.sea === undefined ? 0 : THREE.MathUtils.clamp((world.sea - yF) / 1.8, 0, 1);
  gl *= 1 - LIQ.lift * p.subm;
  const drag = (world.drag || 0) + LIQ.drag * p.subm;
  const mu = world.mu;

  fwd.set(0, 0, -1).applyQuaternion(yawObj.quaternion); fwd.y = 0; fwd.normalize();
  right.set(1, 0, 0).applyQuaternion(yawObj.quaternion); right.y = 0; right.normalize();
  const kf = input.fwd, kr = input.side;
  // Keys held together make a diagonal of full length; a stick held
  // part-way makes a part-length wish, and so a slower pace.
  wish.copy(fwd).multiplyScalar(kf).addScaledVector(right, kr);
  if (wish.lengthSq() > 1) wish.normalize();
  if (p.fall) wish.set(0, 0, 0);    // down: the legs are not under you
  const running = input.run && !effort.winded;

  // The slope under you, as a gradient.
  const e = 0.4;
  const gx = (terrainHeight(p.pos.x + e, p.pos.z) - terrainHeight(p.pos.x - e, p.pos.z)) / (2 * e);
  const gz = (terrainHeight(p.pos.x, p.pos.z + e) - terrainHeight(p.pos.x, p.pos.z - e)) / (2 * e);
  const s2 = 1 + gx * gx + gz * gz, cosT = 1 / Math.sqrt(s2);
  // Legs, and suit knees most of all, are built to go forwards: people
  // choose about two-thirds of their pace stepping sideways and half
  // going backwards, where they cannot see where the foot goes.
  const wl = wish.length(), wc = wl > 1e-3 ? (wish.x * fwd.x + wish.z * fwd.z) / wl : 1;
  const dirK = wc >= 0 ? 0.65 + 0.35 * wc : 0.65 + 0.15 * wc;
  const vT = Math.sqrt((running ? SUIT.frRun : SUIT.frWalk) * gl * SUIT.L) * dirK;
  let tookOff = 0;

  if (p.onGround) {
    // Winding up: SPACE sinks you into the crouch, and how long you
    // hold it is how hard you will push. Letting go pushes.
    if (input.jump && !p.pushing && !p.fall) {
      // A trigger part-way down caps the effort; SPACE does not.
      p.charge = Math.min(input.pushCap, p.charge + dt / SUIT.charge);
      const t = p.charge * SUIT.crouch - p.crouch;
      p.crouch += Math.max(-0.5 * dt, Math.min(0.5 * dt, t));
    } else if (p.charge > 0 && !p.pushing) {
      p.pushing = true; p.pushE = p.charge; p.pushU = 0; p.charge = 0;
    } else if (!p.pushing) {
      p.crouch = Math.max(0, p.crouch - 0.35 * dt);     // straighten up
    }

    if (p.pushing) {
      // The push, in substeps: it lasts a few frames, and its outcome
      // should not depend on how many. Tilting it along the direction
      // you hold is how you jump forward — within the friction cone.
      const n = 10, h = dt / n;
      for (let i = 0; i < n && p.pushing; i++) {
        const F = p.pushE * SUIT.k * SUIT.F0 * Math.max(0, 1 - p.pushU / SUIT.V0) / SUIT.m;
        const acc = F - gl;
        if (p.pushU <= 0 && acc <= 0) {
          // Not enough to lift you: you just stand back up.
          p.crouch = Math.max(0, p.crouch - 0.35 * h);
          if (p.crouch === 0) p.pushing = false;
          continue;
        }
        p.pushU = Math.max(0, p.pushU + acc * h);
        p.crouch -= p.pushU * h;
        const side = Math.min(mu, SUIT.lean) * F;
        v.x += wish.x * side * h; v.z += wish.z * side * h;
        if (p.crouch <= 0) { p.crouch = 0; p.pushing = false; tookOff = p.pushU; }
      }
    } else {
      // Walking: the legs steer toward the pace the gait allows, as
      // briskly as grip and power let them.
      let ax = (wish.x * vT - v.x) / 0.35, az = (wish.z * vT - v.z) / 0.35;
      const hs0 = Math.hypot(v.x, v.z);
      if (ax * v.x + az * v.z > 0) {
        const cap = (running ? SUIT.pRun : SUIT.pWalk) / (SUIT.m * Math.max(hs0, 0.4));
        const am = Math.hypot(ax, az);
        if (am > cap) { ax *= cap / am; az *= cap / am; }
      }
      // Gravity along the slope, and friction: what the legs ask for
      // plus what holding the slope takes, capped at μN.
      const kS = gl / s2, agx = -gx * kS, agz = -gz * kS;
      let fx = ax - agx, fz = az - agz;
      const fm = Math.hypot(fx, fz), fmax = mu * gl * cosT;
      if (fm > fmax) { fx *= fmax / fm; fz *= fmax / fm; }
      v.x += (agx + fx) * dt; v.z += (agz + fz) * dt;
    }
    // On the ground you move along it.
    v.y = gx * v.x + gz * v.z;
    // The eye rides on the legs: down into the crouch, up out of it.
    p.pos.y = standHeight(p.pos.x, p.pos.z, p.pos.y - EYE + p.crouch) + EYE - p.crouch;
    if (tookOff > 0) {
      v.y += tookOff;
      p.onGround = false;
      dust.burst(p.pos.x, p.pos.y - EYE, p.pos.z, Math.min(0.6, 0.12 + tookOff * 0.15));
      prints.place(p.pos.x, p.pos.z, yawObj.rotation.y);
      sound.step(0.3);
    }
  } else {
    p.charge = 0; p.pushing = false;
    p.crouch = Math.max(0, p.crouch - 0.35 * dt);
    v.y -= gl * dt;
  }

  // The jets, on the two moonlets: thrust, not steering, and a tank
  // that empties. Nothing slows you down but more thrust.
  if (world.jets && p.gas > 0) {
    let axes = 0;
    if (kf) { v.addScaledVector(fwd, kf * JET.a * dt); axes += Math.abs(kf); }
    if (kr) { v.addScaledVector(right, kr * JET.a * dt); axes += Math.abs(kr); }
    if (input.jump && !p.onGround) { v.y += JET.a * dt; axes++; }
    if (input.down) { v.y -= JET.a * dt; axes++; if (p.onGround) v.y = Math.max(v.y, gx * v.x + gz * v.z); }
    p.gas = Math.max(0, p.gas - axes * JET.a * dt);
  }

  // Fluid drag, quadratic and in three dimensions, so it shortens a
  // jump as well as a stride. ½ρC_dA/m ≈ 0.095 per metre for a
  // suited walker in supercritical CO₂; zero everywhere else in the
  // set, where the densest air on offer is Mars's 0.02 kg/m³.
  if (drag) {
    const sp = v.length();
    if (sp > 0.001) v.multiplyScalar(Math.max(0, 1 - drag * sp * dt));
  }

  p.pos.addScaledVector(v, dt);
  // The lander is solid: you stop against it, and slide along it.
  if (lander.push(p.pos, 0.4, p.pos.y - EYE + p.crouch, _hitN)) {
    const vn = v.x * _hitN.x + v.z * _hitN.z;
    if (vn < 0) { v.x -= vn * _hitN.x; v.z -= vn * _hitN.z; }
  }
  // So are the rocks. Walking into one stops you; running into one
  // is a knock you feel through the suit.
  if (rockPush(p.pos, p.pos.y - EYE + p.crouch, 0.3, _hitN)) {
    const vn = v.x * _hitN.x + v.z * _hitN.z;
    if (vn < 0) {
      if (vn < -0.5) sound.step(Math.min(1, -vn * 0.6));
      if (vn < -0.9 && p.onGround) startFall(p, -1, gl);   // knocked back off it
      v.x -= vn * _hitN.x; v.z -= vn * _hitN.z;
      // Glove and boot on rock grip: what slides along it loses μ of
      // the blow, so a push square on stops you instead of steering
      // you round the stone.
      const tx = v.x - (v.x * _hitN.x + v.z * _hitN.z) * _hitN.x, tz = v.z - (v.x * _hitN.x + v.z * _hitN.z) * _hitN.z;
      const vt = Math.hypot(tx, tz), k = vt > 1e-6 ? Math.max(0, 1 - 0.6 * -vn / vt) : 0;
      v.x += tx * (k - 1); v.z += tz * (k - 1);
    }
  }

  // The streamed world ends somewhere; this keeps you inside it.
  const ceil = terrainHeight(p.pos.x, p.pos.z) + EYE + FLY_CEILING;
  if (p.pos.y > ceil) { p.pos.y = ceil; v.y = Math.min(0, v.y); }

  let feet = p.pos.y - EYE + p.crouch;
  const wasGround = p.onGround;
  const th = terrainHeight(p.pos.x, p.pos.z);
  const gh = standHeight(p.pos.x, p.pos.z, feet);
  const lift = gh - th;            // how far a rock holds you above the soil
  if (!p.onGround) {
    if (feet <= gh) {
      // Landing: the legs take it, sinking as far as they must to
      // stop you at the force they can make.
      const impact = -v.y;
      const hsL = Math.hypot(v.x, v.z), vRunL = Math.sqrt(SUIT.frRun * gl * SUIT.L);
      // Too fast down a slope to get the feet back under you.
      const down = hsL > 0.01 ? -(gx * v.x + gz * v.z) / hsL : 0;
      if (hsL > 1.4 * vRunL && down > 0.2) startFall(p, 1, gl);
      // Duke's fall: a full push straight up, and the backpack's weight
      // turns you over backwards on the way down.
      else if (hsL < 0.3 && impact > 0.9 * pushSpeed(1, SUIT.crouch, gl) && Math.random() < 0.15) startFall(p, -1, gl);
      if (impact > 0.9) dust.burst(p.pos.x, gh, p.pos.z, Math.min(1.6, impact * 0.35));
      if (impact > 0.3) prints.place(p.pos.x, p.pos.z, yawObj.rotation.y);
      if (impact > 0.15) sound.step(0.2 + impact * 0.5, lift > 0.01);
      p.crouch = Math.max(p.crouch, Math.min(SUIT.crouch, impact * impact / (2 * SUIT.k * SUIT.F0 / SUIT.m)));
      p.onGround = true;
      v.y = 0;
      feet = gh;
    }
  } else if (p.lift > 0.005 && feet - gh <= p.lift + 0.01) {
    // Off the edge of a stone: you step down rather than fall.
    feet = gh;
  } else if (feet - gh > 0.5 * gl * dt * dt + 0.002) {
    // The ground fell away faster than gravity could follow it: over a
    // crest at speed, you fly. That happens when v²κ > g, and on a
    // body where g is small it happens a lot.
    p.onGround = false;
  } else {
    feet = gh;
  }
  if (p.onGround) p.pos.y = gh + EYE - p.crouch;
  // A step up or down takes the eye a stride's time, not a frame.
  const dLift = p.onGround && wasGround ? lift - p.lift : 0;
  p.eyeOff = (p.eyeOff - dLift) * Math.exp(-dt / 0.15);
  p.lift = p.onGround ? lift : 0;

  // Back at the beacon the jets are recharged.
  if (world.jets && p.onGround && p.gas < JET.dv && Math.hypot(p.pos.x - 8, p.pos.z + 11) < 3) {
    p.gas = JET.dv; note('N₂ RECHARGED', true);
  }

  const hs = Math.hypot(v.x, v.z);
  // The gait: where the eye rides over the feet, and when they strike.
  const g8 = gait.step(p, hs, gl, dt, running);
  // Turning on the spot. The suit turns with you, so turning means
  // stepping round: a shuffle of short steps, each a print and a
  // footfall, about one per 35° — none of it in the view.
  {
    let dy = yawObj.rotation.y - p.lastYaw;
    dy -= Math.round(dy / (2 * Math.PI)) * 2 * Math.PI;
    p.lastYaw = yawObj.rotation.y;
    if (p.onGround && !p.fall && !p.pushing && hs < 0.08) {
      p.turnAcc += dy;
      if (Math.abs(p.turnAcc) > 0.6) {
        p.turnAcc = 0;
        prints.place(p.pos.x, p.pos.z, yawObj.rotation.y);
        sound.step(0.2);
        effort.spend(EFFORT.step);
      }
    } else p.turnAcc = 0;
  }
  // A toe caught on a stone at a lope.
  if (gait.foot.n !== p.footN) {
    p.footN = gait.foot.n;
    const f = gait.foot;
    if (gait.mode === 'lope' && hs > 0.6 * Math.sqrt(SUIT.frRun * gl * SUIT.L)) {
      for (const r of rockSystem.solidsAt(f.x, f.z, _solids)) {
        if (rockHeight(r, f.x, f.z) - terrainHeight(f.x, f.z) > 0.08 && Math.random() < 0.5) { startFall(p, 1, gl); break; }
      }
    }
  }
  // Going down, lying there, getting up.
  let fa = 0;
  if (p.fall) {
    const F = p.fall;
    F.t += dt;
    if (F.t < F.topple) fa = (F.t / F.topple) ** 2;              // a topple speeds up as it goes
    else {
      if (!F.hit) {
        F.hit = true;
        sound.step(1.1);
        dust.burst(p.pos.x + fwd.x * F.dir, gh, p.pos.z + fwd.z * F.dir, 0.7);
        prints.place(p.pos.x + fwd.x * F.dir * 0.8, p.pos.z + fwd.z * F.dir * 0.8, yawObj.rotation.y);
        effort.spend(FALL.getUp);
      }
      const u = (F.t - F.topple - FALL.hold) / FALL.up;
      fa = u <= 0 ? 1 : 1 - u * u * (3 - 2 * u);
      if (u >= 1) { p.fall = null; fa = 0; }
    }
  }
  p.fallAmt = fa;
  // The legs ride the bumps, not the head: the hip follows the ground
  // the feet are on, which over a step's length averages away relief
  // shorter than a stride. A triangle filter over ±0.4 m along the way
  // you are going keeps any slope exact and halves the jolting the
  // metre-scale lunar roughness would otherwise put in the eye.
  // Eased in and out, never switched: leaving the ground over a crest
  // would otherwise jerk the eye by the whole correction in a frame.
  let smoothT = 0;
  if (p.onGround && p.lift === 0 && hs > 0.05) {
    const ux = v.x / hs * 0.4, uz = v.z / hs * 0.4;
    const avg = (terrainHeight(p.pos.x - ux, p.pos.z - uz) + 2 * th + terrainHeight(p.pos.x + ux, p.pos.z + uz)) / 4;
    smoothT = (avg - th) * Math.min(1, hs / 0.3);
  }
  p.smoothOff += (smoothT - p.smoothOff) * (1 - Math.exp(-dt / 0.08));
  const smooth = p.smoothOff;
  // The body pivots about the feet, and the eye rides the helmet's arc:
  // onto hands and knees going forward, onto the backpack going back.
  const fDir = p.fall ? p.fall.dir : 1, fTh = fa * (fDir > 0 ? 1.2 : 1.25);
  const fDrop = EYE * (1 - Math.cos(fTh)), fOut = EYE * Math.sin(fTh) * fDir;
  // Leaning into it. To speed up or slow down on legs, the body must
  // lean until the ground's push passes through its centre of mass:
  // tan φ = a/g. On the Moon friction allows a sixth of what it does
  // at home, but gravity is a sixth too, so the lean is as steep — up
  // to 30° — and, the body falling into it at √(g/L), far slower to
  // come and go. The head inside the helmet takes back half of it.
  if (p.onGround && dt > 0) {
    const ax = (v.x - p.pvx) / dt, az = (v.z - p.pvz) / dt;
    const tF = Math.atan((ax * fwd.x + az * fwd.z) / gl), tS = Math.atan((ax * right.x + az * right.z) / gl);
    const k = 1 - Math.exp(-dt / (0.5 * Math.sqrt(SUIT.L / gl)));
    p.leanF += (THREE.MathUtils.clamp(tF, -0.6, 0.6) - p.leanF) * k;
    p.leanS += (THREE.MathUtils.clamp(tS, -0.5, 0.5) - p.leanS) * k;
  }
  p.pvx = v.x; p.pvz = v.z;
  // What it is costing you.
  let P = EFFORT.rest;
  if (p.onGround && gait.rate > 0) {
    P += EFFORT.step * gait.rate + SUIT.m * gl * hs * (gait.mode === 'walk' ? EFFORT.walk : EFFORT.lope);
    P += Math.max(0, SUIT.m * gl * v.y) / EFFORT.eff;
  }
  if (drag && p.onGround) P += SUIT.m * drag * hs * hs * hs / EFFORT.eff;
  if (tookOff > 0) effort.spend(0.5 * SUIT.m * tookOff * tookOff / EFFORT.eff + EFFORT.step * 2);
  if (p.charge > 0) P += 120;    // holding a crouch in a stiff suit
  effort.update(dt, P);
  // How much of all that reaches the eye is a choice (V). Full motion
  // is what the head does; steady — the default — is what the eye
  // makes of it, and what most stomachs prefer: the view stays level
  // through every lean, the stride's bounce and sway are left to the
  // shadow and the footfalls, and the ground's jolts are smoothed.
  const full = viewMotion === 'full';
  if (full) camera.rotation.set(-p.leanF * 0.5 - fa * (fDir > 0 ? 0.7 : -0.6), 0, -p.leanS * 0.35 + fa * 0.15);
  else camera.rotation.set(-fa * (fDir > 0 ? 0.35 : -0.3), 0, 0);
  // Looking down past what the neck manages inside the helmet means
  // bending at the hips, and looking up, leaning back: the eye swings
  // about the hips, 0.67 m below it, as stiffly as the suit allows.
  const pit = pitchObj.rotation.x, NECK = 0.45;
  const bendT = pit < -NECK ? Math.min(1.0, -pit - NECK) : pit > NECK ? -Math.min(0.45, pit - NECK) : 0;
  p.bend += (bendT - p.bend) * (1 - Math.exp(-dt / 0.35));
  const bf = 0.67 * Math.sin(p.bend), bd = 0.67 * (1 - Math.cos(p.bend));
  const gx8 = full ? g8.x : 0, gy8 = full ? g8.y : 0;
  let eyeY = p.pos.y + gy8 + p.eyeOff + smooth - bd - fDrop;
  // Legs take up a landing; nothing moves the head in one frame. Full
  // motion only rounds that off; steady smooths over a stride.
  if (p.steadyY !== null && Math.abs(eyeY - p.steadyY) < 1) eyeY = p.steadyY + (eyeY - p.steadyY) * (1 - Math.exp(-dt / (full ? 0.04 : 0.12)));
  p.steadyY = eyeY;
  yawObj.position.set(p.pos.x + right.x * gx8 + fwd.x * (bf + fOut), eyeY, p.pos.z + right.z * gx8 + fwd.z * (bf + fOut));
  if (fa > 0) {   // lying on uneven ground, the helmet stays on top of it
    const under = terrainHeight(yawObj.position.x, yawObj.position.z) + 0.3;
    if (yawObj.position.y < under) yawObj.position.y = under;
  }
  // The body always moves fully; only the view is steadied.
  body.update(p.pos.x + right.x * g8.x + fwd.x * (bf + fOut), p.pos.y + g8.y + p.eyeOff + smooth - bd - fDrop,
              p.pos.z + right.z * g8.x + fwd.z * (bf + fOut), yawObj.rotation.y, g8.swing, g8.amt, p.leanF + fTh * fDir, p.leanS, p.bend);
  setHudSpeed(hs);
  return gh;
}

export function stepFLY(dt) {
  body.hide();
  // Full-3D thrust along the view axis; SPACE and C give pure lift.
  fwd.set(0, 0, -1).applyQuaternion(pitchObj.getWorldQuaternion(new THREE.Quaternion()));
  right.set(1, 0, 0).applyQuaternion(yawObj.quaternion); right.y = 0; right.normalize();

  wish.set(0, 0, 0);
  wish.addScaledVector(fwd, input.fwd).addScaledVector(right, input.side);
  if (input.jump) wish.y += 1;
  if (input.down) wish.y -= 1;
  if (wish.lengthSq() > 1) wish.normalize();

  const boost = input.run;
  const accel = boost ? 90 : 26;
  const maxV = boost ? 120 : 24;

  player.vel.addScaledVector(wish, accel * dt);
  player.vel.multiplyScalar(Math.max(0, 1 - 2.2 * dt));
  const v = player.vel.length();
  if (v > maxV) player.vel.multiplyScalar(maxV / v);

  player.pos.addScaledVector(player.vel, dt);

  // The ceiling is height above the ground under you, not an absolute
  // altitude: terrain on Phobos ranges over 450 m, and an absolute cap
  // would sit below the surface in the highlands and fight the floor.
  const gh = terrainHeight(player.pos.x, player.pos.z);
  if (player.pos.y < gh + 0.6) { player.pos.y = gh + 0.6; player.vel.y = Math.max(0, player.vel.y); }
  if (player.pos.y > gh + FLY_CEILING) { player.pos.y = gh + FLY_CEILING; player.vel.y = Math.min(0, player.vel.y); }

  yawObj.position.copy(player.pos);
  setHudSpeed(v);
  return gh;
}

export function stepROVER(dt) {
  body.hide();
  rover.step(dt, { throttle: input.fwd, steer: input.side }, player.gravity);
  const s = rover.state;
  // Into the lander at speed: stopped dead, with a knock.
  if (lander.push(s.pos, 1.7, s.y - 0.5, _hitN)) {
    if (Math.abs(s.vel) > 0.3) sound.step(Math.min(1.2, Math.abs(s.vel) * 0.5));
    s.vel *= -0.15;
  }
  // A sea: an LRV is not a boat, and its electronics were never meant
  // to be wet, so it stops where the water would reach its hubs.
  if (world.sea !== undefined) {
    const nx = s.pos.x - Math.sin(s.yaw) * 1.4 * Math.sign(s.vel), nz = s.pos.z - Math.cos(s.yaw) * 1.4 * Math.sign(s.vel);
    if (terrainHeight(nx, nz) < world.sea - 0.4 && Math.abs(s.vel) > 0.01) {
      if (Math.abs(s.vel) > 0.3) sound.step(Math.min(1, Math.abs(s.vel) * 0.4));
      s.vel *= -0.1;
    }
  }
  // And so is a boulder too big to climb, met by the nose or the tail
  // — but only the end that is driving into it: backing off is free.
  const rfx = -Math.sin(s.yaw), rfz = -Math.cos(s.yaw);
  for (const e of [1, -1]) {
    if (s.vel * e <= 0) continue;
    const ex = s.pos.x + rfx * 1.3 * e, ez = s.pos.z + rfz * 1.3 * e;
    _rvEnd.set(ex, 0, ez);
    if (rockPush(_rvEnd, terrainHeight(ex, ez), 0.75, _hitN)) {
      s.pos.x += _rvEnd.x - ex; s.pos.z += _rvEnd.z - ez;
      if (Math.abs(s.vel) > 0.3) sound.step(Math.min(1.2, Math.abs(s.vel) * 0.5));
      s.vel *= -0.15;
    }
  }

  // Chase camera: orbit the rover with the same mouse look, keep
  // the lens out of the ground.
  _off.set(0, 0, 1).applyEuler(_e.set(pitchObj.rotation.x, yawObj.rotation.y, 0, 'YXZ'));
  const aimX = s.pos.x, aimY = s.y + 1.15, aimZ = s.pos.z;
  const dist = 6.5;
  let cx = aimX + _off.x * dist, cy = aimY + _off.y * dist, cz = aimZ + _off.z * dist;
  const minY = terrainHeight(cx, cz) + 0.45;
  if (cy < minY) cy = minY;
  yawObj.position.set(cx, cy, cz);

  // Keep the walker's state parked on the seat so nothing jumps
  // when you dismount.
  player.pos.set(s.pos.x, s.y + EYE, s.pos.z);
  player.vel.set(0, 0, 0);

  setHudSpeed(Math.abs(s.vel));
  return terrainHeight(s.pos.x, s.pos.z);
}
