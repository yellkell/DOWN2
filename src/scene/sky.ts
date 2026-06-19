/*
 * Sky dome and the low desert sun.
 *
 * The dome is a big back-faced sphere with a smooth vertical gradient (the one
 * deliberately un-faceted surface — a paper backdrop behind the diorama). The
 * sun is a flat disc with a soft halo, parked low on the horizon; `buildSky`
 * returns its direction so the key light can be aimed to match.
 */

import {
  BackSide,
  CircleGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  Scene,
  SphereGeometry,
  Vector3,
} from '@iwsdk/core';

import { PALETTE } from '../palette.js';

export function buildSky(scene: Scene): Vector3 {
  const radius = 480;

  const geo = new SphereGeometry(radius, 32, 24);
  const pos = geo.getAttribute('position');
  const colors = new Float32Array(pos.count * 3);
  const top = new Color(PALETTE.skyTop);
  const horizon = new Color(PALETTE.skyHorizon);
  const c = new Color();
  for (let i = 0; i < pos.count; i++) {
    const t = Math.min(1, Math.max(0, (pos.getY(i) / radius) * 1.4 + 0.18));
    c.copy(horizon).lerp(top, t);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new Float32BufferAttribute(colors, 3));
  const dome = new Mesh(
    geo,
    new MeshBasicMaterial({
      vertexColors: true,
      side: BackSide,
      fog: false,
      depthWrite: false,
    }),
  );
  scene.add(dome);

  // Low sun, a little to the left and behind the hero composition (toward -Z).
  const azimuth = -0.35;
  const elevation = 0.16;
  const dir = new Vector3(
    Math.sin(azimuth) * Math.cos(elevation),
    Math.sin(elevation),
    -Math.cos(azimuth) * Math.cos(elevation),
  ).normalize();

  const sun = new Group();
  const halo = new Mesh(
    new CircleGeometry(34, 40),
    new MeshBasicMaterial({
      color: PALETTE.sunHalo,
      transparent: true,
      opacity: 0.35,
      side: DoubleSide,
      fog: false,
      depthWrite: false,
    }),
  );
  const disc = new Mesh(
    new CircleGeometry(15, 40),
    new MeshBasicMaterial({
      color: PALETTE.sun,
      side: DoubleSide,
      fog: false,
      depthWrite: false,
    }),
  );
  sun.add(halo, disc);
  sun.position.copy(dir).multiplyScalar(radius * 0.82);
  sun.lookAt(0, sun.position.y * 0.3, 0);
  scene.add(sun);

  return dir;
}
