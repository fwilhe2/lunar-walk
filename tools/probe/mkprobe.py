#!/usr/bin/env python3
"""Build probe.html from index.html: error hooks, a frame hook after
composer.render(), and a driver started in place of the opening overlay.
Every anchor must match exactly once, so a change to index.html that
moves one fails here instead of producing a probe that silently hangs.

    mkprobe.py DRIVER.js [OUT.html]
"""
import os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
driver = open(sys.argv[1]).read()
out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(ROOT, 'probe.html')
src = open(os.path.join(ROOT, 'index.html')).read()


def rep(a, b):
    global src
    n = src.count(a)
    if n != 1:
        sys.exit('mkprobe: anchor found %d times: %r' % (n, a[:80]))
    src = src.replace(a, b)


rep("  composer.render();\n",
    "  composer.render();\n  if (window.__afterRender) window.__afterRender();\n")
rep("      if (!everStarted) { overlay.hidden = false; hud.classList.add('lift'); }",
    "      if (!window.__probeStarted) { window.__probeStarted = 1; everStarted = true; setTimeout(__probeMain, 0); }")

hooks = """<script>
(function () {
  const R = (m) => navigator.sendBeacon('/report?m=' + encodeURIComponent(m));
  window.__R = R;
  window.onerror = (m, s, l, c) => R('ERR ' + m + ' @' + l + ':' + c);
  window.onunhandledrejection = (e) => R('REJECT ' + (e.reason && e.reason.stack || e.reason));
  const ce = console.error, cw = console.warn;
  console.error = (...a) => { R('CERR ' + a.join(' ').slice(0, 600)); ce(...a); };
  console.warn = (...a) => { R('CWARN ' + a.join(' ').slice(0, 600)); cw(...a); };
  const W = window.Worker;
  window.Worker = function (u, o) { const w = new W(u, o); w.addEventListener('error', (e) => R('WERR ' + e.message)); return w; };
})();
</script>
"""
i = src.index('<script')
src = src[:i] + hooks + src[i:]
lib = open(os.path.join(HERE, 'lib.js')).read()
k = src.rindex('</script>')
src = src[:k] + '\n' + lib + '\n' + driver + '\n' + src[k:]
open(out, 'w').write(src)
