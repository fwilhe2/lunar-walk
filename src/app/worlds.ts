import * as THREE from 'three';
import { boot, bootShow, session } from './boot';
import { updateSkyColors } from './lighting';
import { sound } from '../audio/sound';
import { curtains } from '../effects/curtains';
import { devils } from '../effects/devils';
import { dust } from '../effects/dust';
import { geysers } from '../effects/geysers';
import { plumes } from '../effects/plumes';
import { terrainHeight } from '../kernel/terrain';
import { WORLD } from '../kernel/world';
import { EYE, JET, setFlyCeiling } from '../player/constants';
import { gait } from '../player/gait';
import { setGravity } from '../player/modes';
import { player, setModeRaw } from '../player/player';
import { lander } from '../props/lander';
import { landmark } from '../props/landmark';
import { rockSystem } from '../props/rocks';
import { ambLight, hemiLight, setSunElev, sun, sunElev, sunFar, updateSunDir } from '../render/lights';
import { bloomPass, eyePass } from '../render/post';
import { pitchObj, renderer, scene, yawObj } from '../render/renderer';
import { companionsAsync, setCompanions } from '../sky/companions';
import { skyDome } from '../sky/dome';
import { milkyWayMesh, starPoints } from '../sky/stars';
import { SUN_R0, corona, sunDisc } from '../sky/sun';
import { GROUND_U, groundHapke, groundMat, uSparkle } from '../surface/ground';
import { setHapke } from '../surface/hapke';
import { regolithAsync, regolithFor } from '../surface/regolith';
import { TS } from '../surface/shaders';
import { PRINT_U, printHapke, stampSystems } from '../surface/stamps';
import { setCurveAnchor } from '../terrain/anchor';
import { terrainShadows } from '../terrain/shadows';
import { chunkStreamer } from '../terrain/streamer';
import { el, hudState, updateKeysHelp } from '../ui/hud';
import { rover } from '../vehicles/rover';
import { VIEW, activateWorld, world, worldId, type WorldId } from '../worlds/index';
import { setWorld } from '../worlds/terrains';
import { byId } from '../util/dom';

/* Whatever shows which world is current registers here (the picker,
   src/ui/picker.ts), so switching worlds never has to know about it. */
export const worldUI: { select: (id: WorldId) => void; settled: () => Promise<void> } = {
  select: (id) => {},
  settled: () => Promise.resolve(),
};

/* Switching worlds is two steps. First what is costly the first time —
   the regolith set, in a worker, and the companions' maps, a body per
   task — while the loading screen shows and the page stays live; then
   applyWorldNow() swaps everything over at once. A later choice
   supersedes an earlier one still preparing. Resolves once applied. */
// done: set once the job is made, since its own callback checks for it.
interface PrepJob { id: WorldId; done?: Promise<void> }
export let preparing: PrepJob | null = null;
export function applyWorld(id: WorldId) {
  if (session.initialized && id === worldId && !preparing) return Promise.resolve();
  // Compares the job with an id, so it is never true: a second choice of
  // the world being prepared starts a new job. Left as it behaves;
  // `preparing?.id === id` is what it means.
  // @ts-expect-error -- a job never equals a WorldId
  if (preparing === id) return preparing.done;
  const job: PrepJob = preparing = { id };
  bootShow(VIEW[id].name, 0, 'preparing textures');
  boot.hidden = false;
  worldUI.select(id);
  job.done = Promise.all([regolithAsync(id), companionsAsync(VIEW[id].companions, worldUI.settled)]).then(() => new Promise<void>((resolve) => setTimeout(() => {
    if (preparing !== job) return;          // superseded: never resolves
    preparing = null;
    applyWorldNow(id);
    resolve();
  }, 20)));
  return job.done;
}

function applyWorldNow(id: WorldId) {
  if (session.initialized && id === worldId) return;
  session.initialized = true;
  activateWorld(id);
  setWorld(id);                    // the kernel: heights, craters, colour
  // Only a body with something to light its night keeps the sun down.
  if (!world.night && sunElev < 0.045) { setSunElev(0.045); updateSunDir(); }
  // You always arrive at the origin, whose anchor cell centre is
  // this. Set before anything is placed on the ground.
  setCurveAnchor(128, 128);

  // ── light
  sun.color.set(world.sunColor);
  sun.intensity = world.sunPower;
  hemiLight.color.set(world.hemi[0]);
  hemiLight.groundColor.set(world.hemi[1]);
  hemiLight.intensity = world.hemi[2];
  ambLight.color.set(world.amb[0]);
  ambLight.intensity = world.amb[1];
  renderer.toneMappingExposure = world.exposure;
  renderer.toneMapping = world.tone === 'aces' ? THREE.ACESFilmicToneMapping : THREE.AgXToneMapping;
  eyePass.uniforms.uKey.value = world.eye[0];
  eyePass.uniforms.uRange.value.set(world.eye[1], world.eye[2]);
  eyePass.uniforms.uReset.value = 1;
  bloomPass.strength = world.bloom[0];
  bloomPass.radius = world.bloom[1];
  bloomPass.threshold = world.bloom[2];

  // Venus has no sun in its sky and casts no shadow on its ground:
  // 20 km of cloud and 92 bar of gas scatter the disc out of
  // existence long before it reaches you, and what is left arrives
  // from the whole sky at once. Nobody standing on Venus has ever
  // seen where the sun is, and neither do you.
  sun.castShadow = world.shadows !== false;
  // Always together: three sorts shadow-casting lights first, and the
  // patched lighting reads the sun as directionalLights[0].
  sunFar.castShadow = sun.castShadow;
  sunDisc.visible = !world.noSun;
  corona.visible = !world.noSun;
  sunDisc.scale.setScalar(world.sunSize / SUN_R0);
  sunDisc.material.color.setRGB(world.sunHDR[0], world.sunHDR[1], world.sunHDR[2]);
  corona.scale.set(world.corona, world.corona, 1);
  corona.material.color.setRGB(world.coronaColor[0], world.coronaColor[1], world.coronaColor[2]);

  // ── sky
  milkyWayMesh.visible = !world.air;
  starPoints.visible = !world.air;
  starPoints.material.uniforms.uGain.value = world.starGain || 1;
  milkyWayMesh.material.opacity = 0.34 * (world.starGain || 1);
  skyDome.mesh.visible = !!world.sky;
  scene.fog = world.fog ? new THREE.FogExp2(0x000000, world.fog.density) : null;
  updateSkyColors();
  setCompanions(world.companions);
  plumes.set(world.plumes);
  geysers.set(world.geysers);
  devils.set(world.devils);
  curtains.set(!!world.curtain);

  // ── ground
  const rego = regolithFor(id);
  groundMat.map = rego.map;
  groundMat.normalMap = rego.normalMap;
  const hp = world.hapke;
  setHapke(groundHapke, hp);
  setHapke(printHapke, { ...hp, B0: hp.B0 * 0.3, Bc0: hp.Bc0 * 0.3 });
  // Rock is less porous than soil and rougher at the centimetre scale.
  setHapke(rockSystem.hapke, { ...hp, B0: hp.B0 * 0.5, Bc0: hp.Bc0 * 0.5, c: hp.c * 0.6, theta: hp.theta + 8 });
  GROUND_U.rgMean.value = rego.mean;
  GROUND_U.rgMeanC.value.copy(rego.meanC);
  GROUND_U.rgMicro.value.set(world.micro[0]!, world.micro[1]!, world.micro[2] ?? 0.6, 0);   // every row has at least two
  uSparkle.value = world.sparkle;
  // The soil colour that settles on rock tops: the regolith map's
  // mean, through the body's typical vertex albedo.
  {
    const c = new THREE.Color(world.soil || 0x55514c);
    rockSystem.soil.value.set(c.r, c.g, c.b, world.air ? 0.6 : 0.5);
  }
  // Terrain shadows: everywhere there is a sun to cast them, reaching
  // as far as the lowest sun could throw a shadow across this body —
  // on the big ones, to the edge of the clipmaps, since the rim of a
  // crater three kilometres deep shadows its floor from ten away. The
  // march steps grow with range, so the extra reach is a few steps.
  terrainShadows.reset(WORLD.R < 100000 ? 3000 : 16000, world.shadows !== false);
  TS.tsSun.value.w = world.shadows === false ? 0 : 1;
  dust.material.uniforms.color.value.set(world.dustColor);
  // Pressed soil against undisturbed soil, as an albedo ratio.
  const sc = new THREE.Color(world.stampColor), so = new THREE.Color(world.soil);
  PRINT_U.uStampK.value.setRGB(sc.r / so.r, sc.g / so.g, sc.b / so.b);
  for (const s of stampSystems) s.reset();
  // Whether the scene has fog is compiled into every program, so
  // every material in the scene needs a rebuild after that changes.
  scene.traverse((o) => {
    const m = (o as THREE.Mesh).material;   // undefined on what is not a mesh, which the test below skips
    if (Array.isArray(m)) m.forEach((x) => (x.needsUpdate = true));
    else if (m) m.needsUpdate = true;
  });

  // The key light last: it overrides the sun, sparkle and grain
  // shadows set above whenever it is night.
  updateSkyColors();
  sound.setWorld(world);

  // ── contents
  chunkStreamer.setWorld(id);
  rockSystem.reset();
  landmark(world.landmark, world.flagColor);
  lander.place();
  dust.clear();
  rover.despawn();

  // ── you
  setFlyCeiling(world.fly);
  setModeRaw('EVA');
  session.siteH = terrainHeight(0, 0);
  player.pos.set(0, session.siteH + EYE, 0);
  player.vel.set(0, 0, 0);
  player.onGround = true;
  player.crouch = 0; player.charge = 0; player.pushing = false; gait.reset(); player.lift = 0; player.eyeOff = 0;
  player.leanF = player.leanS = 0; player.pvx = player.pvz = 0;
  player.fall = null; player.fallAmt = 0; player.steadyY = null; player.smoothOff = 0;
  player.gas = JET.dv;
  yawObj.rotation.y = world.look ? world.look[0] : -0.95;
  pitchObj.rotation.x = world.look ? world.look[1] : 0;
  yawObj.position.copy(player.pos);
  setGravity(VIEW[id].g);

  // ── chrome
  el.mode.textContent = 'EVA';
  el.world.textContent = world.name;
  el.site.textContent = world.site;
  el.note.textContent = '';
  hudState.doseSv = 0;
  el.doseLine.hidden = !world.dose;
  if (world.dose) el.rate.textContent = world.dose + ' Sv/day';
  byId('p-title').textContent = world.title;
  byId('p-sub').textContent = world.sub;
  byId('p-fine').innerHTML = world.fine;
  worldUI.select(id);
  updateKeysHelp();

  session.loading = true;
  boot.hidden = false;
  chunkStreamer.update(0, 0);
  rockSystem.update(0, 0);
}
