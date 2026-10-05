import * as THREE from 'three';
import { scene } from './renderer';

/* Sun. Azimuth is fixed; elevation is adjustable, because shadow
   length is most of what makes lunar terrain readable. It sits off
   to the left of the opening view, so shadows rake across the
   ground instead of hiding behind everything that casts them. */
export const SUN_AZ = Math.atan2(-0.33, -0.90);
export let sunElev = 0.283;   // ~16°, low morning sun
export const SUN_DIR = new THREE.Vector3();
export function updateSunDir() {
  const c = Math.cos(sunElev);
  SUN_DIR.set(Math.cos(SUN_AZ) * c, Math.sin(sunElev), Math.sin(SUN_AZ) * c).normalize();
}
updateSunDir();

// On an airless body sunlight is white — nothing reddens it on the
// way in. On Mars it arrives through two scale heights of suspended
// dust, which takes about half of it and warms what is left.
export const sun = new THREE.DirectionalLight(0xfff8f2, 3.4);

/* Shadow maps are for objects only — rocks, the rover, the flag. The
   ground shadows itself through the horizon maps in terrain/shadows.ts, at every
   range, so it never renders into these.

   Two cascades. The sun is half a degree across, so the penumbra
   behind a boulder is a centimetre wide and a rock's shadow starts
   exactly where the rock meets the ground: anything coarser, or any
   depth bias of more than a centimetre or so, lifts the shadow away
   from its caster and the rock reads as floating. So the near
   cascade is ±24 m at 2.3 cm a texel, with a depth range kept tight
   enough that its bias works out at about a centimetre, and a second,
   coarse one carries shadows out to 130 m. The second light only
   exists to own that shadow map: it has no intensity, and the patched
   lighting in surface/patch.ts picks between the two maps per fragment. */
const SHADOW_NEAR = 24, SHADOW_FAR = 130;
function shadowRig(light, half, dist, depth, bias, nBias) {
  light.castShadow = true;
  light.shadow.mapSize.set(2048, 2048);
  const c = light.shadow.camera;
  c.left = -half; c.right = half; c.top = half; c.bottom = -half;
  c.near = dist - depth; c.far = dist + depth;
  light.shadow.bias = bias;
  light.shadow.normalBias = nBias;
  light.userData.dist = dist;
}
shadowRig(sun, SHADOW_NEAR, 90, 70, -0.00008, 0.012);
export const sunFar = new THREE.DirectionalLight(0xffffff, 0);
shadowRig(sunFar, SHADOW_FAR, 300, 260, -0.00012, 0.05);
scene.add(sun, sun.target, sunFar, sunFar.target);

/* Fill light. In vacuum there is no sky to light a shadow, so what
   reaches one is light bounced off whatever sunlit ground can see
   into it — a crater's lit far wall, the plain around a boulder —
   plus a trace of planetshine. That is modelled as a hemisphere:
   downward-facing surfaces see sunlit regolith, upward-facing ones
   see almost nothing. On the airless bodies it scales with how much
   ground the sun is actually lighting (updateSkyColors). On Mars the
   sky itself is the fill, and it is bright: dust scatters a large
   fraction of the beam back down, which is why a Martian shadow is a
   soft tan and a lunar one is black. */
export const hemiLight = new THREE.HemisphereLight(0x0a0d14, 0x67645f, 0.36);
export const ambLight = new THREE.AmbientLight(0x232634, 0.14);
// Lights count only for cameras that share a layer with them, and the
// sea's mirror (render/sea.ts) looks at layer 1 alone.
for (const l of [sun, sunFar, hemiLight, ambLight]) l.layers.enable(1);
scene.add(hemiLight, ambLight);

// The sun's azimuth as a unit vector in the ground plane.
export const SUN_XZ = new THREE.Vector2(Math.cos(SUN_AZ), Math.sin(SUN_AZ));

/* The key light: the sun by day and, by night on the bodies that
   have one, the primary hanging overhead (updateKey, app/lighting.ts). What
   shades by direction reads these — the light and its shadow maps,
   the terrain horizon maps, the micro-craters in the ground — while
   the sun keeps SUN_DIR for phases and the sky. The regolith map's
   baked micro-horizon points at the sun's azimuth, so it is switched
   off under a planet. */
export const KEY_DIR = SUN_DIR.clone();
export const KEY_XZ = SUN_XZ.clone();

/* ── The key light ──────────────────────────────────────────────
   By day it is the sun, fading out across its own disc as it sets.
   By night, on the bodies with a primary overhead, it is that
   primary's reflected sunlight: full Earth from the Moon is about
   1/4000 of the sun, Mars from Phobos 2%, Jupiter from Europa 0.6%,
   Pluto from Charon 0.2%, Charon from Pluto 0.04% — geometric albedo
   times the square of the sine of the angular radius, times the
   phase. A locked moon's primary never moves, so the terrain horizon
   maps are marched toward it once, at sunset, and hold all night; and
   it is a disc, not a point, so its shadows are soft — from Phobos,
   where Mars is 42° across, barely shadows at all.

   A four-thousandth of the day's light would put the ground far
   below what the renderer resolves cleanly — the eye opening up to it
   magnifies the ±½/255 dithering in the HDR target into coloured
   speckle (the light-units note in CLAUDE.md). So night is drawn in
   units of its own: the key keeps the sun's intensity, times the
   phase, and what the sun lights directly — the companions, the haze —
   is raised by U, the inverse of the planetshine ratio, so everything
   keeps its true brightness relative to the ground. The eye's key is
   lowered instead, so night reads as night with the exposure going
   down, not up; and it is snapped to the new units when they change.
   Stars are the exception: their gain was set for visibility with the
   eye wide open by day, not physically, so each body gives its own
   night factor for them, a faint Milky Way under a full Earth and a
   strong one under Charon, whose nights are thirty times darker. */
export const KEY = { night: false, tan: 0.29, rad: 0.0046, elev: 0.28, scale: 1, U: 1, stars: 1 };

export function setSunElev(v) { return (sunElev = v); }
