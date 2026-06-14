# DOWN 2

A neon synthwave **VR descent** for the immersive web — the sequel to the original
[**DOWN**](#the-original) (`/vr` and `/vrh` in this repo). Same invented genre:
**dodge to the beat, then slide.** Rebuilt from scratch on Meta's
[Immersive Web SDK](https://github.com/facebook/immersive-web-sdk) (IWSDK) — a
Three.js + Entity-Component-System WebXR framework.

```
TRIGGER / SPACE  →  drop in
```

## The genre

DOWN is a one-life **rhythm descent**. You fall down a neon mountain in two
alternating phases, set to driving synthwave:

1. **DODGE** — you hover over a glowing grid and *look down*. Each musical bar a
   wave of neon solids rockets **up** at you, leaving exactly one safe cell. Move
   your head over the gap before the wave hits — it lands **on the beat**. Drift
   out of the kill-zone and you're done.
2. **SLIDE** — you then ride a pitched neon ramp **down** to the next ledge,
   weaving left and right through red barrier gates and grabbing bonus orbs.

Clear five phases, then survive the final slide.

## What's new in the sequel

- **Beat-locked dodging.** A procedural Web Audio synthwave engine *is* the clock:
  waves are scheduled so each one arrives at head height exactly on the beat, so
  you genuinely dodge *to the music*. No streamed tracks — the soundtrack is
  generated, sample-accurate, and self-contained.
- **3×3 dodge grid** (up from 2×2) for finer, more readable gaps.
- **Score + combo chase.** Clean wave clears, barrier passes, and orb pickups
  build a multiplier — the original was survival-only.
- **IWSDK / Three.js ECS** instead of A-Frame: real WebXR sessions, desktop
  emulation, and a clean systems architecture.

## Controls

| Action | VR | Desktop (emulator) |
| --- | --- | --- |
| Dodge / weave | Move your head, or push the **left thumbstick** | **WASD** / arrow keys, or move with the mouse |
| Start / retry | **Trigger** | **Space / Enter** or click |

Primary play is physical movement (lean, step, duck). Stick/keyboard assist is
there so the game is comfortable seated and easy to test on a laptop.

## Run it

Requires Node ≥ 20.19.

```bash
npm install
npm run dev      # opens an HTTPS dev server with the Quest 3 emulator
```

- **On a headset:** open the Network URL the dev server prints (HTTPS is provided
  by `vite-plugin-mkcert`) and hit **Enter VR**.
- **On a laptop:** the IWSDK dev emulator gives you mouse + WASD — no headset
  needed.

Build for production with `npm run build` (outputs to `dist/`).

## Project layout

```
src/
  index.ts                 World bootstrap + scenery, registers the game system
  config.ts                All gameplay tuning (grid, slope, scoring, palette)
  audio/synthwave.ts       Procedural synthwave engine + sample-accurate beat clock
  environment.ts           Starfield, monoliths, the dodge grid, the slide ramp
  hud.ts                   Canvas-texture HUD (score / combo / prompts)
  systems/GameSystem.ts    Phase state machine, spawning, collisions, scoring, input
```

## The original

The first DOWN is preserved here as a reference:

- `vr/` — the base build
- `vrh/` — the expanded "hard" build (5 phases, taller mountain)

Both are single-page [A-Frame](https://aframe.io/) games and also live at
`yellkell.com/vr` and `yellkell.com/vrh`.
