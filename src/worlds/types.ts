/* What a world is, as data. Each world is a folder, src/worlds/<id>/,
   with two definitions:

   - terrain.ts (TerrainDef): what the ground is — gravity, radius, its
     crater population, and its height and colour functions. Pure: no
     three, no DOM, because the mesh workers import it too.
   - view.ts (WorldView): what it looks like from inside a helmet — the
     light, the sky, the regolith texture, the streamer's reach, what
     hangs overhead, and the walker's and rover's numbers.

   The registry (src/worlds/index.ts) puts them together in order out
   from the sun and derives what follows from them (name, gravity text).
   A field that is optional here is a feature a world opts into. */

/* ── Terrain ─────────────────────────────────────────────────── */

/** One size class of craters, re-derived on demand per cell (kernel/craters.ts). */
export interface CraterClass {
  cell: number;          // m; keep rMax * 1.9 < cell
  salt: number;          // decorrelates the class's random streams
  rMin: number; rMax: number;
  count: number;         // candidates per cell
  prob: number;          // chance each candidate exists
  ageK?: number;         // skew toward old and shallow (default 2.2)
  rays?: 1;              // fresh ones throw rays (keep ray extent under 0.88 cell)
  rocks?: 1;             // the rock system scatters blocks on their rims
  streak?: 1;            // Mars: wind streaks behind them
  hol?: 1;               // Mercury: hollows on their floors
  knob?: 1;              // Callisto, Ganymede: degraded rims break into knobs
  old?: 1;               // predate something the world's oldVeto() says wiped them
  poly?: 1;              // polygonal rims
  clump?: number;        // secondaries: only cells inside a coarse cluster field
}

export type TintFn = (x: number, z: number, h: number, slope: number, fresh: number,
  a0: number, a1: number, a2: number, out: number[]) => void;

export interface TerrainDef {
  id: string;
  seed: number;          // every noise field in the kernel keys off this
  g: number;             // m/s²
  R: number;             // m, physical radius
  Rc?: number;           // m, apparent radius for curvature when it differs (Venus, Titan)
  lander?: [number, number];   // where the lander stands
  craters: CraterClass[];
  craterAmp: number;
  depthK: number;
  rampart: number;       // Mars: lobate ejecta ramparts
  Dtr?: number;          // simple-to-complex transition diameter, m
  halo?: number;         // fresh-ejecta brightening
  pitD?: number;         // central pits instead of peaks past this diameter
  knobP?: number;        // knob density factor
  relief?: number; groove?: number; fine?: number; albedoK?: number;   // the moonlets
  /** Surface height in metres. Fills AUX (kernel/terrain.ts) if tint() needs side channels. */
  height(x: number, z: number): number;
  /** Per-vertex albedo for the colour pass, written to out[0..2]. */
  tint: TintFn;
  /** Drops crater classes flagged old whose centre is here. */
  oldVeto?(px: number, pz: number): boolean;
  /** Scales knob probability at a knob cell's centre. */
  knobMask?(px: number, pz: number): number;
  /** Clears the world's own caches when the kernel switches to it. */
  reset?(): void;
}

/* ── View ────────────────────────────────────────────────────── */

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
  landmark: string; flagColor: number;
  lander?: string;                                  // lander kind (props/lander.ts KINDS)
  look?: [number, number];
  relay?: number;
  // exposure and grading
  exposure: number; eye: [number, number, number]; starGain?: number;
  bloom: [number, number, number]; tone?: string;
  shadows?: boolean;                                // false turns terrain shadows off (Venus)
  // the sky's company and its effects
  companions: string[];
  night?: { ratio: number; radius: number; color: number; label: string; stars: number };
  plumes?: object[]; geysers?: object[]; devils?: number; curtain?: number;
  sea?: number;                                     // liquid level, m (Titan)
}

/** A view as the registry hands it out: the row plus what is derived. */
export interface World extends WorldView {
  id: string;
  name: string;          // 'MOON'
  g: number;             // from the terrain
  gTxt: string;          // '1.62 m/s²'
}
