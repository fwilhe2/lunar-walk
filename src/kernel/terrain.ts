import { craterCacheReset, levelSite } from './craters';
import { WORLD, setActive } from './world';

/* Switch the kernel to another world. Every cache is keyed by cell,
   not by world, so whatever the last one built has to go. */
export function useTerrain(def) {
  if (WORLD === def) return def;
  setActive(def);
  AUX.fill(0);
  craterCacheReset();
  if (def.reset) def.reset();  // the world's own caches
  levelSite();
  return def;
}

/* Surface height in metres at any world position. The single
   source of truth: mesh, physics, rover wheels, rocks, landmark
   and footprints all call this, on whichever world is loaded. */
export function terrainHeight(x, z) {
  return WORLD.height(x, z);
}

/* ── Surface colour ─────────────────────────────────────────────
   Per-vertex albedo, written by the workers. It multiplies the
   regolith texture, whose base grey is set per world so the
   product lands on the body's real reflectance: 0.07 for mare
   basalt and for both Martian moons, 0.10 for Martian dune sand,
   0.28 for the ferric dust that coats everything else on Mars,
   and 0.10 for Venusian basalt, which is about as dark as the
   Moon and looks nothing like it.                               */
// How far the ground at the vertex being tinted faces north (−z): the
// normal's −z component, set by the worker before each surfaceTint().
// Frost on Callisto lies on poleward slopes.
export var TN_Z = 0;
// Side channels a world's height function may fill for its own colour
// pass, which the worker captures after each height and hands back to
// surfaceTint(): Europa's non-ice material and salt (0, 1), Mercury's
// hollows (2). Zero everywhere else.
export var AUX = new Float64Array(3);
export function surfaceTint(x, z, h, slope, fresh, a0, a1, a2, out) {
  WORLD.tint(x, z, h, slope, fresh, a0, a1, a2, out);
}

export function setTintNormalZ(v) { TN_Z = v; }
