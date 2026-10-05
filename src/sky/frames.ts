import * as THREE from 'three';
import { DEG } from '../surface/hapke';

/* ── What hangs overhead ────────────────────────────────────────
   Every companion sits on the same 6.2 km shell and is drawn at a
   stated angular size, so the sizes below are comparable to each
   other. All are true size; only bodies too small to rasterise as
   discs at all — Deimos from Mars, Venus and Earth from Mercury — are
   drawn a little over life size, as points, and say so.

   All of these shaders work in world space. The group follows the
   camera every frame, so nothing up here shows parallax — which
   is right: the nearest of them is 6,000 km away.                */
export const COMPANION_DIST = 6200;

/** A direction: in scene axes (x east, y up, z south), or in a body frame. */
export type Vec3 = [number, number, number];

/** A primary as seen from a locked moon: J toward its centre, pole its
    north where that is not the orbit normal. */
export interface Primary { J: Vec3; pole?: Vec3 }
/** A primary with moons: X and Y span the orbital plane (X from the
    primary toward the observer's moon, Y along its motion), Z is the
    primary's north, aE the observer's orbit radius in km. Companions
    with `kepler` are placed in it. */
export interface OrbitFrame extends Primary { X: Vec3; Y: Vec3; Z: Vec3; aE: number }
/** One where the observer's offset from its moon's centre is kept, and
    with it the primary's angular radius (ang, radians). */
export interface NearFrame extends OrbitFrame { ang: number }
/** One of a binary seen from the other (Pluto and Charon): dir toward
    it, pole its north, face where its longitude 0 looks; d the distance
    and ang the angular radius from the site. */
export interface PairFrame { dir: Vec3; pole: Vec3; face: Vec3; d: number; ang: number }

// A vector from its three components, as a tuple.
const v3 = (f: (i: 0 | 1 | 2) => number): Vec3 => [f(0), f(1), f(2)];

/* Where a locked companion hangs, and how it is turned, as seen from
   a site at latitude b and east longitude l. The body frame has X
   toward the companion (the sub-companion point is longitude 0), Z
   north, and the companion's orbit in its equator; this maps a
   vector in it to scene axes (x east, y up, z south). */
function siteFrame(bDeg: number, lDeg: number) {
  const b = bDeg * DEG, l = lDeg * DEG;
  const E: Vec3 = [-Math.sin(l), Math.cos(l), 0];
  const N: Vec3 = [-Math.sin(b) * Math.cos(l), -Math.sin(b) * Math.sin(l), Math.cos(b)];
  const U: Vec3 = [Math.cos(b) * Math.cos(l), Math.cos(b) * Math.sin(l), Math.sin(b)];
  const dot = (v: Vec3, a: Vec3) => v[0] * a[0] + v[1] * a[1] + v[2] * a[2];
  const F = (v: Vec3): Vec3 => [dot(v, E), dot(v, U), -dot(v, N)];
  F.up = U;
  return F;
}

/* Jupiter's frame, as seen from the site. Europa is locked, and its
   orbit, Jupiter's equator and the orbits of the other three all
   lie in one plane, which from Europa's surface is a great circle
   across the sky through Jupiter. Everything below is computed from
   where you stand — 10°S, 75°W, in Tara Regio. J is toward Jupiter,
   which comes out 15° above the eastern horizon; X and Y span the
   orbital plane (X from Jupiter toward Europa, Y along Europa's
   motion); Z is Jupiter's north, and Europa's. Jupiter is so far
   off, 430 Europa radii, that where on Europa you stand shifts it by
   a tenth of a degree, and that is left out. */
export const JOV: OrbitFrame = (() => {
  const F = siteFrame(-10, -75);
  return { J: F([1, 0, 0]), X: F([-1, 0, 0]), Y: F([0, -1, 0]), Z: F([0, 0, 1]), aE: 671100 };
})();

/* The same frame from Io, 18°S, 48° west of the point beneath
   Jupiter, near Kanehekili Fluctus. Io is locked too, and 421,700 km
   out, so Jupiter is 19.5° across — thirty-nine full Moons — standing
   40° above the east-north-east horizon, and the other three moons all
   circle outside Io's own orbit. */
/* And Saturn from Enceladus, from 55°S, 45° west of the point beneath
   it, on the edge of the south polar terrain. Saturn is 238,000 km
   off, four Saturn radii, so it is 29° across; the site sits 200 km
   below the ring plane, which from 100,000 km is a tenth of a degree —
   the rings are edge-on, a line through the planet, and every moon
   out to Titan travels along that line. The observer's own offset from
   Enceladus's centre moves Saturn by only 0.05°, but is kept, as for
   Pluto and Charon. */
export const ENC: NearFrame = (() => {
  const F = siteFrame(-55, -45), a = 238020, R = 252.1;
  const rel = v3((i) => (i === 0 ? a : 0) - R * F.up[i]);
  const d = Math.hypot(...rel);
  return { J: F(v3((i) => rel[i] / d)), X: F([-1, 0, 0]), Y: F([0, -1, 0]), Z: F([0, 0, 1]), aE: a, ang: Math.asin(60268 / d) };
})();

/* And from Callisto, 15°N, 75° west of the point beneath Jupiter, on
   Valhalla's outer rings: Jupiter 1.88 million km off, 4.35° across,
   14° above the eastern horizon. Io, Europa and Ganymede all circle
   inside Callisto's orbit, so each transits Jupiter from here. */
/* From Ganymede, 15°S, 55° west of the point beneath Jupiter, in
   Nicholson Regio: Jupiter 1.07 million km off, 7.64° across, 34° up
   in the east. */
export const GAN: OrbitFrame = (() => {
  const F = siteFrame(-15, -55);
  return { J: F([1, 0, 0]), X: F([-1, 0, 0]), Y: F([0, -1, 0]), Z: F([0, 0, 1]), aE: 1070400 };
})();

/* And Neptune from Triton, 15°S, 60° west of the point beneath it,
   on the cantaloupe terrain at the polar cap's edge: 354,760 km off,
   8.0° across, 29° up in the east. Triton orbits backwards, 157° to
   Neptune's equator, so Neptune's north is tilted 23° off the line
   opposite Triton's own pole. */
/* Saturn from Iapetus, 1.7°N, 50° west of the point beneath it, on the
   edge of Cassini Regio: 3.56 million km off, 40° up in the east. The
   orbit is tilted to Saturn's equator, so the ring plane is not the
   orbit plane: the pole is turned 12° toward the line of sight, and
   the rings open by that much. */
/* Saturn from Mimas, 5°N, 40° west of the point beneath it: 185,539 km
   off, 38° across, 50° up in the east, the observer's offset kept. */
export const MIM: NearFrame = (() => {
  const F = siteFrame(5, -40), a = 185539, R = 198.2, b = 5 * DEG, l = -40 * DEG;
  const rel: Vec3 = [a - R * Math.cos(b) * Math.cos(l), -R * Math.cos(b) * Math.sin(l), -R * Math.sin(b)];
  const d = Math.hypot(...rel);
  return { J: F(v3((i) => rel[i] / d)), X: F([-1, 0, 0]), Y: F([0, -1, 0]), Z: F([0, 0, 1]), aE: a, ang: Math.asin(60268 / d) };
})();

/* Saturn from Dione, 40°N, 45° east of the point beneath it, on the
   edge of the trailing face: 377,396 km off, 18.4° across, 33° up in
   the south-west. */
export const DIO: NearFrame = (() => {
  const F = siteFrame(40, 45), a = 377396, R = 561.4, b = 40 * DEG, l = 45 * DEG;
  const rel: Vec3 = [a - R * Math.cos(b) * Math.cos(l), -R * Math.cos(b) * Math.sin(l), -R * Math.sin(b)];
  const d = Math.hypot(...rel);
  return { J: F(v3((i) => rel[i] / d)), X: F([-1, 0, 0]), Y: F([0, -1, 0]), Z: F([0, 0, 1]), aE: a, ang: Math.asin(60268 / d) };
})();

export const IAP: OrbitFrame = (() => {
  const F = siteFrame(1.7, -50), t = 12 * DEG;
  return { J: F([1, 0, 0]), X: F([-1, 0, 0]), Y: F([0, -1, 0]), Z: F([0, 0, 1]), pole: F([-Math.sin(t), 0, Math.cos(t)]), aE: 3560820 };
})();

/* Uranus from Miranda, 35°S, 40° west of the point beneath it: 129,390
   km off, 22.8° across, 38° up in the north-east. Miranda's orbit is
   4.3° out of Uranus's equator; the rings open by that at most, turned
   here toward the line of sight. The observer's offset from Miranda's
   centre is kept: 0.1°. */
export const MIR: NearFrame = (() => {
  const F = siteFrame(-35, -40), a = 129390, R = 235.8, t = 4.3 * DEG;
  const b = -35 * DEG, l = -40 * DEG;
  const rel: Vec3 = [a - R * Math.cos(b) * Math.cos(l), -R * Math.cos(b) * Math.sin(l), -R * Math.sin(b)];
  const d = Math.hypot(...rel);
  return { J: F(v3((i) => rel[i] / d)), X: F([-1, 0, 0]), Y: F([0, -1, 0]), Z: F([0, 0, 1]), pole: F([-Math.sin(t), 0, Math.cos(t)]), aE: a, ang: Math.asin(25559 / d) };
})();

export const TRI: Primary = (() => {
  const F = siteFrame(-15, -60), t = 23 * DEG;
  return { J: F([1, 0, 0]), pole: F([0, Math.sin(t), -Math.cos(t)]) };
})();

export const CAL: OrbitFrame = (() => {
  const F = siteFrame(15, -75);
  return { J: F([1, 0, 0]), X: F([-1, 0, 0]), Y: F([0, -1, 0]), Z: F([0, 0, 1]), aE: 1882700 };
})();

export const IOJ: OrbitFrame = (() => {
  const F = siteFrame(-18, -48);
  return { J: F([1, 0, 0]), X: F([-1, 0, 0]), Y: F([0, -1, 0]), Z: F([0, 0, 1]), aE: 421700 };
})();

/* Charon's place in Pluto's sky, from 5°S, 60° west of the point
   beneath it. Here the parallax is not small: Charon is only sixteen
   Pluto radii away, so standing on the surface rather than at the
   centre lowers it by three degrees, and it is computed. */
export const CHARON: PairFrame = (() => {
  const F = siteFrame(-5, -60), a = 19591, R = 1188.3;
  const rel = v3((i) => (i === 0 ? a : 0) - R * F.up[i]);
  const d = Math.hypot(...rel);
  // face: Charon's own longitude 0 looks back down the line to Pluto.
  return { dir: F(v3((i) => rel[i] / d)), pole: F([0, 0, 1]), face: F([-1, 0, 0]), d, ang: Math.asin(606 / d) };
})();

/* And Pluto in Charon's sky, from 15°S, 45° west of the point beneath
   it, on western Vulcan Planitia. The same sum from the other end;
   Charon is the smaller body, so standing on its surface shifts
   Pluto by only a degree and a half. It comes out 42° above the
   east-north-east horizon, 7.1° across. */
export const PLUTO: PairFrame = (() => {
  const F = siteFrame(-15, -45), a = 19591, R = 606;
  const rel = v3((i) => (i === 0 ? a : 0) - R * F.up[i]);
  const d = Math.hypot(...rel);
  return { dir: F(v3((i) => rel[i] / d)), pole: F([0, 0, 1]), face: F([-1, 0, 0]), d, ang: Math.asin(1188.3 / d) };
})();
// The rover's high-gain dish points at whatever the primary is.
export const COMPANION_AIM = new THREE.Vector3(0, 0, -1);
