import { CURVE_R } from './world';

/* ── Curvature ──────────────────────────────────────────────────
   Chunks curve away by d²/2R about an anchor, which is what puts
   the streamed edge below the horizon. The anchor has to be a
   fixed point — the player's 256 m cell centre — or every chunk
   would need rebuilding on every step, and that leaves the player
   up to 181 m from it. On the Moon 181 m of curvature is 9 mm and
   nobody notices. On Deimos it is 2.6 m, and it buries you.

   So the drop is flat inside D0 of the anchor and only starts
   beyond it. D0 is comfortably more than 181 m, so the player is
   always inside the flat cap and stands on exactly the height the
   physics computes; and it is small enough that the drop past it
   is unchanged where it does the work — on Phobos the edge of the
   streamed world at 3.5 km still sits half a kilometre down.

   It costs the airless-giant worlds nothing: on the Moon the cap
   changes the whole profile by 46 mm.

   On Venus the sign flips, because the ground is not what you are
   really looking at — the light is. 92 bar of CO₂ has a
   refractivity of about 0.015 at the surface and a scale height of
   15.9 km, so a horizontal ray bends downward on a radius near
   1,100 km. That is six times *tighter* than the planet it is
   travelling over: light follows the ground down and then some, so
   the surface never drops out of sight, it climbs. Combining the
   two gives an apparent radius of -1,330 km, which is what Rc
   holds, and what the Venera panoramas show — a horizon that lifts
   away from you like the inside of a shallow bowl. Here the ground
   reaches your eye line about two kilometres out and keeps going.
   Nothing but the haze ever closes it off.                        */
export var CURVE_D0 = 400, CURVE_D02 = CURVE_D0 * CURVE_D0;
export function curveDrop(dx: number, dz: number): number {
  var d2 = dx * dx + dz * dz - CURVE_D02;
  return d2 > 0 ? d2 / (2 * CURVE_R) : 0;
}
