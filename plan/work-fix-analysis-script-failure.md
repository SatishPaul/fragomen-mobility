---
title: Fix Media Analysis and Script Generation Failure
description: Diagnose and repair the two-image analysis and narration failure shown in production
status: in-progress
last_updated: 2026-07-21
---

## Goal

Make two-image analysis and script generation reliable, and show an actionable error when an AI provider or account limit prevents completion.

## Plan

* [x] Trace the client analysis and script fallback paths
* [x] Identify the production failure from endpoint telemetry
* [x] Implement the smallest reliable fix with focused tests
* [x] Run focused tests and the production build
* [x] Update and regenerate the production walkthrough
* [ ] Deploy and validate the production workflow

## Decisions

* Preserve editable per-scene fallback text when remote AI is unavailable.
* Do not send image data, credentials, tokens, or signed URLs to logs or planning files.
* Distinguish account quota failures from transient provider rate limits in user-facing guidance.
* Retry transient `429`, `500`, `502`, `503`, and `504` responses, but stop immediately for authentication and monthly quota failures.
* Give each provider retry a unique usage reservation ID so the database does not reject a repeated model attempt.

## Progress

The screenshot shows that scene 2 image captioning failed and the script endpoint also failed. The script API already accepts an empty scene caption and prompts the model to write a bridging line, so the missing caption alone should not invalidate the request.

Vercel had no retained logs for the reported event. Source inspection identified two concrete reliability defects: image analysis retried only `429` responses, not transient provider `5xx` failures; and duplicate OpenRouter script attempts reused a reservation key that the usage-event unique index rejects.

Implemented transient retries with backoff, structured safe API error codes, unique script-attempt reservation IDs, and actionable UI guidance for authentication, quota, rate-limit, and provider failures. Scenes without visual analysis now ask the user to review the generated bridging line instead of incorrectly requiring a manual rewrite.

Updated the production walkthrough to version 1.3 and regenerated its PDF.

## Validation

* Source inspection confirms `/api/script` accepts empty captions and maps missing scene text back to per-scene fallbacks.
* Focused AI failure handling: 3 tests passed.
* Full Vitest suite: 8 files and 45 tests passed.
* Production Next.js build completed successfully with only the pre-existing workspace-root and Hugging Face warnings.
* VS Code reports no errors in the changed TypeScript, TSX, test, or walkthrough HTML files.
* PyMuPDF confirms the version 1.3 walkthrough has exactly 7 pages and contains the required retry, visual-analysis, and quota guidance.
* Raster inspection of pages 1, 4, and 7 confirms the changed content is legible and unclipped.

## Resume Context

Current checkpoint: The reliability fix, tests, build, and synchronized walkthrough are complete; production deployment remains.

Next action: Review the final diff, commit and push it, deploy to Vercel production, and confirm the deployment is ready.
