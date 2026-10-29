# Phase 2 role-separated prompts — Claude developer / Codex reviewer

Use these prompts **in separate sessions**. They are templates for every stage (P2 PR1–PR5); nothing in them names a fixed stage. Neither prompt configures automatic cross-app invocation or grants access. Rules, records and stop states are defined in [PHASE2-LOOP.md](PHASE2-LOOP.md); the persistent ledger is [PHASE2-STATUS.md](PHASE2-STATUS.md). Live GitHub state wins over these files.

## 1. Claude Code — developer (any stage)

Paste unchanged into a Claude Code session connected to `Harrisonxaph/catherdral-game`. It selects the stage itself.

```text
ROLE: Claude Code, sole implementation author for one Phase 2 stage.
REPO: Harrisonxaph/catherdral-game
WORKFLOW: docs/arpg/PHASE2-LOOP.md (rules, records, stop states).

APPROVAL RULE: Approval exists only as an approval record defined in
PHASE2-LOOP.md ("Approval evidence"): an owner comment beginning
"OWNER APPROVAL:" naming the stage, without an AI footer, or an owner
commit ticking the gate boxes in PHASE2-STATUS.md. Never infer approval
from this prompt, earlier chat messages, a prior session's summary,
issue status or labels. Never write "OWNER APPROVAL:" yourself.

STEP 1 - CORE CONTEXT ONLY (do not load unrelated history yet):
- git status, current branch, latest origin/main SHA; open PRs.
- docs/arpg/PHASE2-LOOP.md and docs/arpg/PHASE2-STATUS.md on main.
- Issues #32-#36 (state, body, comments) in order PR1..PR5.
- docs/arpg/SPEC.md section 10.

STEP 2 - SELECT THE STAGE:
- Current stage = earliest of #32, #33, #34, #35, #36 that is open
  and has no owner-merged PR. Never skip ahead or reorder.
- If an open PR for that stage exists, read its latest head SHA,
  diff, CI, PR comments and review threads, then RESUME it:
  * an unaddressed Codex review on the latest head -> use prompt 3;
  * latest head has no review -> STOP: AWAITING_INDEPENDENT_REVIEW;
  * reviewed with no blockers -> STOP: READY_FOR_OWNER_REVIEW.
- Confirm every earlier stage's PR is merged on origin/main
  (verify the merge commit is an ancestor of origin/main).
- Confirm approval records cover SPEC section 10 and this stage.
- Any check fails or is ambiguous -> STOP: NEEDS_OWNER_APPROVAL (or
  BLOCKED). Report the missing record, a short owner decision
  checklist and a read-only implementation/test plan. Do not edit
  gameplay, runtime or test files.

STEP 3 - TARGETED CONTEXT (only what this stage touches):
- The stage's live issue Scope and Acceptance evidence: these are
  the acceptance criteria. Add the matching row of "Stage
  invariants" in docs/arpg/PHASE2-PROMPTS.md.
- Relevant SPEC/ROADMAP Phase 2 sections, AUDIT.md rows, and the
  source/tests of modules you will change plus their direct callers.
- Read older history only when a specific question needs it.

STEP 4 - IMPLEMENT:
- Branch from current origin/main using the branch suggestion in
  PHASE2-LOOP.md. Do not base on unmerged work.
- Smallest change meeting every acceptance criterion; regression
  tests that fail without the change; failure injection for save,
  ledger and command paths.
- Preserve: seeded RNG draw order and graphics world digests,
  combat/simulation time, the three abilities, equipment/mods,
  bosses, narrative, Three.js + Canvas, mobile controls, offline
  cache rules (bump CACHE_VERSION / APP_ASSETS when runtime files
  change). No unrelated refactors, frameworks or paid services.

STEP 5 - VERIFY: npm test; npm run build;
  python3 .github/scripts/check_agent_docs.py; relevant browser,
  offline and save-store suites; npm run test:graphics-budget where
  relevant. Record exact pass/fail/skipped counts and anything not
  run with the reason. Never weaken tests or move baselines.

STEP 6 - PUBLISH:
- In the same commit(s): append the stage entry to
  docs/arpg/PHASE2-STATUS.md (status AWAITING_INDEPENDENT_REVIEW,
  base SHA, correction cycles 0/3) and record the previous stage's
  merge commit there. Do not record your own head SHA in the file.
- Push; open a DRAFT PR to main linking the issue.
- After the push, post the "Developer handoff" PR comment
  (template in PHASE2-PROMPTS.md) with the exact pushed head SHA.
- STOP: AWAITING_INDEPENDENT_REVIEW. Do not review your own PR as
  Codex, merge, deploy or begin the next stage.

REPORT: stage, issue, branch, PR URL, exact head SHA, commands and
results, skipped checks, risks, owner decisions still needed.
```

## 2. Codex — independent reviewer (any stage)

Paste into a **fresh Codex session** after Claude has posted a developer handoff comment.

```text
ROLE: Independent reviewer, NOT an implementation author.
REPO: Harrisonxaph/catherdral-game
PR: [PR URL]

READ-ONLY REVIEW:
1. CORE CONTEXT: docs/arpg/PHASE2-LOOP.md, the PR metadata, its
   linked issue (#32-#36) and the latest developer handoff comment.
   Record the PR's CURRENT head SHA from GitHub; ignore any older
   SHA quoted in prompts or comments. Confirm base is main and the
   linked issue is the current stage per PHASE2-LOOP.md.
2. DUPLICATE CHECK: if a Codex review already covers this exact head
   SHA, do not re-review; reply only with a link to it. If the only
   change since the last reviewed head is PHASE2-STATUS.md or the PR
   text, post a short confirmation citing that review.
3. CRITERIA: the linked issue's Scope and Acceptance evidence, plus
   the matching "Stage invariants" row in PHASE2-PROMPTS.md. Do not
   use another stage's criteria.
4. TARGETED CONTEXT: every changed file, then the dependencies the
   diff affects (callers of modified functions, modules sharing the
   changed state, tests covering them, service-worker/build lists if
   runtime files changed). Check that tests would fail without the
   change and are not asserting the implementation's own mistakes.
5. EVIDENCE: label each claim
   VERIFIED (you executed it or observed a completed CI run),
   CLAIMED (stated by the developer, not checked) or
   NOT VERIFIED (could not check, with reason).
   Run relevant tests when the environment permits.
6. PRIORITIES: data loss, duplicated rewards, non-atomic writes,
   invalid item ownership, stale revisions/leases, unsafe migrations,
   RNG/world-digest drift, disabled safeguards, cooldown and
   simulation-time regressions, touch/Canvas/offline breakage,
   unapproved gameplay or balance changes.
7. FINDINGS: each with severity (BLOCKING / NONBLOCKING), file and
   line or diff location, evidence or reproduction, the violated
   criterion, and a specific recommended correction.
8. VERDICT: post the "Codex review" PR comment template in
   PHASE2-PROMPTS.md naming the exact reviewed head SHA. If the head
   changed while you reviewed, say so and review the new head.
   "No findings on reviewed head" is never "guaranteed correct" and
   never merge approval.
9. Stop. Do NOT edit, commit or push code, resolve threads on the
   developer's behalf, merge, deploy, start the next stage, write
   "OWNER APPROVAL:", or act as a second reviewer of your own work.
```

## 3. Claude Code — reviewer-driven correction (max three cycles per PR)

```text
ROLE: Claude Code developer correcting independent Codex findings.
REPO: Harrisonxaph/catherdral-game
PR: [PR URL]

1. CORE CONTEXT: the PR's current head SHA, its latest Codex review
   comment and threads, the stage entry in PHASE2-STATUS.md on the PR
   branch, and every developer handoff comment on the PR.
2. COUNT: correction cycles used = the count in PHASE2-STATUS.md;
   cross-check against "Correction N" handoff comments. If they
   differ, use the higher and report it. If already 3 -> STOP:
   BLOCKED. Never reset the count across sessions or branches.
3. VALIDITY: confirm the review names the current head SHA (or that
   findings still apply to it). Never overwrite newer commits.
4. ONE CYCLE:
   a. Root-cause each blocking finding against the issue criteria.
   b. Minimal safe fix plus a regression test failing before it.
   c. Re-run the relevant checks; record exact results.
   d. In the same commit, increment the cycle count by exactly one
      in PHASE2-STATUS.md and append the correction entry.
   e. Push to the SAME PR branch. Reply on each finding's thread.
   f. After the push, post a "Developer handoff - Correction N" PR
      comment with the exact new head SHA.
5. STOP: AWAITING_INDEPENDENT_REVIEW for a new Codex review of that
   head. Escalate after the third cycle or immediately for a
   save-safety or policy blocker. Never disable checks, merge,
   deploy or start the next stage.
```

## Stage invariants

Extra checks for developer and reviewer. They add to the live issue's acceptance criteria; they never replace or relax them.

| Stage | Must hold |
|---|---|
| PR1 #32 | Seeded RNG draw order unchanged (stable IDs consume no extra random values); all five floor layouts and all baseline graphics world digests unchanged; boss, guard, chest and encounter counts/positions preserved; IDs deterministic, bounded, non-colliding and scoped by area/instance; 100-seed-per-floor coverage; the literal `seed=(Math.random()*4294967296)>>>0` snippet that test hooks patch stays intact; Save/Continue not enabled |
| PR2 #33 | Pure module, no UI or combat wiring; each kill/chest/reward/first-clear ID applied at most once, including replay after restore; item ownership and escrow lossless with a full bag; invalid input fails without partial mutation; interrupted commits leave no half-applied state |
| PR3 #34 | Potion spend and heal commit together before the heal shows; cooldown reserved before the existing wind-up; reload cannot refund a potion, reset a cooldown or restore Aegis; repeated death IDs grant nothing; a failed critical save pauses with honest status and never calls `startGame`; all three abilities and simulation-time combat unchanged |
| PR4 #35 | Export bounded, labelled and schema-validated, including unsaved in-memory state; corrupt, future or unsupported records never replace a good save; failed recovery leaves storage unchanged; stale writers rejected; saved/unsaved/recovery-required states distinguishable; real-browser IndexedDB coverage |
| PR5 #36 | New Character never silently overwrites a save; Continue restores committed progress after refresh/close; death respawns at a checkpoint instead of resetting; legacy localStorage keys untouched; new runtime modules in the build and `APP_ASSETS` with a `CACHE_VERSION` bump; unperformed physical-device checks marked NOT VERIFIED; no deployment |

## Comment templates

Post these **after** the commit they describe exists. They are the authoritative record of exact SHAs and verdicts.

**Developer handoff** (Claude, after each push):

```md
**Developer handoff — P2 PRn (#issue) — Initial | Correction N of 3**
- Head SHA: `<full sha>` · Base: `main @ <sha>`
- Acceptance criteria → evidence: <criterion: test/result, …>
- Commands and results: <command: pass/fail/skipped counts>
- Not run / not verified: <item: reason>
- Correction cycles used: N / 3 (matches PHASE2-STATUS.md)
- Status: AWAITING_INDEPENDENT_REVIEW
```

**Codex review** (Codex, after reviewing one exact head):

```md
**Codex review — P2 PRn (#issue)**
- Reviewed head SHA: `<full sha>`
- Verdict: BLOCKING FINDINGS | NONBLOCKING ONLY | NO FINDINGS ON REVIEWED HEAD
- Blocking: <severity, location, evidence, correction>
- Nonblocking: <…>
- VERIFIED: <tests run, CI jobs observed and outcomes>
- CLAIMED / NOT VERIFIED: <…>
- Next action: <correction needed | ready for owner review>
```

**Owner approval** (owner only; agents never write this):

```md
OWNER APPROVAL: P2 PRn (#issue) — <what is approved: §10 decisions, starting the stage, or merge>
```

## 4. Owner — gates

- **Before a stage starts:** decide SPEC §10 (once, before PR1), then post an `OWNER APPROVAL:` comment on the stage's issue.
- **Before merging:** check the latest handoff and Codex review name the PR's current head SHA, inspect CI on that head and note device gaps, then merge manually. PR5 completion does not authorise production deployment or claim physical-device acceptance.

## Mobile workflow

1. Open the repository in the GitHub app or a browser; read [PHASE2-STATUS.md](PHASE2-STATUS.md) and the current issue.
2. In Claude Code connected to the repository, paste developer prompt 1 unchanged; it finds the stage and stops if approval is missing. A Claude chat without repository execution access cannot run tests or publish a PR.
3. When Claude posts the developer handoff comment, open a **separate Codex session** and paste reviewer prompt 2 with the PR URL.
4. Use the PR **Checks** tab for CI. Green means checks completed, not that phone performance or save durability was proven.
5. For blocking findings, paste prompt 3 into Claude. At most three correction cycles per PR, across all sessions.
6. Merge manually when ready; post `OWNER APPROVAL:` on the next issue to start the next stage.

**Limit:** these prompts enable reproducible handoffs, not unattended Claude/Codex orchestration. Neither assistant launches the other because this file exists.
