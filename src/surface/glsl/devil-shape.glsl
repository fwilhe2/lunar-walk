// A dust devil's radius at height t (0 … 1 of its height), in units
// of half its width: a cone, narrow at the ground and opening to
// several times its width aloft. Shared by the devil itself
// (effects/devils.ts) and its shadow (devil-shadow.glsl).
float devilR( float t ) { return 0.7 + 2.0 * t + 1.0 * smoothstep( 0.5, 1.0, t ); }
