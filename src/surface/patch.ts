import * as THREE from 'three';
import { skyDome } from '../sky/dome';
import { glslState } from './glsl';
import type { HapkeUniforms } from './hapke';
import { GLSL, LIGHTS_BEGIN, TS } from './shaders';
import type { Uniforms } from '../util/three';

/* Patch a MeshStandardMaterial into one of four kinds of surface:
     ground  — the terrain: Hapke, hex-tiled relief, micro-craters,
               grain shadows, the terrain shadow, glass sparkle
     print   — boot prints and wheel tracks: Hapke and terrain shadow,
               output as a factor multiplied into the ground (surface/stamps.ts)
     rock    — Hapke, and the terrain shadow seen from above the ground
     object  — anything man-made: its own PBR, plus the terrain shadow
   `hpk` is a hapkeUniforms() set, for the three regolith kinds.     */
export type SurfaceKind = 'ground' | 'print' | 'rock' | 'object';
export function surfacePatch(mat: THREE.MeshStandardMaterial, kind: SurfaceKind, hpk?: HapkeUniforms, extra?: Uniforms) {
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, TS);
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
      .replace('#include <common>', '#include <common>\n' + GLSL.TS + (kind === 'ground' ? GLSL.GROUND + skyDome.glsl + GLSL.LAKE : ''));
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
      shadow = 'float surfShadow = terrainShadow( vWPos, false ) * microLit;';
    } else {
      shadow = `float surfShadow = terrainShadow( vWPos, ${kind === 'rock' || kind === 'object'} );`;
    }
    let lights = LIGHTS_BEGIN;
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
