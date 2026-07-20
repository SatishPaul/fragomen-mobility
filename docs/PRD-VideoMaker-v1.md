# PRD — AI Video Maker Web App (v1)

**Client:** Satish Paul
**Vendor:** Sourav De
**Version:** 1.0 (Draft for sign-off)
**Date:** 15 July 2026
**Engagement value:** $200 fixed price (v1 only)
**Delivery:** GitHub repo handed to client; client imports into own Vercel account and swaps in own OpenRouter API key via environment variables.

---

## 1. Problem Statement

The client needs a simple web tool that turns a set of photos and short video clips into a finished, voiceover-narrated social-media video (e.g., real-estate listing videos, YouTube Shorts, Reels) without using a desktop editor. v1 produces a downloadable MP4; direct publishing to platforms is deferred to v2.

## 2. Goals (v1)

1. User uploads photos/videos from their device (desktop or phone) in the browser.
2. User picks an output format template (16:9 YouTube, 9:16 Shorts/Reels/TikTok, 1:1 square) and a visual style template (including the client's real-estate style — assets to be supplied by client).
3. AI looks at each image/clip, writes a narration script scene-by-scene, and generates a voiceover that is timed to each scene.
4. App renders a single MP4 the user downloads.
5. App carries the client's branding (logo, colors — assets to be supplied by client).
6. Zero recurring infrastructure cost to the client beyond his own OpenRouter usage (free-tier models targeted).

## 3. Non-Goals / Explicitly Out of Scope for v1

Anything on this list is a **separately quoted v2+ item**. No exceptions absorbed into the $200.

- Direct publishing to YouTube, Facebook, TikTok, Instagram, or any platform API.
- Google Photos import (requires Google OAuth verification review; when built in v2 it will use the Google Photos **Picker API**, since the legacy Library API third-party read scopes were retired in 2025).
- Apple Photos login/import (no third-party API exists; technically impossible — permanently out of scope; phone file upload covers iPhone users).
- User accounts, saved projects, project history, or any database.
- Team/multi-user features, payments, subscriptions.
- Background music library, subtitles/captions, transitions beyond the basic set, custom fonts per project.
- Videos longer than the v1 render limits (Section 6).
- Server-side rendering, render queues, or email-me-when-done flows.
- Mobile native apps.

## 4. Users

Single primary user (the client / his end customers via his Vercel deployment). No auth in v1; if the client requires a gate, a single shared-password gate is included, nothing more.

## 5. User Flow

1. **Landing / Create** — branded page with "Create Video" CTA.
2. **Upload** — drag-and-drop or file picker (works on iOS/Android browsers). Accepts JPG/PNG/HEIC-as-JPEG, MP4/MOV. Thumbnails shown; user can reorder and delete.
3. **Format** — choose 16:9 / 9:16 / 1:1. Choose style template (v1 ships with 3: Clean, Real Estate, Bold — final styles depend on client-supplied brand assets).
4. **Narration** — user optionally enters context (e.g., "3BHK apartment in Salt Lake, highlight the balcony"). AI analyzes each asset, drafts a per-scene script shown in an editable list. User can edit any line before generating audio.
5. **Voiceover** — user picks a voice (from the bundled open-source voice set) and generates audio. Each scene's on-screen duration auto-adjusts to its narration length so the voice matches what's on screen.
6. **Render** — in-browser render with progress bar. Output MP4 (H.264 + AAC).
7. **Download** — save file. Done screen suggests re-render in another aspect ratio.

## 6. Functional Requirements & Acceptance Criteria

| # | Requirement | Acceptance criteria |
|---|---|---|
| F1 | Media upload | Up to **20 assets** per project; images ≤ 15 MB each; video clips ≤ 60 s / 200 MB each; reorder + delete works on mobile Safari and Chrome. |
| F2 | Format templates | 16:9 (1920×1080), 9:16 (1080×1920), 1:1 (1080×1080) all produce correctly framed output with letterbox/crop handling. |
| F3 | Style templates | 3 styles incl. real-estate style with client logo watermark; branding driven by config file so client can tweak colors without code changes. |
| F4 | AI scene analysis | Each image/clip gets a caption via a vision model on OpenRouter (free-tier model); failure on one asset does not block the project (falls back to generic line the user can edit). |
| F5 | Script generation | Coherent narration script across scenes using optional user context; fully editable before audio generation. |
| F6 | Voiceover | TTS generated per scene; scene duration = narration duration + padding, so voice matches visuals. At least 2 voice options. |
| F7 | Render | In-browser render up to **1080p**, output length up to **90 seconds**; visible progress; completes on a mid-range laptop (Chrome) without crashing. Mobile rendering is best-effort, capped at 720p. |
| F8 | Download | MP4 (H.264/AAC) plays in WhatsApp, YouTube upload, and iOS Photos. |
| F9 | Handoff | Repo with README covering env vars (`OPENROUTER_API_KEY`), Vercel import steps, and template/branding config. Client swaps keys with zero code changes. |

## 7. Constraints (agreed and acknowledged by client)

- **Hosting:** Vercel **Hobby** plan. Therefore all rendering and TTS run **in the user's browser** — no server-side video processing is possible on this plan. This is what caps output at 1080p / 90 s / 20 assets.
- **Vercel Hobby fair-use policy prohibits commercial use.** If the client monetizes the deployment, upgrading to Vercel Pro is the client's responsibility and risk.
- **AI costs:** OpenRouter free-tier models are targeted; free tiers have rate limits and can be discontinued by providers at any time. If a free model disappears, swapping the model name is a config change; any paid usage is on the client's key.
- **TTS:** OpenRouter does **not** provide text-to-speech. v1 uses an open-source TTS model (Kokoro-82M, Apache-2.0) running in the browser at zero cost. Voice quality is "good open-source," not ElevenLabs.
- **Branding assets** (logo files, hex colors, fonts, real-estate template reference) must be supplied by the client before UI work starts. Delays in assets shift the timeline day-for-day.

## 8. Milestones & Payment

| Milestone | Contents | Payment |
|---|---|---|
| M1 | Upload + format/style templates + branded UI shell (deployed preview) | 40% ($80) |
| M2 | AI analysis + editable script + voiceover with timing | 30% ($60) |
| M3 | Render + download + repo handoff with README | 30% ($60) |

One round of revision per milestone within the stated scope. New features → change request, quoted separately.

## 9. Success Metrics (v1)

- Client can go from 10 photos to a downloadable 60-second 9:16 real-estate video in under 10 minutes, end to end, on his own laptop.
- Client can deploy the repo to his own Vercel account with his own OpenRouter key in under 30 minutes using only the README.

## 10. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Browser render fails on low-end phones | User frustration | Desktop-first messaging; 720p mobile cap; graceful error with "try on desktop" hint |
| Free OpenRouter vision model rate-limited or removed | Analysis step fails | Model name in config; fallback to user-typed captions |
| Client expects ElevenLabs-quality voice at $0 | Disappointment | Voice samples demoed and approved at M2 before M3 starts |
| Scope creep ("just add publishing") | Margin destroyed | Section 3 is contractual; anything listed there is quoted separately |
