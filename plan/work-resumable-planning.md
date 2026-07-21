---
title: Resumable Work Planning
description: Implementation state for repository-wide crash-resilient task planning
status: completed
last_updated: 2026-07-21
---

## Goal

Ensure substantial planned work is recorded in a clearly named Markdown file so a new Copilot session can resume after a client crash.

## Plan

* [x] Inspect existing workspace customization and planning conventions
* [x] Add project-wide resumable work-state instructions
* [x] Validate instruction discovery and Markdown structure
* [x] Commit and push the convention

## Decisions

* Store resumable task state under `plan/work-<task-slug>.md`.
* Reuse a relevant existing implementation plan instead of creating duplicate state.
* Exempt casual questions and trivial one-step operations that do not involve planning.
* Never store passwords, tokens, secrets, signed URLs, or sensitive payloads in state files.

## Progress

Added `.github/copilot-instructions.md` with task naming, checkpoint cadence, resume discovery, completion, and secret-safety requirements. The convention is ready to commit and push.

## Validation

* VS Code reports no errors in either Markdown file.
* Repository search discovers `plan/work-resumable-planning.md`.
* Status and resume-context search finds the active checkpoint and exact next action.
* `git diff --check` reports no whitespace errors.

## Resume Context

Current checkpoint: The resumable planning convention is implemented and validated.

Next action: No implementation action remains. Future substantial tasks must create or resume their appropriately named file under `plan/`.