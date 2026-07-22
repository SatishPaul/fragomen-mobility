---
title: VideoMaker Regression and Security Test Plan
description: Repeatable automated and production checks required after application changes
last_updated: 2026-07-21
---

## Purpose

Run this test plan after every functional, authentication, storage, publishing, infrastructure, or dependency change. Do not deploy when the regression command fails. Record unresolved security-audit findings explicitly before approving a production release.

## Required Commands

Run from the repository root with the production environment excluded from command output.

```powershell
npm run test:regression
npm run test:security
git diff --check
```

Expected results:

* `test:regression` passes every Vitest file and the optimized Next.js production build
* `test:security` reports no unapproved high or critical production dependency advisories
* `git diff --check` produces no output
* VS Code Problems reports no errors in changed files

`test:security` is intentionally separate because a known upstream advisory may remain open while functional tests pass. Never treat a passing regression command as proof that dependencies are vulnerability-free.

## Automated Coverage

The Vitest suite must retain coverage for these policies:

| Area | Required behavior |
|---|---|
| Administrator users | Last-admin protection, self-protection, quota allocation, and over-allocation rejection |
| Authentication callback | Safe internal redirects and rejection of external destinations |
| AI analysis | Input validation, provider fallback, retries, and safe errors |
| Publishing authorization | Same-origin mutation requests, valid provider IDs, assigned-account enforcement, and idempotency |
| Publishing outcomes | Terminal-state handling, failed-account retry selection, and account visibility by role |
| Social OAuth completion | Signed snapshot round trip, tamper rejection, wrong-secret rejection, and expiry rejection |
| Video streaming | Valid byte ranges, invalid range rejection, safe download filenames, and private ownership checks |
| Usage quotas | Per-run estimates, monthly limits, shared administrator balance, and atomic reservation |
| Webhooks | Valid Outstand signatures and rejection of missing, malformed, or changed signatures |

When a defect reaches production, add a focused automated test that fails before the fix and passes afterward.

## Security Invariants

Review these conditions during every authentication, storage, or publishing change:

* Every `/api` route is authenticated unless it is explicitly allowlisted as public middleware traffic.
* Video lookups include ownership filtering for regular users. Unknown or other-user IDs return `404` without revealing ownership.
* Administrators may inspect managed-user videos only through authenticated administrator authorization.
* Video responses preserve valid `Range` requests, reject malformed ranges, send `nosniff`, and never expose Supabase signed URLs to page markup.
* State-changing publishing routes enforce same-origin requests.
* OAuth completion accepts only an untampered, unexpired, HTTP-only snapshot belonging to the current user.
* OAuth assignment includes only provider account IDs created after that connection began. Existing or already-assigned account IDs cannot be claimed.
* Regular users see only active assigned social accounts. Administrators see the provider inventory for management.
* Provider keys, Supabase service-role keys, database URLs, signed URLs, session cookies, and OAuth tokens never appear in logs, API payloads, screenshots, plans, or committed files.
* Publication always requires a final confirmation that names every destination. Assignment or connection never publishes automatically.
* Outstand uploads read the authenticated durable MP4 from private Supabase Storage. Vercel Blob is not used.

## Production Smoke Test

Run after Vercel reports the deployment as Ready.

### Signed-Out Checks

| Request | Expected result |
|---|---|
| `GET /login` | `200` |
| `GET /dashboard` | `307` to `/login?next=%2Fdashboard` |
| `GET /api/publish/accounts` | `401` |
| `GET /api/videos/{known-id}` | `401` |
| `POST /api/publish/accounts/complete` | `401` |

### Regular-User Checks

1. Sign in as an active regular user.
2. Confirm Dashboard shows the user's quota, connected social accounts, and only the user's saved videos.
3. Play a recent video inline. Confirm duration appears, seeking works, audio plays, and no media error appears in browser tools.
4. Download the same video and confirm the MP4 opens locally.
5. Request the stream with `Range: bytes=0-1023`; expect `206`, `Content-Range`, `Accept-Ranges: bytes`, and `Content-Type: video/mp4`.
6. Request another user's video ID; expect `404`.
7. Connect each approved network used by the account. After OAuth, refresh Dashboard and verify platform, nickname or username, and Ready or Reconnect status.
8. Confirm a newly connected account appears only for its assigned user and administrators.
9. Render a video, select several approved destinations, and verify Recommended labels match the chosen aspect ratio.
10. Stop at the final confirmation unless a real external post is approved.

### Administrator Checks

1. Confirm Admin, Account, Sign out, and Create video actions are clearly labeled on desktop.
2. Confirm all Outstand connections appear with platform, nickname or username, and health.
3. Assign and remove a disposable social account from a test user; verify visibility changes after refresh.
4. Confirm shared token-pool arithmetic updates immediately and rejects over-allocation.
5. Confirm another administrator sees the same shared balance.

### Approved Publishing Check

Run only with destination-owner approval.

1. Review the durable saved video inline before publishing.
2. Select exact accounts individually, with Select recommended, or with Select all supported.
3. Remove every unapproved destination.
4. Enter the final title and caption.
5. Verify the confirmation dialog names every selected account.
6. Confirm once and verify per-account outcomes without duplicate posts.
7. Retry only failed destinations.
8. Refresh analytics manually and verify native post links.

## Current Security Baseline

As of 21 July 2026:

* Source scan found no committed provider keys, private keys, credential-bearing connection strings, dynamic code execution, or dangerous React HTML injection.
* The full local regression gate passes 13 test files and 77 tests, including focused playback and social-connection route coverage.
* `npm audit --omit=dev --audit-level=high` reports four high-severity advisories inherited through `sharp` and libvips from Next.js and Kokoro/Hugging Face.
* npm currently reports no available fix for those advisories. Do not run `npm audit fix --force`; reassess when upstream packages publish patched versions.

The dependency advisory is an open security exception, not a passing result. Review whether affected image-processing paths accept untrusted inputs before each release and update dependencies as soon as a compatible fix exists.

## Release Record

Record each release using this template:

```text
Commit:
Deployment ID:
Regression command:
Tests passed:
Build result:
Security audit result:
Signed-out smoke result:
Authenticated playback result:
Connected-account result:
Publishing result or reason skipped:
Walkthrough version and page count:
Known exceptions:
Tester and date:
```