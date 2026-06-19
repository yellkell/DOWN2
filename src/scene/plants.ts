/*
 * Desert flora, all built from faceted paper primitives.
 *
 *   - saguaro     a ribbed trunk with rounded cap and up to two raised arms,
 *                 sometimes crowned with a bloom;
 *   - barrel      a squat ribbed sphere with an optional flower cluster;
 *   - agave       a splayed rosette of thin double-sided blades;
 *   - tumbleweed  a ragged, heavily-roughened ball that the ambient system rolls.
 *
 * Cacti are returned ready to plant; the ambient system gives them a gentle sway.
 */

import {
  ConeGeometry,
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  Object3D,
  SphereGeometry,
} from '@iwsdk/core';

import { PALETTE } from '../palette.js';
import { paperMesh } from '../paper.js';

function cactusSegment(
  rng: () => number,
  rTop: number,
  rBot: number,
  h: number,
  color: number = PALETTE.cactus,
): Object3D {
  return paperMesh(new CylinderGeometry(rTop, rBot, h, 7, 1), color, rng, {
    sheen: 0.14,
    roughen: 0.02,
  });
}

export function createSaguaro(rng: () => number): Object3D {
  const g = new Group();
  const trunkH = 2.6 + rng() * 2.4;
  const r = 0.22 + rng() * 0.12;

  const trunk = cactusSegment(rng, r * 0.85, r, trunkH);
  trunk.position.y = trunkH / 2;
  g.add(trunk);

  const cap = paperMesh(new SphereGeometry(r * 0.85, 7, 5), PALETTE.cactus, rng, {
    sheen: 0.14,
  });
  cap.position.y = trunkH;
  g.add(cap);

  const arms = Math.floor(rng() * 3); // 0..2
  for (let i = 0; i < arms; i++) {
    const side = i === 0 ? 1 : -1;
    const ar = r * 0.7;
    const elbow = 0.5 + rng() * 0.3;
    const upH = 0.8 + rng() * 1.1;

    const arm = new Group();
    const stub = cactusSegment(rng, ar, ar, elbow);
    stub.rotation.z = (side * Math.PI) / 2.4;
    stub.position.x = side * elbow * 0.3;
    const up = cactusSegment(rng, ar * 0.85, ar, upH);
    up.position.set(side * elbow * 0.6, elbow * 0.6 + upH / 2, 0);
    const upCap = paperMesh(new SphereGeometry(ar * 0.85, 7, 5), PALETTE.cactus, rng, {
      sheen: 0.14,
    });
    upCap.position.set(side * elbow * 0.6, elbow * 0.6 + upH, 0);
    arm.add(stub, up, upCap);
    arm.position.y = trunkH * (0.45 + rng() * 0.22);
    arm.rotation.y = rng() * Math.PI * 2;
    g.add(arm);
  }

  if (rng() < 0.5) {
    const bloom = paperMesh(new ConeGeometry(r * 0.6, r * 0.9, 6), PALETTE.cactusFlower, rng, {
      sheen: 0.1,
      castShadow: false,
    });
    bloom.position.y = trunkH + r * 0.8;
    g.add(bloom);
  }

  return g;
}

export function createBarrel(rng: () => number): Object3D {
  const g = new Group();
  const r = 0.4 + rng() * 0.3;
  const body = paperMesh(new SphereGeometry(r, 9, 6), PALETTE.cactusDark, rng, {
    sheen: 0.16,
    roughen: 0.015,
  });
  body.scale.y = 0.8 + rng() * 0.2;
  body.position.y = r * 0.7;
  g.add(body);

  if (rng() < 0.7) {
    const flower = paperMesh(new IcosahedronGeometry(r * 0.28, 0), PALETTE.cactusFlower, rng, {
      sheen: 0.1,
      castShadow: false,
    });
    flower.position.y = r * 1.3;
    g.add(flower);
  }
  return g;
}

export function createAgave(rng: () => number): Object3D {
  const g = new Group();
  const blades = 7 + Math.floor(rng() * 5);
  const len = 0.6 + rng() * 0.5;

  for (let i = 0; i < blades; i++) {
    const blade = paperMesh(new ConeGeometry(0.07, len, 4), PALETTE.agave, rng, {
      sheen: 0.18,
      doubleSided: true,
      castShadow: false,
    });
    blade.position.y = len / 2;

    // Lean each blade outward, then spin it around the rosette.
    const lean = new Group();
    lean.rotation.z = 0.5 + rng() * 0.45;
    lean.add(blade);

    const pivot = new Group();
    pivot.rotation.y = (i / blades) * Math.PI * 2 + rng() * 0.2;
    pivot.add(lean);
    g.add(pivot);
  }
  return g;
}

export interface Tumbleweed {
  obj: Object3D;
  radius: number;
}

export function createTumbleweed(rng: () => number): Tumbleweed {
  const radius = 0.35 + rng() * 0.18;
  const ball = paperMesh(new IcosahedronGeometry(radius, 1), PALETTE.tumbleweed, rng, {
    sheen: 0.28,
    roughen: radius * 0.45,
  });
  const obj = new Group();
  obj.add(ball);
  return { obj, radius };
}
