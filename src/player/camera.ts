import { input, keys } from './input';
import { player } from './player';
import { sunElev } from '../render/lights';
import { FOV0, camera, renderer } from '../render/renderer';
import { note } from '../ui/hud';
import { worldId } from '../worlds/index';

/* ── Zoom and photographs ───────────────────────────────────────
   Hold the right button, or Z, for a long lens: 72° eases to 15°,
   about a 250 mm lens on the Hasselblads the Apollo crews carried,
   which puts Earth across a third of the frame and Charon's canyons
   in reach. Level of detail goes by distance, not by what the lens
   magnifies, so it stops there: much narrower and the far rings'
   facets show. Stars are points and stay points, and dust sizes
   itself by the lens (§9). The eye meters whatever the lens is on,
   so zoom onto a full Earth and it stops down until the clouds are
   back.

   P saves the frame as a PNG at full resolution — the canvas holds no
   HUD, so nothing needs hiding — and H hides the HUD for looking. */
const FOV_ZOOM = 15;
export let zoomHeld = false, zoomT = 0, photoPending = false;
renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
renderer.domElement.addEventListener('mousedown', (e) => { if (e.button === 2) zoomHeld = true; });
addEventListener('mouseup', (e) => { if (e.button === 2) zoomHeld = false; });
export function stepZoom(dt) {
  const target = zoomHeld || keys.KeyZ || input.zoom ? 1 : 0;
  if (zoomT === target) return;
  zoomT += (target - zoomT) * Math.min(1, dt * 8);
  if (Math.abs(target - zoomT) < 0.002) zoomT = target;
  camera.fov = FOV0 * Math.pow(FOV_ZOOM / FOV0, zoomT);   // even in log: a steady zoom
  camera.updateProjectionMatrix();
}
export function takePhoto() {
  const f = (x) => Math.round(x);
  const name = 'surface-walk_' + worldId + '_' + f(player.pos.x) + 'E_' + f(-player.pos.z) + 'N_sun' +
    (sunElev * 180 / Math.PI).toFixed(0) + '.png';
  renderer.domElement.toBlob((b) => {
    if (!b) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  }, 'image/png');
  note('PHOTO ' + name);
}

export function setPhotoPending(v) { return (photoPending = v); }
