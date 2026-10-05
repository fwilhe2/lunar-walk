import * as THREE from 'three';
import { rockSystem } from '../props/rocks';
import { sunFar } from './lights';
import { bloomPass, composer, fxaaPass, gradePass } from './post';
import { ANISO, renderer, scene, setAniso } from './renderer';
import { groundMat } from '../surface/ground';
import { regoCache } from '../surface/regolith';
import { stampSystems } from '../surface/stamps';
import { terrainShadows } from '../terrain/shadows';
import { LOD_COARSE, chunkStreamer, setLodCoarse } from '../terrain/streamer';

/* ═════════════════════════════════════════════════════════════
   10b. QUALITY — three tiers, and a governor on resolution.

   Everything above is written for a discrete GPU. On an integrated
   one the costs that matter are per pixel and per byte moved, not
   per vertex: a HiDPI pixel ratio, 4× MSAA on a half-float target,
   16× anisotropic filtering across ground seen at grazing angles,
   three-way texture blending, soft shadow filtering, and thousands of
   pebbles drawn into two shadow maps. The tiers trade exactly those,
   and leave the things that make it look like the Moon — Hapke, the
   terrain shadows, the eye — on everywhere.

   On top of the tier, the internal resolution floats: it is measured
   once a second and lowered until the frame rate reaches the tier's
   target, then raised again when there is room. The canvas is scaled
   back up by the browser. It goes by the typical (median) frame, so
   the stall of a chunk arriving or a shadow rebuild — which no
   resolution would have prevented — does not send it hunting. And it
   changes the canvas only before a frame is drawn: resizing a canvas
   clears it, and a resize after drawing puts a black frame on screen.

   The tier is guessed from the GPU's name — Intel and the software
   rasterisers start on low — remembered once chosen, and cycled
   with Q.
   ═════════════════════════════════════════════════════════════ */
export const quality = (() => {
  const TIERS = {
    high:   { name: 'HIGH',   dpr: 2, msaa: 4, fxaa: false, bloom: true,  soft: true,  far: 2048, farEvery: 1,
              clip: 1024, gap: 350, cheap: false, aniso: 16, coarse: false, pebbles: 1,    pebbleShadow: true,  shapes: 99, lut: false, fps: 50, minScale: 0.6 },
    medium: { name: 'MEDIUM', dpr: 1, msaa: 2, fxaa: false, bloom: true,  soft: false, far: 1024, farEvery: 1,
              clip: 1024, gap: 350, cheap: false, aniso: 4,  coarse: false, pebbles: 0.7,  pebbleShadow: true,  shapes: 3,  lut: true,  fps: 34, minScale: 0.55 },
    low:    { name: 'LOW',    dpr: 1, msaa: 0, fxaa: true,  bloom: false, soft: false, far: 1024, farEvery: 2,
              clip: 512,  gap: 700, cheap: true,  aniso: 2,  coarse: true,  pebbles: 0.35, pebbleShadow: false, shapes: 2,  lut: true,  fps: 26, minScale: 0.5 },
  };
  const ORDER = ['high', 'medium', 'low'];
  const KEY = 'surfacewalk.quality';
  let id = 'high', T = TIERS.high, scale = 1;
  let frames = 0, t0 = performance.now(), fps = 0, lastChange = 0, farTick = 0, tPrev = 0;
  const gaps = [];     // frame intervals in the current second

  function detect() {
    try { const saved = localStorage.getItem(KEY); if (TIERS[saved]) return saved; } catch (e) { /* no storage */ }
    let name = '';
    try {
      const gl = renderer.getContext();
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      name = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    } catch (e) { /* unknown */ }
    if (/intel|uhd|iris|hd graphics|llvmpipe|softpipe|swiftshader|mali|adreno|powervr|videocore/i.test(name)) return 'low';
    if (/apple|radeon.*vega|radeon\(tm\) graphics/i.test(name)) return 'medium';
    return 'high';
  }

  function resolution() {
    const pr = Math.min(devicePixelRatio, T.dpr) * scale;
    renderer.setPixelRatio(pr);
    renderer.setSize(innerWidth, innerHeight, false);   // CSS sizes the canvas (#view)
    composer.setPixelRatio(pr);
    composer.setSize(innerWidth, innerHeight);
    const w = Math.floor(innerWidth * pr), h = Math.floor(innerHeight * pr);
    gradePass.uniforms.uRes.value.set(w, h);
    fxaaPass.uniforms.uInv.value.set(1 / w, 1 / h);
  }

  const setDefine = (m, key, on) => {
    m.defines = m.defines || {};
    if (!!on === (key in m.defines)) return;
    if (on) m.defines[key] = ''; else delete m.defines[key];
    m.needsUpdate = true;
  };
  const sizeShadow = (light, n) => {
    if (light.shadow.mapSize.x === n) return;
    light.shadow.mapSize.set(n, n);
    if (light.shadow.map) { light.shadow.map.dispose(); light.shadow.map = null; }
  };

  function set(next, remember = true) {
    id = next; T = TIERS[id];
    try { if (remember) localStorage.setItem(KEY, id); } catch (e) { /* no storage */ }
    // Anti-aliasing: MSAA on the scene target, or FXAA at the end.
    for (const r of [composer.renderTarget1, composer.renderTarget2]) {
      if (r.samples !== T.msaa) { r.samples = T.msaa; r.dispose(); }
    }
    fxaaPass.enabled = T.fxaa;
    bloomPass.enabled = T.bloom;
    // Shadows. The near cascade keeps its 2048² everywhere: it is what
    // keeps a rock's shadow attached to the rock.
    const type = T.soft ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    const retype = renderer.shadowMap.type !== type;
    renderer.shadowMap.type = type;
    sizeShadow(sunFar, T.far);
    sunFar.shadow.autoUpdate = T.farEvery === 1;
    sunFar.shadow.needsUpdate = true;     // a resized map is empty until drawn
    terrainShadows.configure(T.clip, T.gap);
    // Surfaces.
    setAniso(Math.min(T.aniso, renderer.capabilities.getMaxAnisotropy()));
    for (const m of regoCache.values()) {
      for (const t of [m.map, m.normalMap]) { t.anisotropy = ANISO; t.needsUpdate = true; }
    }
    setDefine(groundMat, 'RG_CHEAP', T.cheap);
    for (const m of [groundMat, rockSystem.material, ...stampSystems.map((st) => st.material)]) setDefine(m, 'HPK_LUT', T.lut);
    setDefine(rockSystem.material, 'RK_CHEAP', T.cheap);
    // Geometry.
    if (LOD_COARSE !== T.coarse) { setLodCoarse(T.coarse); chunkStreamer.refresh(); }
    rockSystem.setDetail(T.pebbles, T.pebbleShadow, T.shapes);
    if (retype) scene.traverse((o) => { if ((o as any).material) (o as any).material.needsUpdate = true; });
    scale = 1;
    resolution();
    restart();
  }

  function restart() {
    frames = 0; t0 = performance.now(); lastChange = t0;
    tPrev = 0; gaps.length = 0;
  }

  return {
    get id() { return id; },
    get fps() { return fps; },
    get scale() { return scale; },
    get label() { return T.name; },
    auto: true,               // the resolution governor; off only for measuring
    init() { set(detect()); },
    set,                      // set(id, false) does not overwrite the remembered tier
    cycle() { set(ORDER[(ORDER.indexOf(id) + 1) % ORDER.length]); return T.name; },
    resize() { resolution(); },
    fullScale() { if (scale !== 1) { scale = 1; resolution(); restart(); } },
    // Once per frame, before anything is drawn: it may resize the canvas.
    tick() {
      // Only ever a request; three clears it once the map is drawn.
      if (T.farEvery > 1 && farTick++ % T.farEvery === 0) sunFar.shadow.needsUpdate = true;
      frames++;
      const now = performance.now();
      if (tPrev) gaps.push(now - tPrev);
      tPrev = now;
      if (now - t0 < 1000) return;
      fps = frames * 1000 / (now - t0);
      gaps.sort((a, b) => a - b);
      const typical = gaps.length ? 1000 / gaps[gaps.length >> 1] : fps;
      frames = 0; t0 = now; gaps.length = 0;
      if (!this.auto || now - lastChange < 2000 || document.hidden) return;
      // Pixel cost goes as scale², so the square root of the shortfall
      // is the step that should about close it.
      let next = scale;
      if (typical < T.fps * 0.9) next = Math.max(T.minScale, scale * Math.max(0.75, Math.sqrt(typical / T.fps)));
      else if (typical > T.fps * 1.3 && scale < 1) next = Math.min(1, scale * 1.1);
      if (Math.abs(next - scale) > 0.02) { scale = next; resolution(); lastChange = now; }
    },
    // After a stall that is not the renderer's fault — a world load.
    settle: restart,
  };
})();
quality.init();
