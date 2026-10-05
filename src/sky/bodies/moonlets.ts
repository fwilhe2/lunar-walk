import * as THREE from 'three';

/* ── The moonlets ───────────────────────────────────────────────
   Both are all but black — a 7% albedo, the reflectance of fresh
   asphalt — and covered in craters. Phobos additionally gets
   Stickney, 9 km across on a 22 km body, and the grooves.        */
export function moonletMaps(kind) {
  const W = 512, H = 256;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  x.fillStyle = '#4a443e'; x.fillRect(0, 0, W, H);

  let s = kind === 'phobos' ? 8181 : 3733;
  const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

  const crater = (cx, cy, r, k) => {
    const g = x.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 0, cx, cy, r);
    g.addColorStop(0, 'rgba(20,17,14,' + (0.55 * k) + ')');
    g.addColorStop(0.72, 'rgba(36,32,28,' + (0.4 * k) + ')');
    g.addColorStop(0.92, 'rgba(132,122,110,' + (0.45 * k) + ')');
    g.addColorStop(1, 'rgba(120,110,100,0)');
    x.fillStyle = g;
    x.beginPath(); x.arc(cx, cy, r, 0, 6.2832); x.fill();
  };

  for (let i = 0; i < 420; i++) {
    crater(rnd() * W, rnd() * H, 2 + Math.pow(rnd(), 3) * 26, 0.5 + rnd() * 0.5);
  }
  if (kind === 'phobos') {
    crater(W * 0.30, H * 0.44, 62, 1);              // Stickney
    x.strokeStyle = 'rgba(28,24,21,0.5)';
    x.lineWidth = 2.2;
    for (let i = 0; i < 22; i++) {                  // grooves
      const y0 = rnd() * H, sl = (rnd() - 0.5) * 0.5;
      x.beginPath(); x.moveTo(0, y0); x.lineTo(W, y0 + sl * W); x.stroke();
    }
  }
  // A D-type spectral slope: dark, and distinctly red.
  x.globalCompositeOperation = 'multiply';
  x.fillStyle = 'rgb(255,236,214)'; x.fillRect(0, 0, W, H);
  x.globalCompositeOperation = 'source-over';

  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return { day: t };
}
