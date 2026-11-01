# VESPER task register

Verified against main `31932ec` on 2026-10-21. This register is not an approved
new feature roadmap. PROJECT.md remains the detailed implementation record.

## Completed milestones

- Five procedural floors, eight regular enemies, equipment/loot and three abilities.
- Three custom bosses, graphical overhaul and procedural boss presentation.
- Backpack icon and boss health follow-up: 2,500 / 2,500 / 4,000 HP.
- Root AGENTS.md and PROJECT.md handoff merged in PR #12.

## Current authorised task — persistent ARPG design, 2026-10-28

Create a complete conversion specification, verified reset/graphics audit and six
implementation phases on `development/arpg-conversion-spec`, updated against main
`17c8fad` after PR #28. Read [docs/arpg/SPEC.md](docs/arpg/SPEC.md),
[docs/arpg/AUDIT.md](docs/arpg/AUDIT.md) and
[docs/arpg/ROADMAP.md](docs/arpg/ROADMAP.md). Documentation only: no production
application, save wiring, merge or deployment. Await owner approval before code.

Gate G0 satisfied: owner tested and merged PR #28. Updated pinned main is
`17c8fadea6f881245384cec92fd14417b4a998c1`; PR #27 incorporates it and updates
its graphics audit. ARPG specification/milestone approval remains pending.

Next proposed milestone: test-only schema, item hydration/ID reservation and
IndexedDB revision repository; not Save/Continue yet. Then incremental Claude
implementation PRs independently reviewed by Codex. Numeric policies and future
features in the spec are proposals, not approved tasks. Device testing remains open.

2026-10-28 — owner request: start the architecture and persistent-character
foundation, then await approval for gameplay changes. Phase 1A is merged: PR #29
(`character-state.js`, `equipment.js` restore/reserve, fixture) and PR #30
(`save-store.js`, IndexedDB repository with real-browser tests); main `88da282`.
Neither is loaded by the game.

Current: Phase 1A follow-up on `development/arpg-save-store-strict-snapshot` for
Codex's post-merge finding on `6712d37` (non-JSON candidate values were normalised to
`null` instead of refused). Proposed next (awaiting approval): Phase 2 as small PRs —
1 reproducible floors with stable spawn/chest IDs (keep the current seeded draw order;
budget world digests must not change), 2 pure world/reward ledger, 3 command
coordinator (atomic potion spend+heal, cooldown reservation, death record, save-failure
pause), 4 emergency export and backup selection, 5 New/Continue and checkpoint respawn.
Phase 2 gameplay changes need owner approval of SPEC section 10 first.

## Phase 2 persistent loop setup — 2026-10-29 (planning, NOT code approval)

Prepared a branch/PR for the owner to review a five-PR development loop:
`docs/arpg/PHASE2-LOOP.md`, `docs/arpg/PHASE2-STATUS.md`, and
`docs/arpg/PHASE2-PROMPTS.md`. Work items are GitHub issues:
[#32](https://github.com/Harrisonxaph/catherdral-game/issues/32) stable
floor/spawn/chest identities; [#33](https://github.com/Harrisonxaph/catherdral-game/issues/33)
pure campaign/reward ledger; [#34](https://github.com/Harrisonxaph/catherdral-game/issues/34)
atomic potion/cooldown/death commands; [#35](https://github.com/Harrisonxaph/catherdral-game/issues/35)
emergency export and recovery; [#36](https://github.com/Harrisonxaph/catherdral-game/issues/36)
New/Continue and checkpoint integration.

Claude Code remains implementation developer; Codex independently reviews each
pushed PR and each correction. Limit to three reviewer-driven correction cycles
per PR, counted in PHASE2-STATUS.md; exact head SHAs and review verdicts are
posted as PR comments after each push, with existing GitHub CI evidence. One
reusable developer prompt selects the earliest open, authorised stage. The owner must
approve SPEC §10 defaults, each PR merge and the start of the next PR. These
coordination documents do not launch Claude or Codex automatically, approve
gameplay changes, merge PRs or deploy.

2026-10-31 — owner approved the SPEC §10 defaults and authorised P2 PR1 ([approval
record](https://github.com/Harrisonxaph/catherdral-game/issues/32#issuecomment-6549470246)).
P2 PR1 (#32) is implemented on `development/arpg-p2-pr1-stable-identities` as a draft
PR awaiting independent Codex review: stable, RNG-free spawn/chest/area identities with
generation pinned to main `ef177df` by a golden fixture. Merged by the owner as PR #38
(`0ab4890`).

2026-10-31 — owner authorised P2 PR2 ([approval record](https://github.com/Harrisonxaph/catherdral-game/issues/33#issuecomment-6549916332)).
P2 PR2 (#33) is a draft PR on `development/arpg-p2-pr2-world-ledger` awaiting independent
Codex review: pure `campaign-state.js` ledger plus area-instance fields in save schema 1.
Merged by the owner as PR #39 (`562f4e7`).

2026-10-31 — P2 PR3 (#34), [authorised](https://github.com/Harrisonxaph/catherdral-game/issues/34#issuecomment-6550265324)
once PR2 merged, is a draft PR on `development/arpg-p2-pr3-commands` awaiting independent
Codex review: `command-coordinator.js` commits potion, ability, death and ledger commands
before they take effect. Merged by the owner as PR #40 (`2e3d810`).

2026-10-31 — P2 PR4 (#35), [authorised](https://github.com/Harrisonxaph/catherdral-game/issues/35#issuecomment-6550268869)
once PR3 merged, is a draft PR on `development/arpg-p2-pr4-recovery` awaiting independent
Codex review: labelled, bounded and validated emergency export (including unsaved state),
export verification, recovery options and stale-choice-safe backup restore. Merged by the
owner as PR #41 (`258f67e`).

2026-11-01 — P2 PR5 (#36), [authorised](https://github.com/Harrisonxaph/catherdral-game/issues/36#issuecomment-6550272090)
once PR4 merged, is a draft PR on `development/arpg-p2-pr5-continue` awaiting independent
Codex review: New Character / Continue / checkpoint respawn wired into the game through
`game-session.js`. Physical-device checks remain NOT VERIFIED. Deployment needs separate owner approval.

## Previous graphics specification task

2026-10-27 — owner request: graphical overhaul v2 ("Ash and candlelight") on
`development/graphics-overhaul-v2`, based on main `387a900`. Increment 0 only:
visual specification, asset/licence inventory, implementation sequence and
performance-risk analysis in [docs/graphics-v2/SPEC.md](docs/graphics-v2/SPEC.md),
with baseline captures. Spec approved by the owner on 2026-10-27 with the default
decisions in SPEC.md section 9; increments 1–7 follow as one PR each, each based on
the previous branch. No merge or deployment.
Progress: increment 1 (tooling and budgets) in PR #20; increment 2 (light and value
pass) in PR #21; increment 3 (architecture and floor identities) in PR #22; increment 4 (effects)
in PR #23; increment 5 (characters) in PR #24; increment 6 (loot, icons, HUD) in PR #25;
increment 7 (camera, fade, culling) on `development/graphics-v2-camera` with the
final results in docs/graphics-v2/RESULTS.md. Next: owner review of PRs #19 to #26 in
order was completed; PR #28 subsequently integrated the complete stack into main.
The owner reports testing #28; detailed physical-device coverage remains unrecorded.

## Previous task — merged in PR #17

2026-10-27 — owner request: first experimental Diablo II-inspired loot enhancement
using original VESPER content, on `development/loot-modifiers` (PR for review, not
merged or deployed). Acceptance: 12 definitions/effects preserved; configurable
rolled damage/attack-speed/crit modifiers on new non-legendary equipment, carried
per instance; capped stat calculation; inventory display of bonuses and stat
differences; existing rarity tables, boss once-only rewards, atomic swaps, loadout
rules, pause, touch and offline behaviour preserved; seeded unit tests.
Merged to main as PR #17 (`387a900`). Outstanding: physical-device check and balance playtesting.

Overlap: PR #18 (`development/experimental-loot-modifiers`) implemented the same
feature with an incompatible schema. Owner decision 2026-10-27: keep PR #17 as the
development PR; #18's integration tests were adapted into it. #18 should be closed
unmerged by the owner; it must not be merged alongside #17.

The earlier shared assistant workflow task (`development/shared-agent-workflow`)
has been merged.

## Open work and unverified issues

At audit, PR #11 is an unmerged preview/offline-assets branch; PR #3 targets an
older development branch from main. Inspect their current diffs and owner intent
before using either; do not merge them as part of this task. Their titles alone
do not establish a current production defect.

The existing PROJECT.md records physical-device testing and professional external
art as outstanding. No new bugs or priorities are asserted here. Browser-test
Playwright remains intentionally provisioned outside application dependencies.

## Recommended next actions (owner prioritisation required)

- Review/merge the shared workflow PR; then verify each assistant's loaded context.
- Review the old open PRs separately and record the owner's disposition.
- Follow PROJECT.md's device acceptance/performance and optional art/narrative
  considerations. No asset purchase, gameplay expansion or production deployment
  is authorised by this task register.

For each new task, record owner/request, acceptance criteria, branch, pushed commit,
PR, exact checks/results, blockers and next action using docs/AGENT-WORKFLOW.md.
