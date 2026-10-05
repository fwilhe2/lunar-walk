import { terrainHeight } from '../kernel/terrain';
import { EYE } from './constants';
import { gait } from './gait';
import { mode, player, setModeRaw, type Mode } from './player';
import { camera, pitchObj, yawObj } from '../render/renderer';
import { el, note, updateKeysHelp } from '../ui/hud';
import { rover } from '../vehicles/rover';
import { world } from '../worlds/index';

export function setMode(next: Mode) {
  if (next === mode) return;
  if (next === 'ROVER' && !world.rover) {
    // A wheel needs weight on it to make traction, and at six
    // thousandths of a g there is none to be had: spin a wheel here
    // and you lift the rover, not the regolith.
    note('NO WHEELED TRACTION AT ' + world.gTxt + ' — EVA OR FLY', true);
    return;
  }
  if (mode === 'ROVER' && next !== 'ROVER') {
    // Dismount to the left of the rover.
    const s = rover.state;
    player.pos.set(
      s.pos.x + Math.cos(s.yaw) * -1.6,
      terrainHeight(s.pos.x + Math.cos(s.yaw) * -1.6, s.pos.z - Math.sin(s.yaw) * -1.6) + EYE,
      s.pos.z - Math.sin(s.yaw) * -1.6
    );
    player.vel.set(0, 0, 0);
    yawObj.rotation.y = s.yaw;
    rover.setCrew(false);
  }
  if (next === 'ROVER') {
    const s = rover.state;
    if (!s.spawned || player.pos.distanceTo(s.pos) > 60) {
      // Summon it beside you if it was never unpacked, or you left
      // it impractically far behind.
      const yaw = yawObj.rotation.y;
      rover.spawnAt(player.pos.x - Math.sin(yaw) * 3.5, player.pos.z - Math.cos(yaw) * 3.5, yaw);
    }
    pitchObj.rotation.x = -0.3;
    rover.setCrew(true);
  }
  if (next === 'FLY' && mode === 'EVA') {
    player.vel.y = Math.max(player.vel.y, 2);
    player.onGround = false;
  }
  if (next === 'EVA') player.onGround = false;
  player.crouch = 0; player.charge = 0; player.pushing = false; gait.reset();
  player.lift = 0; player.eyeOff = 0;
  player.leanF = player.leanS = 0; player.pvx = player.vel.x; player.pvz = player.vel.z;
  player.fall = null; player.fallAmt = 0; player.steadyY = null; player.smoothOff = 0;
  camera.rotation.set(0, 0, 0);
  setModeRaw(next);
  el.mode.textContent = mode === 'EVA' ? 'EVA' : mode === 'FLY' ? 'FLIGHT' : 'ROVER LRV';
  updateKeysHelp();
}

export function setGravity(g) {
  player.gravity = g;
  const own = g === world.g;
  el.g.textContent = own ? world.gTxt : '9.81 m/s²';
  el.body.textContent = own ? 'SURFACE' : 'TERRESTRIAL';
  el.body.style.color = own ? '' : '#7fb6ea';
}
