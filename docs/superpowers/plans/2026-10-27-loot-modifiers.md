# Loot modifiers implementation plan

Goal: modest individual weapon rolls without replacing existing inventory rules.
Architecture: optional per-instance data, pure resolver and existing loot/UI paths.
Tech stack: vanilla JS, Node test runner, existing Playwright tooling.
Spec: [design](../specs/2026-10-27-loot-modifiers-design.md).

Global constraints: preserve all 12 definitions/effects, tables, transactions,
abilities, controls, pauses, offline support; no dependencies or production changes.
Review focus: legacy objects, malformed modifiers, weighted off-hand damage,
failed capacity swaps, and UI/cooldown state across drop/recollect.

- [x] Establish baseline unit/build and inventory-browser results.
- [x] Add failing equipment tests for eligibility, seeded drops, caps, transactions,
  definition preservation and additive loadouts; add UI assertions before UI edits.
- [x] Implement frozen modifier config, generation, sanitized resolver and stat use
  in equipment.js; keep definition() and item() backward compatible.
- [x] Update inventory-ui.js rolled description and frequency/crit deltas; bump cache.
- [x] Run complete unit/build, browser regression and offline checks; review diff.
- [x] Update PROJECT/TASKS/DECISIONS with assumptions, actual results and limitations.
- [ ] Commit/publish branch, open review PR; never merge or deploy.
