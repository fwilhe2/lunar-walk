/* What follows from the suited body (player/constants.ts) — nothing
   about moving on foot is tuned for feel, so these are its numbers. */
import { describe, expect, test } from 'vitest';
import { G_EARTH, SUIT, pushSpeed } from '../src/player/constants';
import { TERRAINS } from '../src/worlds/terrains';

const G_MOON = TERRAINS.moon.g;

describe('pushSpeed', () => {
  test('a maximal jump on the Moon: 0.82 m up, 2.02 s in the air (Charlie Duke, Apollo 16)', () => {
    const v = pushSpeed(1, SUIT.crouch, G_MOON);
    expect(v * v / (2 * G_MOON)).toBeCloseTo(0.82, 2);
    expect(2 * v / G_MOON).toBeCloseTo(2.02, 2);
  });

  test('suited under Earth gravity, nobody leaves the ground', () => {
    expect(pushSpeed(1, SUIT.crouch, G_EARTH)).toBe(0);
  });

  test('a push weaker than your weight only stands you back up', () => {
    const e = SUIT.m * G_MOON / (SUIT.k * SUIT.F0);   // the effort that just carries your weight
    expect(pushSpeed(e * 0.99, SUIT.crouch, G_MOON)).toBe(0);
    expect(pushSpeed(e * 1.2, SUIT.crouch, G_MOON)).toBeGreaterThan(0);
  });

  test('more effort, a deeper crouch or less gravity never jumps lower', () => {
    let last = 0;
    for (let e = 0.3; e <= 1; e += 0.05) { const v = pushSpeed(e, SUIT.crouch, G_MOON); expect(v).toBeGreaterThanOrEqual(last); last = v; }
    last = 0;
    for (let d = 0.02; d <= SUIT.crouch; d += 0.01) { const v = pushSpeed(1, d, G_MOON); expect(v).toBeGreaterThanOrEqual(last); last = v; }
    expect(pushSpeed(1, SUIT.crouch, 0.06)).toBeGreaterThan(pushSpeed(1, SUIT.crouch, G_MOON));
  });

  test('never faster than the legs can extend', () => {
    expect(pushSpeed(1, SUIT.crouch, 0.001)).toBeLessThan(SUIT.V0);
  });
});

test('pace by Froude number: the Apollo crews\' 1.4 m/s lope on the Moon', () => {
  expect(Math.sqrt(SUIT.frRun * G_MOON * SUIT.L)).toBeCloseTo(1.4, 1);
});
