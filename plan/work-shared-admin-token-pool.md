---
title: Add Shared Administrator Token Pool
description: Replace duplicated user defaults with a live shared monthly allocation budget
status: in-progress
last_updated: 2026-07-21
---

## Goal

Make the 100,000-token value a clear shared monthly administrative budget. User limits must reduce the visible unallocated balance, over-allocation must be rejected, and administrators must understand how internal limits differ from provider credits and rate limits.

## Plan

* [x] Add a persisted shared monthly token budget and allocation enforcement
* [x] Return live pool totals from authenticated administrator APIs
* [x] Show and edit total, assigned, and unallocated values on the Admin page
* [x] Add focused allocation tests and run the full validation suite
* [x] Update and regenerate the production walkthrough
* [ ] Apply the database migration, deploy, and validate production

## Decisions

* Count active regular-user monthly limits against the shared allocation pool.
* Treat administrator access to the unallocated balance separately from regular-user limits.
* Reject invitations, quota increases, or pool reductions that would over-allocate the pool.
* Explain that increasing the internal pool does not purchase OpenRouter credits or increase Groq limits.

## Progress

The existing 100,000 value is a hard-coded form default and database profile default. It is copied to users independently, so assigning 2,000 currently does not deduct from any shared balance.

Added a singleton 100,000-token monthly pool, atomic database allocation functions, and shared administrator usage enforcement. Active regular-user limits reduce the administrator balance; inactive users and administrators do not consume assigned-user allocation.

The Admin page now shows total, assigned, and unallocated values with immediate arithmetic while editing. New regular users default to 2,000 tokens. Administrators can update the internal pool, but the page explains that provider credits and rate limits remain separate.

Added an administrator-only provider-capacity check. It queries OpenRouter from the protected Vercel environment and returns only plan, credit, and usage metadata; it never returns the provider key. Groq is identified as a configured fallback with model-specific rate limits rather than a monthly shared token bank.

Applied migration `202607210001_shared_monthly_token_pool.sql` to the production Supabase database. Remote migration history confirms both repository migrations are applied.

## Validation

* Focused administrator policy suite: 9 tests passed.
* Full Vitest suite: 9 files and 53 tests passed.
* Production Next.js build completed after clearing a stale OneDrive `.next` artifact; only the existing workspace-root, Hugging Face, and Edge-runtime warnings remain.
* Final full Vitest suite after provider-capacity reporting: 9 files and 53 tests passed.
* Final production Next.js build includes `/api/admin/provider-capacity` and completed successfully with the same pre-existing warnings.
* VS Code reports no errors in the changed TypeScript, TSX, SQL, HTML, or Markdown files.
* The version 1.6 walkthrough PDF has exactly 7 pages and contains the shared-pool, 100,000 minus 2,000, and provider-capacity guidance.
* Raster inspection confirms the changed Admin walkthrough page is legible and unclipped.

## Resume Context

Current checkpoint: Implementation, tests, build, and version 1.6 walkthrough are complete. Production migration and deployment remain.

Next action: Apply `202607210001_shared_monthly_token_pool.sql` to the linked Supabase project, then deploy and validate production.