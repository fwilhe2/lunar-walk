import type { WorldView } from '../types';
import { L3 } from '../levels';

/* Venus is the only body in the set where the sky is the light
   source. Twenty kilometres of sulphuric acid cloud and 92 bar of
   CO₂ between you and the sun leave about 17 W/m² on the ground —
   one part in eighty of what the Moon gets, and every photon of
   it arrives scattered. So: no sun disc, no shadows worth the
   name, no opposition surge, no stars, nothing overhead at all.
   Venera 9 photographed a landscape lit like an overcast
   afternoon, and was surprised by how much it could see.

   The colour is all in the air. Rayleigh scattering over that
   column is optically deep in the blue — tens of optical depths —
   and thin in the red, so what survives to the surface is orange,
   and the ground under it is ordinary grey basalt.

   Sky brightness is inverted from every other body here: the
   zenith is the bright part, because that is the short way out,
   and the horizon is dark, because that way the column never
   ends. On Mars and Earth it is the other way round.            */
export const view: WorldView = {
  site: 'Ovda Regio',
  title: 'Venus Walk', sub: 'Ovda Regio · 0.904 g · surface unbounded',
  fine: 'Ninety-two bar of CO₂ at 464 °C, which is a fluid, not air: you wade.<br>' +
        'There is no sun in the sky and no shadow on the ground, and the horizon<br>' +
        'bends <b>upward</b> — the air refracts harder than the planet curves.',
  air: true, stars: 0, noSun: true, shadows: false, skyLit: true,
  // The directional term stands for the last trace of solar
  // direction left after 30 optical depths. It is nearly flat
  // light: the hemisphere fill is what shapes the ground.
  sunColor: 0xffb070, sunPower: 0.42, sunSize: 37, sunHDR: [1, 1, 1],
  corona: 1, coronaColor: [1, 1, 1],
  hemi: [0xff9a4e, 0x431806, 2.1], amb: [0xc8662a, 0.55],
  // Horizontal visibility of a few kilometres, which is what the
  // Venera panoramas show and what a Rayleigh optical depth of
  // ~15 over a 15.9 km scale height gives you near the ground.
  fog: { density: 2.2e-4 },
  sky: { zenith: [0.34, 0.135, 0.040], horizon: [0.115, 0.038, 0.012],
         aureole: [0.44, 0.185, 0.055], k: 1.2, amt: 0.30 },
  // No micrometeorites to pit the rock and no sand to ripple it:
  // the last centimetres of Venus are basalt slabs, cracked into
  // plates and vesicular from the gas that came out of the lava.
  grey: 104, mapTint: [1.0, 0.985, 0.96], pits: 190, grain: 0.8, plate: 0.55,
  pebbles: 140, clods: 0.5,
  // Light that arrives from the whole sky at once has no opposition
  // to surge toward; what is left is a plain Lommel–Seeliger basalt.
  hapke: { w: 0.45, b: 0.12, c: 0.10, B0: 0, h: 0.10, theta: 12, Bc0: 0, hc: 0.01 },
  micro: [0, 0], sparkle: 0,
  levels: L3, fly: 400, rover: true, roverTop: 1.7, roverDrag: 0.34,
  mu: 0.7,
  // Wading: you push 65 kg/m³ out of the way to move through it,
  // and it pushes back on the square of your speed — against legs
  // that give a few hundred watts, which is what sets your pace.
  drag: 0.095, buoy: 0.07,
  dustColor: 0x5a5652, dustDrag: 44, dustLife: 3.2, stampColor: 0x33231a, soil: 0x5a5550,
  rockTint: [1.0, 0.97, 0.93], rockAlb: [0.08, 0.07],
  rockN: 0.8, rockFlat: 0.42,
  landmark: 'flag', flagColor: 0xcfc6b4,
  lander: 'venera',
  exposure: 1.0, eye: [0.16, 0.3, 6], tone: 'aces', bloom: [0.2, 0.75, 3.0],
  companions: [],
};
