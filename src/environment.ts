/*
 * Scenery construction for DOWN 2.
 *
 * Everything here is pure Three.js (re-exported by @iwsdk/core): a synthwave
 * void of stars, drifting nebulae and distant monoliths for scale, plus the two
 * gameplay surfaces — the dodge grid that rides under the player and the neon
 * slide ramp. Kept free of game state so the systems can show/hide and recolour
 * these pieces as phases change.
 */

import {
  AdditiveBlending,
  BoxGeometry,
  BufferGeometry,
  Color,
  EdgesGeometry,
  Float32BufferAttribute,
  FogExp2,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Points,
  PointsMaterial,
  Scene,
} from '@iwsdk/core';

import {
  CELL_SIZE,
  GRID_N,
  GRID_SPAN,
  KILL_HALF,
  NEON,
  SLIDE_ANGLE_DEG,
} from './config.js';

/** Neon-edged box: black fill with a glowing wireframe, the signature DOWN look. */
export function neonBox(
  w: number,
  h: number,
  d: number,
  color: number,
): Group {
  const group = new Group();
  const fill = new Mesh(
    new BoxGeometry(w * 0.94, h * 0.94, d * 0.94),
    new MeshBasicMaterial({ color: 0x000000 }),
  );
  const edges = new LineSegments(
    new EdgesGeometry(new BoxGeometry(w, h, d)),
    new LineBasicMaterial({ color }),
  );
  group.add(fill, edges);
  return group;
}

/** Build the always-present atmosphere directly into the scene. */
export function buildStaticEnvironment(scene: Scene): void {
  scene.fog = new FogExp2(0x050510, 0.0016);

  // --- Starfield: a couple of thousand additive points spread through the void.
  const starCount = 2200;
  const positions = new Float32Array(starCount * 3);
  const colors = new Float32Array(starCount * 3);
  const tint = new Color();
  for (let i = 0; i < starCount; i++) {
    const r = 120 + Math.random() * 700;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = (Math.random() - 0.3) * 600;
    positions[i * 3 + 2] = -Math.abs(r * Math.cos(phi)) - 40;
    tint.setHSL(0.5 + Math.random() * 0.35, 0.7, 0.7 + Math.random() * 0.3);
    colors[i * 3] = tint.r;
    colors[i * 3 + 1] = tint.g;
    colors[i * 3 + 2] = tint.b;
  }
  const starGeo = new BufferGeometry();
  starGeo.setAttribute('position', new Float32BufferAttribute(positions, 3));
  starGeo.setAttribute('color', new Float32BufferAttribute(colors, 3));
  const stars = new Points(
    starGeo,
    new PointsMaterial({
      size: 1.6,
      vertexColors: true,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
    }),
  );
  scene.add(stars);

  // --- Nebula clouds: big, faint, additive spheres of colour.
  const nebulaColors = [0x330066, 0x003366, 0x660033, 0x113355];
  for (let i = 0; i < 5; i++) {
    const geo = new PlaneGeometry(400, 400);
    const mat = new MeshBasicMaterial({
      color: nebulaColors[i % nebulaColors.length],
      transparent: true,
      opacity: 0.12,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    const cloud = new Mesh(geo, mat);
    cloud.position.set(
      (Math.random() - 0.5) * 1000,
      (Math.random() - 0.5) * 400,
      -500 - Math.random() * 700,
    );
    scene.add(cloud);
  }

  // --- Monoliths: tall dark towers with neon emissive edges, for parallax/scale.
  const towerColors = [NEON.magenta, NEON.cyan, NEON.hotPink, 0x4400aa];
  for (let i = 0; i < 26; i++) {
    const w = 18 + Math.random() * 50;
    const h = 160 + Math.random() * 320;
    const side = Math.random() < 0.5 ? -1 : 1;
    const tower = neonBox(w, h, w, towerColors[i % towerColors.length]);
    tower.position.set(
      side * (180 + Math.random() * 320),
      -120 - Math.random() * 360,
      -120 - Math.random() * 1600,
    );
    scene.add(tower);
  }

  // --- A far ground glow plane to anchor the world.
  const ground = new Mesh(
    new PlaneGeometry(4000, 4000),
    new MeshBasicMaterial({ color: 0x020208 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -520, -600);
  scene.add(ground);
}

/**
 * The dodge grid that rides under the player: GRID_N x GRID_N cyan cells with a
 * red kill-zone border. Returned as a Group to parent under the rig.
 */
export function createDodgeGrid(): Group {
  const group = new Group();
  const half = GRID_SPAN / 2;

  const lineMat = new LineBasicMaterial({ color: NEON.cyan });
  const gridGeo = new BufferGeometry();
  const verts: number[] = [];
  for (let i = 0; i <= GRID_N; i++) {
    const o = -half + i * CELL_SIZE;
    verts.push(-half, 0, o, half, 0, o); // line along X
    verts.push(o, 0, -half, o, 0, half); // line along Z
  }
  gridGeo.setAttribute('position', new Float32BufferAttribute(verts, 3));
  group.add(new LineSegments(gridGeo, lineMat));

  // Kill-zone border (red square the head must stay inside).
  const kHalf = KILL_HALF;
  const killGeo = new BufferGeometry();
  killGeo.setAttribute(
    'position',
    new Float32BufferAttribute(
      [
        -kHalf, 0.01, -kHalf, kHalf, 0.01, -kHalf,
        kHalf, 0.01, -kHalf, kHalf, 0.01, kHalf,
        kHalf, 0.01, kHalf, -kHalf, 0.01, kHalf,
        -kHalf, 0.01, kHalf, -kHalf, 0.01, -kHalf,
      ],
      3,
    ),
  );
  group.add(
    new LineSegments(killGeo, new LineBasicMaterial({ color: NEON.red })),
  );

  return group;
}

/**
 * A neon slide ramp of the given length (metres), pitched at SLIDE_ANGLE_DEG.
 * Origin at the top of the ramp; it descends along -Z/-Y. Returned as a Group
 * positioned by the caller.
 */
export function createSlopeRamp(length: number): Group {
  const group = new Group();
  const rad = (SLIDE_ANGLE_DEG * Math.PI) / 180;
  group.rotation.x = rad; // tilt nose-down

  // Track surface.
  const deck = new Mesh(
    new PlaneGeometry(1.9, length),
    new MeshBasicMaterial({ color: 0x0a0a18, transparent: true, opacity: 0.75 }),
  );
  deck.rotation.x = -Math.PI / 2;
  deck.position.set(0, 0, -length / 2);
  group.add(deck);

  // Edge rails (cyan) and lane lines (magenta).
  const railMat = new LineBasicMaterial({ color: NEON.cyan });
  const laneMat = new LineBasicMaterial({ color: NEON.magenta });
  const railGeo = new BufferGeometry();
  railGeo.setAttribute(
    'position',
    new Float32BufferAttribute(
      [-0.9, 0.02, 0, -0.9, 0.02, -length, 0.9, 0.02, 0, 0.9, 0.02, -length],
      3,
    ),
  );
  group.add(new LineSegments(railGeo, railMat));
  const laneGeo = new BufferGeometry();
  laneGeo.setAttribute(
    'position',
    new Float32BufferAttribute(
      [-0.3, 0.02, 0, -0.3, 0.02, -length, 0.3, 0.02, 0, 0.3, 0.02, -length],
      3,
    ),
  );
  group.add(new LineSegments(laneGeo, laneMat));

  return group;
}
