/* Shared views (#w=moon&x=…): the address bar is anyone's to type into. */
import { describe, expect, test } from 'vitest';
import { type SharedView, formatView, parseView } from '../src/app/view-parse';

describe('parseView', () => {
  test('reads a link', () => {
    expect(parseView('#w=europa&x=12.5&z=-300&yaw=1.25&pitch=-0.1&sun=22.5')).toEqual(
      { w: 'europa', x: 12.5, z: -300, yaw: 1.25, pitch: -0.1, sun: 22.5, h: undefined });
    expect(parseView('w=mars&x=1&z=2&h=40')).toMatchObject({ w: 'mars', h: 40 });
  });

  test.each(['', '#', '#x=1&z=2', '#w=earth&x=1', '#w=MOON', '#w=constructor', '#w=__proto__', '#w=hasOwnProperty', '#w=toString'])(
    'no world, no view: %s', (h) => { expect(parseView(h)).toBeNull(); });

  test('a malformed number is absent, and a missing position is the origin', () => {
    const v = parseView('#w=moon&yaw=abc&pitch=&sun=NaN&h=Infinity')!;
    expect(v).toEqual({ w: 'moon', x: 0, z: 0, yaw: undefined, pitch: undefined, sun: undefined, h: undefined });
  });

  test('positions are clamped to ±100 km, where chunk vertices still resolve a centimetre', () => {
    expect(parseView('#w=moon&x=1e9&z=-250000')).toMatchObject({ x: 100000, z: -100000 });
  });
});

describe('formatView', () => {
  test('rounds to the link\'s precision: 10 cm, a milliradian, a tenth of a degree', () => {
    expect(formatView({ w: 'moon', x: 1.234, z: -5.67, yaw: 0.12345, pitch: -0.0004, sun: 12.345 }))
      .toBe('w=moon&x=1.2&z=-5.7&yaw=0.123&pitch=0&sun=12.3');
  });
  test('h only when flying', () => {
    expect(formatView({ w: 'io', x: 0, z: 0, yaw: 0, pitch: 0, sun: 10, h: 51.26 })).toMatch(/&h=51\.3$/);
  });
  test.each<SharedView>([
    { w: 'titan', x: -1234.5, z: 99999.9, yaw: -3.141, pitch: 1.2, sun: 4.5 },
    { w: 'charon', x: 0.1, z: -0.1, yaw: 0, pitch: 0, sun: -20, h: 300 },
  ])('a link reads back as the view it was made from: %o', (v) => {
    expect(parseView(formatView(v))).toEqual({ h: undefined, ...v });
  });
});
