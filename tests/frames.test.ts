/* Where each primary hangs (sky/frames.ts), as its comments say: computed
   from the site's latitude and longitude, so a change to a site moves
   these, and the comments, the views and the skylines need rechecking. */
import { describe, expect, test } from 'vitest';
import { CAL, CHARON, DIO, ENC, GAN, IAP, IOJ, JOV, MIM, MIR, PLUTO, TRI, type Vec3 } from '../src/sky/frames';

const DEG = 180 / Math.PI;
// Scene axes: x east, y up, z south.
const elevation = (v: Vec3) => Math.atan2(v[1], Math.hypot(v[0], v[2])) * DEG;
const azimuth = (v: Vec3) => (Math.atan2(v[0], -v[2]) * DEG + 360) % 360;
const COMPASS = { NE: 45, ENE: 67.5, E: 90, SW: 225 } as const;

describe.each([
  // from, toward, elevation (°), compass
  ['Europa', JOV.J, 15, 'E'],
  ['Io', IOJ.J, 40, 'ENE'],
  ['Callisto', CAL.J, 14, 'E'],
  ['Ganymede', GAN.J, 34, 'E'],
  ['Triton', TRI.J, 29, 'E'],
  ['Iapetus', IAP.J, 40, 'E'],
  ['Mimas', MIM.J, 50, 'E'],
  ['Dione', DIO.J, 33, 'SW'],
  ['Miranda', MIR.J, 38, 'NE'],
  ['Charon', PLUTO.dir, 42, 'ENE'],
] as const)('the primary from %s', (_, J, el, compass) => {
  test(`stands ${el}° up in the ${compass}`, () => {
    expect(Math.abs(elevation(J) - el)).toBeLessThan(1);
    const d = Math.abs(azimuth(J) - COMPASS[compass]);
    expect(Math.min(d, 360 - d)).toBeLessThan(22.5);
  });
  test('a unit vector', () => { expect(Math.hypot(...J)).toBeCloseTo(1, 12); });
});

test('angular sizes as quoted: Saturn from Enceladus 29°, Mimas 38°, Dione 18.4°; Uranus from Miranda 22.8°; Pluto from Charon 7.1°', () => {
  expect(2 * ENC.ang * DEG).toBeCloseTo(29, 0);
  expect(2 * MIM.ang * DEG).toBeCloseTo(38, 0);
  expect(2 * DIO.ang * DEG).toBeCloseTo(18.4, 1);
  expect(2 * MIR.ang * DEG).toBeCloseTo(22.8, 1);
  expect(2 * PLUTO.ang * DEG).toBeCloseTo(7.1, 1);
});

test('standing on Pluto rather than at its centre lowers Charon by about three degrees', () => {
  // Charon from Pluto's centre: the same site frame with no parallax is
  // the direction of +X in it, which CHARON.face points away from.
  const centre: Vec3 = [-CHARON.face[0], -CHARON.face[1], -CHARON.face[2]];
  expect(elevation(centre) - elevation(CHARON.dir)).toBeCloseTo(3, 0);
});

describe.each([['JOV', JOV], ['IOJ', IOJ], ['GAN', GAN], ['CAL', CAL], ['IAP', IAP], ['ENC', ENC], ['MIM', MIM], ['DIO', DIO], ['MIR', MIR]] as const)(
  '%s: the orbit frame', (_, f) => {
    const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    test('X, Y, Z orthonormal and right-handed', () => {
      for (const v of [f.X, f.Y, f.Z]) expect(dot(v, v)).toBeCloseTo(1, 12);
      expect(dot(f.X, f.Y)).toBeCloseTo(0, 12);
      expect(dot(f.Y, f.Z)).toBeCloseTo(0, 12);
      expect(dot(f.Z, f.X)).toBeCloseTo(0, 12);
      cross(f.X, f.Y).forEach((c, i) => expect(c).toBeCloseTo(f.Z[i]!, 12));   // i < 3
    });
    test('the primary lies opposite X, give or take the observer\'s parallax', () => {
      expect(-dot(f.J, f.X)).toBeGreaterThan(Math.cos(0.5 / DEG));
    });
  });
