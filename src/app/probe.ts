/* The page side of the probe (tools/probe/). Loaded only when the URL
   has ?probe: it puts the modules a driver needs on window.lw, and a
   small API (window.lw.probe) that the Node runner calls through
   page.evaluate(). Nothing here is part of the app proper. */
import * as THREE from 'three';
import { session } from './boot';
import { updateSkyColors } from './lighting';
import { applyWorld, preparing } from './worlds';
import { frameHooks } from './hooks';
import { terrainHeight } from '../kernel/terrain';
import { EYE } from '../player/constants';
import { keys } from '../player/input';
import { setMode } from '../player/modes';
import { mode, player, type Mode } from '../player/player';
import { setSunElev, sunElev, updateSunDir } from '../render/lights';
import { eyePass } from '../render/post';
import { isTier, quality } from '../render/quality';
import { camera, pitchObj, renderer, scene, yawObj } from '../render/renderer';
import { chunkStreamer } from '../terrain/streamer';
import { VIEW, WORLD_IDS, world, worldId, type WorldId } from '../worlds/index';

let frame = 0;
let shot: { type: string; resolve: (url: string) => void } | null = null;
frameHooks.afterRender = () => {
  frame++;
  // In the same task as the drawing, while the canvas still holds it.
  if (shot) { const s = shot; shot = null; s.resolve(renderer.domElement.toDataURL(s.type, 0.9)); }
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const probe = {
  sleep,
  get frame() { return frame; },
  async frames(n: number) { const f = frame + n; while (frame < f) await sleep(15); },
  // Loading done, nothing left to stream, then a few frames for the
  // terrain-shadow pass, which is spread over five.
  async idle(extra = 8) {
    while (preparing || session.loading || chunkStreamer.pending() > 0) await sleep(50);
    await probe.frames(extra);
  },
  // The frame as a data URL. The eye is snapped to the scene first: at a
  // frame a second or so, adaptation would otherwise never converge.
  async snap(png = false): Promise<string> {
    eyePass.uniforms.uReset.value = 1;
    await probe.frames(3);
    return new Promise((resolve) => { shot = { type: png ? 'image/png' : 'image/jpeg', resolve }; });
  },
  // Put the viewer somewhere: { world, x, z, h (above ground), yaw, pitch, mode, sun (rad) }.
  async at(o: { world?: WorldId; x?: number; z?: number; h?: number; yaw?: number; pitch?: number; mode?: Mode; sun?: number }) {
    // applyWorld() prepares textures first, then applies: wait for both.
    if (o.world && o.world !== worldId) { await applyWorld(o.world); await probe.idle(2); }
    if (o.sun !== undefined) { setSunElev(o.sun); updateSunDir(); updateSkyColors(); }
    if (o.mode) setMode(o.mode);
    const x = o.x ?? player.pos.x, z = o.z ?? player.pos.z;
    player.pos.set(x, terrainHeight(x, z) + (o.h ?? EYE), z);
    player.vel.set(0, 0, 0);
    yawObj.position.copy(player.pos);
    if (o.yaw !== undefined) yawObj.rotation.y = o.yaw;
    if (o.pitch !== undefined) pitchObj.rotation.x = o.pitch;
    await probe.frames(2);
    await probe.idle();
  },
};

// What a driver's page.evaluate() finds on window.lw.
const lw = {
  probe, THREE, VIEW, WORLD_IDS, keys, player, camera, scene, yawObj, pitchObj, quality, chunkStreamer, eyePass,
  terrainHeight, applyWorld, setMode, updateSkyColors,
  get world() { return world; }, get worldId() { return worldId; }, get mode() { return mode; }, get sunElev() { return sunElev; },
};
declare global {
  interface Window { lw?: typeof lw }
}

// tier comes from ?probe=; anything but a tier's name is low.
export function install(tier: string) {
  quality.auto = false;
  quality.set(isTier(tier) ? tier : 'low', false);
  window.lw = lw;
}
