import { clamp01, hash2, smoothT } from '../../kernel/noise';

/* ── Jupiter ────────────────────────────────────────────────────
   From Europa it is 12° across, twenty-four times our Moon, so the
   map is looked at closely and has to hold up. What makes Jupiter
   Jupiter is its jets: a dozen zonal winds, alternating east and
   west with latitude, shear everything into bands — pale zones
   where gas rises and cold ammonia cloud forms, darker belts where
   it sinks and the deeper, browner cloud shows through — and the
   shear at every boundary rolls up into eddies and ovals. So the
   map is built the way the planet is: a latitude profile of belts
   and zones, displaced by turbulence that is stretched along the
   jets, stirred by eddies on the boundaries, and then the named
   features — the Great Red Spot in its hollow, oval BA, the String
   of Pearls, the brown barges in the North Equatorial Belt, and
   along its southern edge the blue-grey hot spots, holes down to
   the warm depths, trailing festoons across the Equatorial Zone.
   Colours are true colour, which is subtler than most pictures of
   it: cream and tan and brown, and only the Red Spot is red. */
export function jupiterPixels(W, H) {
  const px = new Uint8ClampedArray(W * H * 4);
  // Noise that wraps in longitude, period P lattice cells.
  const pn = (x, y, P) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const u = smoothT(x - xi), v = smoothT(y - yi);
    const x0 = ((xi % P) + P) % P, x1 = (x0 + 1) % P;
    return (hash2(x0, yi) * (1 - u) + hash2(x1, yi) * u) * (1 - v)
         + (hash2(x0, yi + 1) * (1 - u) + hash2(x1, yi + 1) * u) * v;
  };
  const pf = (x, y, P, oct) => {
    let sum = 0, amp = 0.5, f = 1, n = 0;
    for (let i = 0; i < oct; i++) { sum += amp * pn(x * f, y * f, P * f); n += amp; amp *= 0.5; f *= 2; }
    return sum / n;
  };

  // The profile, north to south: each row is a band's southern edge
  // in latitude, its colour, and how turbulent it is. Belts churn;
  // zones are smoother.
  const BANDS = [
    [ 64, 120, 118, 116, 0.9],   // north polar region, blue-grey
    [ 57, 146, 140, 130, 0.8],
    [ 51, 176, 168, 152, 0.6],
    [ 45, 150, 138, 122, 0.8],
    [ 39, 194, 184, 166, 0.5],   // north north temperate zone
    [ 34, 160, 136, 110, 0.8],   // NNTB
    [ 28, 212, 202, 182, 0.4],   // north temperate zone
    [ 23, 178, 134,  96, 0.9],   // north temperate belt, orange-brown
    [ 17, 228, 218, 196, 0.35],  // north tropical zone
    [  7, 150, 104,  72, 1.0],   // north equatorial belt, the darkest
    [ -7, 224, 206, 170, 0.5],   // equatorial zone, cream with ochre
    [-19, 162, 120,  84, 1.0],   // south equatorial belt
    [-26, 230, 221, 201, 0.35],  // south tropical zone, the Red Spot's
    [-32, 172, 146, 116, 0.7],   // south temperate belt
    [-38, 214, 205, 186, 0.4],   // south temperate zone
    [-45, 162, 148, 128, 0.7],
    [-51, 184, 176, 160, 0.6],
    [-58, 148, 140, 128, 0.8],
    [-65, 158, 152, 142, 0.7],
    [-90, 118, 116, 114, 0.9],   // south polar region
  ];
  // Tabulated at 0.05°, and softened, so band edges are sharp but not
  // aliased: a jet boundary on Jupiter is a few hundred kilometres.
  const LN = 3601, lut = new Float32Array(LN * 4);
  for (let k = 0; k < LN; k++) {
    const lat = 90 - k * 0.05;
    let b = 0;
    while (b < BANDS.length - 1 && lat < BANDS[b][0]) b++;
    lut.set([BANDS[b][1], BANDS[b][2], BANDS[b][3], BANDS[b][4]], k * 4);
  }
  const soft = new Float32Array(LN * 4);
  for (let k = 0; k < LN; k++) {
    for (let c = 0; c < 4; c++) {
      let s = 0, n = 0;
      for (let d = -14; d <= 14; d++) { const j = Math.min(LN - 1, Math.max(0, k + d)); s += lut[j * 4 + c]; n++; }
      soft[k * 4 + c] = s / n;
    }
  }
  const at = (lat, c) => soft[Math.min(LN - 1, Math.max(0, Math.round((90 - lat) * 20))) * 4 + c];

  // Eddies: one chance per cell of a grid in (lon, lat), turning the
  // sample point around the cell's centre. They roll up on the band
  // boundaries, anticyclonic in zones, cyclonic in belts.
  const eddy = (lon, lat) => {
    const ci = Math.floor(lon / 7), cj = Math.floor((lat + 90) / 4.5);
    for (let dj = -1; dj <= 1; dj++) {
      for (let di = -1; di <= 1; di++) {
        const i = ((ci + di) % 52 + 52) % 52, j = cj + dj;
        if (hash2(i * 3 + 11, j * 7 - 5) > 0.42) continue;
        const cx = (i + 0.2 + 0.6 * hash2(i, j + 91)) * 7, cy = (j + 0.2 + 0.6 * hash2(i + 57, j)) * 4.5 - 90;
        let dx = lon - cx; if (dx > 180) dx -= 360; else if (dx < -180) dx += 360;
        const dy = lat - cy, r = 0.9 + 1.7 * hash2(i + 13, j - 29);
        const d2 = (dx * dx * 0.45 + dy * dy) / (r * r);
        if (d2 > 4) continue;
        const a = (hash2(i - 7, j + 3) < 0.5 ? -1 : 1) * 1.1 * Math.exp(-d2 * 1.2);
        const ca = Math.cos(a), sa = Math.sin(a);
        lon = cx + dx * ca - dy * sa * 1.5;
        lat = cy + dx * sa / 1.5 + dy * ca;
      }
    }
    return [lon, lat];
  };

  // The named features, at stated longitudes: [lon, lat, half-width
  // in longitude, half-height in latitude, colour, spin].
  const GRS = [60, -22.5, 7.0, 4.9];
  const OVALS = [[112, -33, 3.2, 2.2, [226, 216, 200]]];                  // oval BA
  for (let k = 0; k < 8; k++) OVALS.push([150 + k * 24 + hash2(k, 5) * 8, -40.5, 1.5, 1.0, [236, 232, 222]]);
  const BARGES = [];
  for (let k = 0; k < 6; k++) BARGES.push([20 + k * 57 + hash2(k, 9) * 20, 15.2, 3.4, 1.1]);
  const SPOTS = [];
  for (let k = 0; k < 10; k++) SPOTS.push([k * 36 + hash2(k, 21) * 10, 6.8]);
  const wrapD = (d) => (d > 180 ? d - 360 : d < -180 ? d + 360 : d);

  for (let y = 0; y < H; y++) {
    const v = (y + 0.5) / H, lat0 = 90 - v * 180;
    for (let x = 0; x < W; x++) {
      const u = (x + 0.5) / W;
      let lon = u * 360, lat = lat0;
      const turb = at(lat, 3);

      // The Red Spot turns the flow around it, and so do the ovals.
      {
        const dx = wrapD(lon - GRS[0]) / (GRS[2] * 1.7), dy = (lat - GRS[1]) / (GRS[3] * 1.7);
        const d2 = dx * dx + dy * dy;
        if (d2 < 1) {
          const a = 1.3 * (1 - d2) * (1 - d2);          // counter-clockwise, southern anticyclone
          const ca = Math.cos(a), sa = Math.sin(a);
          const ex = dx * ca - dy * sa, ey = dx * sa + dy * ca;
          lon = GRS[0] + ex * GRS[2] * 1.7; lat = GRS[1] + ey * GRS[3] * 1.7;
        }
      }
      [lon, lat] = eddy(lon, lat);

      // Turbulence, stretched along the jets: a belt's edge wanders a
      // degree or two, and everything is drawn out into streaks.
      const uu = lon / 360;
      const wl = (pf(uu * 10, v * 30, 10, 3) - 0.5) * 2.6 + (pf(uu * 36, v * 90, 36, 3) - 0.5) * 0.9;
      const ls = lat + wl * turb;
      const us = uu + (pf(uu * 5 + 0.3, v * 60, 5, 2) - 0.5) * 0.04;
      let r = at(ls, 0), g = at(ls, 1), b = at(ls, 2);
      const fine = pf(us * 90, v * 160, 90, 4);
      const fl = 0.92 + (fine - 0.5) * (0.14 + 0.14 * turb);
      r *= fl; g *= fl; b *= fl * 0.98 + 0.02;
      // Zones carry faint bright convective puffs; belts dark rifts.
      const puff = pf(us * 150 + 3, v * 150, 150, 2);
      if (turb < 0.6) { const k = Math.max(0, puff - 0.62) * 0.9; r += (245 - r) * k; g += (240 - g) * k; b += (228 - b) * k; }
      else { const k = Math.max(0, puff - 0.66) * 1.4; r += (240 - r) * k; g += (230 - g) * k; b += (210 - b) * k; }

      // The Great Red Spot: salmon core, paler collar, and the hollow —
      // a bright bay it clears in the south equatorial belt.
      {
        const dx = wrapD(lon - GRS[0]) / GRS[2], dy = (lat - GRS[1]) / GRS[3];
        const d = Math.sqrt(dx * dx + dy * dy);
        const hollow = Math.max(0, 1 - Math.abs(Math.sqrt(dx * dx * 0.5 + dy * dy * 0.7) - 1.35) / 0.4);
        if (hollow > 0) { const k = hollow * 0.55; r += (234 - r) * k; g += (224 - g) * k; b += (204 - b) * k; }
        if (d < 1.15) {
          const core = (1 - smoothT(clamp01((d - 0.45) / 0.5))) * (0.85 + 0.15 * fine);
          const collar = Math.max(0, 1 - Math.abs(d - 0.95) / 0.2) * 0.5;
          r += (206 - r) * core * 0.85 + (228 - r) * collar;
          g += (122 - g) * core * 0.85 + (206 - g) * collar;
          b += (86 - b) * core * 0.85 + (180 - b) * collar;
        }
      }
      for (const [ox, oy, rx, ry, c] of OVALS) {
        const dx = wrapD(lon - ox) / rx, dy = (lat - oy) / ry, d2 = dx * dx + dy * dy;
        if (d2 < 1.6) {
          const k = 1 - smoothT(clamp01((d2 - 0.55) / 1.0));
          r += (c[0] - r) * k; g += (c[1] - g) * k; b += (c[2] - b) * k;
        }
      }
      for (const [ox, oy, rx, ry] of BARGES) {
        const dx = wrapD(lon - ox) / rx, dy = (lat - oy) / ry, d2 = dx * dx + dy * dy;
        if (d2 < 1.4) { const k = (1 - smoothT(clamp01((d2 - 0.4) / 1.0))) * 0.8; r += (104 - r) * k; g += (66 - g) * k; b += (46 - b) * k; }
      }
      // Hot spots, and the festoons trailing off them into the zone.
      for (const [ox, oy] of SPOTS) {
        const dx = wrapD(lon - ox), dy = lat - oy;
        const d2 = (dx * dx) / 6.5 + (dy * dy) / 0.9;
        let k = d2 < 2 ? (1 - smoothT(clamp01((d2 - 0.3) / 1.7))) * 0.75 : 0;
        // A festoon: a thin filament curving down and west across the EZ.
        if (dy < 0 && dy > -8 && dx < 2 && dx > -16) {
          const along = -dy / 8, off = dx + 5 * along + 7 * along * along;
          k = Math.max(k, Math.exp(-off * off / 1.2) * (1 - along) * 0.45);
        }
        if (k > 0) { r += (92 - r) * k; g += (100 - g) * k; b += (112 - b) * k; }
      }

      const o = (y * W + x) * 4;
      px[o] = r; px[o + 1] = g; px[o + 2] = b; px[o + 3] = 255;
    }
  }
  return px;
}
