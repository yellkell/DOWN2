/*
 * Central gameplay tuning for DOWN 2.
 *
 * The sequel keeps the original DOWN loop — dodge a rising grid, then slide a
 * neon slope — but locks the dodge waves to a procedural beat and layers a
 * score/combo system on top. Constants live here so the feel can be tuned in
 * one place.
 */

// ---------------------------------------------------------------------------
// Player / world framing
// ---------------------------------------------------------------------------
export const EYE_HEIGHT = 1.6; // camera height above the rig origin (metres)
export const START_HEIGHT = 120; // rig Y at the top of the mountain

// ---------------------------------------------------------------------------
// Dodge phase (the "look down, rise on the beat" grid)
// ---------------------------------------------------------------------------
export const GRID_N = 3; // 3x3 cells (the original used 2x2; the sequel adds nuance)
export const CELL_SIZE = 0.6; // metres per cell -> 1.8m grid, the "clear a 1.8m space" footprint
export const GRID_SPAN = GRID_N * CELL_SIZE;
export const KILL_HALF = GRID_SPAN / 2 + 0.15; // head may not leave this box during dodging

export const RISE_DISTANCE = 6; // how far below the head obstacles spawn
export const WAVE_BEATS = 2; // a fresh wave arrives at head height every N beats
export const HIT_BAND = 0.38; // vertical half-window (m) where a column can clip the head
export const DODGE_BEATS = 32; // length of a dodge phase, in beats (~16s at 120bpm)

// ---------------------------------------------------------------------------
// Slide phase (the "weave the slope" descent)
// ---------------------------------------------------------------------------
export const SLIDE_ANGLE_DEG = 20; // slope pitch, matching the original
export const SLIDE_SPEED = 14; // metres/second down the slope
export const BARRIER_SPACING = 7; // metres between barrier gates along the slope
export const BARRIER_HALF_W = 0.22; // half width of a barrier wall
export const SLIDE_LANES = [-0.7, -0.35, 0, 0.35, 0.7]; // lane X positions
export const SLIDE_DROP = 26; // vertical drop per slide phase

// ---------------------------------------------------------------------------
// Progression / scoring
// ---------------------------------------------------------------------------
export const TOTAL_PHASES = 5; // dodge+slide pairs before the final slide
export const DODGE_CLEAR_SCORE = 100; // per wave survived
export const BARRIER_PASS_SCORE = 75; // per barrier gate cleared
export const ORB_SCORE = 150; // per bonus orb collected on the slide

// ---------------------------------------------------------------------------
// Neon palette
// ---------------------------------------------------------------------------
export const NEON = {
  cyan: 0x00ffff,
  magenta: 0xff00ff,
  hotPink: 0xff0066,
  orange: 0xff3300,
  yellow: 0xffff00,
  red: 0xff0000,
  green: 0x00ff66,
};

export const OBSTACLE_COLORS = [
  NEON.hotPink,
  NEON.magenta,
  NEON.orange,
  NEON.yellow,
  NEON.cyan,
];
