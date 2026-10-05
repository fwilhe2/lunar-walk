/* ═════════════════════════════════════════════════════════════
   CHANGING WORLD
   Everything that is not the renderer itself gets rebuilt: the
   terrain kernel is repointed, the workers are restarted on the
   new body, the streamed ground and its rocks are thrown away,
   and the sky is re-hung. Textures and sky bodies are cached by
   world, so the first visit to each pays for its own generation
   and every visit after it is immediate.
   ═════════════════════════════════════════════════════════════ */
export const boot = document.getElementById('boot');
export let initialized = false;
export let SITE_H = 0;                   // ground at the landing site
export let loading, everStarted = false;
export function bootShow(name, frac, text) {
  boot.innerHTML = '<div class="t">' + name + '</div><div class="bar"><i style="width:' + (frac * 100).toFixed(1) + '%"></i></div>' +
    '<div class="n">' + text + '</div>';
}

export function setEverStarted(v) { return (everStarted = v); }

export function setLoading(v) { return (loading = v); }

export function setInitialized(v) { return (initialized = v); }

export function setSITE_H(v) { return (SITE_H = v); }


