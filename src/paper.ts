/*
 * The papercraft look, in one place.
 *
 * Everything visible in the scene is built with `paperMesh`, which turns a plain
 * Three.js geometry into a piece of folded card:
 *
 *   1. optional vertex jitter, so edges aren't machine-straight (hand-cut paper);
 *   2. `toNonIndexed` + flat shading, so every triangle reads as a separate facet;
 *   3. a per-facet "sheen" baked into vertex colours — each face is darkened a
 *      random touch, the way adjacent paper panels catch the light differently.
 *
 * Combined with a single warm key light, that facet shading is what sells the
 * craft-paper diorama feel.
 */

import {
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  FrontSide,
  Mesh,
  MeshStandardMaterial,
  Vector3,
} from '@iwsdk/core';
import type { ColorRepresentation } from 'three';

/** Small, fast, seeded PRNG so the scene is identical on every load. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface PaperOptions {
  /** Random per-facet darkening, 0..1 — the hand-folded paper sheen. */
  sheen?: number;
  /** Vertex jitter (metres) applied before faceting, for hand-cut irregularity. */
  roughen?: number;
  /** Per-face base colour from the face centroid; overrides the flat colour. */
  faceColor?: (centroid: Vector3) => ColorRepresentation;
  /** Render both sides — for thin folded shapes such as agave blades. */
  doubleSided?: boolean;
  castShadow?: boolean;
  receiveShadow?: boolean;
}

function jitterVertices(geo: BufferGeometry, rng: () => number, amount: number): void {
  const pos = geo.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    pos.setXYZ(
      i,
      pos.getX(i) + (rng() - 0.5) * amount,
      pos.getY(i) + (rng() - 0.5) * amount,
      pos.getZ(i) + (rng() - 0.5) * amount,
    );
  }
  pos.needsUpdate = true;
}

const _centroid = new Vector3();

/** Build a flat-shaded, facet-shaded "paper" mesh from a geometry. */
export function paperMesh(
  geometry: BufferGeometry,
  color: ColorRepresentation,
  rng: () => number,
  opts: PaperOptions = {},
): Mesh {
  const sheen = opts.sheen ?? 0.16;

  // Jitter on the indexed mesh so shared corners move together, then split every
  // triangle into its own facet for crisp folds.
  if (opts.roughen) jitterVertices(geometry, rng, opts.roughen);
  const geo = geometry.index ? geometry.toNonIndexed() : geometry;
  geo.computeVertexNormals();

  const pos = geo.getAttribute('position');
  const colors = new Float32Array(pos.count * 3);
  const base = new Color();
  for (let f = 0; f < pos.count; f += 3) {
    const shade = 1 - rng() * sheen;
    if (opts.faceColor) {
      _centroid.set(
        (pos.getX(f) + pos.getX(f + 1) + pos.getX(f + 2)) / 3,
        (pos.getY(f) + pos.getY(f + 1) + pos.getY(f + 2)) / 3,
        (pos.getZ(f) + pos.getZ(f + 1) + pos.getZ(f + 2)) / 3,
      );
      base.set(opts.faceColor(_centroid));
    } else {
      base.setRGB(1, 1, 1);
    }
    for (let k = 0; k < 3; k++) {
      colors[(f + k) * 3] = base.r * shade;
      colors[(f + k) * 3 + 1] = base.g * shade;
      colors[(f + k) * 3 + 2] = base.b * shade;
    }
  }
  geo.setAttribute('color', new Float32BufferAttribute(colors, 3));

  const material = new MeshStandardMaterial({
    // In faceColor mode the real colour lives in the vertex colours, so the
    // material itself is white and just multiplies through.
    color: opts.faceColor ? 0xffffff : color,
    vertexColors: true,
    flatShading: true,
    roughness: 0.92,
    metalness: 0,
    side: opts.doubleSided ? DoubleSide : FrontSide,
  });

  const mesh = new Mesh(geo, material);
  mesh.castShadow = opts.castShadow ?? true;
  mesh.receiveShadow = opts.receiveShadow ?? true;
  return mesh;
}
