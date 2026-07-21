---
goal: Deliver authenticated multi-user video creation, usage metering, history, publishing, and analytics
version: 1.0
date_created: 2026-07-20
last_updated: 2026-07-20
owner: VideoMaker
status: 'In progress'
tags:
  - feature
  - authentication
  - supabase
  - analytics
---

# Introduction

![Status: In progress](https://img.shields.io/badge/status-In_progress-yellow)

Convert VideoMaker from a shared-password application into an authenticated multi-user platform with one initial administrator, administrator-managed invitations, per-user quotas, durable private video history, publication tracking, and Outstand performance analytics.

## 1. Requirements & Constraints

* REQ-001: Supabase Auth must provide email and password login, invitation acceptance, password reset, session refresh, logout, and profile editing.
* REQ-002: The first configured administrator must invite users, disable access, set quotas, and assign Outstand social accounts.
* REQ-003: Every remote AI attempt must create a usage event, including failed fallback attempts; browser-local processing must record non-billable activity without inventing token counts.
* REQ-004: Quota checks and reservations must be atomic and must reject work that exceeds the user's monthly allowance.
* REQ-005: Completed MP4 files must use private object storage and user-scoped signed download URLs.
* REQ-006: Users must see their generated-video history, publication destinations, publication state, and social performance metrics.
* REQ-007: Publication creation must remain an explicit user action and must never run automatically.
* SEC-001: Row-level security must restrict user-owned data to the authenticated owner and administrative data to administrators.
* SEC-002: Service-role credentials and Outstand credentials must remain server-only.
* SEC-003: Social publishing must validate assigned account ownership on the server before creating a post.
* SEC-004: Webhooks must use HMAC verification, replay-resistant receipt storage, and idempotent updates.
* CON-001: Browser-local source media and draft recovery must remain in IndexedDB; only completed videos are uploaded.
* CON-002: Existing browser FFmpeg rendering and Outstand direct-upload behavior must remain functional.
* PAT-001: Server routes must derive the user from the Supabase session rather than accept a user identifier from request input.

## 2. Implementation Steps

### Implementation Phase 1

* GOAL-001: Establish Supabase configuration, identity clients, database ownership rules, and private storage.

| Task     | Description                                                                                                                   | Completed | Date       |
|----------|-------------------------------------------------------------------------------------------------------------------------------|-----------|------------|
| TASK-001 | Add `@supabase/supabase-js`, `@supabase/ssr`, shared configuration validation, browser/server/admin clients, and middleware. | ✅        | 2026-07-20 |
| TASK-002 | Add SQL schema, indexes, triggers, RLS policies, private video storage policies, and quota reservation functions.           | ✅        | 2026-07-20 |
| TASK-003 | Document required public URL, anonymous key, service-role key, administrator email, and webhook secret variables.           | ✅        | 2026-07-20 |

### Implementation Phase 2

* GOAL-002: Replace the shared gate with complete user authentication and administrator-managed access.

| Task     | Description                                                                                                       | Completed | Date |
|----------|-------------------------------------------------------------------------------------------------------------------|-----------|------|
| TASK-004 | Add login, invitation callback, forgot-password, reset-password, profile, logout, and disabled-user handling.     | ✅        | 2026-07-20 |
| TASK-005 | Protect application routes and API handlers with authenticated-user helpers; protect administrator routes by role. | ✅        | 2026-07-20 |
| TASK-006 | Add administrator user invitation, role, quota, active-state, and Outstand social-account assignment interfaces. | ✅        | 2026-07-20 |

### Implementation Phase 3

* GOAL-003: Enforce quotas and retain auditable provider usage.

| Task     | Description                                                                                                             | Completed | Date |
|----------|-------------------------------------------------------------------------------------------------------------------------|-----------|------|
| TASK-007 | Reserve quota before analysis, script, and remote TTS calls; finalize actual input/output usage after every attempt.   | ✅        | 2026-07-20 |
| TASK-008 | Record local TTS and rendering activity with provider-specific units and zero billable tokens.                         | Partial: TTS complete; render event pending | 2026-07-20 |
| TASK-009 | Display current-period token, character, request, reservation, and quota totals on user and administrator dashboards. | Partial: user token and quota totals complete | 2026-07-20 |

### Implementation Phase 4

* GOAL-004: Persist completed videos, publications, destinations, and Outstand analytics.

| Task     | Description                                                                                                                 | Completed | Date |
|----------|-----------------------------------------------------------------------------------------------------------------------------|-----------|------|
| TASK-010 | Upload completed MP4 files to user-owned private paths and add list, signed-download, metadata, and delete operations.      | Partial: upload, recent list, and signed download complete | 2026-07-20 |
| TASK-011 | Persist publication attempts and destinations, enforce assigned accounts, and make retries idempotent.                     | ✅        | 2026-07-20 |
| TASK-012 | Add verified webhook ingestion and scheduled/manual Outstand status and analytics synchronization.                         | Partial: webhook and manual sync complete | 2026-07-20 |
| TASK-013 | Build user dashboard views for videos, publication destinations, account health, and post performance.                     | Partial: history, destinations, links, and performance complete | 2026-07-20 |

### Implementation Phase 5

* GOAL-005: Validate, document, deploy, and retire the shared-password gate.

| Task     | Description                                                                                                      | Completed | Date |
|----------|------------------------------------------------------------------------------------------------------------------|-----------|------|
| TASK-014 | Add unit and route tests for auth, ownership, quotas, uploads, publication assignments, webhook replay, and RLS. | Partial: 15 tests include assignment and webhook HMAC coverage | 2026-07-20 |
| TASK-015 | Run tests, production build, dependency audit, and a Preview smoke test against a configured Supabase project.   | Partial: tests and production build pass | 2026-07-20 |
| TASK-016 | Seed the first administrator, deploy schema and environment values, then remove `APP_PASSWORD` and `/gate`.      |           |      |

## 3. Alternatives

* ALT-001: Auth.js plus a separate database adapter was rejected because Supabase combines identity, RLS, private storage, and transactional database functions.
* ALT-002: Client-only history was rejected because it cannot support cross-device history, administrator reporting, publication reconciliation, or durable analytics.
* ALT-003: A universal token counter was rejected because TTS providers may report characters or audio duration and local processing consumes no remote tokens.

## 4. Dependencies

* DEP-001: A Supabase project with Auth, Postgres, and Storage enabled
* DEP-002: `@supabase/supabase-js` for database, Auth, and Storage operations
* DEP-003: `@supabase/ssr` for cookie-backed Next.js server sessions
* DEP-004: Existing Outstand API credentials and connected social accounts
* DEP-005: Vercel environment configuration and scheduled-function support for analytics synchronization

## 5. Files

* FILE-001: `lib/supabase/*` contains configuration and Supabase clients.
* FILE-002: `supabase/migrations/*` defines the database, functions, RLS, and private bucket policies.
* FILE-003: `middleware.ts` refreshes sessions and applies route protection.
* FILE-004: `app/auth/*`, `app/profile/*`, and `app/admin/*` implement identity and administration.
* FILE-005: `app/dashboard/*` and dashboard components display usage, videos, publications, and analytics.
* FILE-006: `app/api/analyze/route.ts`, `app/api/script/route.ts`, and `app/api/tts/route.ts` enforce identity and metering.
* FILE-007: `components/RenderStep.tsx` and video API routes persist completed output.
* FILE-008: Publishing API routes and `lib/server/outstand.ts` persist publications and synchronize metrics.

## 6. Testing

* TEST-001: Anonymous requests cannot access protected pages, APIs, database rows, or private video objects.
* TEST-002: Users can read and mutate only their profile, usage, videos, publications, destinations, and analytics.
* TEST-003: Administrators can manage users and assignments without receiving access to user passwords.
* TEST-004: Concurrent quota reservations cannot exceed the configured monthly limit.
* TEST-005: Provider fallback attempts create separate usage records and unused reservations are released.
* TEST-006: Completed video upload, signed download, list, and delete flows preserve owner isolation.
* TEST-007: Publication creation rejects unassigned Outstand accounts and duplicate idempotency keys.
* TEST-008: Invalid or replayed webhook requests cannot change publication or analytics data.
* TEST-009: Existing publishing tests, production build, and dependency audit continue to pass.

## 7. Risks & Assumptions

* RISK-001: Supabase credentials and project creation are external prerequisites; local and production auth cannot complete until they are configured.
* RISK-002: Provider usage payloads vary, so metering adapters must preserve native units and nullable token fields.
* RISK-003: Outstand analytics availability differs by platform and post state; unavailable metrics must remain null rather than display as zero.
* RISK-004: Large browser-generated MP4 uploads can be interrupted; upload state and retry behavior must remain visible.
* ASSUMPTION-001: The initial administrator email is known before the first production sign-in.
* ASSUMPTION-002: Each Outstand social account can be assigned to at most one active VideoMaker user.
* ASSUMPTION-003: Completed MP4 retention is acceptable in private Supabase Storage under an operator-defined storage quota.

## 8. Related Specifications / Further Reading

* [VideoMaker product requirements](../docs/PRD-VideoMaker-v1.md)
* [VideoMaker technical requirements](../docs/TRD-VideoMaker-v1.md)
* [Outstand publishing plan](./feature-outstand-social-publishing-1.md)
* [Supabase server-side Auth for Next.js](https://supabase.com/docs/guides/auth/server-side/nextjs)
* [Supabase row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security)
