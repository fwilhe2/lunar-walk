import * as THREE from 'three';
import { skyDome } from '../sky/dome';
import { glslState } from './glsl';
import type { HapkeUniforms } from './hapke';
import { DV, GLSL, LIGHTS_BEGIN, TS } from './shaders';
import { HDR_GLSL, HDR_U } from '../render/hdr';
import type { Uniforms } from '../util/three';

/* Patch a MeshStandardMaterial into one of four kinds of surface:
     ground  — the terrain: Hapke, hex-tiled relief, micro-craters,
               grain shadows, the terrain shadow, glass sparkle
     print   — boot prints and wheel tracks: Hapke and terrain shadow,
               output as a factor multiplied into the ground (surface/stamps.ts)
     rock    — Hapke, and the terrain shadow seen from above the ground
     object  — anything man-made: its own PBR, plus the terrain shadow
   All four take the dust devils' shadows (glsl/devil-shadow.glsl).
   `hpk` is a hapkeUniforms() set, for the three regolith kinds.     */
export type SurfaceKind = 'ground' | 'print' | 'rock' | 'object';
export function surfacePatch(mat: THREE.MeshStandardMaterial, kind: SurfaceKind, hpk?: HapkeUniforms, extra?: Uniforms) {
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, TS, DV);
    if (hpk) Object.assign(shader.uniforms, hpk);
    if (extra) Object.assign(shader.uniforms, extra);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        {
          vec4 wq = vec4( transformed, 1.0 );
          #ifdef USE_INSTANCING
            wq = instanceMatrix * wq;
          #endif
          vWPos = ( modelMatrix * wq ).xyz;
        }`);
    let fs = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + GLSL.TS + GLSL.DEVIL_SHAPE + GLSL.DEVIL_SHADOW + (kind === 'ground' ? GLSL.GROUND + skyDome.glsl + GLSL.LAKE : ''));
    // The sea reflects the sky through the dome's own function and
    // uniforms (sky/dome.ts), shared, not copied.
    if (kind === 'ground') Object.assign(shader.uniforms, skyDome.uniforms, LAKE_U);
    if (hpk) {
      fs = fs.replace('#include <lights_physical_pars_fragment>',
                      '#include <lights_physical_pars_fragment>\n' + GLSL.HAPKE
                      + (kind === 'print' ? GLSL.HAPKE_GROUND : ''));
    }
    let shadow;
    if (kind === 'ground') {
      fs = fs.replace('#include <map_fragment>', GLSL.GROUND_MAP)
             .replace('#include <normal_fragment_maps>', GLSL.GROUND_NORMAL)
             .replace('#include <tonemapping_fragment>', GLSL.GROUND_SPARKLE);
      shadow = 'float surfShadow = terrainShadow( vWPos, false ) * devilShadow( vWPos ) * microLit;';
    } else {
      shadow = `float surfShadow = terrainShadow( vWPos, ${kind === 'rock' || kind === 'object'} ) * devilShadow( vWPos );`;
    }
    let lights = LIGHTS_BEGIN;
    // The ground never draws into the shadow maps (render/lights.ts), so
    // it cannot shadow itself and needs no bias against acne. The bias
    // the rocks need, a centimetre along the beam plus one along the
    // normal, would at a low sun lift a rock's shadow centimetres off
    // its foot; and the near cascade is read through a filter as soft as
    // the sun's penumbra (glsl/sun-shadow.glsl), so the shadow starts at
    // the contact. Prints lie on the ground and take the same light.
    const nb = 'directionalLightShadows[ i ].shadowNormalBias';
    if (!THREE.ShaderChunk.shadowmap_vertex.includes(nb)) throw new Error('shadowmap_vertex: normal bias changed');
    // Rocks draw their sunward faces into the maps (props/rocks.ts), the
    // faces they are lit on, so they need more offset than back faces
    // would to keep off their own depth.
    if (kind === 'rock') {
      shader.vertexShader = shader.vertexShader
        .replace('#include <shadowmap_vertex>', THREE.ShaderChunk.shadowmap_vertex.replace(nb, `( ${nb} * 4.0 )`));
    }
    if (kind === 'ground' || kind === 'print') {
      shader.vertexShader = shader.vertexShader
        .replace('#include <shadowmap_vertex>', THREE.ShaderChunk.shadowmap_vertex.replace(nb, '0.0'));
      fs = fs.replace('#include <shadowmap_pars_fragment>', '#include <shadowmap_pars_fragment>\n#ifdef USE_SHADOWMAP' + GLSL.SUN_SHADOW + '\n#endif');
      const near = /getShadow\( directionalShadowMap\[ 0 \], directionalLightShadows\[ 0 \]\.shadowMapSize, directionalLightShadows\[ 0 \]\.shadowBias, directionalLightShadows\[ 0 \]\.shadowRadius, /g;
      if ((lights.match(near) ?? []).length !== 2) throw new Error('LIGHTS_BEGIN: near cascade lookup changed');
      lights = lights.replace(near, 'groundSunShadow( directionalShadowMap[ 0 ], directionalLightShadows[ 0 ].shadowMapSize, ')
                     .replace('directionalLightShadows[ 1 ].shadowBias', '0.0');
    }
    if (kind === 'print') {
      // Keep the sun's irradiance, shadowed, for the ratio.
      const at = 'directLight.color *= objShadow * surfShadow;';
      if (!lights.includes(at)) throw new Error('LIGHTS_BEGIN: sun line changed');
      lights = 'vec3 sunIrr = vec3( 0.0 );\n' + lights.replace(at, at + '\n    sunIrr = directLight.color;');
      // Fog pulls the factor toward 1, not toward the fog colour: the
      // ground under the print has been fogged already.
      fs = fs.replace('#include <opaque_fragment>', GLSL.PRINT_BLEND)
             .replace('#include <fog_fragment>', THREE.ShaderChunk.fog_fragment.replace('fogColor', 'vec3( 1.0 )'));
    }
    fs = fs.replace('#include <lights_fragment_begin>', shadow + '\n' + lights);
    if (kind === 'object') {
      // Specular antialiasing (Kaplanyan & Hoffman; Filament's form): where
      // the normal turns within a pixel — thin tubes, rounded edges — the
      // highlight is widened by that spread rather than left to land on
      // one pixel in one frame and the next in the next. three's own,
      // cruder term (geometryRoughness) is replaced, not added to.
      const at = 'material.roughness += geometryRoughness;';
      if (!THREE.ShaderChunk.lights_physical_fragment.includes(at)) throw new Error('lights_physical_fragment: roughness changed');
      fs = fs.replace('#include <lights_physical_fragment>', THREE.ShaderChunk.lights_physical_fragment.replace(at, `{
        vec3 du = dFdx( nonPerturbedNormal ), dv = dFdy( nonPerturbedNormal );
        float kernel = min( 0.3 * ( dot( du, du ) + dot( dv, dv ) ), 0.2 );
        material.roughness = sqrt( sqrt( saturate( pow2( pow2( material.roughness ) ) + kernel ) ) );
      }`));
    }
    // Squeezed for the resolve (render/hdr.ts), last of all. Not prints:
    // they are a factor on the ground, not a radiance.
    if (kind !== 'print') {
      Object.assign(shader.uniforms, HDR_U);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\n' + HDR_GLSL.vertexHead)
        .replace('#include <project_vertex>', '#include <project_vertex>' + HDR_GLSL.vertex);
      fs = fs.replace('#include <common>', '#include <common>\n' + HDR_GLSL.fragmentHead)
             .replace('#include <dithering_fragment>', '#include <dithering_fragment>' + HDR_GLSL.compress);
    }
    shader.fragmentShader = fs;
  };
  // The version changes when the GLSL files do (dev server only), and
  // with it the program three picks.
  mat.customProgramCacheKey = () => 'surface-' + kind + (glslState.version ? '-' + glslState.version : '');
  patched.push(mat);
  return mat;
}
const patched: THREE.MeshStandardMaterial[] = [];
glslState.listeners.push(() => { for (const m of patched) m.needsUpdate = true; });
export const LAKE_U = {
  uLake: { value: new THREE.Vector4(0, 0, 128, 128) },
  uLakeR: { value: new THREE.Vector2(1e9, 160000) },
  // Per metre: clear, but browned by dissolved organics — a guess; the
  // radar that saw the floor works at centimetres, not in the visible.
  uLakeAbs: { value: new THREE.Vector3(0.12, 0.085, 0.11) },
  uLakeIn: { value: new THREE.Vector3() },
  uLakeT: { value: 0 },
  // The mirror image (render/sea.ts): its texture, and world → its texture coords.
  uLakeMap: new THREE.Uniform<THREE.Texture | null>(null),
  uLakeMat: { value: new THREE.Matrix4() },
  uLakeMirror: { value: 0 },     // 1 while the mirror itself is drawn
  uLakeHave: { value: 0 },
};
