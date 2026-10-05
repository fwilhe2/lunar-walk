import * as THREE from 'three';
import { fbm, hash2, ridged } from '../kernel/noise';
import { SUN_AZ, SUN_DIR, sunElev } from '../render/lights';
import { scene } from '../render/renderer';
import { world, worldId } from '../worlds/index';

/* ═════════════════════════════════════════════════════════════
   7. SKY — the Milky Way, nine thousand stars, the sun, and
   whatever else is overhead.

   On the three airless bodies there is no twinkling, no skyglow,
   and star colour can be shown honestly: blackbody tints from
   M-red to O-blue. On the two with air the whole star field is
   switched off and a scattering dome switched on — six millibars
   of CO₂ carrying a micron of dust is already more than enough to
   drown every star in the Martian sky at midday, and Venus puts
   twenty kilometres of cloud on top of ninety-two bar, which
   drowns the sun as well.
   ═════════════════════════════════════════════════════════════ */
export const skyGroup = new THREE.Group();
scene.add(skyGroup);
// The galactic plane crosses the sky at a slant.
skyGroup.rotation.set(1.02, 0.2, 0.45);

function milkyWay() {
  const W = 1024, H = 320;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    const v = y / H - 0.5;
    for (let x = 0; x < W; x++) {
      const u = x / W;
      const i = (y * W + x) * 4;
      // Band profile, widening and brightening toward the bulge.
      const bulge = Math.exp(-Math.pow((u - 0.30) / 0.10, 2));
      const width = 0.10 + fbm(u * 14, 3.7, 3) * 0.10 + bulge * 0.10;
      let band = Math.exp(-(v * v) / (width * width)) * (0.55 + bulge * 0.9);
      // Star clouds: patchy, stretched along the band.
      band *= 0.45 + fbm(u * 26 + 9, v * 9 + 2, 4) * 0.9;
      // Dark dust lanes carved out of the middle.
      const dust = ridged(u * 21 + 40, v * 5.2 - 11, 4)
                 * Math.exp(-(v * v) / (width * width * 0.35));
      band *= 1 - Math.min(0.92, dust * 1.35);
      band = Math.max(0, band);
      // A faintly warm core; the arms stay silver-blue. The whole
      // band is dim — it should read only once your eye leaves the
      // sunlit ground.
      const warm = 0.2 + bulge * 0.5;
      img.data[i]     = Math.min(255, band * (88 + warm * 46));
      img.data[i + 1] = Math.min(255, band * (90 + warm * 26));
      img.data[i + 2] = Math.min(255, band * (104 + warm * 4));
      // Unresolved star speckle, kept subtle: the crisp stars are
      // drawn as points elsewhere.
      if (hash2(x, y) > 0.9985) {
        const s2 = (30 + hash2(y, x) * 60) * (0.4 + band);
        img.data[i] = Math.min(255, img.data[i] + s2);
        img.data[i + 1] = Math.min(255, img.data[i + 1] + s2);
        img.data[i + 2] = Math.min(255, img.data[i + 2] + s2);
      }
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;

  // A band, not a full sphere: a torus-like strip around the sky.
  const geo = new THREE.CylinderGeometry(20000, 20000, 13000, 64, 1, true);
  const mat = new THREE.MeshBasicMaterial({
    map: tex, side: THREE.BackSide, transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  });
  mat.opacity = 0.34;
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = -3;
  return mesh;
}
export const milkyWayMesh = milkyWay();
skyGroup.add(milkyWayMesh);

/* ── Zodiacal light ─────────────────────────────────────────────
   Sunlight scattered by the interplanetary dust: a cone of light along
   the ecliptic, brightest toward the sun and falling off as about the
   2.3rd power of elongation, narrower near the sun than far from it,
   with the faint gegenschein opposite (Leinert et al. 1998). From
   Earth's surface the air hides it but for an hour after dusk; on an
   airless world it stands over the place the sun set as soon as the
   sun is gone and the eye has opened — the cone the Apollo crews
   sketched from orbit. At 30° from the sun, on the ecliptic, it is
   about twice the Milky Way's brightest; its gain is tied to the Milky
   Way's, whose own is per world (starGain). The dust thins and the
   sunlight on it weakens outward, so seen from distance r it scales
   about as r^-2.3: nine times brighter from Mercury, a fiftieth from
   Jupiter's moons, nothing worth drawing beyond.

   The ecliptic here is the plane the sun moves in, the vertical
   circle through SUN_AZ. */
const ZODI_AU = { mercury: 0.387, moon: 1, phobos: 1.524, deimos: 1.524, vesta: 2.36, ceres: 2.77,
  io: 5.2, europa: 5.2, ganymede: 5.2, callisto: 5.2 };
export const zodiacal = (() => {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uSun: { value: new THREE.Vector3() }, uN: { value: new THREE.Vector3() }, uGain: { value: 0 } },
    vertexShader: `
      varying vec3 vD;
      void main() {
        vD = normalize( ( modelMatrix * vec4( position, 0.0 ) ).xyz );
        gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
      }`,
    fragmentShader: `
      uniform vec3 uSun, uN; uniform float uGain;
      varying vec3 vD;
      void main() {
        vec3 d = normalize( vD );
        float e = acos( clamp( dot( d, uSun ), -1.0, 1.0 ) );          // elongation
        float b = abs( asin( clamp( dot( d, uN ), -1.0, 1.0 ) ) );       // ecliptic latitude
        float ed = max( e, 0.06 ) * 57.2958;
        float w = ( 6.0 + 0.22 * ed ) / 57.2958;
        float I = pow( max( ed, 10.0 ) / 30.0, -2.3 ) * exp( - b / w );
        // The gegenschein: a soft brightening round the antisolar point.
        float g = 3.1416 - e;
        I += 0.08 * exp( - ( g * g + b * b ) / 0.012 );
        // Inside a few degrees it merges with the corona's glare.
        I *= smoothstep( 0.03, 0.09, e );
        gl_FragColor = vec4( vec3( 1.0, 0.95, 0.86 ) * I * uGain, 1.0 );
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(19000, 48, 24), mat);
  mesh.renderOrder = -3;
  mesh.frustumCulled = false;
  scene.add(mesh);
  return {
    mesh,
    // Once a frame, after the sky has followed the camera.
    update(cam, gain) {
      mesh.position.copy(cam);
      mat.uniforms.uSun.value.copy(SUN_DIR);
      mat.uniforms.uN.value.set(-Math.sin(SUN_AZ), 0, Math.cos(SUN_AZ));
      const au = ZODI_AU[worldId];
      mesh.visible = !!au && !world.air;
      // By day the star gain, which was never physical, would raise the
      // glow near the sun far past what an eye on sunlit ground sees:
      // the cone comes out as the sun goes down.
      mat.uniforms.uGain.value = au ? gain * 0.35 * Math.pow(au, -2.3) * (1 - THREE.MathUtils.smoothstep(sunElev, -0.02, 0.08)) : 0;
    },
  };
})();

export const starPoints = (() => {
  const N = 9000;
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
  const size = new Float32Array(N);
  let s = 777; const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let i = 0; i < N; i++) {
    const u = rnd() * 2 - 1, th = rnd() * Math.PI * 2;
    const r = Math.sqrt(1 - u * u), R = 21000;
    pos[i * 3] = Math.cos(th) * r * R; pos[i * 3 + 1] = u * R; pos[i * 3 + 2] = Math.sin(th) * r * R;

    // Magnitude power law: a handful of beacons, thousands at the
    // edge of visibility.
    const b = Math.pow(rnd(), 3.4);
    size[i] = 1.1 + b * 5.2;
    // Blackbody tint: dim stars skew red, bright ones skew blue.
    const t = Math.pow(rnd(), 1.6) * (0.35 + b * 0.65);
    const cr = 1.0 - t * 0.28, cg = 0.92 - Math.abs(t - 0.45) * 0.2, cb = 0.72 + t * 0.3;
    const lum = 0.35 + b * 0.65;
    col[i * 3] = cr * lum; col[i * 3 + 1] = cg * lum; col[i * 3 + 2] = cb * lum;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  const starMat = new THREE.ShaderMaterial({
    uniforms: { uGain: { value: 1 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `
      attribute float aSize;
      varying vec3 vC;
      void main() {
        vC = color;
        gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
        gl_PointSize = aSize;
      }`,
    fragmentShader: `
      uniform float uGain;
      varying vec3 vC;
      void main() {
        float d = length( gl_PointCoord - 0.5 );
        float a = pow( smoothstep( 0.5, 0.08, d ), 1.6 );
        gl_FragColor = vec4( vC * uGain, a );
      }`,
    vertexColors: true,
  });
  const stars = new THREE.Points(g, starMat);
  stars.renderOrder = -2;
  skyGroup.add(stars);
  return stars;
})();
