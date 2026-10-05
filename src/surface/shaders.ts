import * as THREE from 'three';
import { KEY_XZ } from '../render/lights';

// Terrain horizon maps: four nested levels, written by terrain/shadows.ts and read
// by everything standing on the ground.
export const TS = {
  tsHz0: { value: null }, tsHz1: { value: null }, tsHz2: { value: null }, tsHz3: { value: null },
  tsLv: { value: [0, 1, 2, 3].map(() => new THREE.Vector4(0, 0, 1, 0)) },   // (cx, cz, span, refY)
  tsSun: { value: new THREE.Vector4(0.28, 0.0046, 0, 0) },   // (tan elev, angular radius, on, –)
  sunXZ: { value: KEY_XZ },
};

export const GLSL_TS = `
uniform sampler2D tsHz0, tsHz1, tsHz2, tsHz3;
uniform vec4 tsLv[ 4 ];
uniform vec4 tsSun;
uniform vec2 sunXZ;
varying vec3 vWPos;

vec2 tsUv( vec2 p, vec4 L ) { return vec2( 0.5 + ( p.x - L.x ) / L.z, 0.5 - ( p.y - L.y ) / L.z ); }
// 1 inside a level, falling to 0 across its outer 6%, where the next
// level out takes over — so the change of resolution never shows.
float tsEdge( vec2 u ) { vec2 m = min( u, 1.0 - u ); return clamp( ( min( m.x, m.y ) - 0.004 ) * 16.0, 0.0, 1.0 ); }

// ( tan of the skyline toward the sun, distance to it, ground height )
vec3 tsFetch( vec2 p ) {
  vec3 acc = vec3( 0.0 );
  float left = 1.0, e;
  vec2 u; vec4 t;
  u = tsUv( p, tsLv[ 0 ] ); e = tsEdge( u );
  if ( e > 0.0 ) { t = textureLod( tsHz0, u, 0.0 ); acc += e * vec3( t.xy, t.z + tsLv[ 0 ].w ); left -= e; }
  if ( left > 0.001 ) {
    u = tsUv( p, tsLv[ 1 ] ); e = tsEdge( u ) * left;
    if ( e > 0.0 ) { t = textureLod( tsHz1, u, 0.0 ); acc += e * vec3( t.xy, t.z + tsLv[ 1 ].w ); left -= e; }
  }
  if ( left > 0.001 ) {
    u = tsUv( p, tsLv[ 2 ] ); e = tsEdge( u ) * left;
    if ( e > 0.0 ) { t = textureLod( tsHz2, u, 0.0 ); acc += e * vec3( t.xy, t.z + tsLv[ 2 ].w ); left -= e; }
  }
  if ( left > 0.001 ) {
    u = tsUv( p, tsLv[ 3 ] ); e = tsEdge( u ) * left;
    if ( e > 0.0 ) { t = textureLod( tsHz3, u, 0.0 ); acc += e * vec3( t.xy, t.z + tsLv[ 3 ].w ); left -= e; }
  }
  return acc + left * vec3( -4.0, 1e4, -1e5 );
}

// How much of the sun's disc this point can see over the terrain.
// A point standing above the ground — a boulder's crown, the rover's
// deck — sees over a skyline that the ground beneath it cannot, and
// the stored distance to that skyline says by how much.
float terrainShadow( vec3 wp, bool lifted ) {
  if ( tsSun.z < 0.5 ) return 1.0;
  vec3 s = tsFetch( wp.xz );
  float tanH = s.x;
  if ( lifted ) tanH -= max( wp.y - s.z, 0.0 ) / max( s.y, 0.5 );
  return smoothstep( - tsSun.y, tsSun.y, atan( tsSun.x ) - atan( tanH ) );
}
`;

export const GLSL_HAPKE = `
uniform vec4 hpkA;   // w, b, c, B0
uniform vec4 hpkB;   // h, tan(theta), Bc0, hc
uniform float hpkN;  // normalisation to Lambert at the standard geometry
uniform highp sampler3D hpkLut;   // the same, tabulated (HPK_LUT)

// Hapke's bidirectional reflectance, with shadow-hiding and coherent-
// backscatter opposition effects, a two-lobe Henyey–Greenstein phase
// function, Chandrasekhar's H for the multiply scattered part, and
// the macroscopic-roughness correction (Hapke 1984). Returns r, so
// that radiance = r × irradiance.
float hapkeR( float mu0, float mu, float cosg ) {
  mu0 = clamp( mu0, 1e-3, 1.0 ); mu = clamp( mu, 0.02, 1.0 );
  float tt = hpkB.y;
  float ci = mu0, ce = mu, si = sqrt( 1.0 - ci * ci ), se = sqrt( 1.0 - ce * ce );
  float i = max( acos( ci ), 1e-3 ), e = max( acos( ce ), 1e-3 );
  float cphi = si * se > 1e-4 ? clamp( ( cosg - ci * ce ) / ( si * se ), -1.0, 1.0 ) : 1.0;
  float phi = min( acos( cphi ), PI - 1e-3 );
  float chi = inversesqrt( 1.0 + PI * tt * tt );
  float ti = tt * tan( i ), te = tt * tan( e );
  float E1i = exp( -2.0 / ( PI * ti ) ), E1e = exp( -2.0 / ( PI * te ) );
  float E2i = exp( -1.0 / ( PI * ti * ti ) ), E2e = exp( -1.0 / ( PI * te * te ) );
  float etai = chi * ( ci + si * tt * E2i / ( 2.0 - E1i ) );
  float etae = chi * ( ce + se * tt * E2e / ( 2.0 - E1e ) );
  float s2 = sin( phi * 0.5 ); s2 *= s2;
  float f = exp( -2.0 * tan( phi * 0.5 ) );
  float m0, m1, S;
  if ( i <= e ) {
    float den = 2.0 - E1e - phi / PI * E1i;
    m0 = chi * ( ci + si * tt * ( cphi * E2e + s2 * E2i ) / den );
    m1 = chi * ( ce + se * tt * ( E2e - s2 * E2i ) / den );
    S = m1 / etae * ci / etai * chi / ( 1.0 - f + f * chi * ci / etai );
  } else {
    float den = 2.0 - E1i - phi / PI * E1e;
    m0 = chi * ( ci + si * tt * ( E2i - s2 * E2e ) / den );
    m1 = chi * ( ce + se * tt * ( cphi * E2i + s2 * E2e ) / den );
    S = m1 / etae * ci / etai * chi / ( 1.0 - f + f * chi * ce / etae );
  }
  float b = hpkA.y, c = hpkA.z, b2 = b * b;
  float P = 0.5 * ( 1.0 + c ) * ( 1.0 - b2 ) / pow( 1.0 - 2.0 * b * cosg + b2, 1.5 )
          + 0.5 * ( 1.0 - c ) * ( 1.0 - b2 ) / pow( 1.0 + 2.0 * b * cosg + b2, 1.5 );
  float tg = sqrt( max( 1.0 - cosg, 0.0 ) / max( 1.0 + cosg, 1e-4 ) );
  float Bs = hpkA.w / ( 1.0 + tg / hpkB.x );
  float xc = tg / hpkB.w;
  float Bc = hpkB.z * ( 1.0 + ( 1.0 - exp( -xc ) ) / max( xc, 1e-4 ) ) / ( 2.0 * ( 1.0 + xc ) * ( 1.0 + xc ) );
  float gam = sqrt( 1.0 - hpkA.x );
  float H0 = ( 1.0 + 2.0 * m0 ) / ( 1.0 + 2.0 * m0 * gam );
  float H1 = ( 1.0 + 2.0 * m1 ) / ( 1.0 + 2.0 * m1 * gam );
  return hpkA.x / ( 4.0 * PI ) * m0 / ( m0 + m1 ) * ( ( 1.0 + Bs ) * P + H0 * H1 - 1.0 ) * ( 1.0 + Bc ) * S;
}

void RE_Direct_Regolith( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
  float mu0 = dot( geometryNormal, directLight.direction );
  if ( mu0 <= 0.0 ) return;
  float mu = dot( geometryNormal, geometryViewDir ), cosg = dot( directLight.direction, geometryViewDir );
#ifdef HPK_LUT
  float gu = sqrt( acos( clamp( cosg, -1.0, 1.0 ) ) / PI );
  float r = texture( hpkLut, vec3( mu0, clamp( mu, 0.02, 1.0 ), gu ) * ( 31.0 / 32.0 ) + 0.5 / 32.0 ).r;
#else
  float r = hapkeR( mu0, mu, cosg ) * hpkN;
#endif
  reflectedLight.directDiffuse += directLight.color * material.diffuseColor * r;
}
#undef RE_Direct
#define RE_Direct RE_Direct_Regolith
`;

// Ground only: texture bombing, the second relief octave, and the
// sub-metre craters.
export const GLSL_GROUND = `
uniform float rgMean;   // mean linear albedo of the regolith map
uniform vec3 rgMeanC;   // …and its mean colour, for where the tile is too far to resolve
uniform vec4 rgMicro;   // ( micro-crater strength, occupancy, grain-shadow depth, – )
uniform vec3 uSunView;
uniform float uSparkle;

// Translation-only hex tiling (after Mikkelsen 2022): each fragment
// blends three copies of the tile, shifted by a random offset per
// vertex of a triangle grid, so a 3 m texture never visibly repeats.
// Offsets but no rotation — the normal map's horizon is baked toward
// one fixed azimuth, and a rotated copy would point it wrong.
vec2 hxHash( vec2 p ) {
  p = vec2( dot( p, vec2( 127.1, 311.7 ) ), dot( p, vec2( 269.5, 183.3 ) ) );
  return fract( sin( p ) * 43758.5453 );
}
void hxGrid( vec2 st, out vec3 w, out vec2 o1, out vec2 o2, out vec2 o3 ) {
  st *= 3.4641016;
  vec2 sk = vec2( st.x, -0.57735027 * st.x + 1.15470054 * st.y );
  vec2 b = floor( sk );
  vec3 t = vec3( fract( sk ), 0.0 );
  t.z = 1.0 - t.x - t.y;
  float s = step( 0.0, -t.z ), s2 = 2.0 * s - 1.0;
  w = vec3( -t.z * s2, s - t.y * s2, s - t.x * s2 );
  w = w * w * w; w /= w.x + w.y + w.z;
  o1 = hxHash( b + vec2( s, s ) );
  o2 = hxHash( b + vec2( s, 1.0 - s ) );
  o3 = hxHash( b + vec2( 1.0 - s, s ) );
}
vec4 hxTex( sampler2D tx, vec2 uv, vec3 w, vec2 o1, vec2 o2, vec2 o3, vec2 gx, vec2 gy ) {
#ifdef RG_CHEAP
  // Low quality: one fetch, not three. The tile repeats again, and the
  // medium octave on top of it is what hides that.
  return textureGrad( tx, uv, gx, gy );
#else
  return textureGrad( tx, uv + o1, gx, gy ) * w.x
       + textureGrad( tx, uv + o2, gx, gy ) * w.y
       + textureGrad( tx, uv + o3, gx, gy ) * w.z;
#endif
}
vec2 hxSlope( vec4 n ) { vec3 a = n.xyz * 2.0 - 1.0; return a.xy / max( a.z, 0.25 ); }

// Sub-metre craters, too small for the mesh and too big for the tile.
// Two octaves of hashed cells, at most one crater per cell, each kept
// wholly inside its own cell so a fragment only ever has to ask its
// own. The profile is the kernel's, and so is the age skew. Each one
// bends the normal and — because a bowl's highest point along any ray
// is its rim — casts a shadow that can be found in closed form rather
// than marched. The same closed form, run toward the eye instead of
// the sun, says which part of the bowl its near rim hides: there the
// eye is really looking at the rim, so that part neither tilts nor
// shadows. Without it, a pit seen down-sun shows the black wall a
// real one would keep behind its lip.
float mcHash( vec2 p ) { return fract( sin( dot( p, vec2( 41.13, 289.71 ) ) ) * 17657.231 ); }
float mcRim( vec2 q, float d, vec2 dir, float tanA, float DH ) {
  float pu = dot( q, dir );
  float tExit = -pu + sqrt( max( pu * pu - d * d + 1.0, 0.0 ) );
  return tanA - DH * ( 2.0 * pu + tExit );
}
void microCraters( vec2 p, vec3 Vw, float fade, float tanSun, inout vec2 grad, inout float lit ) {
  float vxz = max( length( Vw.xz ), 1e-4 );
  vec2 vDir = Vw.xz / vxz;
  float tanV = Vw.y / vxz;
  for ( int o = 0; o < 2; o ++ ) {
    float cell = o == 0 ? 3.1 : 1.3;
    vec2 cid = floor( p / cell );
    vec2 sd = cid + float( o ) * 57.3;
    float h1 = mcHash( sd ), h2 = mcHash( sd + 17.1 ), h3 = mcHash( sd + 41.7 ), h4 = mcHash( sd + 73.9 );
    if ( h1 > rgMicro.y ) continue;
    float r = cell * ( 0.06 + 0.18 * h2 * h2 );
    float reach = r * 1.9;
    vec2 c = ( cid + 0.5 ) * cell + ( vec2( h3, h4 ) - 0.5 ) * ( cell - 2.0 * reach );
    vec2 q = ( p - c ) / r;
    float d = length( q );
    if ( d > 1.9 ) continue;
    float age = pow( fract( h1 * 57.31 + h2 * 3.1 ), 2.6 );
    float D = 0.035 + 0.365 * pow( age, 1.3 ), H = 0.004 + 0.068 * age;
    float gin = 2.0 * ( D + H ) * d;
    float dd = max( d, 0.5 );
    float gout = -3.0 * H * 1.1707 / ( dd * dd * dd * dd );
    float soft = 0.08 + 0.3 * ( 1.0 - age );
    float dh = mix( gin, gout, smoothstep( 1.0 - soft, 1.0 + soft, d ) );
    float seen = d < 1.0 ? smoothstep( -0.04, 0.04, mcRim( q, d, vDir, tanV, D + H ) ) : 1.0;
    grad += dh * q / max( d, 1e-3 ) * fade * seen;

    float m = 1.0;
    float pu = dot( q, sunXZ );
    if ( d < 1.0 ) {
      m = mcRim( q, d, sunXZ, tanSun, D + H );
    } else if ( pu < 0.0 && d * d - pu * pu < 1.0 ) {
      float tIn = -pu - sqrt( 1.0 - ( d * d - pu * pu ) );
      float hout = H * ( 1.0 / ( d * d * d ) - 0.1458 ) * 1.1707;
      m = tanSun - ( H - hout ) / max( tIn, 1e-3 );
    }
    lit *= mix( 1.0, smoothstep( -0.03, 0.03, m ), fade * seen );
  }
}
`;

export const GROUND_MAP = `
  vec2 rgUv = vMapUv;
  vec2 rgGx = dFdx( rgUv ), rgGy = dFdy( rgUv );
  float rgDist = length( vViewPosition );
  vec3 hwF; vec2 hoF1, hoF2, hoF3;
  hxGrid( rgUv * 0.5, hwF, hoF1, hoF2, hoF3 );
  // Past ~140 m the 3 m tile is mip-averaged to its mean anyway, so
  // the six fetches it costs are skipped where most pixels are.
  float rgNear = 1.0 - smoothstep( 70.0, 140.0, rgDist );
  vec4 rgFine = vec4( rgMeanC, 0.5 );
  if ( rgNear > 0.0 ) rgFine = mix( rgFine, hxTex( map, rgUv, hwF, hoF1, hoF2, hoF3, rgGx, rgGy ), rgNear );
  // The medium octave: the same tile at 3.3×, which puts its pebbles
  // at the size of cobbles and its pits at a couple of decimetres.
  vec2 rgMUv = rgUv * 0.3 + vec2( 0.37, 0.19 );
  vec3 hwM; vec2 hoM1, hoM2, hoM3;
  hxGrid( rgMUv * 0.5, hwM, hoM1, hoM2, hoM3 );
  vec4 rgMed = hxTex( map, rgMUv, hwM, hoM1, hoM2, hoM3, rgGx * 0.3, rgGy * 0.3 );
  diffuseColor.rgb *= rgFine.rgb * ( 0.62 + 0.38 * rgMed.rgb / rgMean );
`;

export const GROUND_NORMAL = `
  // Fine relief fades out where it would only alias; the medium
  // octave and the craters carry on further.
  float rgFade = 1.0 - smoothstep( 18.0, 80.0, rgDist );
  vec4 nF = vec4( 0.5, 0.5, 1.0, 0.0 );
  if ( rgFade > 0.0 ) nF = hxTex( normalMap, rgUv, hwF, hoF1, hoF2, hoF3, rgGx, rgGy );
  vec4 nM = hxTex( normalMap, rgMUv, hwM, hoM1, hoM2, hoM3, rgGx * 0.3, rgGy * 0.3 );
  // Roughness falls with scale on real regolith (its Hurst exponent
  // is under 1), so the magnified octave is given gentler slopes.
  vec2 rgSlope = ( hxSlope( nF ) * rgFade + hxSlope( nM ) * 0.22 ) * normalScale;

  vec2 mcGrad = vec2( 0.0 );
  float mcLit = 1.0;
  float mcFade = ( 1.0 - smoothstep( 14.0, 60.0, rgDist ) ) * rgMicro.x;
  if ( mcFade > 0.0 ) microCraters( vWPos.xz, normalize( cameraPosition - vWPos ), mcFade, tsSun.x, mcGrad, mcLit );
  normal = normalize( tbn * vec3( rgSlope - mcGrad, 1.0 ) );
  // Relief from a map has nothing to hide behind: the far side of a
  // bump stays on screen though real ground would put it behind its
  // own crest. Bend any normal that would face away from you back
  // toward you — looking down-sun that turns a pit's hidden wall into
  // the lit one you would actually see.
  {
    vec3 Vv = normalize( vViewPosition );
    float nv = dot( normal, Vv );
    if ( nv < 0.2 ) normal = normalize( normal + Vv * ( 0.2 - nv ) );
  }

  // Grain-scale shadow, from the horizon baked into the normal map.
  // A slope scaled by normalScale scales its horizon with it.
  float tMicro = max( nF.a * rgFade, nM.a * 0.22 ) * 1.5 * normalScale.x;
  // Shadows painted from a texture have no relief to hide behind, so
  // they are withdrawn toward zero phase — looking down-sun, every real
  // shadow lies behind the grain that casts it. And a grain-sized
  // cavity is lit a little by its own sunlit walls, so they never
  // reach full black.
  float rgPhase = 1.0 - dot( normalize( vViewPosition ), normalize( uSunView ) );
  float rgSeen = smoothstep( 0.02, 0.3, rgPhase );
  // Resolved only up close: further out, grain-scale shadowing is what
  // Hapke's roughness term already accounts for.
  float grainSh = rgMicro.z * rgSeen * ( 1.0 - smoothstep( 4.0, 16.0, rgDist ) );
  float microLit = mix( 1.0, smoothstep( -0.1, 0.1, tsSun.x - tMicro ), grainSh ) * mcLit;
  microLit = mix( 1.0, microLit, tsSun.w );
`;

/* A sea of liquid methane, drawn by the ground under it. Wherever the
   terrain lies below the liquid's level (uLake.x, raw height, so the
   drawn level is that less the curvature drop), the eye looks at the
   liquid's surface first: the ray from the eye meets the level, part
   of the light is the sky reflected there — Fresnel for n = 1.28,
   1.5% straight down, nearly all of it at grazing — and the rest is
   the ground below, dimmed along the path through the liquid both
   ways, with a little light scattered in the liquid itself. No
   geometry: the lakebed is the terrain, and every pixel of the sea is
   a pixel of the floor under it. The surface is almost a mirror —
   Cassini found Titan's seas smooth to a millimetre most of the time
   (Zebker et al. 2014) — and wears a faint breath of capillary
   ripples that the wind of half a metre a second can raise. */
export const GLSL_LAKE = `
  uniform vec4 uLake;          // level, on, curvature anchor x, z
  uniform vec2 uLakeR;         // apparent radius, flat-cap radius²
  uniform vec3 uLakeAbs, uLakeIn;
  uniform float uLakeT, uLakeMirror, uLakeHave;
  uniform sampler2D uLakeMap;
  uniform mat4 uLakeMat;
  float lakeDrop( vec2 p ) {
    vec2 d = p - uLake.zw;
    float d2 = dot( d, d ) - uLakeR.y;
    return d2 > 0.0 ? d2 / ( 2.0 * uLakeR.x ) : 0.0;
  }
  vec2 lakeRipple( vec2 p, float t ) {
    vec2 g = vec2( 0.0 );
    g += vec2( 0.8, 0.6 ) * cos( dot( p, vec2( 0.8, 0.6 ) ) * 3.1 + t * 1.9 ) * 0.5;
    g += vec2( -0.5, 0.86 ) * cos( dot( p, vec2( -0.5, 0.86 ) ) * 4.7 + t * 2.3 ) * 0.35;
    g += vec2( 0.97, -0.24 ) * cos( dot( p, vec2( 0.97, -0.24 ) ) * 7.3 - t * 2.9 ) * 0.2;
    // Patches of calm and of catspaw, drifting.
    float patchy = 0.5 + 0.5 * sin( p.x * 0.013 + t * 0.05 ) * sin( p.y * 0.017 - t * 0.04 );
    return g * 0.012 * patchy;
  }
`;
const LAKE_SURFACE = `
  if ( uLake.y > 0.5 ) {
    float lvl = uLake.x - lakeDrop( vWPos.xz );
    // Drawing the mirror: nothing under the surface is in it.
    if ( uLakeMirror > 0.5 && vWPos.y < lvl - 0.02 ) discard;
    float camLvl = uLake.x - lakeDrop( cameraPosition.xz );
    if ( vWPos.y < lvl && cameraPosition.y > camLvl ) {
      vec3 C = cameraPosition, F = vWPos;
      float t = ( C.y - lvl ) / max( C.y - F.y, 1e-4 );
      vec3 P = C + ( F - C ) * t;
      vec3 V = normalize( P - C );
      float far = length( P - C );
      // Ripples fade out with distance, where a pixel spans many.
      vec2 rg = lakeRipple( P.xz, uLakeT ) * ( 1.0 - smoothstep( 30.0, 400.0, far ) );
      vec3 N = normalize( vec3( -rg.x, 1.0, -rg.y ) );
      vec3 R = reflect( V, N );
      R.y = abs( R.y );
      float ci = clamp( -dot( V, N ), 0.0, 1.0 );
      float Fr = 0.0153 + 0.9847 * pow( 1.0 - ci, 5.0 );
      vec3 sky = skyRadiance( normalize( R ) );
      // The far shore, the hills and the haze over them, from the
      // mirror image where it has them; the ripples shake it a little.
      if ( uLakeHave > 0.5 ) {
        vec4 q = uLakeMat * vec4( P, 1.0 );
        vec2 uv = q.xy / q.w + rg * 0.4;
        if ( q.w > 0.0 && uv.x > 0.0 && uv.x < 1.0 && uv.y > 0.0 && uv.y < 1.0 ) sky = texture2D( uLakeMap, uv ).rgb;
      }
      // Down to the floor along the view, and the light down to it.
      float depth = lvl - F.y;
      vec3 T = exp( -uLakeAbs * ( length( F - P ) + depth * 1.4 ) );
      vec3 body = gl_FragColor.rgb * T + uLakeIn * ( 1.0 - exp( -uLakeAbs * length( F - P ) ) );
      gl_FragColor.rgb = mix( body, sky, Fr );
    } else if ( vWPos.y < lvl ) {
      // From under the surface the fog is the liquid along the view;
      // the floor still only gets what came down through it.
      gl_FragColor.rgb *= exp( -uLakeAbs * ( lvl - vWPos.y ) * 1.4 );
    }
  }
`;

export const GROUND_SPARKLE = `
  {
    // Sparse micro-facets of impact glass: a hashed cell either holds
    // a bead angled to the sun or it doesn't. Rare, close-up only, and
    // only where the sun actually reaches.
    float spFade = ( 1.0 - smoothstep( 2.5, 13.0, rgDist ) ) * uSparkle * surfShadow;
    if ( spFade > 0.01 ) {
      vec2 cellId = floor( vMapUv * 96.0 );
      float sp = fract( sin( dot( cellId, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 );
      if ( sp > 0.9965 ) {
        vec3 V = normalize( vViewPosition );
        float phase = max( dot( V, normalize( uSunView ) ), 0.0 );
        float tw = fract( sp * 611.7 );
        gl_FragColor.rgb += vec3( 1.0, 0.98, 0.92 )
          * pow( phase * 0.5 + 0.5, 6.0 ) * spFade * ( 0.4 + tw ) * 0.1;
      }
    }
  }
` + LAKE_SURFACE + `
  #include <tonemapping_fragment>
`;

// The directional part of lights_fragment_begin, rewritten: the sun is
// directionalLights[0]; [1], when present, is the far shadow cascade
// and carries no light. Everything else in the chunk is r160's own.
export const LIGHTS_BEGIN = (() => {
  const src = THREE.ShaderChunk.lights_fragment_begin;
  const a = src.indexOf('#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )');
  const b = src.indexOf('#if ( NUM_RECT_AREA_LIGHTS > 0 )');
  if (a < 0 || b < a) throw new Error('lights_fragment_begin: layout changed');
  return src.slice(0, a) + `
#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )
  {
    float objShadow = 1.0;
    #if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 1
    if ( receiveShadow ) {
      vec4 c0 = vDirectionalShadowCoord[ 0 ];
      vec3 q0 = c0.xyz / c0.w;
      vec3 m0 = min( q0, 1.0 - q0 );
      float inNear = smoothstep( 0.0, 0.08, min( min( m0.x, m0.y ), m0.z ) );
      float sNear = 1.0, sFar = 1.0;
      if ( inNear > 0.0 ) sNear = getShadow( directionalShadowMap[ 0 ], directionalLightShadows[ 0 ].shadowMapSize, directionalLightShadows[ 0 ].shadowBias, directionalLightShadows[ 0 ].shadowRadius, c0 );
      if ( inNear < 1.0 ) sFar = getShadow( directionalShadowMap[ 1 ], directionalLightShadows[ 1 ].shadowMapSize, directionalLightShadows[ 1 ].shadowBias, directionalLightShadows[ 1 ].shadowRadius, vDirectionalShadowCoord[ 1 ] );
      objShadow = mix( sFar, sNear, inNear );
    }
    #elif defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
    if ( receiveShadow ) objShadow = getShadow( directionalShadowMap[ 0 ], directionalLightShadows[ 0 ].shadowMapSize, directionalLightShadows[ 0 ].shadowBias, directionalLightShadows[ 0 ].shadowRadius, vDirectionalShadowCoord[ 0 ] );
    #endif
    getDirectionalLightInfo( directionalLights[ 0 ], directLight );
    directLight.color *= objShadow * surfShadow;
    RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
  }
#endif
` + src.slice(b);
})();

/* Prints: the same Hapke function again, reading the undisturbed
   ground's parameters (gpk*), cut from GLSL_HAPKE so there is still
   one copy of the maths. */
export const GLSL_HAPKE_GROUND = `
uniform vec4 gpkA, gpkB;
uniform float gpkN;
uniform vec3 uStampK;
` + GLSL_HAPKE.slice(GLSL_HAPKE.indexOf('float hapkeR('), GLSL_HAPKE.indexOf('void RE_Direct_Regolith'))
  .replace('hapkeR(', 'hapkeRG(').replace(/hpkA/g, 'gpkA').replace(/hpkB/g, 'gpkB');

/* A print's output is not a colour but a factor for the ground under
   it: the light pressed soil sends back (its Hapke set, on the relief
   normal), over what the ground around it sends (the ground's set, on
   the flat normal), under the same sun and shadow and the same
   ambient. Albedo is common to both and cancels, which is what lets
   the ground's own grain and tint show through; uStampK puts back the
   part of it that pressing does change. Blended as dst × src, so
   mixing toward white at the sole's edge fades it into the ground. */
export const PRINT_BLEND = `
#if NUM_DIR_LIGHTS > 0
  {
    vec3 L = directionalLights[ 0 ].direction, V = geometryViewDir;
    float cg = dot( L, V );
    float mp = dot( normal, L ), mg = dot( nonPerturbedNormal, L );
    float rP = mp > 0.0 ? hapkeR( mp, dot( normal, V ), cg ) * hpkN : 0.0;
    float rG = mg > 0.0 ? hapkeRG( mg, dot( nonPerturbedNormal, V ), cg ) * gpkN : 0.0;
    vec3 amb = reflectedLight.indirectDiffuse;
    vec3 k = ( sunIrr * rP + amb ) / max( sunIrr * rG + amb, vec3( 1e-7 ) ) * uStampK;
    gl_FragColor = vec4( mix( vec3( 1.0 ), k, diffuseColor.a ), 1.0 );
  }
#else
  gl_FragColor = vec4( mix( vec3( 1.0 ), uStampK, diffuseColor.a ), 1.0 );
#endif
`;
