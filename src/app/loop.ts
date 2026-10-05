import * as THREE from 'three';
import { session } from './boot';
import { readInput } from './controls';
import { demo } from './demo';
import { stepHash } from './view-hash';
import { sound, type RoverSound } from '../audio/sound';
import { curtains } from '../effects/curtains';
import { devils } from '../effects/devils';
import { dust } from '../effects/dust';
import { geysers } from '../effects/geysers';
import { plumes } from '../effects/plumes';
import { EYE, SUIT, pushSpeed } from '../player/constants';
import { EFFORT, effort } from '../player/effort';
import { input } from '../player/input';
import { _camWorld, stepEVA, stepFLY, stepROVER } from '../player/physics';
import { mode, player } from '../player/player';
import { lander } from '../props/lander';
import { rockSystem } from '../props/rocks';
import { KEY, KEY_DIR, SUN_DIR, sun, sunElev, sunFar } from '../render/lights';
import { quality } from '../render/quality';
import { camera } from '../render/renderer';
import { liveCompanions, relayAim } from '../sky/companions';
import { skyDome } from '../sky/dome';
import { COMPANION_AIM } from '../sky/frames';
import { skyGroup, zodiacal } from '../sky/stars';
import { corona, sunDisc } from '../sky/sun';
import { uSunView } from '../surface/ground';
import { TS } from '../surface/shaders';
import { terrainShadows } from '../terrain/shadows';
import { chunkStreamer } from '../terrain/streamer';
import { drawCompass } from '../ui/compass';
import { el, hudState } from '../ui/hud';
import { rover } from '../vehicles/rover';
import { world } from '../worlds/index';

export const clock = new THREE.Clock();

const _rx = new THREE.Vector3(), _ry = new THREE.Vector3(), _rt = new THREE.Vector3();
function placeShadowRig(light: THREE.DirectionalLight, x: number, y: number, z: number) {
  const c = light.shadow.camera;
  const texel = (c.right - c.left) / light.shadow.mapSize.x;
  // The light camera's own axes: it looks down -KEY_DIR with +y up.
  _rx.set(0, 1, 0).cross(KEY_DIR).normalize();
  _ry.copy(KEY_DIR).cross(_rx);
  _rt.set(x, y, z);
  const ex = _rt.dot(_rx), ey = _rt.dot(_ry);
  _rt.addScaledVector(_rx, Math.round(ex / texel) * texel - ex)
     .addScaledVector(_ry, Math.round(ey / texel) * texel - ey);
  light.target.position.copy(_rt);
  light.position.copy(_rt).addScaledVector(KEY_DIR, light.userData.dist);
}

/* What the suit hears this frame: how hard you are working, as a
   share of a run at this body's pace; the jets firing; the rover's
   motors, and its springs bottoming out when it lands off a crest. */
let roverAir = 0;
function stepSound(dt: number) {
  let work = 0.05, jets = 0, rv: RoverSound | null = null;
  if (mode === 'EVA') {
    work = Math.min(1, Math.max(0, (effort.Wf - EFFORT.rest) / 500));
    if (world.jets && player.gas > 0) {
      jets = Math.abs(input.fwd) + Math.abs(input.side) + (input.jump && !player.onGround ? 1 : 0) + (input.down ? 1 : 0);
    }
  } else if (mode === 'ROVER') {
    const st = rover.state;
    const drive = Math.abs(input.fwd);
    rv = { v: st.vel, drive };
    work = 0.1;
    // st.air counts seconds with no wheel down; a real flight, not a
    // frame's skip over a bump, lands with a knock through the seat.
    if (st.air > 0) roverAir = st.air;
    else if (roverAir > 0) { if (roverAir > 0.12) sound.step(Math.min(1.2, 0.3 + roverAir * 1.5)); roverAir = 0; }
  }
  sound.update(dt, work, jets, rv);
}

const NO_KEYS = Object.freeze({ throttle: 0, steer: 0 });
export function step(dt: number, t: number) {
  demo.update(dt);
  readInput(dt);
  const gh = mode === 'EVA' ? stepEVA(dt) : mode === 'FLY' ? stepFLY(dt) : stepROVER(dt);
  if (mode !== 'EVA') effort.update(dt, mode === 'ROVER' ? EFFORT.rest + 30 : EFFORT.rest);
  // A parked rover, brake on, still settles on its springs — and one
  // you bailed out of mid-jump still comes down.
  if (mode !== 'ROVER' && rover.state.spawned) rover.step(dt, NO_KEYS, player.gravity, true);
  const focus = mode === 'ROVER' ? rover.state.pos : player.pos;

  // Stream the world around whatever is moving.
  chunkStreamer.update(focus.x, focus.z);
  rockSystem.update(focus.x, focus.z);
  lander.update();

  // Both shadow cascades follow the focus, stepped in whole texels
  // of their own maps so shadow edges do not crawl as you walk.
  placeShadowRig(sun, focus.x, gh, focus.z);
  placeShadowRig(sunFar, focus.x, gh, focus.z);
  terrainShadows.update(focus.x, focus.z, gh, false);
  TS.tsSun.value.x = KEY.tan;
  camera.getWorldPosition(_camWorld);
  sunDisc.position.copy(_camWorld).addScaledVector(SUN_DIR, 12000);
  corona.position.copy(_camWorld).addScaledVector(SUN_DIR, 12500);
  skyGroup.position.copy(_camWorld);
  skyDome.mesh.position.copy(_camWorld);
  zodiacal.update(_camWorld, (world.starGain || 1) * KEY.stars);
  skyDome.uniforms.uSun.value.copy(SUN_DIR);

  // Sun direction in view space, for the glass sparkle and for
  // withdrawing painted grain shadows toward zero phase.
  uSunView.value.copy(KEY_DIR).transformDirection(camera.matrixWorldInverse);

  // Everything overhead rides with the camera: parallax-free,
  // because the nearest of them is six thousand kilometres away.
  devils.update(t, _camWorld);
  for (const cg of liveCompanions) {
    cg.userData.tick(t);
    cg.position.copy(_camWorld).add(cg.userData.pos);
    cg.updateMatrixWorld();
    cg.userData.sync();
  }
  relayAim(COMPANION_AIM);
  // A tall plume's top stays in sunlight well after sunset below it.
  if (plumes.on) plumes.update(_camWorld, session.siteH, THREE.MathUtils.smoothstep(sunElev, -0.25, 0.0), KEY.U);
  curtains.update(KEY.U);
  if (geysers.on) geysers.update(session.siteH, THREE.MathUtils.smoothstep(sunElev, -0.15, 0.0), KEY.U);

  dust.update(dt, player.gravity, world.dustDrag);
  dust.light();
  stepSound(dt);
  stepHash(dt);
  if (world.dose) hudState.doseSv += world.dose * dt / 86400;

  if (hudState.noteTimer > 0 && (hudState.noteTimer -= dt) <= 0) el.note.textContent = '';

  if ((hudState.timer -= dt) <= 0) {
    hudState.timer = 0.1;
    el.v.textContent = hudState.speed.toFixed(2) + ' m/s';
    el.met.textContent = Math.round(effort.W / 10) * 10 + ' W · ' + Math.round(effort.hr) + ' bpm' + (effort.winded ? ' · winded' : '');
    el.a.textContent = Math.max(0, player.pos.y - EYE - gh).toFixed(2) + ' m';
    el.p.textContent = Math.round(focus.x) + ' E · ' + Math.round(-focus.z) + ' N';
    drawCompass();
    el.s.textContent = (sunElev * 180 / Math.PI).toFixed(1) + '°';   // the demo moves it
    const dose = hudState.doseSv;
    if (world.dose) el.dose.textContent = dose < 1 ? (dose * 1000).toFixed(1) + ' mSv' : dose.toFixed(3) + ' Sv';
    // How hard the push being wound up is, and what it will launch you at.
    const charging = mode === 'EVA' && player.charge > 0;
    el.pushLine.hidden = !charging;
    if (charging) {
      el.push.textContent = Math.round(player.charge * 100) + '% · ' +
        pushSpeed(player.charge, player.charge * SUIT.crouch, player.gravity * (1 - (world.buoy || 0))).toFixed(2) + ' m/s';
    }
    el.gasLine.hidden = !world.jets;
    if (world.jets) el.gas.textContent = player.gas.toFixed(1) + ' m/s Δv';
    el.fps.textContent = (quality.fps ? quality.fps.toFixed(0) + ' fps · ' : '') +
      Math.round(quality.scale * 100) + '% · ' + quality.label;
  }
}
