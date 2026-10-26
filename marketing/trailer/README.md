# Launch trailer (45 s)

A code-built trailer that uses the game's real footage, interface and sprite art, with an original synthesized soundtrack. It renders and encodes entirely in the browser (WebCodecs H.264 + AAC, `mp4-muxer`).

## Pieces

- `compose.js` — the 45 s timeline (six scenes), drawn on a canvas. `?v=1` renders the 1080×1920 vertical cut.
- `audio.js` — the soundtrack (120 BPM, A minor) plus effects synced to the footage. Passing `music = false` gives ambience and effects only.
- `server.mjs` — a local helper that serves the files and saves uploads (`clips/`, `stills/`, `out/`).

## Inputs (not committed; they are large)

- **`clips/*.webm`** — gameplay recorded from the running game with `canvas.captureStream()`. The shots are `flyover`, `plant`, `livestock`, `harvest`, `expand`, `market` and `finale`.
- **`stills/ui-*.png`** — real interface captured with `html-to-image` at 2×.
- **`harvestia-logo.png`** — from `public/assets/`.
- **`sprites.js`** — copied from `src/game/art/sprites.js`.
- **`market.json`, `hist-*.json`** — the live `/v1/market` snapshot and the market history.

## Render

```bash
npm install
node server.mjs
```

Open `http://127.0.0.1:4300/compose.html` (or add `?v=1` for vertical) in Chrome, then run `encodeAll()` in the console. It writes `out/harvestia-trailer-<16x9|9x16>.mp4` and `-no-music.mp4`. `renderAt(seconds)` saves a single frame for review.
