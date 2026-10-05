/* ── View ──────────────────────────────────────────────────────
   What a world looks like from inside a helmet (see types.ts). The
   kinds a row may name are literal unions, so a typo is a compile
   error: companions are the keys of the companion table, landers the
   kinds props/lander.ts builds. Those two imports are type-only, so
   they add no edge to the module graph. */
import type { CompanionId } from '../sky/companions';
import type { WorldId } from './terrains';

/** Lander kinds; props/lander.ts's KINDS has one entry per kind. */
export type LanderKind = 'lm' | 'viking' | 'venera' | 'generic';
/** What marks the landing site. */
export type LandmarkKind = 'flag' | 'beacon';
/** Tone mapping: AgX by default, ACES where the sky's own colour matters. */
export type ToneMap = 'agx' | 'aces';

/** An Io plume, placed by bearing and distance from the landing site. */
export interface PlumeSpec {
  brg: number; dist: number;       // °, m
  H: number; W: number;            // height and canopy radius, m
  shell: number; column: number;   // how much of the light is in the shell and the column
  col: RGB; gain: number;
}

/** A Triton geyser: the vent, its column, and where the trail blows. */
export interface GeyserSpec {
  brg: number; dist: number;       // °, m
  H: number; w: number;            // column height and half-width, m
  tau: number;                     // optical depth
  tail: { brg: number; len: number };
}

export type RGB = [number, number, number];

export interface StreamLevel { size: number; ext: number; step?: number }

export interface WorldView {
  site: string;
  title: string; sub: string; fine: string;        // the opening screen
  air: boolean;
  stars: number;
  sunColor: number; sunPower: number; sunSize: number; sunHDR: RGB;
  noSun?: boolean;                                  // Venus, Titan: no disc
  corona: number; coronaColor: RGB;
  hemi: [number, number, number]; amb: [number, number];
  fog: { density: number } | null;
  sky: { zenith: RGB; horizon: RGB; aureole: RGB; k: number; amt?: number; tau?: number } | null;
  skyLit?: boolean;
  zodiacal?: number;                                // AU from the sun, if the zodiacal light shows
  // regolith texture
  grey: number; mapTint: RGB; pits: number; grain: number; pebbles: number;
  clods?: number; plate?: number; ripple?: number;
  hapke: { w: number; b: number; c: number; B0: number; h: number; theta: number; Bc0: number; hc: number };
  micro: number[]; sparkle: number;
  // streaming and moving
  levels: () => StreamLevel[];
  fly: number; rover: boolean; roverTop?: number; roverDrag?: number;
  mu: number; drag?: number; buoy?: number; jets?: boolean;
  medium?: { air: number; lp: number; wind: number; windLP: number };
  dose?: number;                                    // Sv/day on the readout
  // dust, prints, rocks
  dustColor: number; dustDrag: number; dustLife?: number;
  stampColor: number; soil: number;
  rockTint: RGB; rockAlb: [number, number]; rockN: number;
  rockFlat?: number; rockRound?: boolean; rockMax?: number;
  rilleTalus?: number; talus?: number; blocks?: number;
  cobbles?: { patches: number; per: number; r: number; size: [number, number] };
  // landmarks
  landmark: LandmarkKind; flagColor: number;
  lander?: LanderKind;                              // the moon's LM when unset
  look?: [number, number];
  relay?: number;
  // exposure and grading
  exposure: number; eye: [number, number, number]; starGain?: number;
  bloom: [number, number, number]; tone?: ToneMap;
  shadows?: boolean;                                // false turns terrain shadows off (Venus)
  // the sky's company and its effects
  companions: CompanionId[];
  night?: { ratio: number; radius: number; color: number; label: string; stars: number };
  plumes?: PlumeSpec[]; geysers?: GeyserSpec[]; devils?: number; curtain?: number;
  sea?: number;                                     // liquid level, m (Titan)
}

/** A view as the registry hands it out: the row plus what is derived. */
export interface World extends WorldView {
  id: WorldId;
  name: string;          // 'MOON'
  g: number;             // from the terrain
  gTxt: string;          // '1.62 m/s²'
}
