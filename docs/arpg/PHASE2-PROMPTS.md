# Phase 2 role-separated prompts — Claude developer / Codex reviewer

Use these prompts **in separate sessions**. Neither prompt configures automatic cross-app invocation or grants access. The developer must push its exact head and PR before the independent reviewer starts. Read [PHASE2-LOOP.md](PHASE2-LOOP.md) and [PHASE2-STATUS.md](PHASE2-STATUS.md) on the latest applicable branch; compare against actual GitHub records.

## 1. Claude Code — developer kickoff (P2 PR1, then adapt for PR2–5)

Copy the following into a Claude Code session connected to `Harrisonxaph/catherdral-game`:

```text
ROLE: Claude Code is the sole implementation author for this PR.
REPO: Harrisonxaph/catherdral-game
WORK ITEM: Phase 2 PR1, issue #32.
GOAL: Prepare reproducible five-floor campaign generation with
stable spawn and chest IDs, without changing seeded RNG draw order,
world layouts, existing combat rules, loot, renderers or save lifecycle.

IMPORTANT: First inspect live GitHub. Never infer that this prompt
proves product-policy approval. Check docs/arpg/SPEC.md section 10
and the owner approval source recorded in docs/arpg/PHASE2-STATUS.md.
If owner approval is missing or ambiguous, STOP before gameplay
changes. Return a brief owner decision checklist plus proposed
implementation/test plan. Read-only planning is permitted.

INSPECT FIRST:
- git remote, current branch, clean worktree and latest origin/main SHA.
- Open PRs and outstanding work; do not overwrite other branches.
- AGENTS.md; PROJECT.md; TASKS.md; DECISIONS.md;
  docs/AGENT-WORKFLOW.md; docs/arpg/SPEC.md;
  docs/arpg/ROADMAP.md; docs/arpg/AUDIT.md;
  docs/arpg/PHASE2-LOOP.md and docs/arpg/PHASE2-STATUS.md.
- Actual current floors.js, index.html generation/spawn/chest code,
  chapter.test.cjs, graphics-budget tests and CI workflow.
- Phase 1A merged #29–#31, current save-schema and storage APIs.

IF OWNER AUTHORISATION IS VERIFIED:
1. Start branch development/arpg-p2-pr1-stable-identities from
   current main (not old pinned history).
2. Record baseline layouts, RNG draw order and graphics world digests.
3. Define stable, versionable IDs for existing area, spawn and chest
   records; do NOT consume extra gameplay random values.
4. Keep old generation routes, boss positions, counts, encounter
   behaviour, seeded layouts and graphics world digests unchanged.
5. Add focused deterministic regression tests:
   - all five floors, >=100 existing seeds per floor;
   - identical input -> identical stable unique IDs/layout;
   - distinct spawn/chest identities without collisions;
   - no changed seeded random draw order or layout digest;
   - existing collision, boss, chest and combat tests remain valid.
6. Run npm test, npm run build, relevant browser scripts, and
   graphics budget verification using current baseline. Respect
   Playwright/Chromium requirements documented in AGENTS.md.
   Use existing CI; do not silently skip or weaken tests.
7. Push branch and open a DRAFT PR to main referencing issue #32,
   with exact head/base SHAs and acceptance/test evidence.
8. Append initial handover to docs/arpg/PHASE2-STATUS.md, and update
   PROJECT.md/TASKS.md for material status changes only.
9. STOP with status AWAITING_INDEPENDENT_CODEX_REVIEW.
   Do not self-review as Codex, merge, deploy or begin PR2.

BOUNDARIES:
- Preserve native JS + Three.js/Canvas; no framework changes.
- No edits to character save storage semantics unrelated to PR1.
- No gameplay balance or enemies/abilities overhaul.
- No paid infrastructure, API secrets or privileged workflows.
- Do not claim physical iPhone testing without device evidence.
- Never use speculative prior chat as approval of SPEC section 10.
- Correct no more than three reviewer-found implementation cycles
  across the life of this PR, including subsequent sessions.

REPORT:
Exact branch and SHA, PR URL, test commands/results, skipped checks,
baseline comparison, known risks, remaining owner decisions,
and suggested handoff to an independent Codex session.
```

For PR2–5, keep this prompt's role, gate, test-reporting, bounded-loop and stop rules. Replace the work item and implementation criteria with the matching [issue](PHASE2-LOOP.md#scope-and-dependency-order), verify the previous PR was owner-merged on main and a new owner go-ahead exists. **Never reuse PR1's detailed implementation instructions for another step.**

## 2. Codex — independent reviewer

Copy this into a **fresh Codex review session** after Claude has published the actual draft PR.

```text
ROLE: Independent code reviewer, NOT an implementation author.
REPO: Harrisonxaph/catherdral-game
PR: [insert actual PR URL]
EXPECTED WORK ITEM: P2 PR[1-5], linked GitHub issue.

READ-ONLY REVIEW:
1. Fetch current repository, AGENTS.md, project documentation,
   docs/arpg/PHASE2-LOOP.md, docs/arpg/PHASE2-STATUS.md and
   the actual GitHub PR metadata, changed files, unified diff,
   base SHA and head SHA. Verify that source/target branches
   match the expected work item. Treat stale docs as uncertain.
2. Compare the exact pushed HEAD against issue acceptance criteria,
   SPEC/ROADMAP, current merged code and historical invariants.
3. Examine existing tests: verify meaningful coverage and detect
   cases where tests merely assert the implementation's mistakes.
4. Independently execute relevant tests when the environment
   permits; observe GitHub CI completion/status. If unavailable,
   say NOT VERIFIED rather than inventing results.
5. Prioritize data loss, duplicated rewards, non-atomic writes,
   invalid item ownership, stale revisions/leases, dangerous
   migrations, RNG/digest regression, disabled safeguards,
   simulation-time/cooldown regressions and touch/Canvas breaks.
   For PR1 specifically check unchanged seeded random draw order,
   all five floor layouts, unique stable spawn/chest IDs, no
   graphics world digest change and no unrelated combat edits.
6. Report each finding with severity (blocking / nonblocking),
   file/path or diff location, concrete reproduction/failed
   invariant, and a specific recommended correction.
7. State exact reviewed head SHA, which CI jobs were observed
   and their outcomes, tests actually executed and gaps.
8. If there are no findings, say 'No findings on reviewed head',
   never 'guaranteed correct'. Never self-approve a PR authored
   by the same agent/session.
9. Stop and hand findings back to Claude; do NOT modify or
   push implementation code, merge, deploy, start next PR or
   claim to be a second independent reviewer yourself.

OUTPUT:
PR/base/head | verdict | blocking findings | nonblocking
findings | verification evidence | missing evidence | exact
next action and remaining owner approvals.
```

Review **the PR's current pushed head**, not the original head if Claude amended it after a correction. Each re-review must restate its own exact SHA and whether blockers remain.

## 3. Claude Code — reviewer-driven correction, bounded to three cycles

```text
ROLE: Claude Code developer correcting independent Codex findings.
REPO: Harrisonxaph/catherdral-game
PR: [existing PR URL]
REVIEWED HEAD: [SHA Codex reviewed]
REVIEW FINDINGS: [paste Codex findings or provide review link]

Before editing:
- Read existing docs/arpg/PHASE2-STATUS.md attempt history.
- Compute cycles already consumed across all sessions for this PR.
- If already at 3 correction cycles, STOP: BLOCKED.
- Confirm the findings refer to current branch/head and are still valid.
- Never overwrite newer/unrelated commits.

For one correction cycle:
1. Identify root cause for each blocking finding and relevant
   acceptance criterion.
2. Make the minimum safe correction, preserving unrelated features.
3. Add focused regression tests, ideally failing before the fix.
4. Run all relevant tests and record actual results.
5. Commit and push to the SAME feature PR branch.
6. Increment the persistent correction counter exactly once for
   this reviewer-driven fix submission (max 3 total).
7. Append new evidence, precise pushed SHA and residual risks to
   docs/arpg/PHASE2-STATUS.md.
8. Stop for a NEW independent Codex re-review of the updated head.

Do not reset the cycle counter, disable failing checks, merge,
deploy, or start the next phase automatically. Escalate after
3 unsuccessful correction submissions or immediately for a
save-safety / policy blocker.
```

## 4. Owner — phase handoff and release gate

When a PR is marked `READY_FOR_OWNER_REVIEW`, inspect actual CI results, independent review of the **latest** SHA and device gaps. If accepted, **manually merge** that PR and record the merge commit in the status ledger. Only then authorise the next PR issue. PR5 completion does not authorise production deployment or claim physical-device acceptance.

## Mobile workflow

1. Open the repository from an iPhone/iPad GitHub app or browser and read the [status ledger](PHASE2-STATUS.md).
2. Use Claude Code in a supported connected coding environment, select the VESPER repository, and paste developer prompt 1 (or relevant PR2–5 scope). A normal Claude chat with no repository execution access cannot run tests or publish a PR.
3. Once Claude posts the pushed draft PR URL, open a **separate Codex session** connected to the same repo and paste reviewer prompt 2 with that URL.
4. Use GitHub's PR **Checks** tab to inspect the existing automated CI jobs. Green means checks completed, not that phone performance or save durability was proven.
5. Send blocking findings back to Claude with prompt 3. Repeat at most three correction cycles, including all future sessions.
6. Review, approve and manually merge each PR; only then initiate the next stage.

**Limit:** These instructions enable reproducible handoffs, not unattended Claude/Codex orchestration. Neither assistant launches the other just because this file exists; permission, account connection, scheduling and billing are separate concerns.
