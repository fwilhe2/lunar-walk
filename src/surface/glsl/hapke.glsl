uniform vec4 hpkA;   // w, b, c, B0
uniform vec4 hpkB;   // h, tan(theta), Bc0, hc
uniform float hpkN;  // normalisation to Lambert at the standard geometry
uniform highp sampler3D hpkLut;   // the same, tabulated (HPK_LUT)

// Hapke's bidirectional reflectance, with shadow-hiding and coherent-
// backscatter opposition effects, a two-lobe Henyey–Greenstein phase
// function, Chandrasekhar's H for the multiply scattered part, and
// the macroscopic-roughness correction (Hapke 1984). Returns r, so
// that radiance = r × irradiance.
float hapkeR( float mu0, float mu, float cosg ) {
  mu0 = clamp( mu0, 1e-3, 1.0 ); mu = clamp( mu, 0.02, 1.0 );
  float tt = hpkB.y;
  float ci = mu0, ce = mu, si = sqrt( 1.0 - ci * ci ), se = sqrt( 1.0 - ce * ce );
  float i = max( acos( ci ), 1e-3 ), e = max( acos( ce ), 1e-3 );
  float cphi = si * se > 1e-4 ? clamp( ( cosg - ci * ce ) / ( si * se ), -1.0, 1.0 ) : 1.0;
  float phi = min( acos( cphi ), PI - 1e-3 );
  float chi = inversesqrt( 1.0 + PI * tt * tt );
  float ti = tt * tan( i ), te = tt * tan( e );
  float E1i = exp( -2.0 / ( PI * ti ) ), E1e = exp( -2.0 / ( PI * te ) );
  float E2i = exp( -1.0 / ( PI * ti * ti ) ), E2e = exp( -1.0 / ( PI * te * te ) );
  float etai = chi * ( ci + si * tt * E2i / ( 2.0 - E1i ) );
  float etae = chi * ( ce + se * tt * E2e / ( 2.0 - E1e ) );
  float s2 = sin( phi * 0.5 ); s2 *= s2;
  float f = exp( -2.0 * tan( phi * 0.5 ) );
  float m0, m1, S;
  if ( i <= e ) {
    float den = 2.0 - E1e - phi / PI * E1i;
    m0 = chi * ( ci + si * tt * ( cphi * E2e + s2 * E2i ) / den );
    m1 = chi * ( ce + se * tt * ( E2e - s2 * E2i ) / den );
    S = m1 / etae * ci / etai * chi / ( 1.0 - f + f * chi * ci / etai );
  } else {
    float den = 2.0 - E1i - phi / PI * E1e;
    m0 = chi * ( ci + si * tt * ( E2i - s2 * E2e ) / den );
    m1 = chi * ( ce + se * tt * ( cphi * E2i + s2 * E2e ) / den );
    S = m1 / etae * ci / etai * chi / ( 1.0 - f + f * chi * ce / etae );
  }
  float b = hpkA.y, c = hpkA.z, b2 = b * b;
  float P = 0.5 * ( 1.0 + c ) * ( 1.0 - b2 ) / pow( 1.0 - 2.0 * b * cosg + b2, 1.5 )
          + 0.5 * ( 1.0 - c ) * ( 1.0 - b2 ) / pow( 1.0 + 2.0 * b * cosg + b2, 1.5 );
  float tg = sqrt( max( 1.0 - cosg, 0.0 ) / max( 1.0 + cosg, 1e-4 ) );
  float Bs = hpkA.w / ( 1.0 + tg / hpkB.x );
  float xc = tg / hpkB.w;
  float Bc = hpkB.z * ( 1.0 + ( 1.0 - exp( -xc ) ) / max( xc, 1e-4 ) ) / ( 2.0 * ( 1.0 + xc ) * ( 1.0 + xc ) );
  float gam = sqrt( 1.0 - hpkA.x );
  float H0 = ( 1.0 + 2.0 * m0 ) / ( 1.0 + 2.0 * m0 * gam );
  float H1 = ( 1.0 + 2.0 * m1 ) / ( 1.0 + 2.0 * m1 * gam );
  return hpkA.x / ( 4.0 * PI ) * m0 / ( m0 + m1 ) * ( ( 1.0 + Bs ) * P + H0 * H1 - 1.0 ) * ( 1.0 + Bc ) * S;
}

void RE_Direct_Regolith( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
  float mu0 = dot( geometryNormal, directLight.direction );
  if ( mu0 <= 0.0 ) return;
  float mu = dot( geometryNormal, geometryViewDir ), cosg = dot( directLight.direction, geometryViewDir );
#ifdef HPK_LUT
  float gu = sqrt( acos( clamp( cosg, -1.0, 1.0 ) ) / PI );
  float r = texture( hpkLut, vec3( mu0, clamp( mu, 0.02, 1.0 ), gu ) * ( 31.0 / 32.0 ) + 0.5 / 32.0 ).r;
#else
  float r = hapkeR( mu0, mu, cosg ) * hpkN;
#endif
  reflectedLight.directDiffuse += directLight.color * material.diffuseColor * r;
}
#undef RE_Direct
#define RE_Direct RE_Direct_Regolith
