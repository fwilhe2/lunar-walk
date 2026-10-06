/* ── Mars, from orbit ───────────────────────────────────────────
   Seen from Phobos this fills 42° of sky, so the map has to hold up
   to being looked at. It is two layers drawn from one geography:

   - the albedo map: the classic dark markings at their real places
     (Syrtis Major, Sinus Sabaeus and Meridiani, Mare Acidalium,
     Erythraeum, Sirenum, Cimmerium, Tyrrhenum, Solis Lacus …) over
     a butterscotch dust cover, with outlines that fray the way
     wind-blown dust does rather than ending on an ellipse; wind
     streaks behind craters, dark dune fields on crater floors, the
     polar caps with the north cap's spiral troughs and dune collar.
     Mars is a low-contrast planet: the darkest basalt reflects about
     half what the dust does, and the hues differ less than one
     expects — the dark regions are grey-brown, not chocolate.

   - the elevation map, in kilometres (MOLA's datum, roughly): the
     crustal dichotomy, the Tharsis bulge with Olympus Mons and the
     three Tharsis Montes — Arsia, Pavonis, Ascraeus — and their
     calderas, Alba Mons, Elysium, Valles Marineris from Noctis
     Labyrinthus to the chaos at its eastern end, the big basins, and
     the same craters the albedo map uses, with depths after Garvin's
     depth–diameter law and most of them worn down. Real slopes on
     Mars are gentle at this scale; the terminator still finds them.

   Everything is drawn on the sphere (3D noise), so nothing pinches at
   the poles and the seam does not show. Pure, so it runs off the main
   thread (workers/texgen.jobs.ts). Longitudes are east, −180…180;
   column 0 is −180°, row 0 the north pole.                       */

const DEG = Math.PI / 180;
const R_KM = 3390;

// Integer bit-mix on a 3D lattice, independent of the terrain seed:
// the map must not depend on the world it is seen from.
function h3(x: number, y: number, z: number): number {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1440662683) + 0x2545f491) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vn3(x: number, y: number, z: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  let u = x - xi, v = y - yi, w = z - zi;
  u = u * u * (3 - 2 * u); v = v * v * (3 - 2 * v); w = w * w * (3 - 2 * w);
  const a = h3(xi, yi, zi), b = h3(xi + 1, yi, zi), c = h3(xi, yi + 1, zi), d = h3(xi + 1, yi + 1, zi);
  const e = h3(xi, yi, zi + 1), f = h3(xi + 1, yi, zi + 1), g = h3(xi, yi + 1, zi + 1), k = h3(xi + 1, yi + 1, zi + 1);
  const p = a + (b - a) * u, q = c + (d - c) * u, r = e + (f - e) * u, s = g + (k - g) * u;
  const m = p + (q - p) * v, n = r + (s - r) * v;
  return m + (n - m) * w;
}
// fBm on the unit sphere at frequency f (cycles per radian, roughly),
// centred on zero: −0.5 … 0.5.
function fbm3(x: number, y: number, z: number, f: number, oct: number, off = 0): number {
  let sum = 0, amp = 0.5, norm = 0;
  for (let i = 0; i < oct; i++) {
    sum += amp * vn3(x * f + off + i * 17.3, y * f - off, z * f + off * 0.7);
    norm += amp; amp *= 0.5; f *= 2.03;
  }
  return sum / norm - 0.5;
}
const sst = (a: number, b: number, t: number) => { const v = Math.min(1, Math.max(0, (t - a) / (b - a))); return v * v * (3 - 2 * v); };
const wrap = (d: number) => (d > 180 ? d - 360 : d < -180 ? d + 360 : d);

// Dark albedo markings, as strokes: [lon, lat, half-width in degrees]
// per point, and a strength — placed after the global mosaics (Viking
// MDIM, MGS). What the strokes give is only where dark ground is
// common; the colour pass breaks it into patches, and its outline into
// drifts, the way wind-blown dust actually lies.
type Stroke = { k: number; p: [lon: number, lat: number, w: number][] };
const DARK: Stroke[] = [
  { k: 0.95, p: [[-62, 58, 9], [-42, 53, 12], [-18, 50, 9], [-30, 40, 9], [-34, 30, 6], [-36, 22, 3.5]] }, // Mare Acidalium
  { k: 0.60, p: [[-170, 66, 7], [-130, 64, 8], [-95, 63, 7], [-70, 64, 7]] },                         // Vastitas Borealis, west
  { k: 0.65, p: [[5, 58, 6], [40, 56, 7], [75, 55, 8], [110, 55, 8], [145, 58, 7], [180, 62, 6]] },  // Vastitas, Utopia's north
  { k: 1.00, p: [[66, 25, 3.5], [68, 16, 6], [71, 6, 8.5], [75, -4, 9], [82, -12, 8]] },             // Syrtis Major
  { k: 0.60, p: [[78, 30, 2.5], [90, 34, 3], [96, 33, 2]] },                                         // Nilosyrtis
  { k: 0.78, p: [[85, -14, 8], [105, -16, 8], [125, -19, 9], [148, -21, 9], [172, -24, 7]] },        // Tyrrhenum, Cimmerium
  { k: 0.85, p: [[-178, -26, 5], [-160, -30, 7], [-140, -33, 8], [-122, -33, 7], [-108, -29, 4]] },  // Sirenum, Memnonia
  { k: 0.45, p: [[-104, -26, 5], [-85, -26, 5], [-68, -26, 4]] },                                     // Solis, Thaumasia's rim
  { k: 0.80, p: [[-62, -10, 5], [-50, -14, 7], [-38, -12, 6], [-34, -2, 3.5]] },                     // Aurorae, Margaritifer
  { k: 0.55, p: [[-58, -28, 7], [-32, -31, 9], [-6, -30, 7]] },                                      // Mare Erythraeum
  { k: 0.88, p: [[-22, -5, 4], [-4, -3, 4.5], [16, -8, 5], [36, -8, 5.5], [54, -4, 5.5]] },         // Meridiani, Sabaeus
  { k: 0.50, p: [[8, -22, 6], [30, -24, 7], [50, -22, 6]] },                                         // Pandorae Fretum
  { k: 0.40, p: [[-40, -60, 8], [10, -62, 9], [60, -64, 8], [120, -60, 8], [-150, -62, 8]] },        // the far south
  { k: 0.50, p: [[108, 37, 2.2], [117, 24, 2.4], [126, 10, 2.2]] },                                  // the streak across Elysium
  { k: 0.75, p: [[143, 14, 2], [154, 12, 3.2], [166, 10, 2.2]] },                                    // Cerberus
  { k: 0.45, p: [[92, -40, 5], [110, -44, 5]] },                                                      // Mare Hadriacum
];

// The volcanoes: [lon, lat, radius°, height km above the ground there,
// caldera radius°, caldera depth km]. Olympus stands 22 km over the
// datum on a 5° shield ringed by a scarp; the Tharsis Montes are 3°.
type Volcano = [lon: number, lat: number, r: number, h: number, cr: number, cd: number];
const VOLC: Volcano[] = [
  [-133.8, 18.4, 5.0, 17.0, 0.70, 3.0],   // Olympus Mons
  [-120.5, -8.3, 3.1, 11.0, 0.95, 1.4],   // Arsia Mons
  [-113.4, 1.1, 2.6, 9.0, 0.45, 4.0],     // Pavonis Mons
  [-104.4, 11.3, 2.8, 11.5, 0.50, 3.0],   // Ascraeus Mons
  [146.9, 24.8, 2.4, 9.0, 0.22, 1.0],     // Elysium Mons
  [-97.0, 9.8, 0.9, 4.0, 0.20, 1.0],      // Tharsis Tholus
  [-97.2, 24.0, 0.9, 3.5, 0.18, 0.8],     // Ceraunius Tholus
];

// The craters worth a name from here: [lon, lat, radius°].
const NAMED: [lon: number, lat: number, r: number][] = [
  [16.7, -2.7, 3.9], [55.6, -13.9, 3.8], [32.5, 23.6, 3.5],      // Schiaparelli, Huygens, Cassini
  [-158.1, -40.8, 2.5], [-169.0, -49.2, 2.5], [141.0, -47.1, 2.1], // Newton, Copernicus, Kepler
  [29.3, 50.5, 1.9], [-30.9, -50.6, 1.9], [137.8, -5.4, 1.3],     // Lyot, Galle, Gale
  [-81.4, -52.0, 1.7], [-8.4, -23.9, 1.4], [-40.4, 44.3, 0.6],    // Lowell, Flaugergues, Arandas
];

// Valles Marineris, west to east: [lon, lat, half-width°, depth km].
const VM: [lon: number, lat: number, w: number, d: number][][] = [
  [[-91, -6, 0.9, 5], [-85, -7.5, 1.3, 6.5], [-78, -8, 1.0, 7]],             // Ius
  [[-79, -9, 1.4, 6], [-72, -9.5, 2.2, 7], [-66, -10, 2.0, 7]],              // Melas
  [[-77, -6.5, 1.5, 5], [-71, -6.5, 2.0, 6], [-65, -6, 1.6, 5.5]],           // Candor
  [[-73, -4, 1.0, 5], [-66, -4, 1.3, 5]],                                    // Ophir
  [[-66, -11, 1.3, 6], [-60, -13, 1.3, 6.5], [-53, -13.5, 1.2, 5.5], [-46, -12.5, 1.6, 4.5]],  // Coprates
  [[-46, -12, 2.0, 4], [-40, -10, 2.5, 3.5], [-35, -6, 2.3, 3]],             // Eos and Capri chaos
  [[-52, -7, 1.0, 3.5], [-46, -7.5, 1.1, 3.5]],                              // Ganges
  [[-62, -1.5, 0.8, 3.5]],                                                   // Hebes
  [[-61.5, -4, 0.7, 3.5], [-62, -2, 0.6, 3]],                                // Juventae
];
// Outflow channels into Chryse: [lon, lat, half-width°, depth km].
const OUT: [lon: number, lat: number, w: number, d: number][][] = [
  [[-78, 3, 1.0, 1.5], [-75, 15, 1.5, 2.0], [-70, 22, 1.8, 2.0], [-60, 24, 1.6, 1.8], [-52, 25, 1.3, 1.2]],  // Kasei
  [[-34, -2, 1.2, 1.5], [-30, 6, 1.0, 1.2], [-28, 14, 1.0, 0.9]],                                           // Tiu, Ares
  [[-38, 0, 1.0, 1.3], [-37, 10, 0.9, 1.0], [-36, 18, 0.9, 0.7]],                                           // Simud
];
// Basins: [lon, lat, radius°, depth km, rim km].
const BASINS: [lon: number, lat: number, r: number, d: number, rim: number][] = [
  [70, -42, 19, 8.5, 2.0],     // Hellas
  [-43, -50, 9, 5.0, 1.8],     // Argyre
  [88, 13, 7, 3.5, 1.0],       // Isidis
  [110, 47, 15, 2.0, 0.0],     // Utopia
  [-40, 25, 9, 1.2, 0.0],      // Chryse
];

// Distance in degrees from (lon, lat) to a polyline, with the half-width
// interpolated along it. Flat, with longitude scaled by cos(lat): good
// enough at the sizes these features have.
// A stroke's latitude band and longitude span, padded by `pad` of its
// widest half-width: outside it the stroke is not asked.
type Box = [la0: number, la1: number, lo: number, half: number, pad: number];
function strokeBox(p: readonly (readonly number[])[], pad: number): Box {
  let la0 = 90, la1 = -90, wm = 0, lmin = 0, lmax = 0;
  const l0 = p[0]![0]!;                                     // strokes are never empty
  for (const q of p) {
    la0 = Math.min(la0, q[1]!); la1 = Math.max(la1, q[1]!); wm = Math.max(wm, q[2]!);
    const d = wrap(q[0]! - l0); lmin = Math.min(lmin, d); lmax = Math.max(lmax, d);
  }
  return [la0 - wm * pad, la1 + wm * pad, wrap(l0 + (lmin + lmax) / 2), (lmax - lmin) / 2, wm * pad + 0.5];
}
const near = (b: Box, lon: number, lat: number, cl: number) =>
  lat > b[0] && lat < b[1] && Math.abs(wrap(lon - b[2])) < b[3] + b[4] / cl;
const DARK_BOX = DARK.map((s) => strokeBox(s.p, 2.2));
const VM_BOX = VM.map((s) => strokeBox(s, 3));
const OUT_BOX = OUT.map((s) => strokeBox(s, 3));

// strokeDist()'s answer: distance, half-width and depth there. Written
// in place — a tuple per call was a third of the map's time in GC.
const SD = new Float64Array(3);
function strokeDist(lon: number, lat: number, cl: number, p: readonly (readonly number[])[]) {
  let best = 1e9, bw = 1, bd = 0;
  for (let i = 0; i < Math.max(1, p.length - 1); i++) {
    const a = p[i]!, b = p[Math.min(i + 1, p.length - 1)]!;   // in range: i < length
    const ax = wrap(a[0]! - lon) * cl, ay = a[1]! - lat;
    // b relative to a, so a segment never spans the long way round.
    const bx = ax + wrap(b[0]! - a[0]!) * cl, by = b[1]! - lat;
    const ex = bx - ax, ey = by - ay, ee = ex * ex + ey * ey;
    const t = ee > 0 ? Math.min(1, Math.max(0, -(ax * ex + ay * ey) / ee)) : 0;
    const dx = ax + ex * t, dy = ay + ey * t, dd = Math.sqrt(dx * dx + dy * dy);
    const w = a[2]! + (b[2]! - a[2]!) * t;
    if (dd / w < best / bw) { best = dd; bw = w; bd = (a[3] ?? 0) + ((b[3] ?? 0) - (a[3] ?? 0)) * t; }
  }
  SD[0] = best; SD[1] = bw; SD[2] = bd;
}

// A smooth field, evaluated on every step-th pixel and interpolated:
// the large scales need not cost a noise call per pixel.
function coarse(W: number, H: number, step: number, fn: (X: number, Y: number, Z: number) => number): Float32Array {
  const gw = W / step, gh = Math.floor((H - 1) / step) + 2, g = new Float32Array(gw * gh);
  for (let j = 0; j < gh; j++) {
    const lat = (90 - (Math.min(j * step, H - 1) + 0.5) / H * 180) * DEG;
    for (let k = 0; k < gw; k++) {
      const lon = ((k * step + 0.5) / W * 360 - 180) * DEG;
      g[j * gw + k] = fn(Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon));
    }
  }
  const out = new Float32Array(W * H);
  // Grid indices stay inside gw × gh: j0 + 1 ≤ (H − 1) / step + 1 < gh, k wraps.
  for (let y = 0; y < H; y++) {
    const j0 = Math.floor(y / step), v = y / step - j0;
    for (let x = 0; x < W; x++) {
      const k0 = Math.floor(x / step), u = x / step - k0, k1 = (k0 + 1) % gw;
      const a = g[j0 * gw + k0]!, b = g[j0 * gw + k1]!, c = g[(j0 + 1) * gw + k0]!, d = g[(j0 + 1) * gw + k1]!;
      out[y * W + x] = (a + (b - a) * u) + ((c + (d - c) * u) - (a + (b - a) * u)) * v;
    }
  }
  return out;
}

export function marsPixels(W: number, H: number) {
  const N = W * H;
  const elev = new Float32Array(N);          // km
  const dk = new Float32Array(N);            // darkness 0 … 1
  const alb = new Float32Array(N);           // extra albedo multiplier − 1
  const ice = new Float32Array(N);           // polar caps and basin frost, 0 … 1
  const day = new Uint8ClampedArray(N * 4);
  const px = W / 360, py = H / 180;

  // Unit vectors of every pixel, once.
  const PX = new Float32Array(N), PY = new Float32Array(N), PZ = new Float32Array(N);
  for (let y = 0; y < H; y++) {
    const lat = 90 - (y + 0.5) / py, cl = Math.cos(lat * DEG), sl = Math.sin(lat * DEG);
    for (let x = 0; x < W; x++) {
      const lon = (x + 0.5) / px - 180, i = y * W + x;
      PX[i] = cl * Math.cos(lon * DEG); PY[i] = sl; PZ[i] = cl * Math.sin(lon * DEG);
    }
  }

  // The smooth parts of the noise, coarse.
  const WL = coarse(W, H, 4, (X, Y, Z) => fbm3(X, Y, Z, 3, 4, 3.1) * 9 + fbm3(X, Y, Z, 11, 3, 8.2) * 2.5);
  const WB = coarse(W, H, 4, (X, Y, Z) => fbm3(X, Y, Z, 3, 4, 5.7) * 7 + fbm3(X, Y, Z, 11, 3, 1.9) * 2);
  const BIG = coarse(W, H, 4, (X, Y, Z) => fbm3(X, Y, Z, 4, 4, 2.2) * 14);
  const REL = coarse(W, H, 4, (X, Y, Z) => fbm3(X, Y, Z, 2, 3, 6.6) * 2.5);
  const ROUGH = coarse(W, H, 2, (X, Y, Z) => fbm3(X, Y, Z, 6, 4, 4.4));
  const CAPN = coarse(W, H, 2, (X, Y, Z) => (Y > 0.85 ? fbm3(X, Y, Z, 14, 3, 5.5) * 9 : 0));
  const CAPS = coarse(W, H, 2, (X, Y, Z) => (Y < -0.9 ? fbm3(X, Y, Z, 14, 3, 1.5) * 6 : 0));
  const POL = coarse(W, H, 2, (X, Y, Z) => (Math.abs(Y) > 0.9 ? fbm3(X, Y, Z, 8, 3) * 4 : 0));
  const MOT = coarse(W, H, 4, (X, Y, Z) => fbm3(X, Y, Z, 9, 3, 1.1));
  // The outlines' fray and the dark ground's mottling: the coarse
  // octaves here, the one finest octave a pixel can hold per pixel.
  const FR = coarse(W, H, 2, (X, Y, Z) => fbm3(X, Y, Z, 22, 3, 7.7) * 0.94);
  // Tone in the dust: where it is a deep orange and where pale tan,
  // streaked east–west and bent, the way the wind lays it down.
  const SAT = coarse(W, H, 4, (X, Y, Z) => fbm3(X, Y, Z, 4, 3, 17.1));
  const STREAK = coarse(W, H, 2, (X, Y, Z) => {
    const bend = fbm3(X, Y, Z, 2.5, 2, 23.4) * 0.3;
    return fbm3(X * 0.4, Y + bend, Z * 0.4, 30, 4, 5.9);
  });
  // Water-ice haze: morning fog in the basins, hoods over the poles,
  // veils on the volcanoes' flanks. Baked into the map, so it turns
  // with the ground, which real cloud does only roughly.
  const HAZE = coarse(W, H, 4, (X, Y, Z) =>
    sst(0.04, 0.3, fbm3(X, Y, Z, 2.2, 4, 31.7)) * 0.38 + sst(0.7, 0.9, Math.abs(Y)) * 0.3);
  const oro = new Float32Array(N);
  const DUSK = coarse(W, H, 4, (X, Y, Z) => 0.32 * sst(0.02, 0.3, fbm3(X, Y, Z, 6, 4, 12.5)));
  const MOD = coarse(W, H, 2, (X, Y, Z) => fbm3(X, Y, Z, 40, 2, 2.7));

  // ── the large-scale fields, per pixel
  for (let y = 0; y < H; y++) {
    const lat0 = 90 - (y + 0.5) / py, c0 = Math.cos(lat0 * DEG);
    // The markings this row can reach: the warp moves latitude by at
    // most 4.5°.
    const rowDark: number[] = [];
    for (let j = 0; j < DARK.length; j++) {
      const b = DARK_BOX[j]!;                                // j < length
      if (lat0 > b[0] - 5 && lat0 < b[1] + 5) rowDark.push(j);
    }
    for (let x = 0; x < W; x++) {
      const i = y * W + x, X = PX[i]!, Y = PY[i]!, Z = PZ[i]!;   // i < N
      const lon0 = (x + 0.5) / px - 180;
      // Warp the coordinates a few degrees, so no outline is the
      // smooth curve it was written as.
      const wl = WL[i]!, wb = WB[i]!;
      const lat = lat0 + wb, lon = wrap(lon0 + wl / Math.max(c0, 0.2));
      const cl = Math.max(Math.cos(lat * DEG), 0.05), alat = Math.abs(lat0);

      // ── elevation
      // The dichotomy: old cratered highlands 1–3 km up in the south,
      // the smooth northern plains 4–5 km down; the boundary swings
      // from Arabia's 35° N to the equator at Amazonis and Elysium.
      const bLat = 14 + 18 * Math.cos((lon0 - 25) * DEG) + BIG[i]!;
      const south = sst(bLat + 4, bLat - 4, lat0);
      const rough = ROUGH[i]!;
      let h = -4.4 + south * 5.6 + rough * (0.35 + south * 1.2) + REL[i]!;
      // Tharsis: the bulge, Alba's low dome, then the shields on top.
      const tx = wrap(lon0 + 105) * c0, ty = lat0 - 0;
      h += 8.5 * Math.exp(-(tx * tx + ty * ty) / (2 * 22 * 22));
      const ax = wrap(lon0 + 110) * c0, ay = lat0 - 40;
      h += 5.0 * Math.exp(-(ax * ax + ay * ay) / (2 * 8 * 8));
      const ex = wrap(lon0 - 145) * c0, ey = lat0 - 24;
      h += 2.6 * Math.exp(-(ex * ex + ey * ey) / (2 * 9 * 9));
      let shield = 0, cald = 0, scarp = 0, flank = 0, foot = 0;
      // Indexed, not destructured: this runs per pixel, and a
      // destructuring for-of costs more than the shields themselves.
      for (let j = 0; j < VOLC.length; j++) {
        const v = VOLC[j]!;                                  // j < length
        const vb = v[1], vr = v[2];
        if (Math.abs(lat0 - vb) > vr * 1.6) continue;
        const vl = v[0], vh = v[3], cr = v[4], cd = v[5];
        const dx = wrap(lon0 - vl) * c0, dy = lat0 - vb;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > vr * 1.6) continue;
        // A shield: broad, convex, gentle — a few degrees of slope —
        // and Olympus ends on a cliff several kilometres high.
        const rr = d / vr + fbm3(X, Y, Z, 60, 2, vl) * 0.05;
        const cliff = vr > 4 ? 1 : 0;
        const prof = rr < 1 ? Math.pow(1 - rr * rr, 0.75) : 0;
        const apron = cliff ? 0 : Math.max(0, 1 - (rr - 1) / 0.6) ** 2 * 0.06 * (rr > 1 ? 1 : 0);
        h += vh * (prof * (1 - cliff * 0.25) + cliff * 0.25 * sst(1.04, 0.97, rr)) + vh * apron;
        shield = Math.max(shield, rr < 1 ? 1 - rr : 0);
        if (vr > 2) oro[i] = Math.max(oro[i]!, sst(1.6, 1.0, rr) * sst(0.6, 1.0, rr) * 0.18);
        // Lava flows run down the flanks: radial streaks in the albedo,
        // and a ring of bright dust banked against the foot.
        if (rr < 1.35) {
          const az = Math.atan2(dy, dx);
          const rays = vn3(Math.cos(az) * 14 + vl, Math.sin(az) * 14, rr * 3);
          flank = Math.max(flank, sst(1.0, 0.75, rr) * (0.55 + rays * 0.6));
          foot = Math.max(foot, sst(0.85, 1.0, rr) * sst(1.35, 1.08, rr));
        }
        if (cliff) scarp = Math.max(scarp, 1 - Math.abs(rr - 1) / 0.05);
        // The caldera: a flat floor with nested collapse pits.
        const cq = d / cr;
        if (cq < 1.3) {
          const pit = sst(1.0, 0.85, cq) * cd;
          h -= pit; cald = Math.max(cald, sst(1.05, 0.8, cq));
        }
      }
      // Basins, after the plateau: floors sunk, rims raised.
      for (let j = 0; j < BASINS.length; j++) {
        const bs = BASINS[j]!;                               // j < length
        const bl = bs[0], bb = bs[1], br = bs[2], bd = bs[3], rim = bs[4];
        if (Math.abs(lat - bb) > br * 2) continue;
        const dx = wrap(lon - bl) * cl, dy = lat - bb, q = Math.sqrt(dx * dx + dy * dy) / br;
        if (q > 2) continue;
        h -= bd * sst(1.0, 0.55, q) - rim * Math.exp(-((q - 1.0) ** 2) / 0.03);
      }
      // Valles Marineris and the outflow channels, steep-walled.
      let vm = 0;
      for (let j = 0; j < VM.length; j++) {
        const s = VM[j]!;                                    // j < length
        if (!near(VM_BOX[j]!, lon0, lat0, c0)) continue;
        strokeDist(lon0 + wl * 0.08, lat0 + wb * 0.08, c0, s);
        const dd = SD[0]!, w = SD[1]!, dep = SD[2]!;
        if (dd > w * 2.2) continue;
        // Walls scalloped by landslides and side canyons, so neither
        // the rim nor the floor runs straight.
        const q = dd / (w * (1 + fbm3(X, Y, Z, 40, 3, 9.1) * 0.7 + fbm3(X, Y, Z, 110, 2, 3.3) * 0.5));
        // The walls take a third of the half-width or more: tens of
        // kilometres of spurs and landslides, not a cliff.
        if (q < 1.6) { const c = sst(1.4, 0.55, q); vm = Math.max(vm, c); h -= dep * c * (0.8 + fbm3(X, Y, Z, 30, 3) * 0.5); }
      }
      for (let j = 0; j < OUT.length; j++) {
        const s = OUT[j]!;                                   // j < length
        if (!near(OUT_BOX[j]!, lon0, lat0, c0)) continue;
        strokeDist(lon0 + wl * 0.15, lat0 + wb * 0.15, c0, s);
        const dd = SD[0]!, w = SD[1]!, dep = SD[2]!;
        const q = dd / w;
        if (q < 1.5) h -= dep * sst(1.1, 0.5, q);
      }
      // Noctis Labyrinthus: a maze of troughs at Tharsis's crest.
      const nx = wrap(lon0 + 102), ny = lat0 + 7;
      if (Math.abs(nx) < 7 && Math.abs(ny) < 5) {
        const m = 1 - sst(4, 7, Math.abs(nx)) * 1;
        // The troughs follow two fault sets, bent and broken by noise.
        const g1 = Math.abs(Math.sin((nx * 0.9 + ny * 0.4) * 1.3 + fbm3(X, Y, Z, 30, 3) * 9));
        const g2 = Math.abs(Math.sin((nx * 0.3 - ny * 1.0) * 1.5 + fbm3(X, Y, Z, 30, 3, 4) * 9));
        const t = sst(0.22, 0.05, Math.min(g1, g2)) * m * sst(5, 3, Math.abs(ny)) * sst(-0.1, 0.1, fbm3(X, Y, Z, 25, 2, 6));
        h -= t * 3.5; vm = Math.max(vm, t * 0.7);
      }
      // The polar layered deposits: domes of ice 2–3 km high, cut by
      // spiral troughs and, in the north, Chasma Boreale.
      const nP = lat0 > 70 ? sst(78, 86, lat0 + POL[i]!) : 0;
      const spiral = nP === 0 ? 0 : Math.sin(Math.atan2(Z, X) * 1 + (90 - alat) * 0.55 * Math.PI / 4 + fbm3(X, Y, Z, 12, 2) * 2);
      const trough = nP * sst(0.75, 0.95, spiral);
      const chasma = lat0 > 75 ? sst(4, 1, Math.abs(wrap(lon0 + 50) * c0 - (88 - lat0) * 0.4)) * sst(76, 82, lat0) * sst(88, 84, lat0) : 0;
      h += nP * 2.6 - trough * 0.6 - chasma * 1.6;
      const sP = sst(-76, -84, lat0 + POL[i]! * 1.2);
      h += sP * 3.0;
      elev[i] = h;

      // ── albedo
      let C = 0;
      for (const j of rowDark) {
        const s = DARK[j]!;                                  // j < length
        if (!near(DARK_BOX[j]!, lon, lat, cl)) continue;
        strokeDist(lon, lat, cl, s.p);
        const dd = SD[0]!, w = SD[1]!;
        if (dd > w * 2) continue;
        C = Math.max(C, s.k * (1 - sst(0.35, 1.5, dd / w)));
      }
      // The lowlands and the far south are darker than the dusty
      // plateaus, a little, everywhere.
      C = Math.max(C, (1 - south) * 0.30 * sst(35, 55, lat0), sst(-38, -55, lat0) * 0.30);
      // And the bright regions are not blank: dusky patches and
      // wind-sorted tones everywhere, a few tenths of the dark.
      C = Math.max(C, DUSK[i]!);
      // Where it is common, dark ground still comes in patches: break
      // the coverage up by a high-contrast noise, and fray its edge.
      const fine = vn3(X * 180, Y * 180 + 3.3, Z * 180) - 0.5;
      const fr = FR[i]! + fine * 0.08;
      const clump = sst(-0.28, 0.24, MOD[i]! + fine * 0.2 + (C - 0.5) * 0.3);
      let D = sst(0.0, 0.95, C + fr * 0.6) * (0.4 + 0.7 * clump);
      // The north polar dune collar, Olympia Undae.
      D = Math.max(D, 0.75 * sst(74, 78, lat0 + fr * 6) * sst(85, 81, lat0 + fr * 6));
      // Valles Marineris shows dark floors between bright walls.
      D = Math.max(D, vm * (0.25 + clump * 0.3));
      // The volcanoes: dust-mantled flanks; the calderas' floors and
      // walls are what shows dark from orbit.
      D = D * (1 - shield * 0.8) + flank * 0.32 + cald * 0.65;
      dk[i] = Math.min(1, Math.max(0, D));
      alb[i] = foot * 0.035 + scarp * 0.04;

      // Polar caps (seasonal: a late northern-spring Mars, so the
      // north cap is large and the south one shrunk to its residual).
      const capN = sst(79, 83, lat0 + CAPN[i]! * 0.6) * (1 - trough * 0.55) * (1 - chasma * 0.5);
      // The residual south cap is off-centre, toward 40° W.
      const capS = sst(-82, -86, lat0 + CAPS[i]! - 2.5 * Math.cos((lon0 + 40) * DEG));
      // Bright frost in the floor of Hellas and Argyre, often hazed.
      const hx = wrap(lon0 - 70) * c0, hy = lat0 + 42;
      // Hellas's floor is bright, but with dust, not with frost — late
      // in the year it fills with haze and frost, which this is not.
      const hel = sst(16, 8, Math.sqrt(hx * hx + hy * hy) + fr * 8);
      alb[i] = alb[i]! + hel * 0.10; dk[i] = dk[i]! * (1 - hel * 0.85);
      ice[i] = Math.min(1, Math.max(capN, capS));
    }
  }

  // ── craters, stamped: one list for both maps.
  let s = 90210;
  const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let n = 0; n < NAMED.length + 9000; n++) {
    const nm = NAMED[n];
    let lat: number, lon: number, rad: number;
    if (nm) [lon, lat, rad] = nm;
    else {
      lat = Math.asin(rnd() * 2 - 1) / DEG; lon = rnd() * 360 - 180;
      rad = 0.22 / Math.sqrt(1 - rnd() * 0.985);             // degrees; N(>r) ∝ r^-2, up to ~1.8°
    }
    const x0 = Math.floor((lon + 180) * px), y0 = Math.floor((90 - lat) * py);
    const iy = Math.min(H - 1, Math.max(0, y0)), ix = Math.min(W - 1, Math.max(0, x0));
    // Craters survive on the old south and are buried in the north,
    // on the shields and on the polar ice.
    const hHere = elev[iy * W + ix]!;                        // clamped into range above
    const keep = hHere > -2 ? 1 : hHere > -3.5 ? 0.35 : 0.12;
    if (!nm && (rnd() > keep || Math.abs(lat) > 80)) continue;
    const Dkm = rad * 2 * DEG * R_KM;
    const fresh = nm ? 0.15 : Math.pow(rnd(), 2.2);         // most are worn down
    // Garvin's fresh depths flatten out past ~100 km, and almost every
    // crater on Mars is far from fresh: Noachian ones are filled with
    // lava, sediment and dust to a fraction of their depth, the big
    // ones most of all (Huygens, 460 km across, is ~1.5 km deep).
    const depth = 0.36 * Math.pow(Math.min(Dkm, 100), 0.49) * (0.12 + 0.6 * fresh) * Math.min(1, Math.sqrt(100 / Dkm));
    const rim = depth * (0.1 + 0.25 * fresh);
    const peak = Dkm > 30 ? depth * 0.35 * fresh : 0;
    const flat = Dkm > 10 ? Math.min(0.55, 0.2 + Dkm / 300) : 0;
    // Dark sand on the floors of southern craters; a streak of dust or
    // of scoured ground downwind of the fresher ones, turned by the
    // season's winds (northerlies in the tropics, westerlies further out).
    const dune = rnd() < 0.15 + dk[iy * W + ix]! * 0.7 ? 0.2 + rnd() * 0.35 : 0;
    const streak = Math.abs(lat) < 45 && rnd() < 0.35 * (0.4 + fresh) ? (rnd() < 0.55 ? 1 : -1) : 0;
    const wAz = (Math.abs(lat) < 25 ? 200 : lat < 0 ? 110 : 250) + (rnd() - 0.5) * 50;
    const wx = Math.sin(wAz * DEG), wy = Math.cos(wAz * DEG);   // east, north
    const sLen = 3 + rnd() * 5;
    const cl = Math.max(Math.cos(lat * DEG), 0.1);
    const reach = Math.max(2.6, streak ? sLen + 1.5 : 0) * rad;
    const ry = Math.ceil(reach * py) + 1, rx = Math.ceil(reach * px / cl) + 1;
    for (let dy = -ry; dy <= ry; dy++) {
      const yy = y0 + dy;
      if (yy < 0 || yy >= H) continue;
      const la = 90 - (yy + 0.5) / py, cla = Math.cos(la * DEG);
      for (let dx = -rx; dx <= rx; dx++) {
        const xx = ((x0 + dx) % W + W) % W, i = yy * W + xx;
        const lo = (xx + 0.5) / px - 180;
        const ex = wrap(lo - lon) * cla / rad, ey = (la - lat) / rad;
        const q = Math.sqrt(ex * ex + ey * ey);
        if (q < 2.6) {
          // Bowl (flat-floored past 10 km), rim, ejecta falling as q⁻³.
          let p: number;
          if (q < 1) {
            const f = q < flat ? 0 : (q - flat) / (1 - flat);
            p = -depth + (depth + rim) * f * f + (peak ? peak * Math.exp(-q * q / 0.012) : 0);
          } else p = rim * Math.pow(q, -3) * sst(2.6, 1.8, q);
          elev[i] = elev[i]! + p;                            // i < N: yy and xx are in range
          if (dune && q < 0.75) {
            const o = Math.hypot(ex - wx * 0.25, ey - wy * 0.25);
            dk[i] = Math.max(dk[i]!, dune * sst(0.5, 0.2, o));
          }
          // Fresh rims and ejecta are a little brighter, fresh bowls a
          // little darker; old craters only show by their shading.
          alb[i] = alb[i]! + fresh * (q < 0.9 ? -0.04 : 0.04 * sst(2.2, 1.0, q));
        }
        if (streak) {
          const along = ex * wx + ey * wy, across = ex * wy - ey * wx;
          if (along > 0.6 && along < sLen) {
            const wdt = 0.9 + along * 0.12;
            const k = Math.exp(-(across * across) / (wdt * wdt * 0.5)) * sst(sLen, 1.2, along) * sst(0.6, 1.4, along);
            if (streak > 0) alb[i] = alb[i]! + k * 0.05;
            else dk[i] = Math.min(1, dk[i]! + k * 0.25);
          }
        }
      }
    }
  }

  // ── colour
  for (let i = 0; i < N; i++) {
    const X = PX[i]!, Y = PY[i]!, Z = PZ[i]!;                // i < N
    const n1 = MOT[i]!, n2 = vn3(X * 70 + 2.3, Y * 70 - 2.3, Z * 70) - 0.5;
    // Dust: butterscotch, brighter where it lies thickest (Tharsis,
    // Arabia, Elysium — the high, dusty plateaus).
    const d = dk[i]!, st = STREAK[i]!;
    // Deep orange where the dust is thick and fresh, pale tan where
    // it is thin or mixed; streaks run through both.
    const sat = sst(-0.22, 0.22, SAT[i]! + st * 0.5);
    let r = 212 + n1 * 24 + sat * 8, g = 155 + n1 * 16 - sat * 2, b = 116 + n1 * 10 - sat * 12;
    // Basalt and dark sand: under half the dust's brightness and
    // nearly neutral — grey with a little brown, not chocolate.
    r += (100 - r) * d; g += (92 - g) * d; b += (88 - b) * d;
    const m = 1 + alb[i]! + n2 * 0.06 + st * 0.08 * (1 - d);
    r *= m; g *= m; b *= m;
    // Where the dust lies thickest — the high plateaus round Tharsis,
    // Lunae Planum, Arabia — its streaks glow a bright golden orange:
    // fine, fresh, unmixed dust, the brightest ground on the planet.
    const hz = Math.min(0.45, HAZE[i]! + oro[i]!);
    const thick = sst(0.5, 6, elev[i]!);
    const glow = sst(0.0, 0.3, SAT[i]! * 0.9 + st * 0.45 + thick * 0.25 - 0.06) * (1 - d) * (1 - d) * (1 - hz * 1.6);
    if (glow > 0) { r += (248 - r) * glow * 0.75; g += (184 - g) * glow * 0.75; b += (112 - b) * glow * 0.75; }
    // Haze: veils it toward a pale blue-grey and takes the contrast
    // out of what is under it.
    r += (200 - r) * hz; g += (192 - g) * hz; b += (190 - b) * hz;
    // Caps and frost: a near-white with a little dust in it.
    const c = ice[i]!;
    r += (236 - r) * c; g += (232 - g) * c; b += (226 - b) * c;
    day[i * 4] = r; day[i * 4 + 1] = g; day[i * 4 + 2] = b; day[i * 4 + 3] = 255;
  }
  return { day, elev };
}
