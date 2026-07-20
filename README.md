---
title: AI Video Maker
description: Deploy and operate the browser-based narrated video maker
---

Turn photos and short clips into a finished, voiceover-narrated social video. Media editing, voice generation, and rendering run in the browser. You can download the MP4 or explicitly publish it through Outstand after reviewing the exact destination accounts.

- **Hosting:** Vercel Hobby (no persistent server storage; API routes keep provider keys private)
- **AI:** OpenRouter free-tier models (vision captions + script writing)
- **Voiceover:** Kokoro-82M running in the browser (open-source, $0)
- **Rendering:** ffmpeg.wasm in the browser (Ken Burns motion, watermark, outro card)
- **Publishing:** Optional direct browser upload to Outstand after confirmation

Primary supported target: **desktop Chrome**. Mobile browsers work best-effort with a 720p cap.

---

## 1. Deploy to Vercel (under 30 minutes)

1. **Get an OpenRouter API key** — sign up at [openrouter.ai](https://openrouter.ai), then create a key at *Keys → Create Key*. Free-tier models are used by default, so no credit is required (free models are rate-limited).
2. **Import this repo into Vercel** — push the repo to your GitHub account, then in [vercel.com/new](https://vercel.com/new) select it. Framework preset: **Next.js** (auto-detected). No build settings need changing.
3. **Set environment variables** — in the Vercel project: *Settings → Environment Variables*:

   | Name | Required | Value |
   |---|---|---|
   | `OPENROUTER_API_KEY` | ✅ | Your OpenRouter key |
   | `GROQ_API_KEY` | optional | Free key from [console.groq.com](https://console.groq.com) — enables higher-quality server TTS voices |
   | `TTS_PROVIDER` | optional | `auto` (default) / `local` / `groq` / `openrouter` / `off` — see §4 |
   | `APP_PASSWORD` | optional | Set to enable a simple shared-password gate |
  | `OUTSTAND_API_KEY` | optional | Replacement server-only Outstand key; requires `APP_PASSWORD` |
  | `SOCIAL_VIDEO_MAX_BYTES` | optional | Maximum publish upload size in bytes; defaults to 524288000 |
   | `OPENROUTER_VISION_MODEL` | optional | Override the vision model ID |
   | `OPENROUTER_SCRIPT_MODEL` | optional | Override the script model ID |

4. **Deploy.** That's it — there is no database and nothing else to configure.

> **Note:** the Vercel Hobby plan's fair-use policy prohibits commercial use. If you monetize your deployment, upgrade to Vercel Pro.

## 2. Run locally

```bash
npm install          # also copies the ffmpeg.wasm core into /public (postinstall)
cp env.example .env  # then paste your OpenRouter key into .env
npm run dev          # http://localhost:3000
```

Run the automated checks before deployment:

```bash
npm test
npm run build
```

## 3. Swap AI models (when a free model disappears)

Free OpenRouter models come and go. Model IDs live in **`config/models.ts`** — change one line (or just set the env var, no redeploy of code needed):

```ts
vision: process.env.OPENROUTER_VISION_MODEL ?? "qwen/qwen2.5-vl-32b-instruct:free",
script: process.env.OPENROUTER_SCRIPT_MODEL ?? "meta-llama/llama-3.3-70b-instruct:free",
```

Browse available free models at [openrouter.ai/models?q=free](https://openrouter.ai/models?q=free) (vision models need image input support).

## 4. Voiceover quality (TTS options)

Server TTS is preferred when a configured provider is available. Available backends:

1. **Groq (free, higher quality)**: Set `GROQ_API_KEY` for server-generated Orpheus voices. The Groq model requires one-time terms acceptance in the [Groq playground](https://console.groq.com/playground?model=canopylabs%2Forpheus-v1-english).
2. **OpenRouter gpt-audio (paid)**: Set `TTS_PROVIDER=openrouter` on an account with purchased credits. OpenRouter has no free TTS model.
3. **Local server voice on compatible Node hosts**: Kokoro-82M runs inside the API route and warms through `instrumentation.ts`. This mode is unavailable on Vercel because the native ONNX package exceeds Vercel's uncompressed function-size limit.
4. **In-browser Kokoro**: Vercel uses this fallback when keyed server TTS is disabled or unavailable. Desktop browsers download q8 weights; mobile browsers use the smaller q4 build. The model is cached after its first download.

Voice lists per provider are editable in `config/models.ts`.

## 5. Branding & style templates

- **`config/brand.ts`** — product name, tagline, logo path, watermark, contact line for the outro card, and every UI color. Colors cascade through CSS variables; no component changes needed.
  - Replace `public/brand/logo.svg` with your logo (SVG or PNG; update the path in `brand.ts` if you rename it).
- **`config/templates.ts`** — output formats and the three style templates (Clean, Real Estate, Bold). Each style is pure config: script tone, Ken Burns moves and zoom amount, watermark corner/size, outro card on/off, and how loud original clip audio sits under the voiceover. Add a fourth style by adding an object to the array.
- The same file holds the **v1 limits** (20 assets, 90 s output, 15 MB images, 60 s / 200 MB clips) — enforced in the UI.

## 6. Social publishing

Publishing is optional and disabled unless both `APP_PASSWORD` and
`OUTSTAND_API_KEY` are configured. Use a newly generated Outstand key. Never
reuse a key that has appeared in source code, chat, logs, or screenshots.

1. Connect social accounts in the Publish step. OAuth opens in a popup so the
  in-memory render remains available.
2. Review account identity and health, then select the exact destinations.
3. Add a caption and any required title. YouTube and Vimeo require a title.
4. Select **Review and publish**, verify every named account, and confirm.
5. The browser uploads the MP4 directly to an Outstand signed URL. Next.js API
  routes authorize and confirm the media but never proxy video bytes.
6. Review per-account outcomes. A retry targets failed accounts only and reuses
  the confirmed media ID. Status monitoring can resume without creating a new
  post.

Supported connected accounts include X, LinkedIn, Instagram, TikTok, Facebook,
Threads, Bluesky, YouTube, Google Business Profile, and Vimeo. Pinterest is
disabled until board selection is implemented. Bluesky accounts can publish
when already connected, but the app does not collect Bluesky app passwords.

The application allows finished videos up to 500 MB by default. A signed upload
URL is short-lived and must be treated as a credential. It is kept in browser
memory only. Rendered files and confirmed media IDs are also memory-only, so a
page refresh requires rendering again. Outstand controls provider-side media
retention; verify its current retention policy before expanding beyond a small
trusted pilot.

To rotate publishing access:

1. Revoke the old key in Outstand.
2. Generate a replacement with only the access required by this application.
3. Replace `OUTSTAND_API_KEY` in every enabled Vercel environment.
4. Redeploy and verify account listing before attempting a post.

## 7. How it works (architecture)

```
Browser: upload → thumbnails → AI captions (downscaled frames only) → editable script
       → Kokoro TTS per scene (WASM/WebGPU, ~80 MB model cached after first use)
       → ffmpeg.wasm: Ken Burns per image, scale/crop per clip, concat, AAC mux → MP4
  → optional direct PUT to an Outstand signed media URL after confirmation
Vercel:  POST /api/analyze + POST /api/script + POST /api/tts for keyed providers
  + small authenticated JSON requests for accounts, OAuth, media, and posts
```

- **COOP/COEP headers** are set in `next.config.ts` — required for multithreaded ffmpeg.wasm (`SharedArrayBuffer`). If you add third-party scripts/embeds, they must be CORS/CORP-compatible or rendering will break.
- The ffmpeg core in `public/ffmpeg/` is copied from `node_modules` on install (`scripts/copy-ffmpeg.mjs`) so it is served same-origin.
- Original media never leaves the device; only ≤768px JPEG frames are sent for analysis. Drafts persist in the browser's IndexedDB only. When publishing is confirmed, the finished MP4 is uploaded directly to Outstand.

## 8. Limits & known trade-offs (v1)

- Render speed depends on the user's device (that's the price of $0 hosting). A 90 s video takes a few minutes on a mid-range laptop.
- Kokoro voices are good open-source quality, English-focused.
- Closing the tab mid-render loses the render (the draft project survives).
- Refreshing or closing the page after rendering loses the in-memory publishing
  file and confirmed media ID. Download the MP4 before leaving the page.
- Publishing is immediate only. Scheduled posts are not implemented.
- iPhone HEVC `.mov` clips may fail to decode in ffmpeg.wasm on some devices — if a clip errors, export/convert it to MP4 (H.264) first.

## 9. Troubleshooting

| Symptom | Fix |
|---|---|
| "OPENROUTER_API_KEY is not configured" | Set the env var in Vercel and redeploy |
| Script/captions fail with rate-limit messages | Free models throttle — wait a minute, or switch model IDs (see §3) |
| Render never starts / SharedArrayBuffer error | Check the COOP/COEP headers exist (don't remove them from `next.config.ts`) |
| Voice model download is slow | ~80 MB one-time download; cached afterwards |
| Publishing says it is not configured | Set both `APP_PASSWORD` and a replacement `OUTSTAND_API_KEY`, then redeploy |
| Connected account is unhealthy | Use **Connect account** to complete OAuth again, then select **Refresh** |
| Browser blocks account connection | Allow the Outstand OAuth popup for this site |
| Upload fails before posting | Keep the local download, verify the 500 MB limit and network connection, then retry |
| Publishing remains pending | Select **Resume status**; this checks the existing post and does not create a duplicate |
| One destination fails | Select **Retry failed accounts**; successful destinations are excluded |

## License

Project code: MIT. Bundled third-party components have their own licenses — see [LICENSES.md](LICENSES.md).
