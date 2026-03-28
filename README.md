# Photobooth

A zero-friction, browser-based photo booth. Walk up, take photos, download a beautiful strip — no signup, no backend, no install. Just a URL.

Live demo: deploy to Netlify or Vercel in one click (see below).

---

## Features

- **Camera capture** — 3-2-1 countdown with flash animation and shutter sound
- **4 layouts** — 4-strip, 3-strip, 2x2 grid, single
- **5 real-time filters** — None, B&W, Vintage, Warm, Cool (applied live in preview and baked into the strip)
- **Custom overlay** — upload a PNG event frame drawn on top of every strip
- **QR code download** — scan with your phone to save the strip instantly
- **GIF export** — animated GIF with progress bar, 15s timeout, abort on reset
- **Upload mode** — drag & drop your own photos when camera is unavailable
- **Kiosk mode** — auto-resets after 30s, operator Stay/Go Now controls (`?kiosk=true`)
- **Print** — browser print dialog, sized for 2×8in strips
- **PWA** — installable, works offline after first load

Everything runs in the browser. No server, no database, no accounts.

---

## Stack

| Tool | Purpose |
|------|---------|
| Vite + React + TypeScript | App framework |
| Tailwind CSS | Styling |
| `gif-encoder-2` | GIF encoding via Web Worker |
| `qrcode` | QR data URI generation |
| `html2canvas` | Safari Canvas filter fallback (lazy-loaded) |
| Vitest | Unit tests |
| Playwright | E2E tests |

---

## Getting Started

```bash
# Install dependencies
pnpm install

# Start dev server
pnpm dev

# Open http://localhost:5173
```

### Kiosk mode

```
http://localhost:5173?kiosk=true
```

After each session completes, a 30-second countdown appears. The booth auto-resets when it hits zero.

---

## Running Tests

```bash
# Unit tests (42 tests across 6 files)
pnpm test

# E2E tests (requires a running dev server)
pnpm dev &
pnpm playwright test
```

---

## Deployment

The app requires two HTTP headers for GIF multi-threading (`SharedArrayBuffer`):

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

Both `netlify.toml` and `vercel.json` are pre-configured with these headers.

### Netlify

```bash
pnpm build
# Drag the dist/ folder into Netlify's UI, or connect the repo for CI/CD
```

### Vercel

```bash
pnpm build
vercel --prod
```

### GitHub Pages

GitHub Pages does not support custom response headers, so GIF encoding will fall back to single-threaded mode (still works, slightly slower).

---

## Architecture

```
src/
  types.ts          — AppState, Layout, FilterName, FILTER_CSS, LAYOUT_DIMENSIONS
  reducer.ts        — Immutable state machine (IDLE → COUNTDOWN → COMPOSITING → RESULT)
  App.tsx           — Root: useReducer + useCamera + state router
  hooks/
    useCamera.ts    — getUserMedia, 10s timeout, retry, track.onended handler
  lib/
    composeStrip.ts — Pure canvas composition (frames + filter + overlay → Blob)
    generateQR.ts   — QR data URI with JPEG quality fallback loop
    encodeGif.ts    — gif-encoder-2 wrapper with AbortSignal + 15s timeout
  components/
    CameraPreview.tsx   — <video> with CSS filter + throttled swatch snapshots
    Countdown.tsx       — 3-2-1, flash, Web Audio shutter sound
    ResultView.tsx      — Strip preview, QR, GIF progress, action buttons
    UploadZone.tsx      — Drag & drop file input, validates count per layout
    KioskOverlay.tsx    — 30s countdown, Go Now / Stay
    ErrorBoundary.tsx   — React error boundary with restart
```

State machine transitions:

```
IDLE → COUNTDOWN → CAPTURING → COMPOSITING → RESULT
 ↑                                              |
 └──────────────── RESET ──────────────────────┘
                    ↓
                  ERROR (any unrecoverable failure)
```

---

## Browser Support

| Browser | Camera | Filters | GIF |
|---------|--------|---------|-----|
| Chrome 90+ | ✓ | ✓ | ✓ (multi-thread) |
| Firefox 90+ | ✓ | ✓ | ✓ (multi-thread) |
| Safari 16+ | ✓ | ✓ | ✓ (single-thread) |
| Safari < 16 | ✓ | html2canvas fallback | ✓ |
| iOS Safari | ✓ (portrait) | ✓ | ✓ |

---

## License

MIT
