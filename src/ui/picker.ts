import { applyWorld, worldUI } from '../app/worlds';
import { renderer } from '../render/renderer';
import { overlay } from './hud';
import { WORLD_IDS } from '../worlds/index';
import { VIEW } from '../worlds/index';

/* ── Boot: stream the opening rings, then hand over. ─────────── */
/* ── World picker ─────────────────────────────────────────────
   A strip along the bottom of the opening screen. The first level
   shows the planets at their true relative size, the sun cropped at
   the left in the same scale; choosing a system zooms in: its planet
   grows into the cropped arc at the left, the neighbours fly out, and
   its moons come in, again at true size among themselves. Bodies that
   can't be walked yet are shown, dimmed — the walkable ones are
   exactly WORLD_IDS, so a new world lights up here once it is listed
   there and below. Radii in km; colours are only for the silhouettes. */
export const picker = (() => {
  const B = {
    sun: { r: 696000 },
    mercury: { r: 2440, c: '#a39d95' }, venus: { r: 6052, c: '#dcc596' },
    earth: { n: 'Earth', r: 6371, c: '#7d9cc4' }, moon: { r: 1737, c: '#bdb9b2' },
    mars: { r: 3390, c: '#c4744c' }, phobos: { r: 11.3, c: '#86796e' }, deimos: { r: 6.2, c: '#a3937f' },
    vesta: { n: 'Vesta', r: 263, c: '#a59d92' }, ceres: { r: 470, c: '#7d7a76' },
    jupiter: { n: 'Jupiter', r: 69911, c: '#cfae8c', gas: true },
    io: { r: 1822, c: '#dcc65e' }, europa: { r: 1561, c: '#d2c8b5' },
    ganymede: { n: 'Ganymede', r: 2634, c: '#9e958a' }, callisto: { n: 'Callisto', r: 2410, c: '#756b62' },
    saturn: { n: 'Saturn', r: 58232, c: '#dcc794', gas: true },
    mimas: { n: 'Mimas', r: 198, c: '#bfbcb8' }, enceladus: { r: 252, c: '#eef3f6' },
    tethys: { n: 'Tethys', r: 531, c: '#d8d8d5' }, dione: { n: 'Dione', r: 561, c: '#cbc9c5' },
    rhea: { n: 'Rhea', r: 764, c: '#c6c3be' }, titan: { n: 'Titan', r: 2575, c: '#d3a458' },
    iapetus: { n: 'Iapetus', r: 735, c: '#8d7d6b' },
    uranus: { n: 'Uranus', r: 25362, c: '#acd7de', gas: true },
    miranda: { n: 'Miranda', r: 236, c: '#b2b1ae' }, ariel: { n: 'Ariel', r: 579, c: '#bfbebb' },
    umbriel: { n: 'Umbriel', r: 585, c: '#7e7d7b' }, titania: { n: 'Titania', r: 789, c: '#b5aea7' },
    oberon: { n: 'Oberon', r: 761, c: '#a59c94' },
    neptune: { n: 'Neptune', r: 24622, c: '#7193d8', gas: true }, triton: { n: 'Triton', r: 1353, c: '#d8cac2' },
    pluto: { r: 1188, c: '#d6b698' }, charon: { r: 606, c: '#a8a49f' },
  };
  // In order out from the sun; moons in order out from their planet.
  const SYS = [
    ['mercury'], ['venus'], ['earth', 'moon'], ['mars', 'phobos', 'deimos'], ['vesta'], ['ceres'],
    ['jupiter', 'io', 'europa', 'ganymede', 'callisto'],
    ['saturn', 'mimas', 'enceladus', 'tethys', 'dione', 'rhea', 'titan', 'iapetus'],
    ['uranus', 'miranda', 'ariel', 'umbriel', 'titania', 'oberon'], ['neptune', 'triton'], ['pluto', 'charon'],
  ].map(([id, ...moons]) => ({ id, moons }));
  const sysOf = {};
  for (const s of SYS) for (const id of [s.id, ...s.moons]) sysOf[id] = s.id;
  for (const id of WORLD_IDS) if (!sysOf[id]) console.warn('world picker: no entry for', id);
  const walk = (id) => WORLD_IDS.includes(id);
  const name = (id) => walk(id) ? VIEW[id].name : B[id].n;
  const members = (s) => [s.id, ...s.moons];
  const avail = (s) => members(s).some(walk);
  const first = (s) => members(s).find(walk);
  const SYSM = Object.fromEntries(SYS.map((s) => [s.id, s]));

  const root = document.getElementById('picker');
  const els = new Map();
  // cur: the keyboard's cursor, drawn like a hover.
  const st = { level: 1, view: 'earth', body: 'moon', cur: 'earth' };
  const MINR = 1.3;
  const px = (n) => n.toFixed(1) + 'px';
  const halfW = (id, r) => id === 'saturn' ? r * 2.27 : (id === 'phobos' || id === 'deimos') ? r * 1.18 : r;
  const on = (o, ok) => (o ? ' on' : '') + (ok ? '' : ' off');
  const cur = (id) => id === st.cur ? ' hov' : '';
  function kmpx(sc) {
    const v = 1 / sc;
    if (v < 100) return '1 px ≈ ' + +v.toPrecision(2) + ' km';
    const p = Math.pow(10, Math.floor(Math.log10(v)) - 1);
    return '1 px ≈ ' + (Math.round(v / p) * p).toLocaleString('en').replace(/,/g, ' ') + ' km';
  }
  // Spread slots of the given widths over [x0, x1], spare room shared out.
  function pack(ws, x0, x1) {
    const extra = Math.max(0, (x1 - x0 - ws.reduce((a, b) => a + b, 0)) / ws.length);
    let x = x0;
    return ws.map((w) => { const sw = w + extra, c = x + sw / 2; x += sw; return { c, sw }; });
  }
  const sub = (id) => walk(id) ? VIEW[id].gTxt : B[id].gas ? 'no surface' : 'not yet';
  const disc = (key, id, cx, cy, r, cls, op) => {
    const lumpy = id === 'phobos' || id === 'deimos';
    const w = lumpy ? r * 2.36 : r * 2, h = lumpy ? r * 1.68 : r * 2;
    return { key, id, cls: 'disc ' + cls + (lumpy ? ' lumpy' : ''),
      html: id === 'saturn' ? '<i class="ring sat"></i>' : id === 'uranus' ? '<i class="ring ura"></i>' : '',
      style: { left: px(cx - w / 2), top: px(cy - h / 2), width: px(w), height: px(h), 'font-size': px(r), '--c': B[id].c || '', opacity: op } };
  };
  const lbl = (key, id, x, y, html, cls, op) => ({ key, id, cls: 'lbl ' + cls, html, style: { left: px(x), top: px(y), opacity: op } });
  const hit = (key, id, x, w, h, act) => ({ key, id, tag: 'button', cls: 'hit' + (act ? '' : ' off'), act, label: name(id),
    style: { left: px(x), top: '0px', width: px(w), height: px(h) } });

  function layout(W, H) {
    const it = [], hb = Math.round(Math.max(96, Math.min(150, H * 0.19))), y = hb * 0.42, ly = hb * 0.72;
    it.push({ key: 'ecl', cls: 'ecl', style: { top: px(y) } });
    // Level one: one scale for the sun and every planet.
    const s1 = Math.min(hb * 0.3, W * 0.042) / B.jupiter.r;
    const P1 = pack(SYS.map((s) => Math.max(Math.min(64, W * 0.065), 2 * halfW(s.id, B[s.id].r * s1) + 12)), W * 0.07, W * 0.99);
    const sol = {};
    SYS.forEach((s, i) => (sol[s.id] = { ...P1[i], r: Math.max(MINR, B[s.id].r * s1) }));
    const sunR = B.sun.r * s1, sunC = W * 0.03 - sunR;
    // Level two: one scale for the moons, the planet cropped at the left
    // when it is too big to show whole.
    const L2 = st.level === 2, V = SYSM[st.view], sel = sysOf[st.body];
    let sc = s1, R = 0, full = true, pc = 0, edge = 0, K = 1, xp = 0;
    const mpos = {};
    if (L2) {
      const maxR = V.moons.length ? Math.max(...V.moons.map((m) => B[m].r)) : B[V.id].r;
      sc = hb * (V.moons.length ? 0.26 : 0.3) / maxR;
      R = B[V.id].r * sc; full = R <= hb * 0.36;
      pc = full ? W * 0.04 + R + 10 : W * 0.055 - R;
      edge = full ? pc + R : W * 0.055;
      xp = sol[V.id].c; K = Math.min(sc / s1, 30);
      const x0 = full ? edge + 44 : edge + 120, slot = Math.max(84, Math.min(120, W * 0.11));
      const P2 = pack(V.moons.map((m) => Math.max(2 * halfW(m, B[m].r * sc) + 16, slot)), x0, Math.min(W * 0.97, x0 + V.moons.length * slot * 1.15));
      V.moons.forEach((m, i) => (mpos[m] = { ...P2[i], r: Math.max(MINR, B[m].r * sc) }));
    }
    // Everything else flies out as if the camera zoomed onto the
    // planet's visible part. Dimming is opacity too, so it is set here.
    const away = (c) => (full ? pc : edge) + (c - xp) * K;
    const dim = (ok) => ok ? '1' : '0.28';
    it.push(disc('d:sun', 'sun', L2 ? away(sunC) : sunC, y, sunR, 'sun', L2 ? '0' : '1'));
    for (const s of SYS) {
      const S = sol[s.id], ok = avail(s), isP = L2 && s.id === V.id;
      let c = S.c, r = S.r, op = dim(ok), lx = S.c;
      if (isP) { c = pc; r = R; lx = full ? pc : edge + 46; op = dim(walk(s.id)); }
      else if (L2) { c = lx = away(S.c); r = S.r * Math.min(K, 3); op = '0'; }
      const o = isP ? st.body === s.id : !L2 && sel === s.id, k = isP ? walk(s.id) : ok;
      it.push(disc('d:' + s.id, s.id, c, y, r, 'tint' + on(o, k) + cur(s.id) + (isP ? ' primary' : ''), op));
      it.push(lbl('l:' + s.id, s.id, lx, ly,
        '<b>' + name(s.id) + '</b><small>' + (isP ? sub(s.id) : !ok ? 'later' : !s.moons.length ? sub(s.id) : '&nbsp;') + '</small>', on(o, k) + cur(s.id), op === '0' ? '0' : '1'));
      if (!L2) it.push(hit('h:' + s.id, s.id, S.c - S.sw / 2, S.sw, hb, ok ? 'zoom:' + s.id : ''));
      if (isP) it.push(hit('h:' + s.id, s.id, 0, full ? edge + 22 : edge + 104, hb, walk(s.id) ? 'body:' + s.id : ''));
      for (const m of s.moons) {
        const M = mpos[m], mc = M ? M.c : L2 ? away(S.c) : S.c, mo = st.body === m;
        it.push(disc('d:' + m, m, mc, y, M ? M.r : 0.5, 'tint' + on(mo, walk(m)) + cur(m), M ? dim(walk(m)) : '0'));
        it.push(lbl('l:' + m, m, mc, ly, '<b>' + name(m) + '</b><small>' + sub(m) + '</small>', on(mo, walk(m)) + cur(m), M ? '1' : '0'));
        if (M) it.push(hit('h:' + m, m, M.c - M.sw / 2, M.sw, hb, walk(m) ? 'body:' + m : ''));
      }
    }
    if (L2) {
      if (!V.moons.length) it.push(lbl('none', null, edge + 44, y - 7, '<small>no moons</small>', 'left note', '1'));
      it.push({ key: 'back', tag: 'button', act: 'back', cls: 'back', label: 'Back to the solar system',
        html: '‹ Solar system &nbsp;/&nbsp; <b>' + name(V.id) + '</b>', style: { left: px(edge + (full ? 16 : 10)), top: '7px' } });
    } else it.push({ key: 'crumb', cls: 'crumb', html: 'Solar system', style: { position: 'absolute', left: '12px', top: '8px' } });
    it.push(lbl('scale', null, W - 10, 8, '<small>' + kmpx(sc) + '</small>', 'right note', '1'));
    return { it, hb };
  }

  // Keyed: an element keeps its identity across levels, so moving
  // between them is a CSS transition rather than a rebuild.
  function paint(items) {
    const seen = new Set();
    for (const it of items) {
      const tag = it.tag || 'div';
      let el = els.get(it.key);
      if (el && el.tagName.toLowerCase() !== tag) { el.remove(); el = null; }
      if (!el) { el = document.createElement(tag); if (tag === 'button') el.type = 'button'; els.set(it.key, el); root.appendChild(el); }
      if (el.className !== it.cls) el.className = it.cls;
      if (it.html !== undefined && el._h !== it.html) { el.innerHTML = it.html; el._h = it.html; }
      if (it.id) el.dataset.id = it.id;
      if (it.act) el.dataset.act = it.act; else el.removeAttribute('data-act');
      if (tag === 'button') { el.setAttribute('aria-label', it.label || ''); el.setAttribute('aria-disabled', it.act ? 'false' : 'true'); }
      for (const k in it.style) el.style.setProperty(k, it.style[k]);
      seen.add(it.key);
    }
    for (const [k, el] of els) if (!seen.has(k)) { el.remove(); els.delete(k); }
  }
  // When the zoom last started, and so when it will have played out.
  let shown = '', busyUntil = 0;
  function render() {
    const key = st.level + st.view;
    if (key !== shown) { shown = key; busyUntil = performance.now() + 1000; }
    const { it, hb } = layout(innerWidth, innerHeight);
    root.style.height = hb + 'px';
    // The title panel centres in what the strip leaves free, and the
    // readout stands above it.
    overlay.style.paddingBottom = hb + 'px';
    document.documentElement.style.setProperty('--pick-h', hb + 'px');
    document.getElementById('resume').style.bottom = (hb - 23) + 'px';
    paint(it);
  }

  // The overlay behind it is the click target for pointer lock.
  root.addEventListener('click', (e) => {
    e.stopPropagation();
    const b = (e.target as Element).closest<HTMLElement>('[data-act]');
    if (!b) return;
    const [a, id] = b.dataset.act.split(':');
    if (a === 'zoom') zoom(id);
    else if (a === 'body' && id !== st.body) applyWorld(id);
    else if (a === 'back') { st.level = 1; st.cur = st.view; render(); }
  });
  // Zooming in picks the system's first walkable world, unless you
  // are on one of its worlds already — that would only reload it.
  function zoom(id) {
    st.level = 2; st.view = id;
    if (sysOf[st.body] === id) { st.cur = st.body; render(); } else applyWorld(first(SYSM[id]));
  }
  // What the arrows step through: the systems you can visit, or the
  // walkable bodies of the one zoomed into.
  const stops = () => st.level === 1 ? SYS.filter(avail).map((s) => s.id) : members(SYSM[st.view]).filter(walk);

  const unhover = () => root.querySelectorAll('.hov').forEach((n) => n.classList.remove('hov'));
  root.addEventListener('pointerover', (e) => {
    unhover();
    const b = (e.target as Element).closest<HTMLElement>('button[data-id]');
    if (b && b.dataset.act) root.querySelectorAll('[data-id="' + b.dataset.id + '"]').forEach((n) => n.classList.add('hov'));
  });
  root.addEventListener('pointerleave', unhover);
  addEventListener('resize', () => {
    root.classList.add('still');
    render();
    requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('still')));
  });

  return {
    // Called by applyWorld(): whichever way the world was chosen (keys,
    // pad, a shared link), a zoomed strip follows it to its system.
    // Resolves once the zoom has finished: heavy main-thread work waits
    // for it, or the animation would stall halfway.
    settled() {
      return new Promise<void>((r) => setTimeout(r, Math.max(0, busyUntil - performance.now())));
    },
    select(id) {
      st.body = id;
      if (st.level === 2) st.view = sysOf[id];
      st.cur = st.level === 1 ? sysOf[id] : id;
      render();
    },
    // While the picker is up, ← → move the cursor, ↓ zooms into the
    // system under it, ↑ back out, Enter goes there. True if taken.
    key(code) {
      if (overlay.hidden || overlay.classList.contains('hidden')) return false;
      const list = stops();
      if (code === 'ArrowLeft' || code === 'ArrowRight') {
        const i = list.indexOf(st.cur), n = list.length;
        st.cur = list[i < 0 ? 0 : (i + (code === 'ArrowRight' ? 1 : n - 1)) % n];
      } else if (code === 'ArrowDown' && st.level === 1) { zoom(st.cur); return true; }
      else if (code === 'ArrowUp' && st.level === 2) { st.level = 1; st.cur = st.view; }
      else if (code === 'Enter' || code === 'NumpadEnter') {
        // Enter on the world you are on resumes it.
        if (st.level === 1) zoom(st.cur);
        else if (st.cur !== st.body) applyWorld(st.cur);
        else renderer.domElement.requestPointerLock();
        return true;
      } else return code === 'ArrowUp' || code === 'ArrowDown';
      render();
      return true;
    },
  };
})();

worldUI.select = (id) => picker.select(id);
worldUI.settled = () => picker.settled();
