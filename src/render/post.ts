import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { FullScreenQuad, Pass } from 'three/examples/jsm/postprocessing/Pass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { camera, renderer, scene } from './renderer';
import { EYE_TEX } from '../surface/hapke';

/* ═════════════════════════════════════════════════════════════
   10. POST — eye adaptation, HDR bloom, then a mild visor grade.

   Regolith under a low sun spans a range no fixed exposure holds:
   Hapke puts the down-sun ground five times brighter than the same
   ground across the sun, and the inside of a crater's shadow fifty
   times darker. An eye copes by adapting, and so does this.

   Metering is luminance-weighted — the mean of L weighted by L —
   which tracks the brightest *surface* in view rather than the
   average pixel: half a frame of black sky does not drag the
   exposure up while there is ground in it, which is how vision
   behaves out there and a camera's averaging meter does not. The
   sun is clipped before it is metered, so glancing past it does not
   black out the world. When there is no lit ground in view at all —
   looking up into the black, or standing in the bottom of a crater's
   shadow — the eye dark-adapts, slowly and only so far, and that is
   the only time the stars come out. Astronauts said exactly this:
   no stars from the sunlit surface, a few from inside a shadow.

   The meter and the adapted state never leave the GPU: a mipmapped
   128×64 target reduces the frame, and a pair of 1×1 targets
   ping-pong the adaptation from frame to frame.
   ═════════════════════════════════════════════════════════════ */
const rt = new THREE.WebGLRenderTarget(innerWidth, innerHeight, {
  type: THREE.HalfFloatType, samples: 4,
});
export const composer = new EffectComposer(renderer, rt);

/* ── Depth in two ranges ────────────────────────────────────────
   The view runs from a boot 5 cm under the eye to a horizon 90 km
   off, and one 24-bit depth buffer cannot hold that: precision
   falls with the square of distance, to ~20 m at 4 km and ~120 m at
   10 km. That is coarser than the few metres that separated the
   terrain levels where they used to overlap (§5), and than the relief
   of a distant slope, so which surface won was decided by rounding,
   and changed with every step you took — ridges shimmered as you moved.

   So the scene is drawn twice into the same target: first
   everything past DEPTH_SPLIT with the near plane pushed out to
   it, then the depth is cleared and everything nearer is drawn
   with the real near plane and the far plane pulled in. Each range
   gets the whole buffer — millimetres at a kilometre, a metre at
   the far edge — and near precision is what it always was. The
   ranges overlap by 2% so no seam can open between them; nothing
   drawn additively lives out there to be counted twice. Frustum
   culling does the sorting, so each chunk is drawn about once.

   The sun's shadow maps do not depend on the main camera, so they
   are rendered for the first range only. This is used instead of a
   logarithmic depth buffer, which would need every ShaderMaterial
   patched, would break the prints' polygonOffset, and would cost
   early-z under the ground shader on exactly the GPUs §10b is for. */
const DEPTH_SPLIT = 400;
class SplitRenderPass extends RenderPass {
  render(renderer, writeBuffer, readBuffer) {
    const cam = this.camera, near = cam.near, far = cam.far;
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = true;

    cam.near = DEPTH_SPLIT * 0.98;
    cam.updateProjectionMatrix();
    super.render(renderer, writeBuffer, readBuffer);

    cam.near = near;
    cam.far = DEPTH_SPLIT;
    cam.updateProjectionMatrix();
    renderer.setRenderTarget(this.renderToScreen ? null : readBuffer);
    renderer.clearDepth();
    // A colour background makes three clear on every render call,
    // whatever autoClear says — it would wipe the far range.
    const bg = this.scene.background;
    this.scene.background = null;
    this.clear = false;
    super.render(renderer, writeBuffer, readBuffer);
    this.clear = true;
    this.scene.background = bg;

    cam.far = far;
    cam.updateProjectionMatrix();
  }
}
composer.addPass(new SplitRenderPass(scene, camera));

export const eyePass = (() => {
  const meterRT = new THREE.WebGLRenderTarget(128, 64, {
    type: THREE.HalfFloatType, depthBuffer: false, generateMipmaps: true,
    minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter,
  });
  const adapt = [0, 1].map(() => new THREE.WebGLRenderTarget(1, 1, {
    type: THREE.HalfFloatType, depthBuffer: false,
    minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter,
  }));
  const vs = `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }`;
  const meter = new FullScreenQuad(new THREE.ShaderMaterial({
    uniforms: { tSrc: { value: null }, uClip: { value: 0.3 } },
    vertexShader: vs,
    fragmentShader: `
      uniform sampler2D tSrc;
      uniform float uClip;
      varying vec2 vUv;
      void main() {
        // Four taps per meter texel, offset a quarter-texel each way.
        vec2 o = vec2( 0.25 / 128.0, 0.25 / 64.0 );
        vec3 c = texture2D( tSrc, vUv + vec2( -o.x, -o.y ) ).rgb + texture2D( tSrc, vUv + vec2( o.x, -o.y ) ).rgb
               + texture2D( tSrc, vUv + vec2( -o.x, o.y ) ).rgb + texture2D( tSrc, vUv + vec2( o.x, o.y ) ).rgb;
        float L = min( dot( c * 0.25, vec3( 0.2126, 0.7152, 0.0722 ) ), uClip );
        // Centre-weighted: what you are looking at counts for more.
        vec2 d = ( vUv - 0.5 ) * vec2( 1.5, 1.0 );
        float w = exp( -dot( d, d ) * 2.5 );
        gl_FragColor = vec4( w * L, w * L * L, w, 1.0 );
      }`,
  }));
  const adaptU = {
    tMeter: { value: meterRT.texture }, tPrev: { value: null },
    uKey: { value: 0.16 }, uRange: { value: new THREE.Vector2(0.5, 150) },
    uDt: { value: 0.016 }, uReset: { value: 1 },
  };
  const adaptQ = new FullScreenQuad(new THREE.ShaderMaterial({
    uniforms: adaptU, vertexShader: vs,
    fragmentShader: `
      uniform sampler2D tMeter, tPrev;
      uniform float uKey, uDt, uReset;
      uniform vec2 uRange;
      void main() {
        vec4 m = textureLod( tMeter, vec2( 0.5 ), 12.0 );
        float Lw = m.y / max( m.x, 1e-9 );
        float target = clamp( log2( uKey / max( Lw, 1e-7 ) ), log2( uRange.x ), log2( uRange.y ) );
        float prev = texture2D( tPrev, vec2( 0.5 ) ).r;
        // Light adaptation is quick, dark adaptation slow.
        float rate = target > prev ? 0.45 : 2.2;
        float v = uReset > 0.5 ? target : mix( prev, target, 1.0 - exp( -uDt * rate ) );
        gl_FragColor = vec4( v, 0.0, 0.0, 1.0 );
      }`,
  }));
  // Apply it: the frame, scaled by the adapted exposure.
  const expose = new FullScreenQuad(new THREE.ShaderMaterial({
    uniforms: { tSrc: { value: null }, tEye: { value: null } },
    vertexShader: vs,
    fragmentShader: `
      uniform sampler2D tSrc, tEye;
      varying vec2 vUv;
      void main() {
        // Clamped, so the sun's disc — a million times brighter than
        // the ground it lights — feeds the bloom the same small glow
        // at every adaptation. The bloom blur is truncated at one sigma
        // and draws its kernel as a box around anything much brighter;
        // the wide, round glare is the sprite in §7.
        vec3 c = texture2D( tSrc, vUv ).rgb * exp2( texture2D( tEye, vec2( 0.5 ) ).r );
        gl_FragColor = vec4( min( c, vec3( 6.0 ) ), 1.0 );
      }`,
    depthTest: false, depthWrite: false,
  }));
  let cur = 0;
  const pass = new Pass();
  pass.uniforms = adaptU;
  pass.render = (renderer, writeBuffer, readBuffer) => {
    meter.material.uniforms.tSrc.value = readBuffer.texture;
    renderer.setRenderTarget(meterRT);
    meter.render(renderer);
    adaptU.tPrev.value = adapt[cur].texture;
    cur = 1 - cur;
    renderer.setRenderTarget(adapt[cur]);
    adaptQ.render(renderer);
    adaptU.uReset.value = 0;
    EYE_TEX.value = adapt[cur].texture;
    // With no bloom after it, exposure can ride along in the grade pass
    // and save a full-resolution read and write — which is most of what
    // a pass costs on an integrated GPU.
    const inGrade = !bloomPass.enabled;
    pass.needsSwap = !inGrade;
    gradePass.uniforms.uExpose.value = inGrade ? 1 : 0;
    // ShaderPass cloned its uniforms, so it gets the texture directly.
    gradePass.uniforms.tEye.value = adapt[cur].texture;
    if (inGrade) return;
    expose.material.uniforms.tSrc.value = readBuffer.texture;
    expose.material.uniforms.tEye.value = adapt[cur].texture;
    renderer.setRenderTarget(writeBuffer);
    expose.render(renderer);
  };
  pass.readback = () => {    // for tuning only
    const b = new Uint16Array(4);
    renderer.readRenderTargetPixels(adapt[cur], 0, 0, 1, 1, b);
    return Math.pow(2, THREE.DataUtils.fromHalfFloat(b[0]));
  };
  return pass;
})();
composer.addPass(eyePass);

// Bloom runs on the adapted frame, so its threshold is in what the
// eye sees: set well above anything a lit surface reaches, so only
// the sun blooms — Earth, and Mars filling half of Phobos's sky,
// stay discs with features on them rather than glowing smudges.
export const bloomPass = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.55, 0.65, 3.0);
composer.addPass(bloomPass);

export const gradePass = new ShaderPass({
  uniforms: {
    tDiffuse: { value: null }, tEye: { value: null }, uExpose: { value: 0 },
    uTime: { value: 0 }, uRes: { value: new THREE.Vector2() },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse, tEye; uniform float uTime, uExpose; uniform vec2 uRes;
    varying vec2 vUv;
    void main() {
      vec2 c = vUv - 0.5;
      float r2 = dot( c, c );
      // Visor curvature: a touch of lateral colour split at the edges.
      float ca = 0.0022 * r2;
      vec3 col;
      col.r = texture2D( tDiffuse, vUv + c * ca ).r;
      col.g = texture2D( tDiffuse, vUv ).g;
      col.b = texture2D( tDiffuse, vUv - c * ca ).b;
      if ( uExpose > 0.5 ) col *= exp2( texture2D( tEye, vec2( 0.5 ) ).r );
      col *= 1.0 - 0.30 * r2 - 0.26 * r2 * r2;
      // Grain, proportional to signal as film grain is, plus a trace
      // of read noise in the blacks.
      float g = fract( sin( dot( vUv * uRes + uTime, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 ) - 0.5;
      col *= 1.0 + g * 0.05;
      col += g * 0.0025;
      gl_FragColor = vec4( max( col, 0.0 ), 1.0 );
    }`,
});
composer.addPass(gradePass);
composer.addPass(new OutputPass());

// FXAA, for the low tier, which gives up MSAA. It runs last, on the
// tone-mapped image, where luminance edges are what the eye sees.
export const fxaaPass = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uInv: { value: new THREE.Vector2(1 / innerWidth, 1 / innerHeight) } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform vec2 uInv;
    varying vec2 vUv;
    float lum( vec3 c ) { return dot( c, vec3( 0.299, 0.587, 0.114 ) ); }
    void main() {
      vec3 cM = texture2D( tDiffuse, vUv ).rgb;
      vec3 cNW = texture2D( tDiffuse, vUv + vec2( -1.0, -1.0 ) * uInv ).rgb;
      vec3 cNE = texture2D( tDiffuse, vUv + vec2( 1.0, -1.0 ) * uInv ).rgb;
      vec3 cSW = texture2D( tDiffuse, vUv + vec2( -1.0, 1.0 ) * uInv ).rgb;
      vec3 cSE = texture2D( tDiffuse, vUv + vec2( 1.0, 1.0 ) * uInv ).rgb;
      float lM = lum( cM ), lNW = lum( cNW ), lNE = lum( cNE ), lSW = lum( cSW ), lSE = lum( cSE );
      float lMin = min( lM, min( min( lNW, lNE ), min( lSW, lSE ) ) );
      float lMax = max( lM, max( max( lNW, lNE ), max( lSW, lSE ) ) );
      vec2 dir = vec2( -( ( lNW + lNE ) - ( lSW + lSE ) ), ( lNW + lSW ) - ( lNE + lSE ) );
      float red = max( ( lNW + lNE + lSW + lSE ) * 0.03125, 1.0 / 128.0 );
      dir = clamp( dir / ( min( abs( dir.x ), abs( dir.y ) ) + red ), -8.0, 8.0 ) * uInv;
      vec3 a = 0.5 * ( texture2D( tDiffuse, vUv - dir / 6.0 ).rgb + texture2D( tDiffuse, vUv + dir / 6.0 ).rgb );
      vec3 b = a * 0.5 + 0.25 * ( texture2D( tDiffuse, vUv - dir * 0.5 ).rgb + texture2D( tDiffuse, vUv + dir * 0.5 ).rgb );
      float lB = lum( b );
      gl_FragColor = vec4( ( lB < lMin || lB > lMax ) ? a : b, 1.0 );
    }`,
});
fxaaPass.enabled = false;
composer.addPass(fxaaPass);
