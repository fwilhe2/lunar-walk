import * as THREE from 'three';
import { hash2, smoothT } from '../kernel/noise';
import { terrainHeight } from '../kernel/terrain';
import { CURVE_R } from '../kernel/world';
import { KEY, SUN_DIR, hemiLight } from '../render/lights';
import { scene } from '../render/renderer';
import { world } from '../worlds/index';
import { WIND_A } from '../worlds/mars/terrain';
import { TypedShaderMaterial } from '../util/three';

/* ── Dust devils ────────────────────────────────────────────────
   Martian afternoons raise convective whirlwinds that pick up the
   bright dust and walk it across the plains with the wind: Spirit
   filmed them crossing Gusev, tens to hundreds of metres across and
   several hundred metres tall, at a few metres a second (Greeley et al.
   2006), and from orbit their shadows and the dark tracks they leave
   are everywhere. A few are always about, three to eight kilometres
   off: each a column standing on the ground where it is, faintest at
   the top, drawn like the geysers as a ribbon turned to face you. Each
   lives ten minutes, fading in and out, and the next rises somewhere
   else round wherever you then are. */
type DevilUniforms = {
  uSun: THREE.IUniform<THREE.Vector3>; uLight: THREE.IUniform<number>; uCol: THREE.IUniform<THREE.Color>;
  uFade: THREE.IUniform<number>; uR: THREE.IUniform<number>; uSway: THREE.IUniform<number>;
  uW: THREE.IUniform<number>; uH: THREE.IUniform<number>;
  fogColor: THREE.IUniform<THREE.Color>; fogDensity: THREE.IUniform<number>;
};
/* A devil's slot: its column, the epoch it was last respawned in, where
   it rose, its height, width and walking speed. */
interface Devil {
  mesh: THREE.Mesh<THREE.BufferGeometry, TypedShaderMaterial<DevilUniforms>>;
  epoch: number; bx: number; bz: number; H: number; W: number; v: number;
}

export const devils = (() => {
  const N = 24, LIFE = 600;
  const group = new THREE.Group();
  scene.add(group);
  const vs = `
    attribute vec3 aW;   // half-width, side, optical depth
    uniform float uR, uSway, uW, uH;
    varying float vSide, vTau, vH; varying vec3 vP;
    void main() {
      vec3 P = ( modelMatrix * vec4( position, 1.0 ) ).xyz;
      // Leaning downwind and wavering as it climbs.
      float h = position.y * uH;
      vec3 T = vec3( 0.0, 1.0, 0.0 );
      vec3 V = normalize( P - cameraPosition );
      vec3 S = normalize( cross( T, V ) );
      P += S * aW.x * uW * aW.y;
      P.x += sin( h * 0.004 + uSway ) * h * 0.06;
      vec2 d = P.xz - cameraPosition.xz;
      P.y -= dot( d, d ) / ( 2.0 * uR );
      vSide = aW.y; vTau = aW.z; vP = P; vH = aW.x;
      gl_Position = projectionMatrix * viewMatrix * vec4( P, 1.0 );
    }`;
  const fs = `
    uniform vec3 uSun, uCol; uniform float uLight, uFade;
    varying float vSide, vTau; varying vec3 vP;
    void main() {
      float tau = vTau * exp( - vSide * vSide * 4.0 ) * uFade;
      float a = 1.0 - exp( - tau );
      // Fine dust, forward-scattering (g = 0.6), lit by the sun and,
      // a good deal, by the dusty sky.
      float c = dot( normalize( vP - cameraPosition ), normalize( uSun ) );
      float hg = 0.64 / pow( 1.36 - 1.2 * c, 1.5 );
      gl_FragColor = vec4( uCol * uLight * ( 0.10 + 0.16 * hg ) * a, a );
      #include <fog_fragment>
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`;
  const geo = (() => {
    const pos = new Float32Array((N + 1) * 2 * 3), w = new Float32Array((N + 1) * 2 * 3);
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      for (let k = 0; k < 2; k++) {
        const o = (i * 2 + k) * 3;
        pos[o] = 0; pos[o + 1] = t; pos[o + 2] = 0;
        // Width doubles toward the top; density thins, most of the dust
        // in the lowest third.
        w[o] = 0.5 + t * 0.8; w[o + 1] = k ? 1 : -1; w[o + 2] = 0.22 * Math.exp(-t * 3.2) * Math.min(1, t * 12 + 0.3) * (1 - smoothT(Math.max(0, (t - 0.6) / 0.4)));
      }
    }
    const idx: number[] = [];
    for (let i = 0; i < N; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aW', new THREE.BufferAttribute(w, 3));
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
            uSun: { value: new THREE.Vector3() }, uLight: { value: 1 }, uCol: { value: new THREE.Color(0.80, 0.60, 0.44) },
            uFade: { value: 0 }, uR: { value: 1e6 }, uSway: { value: 0 }, uW: { value: 60 }, uH: { value: 600 },
            fogColor: { value: new THREE.Color() }, fogDensity: { value: 0 },
          },
          vertexShader: vs.replace('void main() {', '#include <fog_pars_vertex>\nvoid main() {').replace('gl_Position = projectionMatrix * viewMatrix * vec4( P, 1.0 );', 'vec4 mvPosition = viewMatrix * vec4( P, 1.0 ); gl_Position = projectionMatrix * mvPosition;\n#include <fog_vertex>'),
          fragmentShader: '#include <fog_pars_fragment>\n' + fs,
          side: THREE.DoubleSide, transparent: true, depthWrite: false, fog: true,
          blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.frustumCulled = false;
        group.add(mesh);
        live.push({ mesh, epoch: -1, bx: 0, bz: 0, H: 600, W: 60, v: 4 });
      }
    },
    update(t: number, cam: THREE.Vector3) {
      for (let k = 0; k < live.length; k++) {
        const d = live[k]!, T = t + k * LIFE / live.length, ep = Math.floor(T / LIFE), f = T / LIFE - ep;
        if (ep !== d.epoch) {
          // A new one, somewhere round you, seeded by its slot and epoch.
          d.epoch = ep;
          const h = (n: number) => hash2(ep * 7 + k, n * 131 + 17);
          const a = h(1) * 6.2832, r = 3000 + h(2) * 5000;
          d.bx = cam.x + Math.cos(a) * r; d.bz = cam.z + Math.sin(a) * r;
          d.H = 350 + h(3) * 900; d.W = 25 + h(4) * 80; d.v = 2 + h(5) * 4;
        }
        // Walked downwind at its own pace.
        const s = f * LIFE * d.v, x = d.bx + Math.cos(WIND_A) * s, z = d.bz + Math.sin(WIND_A) * s;
        d.mesh.position.set(x, terrainHeight(x, z), z);
        d.mesh.scale.set(1, d.H, 1);
        const u = d.mesh.material.uniforms;
        u.uFade.value = Math.sin(Math.PI * f) ** 0.5;
        u.uSun.value.copy(SUN_DIR);
        u.uLight.value = world.sunPower * KEY.scale + hemiLight.intensity * 0.5;
        u.uR.value = CURVE_R;
        u.uSway.value = t * 0.3 + k;
        u.uW.value = d.W; u.uH.value = d.H;
        if (scene.fog instanceof THREE.FogExp2) { u.fogColor.value.copy(scene.fog.color); u.fogDensity.value = scene.fog.density; }
      }
    },
  };
})();
