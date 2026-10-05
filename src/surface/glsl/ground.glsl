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
