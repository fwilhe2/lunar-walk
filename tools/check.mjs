#!/usr/bin/env node
/* Checks on the terrain kernel, run in Node on the exact TERRAIN_SOURCE
   the page evals and the workers prepend.

     node tools/check.mjs          check every world against the baseline
     node tools/check.mjs --save   record this machine's timings as the baseline
     node tools/check.mjs moon     one world

   For each world: no NaN or Infinity over a spread of positions, the
   same heights after the crater cache is reset (craters must be a pure
   function of their cell), and the warm cost of terrainHeight() in µs
   per call, compared against tools/perf-baseline.json. Timings are only
   comparable on one machine, and only with nothing else loading it —
   not while a probe is running. */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(HERE, '..', 'index.html'), 'utf8');
const A = 'const TERRAIN_SOURCE = String.raw`';
const a = html.indexOf(A) + A.length;
const src = html.slice(a, html.indexOf('`;', a));
const K = new Function(src + '; return { setWorld, terrainHeight, craterCacheReset, WORLDS };')();

const args = process.argv.slice(2);
const save = args.includes('--save');
const only = args.filter((x) => !x.startsWith('--'));
const ids = only.length ? only : Object.keys(K.WORLDS);
const BASE = path.join(HERE, 'perf-baseline.json');
const base = fs.existsSync(BASE) ? JSON.parse(fs.readFileSync(BASE, 'utf8')) : {};

// A walk across a chunk's worth of lattice, as the worker queries it,
// at a few places: the landing site, and well out in every direction.
const SITES = [[0, 0], [3000, 2000], [-9000, 4000], [25000, -31000]];
function sweep(fn, n) {
  let s = 0;
  for (const [ox, oz] of SITES) {
    for (let i = 0; i < n; i++) s += fn(ox + (i % 257) * 1.0, oz + Math.floor(i / 257) * 1.0);
  }
  return s;
}

let fail = 0;
const out = {};
for (const id of ids) {
  K.setWorld(id);
  // Sanity: finite everywhere in a coarse spread, out to 60 km.
  let bad = 0;
  for (let i = 0; i < 4000; i++) {
    const x = Math.sin(i * 12.9898) * 60000, z = Math.cos(i * 78.233) * 60000;
    if (!Number.isFinite(K.terrainHeight(x, z))) bad++;
  }
  // Purity: the same heights with a cold cache as with a warm one.
  const probe = [];
  for (let i = 0; i < 2000; i++) probe.push([Math.sin(i * 3.1) * 20000, Math.cos(i * 1.7) * 20000]);
  const h1 = probe.map(([x, z]) => K.terrainHeight(x, z));
  K.craterCacheReset();
  const h2 = probe.map(([x, z]) => K.terrainHeight(x, z));
  const drift = h1.reduce((m, h, i) => Math.max(m, Math.abs(h - h2[i])), 0);
  // Cost: warm up first — the first few thousand calls run unoptimised.
  sweep(K.terrainHeight, 20000);
  const N = 30000, t0 = performance.now();
  sweep(K.terrainHeight, N);
  const us = (performance.now() - t0) * 1000 / (N * SITES.length);
  out[id] = +us.toFixed(3);
  const ref = base[id];
  const rel = ref ? us / ref : 1;
  const flag = bad ? 'NON-FINITE' : drift > 0 ? 'IMPURE' : rel > 1.2 ? 'SLOWER' : 'ok';
  if (flag !== 'ok') fail++;
  console.log(id.padEnd(8), (us.toFixed(2) + ' µs').padStart(9),
    ref ? ((rel >= 1 ? '+' : '') + ((rel - 1) * 100).toFixed(0) + '%').padStart(6) : '     –',
    ' ', flag, bad ? '(' + bad + ' non-finite)' : '', drift > 0 ? '(drift ' + drift + ')' : '');
}
if (save) {
  fs.writeFileSync(BASE, JSON.stringify({ ...base, ...out }, null, 2) + '\n');
  console.log('baseline saved to', path.relative(process.cwd(), BASE));
}
process.exit(fail && !save ? 1 : 0);
