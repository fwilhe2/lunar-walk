/* Every world from its landing site, and from the flight ceiling.
     node tools/probe/run.mjs tools/probe/drivers/worlds.mjs /tmp/worlds
   PROBE_WORLDS=titan,io limits it to those. */
export default async function drive(probe) {
  const ids = probe.args.worlds || await probe.eval(() => window.lw.WORLD_IDS);
  for (const id of ids) {
    await probe.at({ world: id });
    const { look, fly } = await probe.eval(() => ({ look: window.lw.world.look || [-0.95, 0], fly: window.lw.world.fly }));
    await probe.at({ yaw: look[0], pitch: look[1] });
    await probe.snap(id + '-eva');
    if (id !== 'venus') {
      await probe.at({ mode: 'FLY', h: Math.min(fly || 400, 380), yaw: look[0], pitch: -0.1 });
      await probe.snap(id + '-fly');
      await probe.at({ mode: 'EVA', h: 1.62 });
    }
    probe.log(id + ' done');
  }
}
