import { mode, player } from '../player/player';
import { SUN_DIR, sunElev } from '../render/lights';
import { yawObj } from '../render/renderer';
import { liveCompanions } from '../sky/companions';
import { el } from './hud';
import { rover } from '../vehicles/rover';
import { world } from '../worlds/index';

/* ── Compass ────────────────────────────────────────────────────
   A heading tape along the top: 120° of it, north at −z as the
   POSITION readout counts it, and on it the flag (or beacon), the sun
   and whatever hangs overhead. The surface has no edge, so the flag
   is the one fixed point on it; off the tape, its mark waits at the
   end you would turn toward. Apollo 14 walked to within a few tens of
   metres of Cone crater's rim and turned back, not knowing it was
   there — the horizon on the Moon is two and a half kilometres off,
   and everything on it looks the same distance away. */
const HOME_X = 8, HOME_Z = -11;           // where landmark() stands the flag or beacon
const compass = (() => {
  const cv = document.getElementById('compass') as HTMLCanvasElement, g = cv.getContext('2d');
  const W = 420, H = 46, SPAN = 120, TAPE = 30;
  const NAMES = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  let dpr = 0, plate = null;
  return {
    // marks: [{ brg, glyph, color, pin }] — pin: hold at the edge when off the tape.
    draw(hdg, marks) {
      const d = Math.min(devicePixelRatio || 1, 2);
      if (d !== dpr) {
        dpr = d; cv.width = W * d; cv.height = H * d;
        // The tape's plate, fading out to both ends.
        plate = g.createLinearGradient(0, 0, W, 0);
        plate.addColorStop(0, 'rgba(8,10,14,0)'); plate.addColorStop(0.22, 'rgba(8,10,14,.62)');
        plate.addColorStop(0.78, 'rgba(8,10,14,.62)'); plate.addColorStop(1, 'rgba(8,10,14,0)');
      }
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, W, H);
      g.fillStyle = plate;
      g.fillRect(0, 0, W, TAPE);
      const off = (b) => ((((b - hdg) % 360) + 540) % 360) - 180;
      g.textAlign = 'center';
      for (let b = 0; b < 360; b += 5) {
        const o = off(b), px = W / 2 + o * W / SPAN;
        if (px < 4 || px > W - 4) continue;
        const major = b % 45 === 0, mid = b % 15 === 0;
        g.globalAlpha = 1 - Math.pow(Math.abs(o) / (SPAN / 2), 3);
        g.fillStyle = major ? '#eef0f2' : mid ? 'rgba(195,200,207,.75)' : 'rgba(143,152,162,.5)';
        g.fillRect(Math.round(px), TAPE - (major ? 9 : mid ? 6 : 4), 1, major ? 9 : mid ? 6 : 4);
        // Cardinal points by name; between them, every 30°, in tens of
        // degrees as a runway or a heading bug reads them: 24 is 240°.
        if (major) { g.font = '600 11px ' + SANS; g.fillStyle = b === 0 ? '#e8b04b' : '#eef0f2'; g.fillText(NAMES[b / 45], px, 13); }
        else if (b % 30 === 0) { g.font = '10px ui-monospace, Menlo, monospace'; g.fillStyle = 'rgba(143,152,162,.9)'; g.fillText(String(b / 10), px, 13); }
      }
      g.globalAlpha = 1;
      // The lubber line: an amber caret under the tape.
      g.fillStyle = '#e8b04b';
      g.beginPath(); g.moveTo(W / 2 - 5, TAPE + 6); g.lineTo(W / 2 + 5, TAPE + 6); g.lineTo(W / 2, TAPE); g.closePath(); g.fill();
      g.fillRect(W / 2 - 0.5, TAPE - 12, 1, 12);
      g.font = '11px ' + SANS;
      g.shadowColor = 'rgba(0,0,0,.9)'; g.shadowBlur = 4;
      for (const m of marks) {
        let o = off(m.brg), glyph = m.glyph;
        if (Math.abs(o) > SPAN / 2 - 6) {
          if (!m.pin) continue;
          glyph = o < 0 ? '◂' : '▸';
          o = Math.sign(o) * (SPAN / 2 - 6);
        }
        g.fillStyle = m.color;
        g.fillText(glyph, W / 2 + o * W / SPAN, H - 3);
      }
      g.shadowBlur = 0;
    },
  };
})();
const bearing = (dx, dz) => ((Math.atan2(dx, -dz) * 180 / Math.PI) + 360) % 360;
const _cmpMarks = [];
export function drawCompass() {
  const hdg = ((-yawObj.rotation.y * 180 / Math.PI) % 360 + 360) % 360;
  const f = mode === 'ROVER' ? rover.state.pos : player.pos;
  const hx = HOME_X - f.x, hz = HOME_Z - f.z, dist = Math.hypot(hx, hz);
  _cmpMarks.length = 0;
  _cmpMarks.push({ brg: bearing(hx, hz), glyph: '▲', color: '#e8b04b', pin: true });
  if (!world.noSun && sunElev > -0.02) _cmpMarks.push({ brg: bearing(SUN_DIR.x, SUN_DIR.z), glyph: '●', color: '#fff3c8' });
  if (liveCompanions.length) { const c = liveCompanions[0].userData.pos; _cmpMarks.push({ brg: bearing(c.x, c.z), glyph: '○', color: '#b8c7e0' }); }
  compass.draw(hdg, _cmpMarks);
  el.hdg.textContent = String(Math.round(hdg) % 360).padStart(3, '0') + '°';
  el.home.textContent = (world.landmark === 'beacon' ? 'BEACON ' : 'FLAG ') +
    (dist < 1000 ? Math.round(dist) + ' m' : (dist / 1000).toFixed(dist < 10000 ? 2 : 1) + ' km') +
    ' · ' + String(Math.round(bearing(hx, hz)) % 360).padStart(3, '0') + '°';
}
