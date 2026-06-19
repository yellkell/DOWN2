/*
 * AmbientSystem — the only system in the scene.
 *
 * On init it builds the desert, sets up the warm key light + soft fill that give
 * the paper its facets, enables shadows, and drops the viewer into the clearing.
 * Each frame it nudges the living parts of the diorama: cacti and agave sway,
 * clouds drift and wrap, the tumbleweeds roll across the dunes, and the odd
 * dust devil spins up, wanders, and dissipates.
 */

import {
  ACESFilmicToneMapping,
  AmbientLight,
  createSystem,
  DirectionalLight,
  FogExp2,
  HemisphereLight,
  Mesh,
  Object3D,
  PCFSoftShadowMap,
} from '@iwsdk/core';

import { PALETTE } from '../palette.js';
import { buildDesert, type Desert } from '../scene/index.js';
import { createDustDevil, type DustDevil } from '../scene/dustdevil.js';
import { duneHeight, VIEWER_Z } from '../scene/terrain.js';
import { mulberry32 } from '../paper.js';

/** How many dust devils may be active at once, and how widely they roam. */
const MAX_DEVILS = 2;
const FIELD_HALF = 52;

interface ActiveDevil {
  devil: DustDevil;
  age: number;
  life: number;
  vx: number;
  vz: number;
  spinDir: number;
  phase: number;
}

/** Free a discarded subtree's GPU resources — devils are spawned endlessly. */
function disposeSubtree(root: Object3D): void {
  root.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry.dispose();
    if (Array.isArray(mesh.material)) mesh.material.forEach((m) => m.dispose());
    else mesh.material.dispose();
  });
}

export class AmbientSystem extends createSystem({}) {
  private desert!: Desert;

  // Dust devils are created lazily at runtime, so they keep their own RNG and
  // spawn clock independent of the one-shot scene build.
  private readonly devilRng = mulberry32(98765);
  private readonly devils: ActiveDevil[] = [];
  private nextDevilAt = 5;

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

    this.updateDustDevils(delta, time);
  }

  private spawnDustDevil(): void {
    const devil = createDustDevil(this.devilRng);
    const x = (Math.random() * 2 - 1) * (FIELD_HALF - 4);
    const z = -55 + Math.random() * 58;
    devil.obj.position.set(x, duneHeight(x, z), z);
    devil.obj.scale.setScalar(0.001); // grows in from the ground
    this.scene.add(devil.obj);

    const heading = Math.random() * Math.PI * 2;
    const speed = 1.2 + Math.random() * 1.8;
    this.devils.push({
      devil,
      age: 0,
      life: 12 + Math.random() * 10,
      vx: Math.cos(heading) * speed,
      vz: Math.sin(heading) * speed,
      spinDir: Math.random() < 0.5 ? 1 : -1,
      phase: Math.random() * Math.PI * 2,
    });
  }

  private updateDustDevils(delta: number, time: number): void {
    if (time >= this.nextDevilAt && this.devils.length < MAX_DEVILS) {
      this.spawnDustDevil();
      this.nextDevilAt = time + 9 + Math.random() * 13;
    }

    for (let i = this.devils.length - 1; i >= 0; i--) {
      const d = this.devils[i];
      d.age += delta;
      if (d.age >= d.life) {
        this.scene.remove(d.devil.obj);
        disposeSubtree(d.devil.obj);
        this.devils.splice(i, 1);
        continue;
      }

      // Whip the rings around their axis, faster toward the base.
      for (const ring of d.devil.rings) {
        ring.group.rotation.y += ring.spin * d.spinDir * delta;
      }

      // Wander across the dunes, hugging the surface, with a lazy lean.
      const o = d.devil.obj;
      o.position.x += d.vx * delta;
      o.position.z += d.vz * delta;
      o.position.y = duneHeight(o.position.x, o.position.z);
      o.rotation.z = Math.sin(time * 1.3 + d.phase) * 0.07;

      // Spin up out of the ground, then dissipate at the end of its life.
      const t = d.age / d.life;
      const env = Math.max(0, Math.min(1, t / 0.16) * Math.min(1, (1 - t) / 0.16));
      o.scale.setScalar(env);
    }
  }
}
