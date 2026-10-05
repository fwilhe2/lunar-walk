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
