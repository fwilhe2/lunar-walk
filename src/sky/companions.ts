import * as THREE from 'three';
import { hdrSqueeze } from '../render/hdr';
import { SUN_DIR } from '../render/lights';
import { scene } from '../render/renderer';
import { charonMaps } from './bodies/charon';
import { earthMaps } from './bodies/earth';
import { galileanMaps } from './bodies/galilean';
import type { GalileanMoon } from './bodies/galilean.pixels';
import { jupiterMaps } from './bodies/jupiter';
import { MARS_H, MARS_W, marsMaps } from './bodies/mars';
import { moonletMaps } from './bodies/moonlets';
import { neptuneMaps } from './bodies/neptune';
import { plutoMaps } from './bodies/pluto';
import { RING_TAU, saturnMaps, saturnMoonMaps } from './bodies/saturn';
import { URING_KM, uranusMaps } from './bodies/uranus';
import type { BodyMaps } from './bodies/types';
import { venusMaps } from './bodies/venus';
import { skyDome } from './dome';
import { CAL, CHARON, COMPANION_AIM, COMPANION_DIST, DIO, ENC, GAN, IAP, IOJ, JOV, MIM, MIR, PLUTO, TRI, type OrbitFrame, type Vec3 } from './frames';
import { skyDepth } from './sun';
import { DEG } from '../surface/hapke';
import { offThread } from '../util/texgen';
import type { RGB } from '../worlds/view-types';
import { world } from '../worlds/index';

const TEXGEN = {
  earth: earthMaps, mars: marsMaps,
  phobos: () => moonletMaps('phobos'), deimos: () => moonletMaps('deimos'),
  jupiter: jupiterMaps, io: () => galileanMaps('io'), charon: charonMaps, pluto: plutoMaps, venus: venusMaps,
  saturn: saturnMaps, titan: () => saturnMoonMaps('titan'), tethys: () => saturnMoonMaps('tethys'),
  dione: () => saturnMoonMaps('dione'), rhea: () => saturnMoonMaps('rhea'), mimas: () => saturnMoonMaps('mimas'),
  ganymede: () => galileanMaps('ganymede'), callisto: () => galileanMaps('callisto'), europa: () => galileanMaps('europa'),
  neptune: neptuneMaps, uranus: uranusMaps,
  ariel: () => saturnMoonMaps('ariel'), umbriel: () => saturnMoonMaps('umbriel'),
  titania: () => saturnMoonMaps('titania'), oberon: () => saturnMoonMaps('oberon'),
  enceladus: () => saturnMoonMaps('enceladus'),
} satisfies Record<string, () => BodyMaps>;
/** A body whose maps can be drawn: a key of the generators above. */
type TexKey = keyof typeof TEXGEN;
const texCache = new Map<TexKey, BodyMaps>();
// Maps whose costly part can run off the main thread: built ahead of
// the companion that needs them (companionsAsync), then cached here.
const TEXGEN_OFF: Partial<Record<TexKey, () => Promise<BodyMaps>>> = {
  jupiter: () => offThread('jupiterPixels', 1024, 512).then(jupiterMaps),
  mars: () => offThread('marsPixels', MARS_W, MARS_H).then(marsMaps),
  ...Object.fromEntries((['io', 'europa', 'ganymede', 'callisto'] satisfies GalileanMoon[]).map((k) =>
    [k, () => offThread('galileanPixels', k).then((px) => galileanMaps(k, px))])),
  charon: () => offThread('charonPixels').then(charonMaps),
  pluto: () => offThread('plutoPixels').then(plutoMaps),
  neptune: () => offThread('neptunePixels', 512, 256).then(neptuneMaps),
  uranus: () => offThread('uranusPixels', 512, 256).then(uranusMaps),
};
function bodyTex(k: TexKey) {
  let t = texCache.get(k);
  if (!t) texCache.set(k, t = TEXGEN[k]());
  return t;
}

/* How a body in the sky is drawn and where it hangs. r is its radius in
   scene units on the COMPANION_DIST shell (1 for kepler ones, whose
   group is scaled from their true distance); dir, tilt, pole and face
   are scene directions and Euler angles; the rest switch on parts of
   the globe's shader. */
interface CompanionBase {
  tex: TexKey; r: number; gain: number; bright?: number;
  dir?: Vec3; tilt?: Vec3; pole?: Vec3; face?: Vec3;
  oblate?: number; spin?: number; limb?: number;
  clouds?: true; night?: true; ocean?: true;
  // relief: vertical exaggeration of the elevation map, which holds
  // heights in equatorial texel widths (bodies/mars.ts), so 1 is true
  // slope. detail: albedo mottling finer than the map; detailBump: how
  // much the same noise bends the normal.
  relief?: number; detail?: number; detailScale?: number; detailBump?: number;
  rings?: [number, number];
  // Swings dir about axis (Phobos and Deimos from Mars).
  orbit?: { rate: number; axis: Vec3 };
  kepler?: Kepler;
}
/** A moon placed each tick from the two orbits (a, R in km) in a frame
    (JOV unless given): see makeCompanion(). */
interface Kepler { a: number; R: number; rate: number; phase: number; frame?: OrbitFrame }
// The shell off the limb and the veil over the disc each come with
// their strength, or not at all.
type Atmo = { atmo: RGB; atmoK: number; atmoR?: number } | { atmo?: never; atmoK?: never; atmoR?: never };
type Haze = { haze: RGB; hazeK: number; hazeTau?: number } | { haze?: never; hazeK?: never; hazeTau?: never };
type CompanionSpec = CompanionBase & Atmo & Haze;

/* Mars's pole from Phobos and Deimos. Both orbit within a degree or
   three of its equator, so from either the planet is seen equator-on:
   the pole lies square to the line of sight. Which way round it leans
   depends on where on the moon you stand; here north is up, as near
   the zenith as square to the sight line allows. */
const equatorOn = (d: Vec3): Vec3 => {
  const n = Math.hypot(d[0], d[1], d[2]), u = d[1] / n;
  return [-d[0] / n * u, 1 - u * u, -d[2] / n * u];
};

const COMPANIONS = {
  /* Earth from the Moon is 1.9° across, and drawn so: four Moons'
     worth of our own sky, a small bright marble — the long lens (Z)
     is there for a closer look. It was drawn 2.5 times too big until
     the lens existed. Placed well away from the sun's side of the sky,
     which is what makes it a fat gibbous rather than a thin crescent. */
  earth: {
    tex: 'earth', r: COMPANION_DIST * Math.tan(Math.asin(6371 / 384400)), dir: [0.86, 0.42, -0.29], tilt: [0, -1.08, 0.409],
    spin: 0.0145, gain: 1.45, clouds: true, night: true, ocean: true, bright: 0.22,
    atmo: [0.28, 0.52, 1.0], atmoK: 0.9, haze: [0.22, 0.42, 0.95], hazeK: 0.85,
  },

  /* Mars from Phobos, 6,000 km up: 42° of sky, drawn at true size
     because it does not need any help. Phobos is tidally locked,
     so Mars hangs in one place and never rises or sets — but it
     turns underneath, one Martian day in 24h37m against the 7h39m
     it takes Phobos to go round.

     Placed anti-sunward, for the same reason Earth is: a body
     sitting on the sun's side of the sky shows you its night, and
     42° of unlit Mars is 42° of nothing. From here it is gibbous. */
  'mars-big': {
    tex: 'mars', r: 2405, dir: [0.62, 0.70, 0.35], pole: equatorOn([0.62, 0.70, 0.35]),
    spin: 0.0062, gain: 1.25,
    relief: 1.6, detail: 0.14, detailScale: 1.4, detailBump: 0.18,
    atmo: [0.95, 0.62, 0.44], atmoK: 0.30, atmoR: 1.012,
    haze: [0.40, 0.42, 0.50], hazeK: 0.34,
  },
  // The same from Deimos, four times further out: 16.6°.
  'mars-mid': {
    tex: 'mars', r: 904, dir: [0.66, 0.55, 0.51], pole: equatorOn([0.66, 0.55, 0.51]),
    spin: 0.0062, gain: 1.25,
    relief: 1.6, detail: 0.12, detailScale: 1.4, detailBump: 0.18,
    atmo: [0.95, 0.62, 0.44], atmoK: 0.30, atmoR: 1.012,
    haze: [0.40, 0.42, 0.50], hazeK: 0.34,
  },

  /* Phobos from Mars is 0.20° at the zenith — a third the width of
     our Moon and never full, since it is eclipsed by Mars's shadow
     on most passes. Drawn at true size, as Earth is from the Moon.
     It crosses the sky westward in about four hours; here it takes
     a hundred seconds, and Deimos keeps the real ratio to it. */
  phobos: {
    tex: 'phobos', r: COMPANION_DIST * Math.tan(0.10 * DEG), dir: [0.70, 0.50, 0.51], gain: 1.3,
    orbit: { rate: 0.0628, axis: [0.24, 0.34, 0.91] },
  },
  /* Deimos from Mars is 2 arcminutes: a bright star, not a disc.
     It is drawn a little over life size only so it survives being
     rasterised at all, and it barely moves — near-areostationary,
     it takes two and a half days to cross from rise to set. */
  deimos: {
    tex: 'deimos', r: 8, dir: [0.35, 0.72, 0.60], gain: 1.3,
    orbit: { rate: 0.0052, axis: [0.24, 0.34, 0.91] },
  },
  // Each moon from the other: 14,000 km apart at closest approach,
  // so each is a moving point of light in the other's sky.
  'phobos-far': {
    tex: 'phobos', r: 9, dir: [0.66, 0.45, 0.60], gain: 1.3,
    orbit: { rate: 0.021, axis: [0.10, 0.36, 0.93] },
  },
  'deimos-far': {
    tex: 'deimos', r: 7, dir: [0.30, 0.66, 0.69], gain: 1.3,
    orbit: { rate: 0.013, axis: [0.10, 0.36, 0.93] },
  },

  /* Jupiter from Europa: 12.2° across, at true size, flattened by
     its own spin to 0.935 at the poles. It never moves, but its
     equator lies along the great circle its moons travel, and from
     a site this far round from the point beneath it, that circle
     climbs almost straight up out of the eastern horizon — so the
     bands stand nearly on end, and the Red Spot is carried downward
     across the disc as Jupiter turns, not sideways. Only from near
     the line through Europa's poles and the sub-Jovian point would
     the bands lie level.

     Jupiter turns in 9h55m; here it turns in nine minutes, which is
     a smaller exaggeration than the moons get. Its limb darkens
     less than a matte ball's would (Minnaert k = 0.85), because it
     is cloud, and its terminator is softened by its own air.

     Its brightness is the physical one: sunlight on an albedo like
     the ice you stand on, so it hangs as bright as the ground. */
  jupiter: {
    tex: 'jupiter', r: 660, dir: JOV.J, pole: JOV.Z, oblate: 0.9351, spin: 0.012,
    gain: 1.0, bright: 0.5, limb: 0.85,
    atmo: [0.50, 0.55, 0.70], atmoK: 0.10, atmoR: 1.006,
  },
  /* The other three, at their true sizes and distances as they move:
     each is placed where the geometry of the two orbits puts it, so
     Io swings out to 39° from Jupiter and back, grows to 0.84° as it
     passes in front of the disc and shrinks to 0.19° behind it, and
     Ganymede and Callisto go right round the sky along the same arc.
     A cycle that takes Io 3.5 days takes ten minutes here; Ganymede
     and Callisto keep the real ratios to it. */
  io: {
    tex: 'io', r: 1, gain: 1.0, bright: 0.5,
    kepler: { a: 421700, R: 1821.6, rate: 0.0105, phase: 0.35 },
  },
  ganymede: {
    tex: 'ganymede', r: 1, gain: 1.0, bright: 0.5,
    kepler: { a: 1070400, R: 2634.1, rate: 0.00525, phase: 1.0 },
  },
  callisto: {
    tex: 'callisto', r: 1, gain: 1.0, bright: 0.5,
    kepler: { a: 1882700, R: 2410.3, rate: 0.0082, phase: 2.0 },
  },

  /* Charon from Pluto: 3.65° across, at true size, 27° over the
     eastern horizon. Its north, and Pluto's, points along the
     horizon, so Mordor's red cap sits on its left-hand limb and the
     canyon belt runs up and down the disc. Its brightness is the
     physical one: an albedo of 0.4 in the same sunlight as ground at
     0.1, so it is the brightest thing in the sky but the sun. */
  charon: {
    tex: 'charon', r: COMPANION_DIST * Math.sin(CHARON.ang), dir: CHARON.dir, pole: CHARON.pole,
    face: CHARON.face, gain: 1.0, bright: 1.08,
  },

  /* Pluto from Charon: 7.1° across, at true size, 42° up in the
     east-north-east. Its north points along the horizon to the left
     and a little down, so the polar cap is on the left-hand limb and
     the dark belt runs up and down the disc. The brightness is the
     physical one, calibrated the same way as Charon's: the map holds
     albedos, from 0.08 in the maculae to 0.9 on the brightest ice.
     The haze is a thin blue ring at the limb, faint from this side of
     the sun — it scatters forward, and shines only when backlit. */
  pluto: {
    tex: 'pluto', r: COMPANION_DIST * Math.sin(PLUTO.ang), dir: PLUTO.dir, pole: PLUTO.pole,
    face: PLUTO.face, gain: 1.0, bright: 1.08, detail: 0.12,
    atmo: [0.32, 0.52, 1.0], atmoK: 0.12, atmoR: 1.03,
  },

  /* Earth and Venus from Mercury, both near opposition, where they
     are full and nearest: Venus 50 arcseconds across and Earth 29, so
     both are points, drawn a little over life size only so they
     survive being rasterised at all, like Deimos from Mars. Their
     brightness per unit of disc is the physical one — sunlight at 0.72
     and 1 AU, a third and a seventh of Mercury's, on albedos of 0.75
     and 0.3 — which makes Venus the brighter star. */
  /* Jupiter from Io: 19.5° across, thirty-nine full Moons, at true
     size, 40° up in the east-north-east. Everything else as from
     Europa — the same sunlight on the same clouds, so the same
     brightness — only twice as wide and nearer upright. */
  'jupiter-io': {
    tex: 'jupiter', r: COMPANION_DIST * Math.sin(9.75 * DEG), dir: IOJ.J, pole: IOJ.Z, oblate: 0.9351, spin: 0.012,
    gain: 1.0, bright: 0.5, limb: 0.85,
    atmo: [0.50, 0.55, 0.70], atmoK: 0.10, atmoR: 1.006,
  },
  /* The other three from Io, all outside its orbit, so none ever
     crosses Jupiter's face from here, but each goes behind it. Europa
     is the largest in Io's sky, 0.72° at its nearest — larger than our
     Moon. The rates are their true synodic rates about Io, compressed
     by the same factor as from Europa. */
  'europa-io': {
    tex: 'europa', r: 1, gain: 1.0, bright: 0.5,
    kepler: { a: 671100, R: 1560.8, rate: -0.0105, phase: 0.6, frame: IOJ },
  },
  'ganymede-io': {
    tex: 'ganymede', r: 1, gain: 1.0, bright: 0.5,
    kepler: { a: 1070400, R: 2634.1, rate: -0.0158, phase: 2.2, frame: IOJ },
  },
  'callisto-io': {
    tex: 'callisto', r: 1, gain: 1.0, bright: 0.5,
    kepler: { a: 1882700, R: 2410.3, rate: -0.0187, phase: 4.1, frame: IOJ },
  },

  /* Uranus from Miranda: 22.8° across at true size, flattened 0.977,
     turning in 17 hours, its dark rings nearly edge-on. The moons, all
     outside Miranda's orbit, at their synodic rates about it, compressed
     like the Galileans'. */
  'uranus-mir': {
    tex: 'uranus', r: COMPANION_DIST * Math.sin(MIR.ang), dir: MIR.J, pole: MIR.pole, oblate: 0.977, spin: 0.0069,
    gain: 1.0, bright: 0.36, limb: 0.9, rings: [URING_KM[0] / 25559, URING_KM[1] / 25559],
    atmo: [0.55, 0.78, 0.85], atmoK: 0.08, atmoR: 1.005,
  },
  'ariel-mir': { tex: 'ariel', r: 1, gain: 1.0, bright: 0.36,
    kepler: { a: 190900, R: 578.9, rate: -0.0115, phase: 1.1, frame: MIR } },
  'umbriel-mir': { tex: 'umbriel', r: 1, gain: 1.0, bright: 0.36,
    kepler: { a: 266000, R: 584.7, rate: -0.0173, phase: 2.9, frame: MIR } },
  'titania-mir': { tex: 'titania', r: 1, gain: 1.0, bright: 0.36,
    kepler: { a: 435910, R: 788.9, rate: -0.0219, phase: 4.3, frame: MIR } },
  'oberon-mir': { tex: 'oberon', r: 1, gain: 1.0, bright: 0.36,
    kepler: { a: 583520, R: 761.4, rate: -0.0234, phase: 5.6, frame: MIR } },

  /* Saturn from Dione: 18.4° across, rings edge-on; three moons inside
     Dione's orbit crossing it, two outside. */
  'saturn-dio': {
    tex: 'saturn', r: COMPANION_DIST * Math.sin(DIO.ang), dir: DIO.J, pole: DIO.Z, oblate: 0.902, spin: 0.011,
    gain: 1.0, bright: 0.15, limb: 0.9, rings: [66900 / 60268, 140500 / 60268],
    atmo: [0.55, 0.52, 0.45], atmoK: 0.06, atmoR: 1.004,
  },
  'mimas-dio': { tex: 'mimas', r: 1, gain: 1.0, bright: 0.15,
    kepler: { a: 185539, R: 198.2, rate: 0.0258, phase: 1.2, frame: DIO } },
  'enceladus-dio': { tex: 'enceladus', r: 1, gain: 1.0, bright: 0.15,
    kepler: { a: 238020, R: 252.1, rate: 0.0135, phase: 2.6, frame: DIO } },
  'tethys-dio': { tex: 'tethys', r: 1, gain: 1.0, bright: 0.15,
    kepler: { a: 294619, R: 531.1, rate: 0.0061, phase: 4.0, frame: DIO } },
  'rhea-dio': { tex: 'rhea', r: 1, gain: 1.0, bright: 0.15,
    kepler: { a: 527108, R: 763.8, rate: -0.0053, phase: 5.1, frame: DIO } },
  'titan-dio': { tex: 'titan', r: 1, gain: 1.0, bright: 0.13, atmo: [0.9, 0.62, 0.32], atmoK: 0.5, atmoR: 1.12,
    kepler: { a: 1221870, R: 2574.7, rate: -0.0112, phase: 0.4, frame: DIO } },

  /* Saturn from Mimas: 38° across at true size, the rings edge-on; the
     outer moons along the ring line at their synodic rates about Mimas,
     compressed like the others'. Enceladus and Tethys pass within half a
     degree's size. */
  'saturn-mim': {
    tex: 'saturn', r: COMPANION_DIST * Math.sin(MIM.ang), dir: MIM.J, pole: MIM.Z, oblate: 0.902, spin: 0.011,
    gain: 1.0, bright: 0.15, limb: 0.9, rings: [66900 / 60268, 140500 / 60268],
    atmo: [0.55, 0.52, 0.45], atmoK: 0.06, atmoR: 1.004,
  },
  'enceladus-mim': { tex: 'enceladus', r: 1, gain: 1.0, bright: 0.15,
    kepler: { a: 238020, R: 252.1, rate: -0.0123, phase: 0.7, frame: MIM } },
  'tethys-mim': { tex: 'tethys', r: 1, gain: 1.0, bright: 0.15,
    kepler: { a: 294619, R: 531.1, rate: -0.0197, phase: 2.0, frame: MIM } },
  'dione-mim': { tex: 'dione', r: 1, gain: 1.0, bright: 0.15,
    kepler: { a: 377396, R: 561.4, rate: -0.0258, phase: 3.3, frame: MIM } },
  'rhea-mim': { tex: 'rhea', r: 1, gain: 1.0, bright: 0.15,
    kepler: { a: 527108, R: 763.8, rate: -0.0311, phase: 4.6, frame: MIM } },
  'titan-mim': { tex: 'titan', r: 1, gain: 1.0, bright: 0.13, atmo: [0.9, 0.62, 0.32], atmoK: 0.5, atmoR: 1.12,
    kepler: { a: 1221870, R: 2574.7, rate: -0.037, phase: 5.8, frame: MIM } },

  /* Saturn from Iapetus: 1.94° across, rings 4.4° tip to tip and open by
     12°, the brightness the same as from Enceladus, here in units ten
     times as large. Titan, inside Iapetus's orbit, crosses it now and
     then; its synodic rate, compressed like the others'. */
  'saturn-iap': {
    tex: 'saturn', r: COMPANION_DIST * (60268 / 3560820), dir: IAP.J, pole: IAP.pole, oblate: 0.902, spin: 0.011,
    gain: 1.0, bright: 1.4, limb: 0.9, rings: [66900 / 60268, 140500 / 60268],
    atmo: [0.55, 0.52, 0.45], atmoK: 0.06, atmoR: 1.004,
  },
  'titan-iap': { tex: 'titan', r: 1, gain: 1.0, bright: 1.3, atmo: [0.9, 0.62, 0.32], atmoK: 0.5, atmoR: 1.12,
    kepler: { a: 1221870, R: 2574.7, rate: 0.00185, phase: 2.2, frame: IAP } },

  /* Neptune from Triton: 8.0° across at true size, slightly flattened
     (0.983), turning in 16 hours. Brightness the physical one, in
     Pluto's units: sunlight at 30 AU on clouds of albedo 0.44. */
  'neptune-tri': {
    tex: 'neptune', r: COMPANION_DIST * (24764 / 354760), dir: TRI.J, pole: TRI.pole, oblate: 0.983, spin: 0.0074,
    gain: 1.0, bright: 1.3, limb: 0.9,
    atmo: [0.45, 0.65, 1.0], atmoK: 0.10, atmoR: 1.006,
  },

  /* Jupiter from Ganymede: 7.64° across, at true size. Io and Europa
     inside, Callisto outside. */
  'jupiter-gan': {
    tex: 'jupiter', r: COMPANION_DIST * (71492 / 1070400), dir: GAN.J, pole: GAN.Z, oblate: 0.9351, spin: 0.012,
    gain: 1.0, bright: 0.5, limb: 0.85,
    atmo: [0.50, 0.55, 0.70], atmoK: 0.10, atmoR: 1.006,
  },
  'io-gan': { tex: 'io', r: 1, gain: 1.0, bright: 0.5,
    kepler: { a: 421700, R: 1821.6, rate: 0.0157, phase: 1.3, frame: GAN } },
  'europa-gan': { tex: 'europa', r: 1, gain: 1.0, bright: 0.5,
    kepler: { a: 671100, R: 1560.8, rate: 0.00525, phase: 3.6, frame: GAN } },
  'callisto-gan': { tex: 'callisto', r: 1, gain: 1.0, bright: 0.5,
    kepler: { a: 1882700, R: 2410.3, rate: -0.00296, phase: 5.1, frame: GAN } },

  /* Jupiter from Callisto: 4.35° across, eight full Moons, at true
     size; the same sunlight on the same clouds as from Europa. The other
     three are all inside Callisto's orbit and cross its face. Their
     synodic rates about Callisto, compressed as from Europa. */
  'jupiter-cal': {
    tex: 'jupiter', r: COMPANION_DIST * (71492 / 1882700), dir: CAL.J, pole: CAL.Z, oblate: 0.9351, spin: 0.012,
    gain: 1.0, bright: 0.5, limb: 0.85,
    atmo: [0.50, 0.55, 0.70], atmoK: 0.10, atmoR: 1.006,
  },
  'io-cal': { tex: 'io', r: 1, gain: 1.0, bright: 0.5,
    kepler: { a: 421700, R: 1821.6, rate: 0.0187, phase: 0.8, frame: CAL } },
  'europa-cal': { tex: 'europa', r: 1, gain: 1.0, bright: 0.5,
    kepler: { a: 671100, R: 1560.8, rate: 0.0082, phase: 2.9, frame: CAL } },
  'ganymede-cal': { tex: 'ganymede', r: 1, gain: 1.0, bright: 0.5,
    kepler: { a: 1070400, R: 2634.1, rate: 0.00296, phase: 4.6, frame: CAL } },

  /* Saturn from Enceladus: 29° across at true size, 24° up in the
     north-east, flattened to 0.90 by its spin. Its brightness is the
     physical one: sunlight at 9.5 AU, a ninetieth of the Moon's, in
     Europa's units, on clouds of albedo about a half. The rings are
     edge-on from here; the shadow they throw across the globe is not,
     and widens and narrows with the sun. */
  'saturn-enc': {
    tex: 'saturn', r: COMPANION_DIST * Math.sin(ENC.ang), dir: ENC.J, pole: ENC.Z, oblate: 0.902, spin: 0.011,
    gain: 1.0, bright: 0.15, limb: 0.9, rings: [66900 / 60268, 140500 / 60268],
    atmo: [0.55, 0.52, 0.45], atmoK: 0.06, atmoR: 1.004,
  },
  /* The moons, strung along the ring plane, at their true sizes and
     distances as they move: Mimas, inside Enceladus's orbit, crosses
     Saturn's face; Tethys comes as close as 57,000 km and 1.1° across,
     twice our Moon; Titan, orange and hazy, never more than a third of
     a degree. Their synodic rates about Enceladus, compressed like the
     Galileans'. */
  'mimas-enc': { tex: 'mimas', r: 1, gain: 1.0, bright: 0.15,
    kepler: { a: 185539, R: 198.2, rate: 0.0105, phase: 0.9, frame: ENC } },
  'tethys-enc': { tex: 'tethys', r: 1, gain: 1.0, bright: 0.15,
    kepler: { a: 294619, R: 531.1, rate: -0.0064, phase: 0.35, frame: ENC } },
  'dione-enc': { tex: 'dione', r: 1, gain: 1.0, bright: 0.15,
    kepler: { a: 377396, R: 561.4, rate: -0.0116, phase: 2.6, frame: ENC } },
  'rhea-enc': { tex: 'rhea', r: 1, gain: 1.0, bright: 0.15,
    kepler: { a: 527108, R: 763.8, rate: -0.0161, phase: 4.2, frame: ENC } },
  'titan-enc': { tex: 'titan', r: 1, gain: 1.0, bright: 0.13, atmo: [0.9, 0.62, 0.32], atmoK: 0.5, atmoR: 1.12,
    kepler: { a: 1221870, R: 2574.7, rate: -0.0211, phase: 5.3, frame: ENC } },

  'earth-star': {
    tex: 'earth', r: 8, dir: [0.80, 0.35, 0.10], gain: 1.0, bright: 0.16, clouds: true,
  },
  'venus-star': {
    tex: 'venus', r: 10, dir: [0.62, 0.40, -0.20], gain: 1.0, bright: 0.31,
  },
} satisfies Record<string, CompanionSpec>;
/** A body that can hang in some world's sky: a key of the table above. */
export type CompanionId = keyof typeof COMPANIONS;

/** What a companion's group carries for the frame loop and the key light. */
interface CompanionData {
  pos: THREE.Vector3;                 // where it hangs, from the camera
  bright: THREE.IUniform<number>;     // its own light (uBright) …
  bright0: number;                    // … as the spec set it
  sync(): void;
  tick(t: number): void;
}
// Only narrows the declared type of userData (a declare field emits
// nothing); makeCompanion() fills it before handing the group out.
class CompanionGroup extends THREE.Group {
  declare userData: CompanionData;
}

type GlobeUniforms = typeof skyDome.uniforms & {
  dayMap: THREE.IUniform<THREE.Texture>; sunDir: THREE.IUniform<THREE.Vector3>;
  cloudShift: THREE.IUniform<number>; uBright: THREE.IUniform<number>;
  // Only for the specs that ask for them.
  nightMap?: THREE.IUniform<THREE.Texture | undefined>; specMap?: THREE.IUniform<THREE.Texture | undefined>;
  cloudMap?: THREE.IUniform<THREE.Texture | undefined>; elevMap?: THREE.IUniform<THREE.Texture | undefined>;
  ringMap?: THREE.IUniform<THREE.Texture | undefined>;
};

function makeCompanion(spec: CompanionSpec) {
  const T = bodyTex(spec.tex);
  const group = new CompanionGroup();
  if (spec.tilt) group.rotation.set(spec.tilt[0], spec.tilt[1], spec.tilt[2]);
  if (spec.pole) group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...spec.pole).normalize());

  const uni: GlobeUniforms = {
    dayMap: { value: T.day },
    sunDir: { value: new THREE.Vector3() },
    cloudShift: { value: 0 },
    uBright: { value: spec.bright ?? 1 },
    // The same objects as the dome's, not copies: the sky over the
    // body is the sky beside it, and has to stay that way.
    ...skyDome.uniforms,
  };
  let decl = 'uniform sampler2D dayMap;\nuniform vec3 sunDir;\nuniform float cloudShift;\nuniform float uBright;\n' + skyDome.glsl;
  if (spec.night) { uni.nightMap = { value: T.night }; decl += 'uniform sampler2D nightMap;\n'; }
  if (spec.ocean) { uni.specMap = { value: T.spec }; decl += 'uniform sampler2D specMap;\n'; }
  if (spec.clouds) { uni.cloudMap = { value: T.clouds }; decl += 'uniform sampler2D cloudMap;\n'; }
  if (spec.relief) { uni.elevMap = { value: T.elev }; decl += 'uniform sampler2D elevMap;\n'; }
  // The elevation map's texel, for its finite differences. A data
  // texture's image is {data, width, height}.
  const eSize: [number, number] = spec.relief && T.elev ? [T.elev.image.width, T.elev.image.height] : [1024, 512];
  // Rings, in the globe's equatorial plane, radii in scene units.
  const ringR: [number, number] | null = spec.rings ? [spec.r * spec.rings[0], spec.r * spec.rings[1]] : null;
  if (spec.rings) {
    uni.ringMap = { value: T.ring };
    decl += 'uniform sampler2D ringMap;\n';
  }

  /* Relief and detail. A body drawn at 42° across magnifies its map
     far past the resolution any canvas could hold, so the close-up
     detail is generated per fragment instead: cheap 3D value noise
     on the sphere, which is sharp at every zoom and costs no memory.
     It modulates albedo, and — with the baked elevation — bends the
     normal, so the terminator rakes across real topography.        */
  const noiseLib = `
    float h31( vec3 p ) {
      p = fract( p * 0.3183099 + vec3( 0.71, 0.113, 0.419 ) );
      p *= 17.0;
      return fract( p.x * p.y * p.z * ( p.x + p.y + p.z ) );
    }
    float vn3( vec3 p ) {
      vec3 i = floor( p ), f = fract( p );
      f = f * f * ( 3.0 - 2.0 * f );
      return mix( mix( mix( h31( i ), h31( i + vec3( 1, 0, 0 ) ), f.x ),
                       mix( h31( i + vec3( 0, 1, 0 ) ), h31( i + vec3( 1, 1, 0 ) ), f.x ), f.y ),
                  mix( mix( h31( i + vec3( 0, 0, 1 ) ), h31( i + vec3( 1, 0, 1 ) ), f.x ),
                       mix( h31( i + vec3( 0, 1, 1 ) ), h31( i + vec3( 1, 1, 1 ) ), f.x ), f.y ), f.z );
    }
    // Two octaves, sized in radians of arc rather than pixels: the
    // coarse one lands around seven degrees of surface, the fine one
    // near two. Anything finer than that aliases into pepper at the
    // distances these bodies are actually seen from.
    float detail( vec3 p ) { return vn3( p * 7.0 ) * 0.62 + vn3( p * 19.0 ) * 0.38; }
  `;

  const globe = new THREE.Mesh(
    new THREE.SphereGeometry(spec.r, spec.r > 100 ? 128 : 24, spec.r > 100 ? 84 : 16),
    new THREE.ShaderMaterial({
      uniforms: uni,
      // modelMatrix is a vertex-stage built-in only, so the surface
      // frame is built here and handed across as world-space varyings.
      // The fragment stage never needs the model matrix at all.
      vertexShader: `
        varying vec3 vN; varying vec3 vW; varying vec2 vUv; varying vec3 vNo;
        varying vec3 vEast; varying vec3 vNorth; varying vec3 vC; varying vec3 vP;
        void main() {
          vUv = uv;
          vec3 No = normalize( normal );
          vNo = No;
          vec3 up = abs( No.y ) > 0.99 ? vec3( 1.0, 0.0, 0.0 ) : vec3( 0.0, 1.0, 0.0 );
          vec3 e = normalize( cross( up, No ) );
          mat3 M = mat3( modelMatrix );
          // An oblate globe is a sphere scaled by c along its pole; its
          // normal is the sphere's through the inverse of that scale,
          // and M already holds the scale once, hence c².
          vN = normalize( M * vec3( No.x, No.y / ${((spec.oblate || 1) ** 2).toFixed(5)}, No.z ) );
          vEast = normalize( M * e );
          vNorth = normalize( M * cross( No, e ) );
          vW = ( modelMatrix * vec4( position, 1.0 ) ).xyz;
          vC = ( modelMatrix * vec4( 0.0, 0.0, 0.0, 1.0 ) ).xyz;
          vP = normalize( M * vec3( 0.0, 1.0, 0.0 ) );
          gl_Position = projectionMatrix * viewMatrix * vec4( vW, 1.0 );${skyDepth('length( vW - cameraPosition )')}
        }`,
      fragmentShader: decl + (spec.relief || spec.detail ? noiseLib : '') + `
        varying vec3 vN; varying vec3 vW; varying vec2 vUv; varying vec3 vNo;
        varying vec3 vEast; varying vec3 vNorth; varying vec3 vC; varying vec3 vP;
        vec3 srgb2lin( vec3 c ) { return pow( c, vec3( 2.2 ) ); }

        void main() {
          vec3 N = normalize( vN );
          vec3 Ng = N;                       // geometric, for the limb terms
          vec3 L = normalize( sunDir );
          vec3 V = normalize( cameraPosition - vW );
          ` +
          (spec.relief ? `
          // Tilt the normal by the elevation gradient, along the
          // surface frame the vertex stage handed over. Heights are in
          // texel widths, so half the central difference is the slope;
          // a step in u spans less ground near the poles, so the same
          // difference is steeper there — hence the 1/cos(latitude)
          // term, capped so the poles stay sane.
          vec3 No = normalize( vNo );
          vec3 E = normalize( vEast ), Nn = normalize( vNorth );
          float clat = max( sqrt( max( 1.0 - No.y * No.y, 0.0 ) ), 0.22 );
          vec2 d = vec2( ${(1 / eSize[0]).toExponential(6)}, ${(1 / eSize[1]).toExponential(6)} );
          float eL = texture2D( elevMap, vUv - vec2( d.x, 0.0 ) ).r;
          float eR = texture2D( elevMap, vUv + vec2( d.x, 0.0 ) ).r;
          float eD = texture2D( elevMap, vUv - vec2( 0.0, d.y ) ).r;
          float eU = texture2D( elevMap, vUv + vec2( 0.0, d.y ) ).r;
          float sx = ( eR - eL ) * 0.5 / clat, sy = ( eU - eD ) * 0.5;

          // Fine relief the map cannot hold, from the same noise that
          // breaks up the albedo. Sampled in object space, applied
          // along the matching world axes.
          vec3 upo = abs( No.y ) > 0.99 ? vec3( 1.0, 0.0, 0.0 ) : vec3( 0.0, 1.0, 0.0 );
          vec3 eo = normalize( cross( upo, No ) );
          vec3 no = cross( No, eo );
          float e = 0.0035;
          vec3 pd = No * ${(spec.detailScale || 1).toFixed(2)};
          float nC = detail( pd );
          sx += ( detail( pd + eo * e ) - nC ) * ${(spec.detailBump || 0).toFixed(2)};
          sy += ( detail( pd + no * e ) - nC ) * ${(spec.detailBump || 0).toFixed(2)};

          N = normalize( N - ( E * sx + Nn * sy ) * ${(spec.relief).toFixed(2)} );
          ` : '') + `
          float ndl = dot( N, L );

          // A body with air has a soft terminator, because the air
          // scatters light past the geometric edge of the lit half.
          // An airless one has a knife edge, and gets 0.0 here.
          float day = smoothstep( -${(spec.atmo ? 0.14 : 0.01).toFixed(2)}, ${(spec.atmo ? 0.20 : 0.02).toFixed(2)}, ndl );
          float diff = max( ndl, 0.0 );
          ` + (spec.limb ? `
          // Minnaert: cloud darkens toward the limb less than a matte
          // ball does.
          diff = pow( diff, ${spec.limb.toFixed(2)} ) * pow( max( dot( Ng, V ), 0.05 ), ${(spec.limb - 1).toFixed(2)} );
          ` : '') + `

          vec3 albedo = srgb2lin( texture2D( dayMap, vUv ).rgb );
          vec2 cUv = vec2( vUv.x + cloudShift, vUv.y );
          ` +
          (spec.detail ? `
          // Mottle the albedo at a scale finer than the map holds, so
          // magnifying the disc reveals more surface rather than more
          // blur. Reuses the same noise the relief pass sampled.
          albedo *= 1.0 + ( detail( normalize( vNo ) * ${(spec.detailScale || 1).toFixed(2)} ) - 0.5 )
                        * ${spec.detail.toFixed(2)};
          ` : '') + `
          vec3 col = albedo * diff * ${spec.gain.toFixed(2)};
          ` +
          (spec.ocean ? `
          // Sun glint off water, and only off water.
          float ocean = texture2D( specMap, vUv ).r;
          vec3 Hv = normalize( L + V );
          col += vec3( 1.0, 0.95, 0.86 ) * pow( max( dot( N, Hv ), 0.0 ), 220.0 ) * ocean * day * 2.6;
          ` : '') +
          (spec.clouds ? `
          // Cloud deck, lit by the same sun, with a hint of
          // self-shadowing: thick cloud reads slightly grey.
          float cloud = texture2D( cloudMap, cUv ).a;
          float cloudHi = texture2D( cloudMap, cUv + vec2( 0.0015, -0.0015 ) ).a;
          vec3 cloudCol = vec3( 1.06, 1.06, 1.1 ) * diff * 1.30
                        * ( 1.0 - ( cloudHi - cloud ) * 0.9 );
          col = mix( col, cloudCol, cloud * 0.94 );
          ` : `float cloud = 0.0;`) +
          (spec.night ? `
          // Night side: cities, dimmed under cloud.
          vec3 lights = srgb2lin( texture2D( nightMap, vUv ).rgb );
          col += lights * ( 1.0 - day ) * 3.0 * ( 1.0 - cloud * 0.9 );
          ` : '') +
          (spec.haze ? `
          // The air between you and the ground scatters sunlight your
          // way, more the longer the path through it: a thin blue veil
          // over the whole day side — the reason the oceans look blue
          // and not black — thickening to a glowing rim at the limb,
          // and dimming what is under it. Off the geometric normal, not
          // the bumped one, or the limb crawls with noise.
          float hzMu = max( dot( Ng, V ), 0.04 );
          float hzPath = 1.0 - exp( -${(spec.hazeTau || 0.1).toFixed(3)} / hzMu );
          col = col * ( 1.0 - hzPath * 0.4 )
              + vec3( ${spec.haze.map((n) => n.toFixed(3)).join(', ')} )
                * hzPath * smoothstep( -0.25, 0.35, dot( Ng, L ) ) * ${spec.hazeK.toFixed(2)};
          ` : '') + `
          // Seen from under an atmosphere, the body is beyond all of
          // it: its light is dimmed on the way down, and the light the
          // air scatters toward you — which is the sky itself — lies
          // in front of it. So it can only ever add to the sky beside
          // it, and its night side is exactly the sky's colour, as the
          // dark part of the Moon in a daytime sky at home is blue. On
          // the airless worlds both terms are zero.
          ` + (ringR ? `
          // The rings' shadow: follow the sunlight back from this point
          // to the ring plane, and dim it by the rings' optical depth
          // there, along the slant it crosses them at.
          {
            vec3 Pn = normalize( vP );
            float lp = dot( L, Pn );
            if ( abs( lp ) > 1e-4 ) {
              float tt = dot( vC - vW, Pn ) / lp;
              if ( tt > 0.0 ) {
                float u = ( length( vW + L * tt - vC ) - ${ringR[0].toFixed(2)} ) / ${(ringR[1] - ringR[0]).toFixed(2)};
                if ( u > 0.0 && u < 1.0 ) col *= exp( -texture2D( ringMap, vec2( u, 0.5 ) ).a * ${RING_TAU.toFixed(1)} / abs( lp ) );
              }
            }
          }
          ` : '') + `
          gl_FragColor = vec4( col * uBright * skyTrans( -V ) + skyRadiance( -V ), 1.0 );
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    })
  );
  hdrSqueeze(globe.material);    // opaque: it hides the stars
  if (spec.oblate) globe.scale.y = spec.oblate;
  // After the stars, in the transparent queue: sky depth (sky/sun.ts) puts it
  // behind them, so it covers them by order. Still opaque in effect.
  globe.material.transparent = true;
  globe.renderOrder = -1.5;
  if (spec.face) {
    // A locked body keeps one face to its partner. Turn the globe on
    // its pole until the middle of the map (u = 0.5, where the maps
    // put longitude 0) looks out along this scene direction.
    const f = new THREE.Vector3(...spec.face).applyQuaternion(group.quaternion.clone().invert());
    globe.rotation.y = -Math.atan2(f.z, f.x);
  }
  group.add(globe);

  if (ringR) {
    /* The rings: a flat annulus in the equatorial plane, lit as a slab
       of particles by single scattering (Chandrasekhar's): on the face
       the sun is on, light comes back up out of the top layer, so the
       dense B ring is the brightest; on the other face only what
       diffuses through reaches you, so the B ring goes dark and the
       thin C ring and the Cassini Division glow. How much of what is
       behind them they block goes with the slant you look through.
       Saturn's own shadow falls across them behind the planet. From
       inside the ring plane, as from Enceladus, all of that is a line. */
    const rg = new THREE.RingGeometry(ringR[0], ringR[1], 360, 1);
    rg.rotateX(-Math.PI / 2);
    const ring = new THREE.Mesh(rg, hdrSqueeze(new THREE.ShaderMaterial({
      uniforms: { ringMap: uni.ringMap!, sunDir: uni.sunDir, uBright: uni.uBright, ...skyDome.uniforms },
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      vertexShader: `
        varying vec3 vW; varying vec3 vC; varying vec3 vP; varying float vR;
        void main() {
          vR = length( position.xz );
          vW = ( modelMatrix * vec4( position, 1.0 ) ).xyz;
          vC = ( modelMatrix * vec4( 0.0, 0.0, 0.0, 1.0 ) ).xyz;
          vP = normalize( mat3( modelMatrix ) * vec3( 0.0, 1.0, 0.0 ) );
          gl_Position = projectionMatrix * viewMatrix * vec4( vW, 1.0 );${skyDepth('length( vW - cameraPosition )')}
        }`,
      fragmentShader: skyDome.glsl + `
        uniform sampler2D ringMap; uniform vec3 sunDir; uniform float uBright;
        varying vec3 vW; varying vec3 vC; varying vec3 vP; varying float vR;
        void main() {
          vec4 pr = texture2D( ringMap, vec2( ( vR - ${ringR[0].toFixed(2)} ) / ${(ringR[1] - ringR[0]).toFixed(2)}, 0.5 ) );
          float tau = pr.a * ${RING_TAU.toFixed(1)};
          vec3 N = normalize( vP ), L = normalize( sunDir ), V = normalize( cameraPosition - vW );
          float s0 = dot( N, L ), s1 = dot( N, V );
          float m0 = max( abs( s0 ), 0.01 ), m1 = max( abs( s1 ), 0.01 );
          float I;
          if ( s0 * s1 > 0.0 ) I = m0 / ( m0 + m1 ) * ( 1.0 - exp( -tau * ( 1.0 / m0 + 1.0 / m1 ) ) );
          else I = abs( m1 - m0 ) < 1e-3 ? tau / m0 * exp( -tau / m0 )
                 : m0 / abs( m1 - m0 ) * abs( exp( -tau / m1 ) - exp( -tau / m0 ) );
          // In Saturn's shadow?
          vec3 oc = vW - vC;
          float b = dot( oc, L ), c = dot( oc, oc ) - ${(spec.r * spec.r).toFixed(1)};
          float lit = ( b < 0.0 && b * b - c > 0.0 ) ? 0.0 : 1.0;
          float a = 1.0 - exp( -tau / m1 );
          vec3 col = pr.rgb * pr.rgb * 2.2 * I * lit * uBright;
          gl_FragColor = vec4( col * skyTrans( -V ) + skyRadiance( -V ) * a, a );
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    }), true));   // premultiplied, over the squeezed globe (render/hdr.ts)
    ring.renderOrder = -1.4;
    group.add(ring);
  }

  if (spec.atmo) {
    // Atmospheric shell: the arc that stands off the limb. Blue on
    // Earth, and on Mars a thin pink one — the same dust again.
    const atmo = new THREE.Mesh(
      new THREE.SphereGeometry(spec.r * (spec.atmoR || 1.035), 64, 40),
      hdrSqueeze(new THREE.ShaderMaterial({
        uniforms: { sunDir: uni.sunDir, uBright: uni.uBright, ...skyDome.uniforms },
        transparent: true, blending: THREE.AdditiveBlending,
        side: THREE.BackSide, depthWrite: false,
        vertexShader: `
          varying vec3 vN; varying vec3 vW;
          void main() {
            vN = normalize( mat3( modelMatrix ) * normal );
            vW = ( modelMatrix * vec4( position, 1.0 ) ).xyz;
            gl_Position = projectionMatrix * viewMatrix * vec4( vW, 1.0 );${skyDepth('length( vW - cameraPosition )')}
          }`,
        // Additive, so it takes only the dimming: the globe under it
        // has already laid the sky down once.
        fragmentShader: skyDome.glsl + `
          uniform vec3 sunDir; uniform float uBright; varying vec3 vN; varying vec3 vW;
          void main() {
            vec3 N = normalize( vN );
            vec3 V = normalize( cameraPosition - vW );
            float rim = pow( 1.0 - abs( dot( N, V ) ), 3.2 );
            // BackSide, so these are the far-side normals: they point
            // with the sun on the lit limb, not against it.
            float lit = smoothstep( -0.2, 0.4, dot( N, normalize( sunDir ) ) );
            gl_FragColor = vec4( vec3( ${spec.atmo.map((n) => n.toFixed(3)).join(', ')} )
                               * rim * lit * ${spec.atmoK.toFixed(2)} * uBright * skyTrans( -V ), 1.0 );
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }`,
      }))   // squeezed, as the globe it is added to is
    );
    if (spec.oblate) atmo.scale.y = spec.oblate;
    atmo.renderOrder = -1.45;
    group.add(atmo);
  }

  // Where it sits, and where it is going. Orbiting companions swing
  // their direction vector around a fixed axis; locked ones do not
  // move at all, because from a locked moon the primary never does.
  const base = new THREE.Vector3(...(spec.dir || [0, 1, 0])).normalize();
  const pos = base.clone().multiplyScalar(COMPANION_DIST);
  const axis = spec.orbit ? new THREE.Vector3(...spec.orbit.axis).normalize() : null;

  group.userData.pos = pos;
  // Its own light, scaled by the night units (updateKey).
  group.userData.bright = uni.uBright;
  group.userData.bright0 = uni.uBright.value;
  // The sun is so far off that it lights the companion from the same
  // direction it lights you (0.01° apart for Saturn from Enceladus).
  // The phase comes from where the companion stands, not from moving
  // the sun: a stand-in sun at a finite distance tilted it by up to 6°.
  group.userData.sync = () => {
    uni.sunDir.value.copy(SUN_DIR);
  };
  // A moon of Jupiter seen from another (Europa, or Io — kepler.frame):
  // both orbits in one plane, so its offset from the observer's moon is
  // a vector in X, Y, and its distance sets its size. Nearer than the
  // observer's own orbit it may cross in front of Jupiter, so it is
  // drawn in front of it; further, behind.
  const kp = spec.kepler, kv = new THREE.Vector3(), KF = kp && kp.frame || JOV;
  const tickKepler = (kp: Kepler, t: number) => {
    const ph = kp.phase + t * kp.rate;
    const rx = kp.a * Math.cos(ph) - KF.aE, ry = kp.a * Math.sin(ph), d = Math.hypot(rx, ry);
    const D = d < KF.aE ? 4600 : 7800;
    kv.set(rx * KF.X[0] + ry * KF.Y[0], rx * KF.X[1] + ry * KF.Y[1], rx * KF.X[2] + ry * KF.Y[2]);
    pos.copy(kv).multiplyScalar(D / d);
    group.scale.setScalar(D * kp.R / d);
  };
  if (kp) tickKepler(kp, 0);

  group.userData.tick = (t) => {
    if (kp) tickKepler(kp, t);
    // axis is set exactly when spec.orbit is.
    if (axis) pos.copy(base).applyAxisAngle(axis, t * spec.orbit!.rate).multiplyScalar(COMPANION_DIST);
    if (spec.clouds) uni.cloudShift.value = t * 0.0006;   // clouds drift over a turning globe
    if (spec.spin) globe.rotation.y = t * spec.spin;
  };
  return group;
}

const companionCache = new Map<CompanionId, CompanionGroup>();
export let liveCompanions: CompanionGroup[] = [];
// Venus is the one world with nothing overhead: the cloud deck is
// opaque in both directions, so there is no Earth to find, no sun,
// and no stars. A rover there talks to an orbiter it cannot see, so
// the dish sits at the zenith and waits for the pass.
const ZENITH_AIM = new THREE.Vector3(0, COMPANION_DIST, 0);

// From Europa and Pluto the relay is Earth, which never strays far
// from the sun, so the dish tracks a point just along the sky from it.
const _up = new THREE.Vector3(0, 1, 0);
export function relayAim(out: THREE.Vector3) {
  if (world.relay) return out.copy(SUN_DIR).applyAxisAngle(_up, world.relay).multiplyScalar(COMPANION_DIST);
  return out.copy(liveCompanions.length ? liveCompanions[0]!.userData.pos : ZENITH_AIM);   // [0] exists by the length test
}

// The maps of what hangs in a sky are generated on the main thread (they
// draw on canvases) and take up to a second a body, so a world's are
// built ahead of the switch, one body per task with room between for
// the page to paint and take clicks, and only once the picker's zoom
// has played out. Not paced by frames: those can be slow to come.
// ready: what to wait for before drawing on the main thread (the
// picker's zoom), so the page stays smooth while it plays.
export async function companionsAsync(ids: readonly CompanionId[], ready = () => Promise.resolve()) {
  const missing = ids.filter((id) => !companionCache.has(id));
  if (!missing.length) return;
  // The workers can start at once, in parallel; only what runs here waits.
  const off: Partial<Record<TexKey, Promise<BodyMaps>>> = {};
  for (const id of missing) {
    const k = COMPANIONS[id].tex;
    if (TEXGEN_OFF[k] && !texCache.has(k)) off[k] ||= TEXGEN_OFF[k]();
  }
  await ready();
  for (const id of missing) {
    const k = COMPANIONS[id].tex;
    if (off[k] && !texCache.has(k)) texCache.set(k, await off[k]);
    await new Promise((r) => setTimeout(r, 20));
    if (!companionCache.has(id)) companionCache.set(id, makeCompanion(COMPANIONS[id]));
  }
}

export function setCompanions(ids: readonly CompanionId[]) {
  for (const g of liveCompanions) scene.remove(g);
  liveCompanions = ids.map((id) => {
    let g = companionCache.get(id);
    if (!g) companionCache.set(id, g = makeCompanion(COMPANIONS[id]));
    scene.add(g);
    return g;
  });
  relayAim(COMPANION_AIM);
}
