import * as THREE from 'three';
import { KEY_XZ, SUN_SHADOW } from '../render/lights';
import { SRC } from './glsl';

// Terrain horizon maps: four nested levels, written by terrain/shadows.ts and read
// by everything standing on the ground.
export const TS = {
  tsHz0: new THREE.Uniform<THREE.Texture | null>(null), tsHz1: new THREE.Uniform<THREE.Texture | null>(null),
  tsHz2: new THREE.Uniform<THREE.Texture | null>(null), tsHz3: new THREE.Uniform<THREE.Texture | null>(null),
  tsLv: { value: [0, 1, 2, 3].map(() => new THREE.Vector4(0, 0, 1, 0)) },   // (cx, cz, span, refY)
  tsSun: { value: new THREE.Vector4(0.28, 0.0046, 0, 0) },   // (tan elev, angular radius, on, –)
  sunXZ: { value: KEY_XZ },
};

// → glsl/terrain-shadow.glsl (GLSL.TS)

// The dust devils' shadows, written by effects/devils.ts and read, like
// the terrain's, by everything standing on the ground. The arrays hold
// DV_MAX entries (glsl/devil-shadow.glsl); dvN says how many are live.
export const DV_MAX = 6;
export const DV = {
  dvN: { value: 0 },
  dvA: { value: Array.from({ length: DV_MAX }, () => new THREE.Vector4()) },   // base x, y, z; height
  dvB: { value: Array.from({ length: DV_MAX }, () => new THREE.Vector4()) },   // radius, visible height, dust, lift
  dvWind: { value: new THREE.Vector2() },
};
// → glsl/devil-shape.glsl (GLSL.DEVIL_SHAPE), glsl/devil-shadow.glsl (GLSL.DEVIL_SHADOW)

// → glsl/hapke.glsl (GLSL.HAPKE)

// Ground only: texture bombing, the second relief octave, and the
// sub-metre craters.
// → glsl/ground.glsl (GLSL.GROUND)

// → glsl/ground-map.glsl (GLSL.GROUND_MAP)

// → glsl/ground-normal.glsl (GLSL.GROUND_NORMAL)

/* A sea of liquid methane, drawn by the ground under it. Wherever the
   terrain lies below the liquid's level (uLake.x, raw height, so the
   drawn level is that less the curvature drop), the eye looks at the
   liquid's surface first: the ray from the eye meets the level, part
   of the light is the sky reflected there — Fresnel for n = 1.28,
   1.5% straight down, nearly all of it at grazing — and the rest is
   the ground below, dimmed along the path through the liquid both
   ways, with a little light scattered in the liquid itself. No
   geometry: the lakebed is the terrain, and every pixel of the sea is
   a pixel of the floor under it. The surface is almost a mirror —
   Cassini found Titan's seas smooth to a millimetre most of the time
   (Zebker et al. 2014) — and wears a faint breath of capillary
   ripples that the wind of half a metre a second can raise. */
// → glsl/lake.glsl (GLSL.LAKE)
// → glsl/lake-surface.glsl (spliced into GLSL.GROUND_SPARKLE at // #lake-surface)

// → glsl/ground-sparkle.glsl (GLSL.GROUND_SPARKLE)

// The directional part of lights_fragment_begin, rewritten: the sun is
// directionalLights[0]; [1], when present, is the far shadow cascade
// and carries no light. Everything else in the chunk is r160's own.
export const LIGHTS_BEGIN = (() => {
  const src = THREE.ShaderChunk.lights_fragment_begin;
  const a = src.indexOf('#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )');
  const b = src.indexOf('#if ( NUM_RECT_AREA_LIGHTS > 0 )');
  if (a < 0 || b < a) throw new Error('lights_fragment_begin: layout changed');
  return src.slice(0, a) + `
#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )
  {
    float objShadow = 1.0;
    #if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 1
    if ( receiveShadow ) {
      vec4 c0 = vDirectionalShadowCoord[ 0 ];
      vec3 q0 = c0.xyz / c0.w;
      vec3 m0 = min( q0, 1.0 - q0 );
      float inNear = smoothstep( 0.0, 0.08, min( min( m0.x, m0.y ), m0.z ) );
      float sNear = 1.0, sFar = 1.0;
      if ( inNear > 0.0 ) sNear = getShadow( directionalShadowMap[ 0 ], directionalLightShadows[ 0 ].shadowMapSize, directionalLightShadows[ 0 ].shadowBias, directionalLightShadows[ 0 ].shadowRadius, c0 );
      if ( inNear < 1.0 ) sFar = getShadow( directionalShadowMap[ 1 ], directionalLightShadows[ 1 ].shadowMapSize, directionalLightShadows[ 1 ].shadowBias, directionalLightShadows[ 1 ].shadowRadius, vDirectionalShadowCoord[ 1 ] );
      objShadow = mix( sFar, sNear, inNear );
    }
    #elif defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
    if ( receiveShadow ) objShadow = getShadow( directionalShadowMap[ 0 ], directionalLightShadows[ 0 ].shadowMapSize, directionalLightShadows[ 0 ].shadowBias, directionalLightShadows[ 0 ].shadowRadius, vDirectionalShadowCoord[ 0 ] );
    #endif
    getDirectionalLightInfo( directionalLights[ 0 ], directLight );
    directLight.color *= objShadow * surfShadow;
    RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
  }
#endif
` + src.slice(b);
})();

/* Prints: the same Hapke function again, reading the undisturbed
   ground's parameters (gpk*), cut from GLSL_HAPKE so there is still
   one copy of the maths. */
// → glsl/hapke-ground-head.glsl (GLSL.HAPKE_GROUND)

/* A print's output is not a colour but a factor for the ground under
   it: the light pressed soil sends back (its Hapke set, on the relief
   normal), over what the ground around it sends (the ground's set, on
   the flat normal), under the same sun and shadow and the same
   ambient. Albedo is common to both and cancels, which is what lets
   the ground's own grain and tint show through; uStampK puts back the
   part of it that pressing does change. Blended as dst × src, so
   mixing toward white at the sole's edge fades it into the ground. */
// → glsl/print-blend.glsl (GLSL.PRINT_BLEND)

/* The GLSL snippets, read from SRC each time: compile-time reads see
   whatever the dev server last loaded (glsl/index.ts). */
export const GLSL = {
  get TS() { return '\n' + SRC.terrainShadow; },
  get DEVIL_SHAPE() { return '\n' + SRC.devilShape; },
  get DEVIL_SHADOW() { return '\n' + SRC.devilShadow; },
  get HAPKE() { return '\n' + SRC.hapke; },
  get GROUND() { return '\n' + SRC.ground; },
  get GROUND_MAP() { return '\n' + SRC.groundMap; },
  get GROUND_NORMAL() { return '\n' + SRC.groundNormal; },
  get LAKE() { return '\n' + SRC.lake; },
  // The sea's surface is drawn inside the tone-mapping patch, where the sparkle is.
  get GROUND_SPARKLE() { return '\n' + SRC.groundSparkle.replace('// #lake-surface\n', '\n' + SRC.lakeSurface); },
  get HAPKE_GROUND() {
    const h = '\n' + SRC.hapke;
    return '\n' + SRC.hapkeGroundHead + h.slice(h.indexOf('float hapkeR('), h.indexOf('void RE_Direct_Regolith'))
      .replace('hapkeR(', 'hapkeRG(').replace(/hpkA/g, 'gpkA').replace(/hpkB/g, 'gpkB');
  },
  get PRINT_BLEND() { return '\n' + SRC.printBlend; },
  get SUN_SHADOW() {
    return `\nconst float SUN_SH_RANGE = ${SUN_SHADOW.range.toFixed(1)}, SUN_SH_SPAN = ${SUN_SHADOW.span.toFixed(1)};\n` + SRC.sunShadow;
  },
};
