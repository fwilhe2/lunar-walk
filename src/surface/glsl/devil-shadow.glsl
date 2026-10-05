// The dust devils' shadows (effects/devils.ts writes DV). A devil is a
// ribbon turned to the eye, so it cannot go into the shadow maps; the
// sun's ray from this point is taken through its column instead. The
// column is the devil's cone leaning downwind; the ray passes nearest
// its axis at one height — in closed form for the lean's linear part,
// then twice more with its curve held at the last guess — and the dust
// is summed at six heights across the crossing.
// Smooth where the devil is lumpy: a shadow on the ground is blurred
// by the slant of the light and by everything the sky fills in.
#define DV_MAX 6
uniform float dvN;
uniform vec4 dvA[ DV_MAX ];   // base x, y (raw height), z; height H
uniform vec4 dvB[ DV_MAX ];   // R0 (half width × spread), visible height, dust × fade, lift
uniform vec2 dvWind;

float devilShadow( vec3 wp ) {
  if ( dvN < 0.5 || tsSun.x <= 0.01 ) return 1.0;
  float tanE = tsSun.x, sinE = tanE * inversesqrt( 1.0 + tanE * tanE );
  float tau = 0.0;
  for ( int i = 0; i < DV_MAX; i++ ) {
    if ( float( i ) >= dvN ) break;
    vec4 A = dvA[ i ], B = dvB[ i ];
    if ( B.z <= 0.0 ) continue;
    // Toward the sun the ray climbs: at height h over the devil's foot
    // it stands at q0 + v h − c h² from the axis, the last the lean's
    // curve (effects/devils.ts: 0.22 H t² downwind).
    vec2 q0 = wp.xz - A.xz - sunXZ * ( wp.y - A.y ) / tanE;
    vec2 v = sunXZ / tanE - 0.1 * dvWind, c = dvWind * 0.22 / A.w;
    float vv = dot( v, v ), hs = clamp( - dot( q0, v ) / vv, 0.0, A.w );
    hs = clamp( - dot( q0 - c * hs * hs, v ) / vv, 0.0, A.w );
    hs = clamp( - dot( q0 - c * hs * hs, v ) / vv, 0.0, A.w );
    float rs = B.x * devilR( hs / A.w );
    if ( length( q0 + v * hs - c * hs * hs ) > 2.5 * rs ) continue;
    // Over the heights where the ray is within about two radii.
    float dh = 2.0 * rs / length( v ), step = 2.0 * dh / 5.0, sum = 0.0;
    for ( int k = 0; k < 6; k++ ) {
      float h = hs - dh + step * float( k );
      if ( h < 0.0 || h > A.w ) continue;
      float t = h / A.w, R = B.x * devilR( t );
      vec2 q = q0 + v * h - c * h * h;
      float u2 = dot( q, q ) / ( R * R );
      if ( u2 >= 1.0 ) continue;
      // As the devil's own column: thinning aloft, ending at its
      // visible height, its foot gone when it lifts. Per metre, so that
      // a chord through the middle holds what the eye sees there.
      float dens = ( 0.6 + 0.4 * exp( - t * 3.0 ) )
        * smoothstep( 0.0, 1.0, ( 1.0 - t / B.y ) * 2.0 )
        * mix( 1.0, smoothstep( 0.45 * B.w - 0.05, 0.45 * B.w + 0.1, t ), B.w );
      sum += ( 1.0 - u2 ) * dens * 0.75 / R;
    }
    tau += B.z * sum * step / sinE;
  }
  return exp( - tau );
}
