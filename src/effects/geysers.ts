import * as THREE from 'three';
import { WORLD } from '../kernel/world';
import { SUN_DIR } from '../render/lights';
import { scene } from '../render/renderer';
import { DEG } from '../surface/hapke';
import { world } from '../worlds/index';

/* ── Geysers ────────────────────────────────────────────────────
   Triton's: Voyager 2 caught four erupting on the polar cap, each a
   dark column a kilometre or so across rising straight up 8 km, to
   where the thin air's wind takes it, then trailing away level for
   over a hundred kilometres downwind (Soderblom et al. 1990) — the
   wind aloft blowing west while the streaks on the ground point
   north-east. Nitrogen gas, warmed under the clear ice by sunlight,
   carrying dark dust up with it: the solid-state greenhouse.

   Each is a ribbon along that path — column, bend, trail — in true
   size at its true place, tens of kilometres out past the streamed
   ground, turned in the vertex shader to face you across its own
   length (a camera-facing line), dropped by the planet's curve, and
   pulled in along the line of sight to 80 km so it stays inside the
   far plane. The dust is dark and small: it absorbs what is behind it
   (stars, haze, Neptune) and scatters a little sunlight, forward. */
export const geysers = (() => {
  const PROXY = 80000, N = 72;
  const group = new THREE.Group();
  scene.add(group);
  let live = [];
  const vs = `
    attribute vec3 aTan; attribute vec3 aW;   // aW: half-width, side, optical depth
    uniform float uR;
    varying float vSide, vTau; varying vec3 vP;
    void main() {
      vec3 P = ( modelMatrix * vec4( position, 1.0 ) ).xyz;
      vec3 V = normalize( P - cameraPosition );
      vec3 S = normalize( cross( aTan, V ) );
      P += S * aW.x * aW.y;
      vec2 d = P.xz - cameraPosition.xz;
      P.y -= dot( d, d ) / ( 2.0 * uR );
      vec3 r = P - cameraPosition;
      float D = length( r );
      if ( D > ${PROXY.toFixed(1)} ) P = cameraPosition + r * ( ${PROXY.toFixed(1)} / D );
      vSide = aW.y; vTau = aW.z; vP = P;
      gl_Position = projectionMatrix * viewMatrix * vec4( P, 1.0 );
      float far = projectionMatrix[ 3 ][ 2 ] / ( projectionMatrix[ 2 ][ 2 ] + 1.0 );
      if ( far > 1000.0 ) gl_Position.z = min( gl_Position.z, gl_Position.w * ( 1.0 - 2e-4 ) );
    }`;
  const fs = `
    uniform vec3 uSun, uSunCol;
    varying float vSide, vTau; varying vec3 vP;
    void main() {
      // Across the column the dust is Gaussian; the line of sight crosses
      // it with optical depth vTau at the middle.
      float tau = vTau * exp( - vSide * vSide * 2.5 );
      float a = 1.0 - exp( - tau );
      // Single scattering off dark grains (albedo 0.3), Henyey–Greenstein
      // with g = 0.5: radiance = E ϖ P / 4π per unit of (1 − e^−τ).
      float c = dot( normalize( vP - cameraPosition ), normalize( uSun ) );
      float hg = 0.75 / pow( 1.25 - c, 1.5 );
      gl_FragColor = vec4( uSunCol * ( 0.3 * hg / 12.566 ) * a, a );
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`;
  function build(sp) {
    const pos = new Float32Array((N + 1) * 2 * 3), tan = new Float32Array((N + 1) * 2 * 3), w = new Float32Array((N + 1) * 2 * 3);
    const b = sp.brg * DEG, tb = sp.tail.brg * DEG;
    const vx = Math.sin(b) * sp.dist, vz = -Math.cos(b) * sp.dist;
    const wx = Math.sin(tb), wz = -Math.cos(tb);
    const pts = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      // The first fifth climbs the column, then a bend of a few
      // kilometres into the trail, which sinks a little as it goes.
      const up = Math.min(1, t / 0.2), q = Math.max(0, (t - 0.2) / 0.8);
      const along = q * q * 0.04 + q * 0.96;
      const y = sp.H * (1 - Math.pow(1 - up, 2.2) * 1) * (1 - 0.15 * q);
      pts.push([vx + wx * along * sp.tail.len, y, vz + wz * along * sp.tail.len, t, q]);
    }
    for (let i = 0; i <= N; i++) {
      const a = pts[Math.max(0, i - 1)], c = pts[Math.min(N, i + 1)];
      let tx = c[0] - a[0], ty = c[1] - a[1], tz = c[2] - a[2];
      const l = Math.hypot(tx, ty, tz) || 1; tx /= l; ty /= l; tz /= l;
      const [x, y, z, t, q] = pts[i];
      const hw = t < 0.2 ? sp.w * (0.6 + 0.4 * t / 0.2) : sp.w * (1 + q * 4);
      // The column is dense; the trail thins as it spreads.
      const tau = (t < 0.2 ? sp.tau : sp.tau * 0.6 / (1 + q * 4)) * (1 - Math.pow(q, 3));
      for (let k = 0; k < 2; k++) {
        const o = (i * 2 + k) * 3;
        pos[o] = x; pos[o + 1] = y; pos[o + 2] = z;
        tan[o] = tx; tan[o + 1] = ty; tan[o + 2] = tz;
        w[o] = hw; w[o + 1] = k ? 1 : -1; w[o + 2] = tau;
      }
    }
    const idx = [];
    for (let i = 0; i < N; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aTan', new THREE.BufferAttribute(tan, 3));
    g.setAttribute('aW', new THREE.BufferAttribute(w, 3));
    g.setIndex(idx);
    return g;
  }
  return {
    // specs: [{ brg (°), dist (m), H (m), w (column half-width, m), tau, tail: { brg (°), len (m) } }]
    set(specs) {
      for (const g of live) { group.remove(g); g.geometry.dispose(); g.material.dispose(); }
      live = (specs || []).map((sp) => {
        const m = new THREE.Mesh(build(sp), new THREE.ShaderMaterial({
          uniforms: { uSun: { value: new THREE.Vector3() }, uSunCol: { value: new THREE.Vector3() }, uR: { value: 1e6 } },
          vertexShader: vs, fragmentShader: fs, side: THREE.DoubleSide,
          transparent: true, depthWrite: false, fog: false,
          blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
        }));
        m.frustumCulled = false;
        m.renderOrder = -1;
        group.add(m);
        return m;
      });
    },
    // groundY: the site's ground, where the vents are taken to stand.
    update(groundY, lit, units) {
      group.position.y = groundY;
      for (const m of live) {
        const u = m.material.uniforms;
        u.uSun.value.copy(SUN_DIR);
        u.uSunCol.value.set(world.sunPower * lit * units, world.sunPower * lit * units, world.sunPower * lit * units);
        u.uR.value = WORLD.R;
      }
    },
    get on() { return live.length > 0; },
  };
})();
