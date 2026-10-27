# VESPER task register

Original baseline: main `31932ec` on 2026-10-21; latest loot audit: main
`d391208` on 2026-10-27. This register is not an approved new feature roadmap. PROJECT.md remains the detailed implementation record.

## Completed milestones

- Five procedural floors, eight regular enemies, equipment/loot and three abilities.
- Three custom bosses, graphical overhaul and procedural boss presentation.
- Backpack icon and boss health follow-up: 2,500 / 2,500 / 4,000 HP.
- Root AGENTS.md and PROJECT.md handoff merged in PR #12.

## Current authorised task — 2026-10-27

First experimental weapon modifiers on `development/experimental-loot-modifiers`,
based on main `d391208`. Preserve existing 12 items/effects, tables, boss rewards,
atomic inventory rules, abilities, pauses, mobile input, renderers and offline.
Implement optional instance rolls, shared stat calculation and inventory deltas;
validate and deliver a review PR, with no merge/deploy. See
[feature guide](docs/LOOT-MODIFIERS.md) for exact balance and device checklist.

Implementation is pending review. Device acceptance/playtest remains outstanding;
no further modifier expansion or balance change is automatically authorised.
The shared workflow is now merged (PR #13); main also contains the static build
and preview/offline fixes (PR #15) and build documentation (PR #16).
No open PRs were found in the fresh 2026-10-27 audit before this branch.

## Historical open-work audit — 2026-10-21

At audit, PR #11 is an unmerged preview/offline-assets branch; PR #3 targets an
older development branch from main. Inspect their current diffs and owner intent
before using either; do not merge them as part of this task. Their titles alone
do not establish a current production defect.

The existing PROJECT.md records physical-device testing and professional external
art as outstanding. No new bugs or priorities are asserted here. Browser-test
Playwright remains intentionally provisioned outside application dependencies.

## Recommended next actions (owner prioritisation required)

- Review the loot experiment PR and perform the device checklist; verify each assistant's loaded context.
- Review the old open PRs separately and record the owner's disposition.
- Follow PROJECT.md's device acceptance/performance and optional art/narrative
  considerations. Beyond the current loot experiment, no asset purchase, gameplay expansion or
  production deployment is authorised by this task register.

For each new task, record owner/request, acceptance criteria, branch, pushed commit,
PR, exact checks/results, blockers and next action using docs/AGENT-WORKFLOW.md.

## Loot experiment validation/handover — 2026-10-27

Implemented; ready for review after publication. Local npm test 68/68, build and
all seven browser suites passed; five documentation-validator tests and link/
syntax/diff checks passed. See docs/LOOT-MODIFIERS.md for limits and device steps.
No remaining automated failure is known. Manual iPhone Safari/Android Chrome
acceptance and longer balance playtesting are outstanding. The PR description
records the exact pushed commit/branch and actual hosted check status; do not
assume a future assistant can access an unpublished local commit.
