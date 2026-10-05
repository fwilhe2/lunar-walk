/* Every world's terrain definition, keyed by id. Pure: no DOM, no
   three — the mesh workers import this too. */
import { useTerrain } from '../kernel/terrain';
import type { TerrainDef } from './types';
import { terrain as mercury } from './mercury/terrain';
import { terrain as venus } from './venus/terrain';
import { terrain as moon } from './moon/terrain';
import { terrain as mars } from './mars/terrain';
import { terrain as phobos } from './phobos/terrain';
import { terrain as deimos } from './deimos/terrain';
import { terrain as vesta } from './vesta/terrain';
import { terrain as ceres } from './ceres/terrain';
import { terrain as io } from './io/terrain';
import { terrain as europa } from './europa/terrain';
import { terrain as ganymede } from './ganymede/terrain';
import { terrain as callisto } from './callisto/terrain';
import { terrain as mimas } from './mimas/terrain';
import { terrain as enceladus } from './enceladus/terrain';
import { terrain as dione } from './dione/terrain';
import { terrain as titan } from './titan/terrain';
import { terrain as iapetus } from './iapetus/terrain';
import { terrain as miranda } from './miranda/terrain';
import { terrain as triton } from './triton/terrain';
import { terrain as pluto } from './pluto/terrain';
import { terrain as charon } from './charon/terrain';

export const TERRAINS = { mercury, venus, moon, mars, phobos, deimos, vesta, ceres, io, europa, ganymede, callisto, mimas, enceladus, dione, titan, iapetus, miranda, triton, pluto, charon };

export function setWorld(id: keyof typeof TERRAINS): TerrainDef {
  return useTerrain(TERRAINS[id]);
}

// The kernel starts on the Moon.
setWorld('moon');
