/*
 * AmbientSystem — the only system in the scene.
 *
 * On init it builds the desert, sets up the warm key light + soft fill that give
 * the paper its facets, enables shadows, and drops the viewer into the clearing.
 * Each frame it nudges the living parts of the diorama: cacti and agave sway,
 * clouds drift and wrap, and the tumbleweeds roll across the dunes.
 */

import {
  ACESFilmicToneMapping,
  AmbientLight,
  createSystem,
  DirectionalLight,
  FogExp2,
  HemisphereLight,
  PCFSoftShadowMap,
} from '@iwsdk/core';

import { PALETTE } from '../palette.js';
import { buildDesert, type Desert } from '../scene/index.js';
import { duneHeight, VIEWER_Z } from '../scene/terrain.js';
import { mulberry32 } from '../paper.js';

export class AmbientSystem extends createSystem({}) {
  private desert!: Desert;

  init(): void {
    const rng = mulberry32(1337);
    this.desert = buildDesert(this.scene, rng);

    this.scene.fog = new FogExp2(PALETTE.skyHorizon, 0.0095);

    // Sky/ground bounce keeps the shadowed paper from going black.
    this.scene.add(new HemisphereLight(PALETTE.skyTop, PALETTE.sandShadow, 0.7));
    this.scene.add(new AmbientLight(PALETTE.skyHorizon, 0.18));

    // Warm key light aimed from the sun, casting the long desert shadows.
    const sun = new DirectionalLight(PALETTE.sun, 1.5);
    sun.position.copy(this.desert.sunDirection).multiplyScalar(60);
    sun.target.position.set(0, 0, -10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0005;
    const cam = sun.shadow.camera;
    cam.near = 1;
    cam.far = 200;
    cam.left = -70;
    cam.right = 70;
    cam.top = 70;
    cam.bottom = -70;
    cam.updateProjectionMatrix();
    this.scene.add(sun, sun.target);

    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFSoftShadowMap;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    // Stand the viewer in the clearing, facing the mesas down -Z.
    this.player.position.set(0, 0, VIEWER_Z);
  }

  update(delta: number, time: number): void {
    for (const s of this.desert.swayers) {
      s.obj.rotation.z = Math.sin(time * s.speed + s.phase) * s.amp;
    }

    for (const c of this.desert.clouds) {
      c.obj.position.x += c.speed * delta;
      if (c.obj.position.x > c.bound) c.obj.position.x = -c.bound;
    }

    for (const r of this.desert.rollers) {
      r.obj.position.x += r.speed * delta;
      r.obj.rotation.z -= (r.speed * delta) / r.radius;
      r.obj.position.y =
        duneHeight(r.obj.position.x, r.z) +
        r.radius * 0.9 +
        Math.abs(Math.sin(time * 4 + r.z)) * 0.06;
      if (r.obj.position.x > r.endX) r.obj.position.x = r.startX;
    }
  }
}
