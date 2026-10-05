import * as THREE from 'three';
import { hash2 } from '../kernel/noise';
import { terrainHeight } from '../kernel/terrain';
import { CURVE_R } from '../kernel/world';
import { DEPTH_SPLIT, scene } from '../render/renderer';
import { skyDome } from '../sky/dome';
import { WIND_A } from '../worlds/mars/terrain';
import { TypedShaderMaterial } from '../util/three';

/* ── Dust devils ────────────────────────────────────────────────
   Martian afternoons raise convective whirlwinds that pick up the
   bright dust and walk it across the plains with the wind: Spirit
   filmed them crossing Gusev, tens to hundreds of metres across and
   several hundred metres tall, at a few metres a second (Greeley et al.
   2006), and from orbit their shadows and the dark tracks they leave
   are everywhere. A few are always about, one to seven kilometres
   off, drawn like the geysers as a ribbon turned to face you. The
   ribbon only bounds the dust: the fragment shader takes the chord
   through a column — a dense skirt where the dust is lifted, a wall
   that widens as it climbs and frays at the top — and lumps its
   density with noise on the near and far wall, turning at the
   tangential wind (10–16 m/s at the wall) and rising with the
   updraft, so the lumps climb in a helix as on Perseverance's navcam
   sequences (PIA26528). The column leans and bends downwind, where
   the wind is stronger aloft. Each lives ten minutes, fading in and
   out, and the next rises somewhere else round wherever you then are.

   The dust is the dust the sky is made of, lit by the same sun, so it
   is drawn in the sky's own light (sky/dome.ts): the radiance the sky
   would have along the line of sight with the horizon's long column
   of dust in it — the same scattering angle, so the same aureole —
   a little paler and twice as bright, since the column is denser and
   lower than the haze. The dome carries the aureole as a colour more
   than a brightness — the glare round the sun is the corona sprite,
   over everything — so a part of the dust's own forward scattering
   (g = 0.6) is put back: against the light at 30° a devil is twice as
   bright as from the side, not four times, which made it a white
   flare. It turns blue in the aureole like the haze, and dims with
   the sky at dusk. */
type DevilUniforms = typeof skyDome.uniforms & {
  uPale: THREE.IUniform<THREE.Color>;
  uFade: THREE.IUniform<number>; uR: THREE.IUniform<number>; uSway: THREE.IUniform<number>;
  uW: THREE.IUniform<number>; uH: THREE.IUniform<number>; uWind: THREE.IUniform<THREE.Vector2>;
  uSpin: THREE.IUniform<number>; uRise: THREE.IUniform<number>; uDust: THREE.IUniform<number>;
  fogColor: THREE.IUniform<THREE.Color>; fogDensity: THREE.IUniform<number>;
};
/* A devil's slot: its column, the epoch it was last respawned in, where
   it rose, its height, width, walking speed and spin (rad/s, signed —
   at this scale either sense is as likely). */
interface Devil {
  mesh: THREE.Mesh<THREE.BufferGeometry, TypedShaderMaterial<DevilUniforms>>;
  epoch: number; bx: number; bz: number; H: number; W: number; v: number; w: number;
}

export const devils = (() => {
  const N = 48, LIFE = 600;
  const group = new THREE.Group();
  scene.add(group);
  // Radii in units of the column's base radius (W/2), t = height / H:
  // the column widens as it climbs and spreads at the top; the skirt
  // is twice as wide at the ground and gone within a radius or so.
  const shape = `
    float colR( float t ) { return 1.0 + 0.6 * t + 1.0 * smoothstep( 0.5, 1.0, t ); }
    float skirt( float t ) { return exp( - t * uH / ( 0.7 * uW ) ); }`;
  const vs = `
    attribute float aSide;
    uniform float uR, uSway, uW, uH; uniform vec2 uWind;
    varying float vT, vX, vE, vNear, vDepth; varying vec3 vP;
    ${shape}
    void main() {
      float t = position.y, h = t * uH;
      vec3 P = ( modelMatrix * vec4( 0.0, h, 0.0, 1.0 ) ).xyz;
      // Leaning downwind, bending further aloft, wavering across.
      P.xz += uWind * ( 0.10 * h + 0.22 * uH * t * t ) + vec2( - uWind.y, uWind.x ) * sin( t * 4.0 + uSway ) * 0.05 * h;
      // Wide enough for the skirt, the column and its ragged edge, with
      // room to spare: dust reaching the ribbon's edge would cut there.
      float env = 1.6 * max( colR( t ), 1.0 + 1.1 * skirt( t ) );
      vec3 V = normalize( P - cameraPosition );
      vec3 S = normalize( cross( vec3( 0.0, 1.0, 0.0 ), V ) );
      P += S * aSide * env * 0.5 * uW;
      vec2 d = P.xz - cameraPosition.xz;
      P.y -= dot( d, d ) / ( 2.0 * uR );
      vT = t; vX = aSide * env; vE = aSide; vP = P;
      // Which of the two depth ranges this is (render/post.ts): the near
      // plane, from the projection.
      vNear = projectionMatrix[3][2] / ( projectionMatrix[2][2] - 1.0 );
      vDepth = - ( viewMatrix * vec4( P, 1.0 ) ).z;
      gl_Position = projectionMatrix * viewMatrix * vec4( P, 1.0 );
    }`;
  const fs = `
    uniform vec3 uPale; uniform float uFade, uW, uH, uSpin, uRise, uDust;
    varying float vT, vX, vE, vNear, vDepth; varying vec3 vP;
    ${shape}
    float hash3( vec3 p ) {
      p = fract( p * 0.3183099 + 0.1 ); p *= 17.0;
      return fract( p.x * p.y * p.z * ( p.x + p.y + p.z ) );
    }
    float vnoise( vec3 x ) {
      vec3 i = floor( x ), f = fract( x );
      f = f * f * ( 3.0 - 2.0 * f );
      return mix( mix( mix( hash3( i ), hash3( i + vec3( 1, 0, 0 ) ), f.x ),
                       mix( hash3( i + vec3( 0, 1, 0 ) ), hash3( i + vec3( 1, 1, 0 ) ), f.x ), f.y ),
                  mix( mix( hash3( i + vec3( 0, 0, 1 ) ), hash3( i + vec3( 1, 0, 1 ) ), f.x ),
                       mix( hash3( i + vec3( 0, 1, 1 ) ), hash3( i + vec3( 1, 1, 1 ) ), f.x ), f.y ), f.z );
    }
    // Lumps on the wall at azimuth phi and height hm (metres, in the
    // rising dust's frame), 0 … 1, about as tall as they are wide. On a
    // circle, so the wall has no seam.
    float wall( float phi, float hm ) {
      vec3 p = vec3( cos( phi ) * 1.7, sin( phi ) * 1.7, hm / ( 0.45 * uW ) );
      return 0.55 * vnoise( p ) + 0.3 * vnoise( p * 2.03 + 3.1 ) + 0.15 * vnoise( p * 4.1 + 7.7 );
    }
    void main() {
      // The two depth ranges overlap by 2%; dust drawn in both would
      // count twice there, a bright line across a near devil. Split it.
      if ( vNear > ${DEPTH_SPLIT * 0.5}.0 ? vDepth < ${DEPTH_SPLIT * 0.99}.0 : vDepth >= ${DEPTH_SPLIT * 0.99}.0 ) discard;
      float t = vT, rc = colR( t ), sk = skirt( t );
      // Where the line of sight meets the near and far wall; the twist
      // with height turns the lumps' rise into a helix.
      float xc = clamp( vX / rc, -1.0, 1.0 ), a0 = asin( xc );
      float tw = uSpin + t * uH / ( 4.0 * uW ), hm = t * uH - uRise;
      float nf = wall( a0 + tw, hm ), nb = wall( 3.14159 - a0 + tw, hm ), n = 0.5 * ( nf + nb );
      // Column: the chord through a wall made ragged by the near lumps —
      // half of it a shell, so the limbs show denser than the core —
      // thinning as it climbs and breaking into tatters at the top. The
      // dust goes up in puffs, bands a couple of widths apart.
      float u = vX / ( rc * ( 0.7 + 0.55 * nf ) ), uu = u * u;
      float chord = 0.5 * max( 0.0, 1.0 - uu ) + 0.5 * ( sqrt( max( 0.0, 1.0 - uu ) ) - sqrt( max( 0.0, 0.36 - uu ) ) );
      float puff = 0.55 + 0.9 * smoothstep( 0.2, 0.8, vnoise( vec3( 7.3, 1.1, hm / ( 2.5 * uW ) ) ) );
      float top = smoothstep( 0.0, 1.0, ( 1.0 - t ) * 2.6 - 0.3 + ( n - 0.5 ) * 0.8 );
      float tauC = chord * ( 0.5 + 0.5 * exp( - t * 3.0 ) ) * ( 0.35 + 1.2 * smoothstep( 0.25, 0.8, n ) ) * puff * top;
      // Skirt: the dust being lifted, low, wide and dense.
      float us = vX / ( ( 1.0 + 1.1 * sk ) * ( 0.7 + 0.55 * nb ) );
      float tauS = max( 0.0, 1.0 - us * us ) * sk * ( 0.5 + n );
      float tau = uDust * ( tauC + 1.2 * tauS ) * uFade * smoothstep( 1.0, 0.9, abs( vE ) );
      float a = 1.0 - exp( - tau );
      // In the sky's light with the horizon's column, with some of its
      // forward scattering (see above; 1 at 90°); the sunward side of
      // the column a little brighter.
      vec3 V = normalize( vP - cameraPosition ), L = normalize( uSun );
      float hg = 0.85 + 0.375 * 0.64 / pow( 1.36 - 1.2 * dot( V, L ), 1.5 );
      vec3 S = normalize( cross( vec3( 0.0, 1.0, 0.0 ), V ) ), Vh = normalize( vec3( V.x, 0.0, V.z ) );
      float side = 0.75 + 0.25 * dot( S * xc - Vh * sqrt( 1.0 - xc * xc ), L );
      gl_FragColor = vec4( uPale * skyRadianceT( V, 1.0 ) * hg * side * a, a );
      // Premultiplied, so fog is too: toward fogColor × a, or the fog
      // colour paints the whole ribbon however thin the dust.
      #include <fog_fragment>
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`;
  const geo = (() => {
    const pos = new Float32Array((N + 1) * 2 * 3), side = new Float32Array((N + 1) * 2);
    for (let i = 0; i <= N; i++) {
      for (let k = 0; k < 2; k++) {
        const o = i * 2 + k;
        pos[o * 3 + 1] = i / N;
        side[o] = k ? 1 : -1;
      }
    }
    const idx: number[] = [];
    for (let i = 0; i < N; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSide', new THREE.BufferAttribute(side, 1));
    g.setIndex(idx);
    return g;
  })();
  let live: Devil[] = [];
  return {
    set(n: number | undefined) {
      for (const d of live) { group.remove(d.mesh); d.mesh.material.dispose(); }
      live = [];
      for (let k = 0; k < (n || 0); k++) {
        const mat = new TypedShaderMaterial<DevilUniforms>({
          uniforms: {
            // The dome's uniform objects, shared, not copied.
            ...skyDome.uniforms, uPale: { value: new THREE.Color(1.9, 2.13, 2.28) },
            uFade: { value: 0 }, uR: { value: 1e6 }, uSway: { value: 0 }, uW: { value: 60 }, uH: { value: 600 },
            uWind: { value: new THREE.Vector2(Math.cos(WIND_A), Math.sin(WIND_A)) },
            uSpin: { value: 0 }, uRise: { value: 0 }, uDust: { value: 0.6 },
            fogColor: { value: new THREE.Color() }, fogDensity: { value: 0 },
          },
          vertexShader: vs.replace('void main() {', '#include <fog_pars_vertex>\nvoid main() {').replace('gl_Position = projectionMatrix * viewMatrix * vec4( P, 1.0 );', 'vec4 mvPosition = viewMatrix * vec4( P, 1.0 ); gl_Position = projectionMatrix * mvPosition;\n#include <fog_vertex>'),
          fragmentShader: '#include <fog_pars_fragment>\n' + skyDome.glsl + fs.replace('#include <fog_fragment>', THREE.ShaderChunk.fog_fragment.replace('fogColor,', 'fogColor * gl_FragColor.a,')),
          side: THREE.DoubleSide, transparent: true, depthWrite: false, fog: true,
          blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.frustumCulled = false;
        group.add(mesh);
        live.push({ mesh, epoch: -1, bx: 0, bz: 0, H: 600, W: 60, v: 4, w: 0.4 });
      }
    },
    update(t: number, cam: THREE.Vector3) {
      for (let k = 0; k < live.length; k++) {
        const d = live[k]!, T = t + k * LIFE / live.length, ep = Math.floor(T / LIFE), f = T / LIFE - ep;
        if (ep !== d.epoch) {
          // A new one, somewhere round you, seeded by its slot and epoch.
          d.epoch = ep;
          const h = (n: number) => hash2(ep * 7 + k, n * 131 + 17);
          const a = h(1) * 6.2832, r = 1000 + h(2) * 6000;
          d.bx = cam.x + Math.cos(a) * r; d.bz = cam.z + Math.sin(a) * r;
          d.H = 350 + h(3) * 900; d.W = 25 + h(4) * 80; d.v = 2 + h(5) * 4;
          d.w = (10 + h(6) * 6) / (0.5 * d.W) * (h(7) < 0.5 ? -1 : 1);
        }
        // Walked downwind at its own pace.
        const s = f * LIFE * d.v, x = d.bx + Math.cos(WIND_A) * s, z = d.bz + Math.sin(WIND_A) * s;
        d.mesh.position.set(x, terrainHeight(x, z), z);
        const u = d.mesh.material.uniforms;
        u.uFade.value = Math.sin(Math.PI * f) ** 0.5;
        u.uR.value = CURVE_R;
        u.uSway.value = t * 0.3 + k;
        // A longer chord through a wide one, but not proportionally more:
        // linear in width, a wide devil near you stood out like a pillar.
        u.uW.value = d.W; u.uH.value = d.H; u.uDust.value = 0.44 * Math.sqrt(d.W / 40);
        // The wall turns at the tangential wind; the dust rises at 4 m/s.
        // Both from its birth, so they stay small.
        u.uSpin.value = (f * LIFE * d.w) % 6.2832; u.uRise.value = f * LIFE * 4;
        if (scene.fog instanceof THREE.FogExp2) { u.fogColor.value.copy(scene.fog.color); u.fogDensity.value = scene.fog.density; }
      }
    },
  };
})();
