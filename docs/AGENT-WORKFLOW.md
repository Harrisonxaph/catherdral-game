# Shared agent workflow and handover

AGENTS.md is authoritative. Claude Code and Gemini CLI import it; Copilot's
repository instructions direct readers to it. Keep wrappers thin and change
project rules in AGENTS.md, not four copies. This is a repository convention,
not a promise that all tools have identical loading precedence or permissions.

## Before starting

1. Verify the repository, default branch and current branch (`git remote -v`,
   `git branch --show-current`); fetch current references when permitted.
2. Inspect `git status --short`, recent commits and open/unmerged PRs. Use
   `gh pr list --state open` if authenticated, or GitHub's Pull requests page.
   If access is unavailable, report that limitation rather than assuming no PRs.
3. Read AGENTS.md, PROJECT.md, TASKS.md, DECISIONS.md and any scoped instructions.
4. State the requested task and acceptance criteria; inspect relevant source and
   existing behaviour. Separate approved scope from recommendations.
5. Create/use a dedicated development branch or isolated worktree from the agreed
   base. Never reset or overwrite another person's dirty checkout or unmerged PR.

## During development

Make focused changes using the existing stack. Preserve features outside the
request. Add meaningful tests where appropriate; use existing build/test commands.
Never expose keys, tokens, private candidate data or local environment files.
Do not give PR workflows secrets, write tokens or production deployment steps.
Coordinate file ownership when concurrent agents work; prefer separate branches.
An instruction file does not authenticate another assistant or grant GitHub access.

## Completion and switch to another assistant

1. Run the relevant commands; record exact results, failures, skipped checks and
   environment/tool requirements. Hosted CI is not passing until observed.
2. Update PROJECT.md for material capability/decision changes, TASKS.md for task
   state and DECISIONS.md for evidence-backed decisions. Keep historical dates
   unknown when unknown. Do not invent owner-approved priorities.
3. Commit focused changes on the development branch and push/synchronise them.
4. Open a PR for review. Avoid automatic merging, production deployment or paid
   service provisioning. Git integrations may create previews automatically;
   that does not authorize promoting or changing production.
5. Record the handover below in the PR description (and TASKS.md when useful).
   Give the next assistant the repository, branch, exact pushed commit and PR URL.
6. In the next tool, fetch and check out that branch, verify its commit, inspect
   status/PR changes, reread the shared documents and resume the stated next task.
   Never imply uncommitted/local-only files or a prior chat are shared context.

## Handover template

- Task / acceptance criteria:
- Repository, base branch, development branch:
- Pushed commit and PR URL (or explicitly unsynchronised):
- What changed, why, and files modified:
- Checks run and exact pass/fail results:
- Checks not run and why:
- Outstanding work / known limitations:
- Risks / unresolved decisions:
- Next concrete action and approval still needed:

## Compatibility evidence and local checks

Verified against official documentation on 2026-10-21:

- [Claude Code imports](https://code.claude.com/docs/en/memory): standalone
  `@AGENTS.md` in root CLAUDE.md loads the shared file using a relative import.
- [Gemini CLI memory imports](https://github.com/google-gemini/gemini-cli/blob/main/docs/reference/memport.md):
  root GEMINI.md uses `@./AGENTS.md`.
- [Copilot repository instructions](https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/add-custom-instructions/add-repository-instructions):
  `.github/copilot-instructions.md` contains concise guidance and a link to the
  shared rules; it does not pretend Markdown links are universal auto-imports.

Run `python3 .github/scripts/check_agent_docs.py` for links, entry points and
import cycles. This validates repository wiring, not the installed assistant's
account, version or session. In Claude inspect `/memory`; in Gemini inspect
`/memory show` after `/memory refresh`; in Copilot inspect instruction references
or `/instructions` where supported. Confirm the tool actually loaded AGENTS.md.
User account settings, older tool versions and nested instructions may affect loading.
No assistant credentials or user-level settings are changed by this setup.

## VESPER audit record — 2026-10-21

Baseline: main `31932ec`, with detailed AGENTS.md and PROJECT.md already present.
No agent.md, Claude/Gemini/Copilot adapters, TASKS.md, DECISIONS.md or Actions
workflow was present. README.md is minimal; historical stage documents contain
older balance/branch statements, already identified in PROJECT.md. Source
inspection reconfirmed five floors, eight regular enemy definitions, equipment,
abilities, boss state machines, Three.js and Canvas entry points.

Open PRs at audit: #11 (older preview/offline branch) and #3 (main into an older
stage branch). Neither was modified. The original checkout was clean; this work
uses a separate linked worktree and development branch.

Quality checks: existing `npm test` passed locally. New documentation validation
and its five positive/negative regression cases passed; workflow YAML and shell
blocks parse. Existing browser suites are run separately; record their final
results in the PR. The new Actions workflow is PR/manual-only, with read-only
contents permission, SHA-pinned actions, no secrets or deployment steps.
Playwright 1.62.1 matches the installed test module and was verified in npm's
registry; it is provisioned only as workflow tooling. Actual assistant session
loading and hosted Actions completion still require checking in those tools.
