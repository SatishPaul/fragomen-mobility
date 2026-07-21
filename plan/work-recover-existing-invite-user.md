---
title: Improve Administrator User Management
description: Add existing-user recovery, role selection, guarded deletion, and clearer quota and social-account controls
status: in-progress
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
* [ ] Deploy and validate the production workflow

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

## Validation

* Focused administrator mutation policy: 6 tests passed.
* VS Code reports no errors in the route, UI component, policy helper, or tests.
* Full Vitest suite: 7 files and 42 tests passed.
* Production Next.js build completed successfully with only pre-existing warnings.
* `git diff --check` reports no whitespace errors.

## Resume Context

Current checkpoint: The implementation and all local validation are complete.

Next action: Commit the five changed files, deploy to Vercel production, and verify the Admin page presents role and guarded delete controls.