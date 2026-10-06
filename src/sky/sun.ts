import * as THREE from 'three';
import { clamp01, smoothT } from '../kernel/noise';
import { hdrSqueezeBuiltin } from '../render/hdr';
import { scene } from '../render/renderer';
import { EYE_TEX } from '../surface/hapke';

/* The sun: an HDR disc sized to its true angular diameter, which
   the bloom pass blows out, plus a glare sprite behind it. In vacuum
   there is no aureole — no air to scatter light around the disc — so
   what is left is what the eye and the visor do to a point source:
   a steep scattering core and a fringe of faint radial streaks. On
   Mars the same sprite is the dust's forward-scattered halo.
   0.53° from the Moon; 0.35° from Mars and its two moons, at 1.52
   AU, where the disc delivers 43% of the flux it does at Earth.
   Base geometry is the lunar size, scaled per world. */

/* Sky depth. The sun and the companions stand a few kilometres off,
   in for bodies hundreds of thousands of kilometres away, so by their
   true depth anything in the scene beyond them — a jet curtain, a
   plume, a far ridge — would hide behind them. These vertex lines move
   them into the last ten-thousandth of the far range, behind all of
   the scene out to 89 km, ordered among themselves by their stand-in
   distance (3–13 km), so a moon still crosses Jupiter's face and Saturn
   still covers the sun. The stars, further back still, cannot fit
   behind that: they are drawn first, and the companions after them in
   the transparent queue (renderOrder −1.5, before the curtain and
   plumes at −1). In the near range the companions lie past its far
   plane and stay clipped; the test keeps it so. `dist` is the
   vertex's distance from the camera. */
export const skyDepth = (dist: string) => `
  if ( gl_Position.z < gl_Position.w )
    gl_Position.z = gl_Position.w * ( 1.0 - 1e-4 * clamp( ( 13000.0 - ( ${dist} ) ) / 10000.0, 0.01, 1.0 ) );`;

export const SUN_R0 = 56;
export const sunDisc = new THREE.Mesh(
  new THREE.SphereGeometry(SUN_R0, 24, 16),
  new THREE.MeshBasicMaterial({ color: new THREE.Color(18, 16.8, 14.8), toneMapped: false, fog: false })
);
sunDisc.material.onBeforeCompile = (shader) => {
  shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>',
    '#include <project_vertex>' + skyDepth('length( mvPosition.xyz )'));
};
// Not squeezed (render/hdr.ts), alone of the opaque things: a disc a
// few pixels across is nearly all edge, and averaged squeezed, a pixel
// half covered by it comes out a hundred times too dark — the eye meters
// the sun as all but gone and opens by half. Unsqueezed it reads as
// bright as ever, which over black sky is all it has to be.
scene.add(sunDisc);

export const corona = (() => {
  const S = 256;
  const c = document.createElement('canvas'); c.width = c.height = S;
  const ctx = c.getContext('2d')!;   // a fresh canvas always has one
  const img = ctx.createImageData(S, S);
  let sd = 991; const rnd = () => (sd = (sd * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const spokes = Array.from({ length: 70 }, (): [number, number, number] => [rnd() * 6.2832, 0.25 + rnd() * 0.75, 0.003 + rnd() * 0.009]);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = (x + 0.5) / S - 0.5, dy = (y + 0.5) / S - 0.5;
      const r = Math.hypot(dx, dy) * 2, th = Math.atan2(dy, dx);
      // A narrow scattering core and a broader halo about a degree
      // wide, the way a bright point spreads in an eye.
      const core = Math.pow(1 + (r / 0.02) * (r / 0.02), -1.5) + 0.35 * Math.pow(1 + (r / 0.18) * (r / 0.18), -1.5);
      let st = 0;
      for (const [a, k, w] of spokes) {
        let d = Math.abs(th - a); d = Math.min(d, 6.2832 - d);
        st += k * Math.exp(-(d * d) / (w * w));
      }
      const fade = 1 - smoothT(clamp01((r - 0.7) / 0.3));
      const v = (core + st * 0.05 * Math.pow(1 - Math.min(r, 1), 3) * Math.min(1, r * 12)) * fade;
      // Stored as √v, squared again in the shader, so the faint
      // wings survive eight bits.
      const e = Math.sqrt(Math.min(v, 1)) * 255, i = (y * S + x) * 4;
      img.data[i] = e; img.data[i + 1] = e * 0.99; img.data[i + 2] = e * 0.975; img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const mat = new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(c), blending: THREE.AdditiveBlending,
    depthWrite: false, toneMapped: false, fog: false,
  });
  // Glare is set in what the eye sees, not in scene radiance: divided
  // back out of the exposure it is about to be multiplied by, so it
  // does not balloon when the eye opens or vanish when it closes.
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.tEye = EYE_TEX;
    shader.vertexShader = shader.vertexShader.replace('#include <logdepthbuf_vertex>',
      '#include <logdepthbuf_vertex>' + skyDepth('length( mvPosition.xyz )'));
    shader.fragmentShader = 'uniform sampler2D tEye;\n' + shader.fragmentShader
      .replace('#include <map_fragment>', 'vec4 gT = texture2D( map, vMapUv ); diffuseColor.rgb *= gT.rgb * gT.rgb;')
      .replace('#include <tonemapping_fragment>',
               'gl_FragColor.rgb *= exp2( -texture2D( tEye, vec2( 0.5 ) ).r );\n#include <tonemapping_fragment>');
  };
  const spr = new THREE.Sprite(hdrSqueezeBuiltin(mat));   // added to the squeezed frame
  spr.scale.set(3400, 3400, 1);
  scene.add(spr);
  return spr;
})();
