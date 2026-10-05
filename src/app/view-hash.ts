import * as THREE from 'three';
import { boot, session } from './boot';
import { demo } from './demo';
import { updateSkyColors } from './lighting';
import { type SharedView, formatView, parseView } from './view-parse';
import { applyWorld, preparing } from './worlds';
import { dust } from '../effects/dust';
import { terrainHeight } from '../kernel/terrain';
import { EYE, FLY_CEILING } from '../player/constants';
import { setMode } from '../player/modes';
import { mode, player } from '../player/player';
import { rockSystem } from '../props/rocks';
import { setSunElev, sunElev, updateSunDir } from '../render/lights';
import { pitchObj, yawObj } from '../render/renderer';
import { chunkStreamer } from '../terrain/streamer';
import { rover } from '../vehicles/rover';
import { world, worldId } from '../worlds/index';

/* ── Shareable views ────────────────────────────────────────────
   Every surface is a pure function of where you stand, so where you
   stand, where you look and where the sun is reproduce a view
   exactly, for anyone: the address bar keeps them (#w=moon&x=…), a
   second after they change, and L copies the link. Opening one flies
   you there behind the loading screen. The text itself is read and
   written in app/view-parse.ts. */
let hashTimer = 0, lastHash = '';

export function viewHash() {
  const f = mode === 'ROVER' ? rover.state.pos : player.pos;
  return formatView({ w: worldId, x: f.x, z: f.z, yaw: yawObj.rotation.y, pitch: pitchObj.rotation.x,
    sun: sunElev * 180 / Math.PI, h: mode === 'FLY' ? player.pos.y - terrainHeight(f.x, f.z) : undefined });
}
export function stepHash(dt: number) {
  if ((hashTimer -= dt) > 0 || demo.on || session.loading) return;
  hashTimer = 1;
  const h = viewHash();
  if (h === lastHash) return;
  lastHash = h;
  try { history.replaceState(null, '', '#' + h); } catch (e) { /* sandboxed: no address bar */ }
}
export function goTo(v: SharedView) {
  if (v.w !== worldId || preparing) { applyWorld(v.w).then(() => goTo(v)); return; }
  if (v.sun !== undefined) {
    setSunElev(THREE.MathUtils.clamp(v.sun * Math.PI / 180, world.night ? -1.35 : 0.045, 1.35));
    updateSunDir(); updateSkyColors();
  }
  setMode(v.h !== undefined ? 'FLY' : 'EVA');
  const h = v.h !== undefined ? THREE.MathUtils.clamp(v.h, 0.6, FLY_CEILING) : EYE;
  player.pos.set(v.x, terrainHeight(v.x, v.z) + h, v.z);
  player.vel.set(0, 0, 0);
  player.onGround = v.h === undefined;
  if (v.yaw !== undefined) yawObj.rotation.y = v.yaw;
  if (v.pitch !== undefined) pitchObj.rotation.x = THREE.MathUtils.clamp(v.pitch, -1.55, 1.55);
  yawObj.position.copy(player.pos);
  dust.clear();
  // Stream the new place in behind the loading screen, as a new world does.
  session.loading = true; boot.hidden = false;
  chunkStreamer.update(v.x, v.z);
  rockSystem.update(v.x, v.z);
  lastHash = viewHash();
}
addEventListener('hashchange', () => {
  if (location.hash.slice(1) === lastHash) return;
  const v = parseView(location.hash);
  if (v) goTo(v);
});

/** Puts the current view in the address bar now (L copies it), and returns it. */
export function pinView() {
  lastHash = viewHash();
  try { history.replaceState(null, '', '#' + lastHash); } catch (err) { /* no address bar */ }
  return lastHash;
}
