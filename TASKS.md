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
foundation, then await approval for gameplay changes. Phase 1A part 1 on
`development/arpg-character-foundation` (stacked on PR #27): `character-state.js`,
`equipment.js` restore/reserve, `character-state.test.cjs` and the fixture
`tests/fixtures/save-v1-full.json`. Not wired into the game. Next: part 2, the
IndexedDB repository with real-browser tests (`save-store.js`, branch
`development/arpg-save-store`, stacked on part 1). Phase 2 (New/Continue, permanent XP,
checkpoint respawn) changes gameplay and needs owner approval first.

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
