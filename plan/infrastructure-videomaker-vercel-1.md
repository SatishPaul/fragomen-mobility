---
goal: Implement and deploy the VideoMaker Next.js application to Vercel
version: 1.0
date_created: 2026-07-17
last_updated: 2026-07-20
owner: fragomen-mobility-pilot
status: 'In progress'
tags:
  - infrastructure
  - nextjs
  - vercel
  - deployment
  - video
---

# Introduction

![Status: In progress](https://img.shields.io/badge/status-In%20progress-yellow)

Implement the VideoMaker application described in the supplied deployment guide,
deploy it to Vercel project `fragomen-mobility` in team
`forweekend-4163s-projects`, and verify the complete workflow from media upload
through local MP4 download. The current workspace contains only
`fragomen-mobility-pilot.code-workspace`; the application source must be added or
located before application implementation begins.

## 1. Requirements & Constraints

* REQ-001: Build or import a Next.js 15 application that converts uploaded photos
  and short video clips into a narrated MP4.
* REQ-002: Run media analysis, script generation, and optional server voice
  generation through Next.js server-side API routes.
* REQ-003: Run voiceover playback, music composition, and final MP4 rendering in
  the visitor's browser.
* REQ-004: Support OpenRouter for primary vision analysis and fallback script
  generation when `OPENROUTER_API_KEY` is configured.
* REQ-005: Support Groq for primary script generation, fallback vision analysis,
  and Orpheus text-to-speech when `GROQ_API_KEY` is configured.
* REQ-006: Support browser-based voice generation when server text-to-speech is
  disabled or unavailable.
* REQ-007: Support optional shared-password access through `/gate` when
  `APP_PASSWORD` is configured.
* REQ-008: Deploy production builds from the `main` branch and create preview
  deployments for pull requests.
* REQ-009: Keep model identifiers configurable through environment variables,
  with defaults defined in `config/models.ts`.
* REQ-010: Use Google sign-in with `forweekend@gmail.com` to access the Groq
  account and create or manage the `GROQ_API_KEY` used by this deployment.
* REQ-011: Create the Groq API key within organization
  `org_01kxrgqd29eqma0857yd7kysng` after confirming that the signed-in account has
  access to that organization.
* REQ-012: Use the OpenRouter account with login email `forweekend@gmail.com` to
  create and manage the `OPENROUTER_API_KEY` used by this deployment.
* REQ-013: Deploy the application to Vercel project `fragomen-mobility` in team
  `forweekend-4163s-projects`. Use the lowercase slug because Vercel project names
  do not permit uppercase letters.
* SEC-001: Store all provider keys and the optional application password only in
  local environment files and Vercel environment variables.
* SEC-002: Ensure `.env*`, except an intentionally sanitized example file, is
  excluded from Git.
* SEC-003: Never expose provider keys through `NEXT_PUBLIC_*` variables, browser
  bundles, client logs, API responses, or committed files.
* SEC-004: Validate uploaded media type, size, count, and request body size before
  forwarding content to an AI provider.
* SEC-005: Add authentication cookies with `HttpOnly`, `Secure`, and `SameSite`
  attributes when shared-password access is enabled.
* SEC-006: Compare passwords using a timing-safe operation and rate-limit failed
  access attempts where the deployment platform permits it.
* SEC-007: Treat provider usernames and email addresses as account identifiers,
  not authentication secrets. Never store provider passwords, recovery codes,
  multifactor authentication codes, session cookies, or API key values in source
  files, this plan, terminal history, or chat.
* SEC-008: Revoke and replace any provider key disclosed through chat or another
  non-secret channel before adding credentials to Vercel. Configure the replacement
  values only under the exact names `GROQ_API_KEY` and `OPENROUTER_API_KEY`.
* CON-001: Do not add a database, persistent file storage, or background jobs.
* CON-002: Keep user media and rendered output on the user's device except for the
  minimum media payload sent to the configured vision provider.
* CON-003: Preserve cross-origin isolation headers required by
  `SharedArrayBuffer` and multithreaded `ffmpeg.wasm`.
* CON-004: Configure Vercel function duration through route-level `maxDuration`
  exports after validating the current account plan and Vercel limits.
* CON-005: Use the Vercel account already authenticated in the execution
  environment; do not create a second Vercel account or project unless no matching
  project exists.
* CON-006: The workspace does not currently contain the application source, so no
  source-level task may be marked complete until `package.json`, `app/`, and the
  relevant configuration files are present.
* CON-007: Disable server-side Kokoro on Vercel because `onnxruntime-node` exceeds
  the 250 MB uncompressed function limit. Preserve browser Kokoro as the fallback
  and retain server-side Kokoro for compatible non-Vercel Node deployments.
* GUD-001: Use structured JSON schemas for AI responses and validate provider
  output before presenting scripts or starting a render.
* GUD-002: Apply a 25-second timeout per model attempt and return actionable,
  provider-neutral error messages to the client.
* PAT-001: Implement provider fallback behind server-only adapters so API routes
  do not duplicate timeout, retry, parsing, and error-handling logic.

## 2. Implementation Steps

### Implementation Phase 1

* GOAL-001: Establish the source baseline and confirm the deployment target.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | Add the existing VideoMaker source repository to this workspace, or scaffold the application at the workspace root when no source exists. Confirm that `package.json`, `app/`, `next.config.ts`, and `config/` are present. | ✅ | 2026-07-17 |
| TASK-002 | Inspect `package.json` and lock files to confirm Next.js 15, React compatibility, Node.js requirements, package manager, ffmpeg implementation, and browser voice implementation. Record any differences from the supplied guide in this plan before changing code. | ✅ | 2026-07-17 |
| TASK-003 | Run the repository's clean install, lint, type-check, test, and production build commands to establish a baseline. Record pre-existing failures without modifying unrelated code. | | |
| TASK-004 | Run `vercel whoami` or inspect the authenticated Vercel session. Confirm account `forweekend-4163` and active team `forweekend-4163s-projects`. | ✅ | 2026-07-17 |
| TASK-005 | Inspect Git remotes and the current branch. Confirm that `main` is the production branch and that the remote repository belongs to the intended Git provider account. | | |

### Implementation Phase 2

* GOAL-002: Implement and validate server-side AI provider integrations.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-006 | Create or update `config/models.ts` with typed defaults for OpenRouter vision, OpenRouter script, Groq vision, Groq script, and Groq TTS models. Read optional overrides from server-only environment variables. | | |
| TASK-007 | Create server-only provider adapters under `lib/server/ai/` for OpenRouter and Groq. Implement request timeouts, bounded retries for retryable status codes, normalized errors, and fallback selection. | | |
| TASK-008 | Implement `app/api/analyze/route.ts` to validate uploaded media, call OpenRouter vision first when configured, fall back to Groq vision, and return validated scene analysis JSON. | | |
| TASK-009 | Implement `app/api/script/route.ts` to accept validated scene analysis and selected format/style, call Groq script generation first when configured, fall back to OpenRouter, and return validated captions, narration, and title cards. | | |
| TASK-010 | Implement `app/api/tts/route.ts` to honor `TTS_PROVIDER` values `auto`, `groq`, `openrouter`, and `off`. Return audio only from configured server providers and preserve browser voice fallback. | | |
| TASK-011 | Add route tests that cover missing keys, malformed media, provider timeout, retryable errors, fallback success, malformed provider output, TTS disabled, and sanitized client-facing errors. | | |

### Implementation Phase 3

* GOAL-003: Implement the browser editing, narration, and rendering workflow.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-012 | Implement the media intake UI to accept two or more supported photos or short clips, show previews, allow removal and reordering, and reject unsupported or oversized files before analysis. | | |
| TASK-013 | Implement format and style controls, then connect the analyze-and-draft action to `/api/analyze` and `/api/script`. Display editable captions, narration, and title cards. | | |
| TASK-014 | Implement voice selection and generation. Use the configured server provider when selected, otherwise initialize the existing browser voice model and communicate its first-use download progress. | | |
| TASK-015 | Implement optional music selection and mix controls without uploading audio assets to server storage. | | |
| TASK-016 | Implement the browser render pipeline with the repository's ffmpeg library. Compose ordered media, title cards, captions, narration, and music into an MP4 and trigger a local download. | | |
| TASK-017 | Add cancellation, progress, recoverable error, memory cleanup, and repeat-render behavior so failed or cancelled renders do not require a page reload. | | |
| TASK-018 | Add browser tests for upload validation, provider errors, script editing, voice fallback, render progress, MP4 download, and repeated rendering. | | |

### Implementation Phase 4

* GOAL-004: Add optional access control and deployment-safe configuration.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-019 | Implement `/gate`, its server-side password verification endpoint or action, and request middleware. Bypass the gate when `APP_PASSWORD` is absent and protect application and API routes when it is present. | | |
| TASK-020 | Configure `next.config.ts` to return `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` for application routes. Verify every third-party browser asset is compatible with cross-origin isolation. | | |
| TASK-021 | Configure `maxDuration = 60` directly in `app/api/analyze/route.ts`, `app/api/script/route.ts`, and `app/api/tts/route.ts`. Do not use the unsupported `app/api/**/route.ts` function glob in `vercel.json`. | ✅ | 2026-07-17 |
| TASK-022 | Add `.env.example` containing variable names and safe descriptions only. Update `.gitignore` to exclude local environment files, build output, provider payload captures, and rendered media. | | |
| TASK-023 | Add runtime environment validation that reports missing provider configuration without revealing secret values. Permit startup with browser-only TTS, but require at least one AI provider for analysis and script generation. | | |

### Implementation Phase 5

* GOAL-005: Link the repository to Vercel, configure secrets, and deploy.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-024 | Run the complete local quality gate: clean install, lint, type-check, unit tests, browser tests, and `next build`. Resolve only failures caused by this implementation. | | |
| TASK-025 | Scan tracked files and Git history for provider keys, passwords, generated media, and environment files. Remove exposed secrets from the deployment path and rotate any credential found in tracked content. | | |
| TASK-026 | Create Vercel project `fragomen-mobility` in team `forweekend-4163s-projects` and link the local workspace to it. Preserve the detected Next.js framework settings and repository package manager unless the production build proves they are incorrect. | ✅ | 2026-07-17 |
| TASK-027 | Select **Continue with Google** on the Groq sign-in page, authenticate as `forweekend@gmail.com`, select organization `org_01kxrgqd29eqma0857yd7kysng`, and confirm the account can manage API keys in that organization. Revoke the Groq key disclosed in chat. Stop before replacement key creation if the email or organization differs. | | |
| TASK-028 | Within Groq organization `org_01kxrgqd29eqma0857yd7kysng`, create a project-scoped API key and add it to linked Vercel project `forweekend-4163s-projects/fragomen-mobility` under the exact name `GROQ_API_KEY`. The sensitive variable is verified for Production and Preview; add Development only if local `vercel dev` needs Vercel-managed secrets. | ✅ | 2026-07-17 |
| TASK-029 | Add optional `APP_PASSWORD`, `TTS_PROVIDER`, and model override variables only when their non-default behavior is required. Apply each variable to the intended Vercel environments. | | |
| TASK-030 | Sign in to OpenRouter with `forweekend@gmail.com`, verify the displayed account email, create a project-scoped API key, and add it to linked Vercel project `forweekend-4163s-projects/fragomen-mobility` under the exact name `OPENROUTER_API_KEY`. The sensitive variable is verified for Production and Preview; add Development only if local `vercel dev` needs Vercel-managed secrets. | ✅ | 2026-07-17 |
| TASK-031 | While signed in to Groq through Google as `forweekend@gmail.com` within organization `org_01kxrgqd29eqma0857yd7kysng`, confirm acceptance of the configured Orpheus TTS model terms before testing a Groq voice. | | |
| TASK-032 | Deploy to production, inspect the remote install and Next.js build, set the Vercel framework preset to Next.js, reset output handling to automatic, and disable Vercel SSO deployment protection for the public demo. | ✅ | 2026-07-17 |
| TASK-033 | Confirm Git integration deploys `main` to production and creates preview URLs for pull requests. Record the production URL in the repository documentation without recording credentials. | | |

### Implementation Phase 6

* GOAL-006: Validate the deployed application and establish operational checks.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-034 | Verify the production response includes the required COOP and COEP headers and that `crossOriginIsolated` is `true` in a supported desktop browser. Verified at `https://fragomen-mobility.vercel.app`. | ✅ | 2026-07-17 |
| TASK-035 | Run a production smoke test with two or three non-sensitive photos: select format/style, analyze media, generate the draft, create voiceover, render, and download an MP4. | | |
| TASK-036 | Inspect the downloaded MP4 for playable video, expected dimensions, ordered scenes, readable captions, audible narration, music balance, and correct duration. | | |
| TASK-037 | Test failure paths for missing provider configuration, exhausted OpenRouter free quota, Groq rate limiting, rejected TTS terms, provider timeout, and browser voice fallback. | | |
| TASK-038 | Test `/gate` in a preview deployment when `APP_PASSWORD` is enabled: reject an incorrect password, accept the configured password, protect API routes, and clear access on cookie expiration. | | |
| TASK-039 | Review Vercel logs after smoke testing and confirm that keys, passwords, full media payloads, and provider authorization headers are absent. | | |
| TASK-040 | Document deployment ownership, environment variable names, model override procedure, redeployment procedure, and rollback procedure in `README.md` after the implementation is verified. Identify `forweekend@gmail.com` as both the OpenRouter login and the Groq Google sign-in account, and identify `org_01kxrgqd29eqma0857yd7kysng` as the Groq organization, without documenting authentication secrets. | | |
| TASK-041 | Merge the v2 TTS delivery, including server Kokoro, browser q8/q4 selection, provider probing, voice labels, and startup instrumentation. Preserve the existing Vercel route-duration and public-demo adaptations. | ✅ | 2026-07-20 |
| TASK-042 | Deploy v2 to Vercel with native server Kokoro disabled for the serverless target. Verify `/`, `/create`, and `/api/tts`; required isolation headers; `SharedArrayBuffer`; a real Groq WAV response; all browser assets; and a clean browser console. | ✅ | 2026-07-20 |

## 3. Alternatives

* ALT-001: Render videos in a Vercel function. Rejected because video encoding can
  exceed serverless CPU, memory, request duration, and temporary storage limits.
* ALT-002: Store uploads and renders in object storage. Rejected because the target
  design requires no persistent file storage and browser-local output.
* ALT-003: Add a database and background job queue. Rejected because the described
  workflow is synchronous, ephemeral, and designed for Vercel's lightweight tier.
* ALT-004: Call AI providers directly from the browser. Rejected because browser
  requests would expose provider credentials to visitors.
* ALT-005: Depend on one AI provider. Rejected because free model availability and
  rate limits require a configurable fallback path.

## 4. Dependencies

* DEP-001: Complete VideoMaker source code or approval to scaffold it from the
  behavior specified in this plan
* DEP-002: Node.js version supported by Next.js 15 and the selected package manager
* DEP-003: Browser-compatible ffmpeg package with multithreaded rendering support
* DEP-004: Browser voice package and downloadable voice model used by the source
  application
* DEP-005: Groq account accessed through Google sign-in as
  `forweekend@gmail.com`, organization `org_01kxrgqd29eqma0857yd7kysng`, its
  project-scoped API key, and accepted terms for the selected Orpheus model
* DEP-006: OpenRouter account with login email `forweekend@gmail.com` and its
  project-scoped API key
* DEP-007: Authenticated Vercel account with permission to create or update the
  linked `forweekend-4163s-projects/fragomen-mobility` project and its environment
  variables
* DEP-008: Git repository with `main` as the intended production branch
* DEP-009: Supported Chromium-based browser for cross-origin isolation and render
  smoke tests

## 5. Files

* FILE-001: `package.json` for scripts, runtime dependencies, and engine metadata
* FILE-002: lock file selected by the existing repository package manager
* FILE-003: `config/models.ts` for model defaults and environment overrides
* FILE-004: `lib/server/ai/` for server-only provider adapters and fallback logic
* FILE-005: `app/api/analyze/route.ts` for media analysis
* FILE-006: `app/api/script/route.ts` for script generation
* FILE-007: `app/api/tts/route.ts` for optional server voice generation
* FILE-008: `app/gate/` for optional shared-password access
* FILE-009: Optional access middleware is omitted from the public demo because the
  Vercel Edge middleware failed at runtime and `APP_PASSWORD` is not configured
* FILE-010: application components and browser-rendering modules discovered after
  the source is added
* FILE-011: `next.config.ts` for cross-origin isolation headers
* FILE-012: Route-level `maxDuration` exports in the three AI API route modules
* FILE-013: `.env.example` for safe configuration documentation
* FILE-014: `.gitignore` for secrets, build output, and generated media exclusions
* FILE-015: route, component, and browser tests located according to the source
  repository's existing test conventions
* FILE-016: `README.md` for verified setup, deployment, troubleshooting, and
  rollback instructions

## 6. Testing

* TEST-001: Execute the repository's lint and type-check commands with zero new
  errors.
* TEST-002: Execute unit and route tests for validation, provider fallback,
  timeout, retry, response parsing, and secret-safe errors.
* TEST-003: Execute a clean Next.js production build using the same Node.js and
  package manager versions used by Vercel.
* TEST-004: Execute browser tests for upload, analysis, script editing, voice
  generation, render cancellation, successful render, and local download.
* TEST-005: Assert COOP and COEP response headers in preview and production.
* TEST-006: Assert that production runs with Groq only and with Groq plus
  OpenRouter, while TTS supports `auto`, `groq`, `openrouter`, and `off`.
* TEST-007: Assert that optional password protection cannot be bypassed through a
  direct API request.
* TEST-008: Inspect the production MP4 manually because playback quality, caption
  legibility, and audio balance are user-perceptual acceptance criteria.
* TEST-009: Scan tracked files, built client assets, and deployment logs for secret
  values before production sign-off.

## 7. Risks & Assumptions

* RISK-001: Local npm installation is blocked by the workstation package proxy and
  a TLS handshake failure to the public registry. Vercel's remote install,
  TypeScript check, static generation, and production build completed successfully.
* RISK-002: Free model identifiers and quotas can change; invalid defaults can
  break analysis, script generation, or TTS without a code defect.
* RISK-003: Large media files and long timelines can exhaust browser memory during
  ffmpeg rendering, especially on mobile devices.
* RISK-004: Cross-origin assets without compatible CORS or cross-origin resource
  policy headers can break cross-origin isolation.
* RISK-005: A full provider fallback chain can exceed the Vercel function duration
  supported by the authenticated plan.
* RISK-006: A shared password is limited access control, not user identity,
  authorization, auditing, or tenant isolation.
* RISK-007: Sending user media to an AI provider can create privacy and data
  residency obligations that require approval before production use.
* RISK-008: The original Groq and OpenRouter keys were disclosed in chat on
  2026-07-17. They must be revoked and must not be used for this deployment.
* RISK-009: `onnxruntime-node` 1.21.0 traces approximately 405 MB of native
  binaries into a Vercel function and exceeds the 250 MB limit. The Vercel build
  removes that package and uses keyed server TTS with browser Kokoro fallback.
* ASSUMPTION-001: The attached guide accurately describes the intended user
  experience, but implementation details will be reconciled against the source.
* ASSUMPTION-002: The authenticated Vercel account has permission to manage the
  intended project and its secrets.
* ASSUMPTION-003: API key values will be supplied through Vercel's protected secret
  entry flow and will not be transmitted through this plan.
* ASSUMPTION-004: Uploaded test media is approved for use with the configured AI
  providers.
* ASSUMPTION-005: Google account `forweekend@gmail.com` and organization
  `org_01kxrgqd29eqma0857yd7kysng` identify the Groq account context, not an xAI
  Grok account.
* ASSUMPTION-006: `forweekend@gmail.com` also identifies the intended OpenRouter
  account, but the Groq organization ID applies only to Groq.
* ASSUMPTION-007: The person executing deployment can complete the OpenRouter
  sign-in, Groq Google sign-in, and any multifactor authentication prompts
  directly in each provider's sign-in interface.

## 8. Related Specifications / Further Reading

* Supplied VideoMaker deployment guide, generated 2026-07-16
* [Vercel Next.js documentation](https://vercel.com/docs/frameworks/full-stack/nextjs)
* [Vercel environment variables](https://vercel.com/docs/environment-variables)
* [Vercel function configuration](https://vercel.com/docs/functions/configuring-functions/duration)
* [Next.js headers configuration](https://nextjs.org/docs/app/api-reference/config/next-config-js/headers)
* [MDN cross-origin isolation guide](https://developer.mozilla.org/en-US/docs/Web/API/Window/crossOriginIsolated)
* [Groq documentation](https://console.groq.com/docs/overview)
* [OpenRouter documentation](https://openrouter.ai/docs/quickstart)