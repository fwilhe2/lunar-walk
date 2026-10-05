/* Seams for tooling: the probe (app/probe.ts) sets these; the app only
   calls them. */
export const frameHooks: { afterRender: null | (() => void) } = { afterRender: null };
