<p align="center"><img src="concept/assets/harvestia-logo-480.png" alt="Harvestia" width="360"></p>

# Harvestia

**Grow your farm. Trade the markets. Build your empire.**

Harvestia is a browser-based pixel-art farming game with an agricultural economy referenced to real commodity markets and a $HRV token economy (Robinhood Chain first, BNB Chain later).

## Current stage: 1 — Visual concept

`concept/` is a live, pannable pixel-art world rendered by the game's own sprite code (no mock-ups): six zones (livestock ranch, main farm, mill & industry, marketplace, co-op village, riverside), animated livestock, farmers and machinery, the game HUD, and an art-direction sheet (palette, terrain, crops, animals, buildings, machinery, UI kit, and what becomes playable in which stage).

Commodity prices shown are **simulated demo values**, clearly labelled. Wallet and vault balances are placeholders until Stage 8.

| File | Purpose |
|---|---|
| `concept/art.js` | Procedural pixel-art sprite library |
| `concept/world.js` | Terrain generation, world layout, ambient animation |
| `concept/ui.js` | HUD, icons, camera, minimap, object inspector |
| `concept/sheet.js` | Art-direction sheet |
| `concept/serve.mjs` | Zero-dependency static server (local + Railway) |

## Run locally

```bash
npm start
```

Then open http://127.0.0.1:5180.

## Deploy

- **Vercel** serves `concept/` as static files (`vercel.json`).
- **Railway** runs `node concept/serve.mjs` (`railway.json`), listening on `$PORT`.

## Roadmap

Development is stage-gated; each stage ships only after explicit approval. Stages: 1 visual concept · 2 playable world · 3 animation polish · 4 game UI · 5 core gameplay · 6 backend · 7 commodity economy · 8 blockchain · 9 buybacks & rewards · 10 multiplayer & competitions · 11 production readiness.
