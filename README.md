# Papercraft Desert

A calm, low-poly **papercraft desert diorama** for WebXR, built on Meta's
[Immersive Web SDK](https://github.com/facebook/immersive-web-sdk) (IWSDK) — a
Three.js + Entity-Component-System framework. Put on a headset and stand in the
dunes at golden hour, or explore it in the desktop emulator.

Everything you see is **folded paper**: rolling dunes, saguaro and barrel cacti,
agave rosettes, layered red-rock mesas, drifting clouds, a tumbleweed that rolls
across the sand, and the occasional dust devil that spins up from a swirl of
paper scraps — all faceted, flat-shaded card lit by a single warm sun.

## The papercraft look

There's no texture art anywhere. The whole aesthetic comes from one helper,
`paperMesh` (`src/paper.ts`), which turns any Three.js geometry into a piece of
cut paper:

1. **Vertex jitter** — edges are nudged off true so nothing looks machine-cut.
2. **Flat shading** — geometry is split per-triangle so every face is a crisp fold.
3. **Per-facet sheen** — each face is darkened a random touch via vertex colours,
   the way adjacent paper panels catch a light differently.

A low, warm key light plus a soft sky/ground fill does the rest. Drop the sun
angle or swap the palette (`src/palette.ts`) and the whole mood changes.

## Run it

Requires Node ≥ 20.19.

```bash
npm install
npm run dev      # opens an HTTPS dev server with the Quest 3 emulator
```

- **On a headset:** open the Network URL the dev server prints (HTTPS is provided
  by `vite-plugin-mkcert`) and hit **Enter VR**.
- **On a laptop:** the IWSDK dev emulator gives you mouse-look + WASD — no headset
  needed.

Build for production with `npm run build` (outputs to `dist/`).

## Project layout

```
src/
  index.ts                 World bootstrap; registers the ambient system
  palette.ts               The desert colour palette (re-theme from here)
  paper.ts                 The papercraft toolkit: paperMesh + seeded RNG
  scene/
    terrain.ts             Dune heightfield + shared duneHeight() sampler
    sky.ts                 Gradient sky dome and the low sun
    plants.ts              Saguaro, barrel cactus, agave, tumbleweed
    rocks.ts               Layered mesas and scattered boulders
    clouds.ts              Drifting paper cloud puffs
    dustdevil.ts           A swirling column of paper scraps
    index.ts               Scatters everything; returns the animated handles
  systems/AmbientSystem.ts Lighting + shadows, scene build, motion, dust devils
```

## Earlier in this repo

`vr/` and `vrh/` hold an unrelated earlier experiment — a pair of single-page
[A-Frame](https://aframe.io/) games — kept here for reference. They're not part
of the papercraft desert.
