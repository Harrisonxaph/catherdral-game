# Phase 2 persistent loop — current state and handover ledger

This file is the **cross-session coordination record** for milestones, approvals, correction-cycle counts and history. It is not a substitute for reading GitHub PRs, actual code or CI. Claude updates it inside its development PRs; Codex reviews exact pushed heads and must not change implementation during its independent review. Owner approval must come from an approval record (see [PHASE2-LOOP.md](PHASE2-LOOP.md#approval-evidence)), not be inferred from an issue, an AI statement or this template.

**Exact SHAs:** a tracked file cannot hold the SHA of the commit that contains its own final update. Exact pushed head SHAs and reviewer verdicts are therefore recorded in **PR comments** (developer handoff and Codex review templates in [PHASE2-PROMPTS.md](PHASE2-PROMPTS.md#comment-templates)). This file records base SHAs, PR URLs, statuses, counts and, in the next stage's first commit, the previous stage's merge commit. Never commit only to record a SHA. If an issue body asks for SHAs here, PHASE2-LOOP.md takes precedence.

## State snapshot — setup on 2026-10-29

- Repository: `Harrisonxaph/catherdral-game`
- Main at setup: `152f5178808f3e59c458ce1bc20320c09ae0eeff` (PR #31 merged). **Re-fetch main before every new phase.**
- Open PRs at setup: none observed.
- Phase 1A: PRs #29, #30, #31 merged. Save modules exist but are **not loaded by the game**; this is NOT a playable Save/Continue feature.
- Current stage: `P2_PR1` (planning/preparation only).
- Development status: `NEEDS_OWNER_APPROVAL` for `docs/arpg/SPEC.md` §10 policy choices, before Phase 2 gameplay implementation.
- Developer: Claude Code (separate implementation session).
- Reviewer: Codex (fresh independent review session, no implementation on same PR).
- Correction budget: **three reviewer-driven fix cycles per PR** after initial implementation, counted here and never reset across sessions.
- Deployment: **not authorised**. Automatic merging: **not authorised**.
- Orchestration: manual agent handoffs; no unattended Claude/Codex runner connected by these files.

## Owner design/policy gate

Record dated, explicit approval of the Phase 2 design and any deviations here *before* coding gameplay. The issue tickets and this loop setup are planning approval only. **Only the owner ticks these boxes** (by an owner commit), or links an `OWNER APPROVAL:` comment below; agents never tick them.

- [ ] Owner approves or revises `SPEC.md` §10 architecture, checkpoint and Continue approach.
- [ ] Owner approves or revises no-death-penalty and persistent resource/cooldown policies.
- [ ] Owner approves or revises one-character-slot, campaign/replay reset and legacy memory rules.
- [ ] Owner records treatment of proposed progression numbers (level cap, XP/stat growth, points) and stash/blacksmith defaults, even if implementation is deferred to later phases.
- [ ] Owner expressly authorises implementation of P2 PR1 (#32) after these decisions.
- [ ] Owner expressly authorises PR2–PR5 individually after acceptance/merge of the preceding PR.

Approval source (link to actual owner decision/PR comment): **NOT RECORDED**.
Policy deviations/approved decisions: **NONE RECORDED**.
Do not replace this with an AI assumption.

## Sequential work queue

| Step | Issue | Status | Base SHA | PR URL (head SHAs and verdicts in its comments) | Fix cycles | Merge commit | Owner decision |
|---|---|---|---|---|---|---|---|
| P2 PR1 | [#32](https://github.com/Harrisonxaph/catherdral-game/issues/32) | AWAITING_INDEPENDENT_REVIEW | `ef177df` | draft PR linked from #32 | 0 / 3 | — | authorised ([approval](https://github.com/Harrisonxaph/catherdral-game/issues/32#issuecomment-6549470246)); merge pending |
| P2 PR2 | [#33](https://github.com/Harrisonxaph/catherdral-game/issues/33) | WAITING_FOR_PR1 | unset | none | 0 / 3 | — | pending |
| P2 PR3 | [#34](https://github.com/Harrisonxaph/catherdral-game/issues/34) | WAITING_FOR_PR2 | unset | none | 0 / 3 | — | pending |
| P2 PR4 | [#35](https://github.com/Harrisonxaph/catherdral-game/issues/35) | WAITING_FOR_PR3 | unset | none | 0 / 3 | — | pending |
| P2 PR5 | [#36](https://github.com/Harrisonxaph/catherdral-game/issues/36) | WAITING_FOR_PR4 | unset | none | 0 / 3 | — | pending |

Update this table inside the commits that open, correct or block a stage. Record a stage's merge commit in the next stage's first commit. Do not mark a step merged on review success alone.

## Per-PR append-only handover format

Copy the following section under this heading **for each new PR and each review correction**, in the same commit as that work, keeping earlier attempts as history. The exact head SHA is posted afterwards in the PR's developer handoff comment, not here.

```md
### YYYY-MM-DD — P2 PRn — initial implementation / correction 1 / correction 2 / correction 3
- Issue:
- Approval source and scope:
- Developer: Claude Code
- Reviewer: independent Codex session
- Base branch + exact SHA:
- Feature branch:
- PR URL (exact head SHAs: developer handoff comments):
- Change summary + files:
- Acceptance criteria verified (evidence):
- Local commands executed + actual results:
- CI URL, job status and whether completed:
- Browser / physical device tests actually performed:
- Reviewer findings addressed (link to the Codex review comment, which names its reviewed SHA):
- Correction cycles consumed (0..3; never reset across sessions):
- Open blockers / risk of data loss:
- Rollback approach:
- Status: IN_DEVELOPMENT / AWAITING_REVIEW / FIX_REQUIRED / BLOCKED /
          NEEDS_OWNER_APPROVAL / READY_FOR_OWNER_REVIEW / MERGED_BY_OWNER
- Owner merge decision source, if any:
- Next action / next approval required:
```

### 2026-10-31 — P2 PR1 — initial implementation
- Issue: [#32](https://github.com/Harrisonxaph/catherdral-game/issues/32).
- Approval source and scope: [`OWNER APPROVAL: P2 PR1 (#32)`](https://github.com/Harrisonxaph/catherdral-game/issues/32#issuecomment-6549470246) (2026-10-31): approves the SPEC §10 defaults listed there and authorises PR1 within #32's scope. Each merge, later stage, scope expansion and deployment remain owner decisions. The gate boxes above are the owner's to tick.
- Developer: Claude Code. Reviewer: independent Codex session (pending).
- Base: `main @ ef177df605d9a19d02c1e1c2466062c82af0d4bd`. Feature branch: `development/arpg-p2-pr1-stable-identities`.
- PR URL and exact head SHAs: the draft PR linked from #32 and its developer handoff comments.
- Change summary: `floors.js` gains pure, RNG-free `instanceId`, `entityId`, `layoutHash`, `locations` and `GENERATOR_VERSION`; `index.html` captures the floor seed right after `reseed()` and, after population, assigns `spawnId` to every initial enemy and `chestId` to every chest, building a frozen in-memory `areaManifest`. Nothing is saved yet. Cache bumped to `v21-arpg-p2-identities`.
- Acceptance evidence: `area-identity.test.cjs` compares every floor × seeds 1–100 (and the graphics seed) against a golden fixture generated from `ef177df`; it checks layout, entity types/positions/HP, chests, traps, torches and the RNG state after population (draw order). IDs are unique across 500 instances, storable under the save schema's ID rule, reproduced in fresh games, and summons get none. Local results are in the developer handoff comment.
- Correction cycles consumed: 0 / 3.
- Open blockers / data-loss risk: none known; no save path is wired.
- Rollback: revert the PR; no stored data exists.
- Status: AWAITING_INDEPENDENT_REVIEW.
- Next action: independent Codex review of the PR's current head; owner decides merge.

## Setup event — 2026-10-29

- Created five ordered tracking issues (#32–#36) based on the existing `TASKS.md` PR sequence.
- Prepared role-separated prompts and bounded iteration policy on the dedicated setup branch.
- No gameplay modules, CI workflow settings, secrets, automatic agent launches or production configuration changed by the intended setup.
- This is a documentation-only setup, not a claim that P2 PR1–PR5 have been implemented or reviewed.

## Workflow revision — 2026-10-29 (PR #37 update)

- The developer prompt is now reusable for all five stages: it selects the earliest open, unmerged, authorised issue in #32–#36 and resumes an existing PR instead of starting a new one.
- Exact head SHAs and reviewer verdicts moved from this file to PR comments, because a tracked file cannot contain its own commit's SHA; this file keeps milestones, approvals, counts and history. Merge commits are recorded in the next stage's first commit.
- Approval evidence is defined in PHASE2-LOOP.md: agents post under the owner's account, so only an `OWNER APPROVAL:` comment without an AI footer, or an owner commit ticking the gates, counts.
- Two-level context strategy and duplicate-review rule added. Stage order, the three-cycle budget, role separation and all safety rules are unchanged. No stage has started; P2 PR1 remains `NEEDS_OWNER_APPROVAL`.
