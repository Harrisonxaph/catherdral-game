# ARPG conversion audit — 2026-10-28

Status: verified baseline and design input, **not gameplay implementation**.
Read with [SPEC.md](SPEC.md) and [ROADMAP.md](ROADMAP.md).

## Repository and graphics integration

Updated default-main baseline: `17c8fadea6f881245384cec92fd14417b4a998c1`
(merged PR #28, 2026-10-28). PR #27 now incorporates this main via a merge,
preserving graphics documentation and changing no production application files
relative to main. The owner reports testing and merging #28; device/browser
coverage of that user test was not specified. PR #27 remains open for design review.
Root AGENTS.md, PROJECT.md, TASKS.md, DECISIONS.md and docs/AGENT-WORKFLOW.md read.
The original source/reset audit below was performed against pre-integration main
`3c7b762`; line numbers are historical locators, so use named functions on the
updated baseline. Graphics integration changes presentation, not those lifecycle
contracts. The table records the original stack targets, not an outstanding merge.

**Merged PR does not necessarily mean merged into main.** GitHub reports:

| PR | Scope | State | Actual target branch | Reviewed head |
| --- | --- | --- | --- | --- |
| #19 | Graphics v2 specification | Merged | main | 1ccf7be |
| #20 | Capture tooling/budgets | Merged | development/graphics-overhaul-v2 | 3aa10eb |
| #21 | Lighting | Merged | development/graphics-v2-tooling | 25b05c6 |
| #22 | Architecture | Merged | development/graphics-v2-lighting | af85c9a |
| #23 | Effects | Merged | development/graphics-v2-architecture | 1356b03 |
| #24 | Characters | Merged | development/graphics-v2-effects | 394a026 |
| #25 | Loot/HUD | Merged | development/graphics-v2-characters | 1b7e2c6 |
| #26 | Camera/cutaway | Merged | development/graphics-v2-loot-hud | 1c4b4e9 |

PR #28 integrated merge #26 `2720819cd716335ca73e853388ec5526de7117da`
into main. Reviewed graphics head `1c4b4e955153ffb0af197fd76ecb188db030ee82`
is now an ancestor of main. Main's tree equals reviewed graphics tree
`10a038f1ffe4ba4e99e02c79c443886f274f34a7`. Cache v19-r2, VesperVFX,
nine browser scripts and fresh scene-budget CI are included. Gate G0 is satisfied
for this pinned baseline; recheck main and open PRs before implementation.
This documentation update does not merge or deploy anything or approve ARPG code.
Do not use PR #18's incompatible `modifiers` format: PR #17's `mods` is in main.

## Architecture and reuse

Static HTML/CSS/vanilla JS, vendored Three.js 0.180.0, Canvas fallback; no backend
or bundler. `scripts/build.mjs` copies runtime assets to dist and checks references.
Pure IIFE modules expose CommonJS for Node tests and window.Vesper* for browsers;
art/renderer modules are ES modules. Simulation time/pause, adapter APIs and
render({world,player,...}) are established boundaries. Keep these boundaries.

| Existing location | Verified responsibility / dependency to replace or adapt |
| --- | --- |
| index.html:145–167 | localStorage best/preferences helper swallows write errors; run globals hold level, XP, ash, floor, kills; shared mutable RNG is reseeded |
| index.html:newFloor (222–254) | always reseeds/rebuilds geometry and spawns; deletes enemies, loot, chest state, exploration, hazards and encounter state; must become create/restore-area adapters |
| index.html:startGame (256) | resets level=1, XP, ash, all stats, abilities, starter gear and potions; currently also retry callback |
| index.html:killEnemy / dropLoot | awards XP/ash/items on death, skips minion farming; has no durable event ID or transaction |
| index.html:checkEncounter | completion/reward booleans exist only on an ephemeral floor encounter; floor-N ID is not a durable campaign/replay reward namespace |
| index.html:powers / upgrade / gainLevel (295–311) | random three-choice blessings directly multiply/mutate player stats; no allocation ledger or permanent skill points |
| index.html:die (312) | records only best kills plus narrative death; clears abilities; retry recreates character |
| index.html:nextFloor (313) | one-way 1..5 descent, kill/final/crown gates, healing/potion refill; floor 5 ends run; no return travel or hub |
| index.html:tick / updateHUD / minimap | auto ash/potion pickup, chest rewards, XP-level triggers, temporary visited grid and descend UI assume a run |
| index.html:start/retry/quit / boot (486–489) | no Continue; boot constructs a new preview world; Quit does not save a character; refresh recreates it |
| index.html:visibilitychange (478) | pauses/cancels cast/clears input; no durability flush; no close-time save guarantee |
| equipment.js:item / serial (38–39) | module-local numeric ownership counter restarts on reload; no hydration/reservation API; IDs must not collide with saved bag/stash/ground/escrow |
| equipment.js:createRun / valid / transaction | six bag slots, two hands, three potions; atomic in-memory swaps and per-run uniqueness only; reuse rather than rewrite |
| equipment.js:stats / affixes / roll | 12 definitions and frozen mods:[{stat,value}], configured weighted drops and caps; keep formulas/tables; injected RNG already supported |
| equipment.js:encounterReward | once per in-memory boss encounter, not once per persistent campaign/instance |
| inventory-ui.js:create(adapter) | mutates in-memory run via E.*; safe ground drop is checked first; add durable command boundary without changing tap controls/pause/focus |
| narrative.js:save / persist | vesperNarrative:v1 stores device-wide death count, flags and journal entries; not an equipped-character/campaign save |
| narrative.js:setup / use / canLeave | run.keeper/crown/seal reset on setup; journal can remember a prior life while exit still requires this life's crown; crown object follows boss death event |
| narrative.js:run-start / floor-left / player-died | events and wording assume recurring lives, one-way Chapter I and run ending; preserve authored text as history, explicitly adapt lifecycle/quest truth |
| boss-system.js:reset / defeat / sequence | boss, candles, axes, turn, clock and cinematic state are ephemeral; no encounter snapshot or durable completion hook |
| enemy-system.js:create / runtime.reset | regular actors lack durable spawn IDs; hazards/projectiles/minions reset; add external stable spawn IDs and area manifests, do not serialize object references |
| abilities.js:reset / cast / cooldowns / barrier | save remaining cooldown state through an adapter; cancel pending casts on load, omit transient barrier; keep absorption order and protected boss/stun rules |
| floors.js:generate(config,random) | layouts can use injected seeds; world returns functions/typed arrays unsuitable for raw JSON; version layouts or persist walk-grid/room descriptors |
| graphics.js / castle-view.js / art modules | presentation, caches, object identity, quality settings; never write save data from rendering; rebuild derived models on restore |
| service-worker.js | app-shell Cache Storage only; does not persist a character; navigation can load newer HTML with older cached JS during an update |
| chapter.test.cjs / browser suites | explicitly assert run reset, one-way ending, event names and literal HTML hooks; replace only lifecycle expectations with new tests, retain combat regressions |
| docs/history / title/death/journal/install copy | old run/best-score/refresh claims must be revised with new semantics; preserve historical reports as history |

Other preserved contracts: guardian shield absorbs the whole breaking hit; Aegis
then equipment shield then HP after mitigation; cooldowns freeze with simulation;
no refill on equipment/inventory toggles; boss protected attacks survive stun;
minions give no rewards; boss hazards clear on defeat. Floors 1/3/5 have bosses,
2/4 elites; Floor 1 crown gate is required; deeper narrative is not yet authored.

## Existing persistent data and absent features

Present: vesperBest (best kills), vesperNarrative:v1 (memories/journal/flags),
vesperGraphics (quality). No existing character DB, saved run equipment, stash,
skill tree, checkpoint travel or Sanctuary was found. Existing equipment exists
only in RAM; refresh-lost gear/XP cannot be reconstructed from a best score.
The Forgotten Knight is an existing narrative NPC; a new hub presence requires
new original dialogue, without deleting his Crypt interaction.

## Verified checks for this documentation baseline

Original pre-integration checks (historical): `npm test` **69/69 passed**. `npm run build`: passed,
32 declared runtime resources verified. Shared documentation checker, all five
validator tests, Markdown fences/local links and `git diff --check` passed.
A fresh independent design reviewer identified and then confirmed fixes for
Phase 2 world/reward durability prerequisites, early emergency export/recovery,
and atomic potion spend/heal. Ability cooldown reservation is also explicit.
This is a design check, not approval of unimplemented gameplay. No browser suite is claimed re-run for documentation.
Graphics-stack review results are historical evidence, not a new device pass.
No live Vercel configuration, production deployment or real-device performance
was inspected/changed. Browser storage guarantees must be verified in Phase 1,
not assumed from a proposed schema.

### PR #27 refresh after PR #28

On the updated main-derived branch: `npm test` passed **82/82**, `npm run build`
verified **33** declared resources, shared-document validation and diff whitespace
checks passed. No browser suite was rerun for this documentation-only refresh.
The PR diff against main contains only six Markdown documents; runtime files
match main. Owner testing of #28 is reported separately above.
