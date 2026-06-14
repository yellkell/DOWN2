/*
 * DOWN 2 — entry point.
 *
 * A neon synthwave VR descent built on the Immersive Web SDK: dodge a rising
 * grid to the beat, then slide a pitched ramp through barrier gates, phase after
 * phase, down the mountain. Sequel to the original A-Frame "DOWN" (see /vr and
 * /vrh in this repo) — same genre, rebuilt on IWSDK's ECS + Three.js with a
 * beat-locked, self-generated soundtrack and a score/combo chase.
 */

import { SessionMode, World } from '@iwsdk/core';

import { buildStaticEnvironment } from './environment.js';
import { GameSystem } from './systems/GameSystem.js';

World.create(document.getElementById('scene-container') as HTMLDivElement, {
  xr: {
    sessionMode: SessionMode.ImmersiveVR,
    offer: 'always',
    features: {},
  },
  features: {},
}).then((world) => {
  buildStaticEnvironment(world.scene);
  world.registerSystem(GameSystem);
});
