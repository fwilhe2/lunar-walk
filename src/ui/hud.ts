import { sound } from '../audio/sound';
import { mode } from '../player/player';
import { world } from '../worlds/index';

export let noteTimer = 0;
export const el = {
  mode: document.getElementById('r-mode'),
  g: document.getElementById('r-g'), body: document.getElementById('r-body'),
  met: document.getElementById('r-met'),
  v: document.getElementById('r-v'), a: document.getElementById('r-a'),
  p: document.getElementById('r-p'), s: document.getElementById('r-s'),
  world: document.getElementById('r-world'), site: document.getElementById('r-site'),
  note: document.getElementById('r-note'),
  fps: document.getElementById('r-fps'),
  hdg: document.getElementById('r-hdg'), home: document.getElementById('r-home'),
  doseLine: document.getElementById('r-doseline'),
  pushLine: document.getElementById('r-pushline'), push: document.getElementById('r-push'),
  gasLine: document.getElementById('r-gasline'), gas: document.getElementById('r-gas'),
  dose: document.getElementById('r-dose'), rate: document.getElementById('r-rate'),
};
// What you have soaked up since arriving, where that is worth showing.
export let doseSv = 0;

// radio: it came over the loop, so it gets the Quindar tones.
export function note(text, radio) {
  el.note.textContent = text;
  noteTimer = 3.5;
  if (radio) sound.quindar();
}

// Keycaps in one right-aligned column, what they do beside them; two
// pairs of columns, the mode's own controls above the rest. A key spec
// is space-separated caps; '–' and '/' stand between them as text.
export function updateKeysHelp() {
  let head, own, aside = '';
  if (mode === 'ROVER') {
    head = 'Rover';
    own = [['W S', 'throttle / brake'], ['A D', 'steer'], ['R', 'dismount'], ['F', 'fly']];
  } else if (mode === 'FLY') {
    head = 'Flight';
    own = [['WASD', 'thrust'], ['Shift', 'boost'], ['Space', 'up'], ['C', 'down'], ['F', 'land']];
    if (world.rover) own.push(['R', 'rover']);
  } else if (world.jets) {
    head = 'On foot · jets';
    own = [['WASD', 'jets'], ['C', 'jet down'], ['Space', 'push off · jet up'], ['F', 'fly']];
    aside = 'Hold Space to crouch, release to push off; in the air it fires the jets. The beacon recharges them.';
  } else {
    head = 'On foot';
    own = [['WASD', 'walk'], ['Shift', 'run'], ['Space', 'crouch, release to push'], ['R', 'rover'], ['F', 'fly']];
  }
  const all = [
    ['Esc', 'worlds'], ['1 – 9 − = ⌫', 'switch world · Shift: more'], ['[ ]', 'sun elevation'], ['G', 'gravity'],
    ['Z', 'zoom · right button'], ['P', 'photo'], ['H', 'hide HUD'], ['V', 'head motion'], ['L', 'copy link'],
    ['Q', 'quality'], ['M', 'sound'], ['0', 'demo'],
  ];
  const cap = (t) => t === '–' || t === '/' ? '<i>' + t + '</i>' : '<b>' + t + '</b>';
  // Each section starts on a fresh row, so the gap between the pairs is
  // set per section: after every left-hand label.
  const rows = (list) => list.map(([k, what], i) => '<span class="kk">' + k.split(' ').map(cap).join('') +
    '</span><span class="kl' + (i % 2 ? '' : ' gap') + '">' + what + '</span>').join('');
  document.getElementById('keys').innerHTML =
    '<h5>' + head + '</h5>' + rows(own) + (aside ? '<p>' + aside + '</p>' : '') + '<h5>General</h5>' + rows(all);
}

export const overlay = document.getElementById('overlay');
export const hud = document.getElementById('hud');
// The opening screen dims the world behind its title. Once you have
// been down there, Esc only brings up the world picker and leaves the
// view alone — you can still look at it, and photograph it (P). The
// readout steps up out of the picker's way.
export function showOverlay(on) {
  overlay.classList.toggle('hidden', !on);
  hud.classList.toggle('lift', on);
}
export let locked = false;
export let hudTimer = 0, hudSpeed = 0;

export function setLocked(v) { return (locked = v); }

export function setDoseSv(v) { return (doseSv = v); }

export function setNoteTimer(v) { return (noteTimer = v); }

export function setHudTimer(v) { return (hudTimer = v); }

export function setHudSpeed(v) { return (hudSpeed = v); }
