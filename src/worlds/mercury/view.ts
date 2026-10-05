import type { WorldView } from '../view-types';
import { L4 } from '../levels';

/* Mercury is 0.39 AU from the sun, where the disc is 1.4° across —
   two and a half times the Moon's — and delivers 6.7 times the
   light: 9 kW on every square metre, enough to hold the ground at
   noon over 400 °C. Light is kept in units 6.7 times the Moon's, so
   the numbers below read like the Moon's; only the stars, which do
   not care, are relatively that much fainter.

   There is no air, no night lamp overhead — nothing lights a
   Mercurian night but the stars and Venus — and the ground is
   brighter than the Moon's, a little over a tenth, so shadows are
   black but a shade less so. What hangs in the sky are two stars:
   Venus near opposition, the brightest thing in it after the sun, and
   Earth, with the Moon beside it if you look closely. */
export const view = {
  site: 'below Discovery Rupes',
  title: 'Mercury Walk', sub: 'Discovery Rupes · 0.377 g · surface unbounded',
  fine: 'The sun is two and a half times as wide as from the Moon and seven times as bright;<br>' +
        'at noon the ground under it would melt lead. To the east a cliff a kilometre and a<br>' +
        'half high crosses the horizon: the planet shrank, and broke. <b>Esc</b> picks another world.',
  air: false, stars: 1,
  sunColor: 0xfff8f2, sunPower: 3.4, sunSize: 145, sunHDR: [60, 57, 52],
  corona: 3400, coronaColor: [1.6, 1.55, 1.45],
  // Bounce off ground nearly twice as bright as mare basalt.
  hemi: [0x272624, 0x5f5b57, 1.7], amb: [0x000000, 0],
  fog: null, sky: null,
  grey: 108, mapTint: [1.02, 1.0, 0.965], pits: 110, grain: 1, pebbles: 170,
  // MESSENGER's photometry (Domingue et al. 2016) puts Mercury's soil
  // close to the Moon's: grains a little brighter, the same strong
  // backscatter and surge, and a little less rough.
  hapke: { w: 0.28, b: 0.22, c: 0.65, B0: 1.5, h: 0.06, theta: 17, Bc0: 0.4, hc: 0.006 },
  micro: [1, 0.45], sparkle: 0.8,
  levels: L4, fly: 400, rover: true,
  mu: 0.65,
  dustColor: 0x77736d, dustDrag: 0, stampColor: 0x5f5b56, soil: 0x67635e,
  rockTint: [1.02, 1.0, 0.97], rockAlb: [0.13, 0.09], rockN: 1,
  landmark: 'flag', flagColor: 0xc9ccd2,
  lander: 'generic',
  exposure: 1.0, eye: [0.18, 0.5, 150], starGain: 0.00018, bloom: [0.55, 0.65, 3.0],
  // Earth first: it is where the rover's dish looks.
  companions: ['earth-star', 'venus-star'],
  // Distance from the sun, AU: sets the zodiacal light (sky/stars.ts).
  zodiacal: 0.387,
} satisfies WorldView;
