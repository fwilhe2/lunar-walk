import * as THREE from 'three';
import { fbm } from '../../kernel/noise';
import type { BodyMaps } from './types';

/* ── Mars, from orbit ───────────────────────────────────────────
   Seen from Phobos this fills 42° of sky, which magnifies the map
   enormously — so it is built in three layers, each covering a
   scale the one before it cannot.

   The albedo layer is the classic map: dark basaltic regions the
   nineteenth century mistook for seas, over a global ferric dust
   cover that gets redistributed every dust season, plus the
   landmarks worth recognising from six thousand kilometres —
   Valles Marineris, the Tharsis volcanoes, Hellas, and the two
   polar caps of CO2 frost over water ice.

   The elevation layer carries what the albedo cannot: the
   crustal dichotomy, the Tharsis bulge with Olympus standing 22 km
   off it, the great impact basins. It is what lets the terminator
   shade real topography instead of a painted ball.

   The third layer is procedural and lives in the shader, so it
   stays sharp however close you get.                             */
// Fresh canvases always have a 2d context, and pixel indices stay
// inside the W×H (EW×EH) images they read.
export function marsMaps(): BodyMaps {
  const W = 1024, H = 512;          // per-pixel base
  const W2 = 2048, H2 = 1024;       // crisp overlay: features, craters
  const lon2x = (lo: number) => (lo + 180) / 360 * W;
  const lat2y = (la: number) => (90 - la) / 180 * H;

  // ── albedo features, as soft blobs on a darkness mask
  const dc = document.createElement('canvas'); dc.width = W; dc.height = H;
  const dx = dc.getContext('2d')!;
  dx.fillStyle = '#000'; dx.fillRect(0, 0, W, H);
  const blob = (lo: number, la: number, rx: number, ry: number, rot: number, a: number) => {
    dx.save();
    dx.globalAlpha = a; dx.fillStyle = '#fff';
    dx.translate(lon2x(lo), lat2y(la)); dx.rotate(rot);
    dx.beginPath(); dx.ellipse(0, 0, rx * W / 1024, ry * H / 512, 0, 0, 6.2832); dx.fill();
    dx.restore();
  };
  //     lon   lat   rx   ry   rot  alpha
  blob(  70,   5,  44,  64,  0.35, 1.00);  // Syrtis Major, the darkest
  blob(  85,  20,  30,  26,  0.00, 0.55);  // Nili/Meroe
  blob( -30,  45, 100,  50, -0.15, 0.72);  // Acidalia Planitia
  blob( 110,  45,  92,  42,  0.10, 0.55);  // Utopia
  blob( -35, -22,  90,  40,  0.10, 0.82);  // Mare Erythraeum
  blob(-135, -30, 105,  36, -0.10, 0.80);  // Mare Sirenum
  blob( 155, -25,  74,  34,  0.12, 0.72);  // Mare Cimmerium
  blob(-170, -18,  46,  26,  0.05, 0.60);  // Mare Chronium
  blob(  10, -28,  58,  28, -0.20, 0.62);  // Noachis
  blob(  40, -18,  38,  30,  0.10, 0.45);  // Hesperia edge
  blob( -70,  18,  42,  32,  0.00, 0.30);  // Tharsis, dust-stripped patches
  blob(-100, -12,  50,  22,  0.10, 0.35);  // Solis Lacus
  dx.filter = 'blur(6px)'; dx.drawImage(dc, 0, 0); dx.filter = 'none';

  // Valles Marineris: 4,000 km of canyon, and unmistakable.
  dx.strokeStyle = 'rgba(255,255,255,0.9)';
  dx.lineCap = 'round'; dx.lineWidth = 8;
  dx.beginPath();
  dx.moveTo(lon2x(-96), lat2y(-6));
  dx.bezierCurveTo(lon2x(-75), lat2y(-11), lon2x(-52), lat2y(-13), lon2x(-32), lat2y(-9));
  dx.stroke();
  const dark = dx.getImageData(0, 0, W, H).data;

  // The volcanoes: bright dusty shields with dark summit calderas.
  const VOLC = [[-134, 18, 30], [-113, 12, 17], [-112, 4, 17], [-110, -3, 17], [-98, 12, 14], [147, 25, 20]] as const;
  const vc = document.createElement('canvas'); vc.width = W; vc.height = H;
  const vx = vc.getContext('2d')!;
  vx.fillStyle = '#000'; vx.fillRect(0, 0, W, H);
  for (const [lo, la, r] of VOLC) {
    const g = vx.createRadialGradient(lon2x(lo), lat2y(la), 0, lon2x(lo), lat2y(la), r);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.55, 'rgba(190,190,190,1)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    vx.fillStyle = g;
    vx.beginPath(); vx.arc(lon2x(lo), lat2y(la), r, 0, 6.2832); vx.fill();
  }
  const volc = vx.getImageData(0, 0, W, H).data;

  // ── per-pixel base colour
  const base = document.createElement('canvas'); base.width = W; base.height = H;
  const bctx = base.getContext('2d')!;
  const bimg = bctx.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    const lat = 90 - y / H * 180, alat = Math.abs(lat);
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const dk = dark[i]! / 255, vo = volc[i]! / 255;
      const n1 = fbm(x * 0.013, y * 0.013, 4);
      const n2 = fbm(x * 0.07 + 40, y * 0.07 - 20, 3);

      // Bright ferric dust over dark basalt, mottled by both. The
      // southern highlands hold more dark rock than the resurfaced
      // northern plains, which is the crustal dichotomy showing
      // through as colour.
      const south = THREE.MathUtils.smoothstep(lat, 25, -15) * 0.10;
      let r = 188 - dk * 104 + n1 * 34 - 14 - south * 62;
      let g = 108 - dk *  60 + n1 * 22 - 10 - south * 40;
      let b =  68 - dk *  38 + n1 * 15 -  7 - south * 24;
      r += n2 * 15; g += n2 * 11; b += n2 * 8;

      if (vo > 0.02) {
        const cal = vo > 0.88 ? 1 : 0;
        r += vo * 38 - cal * 96; g += vo * 22 - cal * 58; b += vo * 13 - cal * 36;
      }

      // Polar caps. The northern one is water ice and permanent; the
      // southern is CO2 frost and swings with the season, so it is
      // drawn smaller — a late southern-summer Mars. Both edges are
      // ragged, and the north cap keeps its dark spiral troughs.
      const edge = lat > 0 ? 73 : 80;
      let cap = THREE.MathUtils.smoothstep(alat + n1 * 11 - 6, edge, edge + 7);
      if (lat > 0 && cap > 0) {
        const spiral = Math.sin((x / W * 6.2832) * 3 + (90 - alat) * 0.55);
        cap *= 1 - Math.max(0, spiral) * 0.55;
      }
      if (cap > 0) { r += (238 - r) * cap; g += (240 - g) * cap; b += (246 - b) * cap; }

      bimg.data[i] = r; bimg.data[i + 1] = g; bimg.data[i + 2] = b; bimg.data[i + 3] = 255;
    }
  }
  bctx.putImageData(bimg, 0, 0);

  // ── crisp layer: upscale the base, then stamp craters over it.
  // One shared crater list goes onto both the albedo and the
  // elevation map, so every bowl you can see also shades correctly
  // when the terminator crosses it.
  let s = 90210;
  const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  // Radii are in degrees of arc, and the power law is steep: a
  // degree is 59 km on Mars, so most of these are ordinary craters
  // and the handful of big ones top out around Argyre. Hellas is
  // not in here — it is drawn by hand, once, with the basins.
  const CRA: { lo: number; la: number; r: number; k: number }[] = [];
  for (let i = 0; i < 5200; i++) {
    const la = Math.asin(rnd() * 2 - 1) * 57.2958;
    // Craters survive on the ancient southern highlands and are
    // mostly buried under the young northern plains.
    if (la > 10 && rnd() < 0.72) continue;
    CRA.push({ lo: rnd() * 360 - 180, la, r: 0.22 + Math.pow(rnd(), 4.5) * 5.5, k: 0.30 + rnd() * 0.7 });
  }

  const day = document.createElement('canvas'); day.width = W2; day.height = H2;
  const cx2 = day.getContext('2d')!;
  cx2.imageSmoothingEnabled = true;
  cx2.drawImage(base, 0, 0, W2, H2);
  const sx = W2 / 360, sy = H2 / 180;
  for (const c of CRA) {
    const px = (c.lo + 180) * sx, py = (90 - c.la) * sy, r = c.r * sx * 0.5;
    const g = cx2.createRadialGradient(px - r * 0.25, py - r * 0.25, 0, px, py, r);
    // Faint in full sun, as craters are from orbit: the terminator,
    // through the elevation map, is what really shows them.
    g.addColorStop(0, 'rgba(70,44,30,' + (0.10 * c.k) + ')');
    g.addColorStop(0.78, 'rgba(96,60,40,' + (0.06 * c.k) + ')');
    g.addColorStop(0.93, 'rgba(226,178,132,' + (0.10 * c.k) + ')');
    g.addColorStop(1, 'rgba(226,178,132,0)');
    cx2.fillStyle = g;
    cx2.beginPath(); cx2.arc(px, py, r, 0, 6.2832); cx2.fill();
  }

  // ── elevation, for the terminator to shade
  const EW = 1024, EH = 512;
  const el = document.createElement('canvas'); el.width = EW; el.height = EH;
  const ex = el.getContext('2d')!;
  const elon = (lo: number) => (lo + 180) / 360 * EW, elat = (la: number) => (90 - la) / 180 * EH;
  // Datum, with the dichotomy: old high south, resurfaced low north.
  const grad = ex.createLinearGradient(0, 0, 0, EH);
  grad.addColorStop(0.00, '#5a5a5a');
  grad.addColorStop(0.36, '#5e5e5e');
  grad.addColorStop(0.52, '#8a8a8a');
  grad.addColorStop(1.00, '#9a9a9a');
  ex.fillStyle = grad; ex.fillRect(0, 0, EW, EH);

  const bump = (lo: number, la: number, r: number, col: string, stop?: [offset: number, color: string]) => {
    const g = ex.createRadialGradient(elon(lo), elat(la), 0, elon(lo), elat(la), r);
    g.addColorStop(0, col);
    if (stop) g.addColorStop(stop[0], stop[1]);
    g.addColorStop(1, 'rgba(128,128,128,0)');
    ex.fillStyle = g;
    ex.beginPath(); ex.arc(elon(lo), elat(la), r, 0, 6.2832); ex.fill();
  };
  bump(-100, 2, 150, 'rgba(196,196,196,0.85)');            // the Tharsis bulge
  bump( 147, 25,  70, 'rgba(176,176,176,0.7)');            // Elysium rise
  for (const [lo, la, r] of VOLC) {                        // shields on top of it
    bump(lo, la, r * EW / W * 1.6, 'rgba(255,255,255,1)', [0.72, 'rgba(210,210,210,0.55)']);
  }
  bump(  70, -42, 120, 'rgba(24,24,24,0.92)', [0.7, 'rgba(70,70,70,0.6)']);   // Hellas
  bump( -43, -50,  62, 'rgba(46,46,46,0.8)');              // Argyre
  bump(  88,  13,  52, 'rgba(72,72,72,0.7)');              // Isidis
  bump( -30,  45, 110, 'rgba(96,96,96,0.5)');              // Acidalia lowland
  // Valles Marineris, cut into the Tharsis flank
  ex.strokeStyle = 'rgba(28,28,28,0.95)';
  ex.lineCap = 'round'; ex.lineWidth = 9;
  ex.beginPath();
  ex.moveTo(elon(-96), elat(-6));
  ex.bezierCurveTo(elon(-75), elat(-11), elon(-52), elat(-13), elon(-32), elat(-9));
  ex.stroke();
  // The same craters again, as bowls with raised rims.
  const ex2 = EW / 360, ey2 = EH / 180;
  for (const c of CRA) {
    const px = (c.lo + 180) * ex2, py = (90 - c.la) * ey2, r = c.r * ex2 * 0.5;
    if (r < 0.7) continue;
    const g = ex.createRadialGradient(px, py, 0, px, py, r);
    g.addColorStop(0, 'rgba(64,64,64,' + (0.34 * c.k) + ')');
    g.addColorStop(0.8, 'rgba(80,80,80,' + (0.26 * c.k) + ')');
    g.addColorStop(0.94, 'rgba(196,196,196,' + (0.30 * c.k) + ')');
    g.addColorStop(1, 'rgba(128,128,128,0)');
    ex.fillStyle = g;
    ex.beginPath(); ex.arc(px, py, r, 0, 6.2832); ex.fill();
  }
  // Roughness everywhere, so nothing reads as a smooth painted ball.
  const eimg = ex.getImageData(0, 0, EW, EH);
  for (let y = 0; y < EH; y++) {
    for (let x = 0; x < EW; x++) {
      const i = (y * EW + x) * 4;
      const n = fbm(x * 0.05, y * 0.05, 3) - 0.5;
      const v = eimg.data[i]! + n * 46;
      eimg.data[i] = eimg.data[i + 1] = eimg.data[i + 2] = v < 0 ? 0 : v > 255 ? 255 : v;
    }
  }
  ex.putImageData(eimg, 0, 0);

  const mk = (c: HTMLCanvasElement) => {
    const t = new THREE.CanvasTexture(c);
    t.wrapS = THREE.RepeatWrapping;
    t.anisotropy = 4;
    return t;
  };
  return { day: mk(day), elev: mk(el) };
}
