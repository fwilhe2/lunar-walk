import * as THREE from 'three';
import { updateSkyColors } from './lighting';
import { terrainHeight } from '../kernel/terrain';
import { rockPush } from '../player/collision';
import { EYE } from '../player/constants';
import { keys } from '../player/input';
import { setMode } from '../player/modes';
import { _demoAhead, _demoN } from '../player/physics';
import { mode, player } from '../player/player';
import { SUN_DIR, setSunElev, sunElev, updateSunDir } from '../render/lights';
import { quality } from '../render/quality';
import { pitchObj, yawObj } from '../render/renderer';
import { liveCompanions } from '../sky/companions';
import { hud, hudState, showOverlay } from '../ui/hud';
import { world, worldId } from '../worlds/index';

/* ═════════════════════════════════════════════════════════════
   DEMO — a slow walk, for a screensaver or a "walk with me" video.

   It holds no privileges: it presses the same keys and turns the
   same head a player does, so traction, jump arcs and chunk
   streaming run exactly as they would under a pair of hands.

   One body, one mode: it stays where it is, on foot, at walking pace,
   and never runs. Every so often it hops. The head is steady and
   moves slowly between a few things worth looking at — straight
   ahead, the sun, whatever hangs in the sky, the highest skyline in
   reach — and rests on each for a long time. The sun creeps very
   slowly, because on an airless world the shadows are the scenery.
   ═════════════════════════════════════════════════════════════ */
export const demo = (() => {
  let on = false, lastWorld = null, sunWay = 1, prior = null;
  let gaze = 'ahead', left = 0, actAge = 0, jumpIn = 10, hold = 0, prevGaze = '';
  let yawTarget = 0, pitchTarget = 0;

  const clearKeys = () => { for (const k in keys) keys[k] = false; };
  const rnd = (a, b) => a + Math.random() * (b - a);
  const wrap = (a) => { while (a > Math.PI) a -= 6.2832; while (a < -Math.PI) a += 6.2832; return a; };

  // The direction (yaw, pitch) of the highest skyline within reach, or
  // null on ground with nothing worth turning to.
  function findRange(gh) {
    let best = null;
    for (let i = 0; i < 24; i++) {
      const yaw = i / 24 * 6.2832;
      const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
      for (const d of [800, 1600, 3200, 6400]) {
        const ang = Math.atan2(terrainHeight(player.pos.x + fx * d, player.pos.z + fz * d) - gh, d);
        if (!best || ang > best.pitch) best = { yaw, pitch: ang };
      }
    }
    return best && best.pitch > 0.03 ? best : null;
  }

  // Pick the next thing to look at. Returns [kind, seconds].
  function choose(gh) {
    const opts = [];
    if (prevGaze !== 'ahead' || gaze !== 'ahead') opts.push('ahead');
    if (world.id !== 'venus') opts.push('sun');
    if (liveCompanions.length) opts.push('sky');
    if (findRange(gh)) opts.push('range');
    const pool = opts.filter((o) => o !== gaze);
    const k = pool.length ? pool[Math.floor(Math.random() * pool.length)] : 'ahead';
    return [k, k === 'ahead' ? rnd(35, 70) : rnd(25, 50)];
  }

  function aim(gh) {
    if (gaze === 'sun') {
      yawTarget = Math.atan2(-SUN_DIR.x, -SUN_DIR.z);
      pitchTarget = Math.min(Math.asin(SUN_DIR.y), 0.55);
    } else if (gaze === 'sky' && liveCompanions.length) {
      const c = liveCompanions[0].userData.pos;
      yawTarget = Math.atan2(-c.x, -c.z);
      pitchTarget = Math.min(Math.asin(c.clone().normalize().y), 0.6);
    } else if (gaze === 'range') {
      const r = findRange(gh);
      if (r) { yawTarget = r.yaw; pitchTarget = Math.min(r.pitch, 0.3); }
    } else {
      pitchTarget = world.id === 'venus' ? -0.2 : -0.04;
    }
  }

  return {
    get on() { return on; },
    start() {
      if (on) return;
      on = true;
      lastWorld = null;
      // Always the best picture, whatever was chosen and however the
      // frame rate looks: no governor, and nothing written to storage.
      prior = { id: quality.id, auto: quality.auto };
      quality.auto = false;
      if (quality.id !== 'high') quality.set('high', false);
      quality.fullScale();
      hud.classList.add('demo');
      showOverlay(false);
    },
    stop() {
      if (!on) return;
      on = false;
      clearKeys();
      if (prior) {
        quality.auto = prior.auto;
        if (quality.id !== prior.id) quality.set(prior.id, false);
        prior = null;
      }
      hud.classList.remove('demo');
      if (!hudState.locked) showOverlay(true);
    },
    toggle() { on ? this.stop() : this.start(); },

    update(dt) {
      if (!on) return;

      // Stay on foot. A world change (a key press) restarts the look.
      if (mode !== 'EVA') setMode('EVA');
      if (worldId !== lastWorld) {
        lastWorld = worldId;
        clearKeys();
        gaze = 'ahead'; prevGaze = ''; left = rnd(30, 50); actAge = 0;
        jumpIn = rnd(12, 25);
        yawTarget = yawObj.rotation.y;
        pitchTarget = -0.04;
      }

      // The sun creeps, turning at the ends of a narrow band.
      setSunElev(THREE.MathUtils.clamp(sunElev + sunWay * dt * 0.0006, 0.12, 0.70));
      if (sunElev <= 0.12 || sunElev >= 0.70) sunWay = -sunWay;
      updateSunDir();
      updateSkyColors();

      const gh = terrainHeight(player.pos.x, player.pos.z);

      left -= dt; actAge += dt;
      if (left <= 0) {
        const [k, d] = choose(gh);
        prevGaze = gaze; gaze = k; left = d; actAge = 0;
      }
      if (actAge < 0.05 || gaze === 'sun' || gaze === 'sky') aim(gh);

      // Head: heavy damping, so a change of subject is a slow drift.
      // Movement follows the look direction, so what it looks at it
      // walks toward.
      const dy = wrap(yawTarget - yawObj.rotation.y);
      yawObj.rotation.y += dy * Math.min(1, dt * 0.16);
      pitchObj.rotation.x += (pitchTarget - pitchObj.rotation.x) * Math.min(1, dt * 0.25);
      if (gaze === 'ahead' && Math.abs(dy) < 0.05 && Math.random() < dt * 0.03) {
        yawTarget += rnd(-0.25, 0.25);          // a rare gentle correction
      }

      keys.KeyW = true;
      keys.ShiftLeft = false;                   // never run
      keys.Space = false;
      // Do not climb into a wall: turn along the slope instead.
      const fx = -Math.sin(yawObj.rotation.y), fz = -Math.cos(yawObj.rotation.y);
      if (terrainHeight(player.pos.x + fx * 8, player.pos.z + fz * 8) - gh > 3.5) {
        yawTarget = yawObj.rotation.y + (Math.random() < 0.5 ? 1.0 : -1.0);
        left = Math.max(left, 20); gaze = 'ahead';
      }
      // Nor into a boulder: walk round it, as anyone would.
      _demoAhead.set(player.pos.x + fx * 1.5, 0, player.pos.z + fz * 1.5);
      if (player.onGround && Math.abs(wrap(yawTarget - yawObj.rotation.y)) < 0.2 && rockPush(_demoAhead, player.pos.y - EYE + player.crouch, 0.5, _demoN)) {
        yawTarget = yawObj.rotation.y + (Math.random() < 0.5 ? 0.7 : -0.7);
        gaze = 'ahead';
      }
      if (world.jets && player.gas > 2) {
        // On a moonlet you do not walk, you hover a couple of metres up
        // on the jets — which only ever add velocity, so holding a slow
        // drift means thrusting against it as well as with it.
        const alt = player.pos.y - EYE - gh;
        const along = player.vel.x * fx + player.vel.z * fz;
        const side = player.vel.x * -fz + player.vel.z * fx;   // along the right hand
        keys.KeyW = along < 0.5; keys.KeyS = along > 0.8;
        keys.KeyD = side < -0.1; keys.KeyA = side > 0.1;
        keys.KeyC = alt > 2.5 && player.vel.y > -0.15;
        if (player.onGround) {                    // a gentle push off: crouch briefly, let go
          if (hold <= 0) hold = 0.15;
          hold -= dt; keys.Space = hold > 0;
        }
        else keys.Space = alt < 1.2 && player.vel.y < 0.05;
      } else {
        // A hop, now and then: crouch for a moment, then push.
        jumpIn -= dt;
        if (jumpIn <= 0 && player.onGround && hold <= 0) {
          hold = rnd(0.25, 0.7);
          jumpIn = rnd(18, 45);
        }
        if (hold > 0) { hold -= dt; keys.Space = true; }
      }
    },
  };
})();
