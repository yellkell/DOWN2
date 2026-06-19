/*
 * Composes the whole papercraft desert and hands back the few things that move.
 *
 * Props are scattered with a simple rejection sampler: keep a min distance from
 * each other and stay out of a clearing around the viewer so the camera never
 * ends up inside a cactus. Mesas anchor the far horizon; cacti, agave and
 * boulders fill the mid-ground. The returned `Desert` is just the animated
 * handles — the ambient system owns the motion.
 */

import { Object3D, Scene, Vector3 } from '@iwsdk/core';

import { createCloud } from './clouds.js';
import { createAgave, createBarrel, createSaguaro, createTumbleweed } from './plants.js';
import { createBoulder, createMesa } from './rocks.js';
import { buildSky } from './sky.js';
import { createTerrain, duneHeight, VIEWER_Z } from './terrain.js';

export interface Swayer {
  obj: Object3D;
  phase: number;
  amp: number;
  speed: number;
}
export interface CloudDrift {
  obj: Object3D;
  speed: number;
  bound: number;
}
export interface Roller {
  obj: Object3D;
  radius: number;
  speed: number;
  startX: number;
  endX: number;
  z: number;
}
export interface Desert {
  sunDirection: Vector3;
  swayers: Swayer[];
  clouds: CloudDrift[];
  rollers: Roller[];
}

export function buildDesert(scene: Scene, rng: () => number): Desert {
  const sunDirection = buildSky(scene);
  scene.add(createTerrain(rng));

  const swayers: Swayer[] = [];
  const clouds: CloudDrift[] = [];
  const rollers: Roller[] = [];

  // Rejection-sampled placement that avoids the viewer clearing and crowding.
  const taken: { x: number; z: number }[] = [];
  const spot = (minDist: number): { x: number; z: number } | null => {
    for (let t = 0; t < 24; t++) {
      const x = (rng() * 2 - 1) * 55;
      const z = -60 + rng() * 74; // -60 (far) .. +14 (just behind the viewer)
      if (Math.abs(x) < 2.8 && z > 1 && z < VIEWER_Z + 4) continue;
      let ok = true;
      for (const o of taken) {
        if (Math.hypot(o.x - x, o.z - z) < minDist) {
          ok = false;
          break;
        }
      }
      if (ok) {
        taken.push({ x, z });
        return { x, z };
      }
    }
    return null;
  };

  const plant = (obj: Object3D, x: number, z: number, spinY = true): void => {
    obj.position.set(x, duneHeight(x, z), z);
    if (spinY) obj.rotation.y = rng() * Math.PI * 2;
    scene.add(obj);
  };

  // Far mesas — placed by hand for a deliberate skyline.
  const mesaSpots: [number, number, number][] = [
    [-14, -46, 1.5],
    [18, -52, 1.2],
    [-34, -56, 1.7],
    [40, -44, 1.0],
  ];
  for (const [x, z, s] of mesaSpots) {
    const mesa = createMesa(rng, s);
    mesa.position.set(x, duneHeight(x, z) - 0.5, z);
    mesa.rotation.y = rng() * Math.PI * 2;
    scene.add(mesa);
  }

  for (let i = 0; i < 17; i++) {
    const s = spot(5);
    if (!s) continue;
    const cactus = createSaguaro(rng);
    plant(cactus, s.x, s.z);
    swayers.push({ obj: cactus, phase: rng() * Math.PI * 2, amp: 0.03 + rng() * 0.04, speed: 0.5 + rng() * 0.4 });
  }

  for (let i = 0; i < 13; i++) {
    const s = spot(2.4);
    if (s) plant(createBarrel(rng), s.x, s.z);
  }

  for (let i = 0; i < 15; i++) {
    const s = spot(2.2);
    if (!s) continue;
    const agave = createAgave(rng);
    plant(agave, s.x, s.z);
    swayers.push({ obj: agave, phase: rng() * Math.PI * 2, amp: 0.04 + rng() * 0.05, speed: 0.8 + rng() * 0.6 });
  }

  for (let i = 0; i < 22; i++) {
    const s = spot(2.6);
    if (s) plant(createBoulder(rng), s.x, s.z, false);
  }

  for (let i = 0; i < 6; i++) {
    const cloud = createCloud(rng);
    cloud.position.set((rng() * 2 - 1) * 70, 22 + rng() * 10, -18 - rng() * 48);
    scene.add(cloud);
    clouds.push({ obj: cloud, speed: 0.4 + rng() * 0.6, bound: 85 });
  }

  for (let i = 0; i < 2; i++) {
    const { obj, radius } = createTumbleweed(rng);
    const z = -10 - rng() * 16;
    const startX = -45;
    obj.position.set(startX + rng() * 60, duneHeight(startX, z) + radius * 0.9, z);
    scene.add(obj);
    rollers.push({ obj, radius, speed: 1.4 + rng() * 1.2, startX, endX: 48, z });
  }

  return { sunDirection, swayers, clouds, rollers };
}
