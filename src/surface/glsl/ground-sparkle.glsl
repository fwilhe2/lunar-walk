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
// #lake-surface

  #include <tonemapping_fragment>
