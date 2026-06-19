/*
 * Red-rock landforms: layered mesas for the far silhouette, and chunky boulders
 * scattered through the dunes. Both lean on heavy vertex jitter so the paper
 * reads as weathered stone rather than clean primitives.
 */

import { CylinderGeometry, Group, IcosahedronGeometry, Object3D } from '@iwsdk/core';

import { PALETTE } from '../palette.js';
import { paperMesh } from '../paper.js';

/** A tapering stack of strata bands — a mesa / butte for the horizon. */
export function createMesa(rng: () => number, scale = 1): Object3D {
  const g = new Group();
  const layers = 4 + Math.floor(rng() * 3);
  let y = 0;
  let r = (4 + rng() * 3) * scale;

  for (let i = 0; i < layers; i++) {
    const h = (1.4 + rng() * 1.7) * scale;
    const seg = 6 + Math.floor(rng() * 3);
    const color = i % 2 === 0 ? PALETTE.rockRed : PALETTE.rockBand;
    const layer = paperMesh(new CylinderGeometry(r * 0.82, r, h, seg, 1), color, rng, {
      sheen: 0.14,
      roughen: 0.06 * scale,
    });
    layer.position.y = y + h / 2;
    g.add(layer);
    y += h;
    r *= 0.78 + rng() * 0.08;
  }
  return g;
}

export function createBoulder(rng: () => number): Object3D {
  const g = new Group();
  const r = 0.4 + rng() * 0.9;
  const rock = paperMesh(new IcosahedronGeometry(r, 0), PALETTE.boulder, rng, {
    sheen: 0.2,
    roughen: r * 0.28,
  });
  rock.position.y = r * 0.5;
  rock.rotation.set(rng() * Math.PI, rng() * Math.PI, rng() * Math.PI);
  g.add(rock);
  return g;
}
