import * as THREE from 'three';
import { terrainHeight } from '../kernel/terrain';
import { WORLD } from '../kernel/world';
import { SUN_DIR, sunElev } from '../render/lights';
import { scene } from '../render/renderer';
import { curveAX, curveAZ, dropAt } from '../terrain/anchor';
import { EN_OX, EN_OZ, EN_TC, EN_TS, enStripe } from '../worlds/enceladus/terrain';
import { world } from '../worlds/index';

/* ── Jet curtains ───────────────────────────────────────────────
   Enceladus's jets are not a plume on the horizon but a wall standing
   out of the tiger stripe beside you: some hundred jets along each
   stripe, spaced a kilometre or so apart and each spreading as it
   rises, merging into a curtain of spray a few hundred kilometres high
   that feeds the E ring (Spitale et al. 2015). Ice grains a few microns
   across scatter strongly forward, so like Io's plumes it blazes looking
   toward the sun and is faint with the sun behind you.

   It stands on the stripe's own trough, followed from the kernel
   (enStripe) along 50 km of it, as a ribbon of quads whose foot sits
   on the drawn ground, curvature drop included. Each jet is a Gaussian
   across the ribbon widening with height, and the sheet brightens as
   you look along it, where the line of sight runs through more of it. */
export const curtains = (() => {
  let mesh = null, ax = NaN, az = NaN;
  const H = 90000, LEN = 50000, STEP = 1250;
  const mat = new THREE.ShaderMaterial({
    uniforms: { uSun: { value: new THREE.Vector3() }, uGain: { value: 1 }, uShadowZ: { value: -1 } },
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide,
    vertexShader: `
      attribute vec3 nrm;
      varying vec2 vS; varying vec3 vW; varying vec3 vN;
      void main() {
        vS = uv; vN = nrm;
        vW = ( modelMatrix * vec4( position, 1.0 ) ).xyz;
        gl_Position = projectionMatrix * viewMatrix * vec4( vW, 1.0 );
      }`,
    fragmentShader: `
      uniform vec3 uSun; uniform float uGain, uShadowZ;
      varying vec2 vS; varying vec3 vW; varying vec3 vN;
      float hs( float k ) { return fract( sin( k * 91.345 + 7.13 ) * 43758.5453 ); }
      void main() {
        float s = vS.x, z = max( vS.y, 0.0 );
        // Each jet spreads at about 12° either side as it rises.
        float w = 120.0 + z * 0.21;
        const float cell = 1100.0;
        float k0 = floor( s / cell ) - 12.0, sum = 0.0;
        for ( int i = 0; i < 25; i ++ ) {
          float k = k0 + float( i ), h = hs( k );
          if ( h < 0.3 ) continue;
          float c = ( k + 0.15 + 0.7 * fract( h * 17.3 ) ) * cell;
          float d = ( s - c ) / w;
          sum += exp( -d * d ) * ( h - 0.25 ) / w;
        }
        // High up the jets have merged: fade to their mean.
        sum = mix( sum, 0.45 / cell, smoothstep( 1500.0, 5000.0, w ) );
        float dens = sum * cell * exp( -z / 18000.0 ) + 0.05 * exp( -z / 40000.0 );
        // After sunset the moon's shadow climbs the curtain from below.
        dens *= smoothstep( uShadowZ, uShadowZ * 1.15 + 500.0, z );
        // Ends of the ribbon, and the first few hundred metres, where
        // the jets leave the trough, soft.
        dens *= smoothstep( 0.0, 6000.0, s ) * smoothstep( ${LEN.toFixed(1)}, ${(LEN - 6000).toFixed(1)}, s ) * smoothstep( 0.0, 400.0, z );
        vec3 V = normalize( vW - cameraPosition );
        // Brighter seen along the sheet, where the sight line runs through
        // more of it — up to the sheet's own thickness, which this flat
        // ribbon lacks: so where it folds edge-on it fades instead.
        float vd = abs( dot( V, normalize( vN ) ) ), fe = smoothstep( 0.0, 0.3, vd );
        float along = fe / max( vd, 0.35 ) + 0.5 * ( 1.0 - fe );
        // Henyey–Greenstein, g = 0.75: small grains, strongly forward.
        float c = dot( V, normalize( uSun ) );
        float hg = 0.0273 / pow( 1.5625 - 1.5 * c, 1.5 );
        gl_FragColor = vec4( vec3( 0.86, 0.92, 1.0 ) * dens * along * ( 0.03 + hg ) * uGain, 1.0 );
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  // The ribbon's foot and top along the stripe; y is refreshed when the
  // curvature anchor moves.
  let foot = [];
  function place() {
    const pos = mesh.geometry.attributes.position;
    for (let i = 0; i < foot.length; i++) {
      const [x, z, h] = foot[i], y = h - dropAt(x, z);
      pos.setXYZ(i * 2, x, y, z);
      pos.setXYZ(i * 2 + 1, x, y + H, z);
    }
    pos.needsUpdate = true;
    ax = curveAX; az = curveAZ;
  }
  return {
    // Along the stripe nearest the site, from the kernel.
    set(on) {
      if (mesh) { scene.remove(mesh); mesh.geometry.dispose(); mesh = null; }
      if (!on) return;
      const tS = (0 + EN_OZ) * EN_TC - (0 + EN_OX) * EN_TS;
      const c0 = tS - enStripe(EN_OX, EN_OZ);             // the site's own stripe
      foot = [];
      const n = Math.round(LEN / STEP);
      const sS = (EN_OX) * EN_TC + (EN_OZ) * EN_TS;
      for (let i = 0; i <= n; i++) {
        const sv = sS - LEN / 2 + i * STEP;
        // The centreline at this s: t - enStripe(t) is the stripe's c.
        let px = sv * EN_TC - c0 * EN_TS, pz = sv * EN_TS + c0 * EN_TC;
        const c = c0 - enStripe(px, pz);
        px = sv * EN_TC - c * EN_TS; pz = sv * EN_TS + c * EN_TC;
        const x = px - EN_OX, z = pz - EN_OZ;
        foot.push([x, z, terrainHeight(x, z) - 60]);
      }
      const N = foot.length, pos = new Float32Array(N * 6), uv = new Float32Array(N * 4), nrm = new Float32Array(N * 6), idx = [];
      for (let i = 0; i < N; i++) {
        const a = foot[Math.max(0, i - 1)], b = foot[Math.min(N - 1, i + 1)];
        const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1;
        for (const k of [0, 1]) {
          uv[(i * 2 + k) * 2] = i * STEP; uv[(i * 2 + k) * 2 + 1] = k * H;
          nrm[(i * 2 + k) * 3] = -dz / l; nrm[(i * 2 + k) * 3 + 2] = dx / l;
        }
        if (i < N - 1) idx.push(i * 2, i * 2 + 2, i * 2 + 1, i * 2 + 1, i * 2 + 2, i * 2 + 3);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      g.setAttribute('nrm', new THREE.BufferAttribute(nrm, 3));
      g.setIndex(idx);
      mesh = new THREE.Mesh(g, mat);
      mesh.frustumCulled = false;
      mesh.renderOrder = -1;
      scene.add(mesh);
      place();
    },
    // units: the key's. Below the horizon the sun still reaches the
    // curtain above the height where the moon's shadow ends.
    update(units) {
      if (!mesh) return;
      if (curveAX !== ax || curveAZ !== az) place();
      mat.uniforms.uSun.value.copy(SUN_DIR);
      mat.uniforms.uGain.value = (world.curtain || 0) * units;
      mat.uniforms.uShadowZ.value = sunElev < 0 ? WORLD.R * (1 / Math.cos(sunElev) - 1) : -1;
    },
  };
})();
