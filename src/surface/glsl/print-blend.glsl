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
