import { sound } from '../audio/sound';
import { dust } from '../effects/dust';
import { terrainHeight } from '../kernel/terrain';
import { _solids, rockHeight } from './collision';
import { EYE, SUIT } from './constants';
import { rockSystem } from '../props/rocks';
import { yawObj } from '../render/renderer';
import { prints } from '../surface/stamps';
import type { Player } from './player';

/* ── Gait ───────────────────────────────────────────────────────
   Physics moves you at the pace your legs and the grip allow; the
   gait decides how the body rides over the feet on the way, and when
   the feet come down. It moves the eye, never the physical position:
   averaged over a stride a bouncing gait pushes on the ground with
   exactly your weight, so friction, slopes and crests see the same
   forces either way.

   - Step length follows Alexander's dynamic similarity, a stride of
     2.3 L Fr^0.3 (Alexander 1976), so it scales with gravity through
     the Froude number and needs nothing per world. The suit takes
     about 30% off it: pose estimation of Apollo video (Chiou-Tan et
     al. 2026) found 0.39 m steps at 0.42 m/s, against 0.55 m for the
     same Froude number unsuited, with 40% of the time on both feet
     and the feet 0.36 m apart.
   - A walk vaults: the hip rides an arc of radius L over the planted
     foot, and drops between arcs while both feet are down. Sideways,
     the body swings over each foot as an inverted pendulum, which
     with the suit's wide stance and the slow fall in low gravity is
     about 2 cm on the Moon and 1.5 cm unsuited on Earth.
   - Above Fr ≈ 0.5 the Apollo crews loped: a skip, trailing foot then
     leading foot, then a flight. Contact lasts about as long in low
     gravity as on Earth (Newman et al. 1994); the stride grows, so the
     flight is what gets longer — 0.7 s and 10 cm up at 1.4 m/s on the
     Moon, two seconds and 20 cm on Charon. The stance is a spring
     between flights, matched in height and speed at both ends.
   - Faster than a run the legs cannot keep up and you skid: no steps. */
const GAIT = {
  suit: 0.71,        // suited step length over unsuited, at the same Froude number
  double: 0.4,       // share of a walking step with both feet down (Apollo video)
  base: 0.36,        // m between the feet (Apollo video: 14–15 in.)
  contact: 0.45,     // s on the ground per lope: two overlapping foot contacts
  lope: 0.6, walk: 0.45,   // Froude numbers to change gait at, up and down
};
// Steady (default) or full head motion on foot; see stepEVA.
export type ViewMotion = 'steady' | 'full';
export let viewMotion: ViewMotion = 'steady';
try { if (localStorage.getItem('viewMotion') === 'full') viewMotion = 'full'; } catch (err) { /* no storage */ }

export const gait = (() => {
  let mode: 'walk' | 'lope' = 'walk', ph = 0, side = 1, n = 0;   // phase 0–1 within the step (walk) or cycle (lope)
  let T = 1, s = 0.5, td = 0, vy = 0, second = false, env = 0;
  let oy = 0, ox = 0;
  const foot = { x: 0, z: 0, n: 0 };   // the last foot down, and a count of them
  const strike = (p: Player, k: number, ahead: number, hs: number) => {
    const ax = hs > 0.01 ? p.vel.x / hs : 0, az = hs > 0.01 ? p.vel.z / hs : 0;
    foot.x = p.pos.x + ax * ahead; foot.z = p.pos.z + az * ahead; foot.n++;
    prints.place(foot.x, foot.z, yawObj.rotation.y);
    let hard = p.lift > 0.01;
    if (!hard) {
      const t = terrainHeight(foot.x, foot.z) + 0.02;
      for (const r of rockSystem.solidsAt(foot.x, foot.z, _solids)) if (rockHeight(r, foot.x, foot.z) > t) { hard = true; break; }
    }
    sound.step(k, hard);
    // On a steep slope the loose top layer gives under the boot and
    // runs off downhill — the sliding soil every crew saw on the
    // flanks of craters and on Hadley Delta.
    const e = 0.3, h0 = terrainHeight(foot.x, foot.z);
    const sx = (terrainHeight(foot.x + e, foot.z) - h0) / e, sz = (terrainHeight(foot.x, foot.z + e) - h0) / e, sl = Math.hypot(sx, sz);
    if (sl > 0.27) dust.kick(foot.x, h0, foot.z, -sx / sl, -sz / sl, 0.25 + sl * 0.6);
    // The other boot, leaving the ground behind this one, kicks.
    if (hs > 0.15) dust.kick(p.pos.x - ax * 0.15, terrainHeight(p.pos.x, p.pos.z), p.pos.z - az * 0.15, ax, az, hs);
  };
  // A cycle's shape, fixed at its start so the arcs join up.
  // On a grade steps shorten — uphill to keep the knee within what it
  // can push through, downhill to brake — and quicken to hold the pace
  // (step length falls with the grade either way: Kawamura et al. 1991).
  const plan = (hs: number, gl: number, L: number, grade = 0) => {
    const fr = hs * hs / (gl * L);
    if (mode === 'walk' && fr > GAIT.lope) mode = 'lope';
    else if (mode === 'lope' && fr < GAIT.walk) mode = 'walk';
    const stride = GAIT.suit * 2.3 * L * Math.pow(Math.max(fr, 1e-4), 0.3) * Math.max(0.6, 1 - Math.abs(grade));
    if (mode === 'walk') { s = stride / 2; T = s / hs; }
    else {
      s = stride; T = Math.max(s / hs, GAIT.contact);
      td = T - GAIT.contact;            // the flight
      vy = gl * td / 2;                 // leaving and meeting the ground
    }
  };
  return {
    get mode() { return mode; },
    foot,
    // Footfalls a second while moving, for the metabolic cost.
    get rate() { return env > 0 ? (mode === 'walk' ? 1 : 2) / T : 0; },
    reset() { ph = 0; env = 0; oy = 0; ox = 0; n = 0; },
    step(p: Player, hs: number, gl: number, dt: number, running: boolean) {
      const L = SUIT.L;
      const vRun = Math.sqrt(SUIT.frRun * gl * L);
      const moving = p.onGround && !p.pushing && !p.fall && p.charge === 0 && hs > 0.08 && hs < 1.6 * vRun;
      if (!moving) {
        // Coming to rest: the body settles over both feet.
        env = Math.max(0, env - dt / 0.25);
        oy *= env; ox *= env;
        if (env === 0) ph = 0;
        return { y: oy, x: ox, swing: n * Math.PI + ph * Math.PI, amt: 0 };
      }
      const grade = hs > 0.01 ? p.vel.y / hs : 0;
      if (env === 0 && ph === 0) plan(hs, gl, L, grade);
      env = Math.min(1, env + dt / 0.25);
      ph += dt / T;
      if (ph >= 1) {
        ph -= 1; n++; side = -side; second = false;
        plan(hs, gl, L, grade);
        if (mode === 'walk') strike(p, running ? 0.4 : 0.32, s * 0.45, hs);
        else {
          strike(p, Math.min(1, 0.25 + vy * 0.9), hs * GAIT.contact * 0.2, hs);
          if (td > 0.25) dust.burst(p.pos.x, p.pos.y - EYE + p.crouch, p.pos.z, Math.min(0.4, 0.08 + vy * 0.5));
        }
      }
      const t = ph * T;
      if (mode === 'walk') {
        // Both feet down for the first share of the step, then the vault.
        const tD = GAIT.double * T, a = s * (1 - GAIT.double) / 2;
        const top = Math.sqrt(L * L - a * a), m = hs * a / top;
        if (t < tD) { const u = t / tD; oy = -m * tD * u * (1 - u); }
        else { const x = -a + hs * (t - tD); oy = Math.sqrt(Math.max(L * L - x * x, 0)) - top; }
        // Sideways, an inverted pendulum over each foot in turn.
        const w = Math.sqrt(gl / L), c = Math.cosh(w * T / 2);
        ox = side * (GAIT.base / 2) * (1 - Math.cosh(w * (t - T / 2)) / c);
      } else {
        // The stance, then the flight; vy at both joins.
        const tc = T - td;
        if (t < tc) {
          oy = -(vy * tc / Math.PI) * Math.sin(Math.PI * t / tc);
          if (!second && t > tc * 0.35) { second = true; strike(p, Math.min(0.8, 0.2 + vy * 0.6), hs * tc * 0.6 + 0.25, hs); }
        } else { const f = t - tc; oy = vy * f - 0.5 * gl * f * f; }
        // A skip keeps both feet under you, so the body hardly sways.
        ox *= 1 - Math.min(1, dt * 4);
      }
      oy *= env; ox *= env;
      return { y: oy, x: ox, swing: n * Math.PI + ph * Math.PI, amt: Math.min(hs / 2, 1) };
    },
  };
})();

export function setViewMotion(v: ViewMotion) { return (viewMotion = v); }
