import type { WorldView } from '../types';
import { L4 } from '../levels';

/* Charon is at Pluto's distance from the sun, so the light is
   Pluto's and is kept in the same units, a thousand times the
   Moon's. What differs is what it falls on: grey water ice at a
   reflectance of about 0.4, four times the tholin's, so the eye
   stops down and the stars that stay out at noon on Pluto are
   fainter against it here — only the brightest survive a view with
   the ground in it. There is no air at all, so no haze and no sky.

   The ice sends two-fifths of the light back up, and with no sky
   that bounce is what fills the shadows: several times fuller than
   Pluto's, grey rather than brown. Plutoshine adds a few parts in a
   thousand of the sun, which is nothing next to it.

   Pluto stands 42° above the east-north-east horizon, 7.1° across —
   fourteen full Moons side by side — and never moves: from here the
   sun sets behind you while Pluto waits. The site is 15°S, 45° west
   of the point beneath it, on the western part of Vulcan Planitia. */
export const view: WorldView = {
  site: 'Vulcan Planitia',
  title: 'Charon Walk', sub: 'Vulcan Planitia · 0.029 g · surface unbounded',
  fine: 'Water ice at −220 °C under Pluto\'s dusk-dim sun. Pluto hangs 7° wide in<br>' +
        'the east, over a mountain standing in a moat, and never moves. A full<br>' +
        'push keeps you aloft for twelve seconds. <b>Esc</b> picks another world.',
  air: false, stars: 1,
  sunColor: 0xfff8f2, sunPower: 3.4, sunSize: 1.7, sunHDR: [60, 57, 52],
  corona: 2600, coronaColor: [1.6, 1.55, 1.45],
  hemi: [0x141518, 0x58585a, 5.0], amb: [0x000000, 0],
  fog: null, sky: null,
  grey: 176, mapTint: [0.99, 1.0, 1.01], pits: 40, grain: 0.8, clods: 0.6, pebbles: 120,
  // Charon's photometry, fitted to New Horizons and Hubble together
  // down to a two-hundredth of a degree of phase (Verbiscer et al.):
  // bright grains, a phase function more isotropic than other icy
  // moons', a surge a fraction of a degree wide, and rough — 28°.
  hapke: { w: 0.70, b: 0.25, c: 0.45, B0: 1.0, h: 0.0035, theta: 28, Bc0: 0.6, hc: 0.003 },
  micro: [0.5, 0.4, 0.4], sparkle: 1.5,
  levels: L4, fly: 400, rover: true,
  mu: 0.5,
  dustColor: 0xa8a9ab, dustDrag: 0, stampColor: 0x94979c, soil: 0xa9aaac,
  // Blocks of ice, cleaner than the regolith, most of them shed off
  // graben walls and the massif's flanks.
  rockTint: [0.98, 0.99, 1.02], rockAlb: [0.42, 0.2], rockN: 0.5, talus: 400,
  landmark: 'flag', flagColor: 0xc9ccd2,
  lander: 'generic',
  exposure: 1.0, eye: [0.30, 0.3, 20], starGain: 0.03, bloom: [0.55, 0.65, 3.0],
  companions: ['pluto'],
  // Night: Pluto, 7.1° across at albedo 0.55 — 0.2% of the sun.
  night: { ratio: 0.0021, radius: 0.062, color: 0xffe6cc, label: 'PLUTOLIT', stars: 25 },
  relay: 0.025,
  // Arrive facing Pluto and the massif under it, head raised enough
  // to hold both — yaw and pitch, in radians.
  look: [-1.32, 0.3],
};
