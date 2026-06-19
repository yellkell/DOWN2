/*
 * Papercraft dust devils.
 *
 * A devil is a tapering column of little paper scraps — narrow and fast at the
 * base, flaring and lazy at the top. Each horizontal ring of scraps is its own
 * group so the ambient system can whip the lower rings around faster than the
 * upper ones, giving the whole thing its swirl. Built once and reused; the
 * system handles spawning, wandering and dissipating them.
 */

import { Group, Object3D, PlaneGeometry } from '@iwsdk/core';

import { PALETTE } from '../palette.js';
import { paperMesh } from '../paper.js';

export interface DustRing {
  group: Object3D;
  spin: number;
}

export interface DustDevil {
  obj: Group;
  rings: DustRing[];
  height: number;
}

const DUST_COLORS = [PALETTE.dust, PALETTE.dustDark, PALETTE.sandLight, PALETTE.sandMid];

export function createDustDevil(rng: () => number): DustDevil {
  const obj = new Group();
  const height = 3.2 + rng() * 2.6;
  const ringCount = 9 + Math.floor(rng() * 5);
  const baseR = 0.12 + rng() * 0.1;
  const topR = 0.7 + rng() * 0.6;
  const rings: DustRing[] = [];

  for (let i = 0; i < ringCount; i++) {
    const f = i / (ringCount - 1); // 0 at the base, 1 at the top
    const ring = new Group();
    ring.position.y = f * height;
    const r = baseR + Math.pow(f, 0.7) * topR; // flare toward the top

    const flecks = 3 + Math.floor(rng() * 4);
    for (let k = 0; k < flecks; k++) {
      const a = rng() * Math.PI * 2;
      const size = 0.1 + rng() * 0.16 * (0.5 + f);
      const color = DUST_COLORS[Math.floor(rng() * DUST_COLORS.length)];
      const fleck = paperMesh(
        new PlaneGeometry(size, size * (0.6 + rng() * 0.8)),
        color,
        rng,
        { sheen: 0.3, doubleSided: true, castShadow: false, receiveShadow: false },
      );
      const rr = r * (0.7 + rng() * 0.5);
      fleck.position.set(
        Math.cos(a) * rr,
        (rng() - 0.5) * (height / ringCount),
        Math.sin(a) * rr,
      );
      fleck.rotation.set(rng() * Math.PI, rng() * Math.PI, rng() * Math.PI);
      ring.add(fleck);
    }

    rings.push({ group: ring, spin: (2.6 - f * 1.6) * (0.8 + rng() * 0.4) });
    obj.add(ring);
  }

  return { obj, rings, height };
}
