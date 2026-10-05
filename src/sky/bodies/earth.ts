import * as THREE from 'three';
import { hash2, smoothT } from '../../kernel/noise';

/* ── Earth ──────────────────────────────────────────────────────
   Coastlines as coarse lon/lat polygons, rasterised to an
   equirectangular map and then roughened: the mask is resampled
   through a fractal displacement field and re-thresholded against
   noise, which turns straight polygon edges into ragged, self-
   similar coasts with the look of the real thing at any zoom this
   disc is seen at. Then coloured by latitude band and noise — ice,
   boreal forest, the two desert belts at ±25°, tropics — with a
   narrow continental shelf.

   A second pass writes city lights for the night side, dense in the
   temperate band and hugging the coasts, and a third builds the
   clouds from the general circulation: a convective band at the
   ITCZ, the dry subtropical highs either side of it, the stormy
   midlatitudes with their comma-shaped cyclones, and the Southern
   Ocean under an almost unbroken deck — about two thirds of the
   planet covered, which is what makes Earth from space mostly white
   and blue. Every noise field here wraps in longitude, so nothing
   seams at the date line.                                        */
export function earthMaps() {
  const W = 1024, H = 512;
  const lon2x = (lo) => (lo + 180) / 360 * W;
  const lat2y = (la) => (90 - la) / 180 * H;

  const LAND = {
    namerica: [[-168,65],[-165,60],[-153,57],[-140,60],[-130,54],[-124,48],[-124,40],[-117,32],[-110,23],[-105,20],[-97,16],[-92,15],[-88,21],[-97,26],[-93,30],[-84,30],[-81,25],[-80,32],[-75,35],[-70,42],[-66,45],[-60,47],[-55,52],[-64,60],[-78,62],[-95,60],[-85,68],[-95,70],[-125,70],[-141,70],[-160,71]],
    camerica: [[-92,15],[-88,13],[-84,10],[-80,8],[-77,8],[-80,10],[-84,15],[-88,16]],
    greenland: [[-45,60],[-30,64],[-20,70],[-18,78],[-30,83],[-50,82],[-58,78],[-55,70],[-50,62]],
    baffin: [[-80,63],[-65,62],[-62,67],[-72,72],[-85,73],[-90,70],[-78,68]],
    arctic: [[-120,72],[-100,70],[-90,74],[-100,78],[-120,77]],
    samerica: [[-81,-4],[-79,2],[-75,10],[-66,11],[-60,8],[-52,4],[-44,-2],[-35,-6],[-38,-13],[-48,-25],[-58,-35],[-62,-40],[-65,-45],[-68,-52],[-75,-52],[-73,-45],[-71,-30],[-70,-18],[-76,-14],[-81,-6]],
    africa: [[-17,15],[-17,21],[-10,31],[0,36],[10,37],[20,32],[32,31],[35,23],[38,18],[43,12],[51,12],[43,3],[41,-5],[40,-15],[35,-22],[32,-28],[25,-34],[18,-34],[12,-18],[9,-1],[9,4],[3,6],[-8,5],[-13,9],[-16,12]],
    arabia: [[35,29],[39,21],[43,13],[45,13],[52,16],[57,19],[59,22],[56,26],[51,24],[48,29],[44,31],[36,32]],
    eurasia: [[-10,36],[-2,43],[3,43],[5,50],[-2,49],[-5,58],[8,63],[20,70],[32,70],[45,68],[60,71],[75,73],[105,77],[130,73],[160,70],[180,66],[180,60],[162,58],[156,51],[142,54],[135,45],[129,42],[127,35],[122,32],[120,22],[107,10],[105,2],[98,8],[92,20],[88,22],[80,10],[72,18],[67,25],[58,26],[50,30],[45,38],[36,36],[28,41],[26,38],[22,36],[20,40],[14,45],[18,40],[12,38],[8,44],[3,43],[0,36]],
    australia: [[114,-22],[113,-26],[115,-34],[122,-34],[129,-32],[135,-35],[140,-38],[147,-39],[151,-33],[153,-28],[148,-20],[142,-11],[136,-12],[130,-12],[126,-14],[122,-17]],
    tasmania: [[145,-41],[148,-41],[148,-43],[146,-43.5]],
    madagascar: [[43,-12],[50,-15],[48,-25],[44,-25],[43,-19]],
    japan: [[130,31],[136,35],[141,40],[145,44],[142,44],[138,37],[131,33]],
    britain: [[-5,50],[1,51],[-1,58],[-5,58],[-6,54]],
    ireland: [[-10,52],[-6,52],[-6,55],[-9,54.5]],
    nz: [[166,-46],[174,-41],[178,-38],[173,-34],[170,-43]],
    borneo: [[109,2],[117,7],[119,-1],[114,-4],[110,-2]],
    sulawesi: [[119,1],[125,1],[122,-3],[121,-5],[119,-3]],
    java: [[105,-6],[114,-7],[114,-8.5],[106,-7]],
    newguinea: [[131,-1],[141,-3],[150,-6],[147,-9],[138,-8],[132,-5]],
    sumatra: [[95,5],[104,-2],[106,-6],[100,-2],[96,2]],
    philippines: [[120,18],[122,18],[124,12],[126,7],[122,7],[121,12]],
    taiwan: [[120.5,22],[122,25],[121,25]],
    srilanka: [[80,6],[82,7],[80,9.8]],
    cuba: [[-85,22],[-77,20],[-74,20],[-78,22.5],[-84,23]],
    hispaniola: [[-74,18],[-68,18.5],[-70,20],[-73,20]],
    iceland: [[-24,64],[-14,65],[-16,66],[-22,66]],
    svalbard: [[12,77],[22,79],[16,80],[11,79]],
    nzemlya: [[52,71],[58,71],[68,76],[60,76]],
    sakhalin: [[142,46],[143,50],[143,54],[142,53]],
  };

  // Wrapping noise in x: lattice x runs modulo P, so the field closes
  // on itself at the date line. Coordinates are in lattice cells.
  const pnx = (x, y, P) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const u = smoothT(x - xi), v = smoothT(y - yi);
    const x0 = ((xi % P) + P) % P, x1 = (x0 + 1) % P;
    return (hash2(x0, yi) * (1 - u) + hash2(x1, yi) * u) * (1 - v)
         + (hash2(x0, yi + 1) * (1 - u) + hash2(x1, yi + 1) * u) * v;
  };
  const pfx = (x, y, P, oct) => {
    let sum = 0, amp = 0.5, f = 1, n = 0;
    for (let i = 0; i < oct; i++) { sum += amp * pnx(x * f, y * f, P * f); n += amp; amp *= 0.5; f *= 2; }
    return sum / n;
  };

  // ── land mask: polygons at 2×, softened, then fractal coasts
  const M2W = W * 2, M2H = H * 2;
  const mc2 = document.createElement('canvas'); mc2.width = M2W; mc2.height = M2H;
  const mx2 = mc2.getContext('2d');
  mx2.scale(2, 2);
  mx2.fillStyle = '#000'; mx2.fillRect(0, 0, W, H);
  mx2.fillStyle = '#fff';
  for (const poly of Object.values(LAND)) {
    mx2.beginPath();
    poly.forEach(([lo, la], i) => (i ? mx2.lineTo(lon2x(lo), lat2y(la)) : mx2.moveTo(lon2x(lo), lat2y(la))));
    mx2.closePath(); mx2.fill();
  }
  // Antarctica: a continuous cap with a ragged coast.
  mx2.beginPath();
  mx2.moveTo(0, H);
  for (let x = 0; x <= W; x += 8) {
    const la = -68 + Math.sin(x * 0.021) * 4 + Math.sin(x * 0.07) * 2.5;
    mx2.lineTo(x, lat2y(la));
  }
  mx2.lineTo(W, H); mx2.closePath(); mx2.fill();
  const mb = document.createElement('canvas'); mb.width = M2W; mb.height = M2H;
  const mbx = mb.getContext('2d');
  mbx.filter = 'blur(4px)'; mbx.drawImage(mc2, 0, 0);
  const soft = mbx.getImageData(0, 0, M2W, M2H).data;

  const land = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    const v = y / H;
    for (let x = 0; x < W; x++) {
      const u = x / W;
      const wx = (pfx(u * 20, v * 10, 20, 4) - 0.5) * 26 + (pfx(u * 80, v * 40, 80, 3) - 0.5) * 7;
      const wy = (pfx(u * 20 + 7.3, v * 10 + 3.1, 20, 4) - 0.5) * 26 + (pfx(u * 80 + 3.7, v * 40 - 5, 80, 3) - 0.5) * 7;
      let sx = Math.round((x + wx) * 2), sy = Math.round((y + wy) * 2);
      sx = ((sx % M2W) + M2W) % M2W; sy = sy < 0 ? 0 : sy >= M2H ? M2H - 1 : sy;
      const t = soft[(sy * M2W + sx) * 4] / 255 + (pfx(u * 48, v * 24, 48, 4) - 0.5) * 0.55;
      land[y * W + x] = THREE.MathUtils.smoothstep(t, 0.47, 0.53);
    }
  }
  // Shelf: a blurred copy of the final coast, for shallow water.
  const lc = document.createElement('canvas'); lc.width = W; lc.height = H;
  const lcx = lc.getContext('2d');
  const limg = lcx.createImageData(W, H);
  for (let i = 0; i < W * H; i++) {
    limg.data[i * 4] = limg.data[i * 4 + 1] = limg.data[i * 4 + 2] = land[i] * 255; limg.data[i * 4 + 3] = 255;
  }
  lcx.putImageData(limg, 0, 0);
  const bc = document.createElement('canvas'); bc.width = W; bc.height = H;
  const bx = bc.getContext('2d');
  bx.filter = 'blur(3px)'; bx.drawImage(lc, 0, 0);
  const shelf = bx.getImageData(0, 0, W, H).data;

  // ── day, night and specular maps
  const day = document.createElement('canvas'); day.width = W; day.height = H;
  const night = document.createElement('canvas'); night.width = W; night.height = H;
  const spec = document.createElement('canvas'); spec.width = W; spec.height = H;
  const dctx = day.getContext('2d'), nctx = night.getContext('2d'), sctx = spec.getContext('2d');
  const dimg = dctx.createImageData(W, H), nimg = nctx.createImageData(W, H), simg = sctx.createImageData(W, H);
  let rs = 5150; const rnd = () => (rs = (rs * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

  for (let y = 0; y < H; y++) {
    const lat = 90 - y / H * 180, alat = Math.abs(lat), v = y / H;
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4, u = x / W;
      const L = land[y * W + x];
      const nearCoast = shelf[i] / 255;
      const n1 = pfx(u * 14, v * 7, 14, 4);
      const n2 = pfx(u * 60 + 9, v * 30, 60, 3);
      const n3 = pfx(u * 160, v * 80 + 5, 160, 2);

      // Land: biome by latitude, roughened by noise. Deserts are the
      // brightest ground on the planet and sit at the subtropical
      // highs; the tropics and the boreal belt are dark forest.
      const ice = THREE.MathUtils.smoothstep(alat + n1 * 10 - 5, 62, 74);
      const desert = Math.exp(-Math.pow((alat - 23) / 9, 2)) * (0.35 + n1 * 0.9);
      const green = Math.exp(-Math.pow((alat - 4) / 14, 2)) * 0.95 + Math.exp(-Math.pow((alat - 55) / 11, 2)) * 0.75;
      let lr = 62 + desert * 128 + n2 * 22 - green * 26;
      let lg = 64 + desert * 98 + n2 * 18 + green * 6;
      let lb = 44 + desert * 58 + n2 * 14 - green * 14;
      lr += n1 * 20 + n3 * 10; lg += n1 * 16 + n3 * 8; lb += n1 * 14 + n3 * 7;
      if (ice > 0) { lr += (236 - lr) * ice; lg += (240 - lg) * ice; lb += (248 - lb) * ice; }

      // Ocean: near-black abyssal blue; lighter only over the shelf.
      const shallow = Math.pow(nearCoast, 3) * (1 - L);
      let orr = 6 + shallow * 14, og = 18 + shallow * 36, ob = 46 + shallow * 38 + n2 * 6;
      const sea = THREE.MathUtils.smoothstep(alat + n1 * 6, 72, 82);
      if (sea > 0) { orr += (226 - orr) * sea; og += (232 - og) * sea; ob += (240 - ob) * sea; }

      dimg.data[i] = lr * L + orr * (1 - L);
      dimg.data[i + 1] = lg * L + og * (1 - L);
      dimg.data[i + 2] = lb * L + ob * (1 - L);
      dimg.data[i + 3] = 255;

      // Ocean is a mirror; land is not.
      const sv = (1 - L) * (1 - sea) * 255;
      simg.data[i] = simg.data[i + 1] = simg.data[i + 2] = sv; simg.data[i + 3] = 255;

      // Cities: dense in the northern temperate band, hugging coasts.
      let lights = 0;
      if (L > 0.5) {
        const habit = Math.exp(-Math.pow((lat - 40) / 22, 2)) * 0.9 + Math.exp(-Math.pow((lat + 25) / 16, 2)) * 0.35
                    + Math.exp(-Math.pow((lat - 22) / 8, 2)) * 0.5 * (1 - desert);
        const coastal = 0.4 + (1 - nearCoast) * 2.2;
        if (rnd() < habit * 0.05 * coastal * (1 - ice) * (0.35 + n2)) lights = 0.5 + rnd() * 0.5;
      }
      const Lt = lights * 255;
      nimg.data[i] = Lt; nimg.data[i + 1] = Lt * 0.8; nimg.data[i + 2] = Lt * 0.5; nimg.data[i + 3] = 255;
    }
  }
  dctx.putImageData(dimg, 0, 0);
  nctx.putImageData(nimg, 0, 0);
  sctx.putImageData(simg, 0, 0);
  // Bleed the city lights so they read as glowing conurbations.
  nctx.filter = 'blur(1.6px)'; nctx.globalCompositeOperation = 'lighter';
  nctx.drawImage(night, 0, 0); nctx.filter = 'none';

  // ── clouds
  // Cyclones: midlatitude lows (big, comma-shaped, spinning with the
  // hemisphere) and a few tropical ones (small and tight).
  const VORT = [];
  {
    let s = 3131; const r = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    for (let i = 0; i < 16; i++) {
      const trop = i < 3;
      const lat = (trop ? 12 + r() * 12 : 38 + r() * 26) * (r() < 0.5 ? -1 : 1);
      VORT.push({
        x: r() * W, y: lat2y(lat),
        r: trop ? 8 + r() * 6 : 22 + r() * 26,
        spin: (lat > 0 ? 1 : -1) * (trop ? 2.6 : 1.4 + r() * 1.0),
      });
    }
  }
  const cl = document.createElement('canvas'); cl.width = W; cl.height = H;
  const cctx = cl.getContext('2d');
  const cimg = cctx.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    const lat = 90 - y / H * 180, alat = Math.abs(lat);
    // General circulation: how much of each latitude band is overcast.
    let cover = 0.52
      + Math.exp(-Math.pow((lat - 6) / 7, 2)) * 0.30          // ITCZ
      - Math.exp(-Math.pow((alat - 22) / 9, 2)) * 0.30        // subtropical highs
      + Math.exp(-Math.pow((alat - 55) / 12, 2)) * 0.26       // storm tracks
      + Math.exp(-Math.pow((lat + 58) / 9, 2)) * 0.14;        // Southern Ocean
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      // Swirl the sample position around each cyclone core.
      let sx = x, sy = y;
      for (const vt of VORT) {
        let dx = sx - vt.x;
        if (dx > W / 2) dx -= W; else if (dx < -W / 2) dx += W;
        const dy = sy - vt.y;
        const d = Math.hypot(dx, dy) / vt.r;
        if (d > 2.2) continue;
        const ang = vt.spin * Math.exp(-d * d * 0.8);
        const ca = Math.cos(ang), sa = Math.sin(ang);
        sx = vt.x + dx * ca - dy * sa;
        sy = vt.y + dx * sa + dy * ca;
      }
      const u = ((sx / W) % 1 + 1) % 1, v = sy / H;
      // Domain-warped, stretched east–west: weather shears with the
      // jet streams, so cloud systems are long and banded.
      const wu = pfx(u * 6, v * 3, 6, 3) - 0.5, wv = pfx(u * 6 + 2.3, v * 3 + 1.1, 6, 3) - 0.5;
      const uu = u + wu * 0.07, vv = v + wv * 0.05;
      const n = pfx(uu * 18, vv * 16, 18, 6);
      // Convective texture: cumulus fields inside the cloud masses.
      const cu = pfx(u * 96 + 1.7, v * 70, 96, 3);
      const L = land[y * W + x];
      const cv = cover - L * Math.exp(-Math.pow((alat - 22) / 10, 2)) * 0.18;
      let a = THREE.MathUtils.smoothstep(n, 1.02 - cv - 0.10, 1.02 - cv + 0.14);
      a *= 0.72 + 0.28 * cu;
      a = Math.min(1, a * 1.15);
      cimg.data[i] = cimg.data[i + 1] = cimg.data[i + 2] = 255;
      cimg.data[i + 3] = a * 255;
    }
  }
  cctx.putImageData(cimg, 0, 0);

  const tex = (c) => {
    const t = new THREE.CanvasTexture(c);
    t.wrapS = THREE.RepeatWrapping;
    t.anisotropy = 4;
    return t;
  };
  return { day: tex(day), night: tex(night), spec: tex(spec), clouds: tex(cl) };
}
