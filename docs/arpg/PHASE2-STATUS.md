# Phase 2 persistent loop — current state and handover ledger

This file is the **cross-session coordination record**, not a substitute for reading GitHub PRs, actual code or CI. Claude updates it on its development PRs; Codex reviews exact pushed heads and must not change implementation during its independent review. Owner approval must be recorded from an actual owner decision, not inferred from an issue, an AI statement or this template.

## State snapshot — setup on 2026-10-29

- Repository: `Harrisonxaph/catherdral-game`
- Main at setup: `152f5178808f3e59c458ce1bc20320c09ae0eeff` (PR #31 merged). **Re-fetch main before every new phase.**
- Open PRs at setup: none observed.
- Phase 1A: PRs #29, #30, #31 merged. Save modules exist but are **not loaded by the game**; this is NOT a playable Save/Continue feature.
- Current stage: `P2_PR1` (planning/preparation only).
- Development status: `NEEDS_OWNER_APPROVAL` for `docs/arpg/SPEC.md` §10 policy choices, before Phase 2 gameplay implementation.
- Developer: Claude Code (separate implementation session).
- Reviewer: Codex (fresh independent review session, no implementation on same PR).
- Correction budget: **three reviewer-driven fix cycles per PR** after initial implementation.
- Deployment: **not authorised**. Automatic merging: **not authorised**.
- Orchestration: manual agent handoffs; no unattended Claude/Codex runner connected by these files.

## Owner design/policy gate

Record dated, explicit approval of the Phase 2 design and any deviations here *before* coding gameplay. The issue tickets and this loop setup are planning approval only.

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

| Step | Issue | Status | Base/head SHA | PR URL | Fix cycles | Reviewer finding / CI | Owner decision |
|---|---|---|---|---|---|---|---|
| P2 PR1 | [#32](https://github.com/Harrisonxaph/catherdral-game/issues/32) | NEEDS_OWNER_APPROVAL | unset | none | 0 / 3 | not started | pending |
| P2 PR2 | [#33](https://github.com/Harrisonxaph/catherdral-game/issues/33) | WAITING_FOR_PR1 | unset | none | 0 / 3 | not started | pending |
| P2 PR3 | [#34](https://github.com/Harrisonxaph/catherdral-game/issues/34) | WAITING_FOR_PR2 | unset | none | 0 / 3 | not started | pending |
| P2 PR4 | [#35](https://github.com/Harrisonxaph/catherdral-game/issues/35) | WAITING_FOR_PR3 | unset | none | 0 / 3 | not started | pending |
| P2 PR5 | [#36](https://github.com/Harrisonxaph/catherdral-game/issues/36) | WAITING_FOR_PR4 | unset | none | 0 / 3 | not started | pending |

Update this table whenever a PR is opened, checked, reviewed, fixed, merged or blocked. Do not mark a step merged on review success alone.

## Per-PR append-only handover format

Copy the following section under this heading **for each new PR and each review correction**, keeping earlier attempts as history.

```md
### YYYY-MM-DD — P2 PRn — initial implementation / correction 1 / correction 2 / correction 3
- Issue:
- Approval source and scope:
- Developer: Claude Code
- Reviewer: independent Codex session
- Base branch + exact SHA:
- Feature branch + exact pushed head SHA:
- PR URL / diff:
- Change summary + files:
- Acceptance criteria verified (evidence):
- Local commands executed + actual results:
- CI URL, job status and whether completed:
- Browser / physical device tests actually performed:
- Reviewer findings (severity, location, reproduction):
- Reviewer assessed head SHA:
- Correction cycles consumed (0..3; never reset across sessions):
- Open blockers / risk of data loss:
- Rollback approach:
- Status: IN_DEVELOPMENT / AWAITING_REVIEW / FIX_REQUIRED / BLOCKED /
          NEEDS_OWNER_APPROVAL / READY_FOR_OWNER_REVIEW / MERGED_BY_OWNER
- Owner merge decision source, if any:
- Next action / next approval required:
```

## Setup event — 2026-10-29

- Created five ordered tracking issues (#32–#36) based on the existing `TASKS.md` PR sequence.
- Prepared role-separated prompts and bounded iteration policy on the dedicated setup branch.
- No gameplay modules, CI workflow settings, secrets, automatic agent launches or production configuration changed by the intended setup.
- This is a documentation-only setup, not a claim that P2 PR1–PR5 have been implemented or reviewed.
