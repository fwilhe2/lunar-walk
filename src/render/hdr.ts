import * as THREE from 'three';

/* ═════════════════════════════════════════════════════════════
   TONE-MAPPED RESOLVE — so MSAA works on bright edges.

   MSAA averages a pixel's samples in the scene's linear HDR, before
   the eye's exposure (render/post.ts). A sunlit surface exposes to
   several units; a quarter of one still comes out above 1, white, and
   an edge against black sky or shadow gets no intermediate tones at
   all — thin bright parts (the rover's struts, the lit lip of a box)
   break up into dashes and crawl as you move.

   So the surfaces write c / (1 + K·max(c)) into the multisampled
   target (Karis), which bounds every sample below 1/K, and after the
   resolve the passes that read the frame undo it, c = y / (1 − K·max(y)).
   With K the eye's exposure the averaging happens on something close
   to what the eye sees. K need not match the exposure exactly, only
   be the same on both sides of the resolve, so it is last frame's
   adapted exposure: eyePass ping-pongs between two 1×1 targets, and
   the one it wrote last frame is only read in this one. Materials
   fetch it once per vertex (a flat varying, no fragment sampler);
   the passes fetch the same texel. Reading it back to the CPU instead,
   even through a fenced pixel-pack buffer, made Chrome read
   synchronously on every frame.

   uHdrOn = 0 is the identity on both sides, for anything that renders
   the scene into a target of its own (render/sea.ts), whose image the
   ground reads as plain radiance. */
export const HDR_U = {
  tHdrK: new THREE.Uniform<THREE.Texture | null>(null),
  uHdrOn: new THREE.Uniform(1),
};

export const hdr = { enabled: true };

const K = 'uHdrOn * exp2( texture2D( tHdrK, vec2( 0.5 ) ).r )';
export const HDR_GLSL = {
  // For a material: K per vertex, then squeeze gl_FragColor at the very end.
  vertexHead: 'uniform sampler2D tHdrK;\nuniform float uHdrOn;\nflat varying float vHdrK;\n',
  vertex: `\n  vHdrK = ${K};`,
  fragmentHead: 'flat varying float vHdrK;\n',
  compress: `
    gl_FragColor.rgb /= 1.0 + vHdrK * max( max( max( gl_FragColor.r, gl_FragColor.g ), gl_FragColor.b ), 0.0 );`,
  // For a pass that reads the resolved frame. Saturates at 50 times
  // 1/K, far past the 6 the exposure is clamped at.
  decode: `
    uniform sampler2D tHdrK;
    uniform float uHdrOn;
    float hdrK() { return ${K}; }
    vec3 hdrDecode( vec3 y, float k ) {
      return y / ( 1.0 - min( k * max( max( y.r, y.g ), y.b ), 0.98 ) );
    }`,
};

// Squeeze an opaque ShaderMaterial: K at the end of its vertex stage,
// the squeeze at the end of its fragment stage.
export function hdrSqueeze(mat: THREE.ShaderMaterial) {
  Object.assign(mat.uniforms, HDR_U);
  const end = /\}\s*$/;
  if (!end.test(mat.vertexShader) || !end.test(mat.fragmentShader)) throw new Error('hdrSqueeze: no main() at the end');
  mat.vertexShader = HDR_GLSL.vertexHead + mat.vertexShader.replace(end, HDR_GLSL.vertex + '\n}');
  mat.fragmentShader = HDR_GLSL.fragmentHead + mat.fragmentShader.replace(end, HDR_GLSL.compress + '\n}');
  return mat;
}
