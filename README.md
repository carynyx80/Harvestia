<p align="center"><img src="public/assets/harvestia-logo-480.png" alt="Harvestia" width="360"></p>

# Harvestia

**Grow your farm. Trade the markets. Build your empire.**

Harvestia is a browser-based pixel-art farming game with an agricultural economy referenced to real commodity markets and a $HRV token economy (Robinhood Chain first, BNB Chain later).

## Current stage: 3 — Animations and visual polish

The world is alive:

- **Day and night:** a sky-tinted lighting pass from dawn to dusk to night. Windows switch on one by one and street lamps glow.
- **Weather:** sunny, cloudy, rain, storm (with lightning) and drought, with smooth transitions. Rain splashes on the ground and ripples on water; drought parches the land and stirs up dust.
- **Seasons:** spring, summer, autumn (orange, red and gold trees, falling leaves) and winter (snow cover, snowy trees, snowfall, iced shorelines). Grass and trees are repainted from season palettes.
- **Wind:** tree canopies sway, and gusts roll across the crop fields; both strengthen in storms.
- **Crops:** growth-stage sprites, a demo plot that loops plant → sprout → grow → harvest with pop and sparkle effects, and glints on ripe crops.
- **Water:** flowing sparkles, lapping shoreline foam, ripples, jumping fish and duck wakes.
- **Wildlife:** grazing cows and sheep, butterflies by day, fireflies at night, and bird flocks.
- **Environment panel:** set the time, clock speed, weather and season to review every look. The top bar shows the live season, day, weather, temperature and time.

Stage 2 foundations: a Next.js + Phaser 3 + TypeScript game:

- **World:** six zones on a 1024×640 art-pixel map with a 32×32 logical terrain grid (press **G** to show it).
- **Rendering:** the approved Stage 1 sprite library is recorded into packed texture atlases. Every object is a depth-sorted Phaser image, so characters walk behind trees and buildings correctly.
- **Animation:** animals, farmers, the tractor and the windmill blades play generated sprite-sheet animations.
- **Camera:** drag, WASD/arrow keys, mouse-wheel zoom toward the cursor, +/−, a live minimap, and zone navigation from the left menu.
- **Selection:**
  - buildings, fields and individual planting cells
  - animals and villagers
  - machinery
  - any terrain tile

  Hovering outlines an object; clicking selects it and opens the inspector.
- **React HUD** (Zustand state): profile, wallet and vault placeholders, a commodity board (clearly **simulated** demo values), a toolbar (keys 1–6), the inspector and view controls.

The Stage 1 concept and art-direction sheet stay available at `/concept/index.html`.

| Path | Purpose |
|---|---|
| `src/game/art/sprites.js` | Procedural pixel-art sprite library (approved in Stage 1) |
| `src/game/world/` | Geometry, terrain generation, world layout and hotspots |
| `src/game/render/atlas.ts` | Draw-call recorder, atlas packer, Graphics adapter |
| `src/game/scenes/WorldScene.ts` | Phaser scene: rendering, actors, camera, selection |
| `src/game/env/` | Clock, sky colours, weather looks, season palettes |
| `src/game/systems/` | Lighting, weather, water, wildlife, crop and particle systems |
| `src/store/game.ts` | Shared state between Phaser and the HUD |
| `src/components/hud/` | React HUD |

## Architecture

| Part | Where | Path |
|---|---|---|
| Frontend: Next.js + Phaser game client | Vercel, https://harvestia-one.vercel.app | repo root |
| Backend API: Fastify + TypeScript | Railway, https://harvestia-api.up.railway.app | `server/` |

The API currently exposes `GET /health` and `GET /v1/status`. Player accounts, persistent farm state, PostgreSQL, Redis and job queues arrive in Stage 6. CORS only allows the Vercel site, its preview deployments and local dev.

## Develop

```bash
npm install && npm --prefix server install
npm run dev        # frontend on http://localhost:5180
npm run api:dev    # API on http://127.0.0.1:4000
npm run api:test   # API tests
```

Copy `.env.example` to `.env.local` and point `NEXT_PUBLIC_API_URL` at `http://127.0.0.1:4000` to use a local API.

## Deploy

- **Vercel** builds the Next.js app from the repo root; `server/` is excluded via `.vercelignore`.
- **Railway** builds the service from the `server/` root directory (`npm run build`, then `npm run start`), health-checked on `/health`. It redeploys only when files under `server/` change.

## Roadmap

Development is stage-gated; each stage ships only after explicit approval.

1. Visual concept ✓
2. Playable world ✓
3. Animation polish ← current
4. Game UI
5. Core gameplay
6. Backend
7. Commodity economy
8. Blockchain
9. Buybacks and rewards
10. Multiplayer and competitions
11. Production readiness
