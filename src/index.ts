/*
 * Papercraft Desert — entry point.
 *
 * A calm, low-poly desert diorama for WebXR, built on the Immersive Web SDK.
 * Everything is folded-paper geometry — rolling dunes, saguaro and barrel cacti,
 * agave, layered red-rock mesas, drifting clouds and a rolling tumbleweed — lit
 * by a single warm sun. Put on a headset and look around, or explore in the
 * desktop emulator. All scene construction and motion live in AmbientSystem.
 */

import { SessionMode, World } from '@iwsdk/core';

import { AmbientSystem } from './systems/AmbientSystem.js';

World.create(document.getElementById('scene-container') as HTMLDivElement, {
  xr: {
    sessionMode: SessionMode.ImmersiveVR,
    offer: 'always',
    features: {},
  },
  features: {},
}).then((world) => {
  world.registerSystem(AmbientSystem);
});
