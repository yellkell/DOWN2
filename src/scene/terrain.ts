/*
 * The dune field.
 *
 * A single low-poly heightfield built from layered sine waves. `duneHeight` is
 * exported so props (cacti, rocks, the rolling tumbleweed) can be planted
 * exactly on the surface rather than floating or sinking. The area immediately
 * around the viewer is flattened so nothing pokes up through them.
 */

import { BufferGeometry, Color, Float32BufferAttribute, Mesh } from '@iwsdk/core';

import { PALETTE } from '../palette.js';
import { paperMesh } from '../paper.js';

/** Where the viewer stands; dunes are flattened around this point. */
export const VIEWER_Z = 8;

/** Surface height of the dunes at a world (x, z). */
export function duneHeight(x: number, z: number): number {
  const h =
    Math.sin(x * 0.13) * 1.6 +
    Math.cos(z * 0.11 + 1.3) * 1.8 +
    Math.sin((x + z) * 0.07 + 0.5) * 1.1 +
    Math.cos(x * 0.05 - z * 0.04) * 2.2;
  // Ease the dunes down to a clearing around the viewer.
  const d = Math.hypot(x, z - VIEWER_Z);
  const flatten = Math.min(1, Math.max(0, (d - 4) / 9));
  return h * 0.6 * flatten;
}

export function createTerrain(rng: () => number): Mesh {
  const W = 170;
  const D = 170;
  const sx = 92;
  const sz = 92;

  const verts: number[] = [];
  for (let j = 0; j <= sz; j++) {
    for (let i = 0; i <= sx; i++) {
      const x = -W / 2 + (i / sx) * W;
      const z = -D / 2 + (j / sz) * D;
      verts.push(x, duneHeight(x, z), z);
    }
  }

  const idx: number[] = [];
  const row = sx + 1;
  for (let j = 0; j < sz; j++) {
    for (let i = 0; i < sx; i++) {
      const a = j * row + i;
      const b = a + 1;
      const c = a + row;
      const d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }

  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(verts, 3));
  geo.setIndex(idx);

  const light = new Color(PALETTE.sandLight);
  const mid = new Color(PALETTE.sandMid);
  const shadow = new Color(PALETTE.sandShadow);
  const out = new Color();

  return paperMesh(geo, PALETTE.sandMid, rng, {
    sheen: 0.1,
    castShadow: false,
    receiveShadow: true,
    // Crests catch the light, troughs fall into cool shadow.
    faceColor: (centroid) => {
      const t = Math.min(1, Math.max(0, centroid.y / 3 + 0.5));
      if (t > 0.5) out.copy(mid).lerp(light, (t - 0.5) * 2);
      else out.copy(shadow).lerp(mid, t * 2);
      return out;
    },
  });
}
