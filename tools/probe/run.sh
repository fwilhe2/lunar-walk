#!/usr/bin/env bash
# Drive the app in headless Firefox (software GL) and collect shots.
#
#   tools/probe/run.sh DRIVER.js [OUT_DIR] [WIDTHxHEIGHT] [TIMEOUT_S]
#
# OUT_DIR gets probe.log, shots/*.jpg and a Firefox profile of its own.
# The driver is a file defining `async function drive(probe)`; see lib.js.
# Only the processes this script starts are ever killed, and probe.html
# is removed on the way out.
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
ROOT=$(cd "$HERE/../.." && pwd)
DRIVER=$(realpath "$1")
OUT=$(realpath -m "${2:-${TMPDIR:-/tmp}/lunar-walk-probe}")
SIZE=${3:-960x540}
TIMEOUT=${4:-1800}
PORT=${PROBE_PORT:-8765}
mkdir -p "$OUT/shots" "$OUT/profile"
rm -f "$OUT/probe.log"
cat >| "$OUT/profile/user.js" <<'PREFS'
user_pref("webgl.force-enabled", true);
user_pref("gfx.webrender.software", true);
user_pref("toolkit.startup.max_resumed_crashes", -1);
user_pref("browser.shell.checkDefaultBrowser", false);
user_pref("datareporting.policy.dataSubmissionEnabled", false);
user_pref("browser.startup.homepage_override.mstone", "ignore");
user_pref("dom.min_background_timeout_value", 4);
PREFS

python3 "$HERE/mkprobe.py" "$DRIVER" "$ROOT/probe.html" || exit 1

python3 "$HERE/server.py" "$OUT" "$PORT" >| "$OUT/server.out" 2>&1 &
SERVER=$!
FF=""
tree() { for c in $(pgrep -P "$1"); do tree "$c"; echo "$c"; done; }
cleanup() {
  [ -n "$FF" ] && kill $(tree "$FF") "$FF" 2>/dev/null
  kill "$SERVER" 2>/dev/null
  rm -f "$ROOT/probe.html"
}
trap cleanup EXIT INT TERM
sleep 1

W=${SIZE%x*}; H=${SIZE#*x}
LIBGL_ALWAYS_SOFTWARE=1 MOZ_HEADLESS=1 MOZ_HEADLESS_WIDTH=$W MOZ_HEADLESS_HEIGHT=$H \
  firefox --profile "$OUT/profile" --no-remote --new-instance \
  "http://127.0.0.1:$PORT/probe.html" >| "$OUT/firefox.out" 2>&1 &
FF=$!

T0=$(date +%s)
while :; do
  sleep 3
  if grep -q ' DONE$' "$OUT/probe.log" 2>/dev/null; then break; fi
  if ! kill -0 "$FF" 2>/dev/null; then echo "firefox exited early"; tail -5 "$OUT/firefox.out"; break; fi
  if [ $(( $(date +%s) - T0 )) -gt "$TIMEOUT" ]; then echo "timed out after ${TIMEOUT}s"; break; fi
done
cat "$OUT/probe.log" 2>/dev/null
