# VESPER decisions

PROJECT.md already records the existing game-design decisions and source
precedence; reuse that record rather than reconstructing a competing history.
Dates of earlier choices are not inferred from stage numbers.

## 2026-10-28 — graphics v2: Medium triangle headroom

- Decision (owner chose option 1 of 3): make quarter/half/cracked floor slab splits
  High-only, rather than raising the Medium triangle budget or squeezing later
  increments. Medium keeps border courses, sunken slabs and worn paths.
- Reason: increment 3 left about 4.2k triangles of Medium headroom against the
  +30% budget, too little for effects, characters and loot work.
- Result: tightest Medium scene 9.9k headroom (15–21k elsewhere); all 25 scenes
  within budget and readability floor. Alternatives not taken: raise Medium to
  +40% (more phone risk), or keep limits and constrain later increments.

## 2026-10-27 — experimental rolled bonus modifiers (pending review)

- Decision: add per-instance rolled modifiers (`mods` on the frozen item instance)
  rather than new item definitions or a new rarity tier. Weapons only; Legendary,
  shields and starting gear never roll. Rolls consume the injected `random` after
  the existing rarity/key draws, so rarity tables and boss once-only logic are reused.
- Reason: owner requested Diablo II-inspired variety without changing the 12 items,
  existing caps, inventory contracts or adding dependencies.
- Affected: `equipment.js`, `inventory-ui.js`, `inventory.css`, two display lines in
  `index.html`, `service-worker.js` cache version, tests.
- Not taken: defensive/shield modifiers, item-name prefixes/suffixes, floor-scaled
  values and a fourth "magic" rarity. These remain options for owner prioritisation.
- Overlap resolution (owner, 2026-10-27): PR #18 built the same feature with
  `modifiers:[{key,value}]` and one guaranteed bonus. Keep this PR's `mods` schema
  and balance model only; adapt #18's integration/offline tests; do not merge both.
- Consequence: more random draws per drop change later seeded outcomes within a
  run versus main (no fixed-seed gameplay contract exists). Balance is unplaytested.

## 2026-10-21 — shared assistant entry point

- Decision: retain detailed AGENTS.md as authoritative; add thin agent.md,
  CLAUDE.md, GEMINI.md and Copilot compatibility entry points.
- Reason: owner requested shared standards across coding assistants without
  duplicated or conflicting project rules.
- Affected: instructions, project memory, handover and PR validation only.
- Existing alternatives: no competing assistant entry points were present on
  audited main `31932ec`. No historical alternatives are asserted.

## 2026-10-21 — PR quality checks without application/deployment edits

- Decision: run existing Node and browser suites in a PR-only workflow, with
  read-only repository permissions and isolated Playwright tooling. Add stdlib
  documentation validation. Do not modify package.json or production code.
- Reason: the existing browser scripts require Playwright but do not declare it
  as an application dependency. Explicit BASE_URL avoids mixed script defaults.
- Affected: `.github/workflows/quality.yml`, `.github/scripts/check_agent_docs.py`.
- Alternative not taken: changing application dependencies for a workflow-only task.
- Hosted Actions success remains unverified until the PR check run finishes.

## 2026-10-28 — persistent ARPG direction; specification gate

- Owner direction: replace run-loss progression with a persistent single-player
  character/campaign, preserving existing combat, original content and mods schema.
- Authorised now: audit, conversion specification and six-phase roadmap before
  changing production gameplay. No implementation/merge/deployment approval implied.
- Proposed architecture: IndexedDB atomic revision snapshots, item ownership/ID
  validation, backups/migrations, durable reward and area ledgers, checkpoint resume.
  These choices and balance/resource rules await review in docs/arpg/SPEC.md.
- Verified integration risk: graphics #20–#26 merged into development targets;
  reviewed #26 head is not in main 3c7b762. Establish an explicitly approved
  integrated graphics baseline first; documentation does not perform that merge.
- Preserve earlier implementation history; a spec author's review is not an
  independent approval of their own implementation PR.

## 2026-10-28 — graphics baseline integrated before ARPG work

- Owner tested and merged PR #28; fetched main is `17c8fad`. Reviewed graphics
  head `1c4b4e9` is now included. The earlier integration risk above is resolved.
- PR #27 incorporates main, preserves graphics progress notes and updates G0.
- ARPG design and balance remain proposals awaiting approval; no save/gameplay
  implementation, production merge or deployment is part of this update.
