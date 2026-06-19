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

const boot = document.getElementById('boot');

/** Surface a failure on screen rather than leaving a silent beige page. */
function showError(message: string): void {
  console.error(message);
  if (!boot) return;
  boot.classList.add('error');
  boot.textContent = message;
}

// Any uncaught error or rejected promise during boot becomes visible text.
window.addEventListener('error', (e) =>
  showError(`Something went wrong loading the desert:\n${e.message}`),
);
window.addEventListener('unhandledrejection', (e) =>
  showError(`Something went wrong loading the desert:\n${e.reason?.message ?? e.reason}`),
);

// WebGL2 is required; say so plainly if the browser/device can't provide it.
if (!document.createElement('canvas').getContext('webgl2')) {
  showError(
    'This browser or device has WebGL2 unavailable or disabled.\n' +
      'The papercraft desert needs WebGL2 to render.',
  );
} else {
  World.create(document.getElementById('scene-container') as HTMLDivElement, {
    xr: {
      sessionMode: SessionMode.ImmersiveVR,
      offer: 'always',
      features: {},
    },
    features: {},
  })
    .then((world) => {
      world.registerSystem(AmbientSystem);
      boot?.remove(); // scene is live — clear the overlay
    })
    .catch((err: unknown) =>
      showError(`Could not start the scene:\n${err instanceof Error ? err.message : String(err)}`),
    );
}
