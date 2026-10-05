/* The ground's GLSL, as files, so an editor sees GLSL and a change shows
   without a reload: in the dev server this module accepts its own
   updates, copies the new sources into SRC in place and bumps version;
   surfacePatch() reads SRC when three compiles, and keys its programs
   on version, so every patched material recompiles with the new code
   where you are standing. Nothing else about the scene restarts. */
import terrainShadow from './terrain-shadow.glsl?raw';
import hapke from './hapke.glsl?raw';
import hapkeGroundHead from './hapke-ground-head.glsl?raw';
import ground from './ground.glsl?raw';
import groundMap from './ground-map.glsl?raw';
import groundNormal from './ground-normal.glsl?raw';
import groundSparkle from './ground-sparkle.glsl?raw';
import lake from './lake.glsl?raw';
import lakeSurface from './lake-surface.glsl?raw';
import printBlend from './print-blend.glsl?raw';
import devilShape from './devil-shape.glsl?raw';
import devilShadow from './devil-shadow.glsl?raw';
import sunShadow from './sun-shadow.glsl?raw';

const fresh = { terrainShadow, hapke, hapkeGroundHead, ground, groundMap, groundNormal, groundSparkle, lake, lakeSurface, printBlend, devilShape, devilShadow, sunShadow };

// Every reload of this module after the first hands its sources to the
// objects the first one made, which is what everything else holds.
const hot = import.meta.hot;
export const SRC: typeof fresh = hot?.data.SRC ?? fresh;
export const glslState: { version: number; listeners: (() => void)[] } = hot?.data.state ?? { version: 0, listeners: [] };
if (hot) {
  if (SRC !== fresh) {
    Object.assign(SRC, fresh);
    glslState.version++;
    for (const fn of glslState.listeners) fn();
  }
  hot.data.SRC = SRC;
  hot.data.state = glslState;
  // Spelled out: Vite finds self-accepting modules by this text, in the
  // JS esbuild leaves, which has no `!`; TypeScript does not narrow
  // import.meta.hot from `hot` above.
  import.meta.hot!.accept();
}
