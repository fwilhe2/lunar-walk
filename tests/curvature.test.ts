/* The curvature drop (kernel/curvature.ts) and the levelled landing site. */
import { describe, expect, test } from 'vitest';
import { CF0, craterAt, craterField } from '../src/kernel/craters';
import { CURVE_D0, curveDrop } from '../src/kernel/curvature';
import { TERRAINS, setWorld } from '../src/worlds/terrains';

const IDS = Object.keys(TERRAINS) as (keyof typeof TERRAINS)[];

describe('curveDrop', () => {
  test('flat inside the cap, where the player always stands (181 m from the anchor at most)', () => {
    setWorld('deimos');
    expect(CURVE_D0).toBeGreaterThan(181 * 1.5);
    for (let a = 0; a < 6.3; a += 0.3) expect(curveDrop(Math.cos(a) * 181, Math.sin(a) * 181)).toBe(0);
  });

  test('(d² − D0²) / 2R past it, with no step at the cap', () => {
    setWorld('moon');
    const R = TERRAINS.moon.Rc || TERRAINS.moon.R;
    expect(curveDrop(3000, 4000)).toBeCloseTo((5000 ** 2 - CURVE_D0 ** 2) / (2 * R), 9);
    expect(curveDrop(CURVE_D0 + 1e-6, 0)).toBeCloseTo(0, 9);
  });

  test('on the Moon the cap moves the whole profile by 46 mm', () => {
    setWorld('moon');
    const R = TERRAINS.moon.Rc || TERRAINS.moon.R;
    expect(40000 ** 2 / (2 * R) - curveDrop(40000, 0)).toBeCloseTo(0.046, 3);
  });

  test('on Phobos the streamed edge at 3.5 km still sits half a kilometre down', () => {
    setWorld('phobos');
    expect(curveDrop(3500, 0)).toBeGreaterThan(450);
  });

  test('on Venus the ground climbs: refraction bends light more tightly than the planet curves', () => {
    setWorld('venus');
    expect(curveDrop(5000, 0)).toBeLessThan(0);
  });

  test('each world drops on its own radius, whatever came before', () => {
    setWorld('moon'); const moon = curveDrop(10000, 0);
    setWorld('phobos'); setWorld('moon');
    expect(curveDrop(10000, 0)).toBe(moon);
  });
});

/* Inside 12 m of the site the crater field is held at its value there,
   so every world lands you on level ground — re-levelled per world. */
describe.each(IDS)('%s: spawn fade', (id) => {
  test('the crater field is flat within 12 m of the site', () => {
    setWorld(id === 'moon' ? 'mars' : 'moon');   // come from another world
    setWorld(id);
    expect(CF0).toBe(craterField(0, 0));
    for (let a = 0; a < 6.3; a += 0.7) for (const r of [0, 3, 8, 11.9]) expect(craterAt(Math.cos(a) * r, Math.sin(a) * r)).toBe(CF0);
  });
});
