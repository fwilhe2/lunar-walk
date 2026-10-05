import { VIEW } from './views';

// In order out from the sun, which is the order of the keys along the
// number row (WORLD_KEYS), the buttons on the opening screen and the
// demo's tour.
export const WORLD_IDS = ['mercury', 'venus', 'moon', 'mars', 'phobos', 'deimos', 'vesta', 'ceres', 'io', 'europa', 'ganymede', 'callisto', 'mimas', 'enceladus', 'dione', 'titan', 'iapetus', 'miranda', 'triton', 'pluto', 'charon'];
// 1–9 along the number row, then −, = and Backspace: 0 is the demo.
// Shift and the same keys reach worlds thirteen onward.
export const WORLD_KEYS = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Minus', 'Equal', 'Backspace'];
export let world = VIEW.moon;        // active render-side row
export let worldId = 'moon';

export function setWorldId(v) { return (worldId = v); }

export function setWorldView(v) { return (world = v); }
