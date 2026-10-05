import * as THREE from 'three';
import { terrainHeight } from '../kernel/terrain';
import { EYE, JET } from './constants';
import { VIEW } from '../worlds/index';
import { yawObj } from '../render/renderer';

export const player = {
  pos: new THREE.Vector3(0, 0, 0),
  vel: new THREE.Vector3(),
  onGround: true,
  gravity: VIEW.moon.g,
  crouch: 0, charge: 0,           // m sunk into the knees; 0–1 effort being wound up
  pushing: false, pushE: 0, pushU: 0,
  leanF: 0, leanS: 0, pvx: 0, pvz: 0, bend: 0, steadyY: null, smoothOff: 0, lastYaw: 0, turnAcc: 0,
  fall: null, fallAmt: 0, footN: 0,     // a fall in progress: { t, dir: 1 forward, −1 back }   // rad leaned forward and to the right; last velocity
  lift: 0, eyeOff: 0,             // m a rock holds you above the soil; the eye's lag behind a step
  gas: JET.dv,                    // m/s of Δv left in the jets
};
player.pos.y = terrainHeight(0, 0) + EYE;
yawObj.rotation.y = -0.95;   // opens facing the flag, with Earth up to the right

export type Mode = 'EVA' | 'FLY' | 'ROVER';
export let mode: Mode = 'EVA';

// Without the transition setMode() (modes.ts) makes: for a fresh world.
export function setModeRaw(v: Mode) { mode = v; }
