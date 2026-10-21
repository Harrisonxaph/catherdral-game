# VESPER decisions

PROJECT.md already records the existing game-design decisions and source
precedence; reuse that record rather than reconstructing a competing history.
Dates of earlier choices are not inferred from stage numbers.

## 2026-10-21 — shared assistant entry point

- Decision: retain detailed AGENTS.md as authoritative; add thin agent.md,
  CLAUDE.md, GEMINI.md and Copilot compatibility entry points.
- Reason: owner requested shared standards across coding assistants without
  duplicated or conflicting project rules.
- Affected: instructions, project memory, handover and PR validation only.
- Existing alternatives: no competing assistant entry points were present on
  audited main `31932ec`. No historical alternatives are asserted.

## 2026-10-21 — PR quality checks without application/deployment edits

- Decision: run existing Node and browser suites in a PR-only workflow, with
  read-only repository permissions and isolated Playwright tooling. Add stdlib
  documentation validation. Do not modify package.json or production code.
- Reason: the existing browser scripts require Playwright but do not declare it
  as an application dependency. Explicit BASE_URL avoids mixed script defaults.
- Affected: `.github/workflows/quality.yml`, `.github/scripts/check_agent_docs.py`.
- Alternative not taken: changing application dependencies for a workflow-only task.
- Hosted Actions success remains unverified until the PR check run finishes.
