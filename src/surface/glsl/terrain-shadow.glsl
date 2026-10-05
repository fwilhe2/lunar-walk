uniform sampler2D tsHz0, tsHz1, tsHz2, tsHz3;
uniform vec4 tsLv[ 4 ];
uniform vec4 tsSun;
uniform vec2 sunXZ;
varying vec3 vWPos;

vec2 tsUv( vec2 p, vec4 L ) { return vec2( 0.5 + ( p.x - L.x ) / L.z, 0.5 - ( p.y - L.y ) / L.z ); }
// 1 inside a level, falling to 0 across its outer 6%, where the next
// level out takes over — so the change of resolution never shows.
float tsEdge( vec2 u ) { vec2 m = min( u, 1.0 - u ); return clamp( ( min( m.x, m.y ) - 0.004 ) * 16.0, 0.0, 1.0 ); }

// ( tan of the skyline toward the sun, distance to it, ground height )
vec3 tsFetch( vec2 p ) {
  vec3 acc = vec3( 0.0 );
  float left = 1.0, e;
  vec2 u; vec4 t;
  u = tsUv( p, tsLv[ 0 ] ); e = tsEdge( u );
  if ( e > 0.0 ) { t = textureLod( tsHz0, u, 0.0 ); acc += e * vec3( t.xy, t.z + tsLv[ 0 ].w ); left -= e; }
  if ( left > 0.001 ) {
    u = tsUv( p, tsLv[ 1 ] ); e = tsEdge( u ) * left;
    if ( e > 0.0 ) { t = textureLod( tsHz1, u, 0.0 ); acc += e * vec3( t.xy, t.z + tsLv[ 1 ].w ); left -= e; }
  }
  if ( left > 0.001 ) {
    u = tsUv( p, tsLv[ 2 ] ); e = tsEdge( u ) * left;
    if ( e > 0.0 ) { t = textureLod( tsHz2, u, 0.0 ); acc += e * vec3( t.xy, t.z + tsLv[ 2 ].w ); left -= e; }
  }
  if ( left > 0.001 ) {
    u = tsUv( p, tsLv[ 3 ] ); e = tsEdge( u ) * left;
    if ( e > 0.0 ) { t = textureLod( tsHz3, u, 0.0 ); acc += e * vec3( t.xy, t.z + tsLv[ 3 ].w ); left -= e; }
  }
  return acc + left * vec3( -4.0, 1e4, -1e5 );
}

// How much of the sun's disc this point can see over the terrain.
// A point standing above the ground — a boulder's crown, the rover's
// deck — sees over a skyline that the ground beneath it cannot, and
// the stored distance to that skyline says by how much.
float terrainShadow( vec3 wp, bool lifted ) {
  if ( tsSun.z < 0.5 ) return 1.0;
  vec3 s = tsFetch( wp.xz );
  float tanH = s.x;
  if ( lifted ) tanH -= max( wp.y - s.z, 0.0 ) / max( s.y, 0.5 );
  return smoothstep( - tsSun.y, tsSun.y, atan( tsSun.x ) - atan( tanH ) );
}
