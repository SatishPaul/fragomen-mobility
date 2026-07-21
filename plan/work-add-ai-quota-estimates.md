---
title: Add AI Quota Estimates Before Generation
description: Show estimated narration, voiceover, and video-generation quota usage before each action
status: completed
last_updated: 2026-07-21
---

## Goal

Show users how much monthly AI quota each generation step is expected to require before they run it, including their current remaining quota.

## Plan

* [x] Add an authenticated monthly quota summary API
* [x] Add shared, tested narration and voiceover estimators
* [x] Show estimates before narration, voiceover, and video rendering
* [x] Run focused tests, the full suite, and the production build
* [x] Update and regenerate the production walkthrough
* [x] Deploy and validate production

## Decisions

* Present narration as a conservative estimate because provider tokenization and returned captions vary.
* Show voiceover as zero monthly AI tokens under current accounting, while estimating characters and spoken duration.
* Show video rendering as zero monthly AI tokens because FFmpeg rendering runs locally in the browser.
* Keep zero-token estimates visible and explain that local processing can still take time.
* Warn when narration's estimate exceeds remaining quota without silently changing the administrator-set limit.

## Progress

The quota screenshot confirms the account has insufficient remaining quota for another narration request. Current server reservations use 750 tokens per image-analysis frame and approximately 3,500 output tokens plus prompt input for script generation. Videos use two analysis frames. Voiceover records characters and audio duration but reserves zero monthly tokens; browser rendering also uses zero.

Added visible estimates before narration, voiceover, and rendering. Zero-token estimates remain visible; the rendering estimate explains that zero means no quota charge, not instant processing, and tells the user to keep the tab open.

Added `/api/usage/summary` to return only the signed-in user's monthly used, reserved, limit, and remaining totals. Narration displays a conservative visual-analysis and script-writing breakdown against that remaining quota. Voiceover displays zero monthly tokens plus character and approximate speech-length estimates. Browser rendering displays zero monthly tokens plus an explicit wait-time explanation.

Updated the walkthrough to version 1.4 and regenerated the PDF.

## Validation

* Source inspection confirms current accounting behavior for analysis, scripts, voiceover, and rendering.
* Focused generation estimate tests: 3 passed.
* Full Vitest suite: 9 files and 48 tests passed.
* Production Next.js build completed successfully with only the pre-existing workspace-root and Hugging Face warnings.
* VS Code reports no errors in the changed TypeScript, TSX, Markdown, or walkthrough HTML files.
* PyMuPDF confirms the version 1.4 walkthrough has exactly 7 pages and contains all required quota-estimate and zero-token guidance.
* Raster inspection of pages 1, 4, and 7 confirms the changed content is legible and unclipped.
* Commit `0c3d224` was pushed to `main`.
* Vercel deployment `dpl_3rd7bk7KFY5BVHgYi2wi3jNYrTiF` is Ready and aliased to `https://fragomen-mobility.vercel.app`.
* The production login route returns `200`, and the signed-out `/api/usage/summary` request is protected with `401`.

## Resume Context

Current checkpoint: Quota estimates and the synchronized version 1.4 walkthrough are deployed and validated in production.

Next action: Sign in and open Create to confirm the narration estimate reflects the uploaded assets and current account quota.
