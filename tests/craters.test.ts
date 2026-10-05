/* The crater cache and what cellCraters() promises about a cell. */
import { describe, expect, test } from 'vitest';
import { ccSlot, cellCraters, craterCacheReset } from '../src/kernel/craters';
import { CRATER_LAYERS } from '../src/kernel/world';
import { TERRAINS, setWorld } from '../src/worlds/terrains';

const IDS = Object.keys(TERRAINS) as (keyof typeof TERRAINS)[];

/* One mix serves every direct-mapped cache scanned 3×3: the craters'
   (13 bits), Callisto's and Ganymede's knobs and Mercury's hollows (12). */
describe.each([13, 12])('ccSlot, %i bits', (bits) => {
  test('is a slot of the table', () => {
    for (let i = 0; i < 5000; i++) {
      const s = ccSlot((i * 7919) % 100003 - 50000, (i * 104729) % 99991 - 50000, bits);
      expect(Number.isInteger(s) && s >= 0 && s < 1 << bits).toBe(true);
    }
  });

  /* A collision inside one 3×3 scan misses on every query there. The
     xor of two products sent (1, 1) and (−1, −1) to one slot — right by
     the origin, where every world lands you. */
  test('no two cells of any 3×3 scan within 300 cells of the origin share a slot', () => {
    const R = 300, W = 2 * R + 3, slot = new Int32Array(W * W);
    for (let z = -R - 1; z <= R + 1; z++) for (let x = -R - 1; x <= R + 1; x++) slot[(z + R + 1) * W + x + R + 1] = ccSlot(x, z, bits);
    let bad = 0;
    for (let z = -R; z <= R; z++) {
      for (let x = -R; x <= R; x++) {
        const seen = new Set<number>();
        for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) seen.add(slot[(z + dz + R + 1) * W + x + dx + R + 1]!);
        if (seen.size < 9) bad++;
      }
    }
    expect(bad).toBe(0);
  });
});

describe.each(IDS)('%s: cellCraters', (id) => {
  test('every crater inside its cell band, its class and its age range', () => {
    setWorld(id);
    CRATER_LAYERS.forEach((L, li) => {
      for (let cz = -6; cz <= 6; cz++) {
        for (let cx = -6; cx <= 6; cx++) {
          for (const c of cellCraters(li, cx, cz)) {
            // centres in the middle 84% of the cell, so rMax·1.9 < cell keeps a crater in the 3×3 scan
            expect(c.x / L.cell - cx).toBeGreaterThanOrEqual(0.08 - 1e-9);
            expect(c.x / L.cell - cx).toBeLessThanOrEqual(0.92 + 1e-9);
            expect(c.z / L.cell - cz).toBeGreaterThanOrEqual(0.08 - 1e-9);
            expect(c.z / L.cell - cz).toBeLessThanOrEqual(0.92 + 1e-9);
            expect(c.r).toBeGreaterThanOrEqual(L.rMin);
            expect(c.r).toBeLessThanOrEqual(L.rMax);
            expect(c.age).toBeGreaterThanOrEqual(0);
            expect(c.age).toBeLessThanOrEqual(1);
            expect(c.depth).toBeGreaterThan(0);
          }
        }
      }
    });
  });

  test('a hit hands back the cached list; a cold cache derives the same one', () => {
    setWorld(id);
    if (!CRATER_LAYERS.length) return;
    const a = cellCraters(0, 3, -4);
    expect(cellCraters(0, 3, -4)).toBe(a);
    craterCacheReset();
    const b = cellCraters(0, 3, -4);
    expect(b).not.toBe(a);
    expect(b).toEqual(a);
  });
});
