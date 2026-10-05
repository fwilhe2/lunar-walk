import type { WorldView } from '../view-types';
import { L4 } from '../levels';

/* Callisto is at Jupiter's distance from the sun, so the light is
   Europa's and in Europa's units, ten times the Moon's. It falls on
   ground a third as reflective as Europa's ice — a dark lag, about
   0.2, frosted bright on knobs and poleward slopes — so the shadows
   fill less, and the eye opens wider.

   This is where a crewed mission to Jupiter would land: Callisto
   orbits outside the radiation belts that make Io and Europa lethal,
   and its surface dose is about what the Moon's is, from cosmic rays
   (NASA's HOPE study, Troutman et al. 2003). Jupiter is 4.4° across,
   eight full Moons, 14° over the eastern horizon from the site
   (15°N, 75°W, on Valhalla's outer rings), and never moves. Io,
   Europa and Ganymede all orbit inside Callisto, so all three cross
   Jupiter's face from here, and go behind it. */
export const view = {
  site: 'Valhalla',
  title: 'Callisto Walk', sub: 'Valhalla · 0.126 g · surface unbounded',
  fine: 'The oldest surface in the solar system: craters on craters, worn down by the sun<br>' +
        'until only knobs of frost are left of their rims. Jupiter hangs 4° wide over<br>' +
        'Valhalla\'s rings to the east, its moons crossing it. <b>Esc</b> picks another world.',
  air: false, stars: 1,
  sunColor: 0xfff8f2, sunPower: 1.26, sunSize: 10.7, sunHDR: [60, 57, 52],
  corona: 2000, coronaColor: [0.68, 0.66, 0.62],
  // Bounce off ground twice the Moon's reflectance, in these units.
  hemi: [0x181716, 0x4a4642, 1.6], amb: [0x000000, 0],
  fog: null, sky: null,
  grey: 150, mapTint: [1.03, 1.0, 0.95], pits: 30, grain: 0.7, clods: 0.6, pebbles: 60,
  // Callisto's photometry (Domingue & Verbiscer 1997): dark,
  // backscattering grains, a broad surge, and rougher than any other
  // Galilean surface — the lag between the frost is a rubble.
  hapke: { w: 0.42, b: 0.30, c: 0.60, B0: 1.0, h: 0.05, theta: 30, Bc0: 0.35, hc: 0.006 },
  micro: [0.6, 0.4, 0.55], sparkle: 1.2,
  levels: L4, fly: 400, rover: true,
  mu: 0.55,
  dustColor: 0x5e5650, dustDrag: 0, stampColor: 0x4a4440, soil: 0x5a524c,
  // Few blocks survive: the same sublimation that turns rims to knobs
  // crumbles the ice-cemented blocks around young craters.
  rockTint: [1.05, 1.0, 0.94], rockAlb: [0.22, 0.12], rockN: 0.5,
  landmark: 'flag', flagColor: 0xc9ccd2,
  lander: 'generic',
  // Stars dimmer than Europa's: the gain was never physical, and with
  // the eye open this much wider for the dark ground they would show
  // by day, which on an airless world they only do out at Pluto.
  exposure: 1.0, eye: [0.24, 0.05, 15], starGain: 0.004, bloom: [0.5, 0.65, 3.0],
  companions: ['jupiter-cal', 'io-cal', 'europa-cal', 'ganymede-cal'],
  // Night: Jupiter, 4.35° across at albedo 0.52 — 0.075% of the sun.
  night: { ratio: 7.5e-4, radius: 0.0380, color: 0xfff0dc, label: 'JUPITERLIT', stars: 40 },
  relay: 0.14,
  look: [-1.64, 0.12],
  // Distance from the sun, AU: sets the zodiacal light (sky/stars.ts).
  zodiacal: 5.2,
} satisfies WorldView;
