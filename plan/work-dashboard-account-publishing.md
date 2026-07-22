---
title: Improve Dashboard Account and Publishing Workflows
description: Clarify account navigation, persist social connections, support multi-site publishing, and preview recent videos
status: blocked
last_updated: 2026-07-22
---

## Goal

Make routine account and publishing tasks clear from the dashboard. Users must be able to preview and download completed videos, see connected social accounts after refresh, choose multiple compatible publishing destinations, and find profile, password, administration, and sign-out actions without relying on unlabeled icons.

## Plan

* [x] Add labeled, accessible account navigation and password-management access
* [x] Preserve newly connected social accounts for the connecting user
* [x] Show connected-account status on the dashboard
* [x] Add inline playback and download controls to recent videos
* [x] Add video-format-aware multi-account publishing controls
* [x] Add focused tests and run the full validation suite
* [x] Update and regenerate the production walkthrough
* [x] Deploy and validate production
* [x] Proxy private video playback through an authenticated same-origin route
* [x] Persist newly connected social accounts to the connecting user
* [x] Revalidate and redeploy the playback and connection fixes
* [x] Add a permanent regression and security test playbook
* [x] Bind Outstand OAuth to the current user and persist the callback account
* [x] Deploy LinkedIn reconnect behavior
* [ ] Verify an authenticated production LinkedIn reconnect

## Decisions

* Keep explicit confirmation before every multi-destination publication.
* Use the existing private video storage and short-lived signed URLs for playback and downloads.
* Treat Outstand as the source of truth for connection health while retaining per-user account assignments in Supabase.
* Recommend destinations by rendered aspect ratio without preventing deliberate selection of another supported account.
* Show the complete Outstand account inventory to administrators, who manage connections and assignments. Continue restricting regular users to active account assignments.
* Use an authenticated same-origin stream with ownership filtering and byte-range forwarding so COEP remains enabled.
* Upload the durable private Supabase copy to Outstand instead of relying on an in-memory render blob.
* Keep dependency auditing separate from functional regression so unresolved advisories remain visible.
* Pass the signed-in user ID as Outstand's `tenant_id` and accept callback accounts only from that tenant.
* Reconnect an account idempotently when it is already assigned to the same user; reject assignments owned by another user.

## Progress

The dashboard already creates 15-minute signed video URLs but exposes them only as download links. The publishing step already accepts multiple account IDs, but it lacks bulk selection based on video format.

Connected accounts are loaded only in the final Publish step. Signed-in account listing is filtered through `social_account_assignments`, and the current connection flow does not persist a new assignment for the connecting user.

Added labeled Admin, Account, and Sign out navigation actions. Account now includes profile, email, and password-reset management.

Added a dashboard connected-account panel with provider health, refresh, and administrator connection controls. Administrators see all connected Outstand accounts after refresh; regular users continue to see only active assignments.

Recent videos now use private signed URLs for inline playback and explicit downloads. Publishing supports individual selection, compatible-format recommendations, all-supported selection, and clearing the selection before the existing named-destination confirmation.

Updated the production walkthrough to version 1.7 and regenerated the seven-page PDF.

Deployed feature commit `ce1575b` through Vercel deployment `dpl_EFneGsAEcD7fAVEXMQxtY5CTVU7L`. The deployment is Ready at the canonical production alias.

Production follow-up identified two ownership defects. Supabase serves a valid fast-start AVC/AAC MP4 with byte-range support, but the app's `Cross-Origin-Embedder-Policy: require-corp` blocks direct cross-origin media embedding. LinkedIn is healthy in Outstand, but JC cannot see it because no per-user assignment was created by the OAuth connection flow.

Added `test.md` and package commands for repeatable regression, production-build, dependency-audit, route-security, authenticated playback, social-connection, and approved-publishing checks.

Added route-level tests for signed-out playback, regular-user ownership filtering, administrator access, range forwarding, safe downloads, OAuth snapshot rejection, user mismatch, account collision, and exact new-account assignment. Added an API-specific user guard so signed-out video requests return JSON `401` instead of redirecting.

Updated the production walkthrough to version 1.8 for authenticated same-origin playback, generic provider assignment, and durable Supabase-to-Outstand uploads. Regenerated the PDF and compacted the sign-off page to preserve a clean footer.

## Validation

* Focused publishing helper suite: 5 tests passed.
* Full Vitest suite: 9 files and 55 tests passed.
* Production Next.js build completed successfully with only the existing workspace-root and Hugging Face warnings.
* VS Code reports no errors in the changed TypeScript and TSX files.
* The version 1.7 walkthrough PDF has exactly 7 pages and contains the required navigation, connected-account, inline-playback, password-reset, and multi-select instructions.
* Visual inspection confirms changed PDF pages 2, 3, 5, 6, and 7 are legible and unclipped.
* Production `/login` returns HTTP 200. Signed-out `/api/publish/accounts` returns HTTP 401, and signed-out `/dashboard` redirects to `/login?next=%2Fdashboard`.
* A short-lived authenticated production check returned HTTP 200 for the dashboard and connected-accounts API. LinkedIn account `Satish Paul` is visible, active, and healthy after refresh.
* The authenticated dashboard contains the connected-account and recent-video sections. The administrator currently has no saved videos, so a live player could not be exercised in production; the inline player and download path passed type checking and the production build.
* The temporary production verification session was revoked and temporary credentials were deleted.
* Final local regression gate: 13 test files and 77 tests passed.
* Final local production build passed with the existing workspace-root and Hugging Face `import.meta` warnings.
* Focused video-route suite: 6 tests passed. Focused OAuth-completion route suite: 5 tests passed.
* VS Code reports no errors in the changed playback, authentication, callback, and OAuth completion files.
* Source scan found no committed provider keys, private keys, credential-bearing connection strings, dynamic code execution, or dangerous React HTML injection.
* Production dependency audit reports four high-severity `sharp` and libvips advisories inherited through Next.js and Kokoro/Hugging Face. npm reports no available fix; this remains an explicit release exception.
* The version 1.8 walkthrough PDF has exactly 7 pages and contains all required playback, account-assignment, durable-upload, and troubleshooting guidance.
* Visual inspection of changed PDF pages 1, 4, 5, 6, and 7 confirms all content is legible and unclipped.
* Commit `62ab919` deployed successfully through Vercel deployment `dpl_8XKMD7fWifDrfJ8FwgbPdZYijcXV`; the canonical production alias is Ready.
* Production signed-out smoke checks passed: Login `200`, Dashboard `307` to `/login?next=%2Fdashboard`, and accounts, video, and OAuth completion APIs `401`.
* Production metadata confirms `OUTSTAND_API_KEY` is encrypted for Production and Preview. Vercel does not reveal its sensitive value through environment pull.
* The scoped Supabase query confirmed JC (`spiritdoctorjc@gmail.com`) is an active regular user. The temporary production environment file was deleted immediately after verification.
* The browser has no authenticated administrator session, so the pre-existing LinkedIn account could not be assigned or tested as JC without bypassing normal authentication. No assignment was attempted.
* Focused OAuth completion and token tests pass 11 tests across 2 files.
* `npm run test:regression` passes 13 test files and 81 tests, followed by the optimized production build.
* VS Code reports no errors in the changed completion route, callback page, or Outstand client.
* Walkthrough version 1.9 was regenerated with Python Playwright and Edge. Direct PDF validation confirms seven nonblank pages and all required reconnect and multi-profile text.
* Visual inspection of walkthrough pages 6 and 7 at print width confirms complete text, stable layout, and visible footers.
* Commit `39a9ac1` was pushed to `main` and deployed through Vercel deployment `dpl_FiRKhYaYCK5ktJhFT3ADaqpTpzAh`; the canonical production alias is Ready.
* Production signed-out smoke checks pass: Login `200`, Dashboard `307` to `/login?next=%2Fdashboard`, connected accounts `401`, and OAuth completion `401`.
* The Vercel CLI reported a non-blocking npm dist-tag lookup warning before completing deployment and inspection.

Production screenshots on 22 July show the user signed into LinkedIn in the same browser while VideoMaker still reports no connected account. Browser origin isolation prevents VideoMaker from reading LinkedIn cookies directly. Outstand returns the successful OAuth account as `account_id`, but the current callback discards it and completion accepts only IDs absent before OAuth. This rejects a reused LinkedIn connection.

Implemented tenant-bound OAuth with the current user ID, exact callback account verification, idempotent same-user assignment reactivation, and cross-user collision rejection. Added Outstand pending-session support so a single profile finalizes automatically and multiple LinkedIn profiles or organization pages require explicit selection.

## Resume Context

Current checkpoint: Tenant-bound callback assignment and pending LinkedIn profile selection are deployed to production. Automated regression, build, walkthrough, and signed-out production checks pass.

Next action: While signed into VideoMaker and LinkedIn, select Connect for LinkedIn, complete consent, choose the intended profile if prompted, then refresh Dashboard and confirm the account remains visible.