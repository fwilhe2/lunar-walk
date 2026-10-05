import type { WorldView } from '../types';
import { L4 } from '../levels';

/* Enceladus is 9.5 AU out: 15 W/m², a ninetieth of the Moon's, from
   a sun 3.4 arcminutes across — still a disc, just. Light is kept in
   Europa's units, ten times the Moon's. What it falls on is the
   brightest surface in the solar system, fresh snow fallen back from
   the jets, so the eye stops right down and the snow reads white, and
   the shadows fill from it more than anywhere else — a quarter of the
   lit ground, blue-grey only where the bluer stripe ice lights them.

   Saturn is 29° across in the north-east, the rings a razor line
   through it because Enceladus orbits in their plane; their shadow
   lies across the globe. Tethys, Dione, Rhea and Titan wander along
   that line, and Mimas crosses the disc. Along the tiger stripe five
   kilometres north the jets stand in a curtain, bright only toward
   the sun. At a ninth of the Moon's gravity walking is a slow shuffle
   and a jump lasts half a minute, so the suit carries jets, as on
   the Martian moons, with a beacon to recharge them. */
/* Titan is 9.5 AU out, like Enceladus, but under 1.5 bar of
   nitrogen and a haze 300 km deep. The haze absorbs blue and scatters
   the rest, so what reaches the ground is orange, almost all of it
   diffuse, and about a thousandth of Earth's daylight — Huygens'
   lamp was for colour, not for light (Tomasko et al. 2005). The sun
   shows only as a brighter part of the sky, the ground casts no
   shadow you could see, and Saturn, which stands in this sky and
   never moves, is lost in the haze at every visible wavelength.

   Light is kept in units a hundred times the Moon's: the top of the
   atmosphere gets 3.8, the ground about a tenth of that, nearly all
   of it from the sky, so the hemisphere carries it and the sun's
   term is the last few per cent of direct beam.

   Ligeia Mare's southern shore, at 78° N in the summer the northern
   seas were seen in: the sun stands low, here 16°. You land at the
   head of a bay, with a plateau across it. The liquid level is
   height 0; see hTitan(). */
export const view: WorldView = {
  site: 'Ligeia Mare',
  title: 'Titan Walk', sub: 'Ligeia Mare · 0.138 g · surface unbounded',
  fine: 'One and a half bar of nitrogen at −179 °C, under a haze that lets through a thousandth<br>' +
        'of Earth\'s daylight, all of it orange and none of it from a visible sun. The bay in<br>' +
        'front of you is liquid methane: walk in. <b>Esc</b> picks another world.',
  air: true, stars: 0, noSun: true, shadows: false, skyLit: true,
  sunColor: 0xffb46a, sunPower: 0.05, sunSize: 5.9, sunHDR: [1, 1, 1],
  corona: 1, coronaColor: [1, 1, 1],
  hemi: [0xffaa58, 0x24170b, 1.8], amb: [0xb07038, 0.08],
  // The lower atmosphere is clearer than the haze over it: Huygens
  // saw the ground sharply from 8 km up. Distance still goes orange
  // over tens of kilometres.
  fog: { density: 3.6e-5 },
  sky: { zenith: [0.135, 0.068, 0.020], horizon: [0.20, 0.112, 0.042],
         aureole: [0.30, 0.19, 0.08], k: 4, amt: 0.30 },
  // Organic sediment, wet with methane and sorted by it: fine, smooth,
  // few pits — rain and the haze's fallout fill them in.
  grey: 92, mapTint: [1.02, 0.98, 0.92], pits: 14, grain: 0.55, clods: 0.2, pebbles: 25,
  // No opposition to surge toward under light from the whole sky.
  hapke: { w: 0.45, b: 0.20, c: 0.30, B0: 0, h: 0.10, theta: 14, Bc0: 0, hc: 0.01 },
  micro: [0, 0], sparkle: 0,
  levels: L4, fly: 400, rover: true, roverDrag: 0.028,
  mu: 0.6,
  // ½ρC_dA/m for a suited walker in 5.3 kg/m³ of nitrogen, and the
  // weight that air holds up — both small at a walk.
  drag: 0.0124, buoy: 0.008,
  medium: { air: 0.9, lp: 7000, wind: 0.12, windLP: 220 },
  dustColor: 0x5c4834, dustDrag: 24, dustLife: 3.0, stampColor: 0x3a2c20, soil: 0x5a4632,
  // Water ice, rounded by rolling, under a film of the organics: a
  // little brighter and greyer than the sand they lie in.
  rockTint: [1.0, 0.95, 0.88], rockAlb: [0.42, 0.2], rockN: 0.25, rockRound: true,
  cobbles: { patches: 160, per: 45, r: 5, size: [0.03, 0.17] }, rockMax: 5000,
  landmark: 'flag', flagColor: 0xd8d2c4,
  lander: 'generic',
  exposure: 1.0, eye: [0.16, 0.3, 14], tone: 'aces', bloom: [0.2, 0.75, 3.0],
  companions: [],
  sea: 0,
  look: [Math.PI, -0.03],
};
