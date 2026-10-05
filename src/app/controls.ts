import * as THREE from 'three';
import { session } from './boot';
import { demo } from './demo';
import { updateSkyColors } from './lighting';
import { pinView } from './view-hash';
import { applyWorld } from './worlds';
import { sound } from '../audio/sound';
import { setPhotoPending } from '../player/camera';
import { G_EARTH } from '../player/constants';
import { setViewMotion, viewMotion } from '../player/gait';
import { input, keys, touch } from '../player/input';
import { setGravity, setMode } from '../player/modes';
import { mode, player } from '../player/player';
import { setSunElev, sunElev, updateSunDir } from '../render/lights';
import { quality } from '../render/quality';
import { FOV0, camera, pitchObj, renderer, yawObj } from '../render/renderer';
import { el, hud, hudState, note, overlay, showOverlay } from '../ui/hud';
import { picker } from '../ui/picker';
import { WORLD_IDS, WORLD_KEYS, world, worldId } from '../worlds/index';
import { byId } from '../util/dom';

addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'Backspace') e.preventDefault();
  // Held keys repeat only where that means something: sweeping the sun.
  if (e.repeat && e.code !== 'BracketLeft' && e.code !== 'BracketRight') { keys[e.code] = true; return; }
  sound.unlock();
  // Any key is the demo's cue to hand back the controls — except the
  // one that started it.
  if (e.code !== 'Digit0' && demo.on) demo.stop();
  if (picker.key(e.code)) { e.preventDefault(); return; }
  keys[e.code] = true;
  press(e.code);
});
addEventListener('keyup', (e) => { keys[e.code] = false; });

// What a key does once, when it goes down. The gamepad and the touch
// controls press the same codes.
function press(code: string) {
  if (code === 'Digit0') { demo.toggle(); return; }
  if (code === 'KeyM') note(sound.toggleMute() ? 'SOUND OFF' : 'SOUND ON');
  if (code === 'KeyQ') note('QUALITY ' + quality.cycle());
  // At full resolution: the governor may have lowered it, and a resize
  // has to happen before a frame is drawn, not after (render/quality.ts).
  if (code === 'KeyP') { quality.fullScale(); setPhotoPending(true); }
  if (code === 'KeyH') hud.classList.toggle('clean');
  if (code === 'KeyV') {
    setViewMotion(viewMotion === 'full' ? 'steady' : 'full');
    try { localStorage.setItem('viewMotion', viewMotion); } catch (err) { /* private window */ }
    note(viewMotion === 'full' ? 'VIEW: FULL HEAD MOTION' : 'VIEW: STEADY');
  }
  if (code === 'KeyL') {
    const url = location.href.split('#')[0] + '#' + pinView();
    if (navigator.clipboard) navigator.clipboard.writeText(url).then(() => note('LINK COPIED'), () => note(url));
    else note(url);
  }
  if (code === 'KeyG') {
    setGravity(player.gravity === world.g ? G_EARTH : world.g);
  }
  if (code === 'KeyF') setMode(mode === 'FLY' ? 'EVA' : 'FLY');
  if (code === 'KeyR') setMode(mode === 'ROVER' ? 'EVA' : 'ROVER');
  // The number row reaches the first twelve; with Shift, the rest.
  const pick = WORLD_KEYS.indexOf(code) + (keys.ShiftLeft || keys.ShiftRight ? WORLD_KEYS.length : 0);
  if (pick >= 0 && WORLD_KEYS.includes(code) && pick < WORLD_IDS.length) applyWorld(WORLD_IDS[pick]!);   // pick is in range by the tests before
  if (code === 'BracketLeft' || code === 'BracketRight') {
    // Below the horizon only where there is something to light the night.
    setSunElev(THREE.MathUtils.clamp(sunElev + (code === 'BracketRight' ? 0.035 : -0.035), world.night ? -1.35 : 0.045, 1.35));
    updateSunDir();
    updateSkyColors();
    el.s.textContent = (sunElev * 180 / Math.PI).toFixed(1) + '°';
  }
  // Previous and next world, for the pad's D-pad.
  if (code === 'WorldPrev' || code === 'WorldNext') {
    const i = WORLD_IDS.indexOf(worldId), n = WORLD_IDS.length;
    applyWorld(WORLD_IDS[(i + (code === 'WorldNext' ? 1 : n - 1)) % n]!);   // the world on screen is one of them, so i >= 0
  }
}

overlay.addEventListener('click', () => {
  sound.unlock();
  if (lastPointer === 'touch') { touchUI.start(); return; }
  renderer.domElement.requestPointerLock();
});
// Which kind of pointer tapped last: a finger gets touch controls.
let lastPointer = 'mouse';
addEventListener('pointerdown', (e) => { lastPointer = e.pointerType; }, true);
// Clicking the running demo takes it over.
renderer.domElement.addEventListener('click', () => {
  if (!demo.on) return;
  demo.stop();
  renderer.domElement.requestPointerLock();
});
byId('demoStart').addEventListener('click', (e) => {
  e.stopPropagation();
  sound.unlock();
  demo.start();
});
document.addEventListener('pointerlockchange', () => {
  hudState.locked = document.pointerLockElement === renderer.domElement;
  if (hudState.locked) { session.everStarted = true; overlay.classList.add('paused'); demo.stop(); }
  showOverlay(!hudState.locked && !demo.on);
});
document.addEventListener('mousemove', (e) => {
  if (!hudState.locked) return;
  // Slower through the long lens, so a pixel of mouse is still about
  // a pixel of view.
  const k = 0.0022 * camera.fov / FOV0;
  yawObj.rotation.y -= e.movementX * k;
  const lo = mode === 'ROVER' ? -1.25 : -Math.PI / 2 + 0.02;
  const hi = mode === 'ROVER' ? 0.35 : Math.PI / 2 - 0.02;
  pitchObj.rotation.x = THREE.MathUtils.clamp(pitchObj.rotation.x - e.movementY * k, lo, hi);
});
// Per pad, per button: whether it was down last frame (undefined: no such button).
const padPrev: (boolean | undefined)[][] = [];
// Button index to the key it presses; A (0) only holds, as Space.
const PAD_PRESS: Partial<Record<number, string | null>> = { 0: null, 2: 'KeyF', 3: 'KeyR', 8: 'KeyM', 9: 'Digit0', 11: 'KeyP', 12: 'BracketRight', 13: 'BracketLeft', 14: 'WorldPrev', 15: 'WorldNext' };
const dead = (v: number, d: number) => (Math.abs(v) < d ? 0 : Math.sign(v) * (Math.abs(v) - d) / (1 - d));
export function readInput(dt: number) {
  const k = keys;
  let fwd = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0);
  let side = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0);
  let run = !!(k.ShiftLeft || k.ShiftRight), jump = !!k.Space, down = !!k.KeyC, cap = 1, lx = 0, ly = 0, zoom = false;
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  for (const gp of pads) {
    if (!gp || !gp.connected || gp.mapping !== 'standard') continue;
    const b = (i: number) => gp.buttons[i] && gp.buttons[i].pressed;
    // A round dead zone on each stick, then the rest rescaled to full.
    // The standard mapping has four axes, so axes[0–3] are there.
    const m = Math.hypot(gp.axes[0]!, gp.axes[1]!), mk = dead(m, 0.15) / (m || 1);
    const r = Math.hypot(gp.axes[2]!, gp.axes[3]!), rk = dead(r, 0.12) / (r || 1);
    const pf = -gp.axes[1]! * mk, ps = gp.axes[0]! * mk;
    const trig = gp.buttons[7] ? gp.buttons[7].value : 0;
    let any = Math.abs(pf) + Math.abs(ps) + r * rk + trig > 0;
    if (Math.abs(pf) > Math.abs(fwd)) fwd = pf;
    if (Math.abs(ps) > Math.abs(side)) side = ps;
    lx += gp.axes[2]! * rk; ly += gp.axes[3]! * rk;
    if (b(4)) run = true;
    if (b(0)) jump = true;
    if (b(1)) down = true;
    if (b(5)) zoom = true;
    if (trig > 0.05) { jump = true; cap = Math.min(cap, trig); }
    // Buttons that do something once, on the way down.
    const prev = padPrev[gp.index] || (padPrev[gp.index] = []);
    for (let i = 0; i < gp.buttons.length; i++) {
      const now = b(i);
      if (now && !prev[i]) {
        any = true;
        sound.unlock();
        if (PAD_PRESS[i]) { if (PAD_PRESS[i] !== 'Digit0' && demo.on) demo.stop(); press(PAD_PRESS[i]!); }   // tested just before
      }
      prev[i] = now;
    }
    if (any && demo.on && !b(9)) demo.stop();
  }
  if (touch.on) {
    if (Math.abs(touch.fwd) > Math.abs(fwd)) fwd = touch.fwd;
    if (Math.abs(touch.side) > Math.abs(side)) side = touch.side;
    lx += touch.lookX; ly += touch.lookY;
    jump = jump || touch.jump; down = down || touch.down; zoom = zoom || touch.zoom;
  }
  input.fwd = THREE.MathUtils.clamp(fwd, -1, 1); input.side = THREE.MathUtils.clamp(side, -1, 1);
  input.run = run; input.jump = jump; input.down = down; input.pushCap = cap; input.zoom = zoom;
  input.lookX = lx; input.lookY = ly;
  // Look by rate from the right stick, slower through the long lens.
  if (lx || ly) {
    const kf = camera.fov / FOV0;
    yawObj.rotation.y -= lx * 2.4 * kf * dt;
    const lo = mode === 'ROVER' ? -1.25 : -Math.PI / 2 + 0.02, hi = mode === 'ROVER' ? 0.35 : Math.PI / 2 - 0.02;
    pitchObj.rotation.x = THREE.MathUtils.clamp(pitchObj.rotation.x - ly * 1.8 * kf * dt, lo, hi);
  }
}

/* ── Touch ──────────────────────────────────────────────────────
   There is no pointer lock on a phone or a tablet, so a tap on the
   opening screen starts touch controls instead: the left thumb puts
   a stick down wherever it lands, dragging anywhere else looks round,
   and buttons down the right do what SPACE, C, R, F and Z do. The
   menu button brings the opening screen back. */
const touchUI = (() => {
  const root = byId('touch');
  const stick = byId('t-stick'), knob = byId('t-knob');
  const R = 55;
  // Capture throws for a pointer the browser no longer counts as down.
  const capture = (t: Element, e: PointerEvent) => { try { t.setPointerCapture(e.pointerId); } catch (err) { /* already up */ } };
  let stickId: number | null = null, sx = 0, sy = 0, lookId: number | null = null, lx = 0, ly = 0;
  const hold = (id: string, key: 'jump' | 'down' | 'zoom') => {
    const b = byId(id);
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); capture(b, e); touch[key] = true; b.classList.add('on'); });
    const up = () => { touch[key] = false; b.classList.remove('on'); };
    b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up);
  };
  hold('t-jump', 'jump'); hold('t-down', 'down'); hold('t-zoom', 'zoom');
  const tap = (id: string, code: string) => byId(id).addEventListener('pointerdown', (e) => { e.preventDefault(); press(code); });
  tap('t-rover', 'KeyR'); tap('t-fly', 'KeyF');
  byId('t-menu').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    touch.on = false; root.hidden = true;
    showOverlay(true);
  });
  const cv = renderer.domElement;
  cv.addEventListener('pointerdown', (e) => {
    if (!touch.on || e.pointerType !== 'touch') return;
    if (e.clientX < innerWidth * 0.4 && stickId === null) {
      stickId = e.pointerId; sx = e.clientX; sy = e.clientY;
      stick.style.left = sx + 'px'; stick.style.top = sy + 'px'; stick.hidden = false;
      knob.style.transform = '';
    } else if (lookId === null) {
      lookId = e.pointerId; lx = e.clientX; ly = e.clientY;
    }
    capture(cv, e);
  });
  cv.addEventListener('pointermove', (e) => {
    if (e.pointerId === stickId) {
      let dx = e.clientX - sx, dy = e.clientY - sy;
      const d = Math.hypot(dx, dy);
      if (d > R) { dx *= R / d; dy *= R / d; }
      knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
      touch.side = dead(dx / R, 0.12); touch.fwd = dead(-dy / R, 0.12);
    } else if (e.pointerId === lookId) {
      const k = 0.005 * camera.fov / FOV0;
      yawObj.rotation.y -= (e.clientX - lx) * k;
      const lo = mode === 'ROVER' ? -1.25 : -Math.PI / 2 + 0.02, hi = mode === 'ROVER' ? 0.35 : Math.PI / 2 - 0.02;
      pitchObj.rotation.x = THREE.MathUtils.clamp(pitchObj.rotation.x - (e.clientY - ly) * k, lo, hi);
      lx = e.clientX; ly = e.clientY;
    }
  });
  const end = (e: PointerEvent) => {
    if (e.pointerId === stickId) { stickId = null; stick.hidden = true; touch.fwd = touch.side = 0; }
    if (e.pointerId === lookId) lookId = null;
  };
  cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  return {
    start() {
      touch.on = true; root.hidden = false;
      session.everStarted = true;
      overlay.classList.add('paused');
      if (demo.on) demo.stop();
      showOverlay(false);
      sound.unlock();
    },
  };
})();
