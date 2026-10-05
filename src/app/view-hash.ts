import * as THREE from 'three';
import { boot, session } from './boot';
import { demo } from './demo';
import { updateSkyColors } from './lighting';
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
import { isWorldId, world, worldId, type WorldId } from '../worlds/index';

/* ── Shareable views ────────────────────────────────────────────
   Every surface is a pure function of where you stand, so where you
   stand, where you look and where the sun is reproduce a view
   exactly, for anyone: the address bar keeps them (#w=moon&x=…), a
   second after they change, and L copies the link. Opening one flies
   you there behind the loading screen. Chunk vertices are 32-bit
   world coordinates, which quantise to about a centimetre at 100 km,
   so shared positions stop there. */
const VIEW_LIM = 100000;
let hashTimer = 0, lastHash = '';

/** A view as a link carries it; what is absent stays as it is (h absent: on foot). */
export interface SharedView {
  w: WorldId;
  x: number; z: number;
  yaw?: number; pitch?: number;
  sun?: number;          // elevation, °
  h?: number;            // height above the ground, m: flying
}

export function viewHash() {
  const f = mode === 'ROVER' ? rover.state.pos : player.pos;
  const r1 = (v: number) => Math.round(v * 10) / 10, r3 = (v: number) => Math.round(v * 1000) / 1000;
  let h = 'w=' + worldId + '&x=' + r1(f.x) + '&z=' + r1(f.z) + '&yaw=' + r3(yawObj.rotation.y) +
    '&pitch=' + r3(pitchObj.rotation.x) + '&sun=' + r1(sunElev * 180 / Math.PI);
  if (mode === 'FLY') h += '&h=' + r1(player.pos.y - terrainHeight(f.x, f.z));
  return h;
}
export function stepHash(dt: number) {
  if ((hashTimer -= dt) > 0 || demo.on || session.loading) return;
  hashTimer = 1;
  const h = viewHash();
  if (h === lastHash) return;
  lastHash = h;
  try { history.replaceState(null, '', '#' + h); } catch (e) { /* sandboxed: no address bar */ }
}
// The address bar is anyone's to type into: an unknown world is no view
// at all, a malformed number is absent, and positions are clamped.
export function parseView(hash: string): SharedView | null {
  const q = new URLSearchParams(hash.replace(/^#/, ''));
  const w = q.get('w');
  if (!w || !isWorldId(w)) return null;
  const num = (k: string) => { const v = parseFloat(q.get(k) ?? ''); return Number.isFinite(v) ? v : undefined; };
  const lim = (v: number | undefined) => THREE.MathUtils.clamp(v ?? 0, -VIEW_LIM, VIEW_LIM);
  return { w, x: lim(num('x')), z: lim(num('z')), yaw: num('yaw'), pitch: num('pitch'), sun: num('sun'), h: num('h') };
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
