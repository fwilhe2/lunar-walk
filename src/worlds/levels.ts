/* ═════════════════════════════════════════════════════════════
   STREAMING LEVELS — how far, and how finely, each world's ground
   is streamed (view.levels; terrain/streamer.ts builds them).

   And a note for every view.ts, kept here since it is shared:

   Sunlight: 1361 W/m² at the Moon, 586 W/m² at Mars — 43% — and
   the same 43% at both moons, which orbit it. On Mars a further
   share of that is scattered out of the beam by suspended dust
   and comes back as skylight, which is why Martian shadows have
   something in them and lunar shadows do not.

   Sun disc: 0.53° from the Moon, 0.35° from Mars and its moons.
   ═════════════════════════════════════════════════════════════ */
// Steps are chosen so every level resolves the craters that are still
// several pixels across at its range: 16 m out to 4.6 km keeps the
// 30–100 m bowls, and their shadows, from melting into swells.
export const L4 = () => [
  { size: 256,   ext: 4 },
  { size: 1024,  ext: 4, step: 16 },
  { size: 4096,  ext: 3, step: 64 },
  { size: 16384, ext: 2, step: 256 },
];
// A 22 km moon hides its own surface 190 m away. Reaching ±40 km
// there would be forty thousand vertices per frame of ground that
// is kilometres below the horizon, so the small bodies stream two
// levels and stop.
//
// The coarse level is finer here than the equivalent on the Moon —
// 16 m rather than 32 — because these two carry far more relief per
// metre than anything else in the set, and a 32 m step smooths so
// much of it away that the LOD boundary shows up as a brightness
// step in the middle distance. The saving from streaming only two
// levels pays for it several times over.
export const L2 = () => [
  { size: 256,  ext: 4 },
  { size: 1024, ext: 3, step: 16 },
];
// Venus stops at ±10 km for the opposite reason to the moonlets:
// not because the ground has fallen away, but because the air is in
// front of it. At 2.2e-4 the haze passes eight parts in a thousand
// at ten kilometres, so the fourth level would be generating a ring
// of terrain that is, to within a rounding error, the fog colour.
export const L3 = () => [
  { size: 256,  ext: 4 },
  { size: 1024, ext: 4, step: 16 },
  { size: 4096, ext: 2, step: 64 },
];

// Enceladus is 504 km across: from eye height the horizon is 900 m
// off, and from the flight ceiling 14 km, past which the ground has
// fallen three kilometres. Three levels, the last cut short.
export const LE = () => [
  { size: 256,  ext: 4 },
  { size: 1024, ext: 4, step: 16 },
  { size: 4096, ext: 3, step: 64 },
];
