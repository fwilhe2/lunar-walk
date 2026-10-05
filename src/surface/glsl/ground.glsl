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
// bends the normal and casts a shadow from its rim, the highest point
// along any ray through the bowl, so a few samples across the crest
// find it without a march. Toward the eye the bowl is shaded where
// the view ray really meets it, not under the fragment: looking flat,
// a point of the floor shows the far wall, and the near wall stays
// behind its lip — a pit seen down-sun does not show the black wall a
// real one would hide, nor one seen up-sun a lit floor its far rim
// shadows.
float mcHash( vec2 p ) { return fract( sin( dot( p, vec2( 41.13, 289.71 ) ) ) * 17657.231 ); }
// The kernel's profile (craterField): a parabolic bowl reaching the
// crest at d = 1, the blanket thinning as 1/d³ to zero at 1.9, the
// kink between them rounded by a polynomial smooth-min of width k.
// Height in radii; dh is its slope outward.
float mcProf( float d, float K, float D, float H, float k, out float dh ) {
  float dd = max( d, 0.5 );
  float hin = K * d * d - D, hout = H * ( 1.0 / ( dd * dd * dd ) - 0.1458 ) * 1.1707;
  float w = clamp( 0.5 + 0.5 * ( hout - hin ) / k, 0.0, 1.0 );
  dh = mix( -3.0 * H * 1.1707 / ( dd * dd * dd * dd ), 2.0 * K * d, w );
  return mix( hout, hin, w ) - k * w * ( 1.0 - w );
}
void microCraters( vec2 p, vec3 Vw, float fade, float pix, float tanSun, inout vec2 grad, inout float lit ) {
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
    // Under a few pixels along the view a crater is a sliver the raster
    // cannot hold, and it shimmers as you move: fade it by its size in
    // pixels, the footprint across the ground being widest that way.
    float f = fade * smoothstep( 2.0, 5.0, 2.0 * r / pix );
    if ( f <= 0.0 ) continue;
    vec2 c = ( cid + 0.5 ) * cell + ( vec2( h3, h4 ) - 0.5 ) * ( cell - 2.0 * reach );
    vec2 q = ( p - c ) / r;
    float d = length( q );
    if ( d > 1.9 ) continue;
    float age = pow( fract( h1 * 57.31 + h2 * 3.1 ), 2.6 );
    float D = 0.035 + 0.365 * pow( age, 1.3 ), H = 0.004 + 0.068 * age;
    // The kink is rounded over ±soft radii, wider than the kernel's
    // knife edge for fresh craters: a sub-metre rim is gardened round
    // faster, and the mesh blunts the kernel's to its own step anyway.
    // Bowl and blanket part at 2K + 3.5H per radius across the crest.
    float K = D + H, soft = 0.08 + 0.3 * ( 1.0 - age );
    float k = soft * ( 2.0 * K + 3.51 * H );
    // Follow the view ray past the flat ground onto the crater. Through
    // q it runs away from the eye as q − vDir·t at height −tanV·t: it
    // enters the blanket at t0, crosses the rim circle at tE and tX (if
    // it reaches it) and leaves at t1. Below the near crest it meets the
    // blanket's rising flank before tE; over it, the bowl before tX —
    // on the far wall, the further the flatter you look; and over that
    // too, the far blanket. Each bracket holds one crossing; halving it
    // ten times finds it to a few thousandths of the radius.
    {
      float tanR = max( tanV, 1e-3 ), dh;
      float pu = dot( q, vDir ), dq = d * d;
      float S = sqrt( max( pu * pu - dq + 3.61, 0.0 ) ), t1 = pu + S;
      float s2 = pu * pu - dq + 1.0, s = sqrt( max( s2, 0.0 ) );
      float tC = s2 > 0.0 ? pu - s : pu, tX = pu + s;
      float ta = pu - S, tb = tC;
      if ( mcProf( length( q - vDir * tC ), K, D, H, k, dh ) + tanR * tC < 0.0 ) {
        ta = tC; tb = t1;
        if ( s2 > 0.0 ) {
          if ( mcProf( 1.0, K, D, H, k, dh ) + tanR * tX < 0.0 ) ta = tX; else tb = tX;
        }
      }
      for ( int i = 0; i < 10; i ++ ) {
        float tm = 0.5 * ( ta + tb );
        if ( mcProf( length( q - vDir * tm ), K, D, H, k, dh ) + tanR * tm < 0.0 ) ta = tm; else tb = tm;
      }
      q -= vDir * ( 0.5 * ( ta + tb ) );
      d = length( q );
    }
    float dh;
    float h0 = mcProf( d, K, D, H, k, dh );
    grad += dh * q / max( d, 1e-3 ) * f;

    // Toward the sun, what shades the point is the crest the ray
    // crosses next: the far one from inside the bowl, the near one from
    // the blanket beyond it, or where the ray passes closest if it
    // misses the rim circle. Sampled across the crest's rounding for
    // the steepest rise, so on a worn rim the shadow starts at the
    // terminator, where the slope already has the ground dark, rather
    // than at a knife edge it no longer has.
    float m = 1.0;
    {
      float pu = dot( q, sunXZ ), s2 = pu * pu - d * d + 1.0, s = sqrt( max( s2, 0.0 ) );
      float tc = s2 <= 0.0 ? -pu : d < 1.0 ? s - pu : -pu - s;
      if ( tc > 0.0 ) {
        float rise = -1e3, dz;
        for ( int j = -3; j <= 3; j ++ ) {
          float t = max( tc + float( j ) * 0.5 * soft, 0.03 );
          rise = max( rise, ( mcProf( length( q + sunXZ * t ), K, D, H, k, dz ) - h0 ) / t );
        }
        m = tanSun - rise;
      }
    }
    lit *= mix( 1.0, smoothstep( -0.03, 0.03, m ), f );
  }
}
