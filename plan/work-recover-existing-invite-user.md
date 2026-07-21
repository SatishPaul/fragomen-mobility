---
title: Improve Administrator User Management
description: Add existing-user recovery, role selection, guarded deletion, and clearer quota and social-account controls
status: completed
last_updated: 2026-07-21
---

## Goal

Make administrator user management complete and understandable, including typo recovery, roles, quotas, social-account authorization, and existing Auth identities.

## Plan

* [x] Trace the invitation API, profile trigger, and Admin Users list
* [x] Identify the quota defaults and current social-account assignment meaning
* [x] Implement idempotent existing-user recovery with a clear UI result
* [x] Add administrator or regular-user selection
* [x] Add guarded deletion for mistyped users
* [x] Clarify quota units and social-account authorization in the UI
* [x] Add focused tests and run the production build
* [x] Deploy and validate the production workflow
* [x] Update and regenerate the production walkthrough
* [x] Add a permanent walkthrough synchronization instruction

## Decisions

* Treat email addresses case-insensitively after trimming and normalization.
* Never delete or recreate an existing Auth identity.
* Never overwrite an existing administrator role.
* Repair only a missing application profile, then send a secure password-reset email for account access.
* Block administrators from deleting or demoting their own signed-in account.
* Delete a selected non-self Auth user only after explicit confirmation; database cascades remove that user's profile and owned records.
* Keep social publishing deny-by-default and explain that assignment grants permission but never publishes automatically.

## Progress

The Admin page reads `public.profiles`, while invitation creation writes to Supabase Auth first. The database and invite form both default new users to 100,000 monthly tokens. JC was configured with 10,000 tokens and permission to publish to the listed LinkedIn destination.

Implemented role-aware invites and updates, self and last-admin protection, explicit user deletion, existing Auth identity recovery, quota guidance, and social-assignment help. Added six focused policy tests.

Changed `app/api/admin/users/route.ts`, `components/AdminUsers.tsx`, `lib/admin-users.ts`, and `lib/admin-users.test.ts`. Deletion also removes private video objects before deleting the Auth identity and cascading owned database records.

The user requested that every new user-facing feature or workflow change also update the walkthrough source and PDF. Documentation synchronization is now part of this task.

Added a permanent walkthrough synchronization rule to `.github/copilot-instructions.md`. Updated the walkthrough to version 1.2 with role selection, monthly token-limit guidance, existing-account recovery, guarded deletion, and explicit social publishing permission language. Regenerated the seven-page PDF from the HTML source.

## Validation

* Focused administrator mutation policy: 6 tests passed.
* VS Code reports no errors in the route, UI component, policy helper, or tests.
* Full Vitest suite: 7 files and 42 tests passed.
* Production Next.js build completed successfully with only pre-existing warnings.
* `git diff --check` reports no whitespace errors.
* Commit `a89bf0d` is deployed and aliased to `https://fragomen-mobility.vercel.app`.
* An unauthenticated production check confirms `/admin` remains protected and redirects to `/login?next=%2Fadmin`.
* Headless Edge regenerated `docs/VideoMaker-Demo-Walkthrough.pdf` from the version 1.2 HTML source.
* PyMuPDF confirms the PDF has exactly 7 pages and contains all required version 1.2 administrator guidance.
* Raster inspection of pages 1, 3, and 7 confirms the changed content is legible and unclipped.
* VS Code reports no errors in the permanent instruction or walkthrough HTML.

## Resume Context

Current checkpoint: The administrator-management improvements are deployed and the synchronized version 1.2 walkthrough is complete.

Next action: No further action is required for this task. Start a new `plan/work-<task-slug>.md` file for the next substantial change.