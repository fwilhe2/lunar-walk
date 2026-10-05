/* Hapke photometry: the JS copy that normalises every parameter set and
   fills the low tiers' 32³ table (surface/hapke.ts). */
import * as THREE from 'three';
import { describe, expect, test } from 'vitest';
import { DEG, type HapkeParams, hapkeJS, hapkeUniforms, setHapke } from '../src/surface/hapke';
import { VIEW, WORLD_IDS } from '../src/worlds/index';

// A geometry: incidence, emission, and the azimuth between them, in degrees.
const geom = (i: number, e: number, az: number) => {
  const mu0 = Math.cos(i * DEG), mu = Math.cos(e * DEG);
  const cosg = mu0 * mu + Math.sin(i * DEG) * Math.sin(e * DEG) * Math.cos(az * DEG);
  return [mu0, mu, cosg] as const;
};

// Every set a world draws with: the ground's, and the print and rock
// sets app/worlds.ts derives from it.
const sets = WORLD_IDS.flatMap((id): [string, HapkeParams][] => {
  const hp = VIEW[id].hapke;
  return [
    [id, hp],
    [id + ' print', { ...hp, B0: hp.B0 * 0.3, Bc0: hp.Bc0 * 0.3 }],
    [id + ' rock', { ...hp, B0: hp.B0 * 0.5, Bc0: hp.Bc0 * 0.5, c: hp.c * 0.6, theta: hp.theta + 8 }],
  ];
});

describe.each(sets)('%s', (_, p) => {
  test('finite and non-negative over every geometry the ground can see', () => {
    for (let i = 0; i < 89; i += 4) {
      for (let e = 0; e < 89; e += 4) {
        for (let az = 0; az <= 180; az += 15) {
          const r = hapkeJS(...geom(i, e, az), p);
          expect(Number.isFinite(r) && r >= 0, `i ${i} e ${e} az ${az}: ${r}`).toBe(true);
        }
      }
    }
  });

  test('normalised to Lambert at i = 30°, e = 0°, g = 30°', () => {
    const u = hapkeUniforms();
    setHapke(u, p);
    expect(hapkeJS(...geom(30, 0, 0), p) * u.hpkN.value).toBeCloseTo(Math.cos(30 * DEG) / Math.PI, 12);
  });

  // The table as the shader reads it (glsl/hapke.glsl, HPK_LUT): x = mu0,
  // y = mu, z = √(g/π), texel-centred, trilinear.
  test('the table, read as the shader reads it, is the function', () => {
    const u = hapkeUniforms();
    setHapke(u, p);
    // three types a 3D texture's data as 8-bit; hapkeLut() fills it with half floats
    const tex = u.hpkLut.value!, N = tex.image.width, data = tex.image.data as unknown as Uint16Array;
    const at = (i: number, j: number, k: number) => THREE.DataUtils.fromHalfFloat(data[(k * N + j) * N + i]!);   // in range: clamped below
    const sample = (x: number, y: number, z: number) => {
      const c = [x, y, z].map((v) => Math.min(N - 1, Math.max(0, v * (N - 1))));
      const [i0, j0, k0] = c.map((v) => Math.min(N - 2, Math.floor(v))) as [number, number, number];
      const [fx, fy, fz] = [c[0]! - i0, c[1]! - j0, c[2]! - k0];
      let r = 0;
      for (const [di, wx] of [[0, 1 - fx], [1, fx]] as const)
        for (const [dj, wy] of [[0, 1 - fy], [1, fy]] as const)
          for (const [dk, wz] of [[0, 1 - fz], [1, fz]] as const) r += wx * wy * wz * at(i0 + di, j0 + dj, k0 + dk);
      return r;
    };
    let worst = 0;
    for (let i = 5; i < 80; i += 7) {
      for (let e = 3; e < 80; e += 7) {
        for (let az = 10; az <= 180; az += 30) {
          const [mu0, mu, cosg] = geom(i, e, az);
          const want = hapkeJS(mu0, mu, cosg, p) * u.hpkN.value;
          const got = sample(mu0, Math.max(mu, 0.02), Math.sqrt(Math.acos(cosg) / Math.PI));
          worst = Math.max(worst, Math.abs(got - want) / Math.max(want, 0.02));
        }
      }
    }
    expect(worst).toBeLessThan(0.08);
  });
});

/* What the model is there for (the comment at the top of surface/hapke.ts). */
describe('lunar photometry', () => {
  const p = VIEW.moon.hapke;
  test('no limb darkening at full Moon: at zero phase the disc is flat to 15%', () => {
    const r = [0, 20, 40, 60, 70].map((t) => hapkeJS(...geom(t, t, 0), p));
    expect(Math.max(...r) / Math.min(...r)).toBeLessThan(1.15);
  });
  test('the opposition surge: zero phase is brighter than 5° by over 40% (shadow-hiding; coherent backscatter alone gives ~23%)', () => {
    expect(hapkeJS(...geom(30, 30, 0), p) / hapkeJS(...geom(30, 25, 0), p)).toBeGreaterThan(1.4);
  });
  test('down-sun is brighter than up-sun, at the same incidence and emission', () => {
    expect(hapkeJS(...geom(60, 60, 0), p)).toBeGreaterThan(2 * hapkeJS(...geom(60, 60, 180), p));
  });
});
