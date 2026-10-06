import * as THREE from 'three';

/* ═════════════════════════════════════════════════════════════
   COVERAGE — antialiasing for what MSAA alone does not catch.

   MSAA takes four samples of coverage per pixel but shades once, so
   two things slip through it. A cut-out (alphaTest, discard) is
   decided once per pixel, for all four samples together, and a fine
   weave cut that way sparkles. And a wire thinner than the samples'
   spacing hits one of them in some pixels and none in the next, and
   draws as a row of dots.

   Both are handled through alpha-to-coverage: the fragment's alpha
   switches that share of the pixel's samples on, so a cut-out edge
   gets the four steps of an MSAA edge (render/hdr.ts makes those
   steps even on bright edges), and a wire is widened in its vertex
   shader to at least a pixel and its alpha turned down by its true
   share of that width (Persson's phone-wire AA): an unbroken, faint
   line, as bright in sum as the thin wire would be.

   A wire a pixel or two wide has a third problem, which no amount of
   coverage fixes: MSAA shades once per pixel, at its centre, and
   across a thin cylinder the normal turns through half a circle.
   Lit from behind only a hair of rim catches the sun, and whether the
   pixel's centre lands on it changes along the wire — a lit wire
   against the sun draws as a string of beads. So the narrower a wire
   is in pixels, the more it is shaded with one normal per pixel that
   gives the Lambert light averaged over its visible width,
   (sin α + (π − α) cos α) / 4 at a phase angle α across the axis.
   Wider, the lit band on a pole seen from beside the sun is still a
   pixel or two, and its terminator, decided per pixel, steps from
   column to column; it is filtered over the pixel's footprint.

   And MSAA shades once per pixel *per triangle*, at the pixel's
   centre: on a wire two or three pixels wide every pixel is covered
   by several of its facets, and those turned nearly edge-on have huge
   gradients, so their normal and view vector, carried out to a
   centre the facet does not cover, come out as nonsense — normals
   facing away, glints a thousand times too bright, on the edge pixels
   only. The wire's varyings are interpolated at the centroid of what
   each facet covers instead.

   Without MSAA (low) coverage has nothing to switch: uAaMsaa = 0
   keeps wires at their true width and cut-outs cut as before.
   Both uniforms are set once a frame by the scene pass (render/post.ts). */
export const AA_U = {
  uAaH: new THREE.Uniform(1),       // the target's height in pixels
  uAaMsaa: new THREE.Uniform(1),    // 1 while the target is multisampled
};
const DECL = 'uniform float uAaH;\nuniform float uAaMsaa;\n';

/* Give a patched material (surface/patch.ts) alpha-to-coverage: three
   forces alpha to 1 for an opaque material, so its alpha is kept,
   and `patch` writes it. `key` extends the material's program key. */
export function withCoverage(mat: THREE.MeshStandardMaterial, key: string, patch: (shader: THREE.WebGLProgramParametersWithUniforms) => void) {
  const base = mat.onBeforeCompile, baseKey = mat.customProgramCacheKey;
  mat.alphaToCoverage = true;
  mat.onBeforeCompile = (shader, r) => {
    base.call(mat, shader, r);
    Object.assign(shader.uniforms, AA_U);
    const keep = 'gl_FragColor = vec4( outgoingLight, diffuseColor.a );';
    if (!shader.fragmentShader.includes('#include <opaque_fragment>')) throw new Error('withCoverage: no opaque_fragment');
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\n' + DECL);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + DECL)
      .replace('#include <opaque_fragment>', keep);
    patch(shader);
  };
  mat.customProgramCacheKey = () => baseKey.call(mat) + '-' + key;
  return mat;
}

// Interpolate three's normal and view position, and the surface
// position (surface/patch.ts), at the covered samples' centroid.
function centroid(shader: THREE.WebGLProgramParametersWithUniforms) {
  const c = (src: string, pars: 'normal_pars_vertex' | 'normal_pars_fragment') => {
    for (const v of ['varying vec3 vViewPosition;', 'varying vec3 vWPos;', '#include <' + pars + '>']) {
      if (!src.includes(v)) throw new Error('centroid: no ' + v);
    }
    return src.replace('#include <' + pars + '>', THREE.ShaderChunk[pars].replace(/varying /g, 'centroid varying '))
      .replace(/(^|\n)(\s*)varying vec3 (vViewPosition|vWPos);/g, '$1$2centroid varying vec3 $3;');
  };
  shader.vertexShader = c(shader.vertexShader, 'normal_pars_vertex');
  shader.fragmentShader = c(shader.fragmentShader, 'normal_pars_fragment');
}

/* A wire: geometry with `wireDir` (unit, outward from the axis; zero
   on an end cap's centre), `wireAxis` (unit, along it) and `wireR`
   (its radius) per vertex. */
export function wireMaterial(mat: THREE.MeshStandardMaterial) {
  return withCoverage(mat, 'wire', (shader) => {
    centroid(shader);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 wireDir, wireAxis;\nattribute float wireR;\ncentroid varying float vWireFade, vWirePx;\ncentroid varying vec3 vWireAxis;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          // A pixel's height at this depth, in metres; the wire is
          // drawn at least that wide and as faint as it is narrower.
          float px = -( modelViewMatrix * vec4( transformed, 1.0 ) ).z * 2.0 / ( projectionMatrix[ 1 ][ 1 ] * uAaH );
          float r = max( wireR, 0.5 * uAaMsaa * px );
          transformed += wireDir * ( r - wireR );
          vWireFade = wireR / r;
          vWirePx = 2.0 * r / px;
          vWireAxis = normalMatrix * wireAxis;
        }`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\ncentroid varying float vWireFade, vWirePx;\ncentroid varying vec3 vWireAxis;')
      .replace('#include <alphatest_fragment>', '#include <alphatest_fragment>\n  diffuseColor.a *= vWireFade;')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
  #if NUM_DIR_LIGHTS > 0
  {
    // View space throughout. The pixel's normal: in the plane across
    // the axis, at the angle from the sun whose cosine is the average.
    vec3 A = normalize( vWireAxis ), V = normalize( vViewPosition );
    vec3 Vp = normalize( V - A * dot( V, A ) );
    vec3 L = directionalLights[ 0 ].direction, Lp = L - A * dot( L, A );
    vec3 nEff = Vp;
    if ( dot( Lp, Lp ) > 1e-8 ) {
      Lp = normalize( Lp );
      float ca = clamp( dot( Vp, Lp ), -1.0, 1.0 ), al = acos( ca );
      float g = acos( clamp( ( sin( al ) + ( PI - al ) * ca ) * 0.25, 0.0, 1.0 ) );
      vec3 T = Vp - Lp * ca;
      T = dot( T, T ) > 1e-6 ? normalize( T ) : normalize( cross( A, Lp ) );
      nEff = Lp * cos( g ) + T * sin( g );
    }
    normal = normalize( mix( normal, nEff, 1.0 - smoothstep( 2.0, 8.0, vWirePx ) ) );
    // The terminator, filtered over the pixel: max(0, n·L) averaged
    // across the range n·L spans within it, and the normal turned
    // toward or away from the sun until n·L is that average.
    float x = dot( normal, L ), w = fwidth( x );
    if ( w > 1e-4 && abs( x ) < 0.5 * w ) {
      float xf = ( x + 0.5 * w ) * ( x + 0.5 * w ) / ( 2.0 * w );
      vec3 P = normal - L * x;
      if ( dot( P, P ) > 1e-8 ) normal = L * xf + normalize( P ) * sqrt( max( 1.0 - xf * xf, 0.0 ) );
    }
  }
  #endif`);
  });
}

/* Mark a geometry as a wire of radius r: `dir` gives each vertex its
   outward direction and the axis's, [dx, dy, dz, ax, ay, az]. */
export type WireDir = (x: number, y: number, z: number, i: number) => [number, number, number, number, number, number];
export function wireGeometry(geo: THREE.BufferGeometry, r: number, dir: WireDir) {
  const p = geo.attributes.position!, n = p.count;   // every three primitive has positions
  const d = new Float32Array(n * 3), a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const v = dir(p.getX(i), p.getY(i), p.getZ(i), i);
    d.set(v.slice(0, 3), i * 3); a.set(v.slice(3), i * 3);
  }
  geo.setAttribute('wireDir', new THREE.BufferAttribute(d, 3));
  geo.setAttribute('wireAxis', new THREE.BufferAttribute(a, 3));
  geo.setAttribute('wireR', new THREE.BufferAttribute(new Float32Array(n).fill(r), 1));
  return geo;
}

// A cylinder (three's, along y) as a wire.
export function wireCylinder(r: number, len: number, seg = 8) {
  return wireGeometry(new THREE.CylinderGeometry(r, r, len, seg), r, (x, _y, z) => {
    const d = Math.hypot(x, z);
    return d > r * 0.5 ? [x / d, 0, z / d, 0, 1, 0] : [0, 0, 0, 0, 1, 0];   // a cap's centre stays
  });
}

/* A cut-out's alpha as coverage. `a` is the GLSL expression for how
   far inside the solid part a fragment is (> 0 solid, < 0 cut), in
   the units of `fp`'s texels; where texels are smaller than pixels it
   is sharpened over one pixel, so the edge gets MSAA's steps. Further
   off, `mean` (the mip-mapped share of solid) is the coverage itself.
   Without MSAA it cuts as alphaTest would. */
export const coverageGLSL = (a: string, mean: string, fp: string) => `
  {
    float cvA = ${a};
    float cv = clamp( cvA / max( fwidth( cvA ), 1e-4 ) + 0.5, 0.0, 1.0 );
    cv = mix( cv, ${mean}, smoothstep( 0.6, 1.4, ${fp} ) );
    if ( uAaMsaa < 0.5 ) { if ( cvA < 0.0 ) discard; }
    else diffuseColor.a = cv;
  }`;
