/*
 * Flattened paper cloud puffs — a few overlapping faceted blobs per cloud. They
 * cast no shadow and drift slowly under the ambient system.
 */

import { Group, IcosahedronGeometry, Object3D } from '@iwsdk/core';

import { PALETTE } from '../palette.js';
import { paperMesh } from '../paper.js';

export function createCloud(rng: () => number): Object3D {
  const g = new Group();
  const puffs = 3 + Math.floor(rng() * 3);
  for (let i = 0; i < puffs; i++) {
    const r = 1.2 + rng() * 1.6;
    const puff = paperMesh(new IcosahedronGeometry(r, 1), PALETTE.cloud, rng, {
      sheen: 0.08,
      roughen: 0.1,
      castShadow: false,
      receiveShadow: false,
    });
    puff.position.set((rng() - 0.5) * 4, (rng() - 0.5) * 1.2, (rng() - 0.5) * 2);
    puff.scale.y = 0.6;
    g.add(puff);
  }
  return g;
}
