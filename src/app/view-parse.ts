import { isWorldId, type WorldId } from '../worlds/index';

/* ── Shared views, as text ──────────────────────────────────────
   What a link carries (#w=moon&x=…), read and written without
   touching the scene, so tests/view.test.ts can hold the two to each
   other. app/view-hash.ts does the rest. Chunk vertices are 32-bit
   world coordinates, which quantise to about a centimetre at 100 km,
   so shared positions stop there. */
const VIEW_LIM = 100000;

/** A view as a link carries it; what is absent stays as it is (h absent: on foot). */
export interface SharedView {
  w: WorldId;
  x: number; z: number;
  yaw?: number; pitch?: number;
  sun?: number;          // elevation, °
  h?: number;            // height above the ground, m: flying
}

const r1 = (v: number) => Math.round(v * 10) / 10, r3 = (v: number) => Math.round(v * 1000) / 1000;
export function formatView(v: SharedView) {
  let h = 'w=' + v.w + '&x=' + r1(v.x) + '&z=' + r1(v.z) + '&yaw=' + r3(v.yaw ?? 0) +
    '&pitch=' + r3(v.pitch ?? 0) + '&sun=' + r1(v.sun ?? 0);
  if (v.h !== undefined) h += '&h=' + r1(v.h);
  return h;
}

// The address bar is anyone's to type into: an unknown world is no view
// at all, a malformed number is absent, and positions are clamped.
export function parseView(hash: string): SharedView | null {
  const q = new URLSearchParams(hash.replace(/^#/, ''));
  const w = q.get('w');
  if (!w || !isWorldId(w)) return null;
  const num = (k: string) => { const v = parseFloat(q.get(k) ?? ''); return Number.isFinite(v) ? v : undefined; };
  const lim = (v: number | undefined) => Math.min(VIEW_LIM, Math.max(-VIEW_LIM, v ?? 0));
  return { w, x: lim(num('x')), z: lim(num('z')), yaw: num('yaw'), pitch: num('pitch'), sun: num('sun'), h: num('h') };
}
