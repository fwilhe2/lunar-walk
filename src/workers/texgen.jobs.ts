/* Texture generators that are pure pixel loops — no three, no DOM,
   only the kernel's noise — so they can run in a worker (texgen.worker.ts)
   and, should a worker fail, on the main thread (util/texgen.ts). A new
   body's map generator should be written this way and listed here, or
   it freezes the page the first time someone visits. */
import { regolithData } from '../surface/regolith.pixels';
import { charonPixels } from '../sky/bodies/charon.pixels';
import { galileanPixels } from '../sky/bodies/galilean.pixels';
import { jupiterPixels } from '../sky/bodies/jupiter.pixels';
import { neptunePixels } from '../sky/bodies/neptune.pixels';
import { plutoPixels } from '../sky/bodies/pluto.pixels';
import { uranusPixels } from '../sky/bodies/uranus.pixels';

export const JOBS = { regolithData, jupiterPixels, galileanPixels, charonPixels, plutoPixels, neptunePixels, uranusPixels };
