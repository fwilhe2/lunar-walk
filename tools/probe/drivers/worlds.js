/* Every world from its landing site, and from the flight ceiling.
     tools/probe/run.sh tools/probe/drivers/worlds.js /tmp/worlds */
async function drive(probe) {
  for (const id of WORLD_IDS) {
    await probe.at({ world: id });
    const look = world.look || [-0.95, 0];
    await probe.at({ yaw: look[0], pitch: look[1] });
    await probe.snap(id + '-eva');
    if (id !== 'venus') {
      await probe.at({ mode: 'FLY', h: Math.min(world.fly || 400, 380), yaw: look[0], pitch: -0.1 });
      await probe.snap(id + '-fly');
    }
    probe.log(id + ' done');
  }
}
