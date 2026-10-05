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
