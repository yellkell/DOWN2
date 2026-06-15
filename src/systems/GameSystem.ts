/*
 * GameSystem — the heart of DOWN 2.
 *
 * Owns the phase state machine (MENU -> DODGE -> SLIDE -> ... -> WIN/GAME_OVER),
 * the procedural soundtrack, the HUD, scoring, input, and the two gameplay
 * mechanics:
 *
 *   DODGE  the player hovers over a world-fixed neon grid; each musical bar a
 *          wave of neon columns rises from below and arrives at head height
 *          exactly on the beat, with one safe cell. Move your head (physically,
 *          or with stick/WASD) over the gap. Leaving the kill-zone is fatal.
 *
 *   SLIDE  the player rides a pitched neon ramp, weaving left/right through red
 *          barrier gates and grabbing bonus orbs, until reaching the next ledge.
 *
 * Obstacles, barriers and orbs are managed as plain Three.js objects in arrays
 * (pooled-by-array, created/removed per phase) rather than ECS entities — the
 * lighter touch the audio example uses for transient props.
 */

import {
  createSystem,
  Group,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  OctahedronGeometry,
  SphereGeometry,
  Vector3,
} from '@iwsdk/core';

import { Synthwave } from '../audio/synthwave.js';
import { Hud } from '../hud.js';
import {
  createDodgeGrid,
  createSlopeRamp,
  neonBox,
} from '../environment.js';
import {
  BARRIER_HALF_W,
  BARRIER_PASS_SCORE,
  BARRIER_SPACING,
  CELL_SIZE,
  DODGE_BEATS,
  DODGE_CLEAR_SCORE,
  EYE_HEIGHT,
  GRID_N,
  KILL_HALF,
  NEON,
  OBSTACLE_COLORS,
  ORB_SCORE,
  RISE_DISTANCE,
  SLIDE_ANGLE_DEG,
  SLIDE_DROP,
  SLIDE_LANES,
  SLIDE_SPEED,
  START_HEIGHT,
  TOTAL_PHASES,
  WAVE_BEATS,
} from '../config.js';

type State = 'MENU' | 'DODGE' | 'SLIDE' | 'GAME_OVER' | 'WIN';

interface Column {
  obj: Object3D;
  cellX: number;
  cellZ: number;
  waveId: number;
}

interface Barrier {
  obj: Object3D;
  x: number;
  z: number;
  passed: boolean;
}

interface Orb {
  obj: Object3D;
  pos: Vector3;
  taken: boolean;
}

const STRAFE_SPEED = 1.7; // m/s for stick / keyboard lateral assist
const DEADZONE = 0.15;

export class GameSystem extends createSystem({}) {
  private synth = new Synthwave();
  private hud!: Hud;

  private state: State = 'MENU';
  private score = 0;
  private combo = 1;
  private phase = 1;

  // Dodge phase ----------------------------------------------------------------
  private grid: Group | null = null;
  private columns: Column[] = [];
  private waveRemaining = new Map<number, number>();
  private dodgeStartBeat = 0;
  private lastWaveSlot = -1;
  private planeY = 0; // world Y where columns meet the head

  // Slide phase ----------------------------------------------------------------
  private ramp: Group | null = null;
  private barriers: Barrier[] = [];
  private orbs: Orb[] = [];
  private slideTargetY = 0;
  private isFinalSlide = false;

  // Input ----------------------------------------------------------------------
  private keys = new Set<string>();
  private startQueued = false;
  private beatPulse = 0;

  private readonly hp = new Vector3(); // scratch: head world position

  init(): void {
    this.hud = new Hud(this.camera);

    // Start the void facing down the descent.
    this.player.position.set(0, START_HEIGHT, 0);
    this.camera.position.set(0, EYE_HEIGHT, 0);

    // Subtle visual pulse synced to the kick.
    this.synth.onBeat(() => {
      this.beatPulse = 1;
    });

    // Keyboard fallback (desktop) + gesture to unlock audio.
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (e.code === 'Space' || e.code === 'Enter') this.startQueued = true;
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('pointerdown', () => {
      // A gesture is enough to allow the AudioContext to resume later.
      if (this.state === 'MENU' || this.state === 'GAME_OVER' || this.state === 'WIN') {
        this.startQueued = true;
      }
    });

    this.showMenu();
  }

  // ===========================================================================
  // State entry
  // ===========================================================================
  private showMenu(): void {
    this.state = 'MENU';
    this.hud.setStatus(0, 1, 'DOWN 2');
    this.hud.showCenter(
      ['DOWN 2', 'Dodge the rising grid to the beat,\nthen ride the slide down.', 'TRIGGER / SPACE to drop in'],
      '#ff00ff',
      0,
      0,
    );
  }

  private startRun(): void {
    this.score = 0;
    this.combo = 1;
    this.phase = 1;
    this.synth.start();
    this.enterDodge();
  }

  private heightForPhase(p: number): number {
    return START_HEIGHT - (p - 1) * SLIDE_DROP;
  }

  private enterDodge(): void {
    this.state = 'DODGE';
    this.clearSlide();

    const h = this.heightForPhase(this.phase);
    this.player.position.set(0, h, 0);
    this.planeY = h + EYE_HEIGHT;

    this.grid = createDodgeGrid();
    this.grid.position.set(0, h, 0);
    this.scene.add(this.grid);

    this.columns = [];
    this.waveRemaining.clear();
    this.lastWaveSlot = -1;
    this.dodgeStartBeat = this.synth.getBeat();
    this.synth.setIntensity(0.2 + (this.phase / TOTAL_PHASES) * 0.6);

    this.hud.showCenter(
      [`PHASE ${this.phase}`, 'LOOK DOWN — DODGE', ''],
      '#00ffff',
      2,
      this.now,
    );
  }

  private enterSlide(): void {
    this.state = 'SLIDE';
    this.clearDodge();

    this.isFinalSlide = this.phase >= TOTAL_PHASES;
    const h = this.player.position.y;
    const drop = this.isFinalSlide ? SLIDE_DROP * 2.4 : SLIDE_DROP;
    this.slideTargetY = h - drop;

    const rad = (SLIDE_ANGLE_DEG * Math.PI) / 180;
    const length = drop / Math.sin(rad) + 12;

    this.ramp = createSlopeRamp(length);
    this.ramp.position.set(0, h, 0);
    this.scene.add(this.ramp);

    this.buildBarriers(h, rad, length);

    this.synth.setIntensity(0.6 + (this.phase / TOTAL_PHASES) * 0.4);
    this.hud.showCenter(
      [this.isFinalSlide ? 'FINAL SLIDE!' : 'SLIDE!', 'Weave the gaps — grab the orbs', ''],
      '#ff00ff',
      1.8,
      this.now,
    );
  }

  private win(): void {
    this.state = 'WIN';
    this.clearDodge();
    this.clearSlide();
    this.synth.stop();
    this.hud.showCenter(
      ['YOU MADE IT', `SCORE ${this.score}`, 'TRIGGER / SPACE to ride again'],
      '#00ff66',
      0,
      this.now,
    );
  }

  private gameOver(): void {
    if (this.state === 'GAME_OVER') return;
    this.state = 'GAME_OVER';
    this.synth.stop();
    this.hud.showCenter(
      ['GAME OVER', `SCORE ${this.score}   PHASE ${this.phase}/${TOTAL_PHASES}`, 'TRIGGER / SPACE to retry'],
      '#ff0033',
      0,
      this.now,
    );
  }

  // ===========================================================================
  // Per-frame update
  // ===========================================================================
  private now = 0;

  update(delta: number, time: number): void {
    this.now = time;
    this.hud.update(time);
    this.beatPulse = Math.max(0, this.beatPulse - delta * 4);

    const select = this.selectPressed();

    if (this.state === 'MENU' || this.state === 'GAME_OVER' || this.state === 'WIN') {
      if (select || this.startQueued) {
        this.startQueued = false;
        this.hud.hideCenter();
        this.startRun();
      }
      return;
    }

    // Live head position drives all collision checks.
    this.camera.getWorldPosition(this.hp);

    if (this.state === 'DODGE') this.updateDodge(delta);
    else if (this.state === 'SLIDE') this.updateSlide(delta);

    this.hud.setStatus(this.score, this.combo, `PHASE ${this.phase}/${TOTAL_PHASES}`);
  }

  // --- Dodge ------------------------------------------------------------------
  private updateDodge(delta: number): void {
    this.applyStrafe(delta, KILL_HALF - 0.05, true);

    const beat = this.synth.getBeat();
    const elapsed = beat - this.dodgeStartBeat;

    // Spawn a fresh wave at the top of each WAVE_BEATS slot.
    const slot = Math.floor(elapsed / WAVE_BEATS);
    if (slot > this.lastWaveSlot && elapsed < DODGE_BEATS) {
      this.lastWaveSlot = slot;
      this.spawnWave(slot);
    }

    const riseSpeed = RISE_DISTANCE / (WAVE_BEATS * this.synth.beatDuration);
    const exitY = this.planeY + 2.0;

    for (let i = this.columns.length - 1; i >= 0; i--) {
      const c = this.columns[i];
      c.obj.position.y += riseSpeed * delta;
      c.obj.rotation.x += delta * 1.6;
      c.obj.rotation.y += delta * 1.2;

      // Collision: head inside this column's cell while it crosses head height.
      if (Math.abs(c.obj.position.y - this.planeY) < 0.38) {
        if (
          Math.abs(this.hp.x - c.cellX) < CELL_SIZE * 0.42 &&
          Math.abs(this.hp.z - c.cellZ) < CELL_SIZE * 0.42
        ) {
          this.gameOver();
          return;
        }
      }

      if (c.obj.position.y > exitY) {
        this.scene.remove(c.obj);
        this.columns.splice(i, 1);
        const left = (this.waveRemaining.get(c.waveId) ?? 1) - 1;
        this.waveRemaining.set(c.waveId, left);
        if (left === 0) {
          // Survived a whole wave cleanly.
          this.score += DODGE_CLEAR_SCORE * this.combo;
          this.combo++;
        }
      }
    }

    // Kill-zone: head may not leave the grid box.
    if (Math.abs(this.hp.x) > KILL_HALF || Math.abs(this.hp.z) > KILL_HALF) {
      this.gameOver();
      return;
    }

    // Beat pulse on the grid for rhythm feedback.
    if (this.grid) this.grid.scale.setScalar(1 + this.beatPulse * 0.06);

    if (elapsed >= DODGE_BEATS && this.columns.length === 0) {
      this.enterSlide();
    }
  }

  private spawnWave(slot: number): void {
    const cells = GRID_N * GRID_N;
    // Difficulty: fill more cells as phases progress, always leave >=1 safe.
    const fill = Math.min(cells - 1, 3 + this.phase);
    const safeCount = cells - fill;

    // Choose which cell indices stay open.
    const order = [...Array(cells).keys()];
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    const safe = new Set(order.slice(0, safeCount));

    const waveId = slot;
    let count = 0;
    const off = (GRID_N - 1) / 2;
    for (let idx = 0; idx < cells; idx++) {
      if (safe.has(idx)) continue;
      const r = Math.floor(idx / GRID_N);
      const c = idx % GRID_N;
      const cellX = (c - off) * CELL_SIZE;
      const cellZ = (r - off) * CELL_SIZE;
      const color = OBSTACLE_COLORS[(idx + slot) % OBSTACLE_COLORS.length];

      const obj = this.makeColumn(color);
      obj.position.set(cellX, this.planeY - RISE_DISTANCE, cellZ);
      this.scene.add(obj);
      this.columns.push({ obj, cellX, cellZ, waveId });
      count++;
    }
    this.waveRemaining.set(waveId, count);
  }

  private makeColumn(color: number): Object3D {
    const group = new Group();
    const size = CELL_SIZE * 0.34;
    const fill = new Mesh(
      new OctahedronGeometry(size * 0.9),
      new MeshBasicMaterial({ color: 0x000000 }),
    );
    const shell = new Mesh(
      new OctahedronGeometry(size),
      new MeshBasicMaterial({ color, wireframe: true }),
    );
    group.add(fill, shell);
    return group;
  }

  // --- Slide ------------------------------------------------------------------
  private updateSlide(delta: number): void {
    this.applyStrafe(delta, 0.85, false);

    const rad = (SLIDE_ANGLE_DEG * Math.PI) / 180;
    this.player.position.z += -Math.cos(rad) * SLIDE_SPEED * delta;
    this.player.position.y += -Math.sin(rad) * SLIDE_SPEED * delta;

    // Barrier collisions / scoring as gates pass the head.
    for (const b of this.barriers) {
      if (b.passed) continue;
      if (Math.abs(this.hp.z - b.z) < 0.5) {
        if (Math.abs(this.hp.x - b.x) < BARRIER_HALF_W + 0.12) {
          this.gameOver();
          return;
        }
      }
      if (b.z > this.hp.z + 0.5) {
        // Gate is now behind the player — cleared.
        b.passed = true;
        this.score += BARRIER_PASS_SCORE;
      }
    }

    // Orb pickups.
    for (const o of this.orbs) {
      if (o.taken) continue;
      if (this.hp.distanceTo(o.pos) < 0.5) {
        o.taken = true;
        o.obj.visible = false;
        this.score += ORB_SCORE;
        this.combo++;
      }
    }

    if (this.player.position.y <= this.slideTargetY) {
      if (this.isFinalSlide) {
        this.win();
      } else {
        this.phase++;
        this.enterDodge();
      }
    }
  }

  private buildBarriers(topY: number, rad: number, length: number): void {
    const count = Math.floor(length / BARRIER_SPACING);
    const blocks = Math.min(SLIDE_LANES.length - 1, 1 + Math.floor(this.phase / 2));

    for (let i = 2; i <= count; i++) {
      const dist = i * BARRIER_SPACING;
      const z = -Math.cos(rad) * dist;
      const y = topY - Math.sin(rad) * dist;

      // Pick which lanes are blocked this gate, leaving the rest open.
      const lanes = [...SLIDE_LANES.keys()];
      for (let k = lanes.length - 1; k > 0; k--) {
        const j = Math.floor(Math.random() * (k + 1));
        [lanes[k], lanes[j]] = [lanes[j], lanes[k]];
      }
      const blocked = lanes.slice(0, blocks);
      const open = lanes.filter((l) => !blocked.includes(l));

      for (const laneIdx of blocked) {
        const x = SLIDE_LANES[laneIdx];
        const wall = neonBox(BARRIER_HALF_W * 2, 2.6, 0.16, NEON.red);
        wall.position.set(x, y + 1.3, z);
        wall.rotation.x = rad;
        this.scene.add(wall);
        this.barriers.push({ obj: wall, x, z, passed: false });
      }

      // Drop a bonus orb in an open lane on some gates.
      if (open.length && i % 2 === 0) {
        const x = SLIDE_LANES[open[Math.floor(Math.random() * open.length)]];
        const orb = new Mesh(
          new SphereGeometry(0.16, 16, 12),
          new MeshBasicMaterial({ color: NEON.yellow }),
        );
        orb.position.set(x, y + 1.4, z);
        this.scene.add(orb);
        this.orbs.push({
          obj: orb,
          pos: orb.position.clone(),
          taken: false,
        });
      }
    }
  }

  // ===========================================================================
  // Input + cleanup helpers
  // ===========================================================================
  private selectPressed(): boolean {
    const r = this.input.gamepads.right?.getSelectStart() ?? false;
    const l = this.input.gamepads.left?.getSelectStart() ?? false;
    return r || l;
  }

  /** Lateral (and, in dodge, forward) assist from stick or keyboard. */
  private applyStrafe(delta: number, limit: number, allowZ: boolean): void {
    let dx = 0;
    let dz = 0;

    const stick = this.input.gamepads.left?.getAxesValues('xr-standard-thumbstick');
    if (stick) {
      if (Math.abs(stick.x) > DEADZONE) dx += stick.x;
      if (allowZ && Math.abs(stick.y) > DEADZONE) dz += stick.y; // y down = +z forward
    }
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) dx -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) dx += 1;
    if (allowZ && (this.keys.has('KeyW') || this.keys.has('ArrowUp'))) dz -= 1;
    if (allowZ && (this.keys.has('KeyS') || this.keys.has('ArrowDown'))) dz += 1;

    this.player.position.x += dx * STRAFE_SPEED * delta;
    this.player.position.x = Math.max(-limit, Math.min(limit, this.player.position.x));
    if (allowZ) {
      this.player.position.z += dz * STRAFE_SPEED * delta;
      this.player.position.z = Math.max(-limit, Math.min(limit, this.player.position.z));
    }
  }

  private clearDodge(): void {
    if (this.grid) {
      this.scene.remove(this.grid);
      this.grid = null;
    }
    for (const c of this.columns) this.scene.remove(c.obj);
    this.columns = [];
    this.waveRemaining.clear();
  }

  private clearSlide(): void {
    if (this.ramp) {
      this.scene.remove(this.ramp);
      this.ramp = null;
    }
    for (const b of this.barriers) this.scene.remove(b.obj);
    for (const o of this.orbs) this.scene.remove(o.obj);
    this.barriers = [];
    this.orbs = [];
    // Recentre lateral position for the next phase.
    this.player.position.x = 0;
    this.player.position.z = 0;
  }
}
