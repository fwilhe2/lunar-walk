/* ═════════════════════════════════════════════════════════════
   11b. SOUND — what reaches the ear in a pressure suit, generated.

   In vacuum nothing outside reaches you at all. What you hear comes
   through the suit: your own breathing in the helmet, the fans and
   pump of the backpack, your boots striking the ground carried up
   through your bones, the jets hissing through the backpack frame,
   the rover's hub motors and suspension through the seat — Apollo
   crews heard their rover only that way. And in the headset, the
   Quindar tones: 2525 Hz keying the transmitter, 2475 Hz unkeying it.

   On Mars six millibars of CO₂ carries sound, badly: it arrives about
   20 dB quieter than it would at home, and the high frequencies die
   within metres, absorbed by the gas. Perseverance's microphones found
   that sound above about 240 Hz even travels some 10 m/s faster than
   below it — a split far too small to hear at arm's length, so it is
   not modelled. Wind comes through as a low rumble. On Venus the air
   is a twentieth as dense as water: sound carries loud and far, and a
   breeze of a metre a second is a roar.

   Everything is synthesised from noise and oscillators, nothing is
   fetched, and nothing plays until you click or press a key, as
   browsers require. The headless probe does neither; it renders the
   same graph into an OfflineAudioContext instead (_offline).
   ═════════════════════════════════════════════════════════════ */
export const sound = (() => {
  const STORE = 'surfacewalk.mute';
  let muted = false;
  try { muted = localStorage.getItem(STORE) === '1'; } catch (e) { /* no storage */ }
  let ctx = null, out = null, suitIn = null, airIn = null, airLP = null, airGain = null, noise = null;
  const v: Record<string, any> = {};           // the continuous voices
  let exertion = 0.15, nextBreath = 0, gust = 0.5, gustT = 0;
  let medium = { air: 0, lp: 20000, wind: 0, windLP: 400 };
  const LEVEL = 0.9;

  const filt = (type, f, q?) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q ?? 0.707; return b; };
  const amp = (g) => { const n = ctx.createGain(); n.gain.value = g; return n; };
  const chain = (...n) => { for (let i = 0; i < n.length - 1; i++) n[i].connect(n[i + 1]); return n[n.length - 1]; };
  function loopNoise(offset) {
    const s = ctx.createBufferSource();
    s.buffer = noise; s.loop = true; s.start(0, offset);
    return s;
  }
  function osc(type, f) { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; o.start(); return o; }

  function build(c) {
    ctx = c;
    noise = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    out = amp(muted ? 0 : LEVEL);
    chain(out, c.createDynamicsCompressor(), c.destination);

    // Through the suit: bone, and the air in a closed helmet, which
    // rings a little around 900 Hz and passes almost nothing high.
    suitIn = amp(1);
    const ring = filt('peaking', 900, 1.2); ring.gain.value = 4;
    chain(suitIn, ring, filt('lowpass', 3200), out);
    // Through the air outside, where there is any (setWorld).
    airIn = amp(1); airLP = filt('lowpass', 20000); airGain = amp(0);
    chain(airIn, airLP, airGain, out);

    // The backpack: fans and a water pump that never stop.
    chain(loopNoise(0.3), filt('bandpass', 700, 0.8), amp(0.03), suitIn);
    chain(osc('sine', 118), amp(0.010), suitIn);
    chain(osc('sine', 236), amp(0.004), suitIn);
    // Breath: one voice whose band and level the pacer moves.
    v.breathF = filt('bandpass', 1000, 1.1); v.breathG = amp(0);
    chain(loopNoise(0.9), v.breathF, v.breathG, suitIn);
    // Jets: cold nitrogen through the backpack frame.
    v.jetG = amp(0);
    chain(loopNoise(1.4), filt('highpass', 900), filt('lowpass', 5200), v.jetG, suitIn);
    // Rover: four hub motors and their harmonic drives, through the
    // seat — and through the air too, where there is any.
    v.motor = osc('sawtooth', 60); v.motorG = amp(0);
    chain(v.motor, filt('lowpass', 1400, 0.8), v.motorG, suitIn);
    v.motorG.connect(airIn);
    v.gear = osc('triangle', 180); v.gearG = amp(0);
    chain(v.gear, v.gearG, suitIn);
    // Wind, where there is air to move.
    v.windF = filt('lowpass', 400); v.windG = amp(0);
    chain(loopNoise(0.1), v.windF, v.windG, airIn);
    applyMedium();
  }

  function applyMedium() {
    if (!ctx) return;
    airGain.gain.value = medium.air;
    airLP.frequency.value = medium.lp;
    v.windF.frequency.value = medium.windLP;
  }

  // One breath, in then out; faster and deeper the harder you work.
  function breathe(t0) {
    const rate = 11 + 22 * exertion;                 // breaths a minute
    const T = 60 / rate, tin = T * 0.4, tex = T * 0.5;
    const a = 0.02 + 0.07 * exertion;
    const g = v.breathG.gain, f = v.breathF.frequency;
    f.setValueAtTime(1300, t0);
    g.setTargetAtTime(a, t0, tin * 0.3);
    g.setTargetAtTime(0, t0 + tin * 0.8, tin * 0.15);
    f.setValueAtTime(760, t0 + tin);
    g.setTargetAtTime(a * 0.8, t0 + tin, tex * 0.25);
    g.setTargetAtTime(0, t0 + tin + tex * 0.7, tex * 0.2);
    nextBreath = t0 + T;
  }

  // A boot on the ground: the strike, carried up the leg as a dead
  // low thud, and the grit under the sole — which in vacuum only the
  // boot can carry, and which on Mars and Venus the air carries too.
  // A boot on soil is a dull thud that the regolith soaks up; on rock
  // nothing gives, and it comes through the bones as a sharper knock,
  // higher and shorter, with a click and no grit.
  function thump(k, t0, hard = false) {
    k = Math.max(0.02, Math.min(1.5, k));
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(hard ? 150 : 75, t0);
    o.frequency.exponentialRampToValueAtTime(hard ? 70 : 38, t0 + (hard ? 0.07 : 0.14));
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.45 * k, t0 + (hard ? 0.002 : 0.006));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + (hard ? 0.12 : 0.22));
    chain(o, g, suitIn);
    o.start(t0); o.stop(t0 + 0.25);
    const n = ctx.createBufferSource(), gg = ctx.createGain();
    n.buffer = noise;
    gg.gain.setValueAtTime(0.0001, t0);
    gg.gain.exponentialRampToValueAtTime((hard ? 0.1 : 0.16) * k, t0 + 0.004);
    gg.gain.exponentialRampToValueAtTime(0.0001, t0 + (hard ? 0.035 : 0.1));
    chain(n, filt('bandpass', hard ? 3800 + Math.random() * 1200 : 1800 + Math.random() * 900, hard ? 2 : 0.9), gg);
    gg.connect(suitIn); gg.connect(airIn);
    n.start(t0, Math.random() * 1.5); n.stop(t0 + 0.12);
  }

  function beep(f, t0, d) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = f;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.035, t0 + 0.005);
    g.gain.setValueAtTime(0.035, t0 + d - 0.005);
    g.gain.linearRampToValueAtTime(0, t0 + d);
    chain(o, g, out);                          // the headset: straight in
    o.start(t0); o.stop(t0 + d + 0.01);
  }

  const live = () => ctx && ctx.state === 'running';

  return {
    // On a click or key press: the first builds the graph.
    unlock() {
      if (!ctx) {
        const AC = window.AudioContext || (window as any).webkitAudioContext;
        if (!AC) return;
        try { build(new AC()); } catch (e) { return; }
      }
      if (ctx.state === 'suspended') ctx.resume();
    },
    toggleMute() {
      muted = !muted;
      try { localStorage.setItem(STORE, muted ? '1' : '0'); } catch (e) { /* no storage */ }
      if (out) out.gain.setTargetAtTime(muted ? 0 : LEVEL, ctx.currentTime, 0.05);
      return muted;
    },
    setWorld(w) {
      // Wind noise goes with dynamic pressure, ½ρv²: a 1 m/s breeze on
      // Venus is 32 Pa, a 10 m/s wind on Mars 1 Pa — thirty decibels
      // apart, with Mars's just audible over the backpack.
      medium = w.medium ? w.medium
        : w.drag ? { air: 1.0, lp: 9000, wind: 0.30, windLP: 140 }     // Venus
        : w.air ? { air: 0.18, lp: 1600, wind: 0.22, windLP: 380 }             // Mars
        : { air: 0, lp: 20000, wind: 0, windLP: 400 };                         // vacuum
      applyMedium();
    },
    step(k, hard?) { if (live()) thump(k, ctx.currentTime, hard); },
    quindar() { if (live()) { beep(2525, ctx.currentTime, 0.25); beep(2475, ctx.currentTime + 1.1, 0.25); } },
    /* Once a frame. work: 0–1, how hard you are going; jets: axes
       firing; rover: null, or { v, drive }. */
    update(dt, work, jets, rover) {
      if (!live()) return;
      const t = ctx.currentTime;
      // Breathing follows effort, and recovers from it slowly.
      const target = 0.12 + 0.88 * work;
      exertion += (target - exertion) * Math.min(1, dt / (target > exertion ? 6 : 25));
      if (t >= nextBreath - 0.05) breathe(Math.max(t, nextBreath));
      v.jetG.gain.setTargetAtTime(0.06 * jets, t, 0.03);
      const sp = rover ? Math.min(Math.abs(rover.v) / 3.6, 1.4) : 0;
      v.motor.frequency.setTargetAtTime(55 + 240 * sp, t, 0.08);
      v.gear.frequency.setTargetAtTime(170 + 740 * sp, t, 0.08);
      v.motorG.gain.setTargetAtTime(rover ? 0.012 + 0.05 * rover.drive + 0.02 * Math.min(sp, 1) : 0, t, 0.1);
      v.gearG.gain.setTargetAtTime(rover ? 0.006 * Math.min(sp, 1) : 0, t, 0.1);
      gustT -= dt;
      if (gustT <= 0) { gust = Math.random(); gustT = 2 + Math.random() * 6; }
      v.windG.gain.setTargetAtTime(medium.wind * (0.35 + 0.65 * gust), t, 1.5);
    },
    get muted() { return muted; },
    // For the probe: the same graph on an OfflineAudioContext, and the
    // pieces to drive it with, scheduled at explicit times.
    _offline(c, w) {
      build(c);
      this.setWorld(w);
      return { v, thump, breathe, beep, suitIn, airIn, setExertion: (e) => { exertion = e; } };
    },
  };
})();
