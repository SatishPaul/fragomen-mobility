---
title: Improve Dashboard Account and Publishing Workflows
description: Clarify account navigation, persist social connections, support multi-site publishing, and preview recent videos
status: in-progress
last_updated: 2026-07-21
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
* [ ] Deploy and validate production

## Decisions

* Keep explicit confirmation before every multi-destination publication.
* Use the existing private video storage and short-lived signed URLs for playback and downloads.
* Treat Outstand as the source of truth for connection health while retaining per-user account assignments in Supabase.
* Recommend destinations by rendered aspect ratio without preventing deliberate selection of another supported account.
* Show the complete Outstand account inventory to administrators, who manage connections and assignments. Continue restricting regular users to active account assignments.

## Progress

The dashboard already creates 15-minute signed video URLs but exposes them only as download links. The publishing step already accepts multiple account IDs, but it lacks bulk selection based on video format.

Connected accounts are loaded only in the final Publish step. Signed-in account listing is filtered through `social_account_assignments`, and the current connection flow does not persist a new assignment for the connecting user.

Added labeled Admin, Account, and Sign out navigation actions. Account now includes profile, email, and password-reset management.

Added a dashboard connected-account panel with provider health, refresh, and administrator connection controls. Administrators see all connected Outstand accounts after refresh; regular users continue to see only active assignments.

Recent videos now use private signed URLs for inline playback and explicit downloads. Publishing supports individual selection, compatible-format recommendations, all-supported selection, and clearing the selection before the existing named-destination confirmation.

Updated the production walkthrough to version 1.7 and regenerated the seven-page PDF.

## Validation

* Focused publishing helper suite: 5 tests passed.
* Full Vitest suite: 9 files and 55 tests passed.
* Production Next.js build completed successfully with only the existing workspace-root and Hugging Face warnings.
* VS Code reports no errors in the changed TypeScript and TSX files.
* The version 1.7 walkthrough PDF has exactly 7 pages and contains the required navigation, connected-account, inline-playback, password-reset, and multi-select instructions.
* Visual inspection confirms changed PDF pages 2, 3, 5, 6, and 7 are legible and unclipped.

## Resume Context

Current checkpoint: Implementation, tests, build, and walkthrough synchronization are complete. Production deployment and verification remain.

Next action: Review the final diff, commit and push the changes, deploy to Vercel, and validate the production dashboard and connected-account API.