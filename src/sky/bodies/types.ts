import type * as THREE from 'three';

/* What a body's map generator hands sky/companions.ts: the colour map
   always, the rest only for the bodies whose companion spec asks for
   it — city lights, ocean glint and clouds (Earth), relief (Mars),
   a ring profile (Saturn, Uranus). */
export interface BodyMaps {
  day: THREE.Texture;
  night?: THREE.Texture;
  spec?: THREE.Texture;
  clouds?: THREE.Texture;
  elev?: THREE.Texture;
  ring?: THREE.Texture;
}
