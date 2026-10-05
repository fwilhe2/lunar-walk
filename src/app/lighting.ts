import * as THREE from 'three';
import { session } from './boot';
import { KEY, KEY_DIR, KEY_XZ, SUN_DIR, SUN_XZ, ambLight, hemiLight, sun, sunElev } from '../render/lights';
import { eyePass } from '../render/post';
import { camera, scene } from '../render/renderer';
import { liveCompanions } from '../sky/companions';
import { skyDome } from '../sky/dome';
import { milkyWayMesh, starPoints } from '../sky/stars';
import { corona, sunDisc } from '../sky/sun';
import { GROUND_U, uSparkle } from '../surface/ground';
import { DEG } from '../surface/hapke';
import { LAKE_U } from '../surface/patch';
import { TS } from '../surface/shaders';
import { dropAt } from '../terrain/anchor';
import { terrainShadows } from '../terrain/shadows';
import { note } from '../ui/hud';
import { world } from '../worlds/index';

/* ── The sea's mirror ──────────────────────────────────────────
   A calm sea is a mirror, and what it mirrors most is the land around
   it: the far shore, the hills behind, the haze over them. So where
   the world has a sea, the terrain, the sky and the lander are drawn
   again each frame from the eye reflected in the sea's surface, at
   part resolution, into a texture the ground shader reads where it
   draws the liquid (surface/shaders.ts). Only layer 1 is drawn, which the chunks,
   the dome, the lander and the lights are on; the ground discards
   what lies under the surface, against the curved level, so a far
   shore that has dropped below the eye's level is still in it. */
/* Under the surface. With the eye below a sea's level the sky is gone
   — what is overhead is the surface, seen from beneath — and what is
   left is the liquid: clear, but browned by what is dissolved in it,
   so things fade into a murk at a few tens of metres, and the light
   coming down through it dims with depth. */
let underSea = false;
const _uw = new THREE.Vector3();
export function seaView() {
  camera.getWorldPosition(_uw);
  const lvl = world.sea === undefined ? -Infinity : world.sea - dropAt(_uw.x, _uw.z);
  const under = _uw.y < lvl && !!scene.fog;
  if (under) {
    const s = world.sky, depth = lvl - _uw.y;
    const k = 0.11 * Math.exp(-0.12 * depth);
    scene.fog.color.setRGB(s.horizon[0] * k, s.horizon[1] * k * 0.8, s.horizon[2] * k * 0.5, THREE.LinearSRGBColorSpace);
    (scene.fog as THREE.FogExp2).density = 0.045;
    (scene.background as THREE.Color).copy(scene.fog.color);
  }
  if (under !== underSea) {
    underSea = under;
    skyDome.mesh.visible = !under && !!world.sky;
    if (!under) {
      if (scene.fog) (scene.fog as THREE.FogExp2).density = world.fog.density;
      (scene.background as THREE.Color).setRGB(0, 0, 0);
      updateSkyColors();
    }
  }
}
const _keyC = new THREE.Vector3();
function updateKey() {
  const n = world.night, pri = liveCompanions[0];
  const rSun = Math.atan(world.sunSize / 12000);
  const wasNight = KEY.night, kx = KEY_XZ.x, kz = KEY_XZ.y;
  KEY.night = !!(n && pri && sunElev < -rSun);
  if (!KEY.night) {
    KEY_DIR.copy(SUN_DIR); KEY_XZ.copy(SUN_XZ);
    KEY.elev = sunElev; KEY.tan = Math.tan(sunElev); KEY.rad = rSun;
    // The share of the disc still over a level horizon.
    KEY.scale = THREE.MathUtils.smoothstep(sunElev, -rSun, rSun);
    KEY.U = 1;
    sun.color.set(world.sunColor);
  } else {
    const C = _keyC.copy(pri.userData.pos).normalize();
    KEY_DIR.copy(C);
    KEY_XZ.set(C.x, C.z).normalize();
    KEY.elev = Math.asin(C.y); KEY.tan = C.y / Math.max(1e-4, Math.hypot(C.x, C.z)); KEY.rad = n.radius;
    // A Lambert sphere lit by the sun, seen from phase angle a.
    const a = Math.acos(THREE.MathUtils.clamp(-SUN_DIR.dot(C), -1, 1));
    const phase = (Math.sin(a) + (Math.PI - a) * Math.cos(a)) / Math.PI;
    KEY.U = 1 / n.ratio;
    KEY.scale = n.ratio * phase * KEY.U;
    sun.color.set(n.color);
  }
  KEY.stars = KEY.night ? n.stars : 1;
  eyePass.uniforms.uKey.value = world.eye[0] * (KEY.night ? 0.25 : 1);
  sun.intensity = world.sunPower * KEY.scale;
  TS.tsSun.value.y = KEY.rad;
  sunDisc.visible = corona.visible = !world.noSun && sunElev > -rSun * 1.5;
  // Everything that shines by its own light, in the key's units.
  starPoints.material.uniforms.uGain.value = (world.starGain || 1) * KEY.stars;
  milkyWayMesh.material.opacity = Math.min(1, 0.34 * (world.starGain || 1) * KEY.stars);
  for (const g of liveCompanions) g.userData.bright.value = g.userData.bright0 * KEY.U;
  // Glints are the key's light, like the ground's.
  uSparkle.value = world.sparkle * KEY.scale;
  GROUND_U.rgMicro.value.z = KEY.night ? 0 : (world.micro[2] ?? 0.6);
  if (KEY.night !== wasNight) {
    eyePass.uniforms.uReset.value = 1;
    if (session.initialized && !session.loading) note(KEY.night ? 'NIGHT · ' + n.label : 'SUNRISE', true);
  }
  if (KEY_XZ.x !== kx || KEY_XZ.y !== kz) terrainShadows.invalidate();
}

export function updateSkyColors() {
  updateKey();
  // In vacuum the fill is bounce light off lit ground, so it rises
  // and falls with how much of the ground the key light is lighting.
  if (!world.air) {
    const k = THREE.MathUtils.clamp(Math.sin(KEY.elev) / Math.sin(16 * DEG), 0.15, 3.2);
    hemiLight.intensity = world.hemi[2] * k * KEY.scale;
    ambLight.intensity = world.amb[1] * KEY.scale;
  }
  const s = world.sky;
  // The companions read these too, so no sky means no air over them.
  skyDome.uniforms.uTau.value = s ? s.tau || 0 : 0;
  if (!s) { skyDome.uniforms.uGain.value = 0; return; }
  // Sky brightness follows how much lit dust is in the column, so
  // the dome deepens and darkens as the sun drops — and the haze
  // that fades the distance is the same dust, so the fog tracks it.
  // Pluto's haze stands 200 km up and stays sunlit after sunset — a
  // twilight glow, in night units far brighter than the ground — and
  // fades out over the first nine degrees of night.
  const gain = Math.max(0, 0.30 + 0.70 * Math.sin(sunElev)) * THREE.MathUtils.smoothstep(sunElev, -0.15, 0) * KEY.U;
  const lin = THREE.LinearSRGBColorSpace;
  skyDome.uniforms.uGain.value = gain;
  skyDome.uniforms.uK.value = s.k;
  skyDome.uniforms.uAmt.value = s.amt !== undefined ? s.amt : 0.9;
  // On Venus the sky is not a backdrop, it is the lamp: every photon
  // on the ground has been scattered on its way down, so when the
  // dome dims the ground has to dim with it. Mars keeps its lights
  // fixed, because there the direct beam still does most of the work.
  if (world.skyLit) {
    sun.intensity = world.sunPower * gain;
    hemiLight.intensity = world.hemi[2] * gain;
    ambLight.intensity = world.amb[1] * gain;
  }
  skyDome.uniforms.uZenith.value.setRGB(s.zenith[0], s.zenith[1], s.zenith[2], lin);
  skyDome.uniforms.uHorizon.value.setRGB(s.horizon[0], s.horizon[1], s.horizon[2], lin);
  skyDome.uniforms.uAureole.value.setRGB(s.aureole[0], s.aureole[1], s.aureole[2], lin);
  if (scene.fog) {
    scene.fog.color.setRGB(s.horizon[0] * gain, s.horizon[1] * gain, s.horizon[2] * gain, lin);
  }
  // Light scattered back out of a sea's body: the liquid is clear, so
  // a few per cent of the sky's, browned by what is dissolved in it.
  LAKE_U.uLakeIn.value.set(s.horizon[0] * gain * 0.05, s.horizon[1] * gain * 0.04, s.horizon[2] * gain * 0.025);
}
