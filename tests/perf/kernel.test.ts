/* What terrainHeight() costs per call, warm, per world, against
   tools/perf-baseline.json — about 67k calls build one near chunk, so a
   cheap-looking addition is stutter on every 256 m boundary crossing.

     bun run perf                 compare against the baseline
     PERF_SAVE=1 bun run perf     record this machine's timings

   Timings are only comparable on one machine with nothing else loading
   it. Re-record only after a change you meant to cost something. */
import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';
import { terrainHeight } from '../../src/kernel/terrain';
import { TERRAINS, setWorld } from '../../src/worlds/terrains';

const BASE = path.join(__dirname, '../../tools/perf-baseline.json');
const base = fs.existsSync(BASE) ? JSON.parse(fs.readFileSync(BASE, 'utf8')) : {};

// A walk across a chunk's worth of lattice, as the worker queries it,
// at a few places: the landing site, and well out in every direction.
const SITES = [[0, 0], [3000, 2000], [-9000, 4000], [25000, -31000]];
function sweep(n: number) {
  let s = 0;
  for (const [ox, oz] of SITES) for (let i = 0; i < n; i++) s += terrainHeight(ox + (i % 257), oz + Math.floor(i / 257));
  return s;
}

test('terrainHeight() cost per world', () => {
  const out: Record<string, number> = {};
  const rows: string[] = [];
  let slower = 0;
  for (const id of Object.keys(TERRAINS) as (keyof typeof TERRAINS)[]) {
    setWorld(id);
    sweep(20000);                      // warm: the first calls run unoptimised
    const N = 30000, t0 = performance.now();
    sweep(N);
    const us = (performance.now() - t0) * 1000 / (N * SITES.length);
    out[id] = +us.toFixed(3);
    const rel = base[id] ? us / base[id] : 1;
    if (rel > 1.2) slower++;
    rows.push(`${id.padEnd(10)} ${us.toFixed(2).padStart(6)} µs ${base[id] ? ((rel - 1) * 100).toFixed(0).padStart(4) + '%' : '    –'}${rel > 1.2 ? '  SLOWER' : ''}`);
  }
  console.log(rows.join('\n'));
  if (process.env.PERF_SAVE) fs.writeFileSync(BASE, JSON.stringify(out, null, 2) + '\n');
  else expect(slower).toBe(0);
});
