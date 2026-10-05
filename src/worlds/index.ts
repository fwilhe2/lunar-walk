/* The worlds, in order out from the sun — the order of the keys along
   the number row (WORLD_KEYS), the buttons on the opening screen and
   the demo's tour. Each one is a folder: terrain.ts says what the
   ground is, view.ts what it looks like (see types.ts). Adding a world
   means adding a folder and a line in each list below; the compiler
   checks that both lists name the same worlds. */
import type { World, WorldView } from './view-types';
import { TERRAINS, type WorldId } from './terrains';
import { view as mercury } from './mercury/view';
import { view as venus } from './venus/view';
import { view as moon } from './moon/view';
import { view as mars } from './mars/view';
import { view as phobos } from './phobos/view';
import { view as deimos } from './deimos/view';
import { view as vesta } from './vesta/view';
import { view as ceres } from './ceres/view';
import { view as io } from './io/view';
import { view as europa } from './europa/view';
import { view as ganymede } from './ganymede/view';
import { view as callisto } from './callisto/view';
import { view as mimas } from './mimas/view';
import { view as enceladus } from './enceladus/view';
import { view as dione } from './dione/view';
import { view as titan } from './titan/view';
import { view as iapetus } from './iapetus/view';
import { view as miranda } from './miranda/view';
import { view as triton } from './triton/view';
import { view as pluto } from './pluto/view';
import { view as charon } from './charon/view';

const VIEWS: Record<WorldId, WorldView> = { mercury, venus, moon, mars, phobos, deimos, vesta, ceres, io, europa, ganymede, callisto, mimas, enceladus, dione, titan, iapetus, miranda, triton, pluto, charon };

export type { WorldId };
export const WORLD_IDS = Object.keys(VIEWS) as WorldId[];   // VIEWS has exactly these keys
/** For ids from outside (a shared link): own keys only, so 'constructor' is not a world. */
export const isWorldId = (s: string): s is WorldId => Object.hasOwn(VIEWS, s);
// 1–9 along the number row, then −, = and Backspace: 0 is the demo.
// Shift and the same keys reach worlds thirteen onward.
export const WORLD_KEYS = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Minus', 'Equal', 'Backspace'];

// Gravity as the readout gives it: two significant figures below 1 m/s², three above.
const gText = (g: number) => (g < 1 ? g.toPrecision(2) : g.toPrecision(3)) + ' m/s²';

export const VIEW = Object.fromEntries(WORLD_IDS.map((id) => {
  const g = TERRAINS[id].g;
  return [id, { ...VIEWS[id], id, name: id.toUpperCase(), g, gTxt: gText(g) }];
})) as Record<WorldId, World>;   // fromEntries types its keys as string; they are WORLD_IDS

// The world on screen; activateWorld() switches it (app/worlds.ts).
export let world: World = VIEW.moon;
export let worldId: WorldId = 'moon';
export function activateWorld(id: WorldId) {
  worldId = id;
  world = VIEW[id];
}
