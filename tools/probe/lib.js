/* Probe helpers, appended inside the page's module script, so a driver
   sees everything the page declares at module level: applyWorld,
   player, yawObj, pitchObj, keys, setMode, chunkStreamer, quality, …

   A driver defines   async function drive(probe) { … }
   and the page calls it once the opening world has loaded. */
const probe = (() => {
  let frame = 0, shotName = null, shotType = 'image/jpeg';
  window.__afterRender = () => {
    frame++;
    if (shotName) {
      const n = shotName; shotName = null;
      const url = renderer.domElement.toDataURL(shotType, 0.9);
      fetch('/shot?n=' + encodeURIComponent(n), { method: 'POST', body: url });
    }
  };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const api = {
    sleep,
    get frame() { return frame; },
    log: (m) => window.__R(String(m)),
    async frames(n) { const f = frame + n; while (frame < f) await sleep(15); },
    // Loading done, nothing left to stream, then a few frames for the
    // terrain-shadow pass, which is spread over five.
    async idle(extra = 8) {
      while (loading || chunkStreamer.pending() > 0) await sleep(50);
      await api.frames(extra);
    },
    // Snap the eye to the scene first: at a frame every second or so,
    // adaptation would otherwise never converge.
    async snap(name, png = false) {
      eyePass.uniforms.uReset.value = 1;
      await api.frames(3);
      shotType = png ? 'image/png' : 'image/jpeg';
      shotName = name;
      while (shotName) await sleep(15);
      await sleep(250);
    },
    // Put the viewer somewhere: { world, x, z, h (above ground), yaw, pitch, mode, sun (rad) }.
    async at(o) {
      if (o.world && o.world !== worldId) { applyWorld(o.world); await api.idle(2); }
      if (o.sun !== undefined) { sunElev = o.sun; updateSunDir(); updateSkyColors(); }
      if (o.mode) setMode(o.mode);
      const x = o.x ?? player.pos.x, z = o.z ?? player.pos.z;
      player.pos.set(x, terrainHeight(x, z) + (o.h ?? EYE), z);
      player.vel.set(0, 0, 0);
      yawObj.position.copy(player.pos);
      if (o.yaw !== undefined) yawObj.rotation.y = o.yaw;
      if (o.pitch !== undefined) pitchObj.rotation.x = o.pitch;
      await api.frames(2);
      await api.idle();
    },
  };
  return api;
})();

async function __probeMain() {
  try {
    quality.auto = false;
    quality.set(window.__probeQuality || 'low', false);
    probe.log('booted ' + quality.label);
    await drive(probe);
    probe.log('DONE');
  } catch (e) {
    probe.log('DRIVER ' + e.message + ' ' + e.stack);
    probe.log('DONE');
  }
}
