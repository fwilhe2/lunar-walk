/* What a world is, as data. Each world is a folder, src/worlds/<id>/,
   with two definitions (this file has the first, view-types.ts the
   second):

   - terrain.ts (TerrainDef): what the ground is — gravity, radius, its
     crater population, and its height and colour functions. Pure: no
     three, no DOM, because the mesh workers import it too.
   - view.ts (WorldView): what it looks like from inside a helmet — the
     light, the sky, the regolith texture, the streamer's reach, what
     hangs overhead, and the walker's and rover's numbers. Not pure:
     its types name the engine's companions and landers, so it lives
     apart from the terrain types the kernel's compiler check sees.

   The registry (src/worlds/index.ts) puts them together in order out
   from the sun and derives what follows from them (name, gravity text).
   A field that is optional here is a feature a world opts into. */

/* ── Terrain ─────────────────────────────────────────────────────
   Gravity and radius are the real values; the rest describes what the
   ground actually looks like on each body, and is shared verbatim with
   the mesh workers.

   Seeds are the dates that matter: Apollo 11's launch, Viking 1's
   launch, Asaph Hall's two nights in August 1877, the morning
   Venera 9 sent back the first picture ever taken on another
   planet's surface, the night in January 1610 Galileo first saw
   Europa and Io as two points of light instead of one, and the
   day in February 1930 Clyde Tombaugh found Pluto on a pair of
   photographic plates, the day in June 1978 James Christy noticed
   that Pluto's image had a bump on it that moved, and the day in
   March 1974 Mariner 10 flew past Mercury and showed it had a face. */

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
