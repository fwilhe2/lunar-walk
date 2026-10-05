import * as THREE from 'three';
import { terrainHeight } from '../kernel/terrain';
import { EYE, JET } from './constants';
import { VIEW } from '../worlds/index';
import { yawObj } from '../render/renderer';

/** A fall in progress (physics.ts's startFall()): seconds since it
    began, which way (1 forward, −1 back), how long the topple takes,
    and whether the ground has been hit yet. */
export interface Fall { t: number; dir: 1 | -1; topple: number; hit: boolean }

export interface Player {
  pos: THREE.Vector3; vel: THREE.Vector3;
  onGround: boolean;
  gravity: number;
  crouch: number; charge: number;
  pushing: boolean; pushE: number; pushU: number;
  leanF: number; leanS: number; pvx: number; pvz: number; bend: number;
  steadyY: number | null;          // the eye's height last frame; null: nothing to smooth from
  smoothOff: number; lastYaw: number; turnAcc: number;
  fall: Fall | null; fallAmt: number; footN: number;
  lift: number; eyeOff: number;
  gas: number;
  subm?: number;                   // how far under a sea, 0–1; set by stepEVA
}

export const player: Player = {
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
