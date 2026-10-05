/* The terrain kernel, in Node: what tools/check.mjs used to do, plus a
   fingerprint of every world. The surface is a pure function of
   (world, x, z); these tests hold it to that. */
import { describe, expect, test } from 'vitest';
import { CR_ALB, craterCacheReset } from '../src/kernel/craters';
import { AUX, setTintNormalZ, surfaceTint, terrainHeight } from '../src/kernel/terrain';
import { TERRAINS, setWorld } from '../src/worlds/terrains';

const IDS = Object.keys(TERRAINS) as (keyof typeof TERRAINS)[];

// A fixed spread of positions from metres to 60 km, deterministic.
function* spread(n: number) {
  let s = 12345;
  const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) | 0) >>> 0) / 4294967296;
  for (let i = 0; i < n; i++) {
    const r = [5, 60, 800, 9000, 60000][i % 5];
    yield [(rnd() - 0.5) * 2 * r, (rnd() - 0.5) * 2 * r, rnd()] as const;
  }
}

// FNV-1a over the bit patterns of every number the kernel hands out.
function fingerprint(id: keyof typeof TERRAINS) {
  setWorld(id);
  const f64 = new Float64Array(1), u32 = new Uint32Array(f64.buffer);
  let h = 0x811c9dc5;
  const add = (v: number) => { f64[0] = v; for (const w of u32) { h ^= w; h = Math.imul(h, 0x01000193); } };
  const tint = [0, 0, 0];
  for (const [x, z, k] of spread(3000)) {
    const y = terrainHeight(x, z);
    const fresh = CR_ALB, a0 = AUX[0], a1 = AUX[1], a2 = AUX[2];
    add(y); add(fresh); add(a0); add(a1); add(a2);
    setTintNormalZ(k * 2 - 1);
    surfaceTint(x, z, y, k, fresh, a0, a1, a2, tint);
    add(tint[0]); add(tint[1]); add(tint[2]);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

describe.each(IDS)('%s', (id) => {
  test('finite everywhere out to 60 km', () => {
    setWorld(id);
    let bad = 0;
    for (let i = 0; i < 4000; i++) {
      const x = Math.sin(i * 12.9898) * 60000, z = Math.cos(i * 78.233) * 60000;
      if (!Number.isFinite(terrainHeight(x, z))) bad++;
    }
    expect(bad).toBe(0);
  });

  test('pure: the same heights with a cold crater cache', () => {
    setWorld(id);
    const pts = Array.from({ length: 2000 }, (_, i) => [Math.sin(i * 3.1) * 20000, Math.cos(i * 1.7) * 20000]);
    const warm = pts.map(([x, z]) => terrainHeight(x, z));
    craterCacheReset();
    expect(pts.map(([x, z]) => terrainHeight(x, z))).toEqual(warm);
  });

  test('crater classes stay inside the 3×3 scan', () => {
    for (const c of TERRAINS[id].craters) expect(c.rMax * 1.9).toBeLessThan(c.cell);
  });
});

/* Every world's surface, frozen. A change to the kernel or to a world's
   terrain changes its line here: if you meant it, update the snapshot
   (bunx vitest run -u) and say so in the commit. The first snapshot was
   checked bit for bit against the old single-file kernel.
   The numbers are V8's: engines round Math.sin, pow and friends
   differently in the last bit (under Bun/JavaScriptCore 15 of 21 worlds
   print other hashes). That never splits the ground, because a page and
   its workers always run in the same engine — but run this in Node:
   bun run test, not bun test (Bun's own runner, on JavaScriptCore). */
test('fingerprints', () => {
  const out: Record<string, string> = {};
  for (const id of IDS) out[id] = fingerprint(id);
  // and again in reverse, so no world leaks state into the next
  for (const id of [...IDS].reverse()) expect(fingerprint(id)).toBe(out[id]);
  expect(out).toMatchSnapshot();
});
