import type { WorldView } from '../view-types';
import { L4 } from '../levels';

/* Io is at Jupiter's distance from the sun, so the light is
   Europa's and kept in Europa's units, ten times the Moon's. The
   ground is nearly as bright as Europa's ice — sulphur and frost at
   a reflectance of about 0.6 — and yellow, so the shadows fill warm
   from the bounce. Io has an atmosphere, but a nanobar of SO₂ that
   freezes out every night does nothing to the light: the sky is
   black.

   Jupiter is 19.5° across from here and never moves, 40° up in the
   east-north-east, over a mountain seven kilometres high. The other
   three moons go round outside Io's orbit and behind Jupiter. Two
   plumes are up: a Prometheus-type 90 km high over the northern
   horizon, and far to the west a giant like Pele's, 300 km high,
   most of it below the horizon, glowing where it stands toward the
   sun. And the radiation: Io orbits inside the densest part of
   Jupiter's belts, and the surface dose is about 36 Sv a day. */
export const view = {
  site: 'near Kanehekili Fluctus',
  title: 'Io Walk', sub: 'Kanehekili Fluctus · 0.183 g · surface unbounded',
  fine: 'Sulphur and frozen SO₂ over a crust four hundred volcanoes remake so fast that not<br>' +
        'one impact crater survives. Jupiter fills 19° of the sky; plumes stand over the horizon.<br>' +
        'The dose is 36 Sv a day: a lethal one in three hours. <b>Esc</b> picks another world.',
  air: false, stars: 1,
  sunColor: 0xfff8f2, sunPower: 1.26, sunSize: 10.7, sunHDR: [60, 57, 52],
  corona: 2000, coronaColor: [0.68, 0.66, 0.62],
  // Bounce off bright yellow ground, much as on Europa's ice.
  hemi: [0x181610, 0x3a3624, 8.5], amb: [0x000000, 0],
  fog: null, sky: null,
  grey: 200, mapTint: [1.0, 0.985, 0.95], pits: 20, grain: 0.7, clods: 0.7, pebbles: 70,
  // Io's photometry (Simonelli & Veverka 1986; Domingue & Verbiscer
  // 1997): bright grains, a modest surge, and rough — the roughest of
  // the Galilean surfaces.
  hapke: { w: 0.88, b: 0.30, c: 0.60, B0: 0.9, h: 0.04, theta: 30, Bc0: 0.3, hc: 0.005 },
  micro: [0.3, 0.3, 0.45], sparkle: 1.2,
  levels: L4, fly: 400, rover: true,
  mu: 0.55,
  dustColor: 0xcfc390, dustDrag: 0, stampColor: 0xb3a36e, soil: 0xc8bb88,
  // Silicate blocks shed off the mountains and patera walls, under a
  // film of the sulphur that falls on everything.
  rockTint: [1.0, 0.9, 0.72], rockAlb: [0.30, 0.2], rockN: 0.4, talus: 500,
  landmark: 'flag', flagColor: 0xc9ccd2,
  lander: 'generic',
  // ACES, as on Mars: AgX gives away the saturation in the highlights,
  // and here that is the yellow of the sulphur.
  exposure: 1.0, eye: [0.30, 0.05, 15], starGain: 0.012, bloom: [0.5, 0.65, 3.0], tone: 'aces',
  companions: ['jupiter-io', 'europa-io', 'ganymede-io', 'callisto-io'],
  // Night: Jupiter, 19.5° across at albedo 0.52 — 1.5% of the sun.
  night: { ratio: 0.0149, radius: 0.170, color: 0xfff0dc, label: 'JUPITERLIT', stars: 12 },
  relay: 0.14,
  dose: 36,
  // The plumes, as bearing (°) and distance from the landing site.
  plumes: [
    { brg: 22, dist: 170000, H: 90000, W: 130000, shell: 0.05, column: 0.8, col: [0.78, 0.86, 1.0], gain: 0.06 },
    { brg: 262, dist: 700000, H: 320000, W: 550000, shell: 0.08, column: 0.15, col: [0.95, 0.80, 0.65], gain: 0.008 },
  ],
  // Arrive facing Jupiter and the mountain under it.
  look: [-1.2, 0.3],
  // Distance from the sun, AU: sets the zodiacal light (sky/stars.ts).
  zodiacal: 5.2,
} satisfies WorldView;
