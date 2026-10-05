import type { WorldView } from '../view-types';
import { L4 } from '../levels';

/* Miranda is 19.2 AU out: 3.7 W/m², from a sun 1.7 arcminutes across.
   Light in Titan's units, a hundred times the Moon's; the ground is
   grey ice at 0.3, so its radiance sits near the Moon's.

   Uranus is 129,000 km off, 22.8° across — forty-five full Moons —
   38° up in the north-east from the site (35°S, 40° west of the point
   beneath it), over the scarp, and never moves. Miranda orbits in
   Uranus's equator, 4.3° out of it at most, so the rings are a dark
   thread nearly edge-on. Ariel, Umbriel, Titania and Oberon go round
   outside, Ariel as much as a degree across. At 0.008 g walking is
   out of the question, so the suit has jets and the beacon. */
export const view = {
  site: 'Inverness Corona',
  title: 'Miranda Walk', sub: 'Inverness Corona · 0.008 g · surface unbounded',
  fine: 'A moon broken and put back together badly: banded coronae against old cratered ground,<br>' +
        'and to the north-east a cliff six kilometres high. Uranus fills 23° of the sky over it.<br>' +
        'A full push would keep you up for nearly a minute: use the jets. <b>Esc</b> picks another world.',
  air: false, stars: 1,
  sunColor: 0xfff8f2, sunPower: 0.92, sunSize: 2.9, sunHDR: [60, 57, 52],
  corona: 2000, coronaColor: [0.68, 0.66, 0.62],
  hemi: [0x1a1a1b, 0x4a4a4b, 2.0], amb: [0x000000, 0],
  fog: null, sky: null,
  grey: 160, mapTint: [0.99, 1.0, 1.01], pits: 30, grain: 0.7, clods: 0.6, pebbles: 70,
  // Uranian satellite photometry (Buratti & Mosher 1991): moderately
  // bright grains, backscattering, rough.
  hapke: { w: 0.55, b: 0.30, c: 0.60, B0: 1.0, h: 0.04, theta: 25, Bc0: 0.35, hc: 0.005 },
  micro: [0.5, 0.4, 0.45], sparkle: 1.5,
  levels: L4, fly: 400, rover: false, jets: true,
  mu: 0.5,
  dustColor: 0x8c8c8c, dustDrag: 0, stampColor: 0x777779, soil: 0x8a8a8b,
  rockTint: [0.99, 1.0, 1.01], rockAlb: [0.35, 0.15], rockN: 0.4,
  landmark: 'beacon', flagColor: 0xb9bcc2,
  lander: 'generic',
  exposure: 1.0, eye: [0.2, 0.05, 15], starGain: 0.04, bloom: [0.55, 0.65, 3.0],
  companions: ['uranus-mir', 'ariel-mir', 'umbriel-mir', 'titania-mir', 'oberon-mir'],
  // Night: Uranus, 22.8° across at albedo 0.49 — 1.8% of the sun.
  night: { ratio: 0.0183, radius: 0.199, color: 0xe2f4f6, label: 'URANUSLIT', stars: 10 },
  relay: 0.05,
  look: [-0.97, 0.42],
} satisfies WorldView;
