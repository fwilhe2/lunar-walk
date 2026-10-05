/* Entry point. Every module is listed here in the order the original
   single file ran them, so side effects — what is added to the scene,
   which passes the composer runs and in what order, which listeners
   are registered first — happen in that order too. */
import './style.css';
import './worlds/terrains';     // selects the Moon, so the kernel has a world from the start
import './terrain/anchor';
import './worlds/levels';
import './worlds/index';
import './render/renderer';
import './render/lights';
import './surface/regolith.pixels';
import './surface/regolith';
import './surface/hapke';
import './surface/shaders';
import './surface/patch';
import './surface/ground';
import './terrain/streamer';
import './terrain/shadows';
import './props/rocks';
import './props/landmark';
import './props/lander';
import './sky/stars';
import './sky/sun';
import './sky/dome';
import './sky/bodies/earth';
import './sky/bodies/mars';
import './sky/bodies/moonlets';
import './sky/bodies/jupiter.pixels';
import './sky/bodies/jupiter';
import './sky/bodies/galilean.pixels';
import './sky/bodies/galilean';
import './sky/bodies/charon.pixels';
import './sky/bodies/charon';
import './sky/bodies/pluto.pixels';
import './sky/bodies/pluto';
import './sky/bodies/neptune.pixels';
import './sky/bodies/neptune';
import './sky/bodies/uranus.pixels';
import './sky/bodies/uranus';
import './sky/bodies/saturn';
import './sky/bodies/venus';
import './sky/frames';
import './sky/companions';
import './effects/plumes';
import './effects/geysers';
import './effects/devils';
import './effects/curtains';
import './surface/stamps';
import './effects/dust';
import './render/post';
import './app/lighting';
import './render/sea';
import './render/quality';
import './vehicles/rover';
import './audio/sound';
import './player/constants';
import './player/gait';
import './player/effort';
import './player/player';
import './ui/hud';
import './player/input';
import './player/modes';
import './app/controls';
import './player/camera';
import './ui/compass';
import './app/view-hash';
import './app/loop';
import './player/physics';
import './player/body';
import './player/collision';
import './app/demo';
import './app/boot';
import './app/worlds';
import './ui/picker';

import { boot, bootShow, session } from './app/boot';
import { demo } from './app/demo';
import { frameHooks } from './app/hooks';
import { seaView } from './app/lighting';
import { clock, step } from './app/loop';
import { goTo } from './app/view-hash';
import { parseView } from './app/view-parse';
import { applyWorld, preparing } from './app/worlds';
import { CURVE_D02 } from './kernel/curvature';
import { CURVE_R } from './kernel/world';
import { photoPending, setPhotoPending, stepZoom, takePhoto } from './player/camera';
import { EYE } from './player/constants';
import { player } from './player/player';
import { composer, eyePass, gradePass } from './render/post';
import { quality } from './render/quality';
import { camera, renderer } from './render/renderer';
import { seaMirror } from './render/sea';
import { LAKE_U } from './surface/patch';
import { curveAX, curveAZ } from './terrain/anchor';
import { terrainShadows } from './terrain/shadows';
import { chunkStreamer } from './terrain/streamer';
import { hud, overlay, showOverlay } from './ui/hud';
import { world } from './worlds/index';

// ?probe=low|medium|high: tooling (tools/probe/) drives the page.
const probeTier = new URLSearchParams(location.search).get('probe');
if (probeTier !== null) await import('./app/probe').then((m) => m.install(probeTier || 'low'));

gradePass.uniforms.uRes.value.set(innerWidth, innerHeight);
let elapsed = 0, bootMax = 0;
// Opened from a shared link: that world, that place, that sun.
{
  const shared = parseView(location.hash);
  applyWorld(shared ? shared.w : 'moon');
  if (shared) goTo(shared);
}

renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  if (resizeDue) {
    resizeDue = false;
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    quality.resize();
  }
  if (preparing) { clock.getDelta(); return; }
  if (session.loading) {
    const left = chunkStreamer.pending();
    bootMax = Math.max(bootMax, left);
    bootShow(world.name, bootMax ? 1 - left / bootMax : 0, left > 0 ? 'generating surface · ' + left + ' sectors left' : 'done');
    chunkStreamer.update(player.pos.x, player.pos.z);
    if (left === 0) {
      session.loading = false;
      bootMax = 0;
      // Build every shadow level now, so the first frame has them.
      terrainShadows.update(player.pos.x, player.pos.z, player.pos.y - EYE, true);
      boot.hidden = true;
      hud.hidden = false;
      if (!session.everStarted) { overlay.hidden = false; hud.classList.add('lift'); }
      if (demo.on) showOverlay(false);
      clock.getDelta();
      quality.settle();
    }
    return;
  }
  elapsed += dt;
  gradePass.uniforms.uTime.value = elapsed;
  // The sea's level, in the frame the chunks are drawn in (surface/shaders.ts).
  LAKE_U.uLake.value.set(world.sea ?? 0, world.sea !== undefined ? 1 : 0, curveAX, curveAZ);
  LAKE_U.uLakeR.value.set(CURVE_R, CURVE_D02);
  LAKE_U.uLakeT.value = elapsed;
  eyePass.uniforms.uDt.value = dt;
  quality.tick();       // first: a resize after rendering blanks the frame
  stepZoom(dt);
  step(dt, elapsed);
  seaView();
  seaMirror.render();
  composer.render();
  frameHooks.afterRender?.();
  // In the same task as the drawing, while the canvas still holds it.
  if (photoPending) { setPhotoPending(false); takePhoto(); }
});

// Applied at the top of the next frame, not here: resizing the canvas
// clears it, and between this event and the next frame that would put
// an empty canvas on screen (render/quality.ts says the same of the governor).
let resizeDue = false;
addEventListener('resize', () => { resizeDue = true; });
