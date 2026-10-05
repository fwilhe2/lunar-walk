import * as THREE from 'three';
import { WORLD } from '../kernel/world';
import { SUN_DIR } from '../render/lights';
import { scene } from '../render/renderer';
import { DEG } from '../surface/hapke';

/* ── Plumes ─────────────────────────────────────────────────────
   Io's volcanoes throw sulphur and SO₂ straight up out of an airless
   world, so nothing slows the spray: every grain flies a clean
   parabola and falls back in a ring, and together they build an
   umbrella — Prometheus's stands 80–100 km high and twice that
   across, Pele's 300 km. The grains pile up where their paths bend
   over, so the canopy is a thin bright shell over a faint interior,
   brightest at its limbs, where you look along it; filaments run
   through it, and a column of gas and dust feeds it up the middle.
   The grains are small, so they scatter forward: a plume toward the
   sun blazes, and one with the sun behind you is barely there.

   Each is a far-off place on the surface, hundreds of kilometres out,
   well beyond the streamed ground — so it is drawn as a flat sheet
   standing past the end of it, turned to face you, scaled to its true
   size at its true distance and dropped by the planet's curve there:
   Io's horizon swallows the foot of a plume 200 km off and the lower
   hundred kilometres of one 700 km off. The ground, drawn in front,
   hides whatever the curve does not. */
export const plumes = (() => {
  const PROXY = 80000;
  const group = new THREE.Group();
  scene.add(group);
  let live = [];
  const geo = new THREE.PlaneGeometry(2, 1).translate(0, 0.5, 0);
  const vs = `
    varying vec2 vUv; varying vec3 vW;
    void main() {
      vUv = uv;
      vW = ( modelMatrix * vec4( position, 1.0 ) ).xyz;
      gl_Position = projectionMatrix * viewMatrix * vec4( vW, 1.0 );
      // A wide canopy reaches past the far plane (90 km) toward its
      // edges, which cut it along a straight line. Hold its depth just
      // inside the far range, still in front of the companions' sky
      // depth and behind all the ground. Not in the near range, whose
      // far plane is DEPTH_SPLIT: there the sheet must stay clipped.
      float far = projectionMatrix[ 3 ][ 2 ] / ( projectionMatrix[ 2 ][ 2 ] + 1.0 );
      if ( far > 1000.0 ) gl_Position.z = min( gl_Position.z, gl_Position.w * ( 1.0 - 2e-4 ) );
    }`;
  const fs = `
    uniform vec3 uSun, uCol;
    uniform float uGain, uShell, uColumn, uSeed;
    varying vec2 vUv; varying vec3 vW;
    void main() {
      // Plume coordinates: X across, in canopy radii; Z up, in heights.
      float X = vUv.x * 2.0 - 1.0, Z = vUv.y;
      // The column of the canopy along the line of sight, in closed
      // form: the grains crowd into a thin paraboloid shell (the
      // envelope of every path, Z = 1 − r²), which the sight line cuts
      // where Y² = s, and crosses at a grazing angle — so brightest at
      // the limb — near s = 0. Under it a faint fill, and the feeding
      // column up the axis.
      float s2 = 1.0 - X * X - Z;
      float shell = 0.886 * uShell / sqrt( 4.0 * max( s2, 0.0 ) + 2.0 * uShell ) * exp( - min( s2, 0.0 ) * min( s2, 0.0 ) / ( uShell * uShell ) );
      float fill = 0.24 * sqrt( max( s2, 0.0 ) ) * ( 1.0 - Z );
      float column = 0.097 * exp( - X * X / 0.003 ) * ( 1.0 - Z ) * uColumn;
      float sum = ( shell * 2.0 + fill + column ) * 1.4;
      // Filaments: rays of denser spray fanning out from the vent,
      // uneven in strength and spacing.
      float a = atan( X, Z + 0.15 ) * 9.0 + uSeed;
      float fa = floor( a ), fr = fract( a );
      float h0 = fract( sin( fa * 12.9898 + uSeed ) * 43758.5 ), h1 = fract( sin( ( fa + 1.0 ) * 12.9898 + uSeed ) * 43758.5 );
      float ray = mix( h0, h1, fr * fr * ( 3.0 - 2.0 * fr ) );
      sum *= 0.6 + 0.5 * ray;
      // Soft at the sheet's own edges.
      sum *= smoothstep( 1.0, 0.94, abs( X ) ) * smoothstep( 1.0, 0.9, Z );
      // Forward scattering, Henyey–Greenstein with g = 0.6.
      float c = dot( normalize( vW - cameraPosition ), normalize( uSun ) );
      float hg = 0.16 / pow( 1.36 - 1.2 * c, 1.5 );
      gl_FragColor = vec4( uCol * sum * ( 0.12 + hg ) * uGain, 1.0 );
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`;
  return {
    // specs: [{ brg (°), dist (m), H (m), W (canopy radius, m), shell, column, col, gain }]
    set(specs) {
      for (const p of live) { group.remove(p.mesh); p.mesh.material.dispose(); }
      live = (specs || []).map((sp, i) => {
        const b = sp.brg * DEG;
        const mat = new THREE.ShaderMaterial({
          uniforms: {
            uSun: { value: new THREE.Vector3() }, uCol: { value: new THREE.Vector3(...sp.col) },
            uGain: { value: sp.gain }, uShell: { value: sp.shell }, uColumn: { value: sp.column },
            uSeed: { value: i * 2.7 + 1.3 },
          },
          vertexShader: vs, fragmentShader: fs,
          transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.frustumCulled = false;
        mesh.renderOrder = -1;
        group.add(mesh);
        return { mesh, x: Math.sin(b) * sp.dist, z: -Math.cos(b) * sp.dist, H: sp.H, W: sp.W, gain: sp.gain };
      });
    },
    // Once a frame, from the camera. `lit` is how much of the plume the
    // sun still reaches, and `units` the key's (a plume is sunlit even
    // when you stand in the night).
    update(cam, groundY, lit, units) {
      for (const p of live) {
        const dx = p.x - cam.x, dz = p.z - cam.z, D = Math.hypot(dx, dz), k = PROXY / D;
        // The plume's foot, sunk by the curve of the planet between.
        const foot = Math.atan2(-(D * D) / (2 * WORLD.R) - (cam.y - groundY), D);
        p.mesh.position.set(cam.x + dx * k, cam.y + PROXY * Math.tan(foot), cam.z + dz * k);
        p.mesh.scale.set(p.W * k, p.H * k, 1);
        p.mesh.rotation.set(0, Math.atan2(-dx, -dz), 0);
        const u = p.mesh.material.uniforms;
        u.uSun.value.copy(SUN_DIR);
        u.uGain.value = p.gain * lit * units;
      }
    },
    get on() { return live.length > 0; },
  };
})();
