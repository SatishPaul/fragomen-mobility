# TRD — AI Video Maker Web App (v1)

**Companion to:** PRD v1.0, 15 July 2026
**Stack summary:** Next.js (App Router) on Vercel Hobby · all heavy compute client-side · OpenRouter for LLM/vision · Kokoro-82M in-browser for TTS · ffmpeg.wasm for rendering · no database.

---

## 1. Architecture Overview

```
┌──────────────────────────── Browser (does the heavy lifting) ────────────────────────────┐
│                                                                                          │
│  Upload & project state (Zustand, in-memory + IndexedDB draft persistence)               │
│        │                                                                                 │
│        ├── Thumbnails / frame extraction (canvas, <video> seek)                          │
│        ├── TTS: Kokoro-82M via kokoro-js (WASM/WebGPU, ~80 MB model, cached)             │
│        └── Render: ffmpeg.wasm (zoompan/Ken Burns, scale/crop, concat, audio mux)        │
│                                                                                          │
└───────────────┬──────────────────────────────────────────────────────────────────────────┘
                │ only small JSON + downscaled images cross the network
┌───────────────▼──────────────── Vercel (thin) ───────────────────────────────────────────┐
│  Next.js pages + two API routes:                                                         │
│   POST /api/analyze  → proxies image (downscaled ≤768px, base64) to OpenRouter vision    │
│   POST /api/script   → proxies scene captions + user context to OpenRouter LLM          │
│  OPENROUTER_API_KEY lives server-side only (env var). No DB. No storage.                 │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

**Design rule:** Vercel Hobby functions cannot run ffmpeg or long jobs, so the server is a dumb key-holding proxy. Everything expensive (TTS, rendering) runs in the user's browser at zero infra cost. Original media never leaves the device — only downscaled analysis frames go to OpenRouter.

## 2. Tech Stack

| Layer | Choice | Why / License |
|---|---|---|
| Framework | Next.js 15, App Router, TypeScript | Vercel-native; client requirement |
| UI | Tailwind CSS + shadcn/ui | Fast, themeable via CSS variables → branding = config |
| State | Zustand + IndexedDB (idb-keyval) for draft recovery | No backend needed |
| Vision analysis | OpenRouter free-tier vision model (configurable, e.g. a free Llama/Gemini-class vision model; model ID in `config/models.ts`) | $0 target; swappable in one line |
| Script LLM | OpenRouter free-tier text model (configurable) | Same |
| TTS | **Kokoro-82M** via `kokoro-js` in-browser (WASM, WebGPU where available) | Apache-2.0, $0, no server. Fallback path (config flag): Groq free-tier TTS via API route using client's Groq key |
| Rendering | **ffmpeg.wasm** (`@ffmpeg/ffmpeg` multithreaded core) | LGPL (used unmodified via WASM — acceptable); runs everywhere; no Remotion licensing questions |
| Muxing/output | H.264 (libx264, `-preset ultrafast`, CRF 23) + AAC in MP4 | Max compatibility (WhatsApp/YouTube/iOS) |
| Hosting | Vercel Hobby | Client requirement |
| Auth (optional) | Single shared password via middleware + env var | Only if client insists; no NextAuth in v1 |

**Explicitly rejected:** Remotion server rendering (needs Lambda + licensing consideration), server-side ffmpeg (impossible on Hobby), ElevenLabs/OpenAI TTS (paid), WebCodecs-only pipeline (Safari inconsistency; ffmpeg.wasm is the single robust path for v1).

## 3. Key Technical Decisions & Constraints

### 3.1 Cross-origin isolation (hard requirement)
Multithreaded ffmpeg.wasm and fast WASM TTS require `SharedArrayBuffer`, which requires COOP/COEP headers. Set in `next.config.js`:

```js
headers: async () => [{
  source: '/(.*)',
  headers: [
    { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
    { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
  ],
}]
```

Consequence: all third-party resources must be same-origin or CORP-enabled. ffmpeg core and Kokoro model files are self-hosted in `/public` (or fetched from CORS-friendly CDN with `crossorigin` attributes). This is the #1 "why doesn't it work in prod" trap — locked down at M1.

### 3.2 Render pipeline (per project)
1. **Normalize assets**: images decoded to canvas, EXIF-rotated, letterboxed/cropped to target frame (1920×1080 / 1080×1920 / 1080×1080). Video clips passed to ffmpeg for scale+pad.
2. **Scene timing**: `sceneDuration = ttsAudioDuration + 0.4s` padding (min 2.5 s for images without narration).
3. **Image scenes**: ffmpeg `zoompan` for Ken Burns (style-template-defined direction), `fps=30`.
4. **Video scenes**: trimmed to narration length (or natural length if shorter), original audio ducked to 20% under voiceover (style-configurable) or muted.
5. **Concat** all scene segments (`concat` demuxer, same codec settings — no re-encode at join).
6. **Audio**: per-scene WAVs from Kokoro concatenated with correct offsets → single AAC track muxed in.
7. Output Blob → object URL → download.

Memory management: process **one scene at a time**, write intermediates to ffmpeg's MEMFS, release input buffers immediately. This is what makes 20 assets / 90 s feasible in a browser tab (~1.5–2 GB peak). Caps from the PRD (1080p/90 s/20 assets) are enforced in the UI, not just documented.

### 3.3 AI pipeline
```
per asset:  downscale to ≤768px JPEG (quality 0.7)
            → POST /api/analyze → OpenRouter vision → 1–2 sentence caption
project:    captions[] + userContext + template tone
            → POST /api/script → LLM → JSON: [{sceneId, line}]
            (strict JSON prompt + zod parse + one retry on parse failure)
user edits lines → per-line Kokoro TTS in browser → per-scene WAV + duration
```
- Video clips: extract 2 frames (25%/75% seek) client-side, caption both, merge.
- Rate limiting: analysis requests serialized with 1 req/1.5 s spacing to stay under free-tier limits; exponential backoff on 429.
- Failure isolation: any caption failure → placeholder line `"(describe this scene)"`, flow continues.

### 3.4 API routes (the only server code)
- `POST /api/analyze` — body `{ imageBase64 }` (≤1 MB enforced), returns `{ caption }`. Validates size, strips data-URL prefix, calls OpenRouter with server-side key, 25 s timeout (within Hobby limits since payloads are small).
- `POST /api/script` — body `{ scenes: [{id, caption}], context, tone }`, returns `{ lines: [{id, text}] }`.
- Both: basic in-memory IP throttle (best-effort on serverless), no logging of image data.

### 3.5 Branding & templates as config
`config/brand.ts` (logo path, hex palette, font) + `config/templates.ts` (per-style: Ken Burns params, watermark position, intro/outro card, text overlay style). Client changes branding without touching components. Client's brand assets are a **blocking input** for M1.

### 3.6 Handoff
- Repo: GitHub, MIT-licensed project code; third-party licenses listed in `LICENSES.md` (ffmpeg LGPL notice, Kokoro Apache-2.0).
- `README.md`: Vercel import steps, env vars (`OPENROUTER_API_KEY`, optional `APP_PASSWORD`, optional `GROQ_API_KEY`), model-swap instructions, template config guide.
- `env.example` included. Vendor's trial OpenRouter key is never committed; client sets his own in Vercel dashboard.

## 4. Browser Support Matrix

| Browser | Analyze/Script | TTS (Kokoro) | Render |
|---|---|---|---|
| Chrome/Edge desktop | ✅ | ✅ (WebGPU fast path) | ✅ 1080p |
| Safari 17+ desktop | ✅ | ✅ (WASM, slower) | ✅ 1080p |
| Chrome Android | ✅ | ✅ slow | ⚠️ 720p cap |
| iOS Safari | ✅ | ⚠️ slow, memory-tight | ⚠️ 720p cap, ≤60 s, best-effort |

Primary supported target for v1 acceptance: **desktop Chrome**. Everything else is progressive.

## 5. Performance Targets

- First TTS use: model download ~80–90 MB (cached via Cache Storage; subsequent loads instant).
- TTS generation: ≤ 2× real-time on desktop.
- Render: ≤ 4× real-time on a mid-range laptop (90 s video ≤ ~6 min render) with visible per-scene progress.

## 6. Security & Privacy

- API key server-side only; never shipped to browser.
- User media never uploaded anywhere except downscaled analysis frames to OpenRouter (disclosed in UI footer text).
- No persistence server-side; drafts live in the user's IndexedDB only.

## 7. Testing / Definition of Done

- E2E happy path (Playwright, desktop Chrome): 10 images → 9:16 → script → voiceover → render → downloaded MP4 probed with mp4box for valid H.264/AAC.
- Output manually verified to upload/play on YouTube and WhatsApp.
- Fresh Vercel import from README on a clean account by a non-author (client) — the real handoff test.

## 8. Known v1 Limitations (accepted trade-offs)

1. Render speed and caps are bound by the user's device — that is the price of $0 hosting on Vercel Hobby.
2. Kokoro voices are good open-source quality, English-focused; other languages are v2.
3. Free OpenRouter models can change/vanish; model IDs are config, not code.
4. No resumable renders — closing the tab mid-render loses progress (draft project state survives).
