# Project Instructions

## Resumable Work State

For every substantial task that requires planning, multiple edits, deployment, external operations, or more than one validation step:

* Before the first substantive edit, create or update `plan/work-<task-slug>.md`, where `<task-slug>` is a concise kebab-case description.
* If a relevant implementation plan already exists under `plan/`, update that file instead of creating duplicate state.
* At the start of a task, search `plan/work-*.md` and related plans for `status: in-progress` or `status: blocked`. If one matches the request, read it and resume from its `Resume Context` section.
* Keep the state file concise and update it after scope decisions, substantive edits, validation or deployment results, blockers, and before the final response.
* Include YAML frontmatter with `title`, `description`, `status`, and `last_updated`.
* Include these sections: `Goal`, `Plan`, `Decisions`, `Progress`, `Validation`, and `Resume Context`.
* In `Resume Context`, record the current checkpoint and one exact next action that a fresh session can execute.
* Record changed files, relevant commands and outcomes, commit identifiers, and deployment identifiers when they help recovery.
* Mark `status: completed` and record final validation when the task finishes. Keep the file as project history unless the user asks to remove it.
* Never write passwords, access tokens, refresh tokens, API keys, service-role keys, signed URLs, or sensitive payloads into a planning file.

Do not create a work-state file for casual conversation, a direct informational answer, or a trivial one-step operation with no planned follow-up unless the user explicitly requests one.