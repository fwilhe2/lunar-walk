/* ── Effort ────────────────────────────────────────────────────
   What moving costs you, as metabolic power. A pressurised suit costs
   about 140 W just to stand in. Each step then costs work against the
   suit's own joints, which does not care about gravity, and a share
   of your weight carried along, which does: net cost of transport is
   about 0.2 of weight per metre walking and 0.35 loping, as on Earth.
   Climbing is weight times rate of climb, through muscle at 25%. On
   the Moon that comes to ~280 W walking and ~400 W loping, the span
   the Apollo crews' metabolic telemetry ran over (Waligora & Horrigan
   1975: 200–300 kcal/h, 230–350 W, averaged over whole EVAs, and well
   above that hauling up Cone crater's flank); heart rate follows at about 0.2 beat a
   minute per watt, lagging by tens of seconds as it does. */
/* Above what can be held for an hour — critical power, about 1 kW of
   metabolism for a fit astronaut — effort draws on a reserve of some
   80 kJ that only refills below it (Monod & Scherrer 1965). Empty, you
   cannot keep up a run until you have got a third of it back. */
export const EFFORT = { rest: 140, step: 75, walk: 0.2, lope: 0.35, eff: 0.25, cp: 1000, reserve: 80000 };
export const effort = {
  W: EFFORT.rest, Wf: EFFORT.rest, hr: 72, kick: 0, left: EFFORT.reserve, winded: false,
  // Energy spent at once — a push — joins the next second's rate.
  spend(J: number) { this.kick += J; },
  update(dt: number, P: number) {
    const kick = Math.min(this.kick, 1500 * dt);   // a push is paid off over a second or so
    this.kick -= kick;
    // A fit astronaut's aerobic ceiling is about 4 L of O₂ a minute,
    // 1.4 kW; past it the rest is borrowed, and shows as heart rate.
    const raw = P + kick / Math.max(dt, 1e-3);
    this.left = Math.min(EFFORT.reserve, Math.max(0, this.left + (EFFORT.cp - raw) * dt));
    if (this.left === 0) this.winded = true;
    else if (this.left > EFFORT.reserve / 3) this.winded = false;
    const inst = Math.min(1400, raw);
    this.Wf += (inst - this.Wf) * (1 - Math.exp(-dt / 2));       // for the breath, which answers fast
    this.W += (inst - this.W) * (1 - Math.exp(-dt / 12));        // what the readout shows
    const hrT = Math.min(185, 72 + 0.2 * (this.W - EFFORT.rest));
    this.hr += (hrT - this.hr) * (1 - Math.exp(-dt / (hrT > this.hr ? 15 : 40)));
  },
};
