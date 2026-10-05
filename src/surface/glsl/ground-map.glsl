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
