import { setSeed } from './noise';
import type { CraterClass, TerrainDef } from '../worlds/types';

/* ── The active world ───────────────────────────────────────────
   Every function in the kernel reads the world it is on from here.
   A world is a terrain definition (src/worlds/<id>/terrain.ts):
   what the ground is made of, as data, plus its height and colour
   functions. useTerrain() (terrain.ts) switches; a chunk built in a worker and a
   footstep tested on the main thread agree on the ground because
   both select the same definition before asking. */
// The active definition; useTerrain() swaps it. Typed as never null: the
// registry (worlds/terrains.ts) selects the Moon before anything can ask.
export var WORLD: TerrainDef = null!;

export var CRATER_LAYERS: CraterClass[] = [];
// Which classes carry what, by flag rather than by place in the table,
// so adding a class never quietly moves them: ray systems (rays), wind
// streaks (streak), Mercury's hollows (hol), Callisto's knobs (knob);
// props/rocks.ts reads rocks itself.
function flagged(key: 'rays' | 'streak' | 'hol' | 'knob'): number[] {
  var out: number[] = [];
  for (var i = 0; i < CRATER_LAYERS.length; i++) if (CRATER_LAYERS[i]![key]) out.push(i);
  return out;
}
export var RAY_LI: number[] = [], STREAK_LI: number[] = [], HOL_LI: number[] = [], KNOB_LI: number[] = [];
export var CURVE_R = 1;              // apparent, not physical — see curveDrop()

// The state only; useTerrain() in terrain.ts also clears the caches
// built for the world before.
export function setActive(def: TerrainDef) {
  WORLD = def;
  setSeed(def.seed);            // every noise field in the kernel keys off this
  CRATER_LAYERS = def.craters;
  RAY_LI = flagged('rays');
  STREAK_LI = flagged('streak');
  HOL_LI = flagged('hol');
  KNOB_LI = flagged('knob');
  CURVE_R = def.Rc || def.R;
}
