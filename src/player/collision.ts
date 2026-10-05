import type * as THREE from 'three';
import { terrainHeight } from '../kernel/terrain';
import { rockSystem, type Solid } from '../props/rocks';

/* Rocks underfoot. A stone you can lift a boot onto is ground — the
   suit's knees allow about 0.3 m of step, the height of the rocks the
   Apollo crews stepped up on — and anything taller is a wall, met at
   the contour where it rises past that. On top of a block, its crown
   is ground like any other; walking off one, you step down. */
export const STEP_UP = 0.3;
export const _solids: Solid[] = [];
export function rockHeight(r: Solid, x: number, z: number) {
  const q = 1 - ((x - r.x) ** 2 + (z - r.z) ** 2) / (r.R * r.R);
  return q <= 0 ? -1e9 : r.top - (r.top - r.g) * (1 - Math.sqrt(q));
}
// The ground a body with its feet at `feet` stands on at (x, z).
export function standHeight(x: number, z: number, feet: number) {
  let h = terrainHeight(x, z);
  for (const r of rockSystem.solidsAt(x, z, _solids)) {
    const rh = rockHeight(r, x, z);
    if (rh > h && rh <= feet + STEP_UP) h = rh;
  }
  return h;
}
// Keep a body of radius rad out of every rock too tall to step onto.
export function rockPush(pos: THREE.Vector3, feet: number, rad: number, n: THREE.Vector3) {
  let hit = false;
  const H = feet + STEP_UP;
  for (const r of rockSystem.solidsAt(pos.x, pos.z, _solids, rad)) {
    if (r.top <= H) continue;
    const k = (r.top - H) / Math.max(r.top - r.g, 1e-3);
    const wall = (k >= 1 ? 1 : Math.sqrt(1 - (1 - k) ** 2)) * r.R + rad;
    const ex = pos.x - r.x, ez = pos.z - r.z, d = Math.hypot(ex, ez);
    if (d >= wall || d < 1e-6) continue;
    pos.x = r.x + ex / d * wall; pos.z = r.z + ez / d * wall;
    n.set(ex / d, 0, ez / d);
    hit = true;
  }
  return hit;
}
