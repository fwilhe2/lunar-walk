/* The terrain kernel, in Node: what tools/check.mjs used to do, plus a
   fingerprint of every world. The surface is a pure function of
   (world, x, z); these tests hold it to that. */
import { readFileSync, writeFileSync } from 'node:fs';
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
    const r = [5, 60, 800, 9000, 60000][i % 5]!;   // i % 5 < 5
    yield [(rnd() - 0.5) * 2 * r, (rnd() - 0.5) * 2 * r, rnd()] as const;
  }
}

/* What a world hands out at a fixed spread of points, per channel —
   height, fresh ejecta, the three side channels, the three colours — as
   a plain sum, a sum with fixed pseudo-random weights (so changes cannot
   cancel), and the sum of magnitudes (the scale to compare against). */
const CHANNELS = ['h', 'fresh', 'a0', 'a1', 'a2', 'r', 'g', 'b'] as const;
type Channel = (typeof CHANNELS)[number];
type Sums = [sum: number, weighted: number, magnitude: number];
type Print = Record<Channel, Sums>;

function fingerprint(id: keyof typeof TERRAINS): Print {
  setWorld(id);
  const out = Object.fromEntries(CHANNELS.map((c) => [c, [0, 0, 0]])) as Record<Channel, Sums>;   // filled below
  let s = 777;
  const tint = [0, 0, 0];
  for (const [x, z, k] of spread(3000)) {
    const y = terrainHeight(x, z);
    const fresh = CR_ALB, a0 = AUX[0]!, a1 = AUX[1]!, a2 = AUX[2]!;
    setTintNormalZ(k * 2 - 1);
    surfaceTint(x, z, y, k, fresh, a0, a1, a2, tint);
    const w = 0.5 + ((s = (Math.imul(s, 1664525) + 1013904223) | 0) >>> 0) / 4294967296;
    const v = [y, fresh, a0, a1, a2, tint[0]!, tint[1]!, tint[2]!];
    CHANNELS.forEach((c, i) => { const o = out[c]; o[0] += v[i]!; o[1] += w * v[i]!; o[2] += Math.abs(v[i]!); });
  }
  return out;
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
    const pts = Array.from({ length: 2000 }, (_, i) => [Math.sin(i * 3.1) * 20000, Math.cos(i * 1.7) * 20000] as const);
    const warm = pts.map(([x, z]) => terrainHeight(x, z));
    craterCacheReset();
    expect(pts.map(([x, z]) => terrainHeight(x, z))).toEqual(warm);
  });

  test('crater classes stay inside the 3×3 scan', () => {
    for (const c of TERRAINS[id].craters) expect(c.rMax * 1.9).toBeLessThan(c.cell);
  });
});

/* Every world's surface, frozen, in tests/fingerprints.json. A change to
   the kernel or to a world's terrain moves its sums: if you meant it,
   record them again (UPDATE_FINGERPRINTS=1 bun run test) and say so in
   the commit. They are compared to a part in 10¹⁰ of each channel's
   magnitude, which still catches a millimetre of height at one point in
   the three thousand, and is far above the last-bit rounding by which
   engines differ: V8 versions and CPU architectures (arm64 against x64)
   compute Math.sin, pow and friends differently in the last bit, which
   never splits the ground — a page and its workers always run in one
   engine — but moved bit-exact hashes. Measured: under x64 Node 24, 44
   of the 504,000 numbers differ, by at most 1.3e-15 relative; under
   Node 22, 2,288, by at most 5e-13. The first fingerprints were checked
   bit for bit against the old single-file kernel; these sums were taken
   from a kernel that still matched those, bit for bit, on arm64 Node 24. */
const FILE = new URL('./fingerprints.json', import.meta.url);
const TOL = 1e-10;

test('fingerprints', () => {
  const got = Object.fromEntries(IDS.map((id) => [id, fingerprint(id)]));
  // and again in reverse, so no world leaks state into the next: in one
  // engine that is bit for bit
  for (const id of [...IDS].reverse()) expect(fingerprint(id)).toEqual(got[id]);
  if (process.env.UPDATE_FINGERPRINTS) {
    writeFileSync(FILE, '{\n' + IDS.map((id) => ` "${id}": ${JSON.stringify(got[id])}`).join(',\n') + '\n}\n');
    return;
  }
  const want = JSON.parse(readFileSync(FILE, 'utf8')) as Record<string, Print>;   // written by the line above
  expect(Object.keys(want).sort()).toEqual([...IDS].sort());
  const off: string[] = [];
  for (const id of IDS) {
    for (const c of CHANNELS) {
      const [s, w, m] = got[id]![c], [s0, w0] = want[id]![c];
      if (Math.abs(s - s0) > TOL * m || Math.abs(w - w0) > TOL * m) off.push(`${id}.${c}: ${s0} → ${s}`);
    }
  }
  expect(off).toEqual([]);
});
