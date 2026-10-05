// The near cascade's shadow, as the ground takes it (surface/patch.ts).
// The sun is 0.53° across, so a penumbra is 0.93 cm wide per metre
// between caster and ground: none where a rock meets the soil, a few
// centimetres at the tip of a boulder's shadow. three's PCF blurs every
// edge by a texel and a half either way, which at a rock's foot leaves
// a wedge of half-lit ground between the stone and its shadow. Here the
// blockers around the point give the distance, the distance the width,
// and a bilinear compare a texel's smoothing under it, so the shadow
// starts hard at the contact and softens with range.
// SUN_SH_RANGE (the map's depth range) and SUN_SH_SPAN (its width), in
// metres, are set where this is spliced in.
float sunShadowBilin( sampler2D map, vec2 size, vec2 uv, float z ) {
  vec2 st = uv * size - 0.5, f = fract( st ), t = 1.0 / size;
  vec2 b = ( floor( st ) + 0.5 ) * t;
  return mix( mix( texture2DCompare( map, b, z ), texture2DCompare( map, b + vec2( t.x, 0.0 ), z ), f.x ),
              mix( texture2DCompare( map, b + vec2( 0.0, t.y ), z ), texture2DCompare( map, b + t, z ), f.x ), f.y );
}
float groundSunShadow( sampler2D map, vec2 size, vec4 coord ) {
  vec3 c = coord.xyz / coord.w;
  if ( c.x < 0.0 || c.x > 1.0 || c.y < 0.0 || c.y > 1.0 || c.z > 1.0 ) return 1.0;
  vec2 t = 1.0 / size;
  // Mean depth of whatever stands between here and the sun, two texels
  // round: as far as the widest filter below reaches.
  float sum = 0.0, n = 0.0;
  for ( int j = -1; j <= 1; j ++ ) {
    for ( int i = -1; i <= 1; i ++ ) {
      float d = unpackRGBAToDepth( texture2D( map, c.xy + vec2( float( i ), float( j ) ) * 2.0 * t ) );
      if ( d < c.z ) { sum += d; n += 1.0; }
    }
  }
  if ( n == 0.0 ) return 1.0;
  float dist = ( c.z - sum / n ) * SUN_SH_RANGE;
  // A box as wide as the penumbra, from four bilinear compares a
  // quarter of it either side, in texels; capped at the search.
  float o = min( 0.25 * 0.0093 * dist * size.x / SUN_SH_SPAN, 1.0 );
  return 0.25 * ( sunShadowBilin( map, size, c.xy + vec2( -o, -o ) * t, c.z )
                + sunShadowBilin( map, size, c.xy + vec2(  o, -o ) * t, c.z )
                + sunShadowBilin( map, size, c.xy + vec2( -o,  o ) * t, c.z )
                + sunShadowBilin( map, size, c.xy + vec2(  o,  o ) * t, c.z ) );
}
