import * as THREE from 'three';
import { KEY_XZ } from '../render/lights';
import { renderer, scene } from '../render/renderer';
import { TS } from '../surface/shaders';
import { TypedShaderMaterial } from '../util/three';
import { chunkGroup, chunkStreamer } from './streamer';

/* ═════════════════════════════════════════════════════════════
   TERRAIN SHADOWS — the ground shadowing itself, at every range.

   Nothing about an airless surface is more characteristic than its
   shadows: at a low sun every crater is a bowl of black with a lit
   far wall, and it is the shadows, not the shading, that tell you
   how the ground is shaped. A shadow map cannot do that at these
   ranges, and it does not need to, because the sun here only ever
   moves in elevation: its azimuth is fixed. So for any point on the
   ground, the whole question of whether it is lit reduces to one
   number — how high the skyline stands in the sun's direction — and
   that number does not change when the sun does.

   Four nested levels, 0.5 m to 32 m a texel, out to ±16 km:

     1. Height clipmaps. The streamed chunk meshes are rendered top-
        down, orthographically, into a height texture per level, the
        highest surface winning. Levels do not overlap: a coarse chunk
        leaves out the quads finer ground stands on (terrain/streamer.ts).
        This is the mesh you see, curvature drop and all, so the shadows
        land on exactly the ground that is drawn; no second height
        source is involved.
     2. Horizon maps. For each texel, march toward the sun through
        the height levels (finest available at each step) and keep
        the steepest rise: tan of the skyline, the distance to it, and
        the ground height, packed into one RGBA texel.
     3. Every surface material compares that skyline against the sun
        (surface/shaders.ts) — a single fetch per fragment.

   The work is only redone when the ground itself changes, or you
   walk off the middle of the finest level, and it is spread over
   five frames: heights in one, one horizon level in each of the next
   four. Moving the sun costs nothing at all.
   ═════════════════════════════════════════════════════════════ */
export const terrainShadows = (() => {
  let N = 1024, minGap = 350;
  const SPANS = [512, 2048, 8192, 32768];
  const rt = (format: THREE.PixelFormat, depth: boolean) => new THREE.WebGLRenderTarget(N, N, {
    type: THREE.HalfFloatType, format, depthBuffer: depth, stencilBuffer: false,
    minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false,
  });
  // One of everything per level, so every k below is < SPANS.length.
  let hRT: THREE.WebGLRenderTarget[] = [], zRT: THREE.WebGLRenderTarget[] = [];     // heights relative to refY; skyline tan, distance, height

  // ── 1. heights
  const heightMat = new TypedShaderMaterial({
    uniforms: { uRef: { value: 0 } },
    vertexShader: `
      uniform float uRef;
      varying float vH;
      void main() {
        vec4 w = modelMatrix * vec4( position, 1.0 );
        vH = w.y - uRef;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: `
      varying float vH;
      void main() { gl_FragColor = vec4( vH, 0.0, 0.0, 1.0 ); }`,
    side: THREE.DoubleSide,
  });
  const hScene = new THREE.Scene();
  hScene.overrideMaterial = heightMat;
  // Looking straight down with -z up the screen, so texture u runs
  // with world x and v against world z — the convention tsUv() reads.
  const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 20000);
  ortho.up.set(0, 0, -1);
  const LOW = new THREE.Color(-30000, 0, 0);   // "no ground here"

  // ── 2. horizons
  const hzU = {
    tH0: new THREE.Uniform<THREE.Texture | null>(null), tH1: new THREE.Uniform<THREE.Texture | null>(null),
    tH2: new THREE.Uniform<THREE.Texture | null>(null), tH3: new THREE.Uniform<THREE.Texture | null>(null),
    uHp: { value: SPANS.map(() => new THREE.Vector4()) },   // height levels (cx, cz, span, texel)
    uOut: { value: new THREE.Vector4() },                   // this level
    uDir: { value: KEY_XZ },
    uTMax: { value: 8000 },
  };
  const hzMat = new THREE.ShaderMaterial({
    uniforms: hzU, depthTest: false, depthWrite: false,
    vertexShader: `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4( position.xy, 0.0, 1.0 ); }`,
    fragmentShader: `
      precision highp float;
      uniform sampler2D tH0, tH1, tH2, tH3;
      uniform vec4 uHp[ 4 ];
      uniform vec4 uOut;
      uniform vec2 uDir;
      uniform float uTMax;
      varying vec2 vUv;
      vec2 tUv( vec2 p, vec4 L ) { return vec2( 0.5 + ( p.x - L.x ) / L.z, 0.5 - ( p.y - L.y ) / L.z ); }
      bool inL( vec2 u ) { return u.x > 0.002 && u.y > 0.002 && u.x < 0.998 && u.y < 0.998; }
      // Height from the finest level that holds p, and that level's texel.
      vec2 hAt( vec2 p ) {
        vec2 u = tUv( p, uHp[ 0 ] );
        if ( inL( u ) ) return vec2( textureLod( tH0, u, 0.0 ).r, uHp[ 0 ].w );
        u = tUv( p, uHp[ 1 ] );
        if ( inL( u ) ) return vec2( textureLod( tH1, u, 0.0 ).r, uHp[ 1 ].w );
        u = tUv( p, uHp[ 2 ] );
        if ( inL( u ) ) return vec2( textureLod( tH2, u, 0.0 ).r, uHp[ 2 ].w );
        u = tUv( p, uHp[ 3 ] );
        if ( inL( u ) ) return vec2( textureLod( tH3, u, 0.0 ).r, uHp[ 3 ].w );
        return vec2( -30000.0, 1e4 );
      }
      void main() {
        vec2 p = vec2( uOut.x + ( vUv.x - 0.5 ) * uOut.z, uOut.y - ( vUv.y - 0.5 ) * uOut.z );
        float h0 = hAt( p ).x;
        float best = -4.0, bestT = uTMax;
        // Steps no finer than the texel being read and no coarser than
        // 4.5% of the range: about 150 of them out to 8 km.
        float t = uOut.w * 0.75;
        for ( int i = 0; i < 260; i ++ ) {
          vec2 s = hAt( p + uDir * t );
          float sl = ( s.x - h0 ) / t;
          if ( sl > best ) { best = sl; bestT = t; }
          t += max( s.y * 0.85, t * 0.045 );
          if ( t > uTMax ) break;
        }
        gl_FragColor = vec4( best, bestT, h0, 1.0 );
      }`,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), hzMat);
  quad.frustumCulled = false;
  const qScene = new THREE.Scene();
  qScene.add(quad);
  const qCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  // The per-level texture uniforms, in level order.
  const tsHz = [TS.tsHz0, TS.tsHz1, TS.tsHz2, TS.tsHz3], tH = [hzU.tH0, hzU.tH1, hzU.tH2, hzU.tH3];

  const cen = SPANS.map(() => ({ x: 0, z: 0 }));
  let refY = 0, seq = -1, dirty = true, lastVersion = -1, lastStart = -1e9;
  let on = false, reach = 8000, forceNow = false;
  const _c = new THREE.Color();

  function alloc() {
    for (const r of hRT) r.dispose();
    for (const r of zRT) r.dispose();
    hRT = SPANS.map(() => rt(THREE.RedFormat, true));
    zRT = SPANS.map(() => rt(THREE.RGBAFormat, false));
    zRT.forEach((r, k) => { tsHz[k]!.value = r.texture; });
    hRT.forEach((r, k) => { tH[k]!.value = r.texture; });
  }
  alloc();

  function renderHeights() {
    const prevTarget = renderer.getRenderTarget();
    renderer.getClearColor(_c);
    const prevAlpha = renderer.getClearAlpha();
    renderer.setClearColor(LOW, 1);
    heightMat.uniforms.uRef.value = refY;
    hScene.add(chunkGroup);                   // borrowed for the pass
    for (let k = 0; k < SPANS.length; k++) {
      const h = SPANS[k]! / 2;
      ortho.left = -h; ortho.right = h; ortho.top = h; ortho.bottom = -h;
      ortho.position.set(cen[k]!.x, refY + 10000, cen[k]!.z);
      ortho.lookAt(cen[k]!.x, refY, cen[k]!.z);
      ortho.updateProjectionMatrix();
      renderer.setRenderTarget(hRT[k]!);
      renderer.render(hScene, ortho);
      hzU.uHp.value[k]!.set(cen[k]!.x, cen[k]!.z, SPANS[k]!, SPANS[k]! / N);
    }
    scene.add(chunkGroup);
    renderer.setClearColor(_c, prevAlpha);
    renderer.setRenderTarget(prevTarget);
  }

  function renderHorizon(k: number) {
    const prevTarget = renderer.getRenderTarget();
    hzU.uOut.value.set(cen[k]!.x, cen[k]!.z, SPANS[k]!, SPANS[k]! / N);
    hzU.uTMax.value = reach;
    renderer.setRenderTarget(zRT[k]!);
    renderer.render(qScene, qCam);
    renderer.setRenderTarget(prevTarget);
    // Publish this level to the surfaces only now that it is written.
    TS.tsLv.value[k]!.set(cen[k]!.x, cen[k]!.z, SPANS[k]!, refY);
  }

  return {
    // A new world starts clean, and dark until its first pass is done.
    reset(worldReach: number, enabled: boolean) {
      reach = worldReach;
      on = enabled;
      seq = -1; dirty = true; lastVersion = -1;
      TS.tsSun.value.z = 0;
    },
    // Clipmap resolution and the shortest gap between rebuilds, set by
    // quality. A new resolution rebuilds everything in one frame.
    configure(n: number, gap: number) {
      minGap = gap;
      if (n === N) return;
      N = n;
      alloc();
      seq = -1; dirty = true; forceNow = true;
    },
    // The key light moved in azimuth — sunset or sunrise under a
    // planet: every horizon is stale, so redo them all in one frame.
    invalidate() { seq = -1; dirty = true; forceNow = true; },
    /* Call every frame. `now` forces the whole pass into this frame —
       used once, when a world has finished loading, so the first frame
       anyone sees already has its shadows. */
    update(fx: number, fz: number, groundY: number, now: boolean) {
      if (!on) { TS.tsSun.value.z = 0; return; }
      const v = chunkStreamer.version;
      if (v !== lastVersion || Math.hypot(fx - cen[0]!.x, fz - cen[0]!.z) > 40) dirty = true;
      const t = performance.now();
      if (forceNow) { now = true; forceNow = false; }
      if (seq < 0 && dirty && (now || t - lastStart > minGap)) {
        // Centres snap to a multiple of each level's texels, so the
        // sampling grid never shifts by a fraction of one and the
        // shadows do not crawl when they are rebuilt.
        for (let k = 0; k < SPANS.length; k++) {
          const q = SPANS[k]! / N * 16;
          cen[k]!.x = Math.round(fx / q) * q;
          cen[k]!.z = Math.round(fz / q) * q;
        }
        refY = groundY;
        renderHeights();
        lastVersion = v; dirty = false; lastStart = t; seq = 0;
        if (!now) return;
      }
      while (seq >= 0) {
        renderHorizon(seq);
        if (++seq === SPANS.length) { seq = -1; TS.tsSun.value.z = 1; }
        if (!now) break;
      }
    },
  };
})();
