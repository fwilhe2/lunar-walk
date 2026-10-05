import { byId } from '../util/dom';

/* ═════════════════════════════════════════════════════════════
   CHANGING WORLD
   Everything that is not the renderer itself gets rebuilt: the
   terrain kernel is repointed, the workers are restarted on the
   new body, the streamed ground and its rocks are thrown away,
   and the sky is re-hung. Textures and sky bodies are cached by
   world, so the first visit to each pays for its own generation
   and every visit after it is immediate.
   ═════════════════════════════════════════════════════════════ */
export const boot = byId('boot');
/* Where the session stands, written from several modules (worlds.ts,
   view-hash.ts, controls.ts, main.ts), hence one object rather than
   module bindings, which only their own module may assign. */
export const session = {
  initialized: false,    // the first world has been applied
  loading: false,        // a world or a shared view is streaming in behind the loading screen
  everStarted: false,    // you have been down on the surface (pointer locked) at least once
  siteH: 0,              // ground at the landing site
};
export function bootShow(name: string, frac: number, text: string) {
  boot.innerHTML = '<div class="t">' + name + '</div><div class="bar"><i style="width:' + (frac * 100).toFixed(1) + '%"></i></div>' +
    '<div class="n">' + text + '</div>';
}


