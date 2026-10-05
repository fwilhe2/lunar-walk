/* ═════════════════════════════════════════════════════════════
   PLAYER, MODES & LOOP
   Three ways to move: EVA on foot, the rover, and free flight.
   All three stand on the same terrainHeight(), and all three
   stream the world through the same chunk manager.
   ═════════════════════════════════════════════════════════════ */
export const G_EARTH = 9.81, EYE = 1.62;
export let FLY_CEILING = 400;   // past this the streamed horizon would run out

/* Surface gravity, per body, and the suited body that walks on it.

   Nothing about moving on foot is tuned for feel. You are an 80 kg
   person in 91 kg of suit and backpack — "the suit and backpack weigh
   as much as he does", as the Apollo 16 journal says of John Young —
   and everything follows from that mass, the local gravity, the grip
   of the ground, and what a pair of legs can do:

   - Pushing. Leg force falls off linearly with extension speed (the
     force–velocity profile of jumping, Samozino et al. 2008): 36 N per
     kilogram of body at rest, nothing left at 4 m/s. Unsuited on Earth
     that is a 0.33 m squat jump. The suit's joints take 42% of it and
     its knees allow only a 0.25 m crouch, which puts a maximal jump on
     the Moon at 0.82 m — Charlie Duke's, on Apollo 16, before he fell
     over backwards. You choose the effort: hold SPACE to sink into the
     crouch, and let go to push. A push weaker than your weight only
     stands you back up.
   - Walking. Legs are pendulums, so natural speeds scale with the
     Froude number v²/gL. Suited Apollo crews changed from walking to
     running at Fr 0.36 (Carr & McGee 2009), and ran for long stretches
     at 1.4 m/s, Fr 1.35. The same numbers set your pace everywhere.
   - Grip. Horizontal force comes from friction, so no gait can speed
     you up, slow you down or hold you on a slope harder than μ·g·cosθ.
     On the Moon that is 1 m/s²; on Phobos it is 3 mm/s², and walking
     there is not a thing you can do.
   - Power. Once moving, legs deliver a few hundred watts, which is
     what limits climbing, and wading through the air on Venus.

   In the air you are a projectile: nothing you do with your legs
   changes where you land. */
export const SUIT = {
  m: 171,            // kg, person and suit
  F0: 36 * 80,       // N, leg-extension force at zero speed
  V0: 4.0,           // m/s, extension speed where the legs stop pushing
  k: 0.58,           // share of leg force the suit's joints leave you
  crouch: 0.25,      // m, deepest crouch the suit allows
  charge: 0.8,       // s, to sink into the full crouch
  L: 0.9,            // m, leg length
  frWalk: 0.36, frRun: 1.35,
  pWalk: 200, pRun: 400,   // W, propulsive power held for minutes
  lean: 0.47,        // tan 25°: how far a push can be tilted off vertical
} as const;
// The Manned Maneuvering Unit, flown from the shuttle in 1984: 0.3 ft/s²
// in any axis, and 110–130 ft/s of nitrogen on a full ground charge.
export const JET = { a: 0.091, dv: 36 } as const;

// Takeoff speed of a push at effort e from crouch depth d, under g —
// the same integration the live push uses, for the readout.
export function pushSpeed(e: number, d: number, g: number) {
  let u = 0, x = 0;
  const h = 0.0005;
  for (let i = 0; i < 4000 && x < d; i++) {
    const a = e * SUIT.k * SUIT.F0 * Math.max(0, 1 - u / SUIT.V0) / SUIT.m - g;
    if (u <= 0 && a <= 0) return 0;
    u = Math.max(0, u + a * h);
    x += u * h;
  }
  return u;
}

export function setFlyCeiling(v: number) { return (FLY_CEILING = v); }
