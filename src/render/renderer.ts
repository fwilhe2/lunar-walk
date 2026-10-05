import * as THREE from 'three';

/* ═════════════════════════════════════════════════════════════
   RENDERER
   ═════════════════════════════════════════════════════════════ */
export const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
// AgX rather than ACES: its toe is gentler, so a lunar shadow at 2% of
// the lit ground stays a very dark grey you can see into instead of
// being crushed flat, and it desaturates highlights the way film does.
renderer.toneMapping = THREE.AgXToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
// Texture anisotropy for the ground; render/quality.ts lowers it on weak GPUs,
// where 16× at grazing angles is one of the dearest things per pixel.
export let ANISO = renderer.capabilities.getMaxAnisotropy();
// First in the body: it is fixed now, and fixed elements stack in
// document order, so everything after it (HUD, picker) draws on top.
renderer.domElement.id = 'view';
document.body.prepend(renderer.domElement);

export const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

export const FOV0 = 72;   // vertical, degrees; the long lens (player/camera.ts) narrows it
export const camera = new THREE.PerspectiveCamera(FOV0, innerWidth / innerHeight, 0.05, 90000);
export const yawObj = new THREE.Object3D();
export const pitchObj = new THREE.Object3D();
yawObj.add(pitchObj); pitchObj.add(camera); scene.add(yawObj);



export function setAniso(v) { return (ANISO = v); }
