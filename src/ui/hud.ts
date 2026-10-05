import { sound } from '../audio/sound';
import { mode } from '../player/player';
import { world } from '../worlds/index';
import { byId } from '../util/dom';

/* The readout's own state, advanced by the loop (app/loop.ts), the
   physics and the pointer-lock handler. */
export const hudState = {
  locked: false,         // the pointer is locked: you are on the surface, not in the picker
  noteTimer: 0,          // s until the note line clears
  timer: 0,              // s until the readout refreshes
  speed: 0,              // m/s, as the physics last reported it
  doseSv: 0,             // what you have soaked up since arriving, where that is worth showing
};
export const el = {
  mode: byId('r-mode'),
  g: byId('r-g'), body: byId('r-body'),
  met: byId('r-met'),
  v: byId('r-v'), a: byId('r-a'),
  p: byId('r-p'), s: byId('r-s'),
  world: byId('r-world'), site: byId('r-site'),
  note: byId('r-note'),
  fps: byId('r-fps'),
  hdg: byId('r-hdg'), home: byId('r-home'),
  doseLine: byId('r-doseline'),
  pushLine: byId('r-pushline'), push: byId('r-push'),
  gasLine: byId('r-gasline'), gas: byId('r-gas'),
  dose: byId('r-dose'), rate: byId('r-rate'),
};

// radio: it came over the loop, so it gets the Quindar tones.
export function note(text: string, radio?: boolean) {
  el.note.textContent = text;
  hudState.noteTimer = 3.5;
  if (radio) sound.quindar();
}

// Keycaps in one right-aligned column, what they do beside them; two
// pairs of columns, the mode's own controls above the rest. A key spec
// is space-separated caps; '–' and '/' stand between them as text.
// A key spec and what it does.
type KeyRow = [keys: string, what: string];
export function updateKeysHelp() {
  let head: string, own: KeyRow[], aside = '';
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
  const all: KeyRow[] = [
    ['Esc', 'worlds'], ['1 – 9 − = ⌫', 'switch world · Shift: more'], ['[ ]', 'sun elevation'], ['G', 'gravity'],
    ['Z', 'zoom · right button'], ['P', 'photo'], ['H', 'hide HUD'], ['V', 'head motion'], ['L', 'copy link'],
    ['Q', 'quality'], ['M', 'sound'], ['0', 'demo'],
  ];
  const cap = (t: string) => t === '–' || t === '/' ? '<i>' + t + '</i>' : '<b>' + t + '</b>';
  // Each section starts on a fresh row, so the gap between the pairs is
  // set per section: after every left-hand label.
  const rows = (list: KeyRow[]) => list.map(([k, what], i) => '<span class="kk">' + k.split(' ').map(cap).join('') +
    '</span><span class="kl' + (i % 2 ? '' : ' gap') + '">' + what + '</span>').join('');
  byId('keys').innerHTML =
    '<h5>' + head + '</h5>' + rows(own) + (aside ? '<p>' + aside + '</p>' : '') + '<h5>General</h5>' + rows(all);
}

export const overlay = byId('overlay');
export const hud = byId('hud');
// The opening screen dims the world behind its title. Once you have
// been down there, Esc only brings up the world picker and leaves the
// view alone — you can still look at it, and photograph it (P). The
// readout steps up out of the picker's way.
export function showOverlay(on: boolean) {
  overlay.classList.toggle('hidden', !on);
  hud.classList.toggle('lift', on);
}
