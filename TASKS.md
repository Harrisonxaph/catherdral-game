# VESPER task register

Verified against main `31932ec` on 2026-10-21. This register is not an approved
new feature roadmap. PROJECT.md remains the detailed implementation record.

## Completed milestones

- Five procedural floors, eight regular enemies, equipment/loot and three abilities.
- Three custom bosses, graphical overhaul and procedural boss presentation.
- Backpack icon and boss health follow-up: 2,500 / 2,500 / 4,000 HP.
- Root AGENTS.md and PROJECT.md handoff merged in PR #12.

## Current authorised task

2026-10-27 — owner request: graphical overhaul v2 ("Ash and candlelight") on
`development/graphics-overhaul-v2`, based on main `387a900`. Increment 0 only:
visual specification, asset/licence inventory, implementation sequence and
performance-risk analysis in [docs/graphics-v2/SPEC.md](docs/graphics-v2/SPEC.md),
with baseline captures. Spec approved by the owner on 2026-10-27 with the default
decisions in SPEC.md section 9; increments 1–7 follow as one PR each, each based on
the previous branch. No merge or deployment.
Progress: increment 1 (tooling and budgets) in PR #20; increment 2 (light and value
pass) in PR #21; increment 3 (architecture and floor identities) in PR #22; increment 4 (effects)
in PR #23; increment 5 (characters) on `development/graphics-v2-characters`. Next:
increment 6, loot, inventory icons and HUD.

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
