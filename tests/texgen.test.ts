/* The pure texture generators (workers/texgen.jobs.ts). Each runs in a
   worker of its own, or on the main thread when a worker cannot start
   (util/texgen.ts) — and the main thread has a world's seed set, the
   worker none. Both must draw the same map. */
import { afterEach, describe, expect, test } from 'vitest';
import { SEED, setSeed } from '../src/kernel/noise';
import { JOBS, type JobArgs, type JobName, runJob } from '../src/workers/texgen.jobs';
import { VIEW } from '../src/worlds/index';
import { TERRAINS } from '../src/worlds/terrains';

const SEED0 = SEED;
afterEach(() => setSeed(SEED0));

const rego = (id: keyof typeof VIEW) => {
  const v = VIEW[id];
  return { grey: v.grey, mapTint: v.mapTint, pits: v.pits, grain: v.grain, pebbles: v.pebbles, clods: v.clods, plate: v.plate, ripple: v.ripple };
};
const ARGS: { [K in JobName]: JobArgs<K> } = {
  regolithData: [rego('mars'), 0.6, -0.8],
  jupiterPixels: [256, 128],
  marsPixels: [256, 128],
  galileanPixels: ['io'],
  charonPixels: [],
  plutoPixels: [],
  neptunePixels: [128, 64],
  uranusPixels: [128, 64],
};

// Every typed array a result holds, in a fixed order.
const arrays = (r: unknown): ArrayBufferView[] =>
  ArrayBuffer.isView(r) ? [r] : Object.entries(r as object).sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v).filter((v) => ArrayBuffer.isView(v));
const bytes = (v: ArrayBufferView) => new Uint8Array(v.buffer, v.byteOffset, v.byteLength);

test('every job has arguments here', () => {
  expect(Object.keys(ARGS).sort()).toEqual(Object.keys(JOBS).sort());
});

describe.each(Object.keys(JOBS) as JobName[])('%s', (fn) => {
  test('draws the same map whichever world\'s seed is set, and leaves it set', () => {
    setSeed(TERRAINS.moon.seed);
    const a = arrays(runJob(fn, ARGS[fn]));
    expect(a.length).toBeGreaterThan(0);
    setSeed(TERRAINS.europa.seed);
    const b = arrays(runJob(fn, ARGS[fn]));
    expect(SEED).toBe(TERRAINS.europa.seed);
    expect(b.length).toBe(a.length);
    a.forEach((v, i) => expect(Buffer.compare(bytes(v), bytes(b[i]!))).toBe(0));   // same length, checked above
  });
});
