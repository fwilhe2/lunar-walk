import type { WorldView } from '../types';
import { L4 } from '../levels';

/* Europa is five times further from the sun than the Moon: 50 W/m²,
   one part in twenty-seven, from a disc a tenth of a degree across.
   That is still an overcast day's worth of light, and it falls on
   ice ten times as reflective as lunar soil, so the eye stops down
   and this is the brightest ground in the set to stand on.

   The same reflectivity changes the shadows. With no air there is
   no sky to light them, so they are lit by the sunlit ice around
   them, and ice returns two-thirds of what it gets: a shadow here
   sits at a sixth of the lit ground, where a lunar one sits at a
   fiftieth. And it is lit by ice, not by sky, so it is the colour
   of the ice — Earth's snow shadows are blue, and these are not.
   Jupitershine adds under 1%, which is nothing next to that.

   Tara Regio is chaos on the leading hemisphere, 75° west of the
   point under Jupiter, which puts Jupiter 15° above the eastern
   horizon. See the jupiter companion for why it looks the way it
   does from here. */
export const view: WorldView = {
  site: 'Tara Regio',
  title: 'Europa Walk', sub: 'Tara Regio · 0.134 g · surface unbounded',
  fine: 'Ice at −170 °C, hard as rock, under a sun a twenty-seventh as bright.<br>' +
        'Jupiter hangs 12° wide over the chaos to the east, bands on end, and never<br>' +
        'moves. The dose out here is about 5 Sv a day. <b>Esc</b> picks another world.',
  air: false, stars: 1,
  // Light here is kept in units ten times the Moon's — a sun of
  // 1.26 rather than 0.126 — and the stars and the eye's range are
  // scaled to match, so every ratio is the physical one. In the
  // Moon's units the ground's radiance is small enough that the
  // eye's exposure amplifies the output dither into coloured noise.
  sunColor: 0xfff8f2, sunPower: 1.26, sunSize: 10.7, sunHDR: [60, 57, 52],
  corona: 2000, coronaColor: [0.68, 0.66, 0.62],
  // Bounce off the ice, a third of the Moon's in absolute terms: a
  // twenty-seventh of the sun, off ground seven times as bright,
  // bounced again off the ground it lands on.
  hemi: [0x181715, 0x37383a, 10.0], amb: [0x000000, 0],
  fog: null, sky: null,
  grey: 214, mapTint: [0.985, 1.0, 1.02], pits: 18, grain: 0.55, clods: 0.5, pebbles: 110,
  // Europa's photometry (Domingue et al. 1991): bright grains, w =
  // 0.96, backscattering, and an opposition surge a fraction of a
  // degree wide — much narrower than the Moon's, as fine frost
  // gives. Multiple scattering in ice this bright fills in what
  // roughness would shade, so theta is small.
  hapke: { w: 0.96, b: 0.35, c: 0.80, B0: 0.5, h: 0.002, theta: 10, Bc0: 0.25, hc: 0.004 },
  // Grain shadows are filled from inside by the same scattering, so
  // they are half as deep (the third term) as on dark regolith.
  micro: [0.25, 0.22, 0.3], sparkle: 3.0,
  levels: L4, fly: 400, rover: true,
  mu: 0.5,
  dustColor: 0xd3d6db, dustDrag: 0, stampColor: 0xc4cad2, soil: 0xd6d8dc,
  // Blocks of ice, cleaner than the frost around them; few of them
  // come from craters, most are talus shed off steep faces.
  rockTint: [0.97, 0.99, 1.03], rockAlb: [0.50, 0.25], rockN: 0.35, talus: 700,
  landmark: 'flag', flagColor: 0xc9ccd2,
  lander: 'generic',
  // The key sits higher than on the dark bodies: an eye anchors
  // white on the brightest surface in view, and ice this reflective
  // should read as white, not as the mid-grey the Moon's mare does.
  exposure: 1.0, eye: [0.40, 0.05, 15], starGain: 0.012, bloom: [0.5, 0.65, 3.0],
  companions: ['jupiter', 'io', 'ganymede', 'callisto'],
  // Night: Jupiter, 12.2° across at albedo 0.52 — 0.6% of the sun.
  night: { ratio: 0.0059, radius: 0.106, color: 0xfff0dc, label: 'JUPITERLIT', stars: 20 },
  // Earth is never more than 12° from the sun from here, so that is
  // where the rover's dish looks, not at Jupiter: relay is how far
  // along the sky from the sun it points.
  relay: 0.14,
  // Surface dose from Jupiter's trapped electrons and ions: the
  // commonly quoted 5.4 Sv a day, against 1.4 mSv on the Moon (Chang'e
  // 4) and 0.64 on Mars (Curiosity). Four to five sieverts at once
  // kills half the people who receive it. The leading hemisphere,
  // where this is, is spared some of the electrons that the
  // trailing one takes, so here it is if anything an overestimate.
  dose: 5.4,
  // Distance from the sun, AU: sets the zodiacal light (sky/stars.ts).
  zodiacal: 5.2,
};
