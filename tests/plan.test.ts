/* Which chunks the streamer asks for around the player
   (terrain/plan.ts), for every world's levels, on every tier. */
import { describe, expect, test } from 'vitest';
import { type ChunkSpec, planChunks } from '../src/terrain/plan';
import { VIEW, WORLD_IDS } from '../src/worlds/index';

const LEVEL_SETS = [...new Map(WORLD_IDS.map((id) => [JSON.stringify(VIEW[id].levels()), VIEW[id].levels()])).values()];
const PLACES = [[0, 0], [127.9, -300.2], [-5000.5, 77777.7], [1023.99, 1024.01]] as const;

// The steps chunkStreamer.stepAt() looks for, finest first.
const STEP_AT = [1, 2, 4, 8];
const covers = (c: ChunkSpec, x: number, z: number) => x >= c.x0 && x < c.x0 + c.n * c.step && z >= c.z0 && z < c.z0 + c.n * c.step;

describe.each(LEVEL_SETS.flatMap((L) => [false, true].map((coarse) => [L.map((l) => l.size + '/' + l.ext).join(' '), L, coarse] as const)))(
  'levels %s, coarse %s', (_, levels, coarse) => {
    test('each level\'s chunks are whole chunks of the next finer one', () => {
      for (let li = 1; li < levels.length; li++) expect(levels[li]!.size % levels[li - 1]!.size).toBe(0);
    });

    test.each(PLACES)('at (%f, %f): whole vertex counts, walls for every cut, metre steps underfoot', (px, pz) => {
      const plan = [...planChunks(levels, px, pz, coarse).values()];
      for (const c of plan) {
        expect(Number.isInteger(c.n)).toBe(true);
        expect(c.n * c.step).toBe(levels[c.level]!.size);
        // the worker hangs walls only when n divides into m cells (mesh.worker.ts)
        if (c.level > 0) expect(c.n % c.m).toBe(0);
        expect([c.ax, c.az]).toEqual([(Math.floor(px / 256) + 0.5) * 256, (Math.floor(pz / 256) + 0.5) * 256]);
      }
      // chunkStreamer.stepAt() finds the finest chunk by trying these steps
      for (const c of plan) if (c.level === 0) expect(STEP_AT).toContain(c.step);
      const here = plan.filter((c) => covers(c, px, pz));
      expect(Math.min(...here.map((c) => c.step))).toBe(1);
    });

    test.each(PLACES)('at (%f, %f): no holes, and no chunk wholly under finer ground', (px, pz) => {
      const plan = [...planChunks(levels, px, pz, coarse).values()];
      const T = levels[levels.length - 1]!;
      // which cells of each level the plan holds, whatever their step
      const held = new Set(plan.map((c) => c.level + ':' + c.x0 / levels[c.level]!.size + ':' + c.z0 / levels[c.level]!.size));
      const has = (x: number, z: number) => levels.some((L, li) => held.has(li + ':' + Math.floor(x / L.size) + ':' + Math.floor(z / L.size)));
      // the outermost level's square, sampled every 97 m (a step no chunk size divides)
      const reach = T.ext * T.size;
      for (let z = pz - reach; z < pz + reach; z += 97) {
        for (let x = px - reach; x < px + reach; x += 97) {
          if (!has(x, z)) expect.fail(`hole at ${x}, ${z}`);
        }
      }
      for (const c of plan) {
        if (c.level === 0) continue;
        // its m × m cells: is every one a finer chunk?
        const per = levels[c.level - 1]!.size;
        let all = true;
        for (let j = 0; j < c.m && all; j++) for (let i = 0; i < c.m && all; i++) all = held.has((c.level - 1) + ':' + (c.x0 / per + i) + ':' + (c.z0 / per + j));
        expect(all).toBe(false);
      }
    });
  });

test('keys are unique per chunk and step, and nearer rings build first', () => {
  const plan = planChunks(VIEW.moon.levels(), 10, 10, false);
  for (const [k, c] of plan) expect(k).toBe(c.level + ':' + c.x0 / VIEW.moon.levels()[c.level]!.size + ':' + c.z0 / VIEW.moon.levels()[c.level]!.size + ':' + c.step);
  const l0 = [...plan.values()].filter((c) => c.level === 0);
  for (const c of l0) expect(c.ring).toBeLessThan(10);
  for (const c of plan.values()) if (c.level > 0) expect(c.ring).toBeGreaterThanOrEqual(10 * c.level);
});
