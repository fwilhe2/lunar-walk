/* The landing sites. Offsets, lander positions and companions were
   chosen in Node against the ground as it was then; a change to a
   world's terrain can quietly undo that, and a fingerprint re-recorded
   for it would never notice. These say what was chosen for. */
import { describe, expect, test } from 'vitest';
import { terrainHeight } from '../src/kernel/terrain';
import { CHARON, PLUTO, type Vec3 } from '../src/sky/frames';
import { VIEW } from '../src/worlds/index';
import { TERRAINS, setWorld } from '../src/worlds/terrains';

const IDS = Object.keys(TERRAINS) as (keyof typeof TERRAINS)[];
const EYE = 1.62, DEG = 180 / Math.PI;
// props/lander.ts's KINDS: pad circle radius and height of the body
const KIND = { lm: { footR: 4.72, top: 6.5 }, viking: { footR: 1.15, top: 1.8 },
               venera: { footR: 1.0, top: 2.4 }, generic: { footR: 3.9, top: 6.3 } } as const;

describe.each(IDS.filter((id) => TERRAINS[id].lander))('%s: the lander', (id) => {
  const [lx, lz] = TERRAINS[id].lander!;   // filtered above
  const k = KIND[VIEW[id].lander ?? 'lm'];

  test('stands on level ground: under 6° across its pads', () => {
    setWorld(id);
    let worst = 0;
    for (let i = 0; i < 12; i++) {
      const a = i / 24 * 2 * Math.PI, dx = Math.cos(a) * k.footR, dz = Math.sin(a) * k.footR;
      worst = Math.max(worst, Math.abs(terrainHeight(lx + dx, lz + dz) - terrainHeight(lx - dx, lz - dz)) / (2 * k.footR));
    }
    expect(Math.atan(worst) * DEG).toBeLessThan(6);
  });

  test('is in sight from the site, half its height clear of the ground between by half a metre', () => {
    setWorld(id);
    const eye = terrainHeight(0, 0) + EYE, mid = terrainHeight(lx, lz) + k.top / 2;
    const end = 1 - k.footR / Math.hypot(lx, lz);
    for (let s = 0.02; s < end; s += 0.005) expect(eye + (mid - eye) * s - terrainHeight(lx * s, lz * s)).toBeGreaterThan(0.5);
  });
});

test('Titan: the site and the lander are dry', () => {
  setWorld('titan');
  const sea = VIEW.titan.sea!;   // Titan's view has a sea
  expect(terrainHeight(0, 0)).toBeGreaterThan(sea + 1);
  const [lx, lz] = TERRAINS.titan.lander!;
  expect(terrainHeight(lx, lz)).toBeGreaterThan(sea + 1);
});

// The highest the ground stands toward a direction, in degrees above the
// eye's horizontal, out to 60 km, dropped by the curve as drawn.
function skyline(id: keyof typeof TERRAINS, dir: Vec3) {
  setWorld(id);
  const R = TERRAINS[id].Rc || TERRAINS[id].R, h = Math.hypot(dir[0], dir[2]);
  const ux = dir[0] / h, uz = dir[2] / h, eye = terrainHeight(0, 0) + EYE;
  let best = -90;
  for (let d = 5; d < 60000; d *= 1.01) best = Math.max(best, Math.atan2(terrainHeight(ux * d, uz * d) - d * d / (2 * R) - eye, d) * DEG);
  return best;
}
const elevation = (dir: Vec3) => Math.atan2(dir[1], Math.hypot(dir[0], dir[2])) * DEG;

test('Pluto: Charon clears the range to the east, by more than five degrees', () => {
  expect(elevation(CHARON.dir) - CHARON.ang * DEG - skyline('pluto', CHARON.dir)).toBeGreaterThan(5);
});

describe('Charon', () => {
  test('Pluto stands 42° up and 7.1° across', () => {
    expect(elevation(PLUTO.dir)).toBeCloseTo(42, 0);
    expect(2 * PLUTO.ang * DEG).toBeCloseTo(7.1, 1);
  });
  test('the massif stands under Pluto, and Pluto clears it', () => {
    const sky = skyline('charon', PLUTO.dir);
    expect(sky).toBeGreaterThan(5);
    expect(elevation(PLUTO.dir) - PLUTO.ang * DEG - sky).toBeGreaterThan(5);
  });
});
