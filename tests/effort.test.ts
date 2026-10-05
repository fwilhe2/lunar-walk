/* Effort (player/effort.ts): metabolic power, the reserve above critical
   power, being winded, and the heart rate that follows. */
import { beforeEach, expect, test } from 'vitest';
import { EFFORT, effort } from '../src/player/effort';

beforeEach(() => {
  Object.assign(effort, { W: EFFORT.rest, Wf: EFFORT.rest, hr: 72, kick: 0, left: EFFORT.reserve, winded: false });
});
const hold = (P: number, s: number, dt = 0.05) => { for (let t = 0; t < s; t += dt) effort.update(dt, P); };

test('below critical power the reserve stays full, however long', () => {
  hold(EFFORT.cp * 0.9, 600);
  expect(effort.left).toBe(EFFORT.reserve);
  expect(effort.winded).toBe(false);
});

test('above it the reserve drains at the excess, and empty, you are winded', () => {
  hold(EFFORT.cp + 400, 100);
  expect(effort.left).toBeCloseTo(EFFORT.reserve - 400 * 100, -2);
  expect(effort.winded).toBe(false);
  hold(EFFORT.cp + 400, 120);
  expect(effort.left).toBe(0);
  expect(effort.winded).toBe(true);
});

test('winded until a third of the reserve is back, not before', () => {
  hold(EFFORT.cp + 2000, 60);
  expect(effort.winded).toBe(true);
  const rest = EFFORT.rest, refill = EFFORT.cp - rest;          // W of recovery at rest
  hold(rest, EFFORT.reserve / 3 / refill * 0.9);
  expect(effort.winded).toBe(true);
  hold(rest, EFFORT.reserve / 3 / refill * 0.2);
  expect(effort.winded).toBe(false);
});

test('a push is paid off over about a second, not in one frame', () => {
  effort.spend(1500);
  effort.update(0.05, EFFORT.rest);
  expect(effort.kick).toBeCloseTo(1500 - 75, 6);
  hold(EFFORT.rest, 1.2);
  expect(effort.kick).toBeCloseTo(0, 6);
});

test('heart rate follows the readout\'s power at 0.2 beat a minute per watt, and tops out at 185', () => {
  hold(EFFORT.rest + 300, 600);
  expect(effort.W).toBeCloseTo(EFFORT.rest + 300, 1);
  expect(effort.hr).toBeCloseTo(72 + 0.2 * 300, 0);
  hold(5000, 600);
  expect(effort.hr).toBeLessThanOrEqual(185);
  expect(effort.W).toBeLessThanOrEqual(1400);   // the aerobic ceiling: past it is borrowed
});

test('the breath answers faster than the readout', () => {
  hold(EFFORT.rest + 500, 3);
  expect(effort.Wf - EFFORT.rest).toBeGreaterThan(2 * (effort.W - EFFORT.rest));
});
