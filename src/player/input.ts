// Held keys by KeyboardEvent.code; a key never pressed reads undefined.
export const keys: Record<string, boolean> = Object.create(null);
/* ── Input ──────────────────────────────────────────────────────
   Keys, a gamepad and the touch controls all come down to one set of
   controls, read once a frame. They are analog where the hardware
   is: a stick half over walks at half pace, drives at half throttle,
   and fires the jets at half thrust, and the right trigger's depth
   is how hard you mean to push — squeeze it and let go to jump. The
   demo still just presses keys, so it drives the same way a person
   does.

   Pad (standard mapping): left stick moves, right stick looks, LB
   runs or boosts, A is SPACE and B is C, the right trigger crouches
   and pushes, Y the rover, X flight, RB the long lens, the D-pad the
   sun and the world, Start the demo, Back the sound. */
export interface Input {
  fwd: number; side: number;       // −1..1
  run: boolean; jump: boolean;
  pushCap: number;                 // 0–1: how hard a push may be
  down: boolean;
  lookX: number; lookY: number;
  zoom: boolean;
}
export const input: Input = { fwd: 0, side: 0, run: false, jump: false, pushCap: 1, down: false, lookX: 0, lookY: 0, zoom: false };
export const touch = { on: false, fwd: 0, side: 0, lookX: 0, lookY: 0, jump: false, down: false, zoom: false };
