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
