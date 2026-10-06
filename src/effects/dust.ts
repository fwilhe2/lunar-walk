import * as THREE from 'three';
import { hdrSqueeze } from '../render/hdr';
import { SUN_DIR, ambLight, hemiLight, sun, sunFar } from '../render/lights';
import { camera, renderer, scene } from '../render/renderer';
import { uSunView } from '../surface/ground';
import { GLSL, TS } from '../surface/shaders';
import { world } from '../worlds/index';
import { TypedShaderMaterial } from '../util/three';

/* ═════════════════════════════════════════════════════════════
   DUST — in vacuum it flies in clean parabolas and never
   billows, which is the tell that you are not on Earth. Every
   grain follows the same trajectory regardless of size, lands,
   and stops. That is the Moon, Phobos and Deimos.

   Mars is one exception. Six millibars is not much, but it is not
   nothing: fine grains feel drag, so the plume lags, spreads and
   hangs instead of dropping — the difference you can see between
   an Apollo boot kick and a Curiosity wheel scuff.

   Venus is the other, four orders of magnitude further along. At
   65 kg/m³ the air is a twentieth the density of water, and a
   50 µm grain of basalt settles through it at about 20 cm/s. Kick
   the soil there and it does not fly anywhere: it stands up in a
   slow cloud around your boots and takes most of a minute to come
   back down.
   ═════════════════════════════════════════════════════════════ */
const _ac = new THREE.Color();
export const dust = (() => {
  /* Grains, not blobs. Real regolith is mostly finer than you can see —
     the median grain is sixty microns — so what the eye picks out of a
     plume is a haze of fines and, in it, a scatter of clods. Each point
     here stands for a clump, its size drawn log-normally around 6 mm
     (a couple of millimetres to two centimetres), its albedo a little
     different from its neighbours'. A grain smaller than a pixel is not
     blown up to one: it is drawn that much fainter, so thousands of
     fines read as a veil, not as sand.

     Size matters only where there is air. In vacuum every grain flies
     the same parabola; on Mars and Venus Stokes drag goes as 1/d², so
     the fines hang and drift while the clods drop out of the cloud —
     per grain around the world's own dustDrag, which is the median's. */
  const N = 32000;
  const D_MED = 0.006;
  const pos = new Float32Array(N * 3).fill(-9999);
  const vel = new Float32Array(N * 3);
  const life = new Float32Array(N);
  const floor = new Float32Array(N);    // well under where it took off: past this it is gone
  const dragK = new Float32Array(N);    // drag relative to the median grain
  const size = new Float32Array(N), tone = new Float32Array(N);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('aSize', new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('aTone', new THREE.BufferAttribute(tone, 1).setUsage(THREE.DynamicDrawUsage));
  // Lit like everything else on the ground: sunlight where the terrain
  // lets it through, the bounce fill where it does not. A grain in a
  // crater's shadow is as dark as the floor it came off.
  const dustMat = new TypedShaderMaterial({
    uniforms: Object.assign({
      color: { value: new THREE.Color(0xada79f) },
      uSun: { value: new THREE.Color() }, uFill: { value: new THREE.Color() },
      uSunDir: { value: SUN_DIR }, uSunView,
      uScale: { value: 400 },
      // The sun's two shadow cascades (render/lights.ts), sampled by hand: rover,
      // rocks and walker shade the dust that flies through their shadow.
      uShOn: { value: 0 },
      uShNear: new THREE.Uniform<THREE.Texture | null>(null), uShNearM: { value: sun.shadow.matrix },
      uShFar: new THREE.Uniform<THREE.Texture | null>(null), uShFarM: { value: sunFar.shadow.matrix },
    }, TS),
    vertexShader: `
      attribute float aSize, aTone;
      uniform float uScale;
      varying vec3 vWPos;
      varying float vCover, vTone, vPx, vSize, vPuff;
      void main() {
        vec4 mv = modelViewMatrix * vec4( position, 1.0 );
        vWPos = ( modelMatrix * vec4( position, 1.0 ) ).xyz;
        // The finer half is not drawn as grains at all but as what a
        // handful of fines makes in the air: a soft, thin puff a few
        // centimetres across. Overlapping, they are the veil; the clods
        // stay hard little stones in it.
        vPuff = step( aSize, 0.005 );
        float px = aSize * mix( 1.0, 8.0, vPuff ) * uScale / -mv.z;   // diameter on screen, pixels
        gl_PointSize = max( px, 1.5 );
        // Shrinking below a pixel, a point thins out with its size.
        vCover = min( 1.0, px / 1.5 ) * mix( 1.0, 0.3, vPuff );
        vPx = px;
        vSize = aSize;
        vTone = aTone;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: GLSL.TS + `
      #include <packing>
      uniform vec3 color, uSun, uFill, uSunDir, uSunView;
      uniform float uShOn;
      uniform sampler2D uShNear, uShFar;
      uniform mat4 uShNearM, uShFarM;
      varying float vCover, vTone, vPx, vSize, vPuff;
      // Four taps half a texel apart: the maps are 2048², a grain is
      // far smaller than a texel, and one tap would snap on and off.
      float shTaps( sampler2D map, vec3 q, float bias ) {
        vec2 t = vec2( 0.5 / 2048.0, 0.0 );
        return 0.25 * ( step( q.z + bias, unpackRGBAToDepth( texture2D( map, q.xy + t.xy ) ) )
                      + step( q.z + bias, unpackRGBAToDepth( texture2D( map, q.xy - t.xy ) ) )
                      + step( q.z + bias, unpackRGBAToDepth( texture2D( map, q.xy + t.yx ) ) )
                      + step( q.z + bias, unpackRGBAToDepth( texture2D( map, q.xy - t.yx ) ) ) );
      }
      float objShadow() {
        if ( uShOn < 0.5 ) return 1.0;
        vec3 q = ( uShNearM * vec4( vWPos, 1.0 ) ).xyz;
        if ( all( greaterThan( q, vec3( 0.0 ) ) ) && all( lessThan( q, vec3( 1.0 ) ) ) ) return shTaps( uShNear, q, -0.0002 );
        q = ( uShFarM * vec4( vWPos, 1.0 ) ).xyz;
        if ( all( greaterThan( q, vec3( 0.0 ) ) ) && all( lessThan( q, vec3( 1.0 ) ) ) ) return shTaps( uShFar, q, -0.0003 );
        return 1.0;
      }
      void main() {
        vec2 d = gl_PointCoord - 0.5;
        // A clod is not round: a lumpy outline, different per grain.
        float ang = atan( d.y, d.x ), seed = vTone * 37.0;
        float rim = 0.5 * ( 0.82 + 0.1 * sin( 3.0 * ang + seed ) + 0.08 * sin( 5.0 * ang - seed * 1.7 ) );
        float r = length( d );
        if ( vPuff > 0.5 ) rim = 0.5;
        if ( r > rim ) discard;
        float sun = terrainShadow( vWPos, true ) * objShadow();
        // A grain is a small rough sphere, lit on one side. Big enough to
        // show that, it is shaded per pixel, with a lumpy normal; too
        // small, only its average over the disc counts, which for a
        // Lambert sphere is 2/3 of the phase function — full with the sun
        // behind you, a thin crescent into it. So a plume thrown up at a
        // low sun shines against the grazing-lit ground looking down-sun
        // and hangs dark against it looking up-sun.
        float g = acos( clamp( dot( uSunDir, normalize( cameraPosition - vWPos ) ), -1.0, 1.0 ) );
        float avg = 0.667 * ( sin( g ) + ( 3.14159265 - g ) * cos( g ) ) / 3.14159265;
        vec2 e = d / rim;
        vec3 N = vec3( e.x, -e.y, sqrt( max( 0.0, 1.0 - dot( e, e ) ) ) );
        N = normalize( N + 0.35 * vec3( sin( 9.0 * e.y + seed ), sin( 7.0 * e.x - seed ), 0.0 ) );
        float lit = mix( avg, max( dot( N, normalize( uSunView ) ), 0.0 ), smoothstep( 2.5, 6.0, vPx ) * ( 1.0 - vPuff ) );
        // Fines scatter forward. A clump of sixty-micron grains is not an
        // opaque ball: much of the light it catches is diffracted a few
        // degrees on past it, so a plume seen against the sun lights up —
        // the lunar horizon glow, at arm's length. Henyey–Greenstein with
        // g = 0.6: broad enough that a plume seen across the sun, not
        // only straight into it, still lights up. Strongest in the
        // finest grains, nothing in the clods.
        float cs = -cos( g );                         // cosine of the scattering angle
        float hg = 0.64 / ( 12.566 * pow( 1.36 - 1.2 * cs, 1.5 ) );
        float fine = 1.0 - smoothstep( 0.003, 0.012, vSize );
        lit += fine * 1.5 * 3.14159265 * hg;
        // …and are brighter to begin with. What a wheel throws is the
        // loose top layer and freshly broken grains, and finer and
        // fresher regolith has a higher albedo than the mature soil it
        // lands on — in the Apollo films the arcs are lighter than the
        // ground: clods by a third, fines about twice.
        lit *= 1.3 + 0.7 * fine;
        float edge = vPuff > 0.5 ? exp( -16.0 * r * r ) : 1.0 - smoothstep( rim * rim * 0.5, rim * rim, r * r );
        gl_FragColor = vec4( color * vTone * ( uSun * sun * lit + uFill ) * 0.3183, 0.9 * vCover * edge );
      }`,
    transparent: true, depthWrite: false,
  });
  // Squeezed like the ground under it (render/hdr.ts): a grain lit
  // from behind exposes to several units, and drawn over squeezed
  // ground unsqueezed it would be blown up when the frame is undone.
  hdrSqueeze(dustMat);
  const pts = new THREE.Points(g, dustMat);
  pts.frustumCulled = false;
  scene.add(pts);
  let cursor = 0, fresh = false;

  function emit(x: number, y: number, z: number, vx: number, vy: number, vz: number, t: number, ground: number) {
    const k = cursor = (cursor + 1) % N;
    pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = z;
    vel[k * 3] = vx; vel[k * 3 + 1] = vy; vel[k * 3 + 2] = vz;
    life[k] = t * (world.dustLife || 1);
    floor[k] = ground - 1.5;
    // Log-normal: the sum of three uniforms is near enough a gaussian.
    const n = (Math.random() + Math.random() + Math.random() - 1.5) * 2;
    const d = Math.min(0.02, Math.max(0.0015, D_MED * Math.exp(0.8 * n)));
    size[k] = d;
    dragK[k] = Math.min(5, Math.max(0.2, (D_MED / d) ** 1.5));
    tone[k] = 0.7 + Math.random() * 0.6;
    fresh = true;
  }

  return {
    material: dustMat,
    // Once a frame: the light the grains are lit by, and the scale that
    // turns a grain's size into pixels.
    light() {
      const u = dustMat.uniforms;
      u.uSun.value.copy(sun.color).multiplyScalar(sun.intensity);
      u.uFill.value.copy(hemiLight.color).add(hemiLight.groundColor).multiplyScalar(0.5 * hemiLight.intensity)
        .add(_ac.copy(ambLight.color).multiplyScalar(ambLight.intensity));
      u.uScale.value = renderer.domElement.height / (2 * Math.tan(camera.fov * Math.PI / 360));
      const on = sun.castShadow && sun.shadow.map && sunFar.shadow.map;
      u.uShOn.value = on ? 1 : 0;
      if (on) { u.uShNear.value = sun.shadow.map!.texture; u.uShFar.value = sunFar.shadow.map!.texture; }   // on: both maps exist
    },
    clear() {
      life.fill(0);
      for (let k = 0; k < N; k++) pos[k * 3 + 1] = -9999;
      g.attributes.position!.needsUpdate = true;   // set above, as are aSize and aTone
    },
    // One grain, launched exactly: for sprays whose shape is worked
    // out by the caller (the rover's wheels). ground is the surface it
    // left from.
    grain(x: number, y: number, z: number, vx: number, vy: number, vz: number, ground: number) {
      if (world.sea !== undefined && y < world.sea) return;
      emit(x, y, z, vx, vy, vz, 2.5 + Math.random() * 1.5, ground);
    },
    // A boot's toe-off: the sole sweeps forward and up out of the soil
    // at about twice your speed and throws a narrow fan of it ahead,
    // which in vacuum flies in clean arcs a metre or so long — the
    // spray in front of every Apollo crewman's boots.
    kick(x: number, y: number, z: number, dirX: number, dirZ: number, speed: number) {
      if (world.sea !== undefined && y < world.sea) return;   // under a sea nothing flies
      const n = Math.min(90, Math.floor(18 + speed * 40));
      for (let i = 0; i < n; i++) {
        const a = Math.atan2(dirZ, dirX) + (Math.random() - 0.5) * 0.8;
        const el = 0.25 + Math.random() * 0.5, sp = speed * (0.6 + Math.random() * 1.4);
        emit(x + (Math.random() - 0.5) * 0.12, y + 0.02, z + (Math.random() - 0.5) * 0.12,
             Math.cos(a) * Math.cos(el) * sp, Math.sin(el) * sp, Math.sin(a) * Math.cos(el) * sp,
             1.5 + Math.random() * 1.4, y);
      }
    },
    burst(x: number, y: number, z: number, power: number, dirX = 0, dirZ = 0) {
      if (world.sea !== undefined && y < world.sea) return;
      const n = Math.min(420, Math.floor(60 + power * 165));
      for (let i = 0; i < n; i++) {
        const a = Math.random() * 6.283, sp = (0.5 + Math.random() * 2.4) * (0.5 + power);
        emit(x + Math.cos(a) * 0.15, y + 0.03, z + Math.sin(a) * 0.15,
             Math.cos(a) * sp * 0.6 + dirX * (0.5 + Math.random()),
             (0.4 + Math.random() * 1.5) * (0.4 + power),
             Math.sin(a) * sp * 0.6 + dirZ * (0.5 + Math.random()),
             1.5 + Math.random() * 1.4, y);
      }
    },
    update(dt: number, gravity: number, drag: number) {
      let dirty = fresh;
      // Stokes drag, linear in velocity, integrated in closed form
      // rather than stepped: on Mars the two agree to four decimals,
      // but Venus needs a drag coefficient of 44 to settle a grain at
      // 20 cm/s, and (1 - k·dt) goes negative at anything under 23
      // frames a second. The exponential cannot.
      //
      // vT is where that balance lands — the terminal velocity, which
      // in vacuum is infinite and here is a crawl.
      //
      // k < N, and every array holds N grains (one or three floats each).
      for (let k = 0; k < N; k++) {
        if (life[k]! <= 0) continue;
        life[k]! -= dt;
        if (drag > 0) {
          const kd = drag * dragK[k]!, k1 = Math.exp(-kd * dt), vT = gravity / kd;
          vel[k * 3]! *= k1;
          vel[k * 3 + 1] = (vel[k * 3 + 1]! + vT) * k1 - vT;
          vel[k * 3 + 2]! *= k1;
        } else {
          vel[k * 3 + 1]! -= gravity * dt;
        }
        pos[k * 3]! += vel[k * 3]! * dt;
        pos[k * 3 + 1]! += vel[k * 3 + 1]! * dt;
        pos[k * 3 + 2]! += vel[k * 3 + 2]! * dt;
        // Landed grains sink out of sight behind the ground's depth;
        // well below where they started, stop computing them.
        if (pos[k * 3 + 1]! < floor[k]!) life[k] = 0;
        if (life[k]! <= 0) pos[k * 3 + 1] = -9999;
        dirty = true;
      }
      if (dirty) g.attributes.position!.needsUpdate = true;
      if (fresh) {
        g.attributes.aSize!.needsUpdate = true;
        g.attributes.aTone!.needsUpdate = true;
        fresh = false;
      }
    },
  };
})();
