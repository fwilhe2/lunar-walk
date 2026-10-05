import * as THREE from 'three';
import { hdrSqueeze } from '../render/hdr';
import { scene } from '../render/renderer';

/* ── The Martian sky ────────────────────────────────────────────
   Mars has weather but almost no air: 6 mbar of CO₂ scatters
   next to nothing on its own. What you see is the dust it
   carries — a micron-sized ferric aerosol with an optical depth
   around 0.5 even on a clear sol.

   That gives Mars a sky which is the inverse of Earth's in every
   respect. Dust scatters long wavelengths, so the bulk of the sky
   is butterscotch instead of blue. But the particles are large
   compared to the wavelength, so their forward-scattering lobe is
   narrow and comparatively neutral, and it piles up in a halo a
   few degrees around the sun — which therefore reads *blue*
   against an orange sky, and turns the sunsets blue. Nobody
   predicted it; Viking 1 photographed it in 1976.

   Brightness scales with how much lit dust is in the column, so
   the whole dome dims and deepens as the sun goes down.

   The sky is the air in front of everything beyond it, not a
   backdrop behind it, so the function is shared: the dome draws it
   where nothing else is, and every companion body adds it over
   itself (sky/companions.ts) through the same uniforms. On a world without a sky
   the gain and the optical depth are zeroed, not just the dome
   hidden, so the companions see no air there either.             */
export const skyDome = (() => {
  const uniforms = {
    uSun: { value: new THREE.Vector3(0, 1, 0) },   // normalized in GLSL, so never zero
    uZenith: { value: new THREE.Color() },
    uHorizon: { value: new THREE.Color() },
    uAureole: { value: new THREE.Color() },
    uK: { value: 62 },
    uAmt: { value: 0.9 },
    uGain: { value: 0 },
    uTau: { value: 0 },
  };
  const glsl = `
    uniform vec3 uSun, uZenith, uHorizon, uAureole;
    uniform float uK, uAmt, uGain, uTau;

    // t is how much of the horizon's long dust column is in the line
    // of sight (1 at the horizon); the dust devils (effects/devils.ts)
    // ask for the horizon's at every elevation.
    vec3 skyRadianceT( vec3 D, float t ) {
      vec3 col = mix( uZenith, uHorizon, t );

      // The forward-scattering halo: on Mars narrow, strong and
      // bluer than the sky it sits in. On Venus uK drops to ~1
      // and uAmt to a third, which is the other extreme of the
      // same term — thirty optical depths of multiple scattering
      // leave the sun as a vague brightening over half the sky,
      // and no disc at all.
      float ca = max( dot( D, normalize( uSun ) ), 0.0 );
      float halo = pow( ca, uK ) + 0.30 * pow( ca, 7.0 );
      col = mix( col, uAureole, clamp( halo, 0.0, 1.0 ) * uAmt );

      // Below the horizon it becomes ground haze, so no seam
      // shows when you look down from altitude.
      col *= 1.0 - smoothstep( 0.0, -0.12, D.y ) * 0.45;
      return col * uGain;
    }
    vec3 skyRadiance( vec3 D ) {
      // The dust column is longest along the horizon, so that is
      // where the scattered light piles up.
      return skyRadianceT( D, pow( 1.0 - clamp( D.y, 0.0, 1.0 ), 2.6 ) );
    }

    // What the air lets through along D, from a body beyond it. The
    // airmass is 1/sin(elevation) for flat layers; the constant
    // stands in for the planet's curve, which holds it near twenty
    // at the horizon instead of letting it run to infinity.
    float skyTrans( vec3 D ) {
      float mu = max( D.y, 0.0 );
      return exp( -uTau / sqrt( mu * mu + 0.002 ) );
    }
  `;
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(40000, 32, 20),
    hdrSqueeze(new THREE.ShaderMaterial({
      uniforms, side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
        }`,
      fragmentShader: glsl + `
        varying vec3 vDir;
        void main() {
          gl_FragColor = vec4( skyRadiance( normalize( vDir ) ), 1.0 );
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    }))
  );
  mesh.renderOrder = -4;
  mesh.frustumCulled = false;
  mesh.visible = false;
  mesh.layers.enable(1);
  scene.add(mesh);
  return { mesh, uniforms, glsl };
})();
