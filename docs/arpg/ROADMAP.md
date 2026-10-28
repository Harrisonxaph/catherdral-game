# Six-phase ARPG conversion roadmap

**Proposed, awaiting owner approval.** Scope and invariants:
[SPEC.md](SPEC.md); verified integration/reset inventory: [AUDIT.md](AUDIT.md).
No phase is authorised by this document alone. Use small development branches/PRs,
never one large conversion. G0 (owner-approved graphics integration and pinned
main SHA) precedes implementation. Claude implements; Codex reviews actual PRs
independently before owner decides to merge. No deployment/purchase permission.

## Recommended smallest first milestone — Phase 1A

After spec/G0 approval, add **pure character DTO validation + numeric item-ID
hydration/reservation + a native IndexedDB revision repository**, exercised through
tests only. No script tags, title/Continue button, death/level/travel changes or
renderer imports. No automatic read/migration/write of existing player data.
Test schema 1 with synthetic fixtures; use a synthetic schema 1→2 migration fixture
to validate migration machinery, not an invented historical released schema.

Reviewable deliverable: two or three small PRs for schema/hydration, storage/
backups/concurrency, then real-browser repository tests. This is the persistent
character foundation, **not a claim the game has Save/Continue yet**. It should
merge only after independent review; dead-code concerns are resolved by keeping
it a clearly bounded foundation until Phase 2 wires it in. If not approving unused
foundation modules on main, retain them on the development branch until Phase 2.

## Phase 1 — Persistent character foundation (no gameplay wiring)

Files proposed: character-state.js, save-store.js, tests/fixtures/save-v1-*.json,
character-state.test.cjs, save-store.test.cjs, tests/save-store-browser.cjs; minimal
equipment.js hydration/reservation extension if needed. No dependencies. Node
storage contract tests use an injected adapter; browser tests exercise real IDB.

Acceptance:
- Versioned DTO round-trips all 12 item types and existing mods without changing
  their ID, value or passive; derived stats are recomputed once.
- Item ownership graph spans both hands, six bag slots, stash, ground and escrow;
  invalid mods/loadouts/duplicates/orphans reject the candidate, not erase items.
- After hydrating IDs up to N, the next generated ID is >= durable nextItemId > N.
- Compare-and-swap revision + fenced writer lease; no partial commits; previous
  backups survive failed writes. Unsupported versions cannot overwrite records.
- Pure migrations validate before/after and retain a pre-migration backup.
- Running the normal game does not create/open this DB or change existing data.

Deterministic tests: serialize/hydrate/serialize equality; seeded generated item
fixtures; full bag and two-hand atomic failures; duplicate IDs across stash/ground;
malformed numeric fields and size limits; transaction abort at each write boundary;
quota/denial error contract; invalid latest/good backup recovery; migration repeated
and interrupted; stale tab CAS/lease rejection. Actual IDB tests close/reopen,
abort a real transaction and verify latest/backup/metadata consistency. Report
injected-failure tests separately from physical OS-kill and actual quota tests.

## Phase 2 — New/Continue, permanent XP and checkpoint respawn

Files: controller and minimal index.html lifecycle/save-status adapters;
character progression rules; ability snapshot/restore adapter; narrative bridge;
minimum campaign-state manifests/reward ledger and create/restore-area adapters.
These must cover the existing linear five-floor campaign before persistent mode
is enabled: layouts/spawn IDs, killed/chest/ground/quest state, atomic rewards and
first-clear progression. Phase 3 extends this foundation with revisits and hub
travel; durable ownership cannot be deferred until then.
Introduce explicit new character (never overwrite silently), Continue and safe
checkpoint resume at Crypt entrance. XP/levels, ash, inventory and resources are
character-owned; deterministic base level growth and unspent skill-point grants
replace random blessing selection. Spending UI follows in Phase 4. No classes.

Acceptance:
- Refresh, death/retry and Quit/Continue preserve committed XP/gear/mods/ash/points.
  Respawn uses last safe checkpoint, not startGame; new character is distinct.
- Death never deletes progression, gear or currency; repeated death command grants
  no new items, potions or points. All three abilities remain available and fixed.
- Minimal validated emergency export of in-memory state and prior-good backup
  recovery selection exist before persistent play; full import tooling follows
  in Phase 6.
- Potion spend/heal and ability cooldown reservation are critical transactions;
  reload cannot restore an acknowledged potion or ready ability.
- Autosave status is honest; failed critical saves pause for recovery. Periodic
  noncritical snapshots and background flush work within documented limitations.
- Snapshot loading never restores Aegis, refills gear shields or clears cooldowns.
- Legacy narrative/best/graphics migration uses actual old data only; no invented
  equipment recovery. Migration marker writes atomically; old keys remain intact.
- New runtime modules registered in build and APP_ASSETS; version bump from the
  then-current graphics worker, not stale v12. Save-aware update flow tested.

Tests: durable create/continue/reload; repeated death; XP multi-level overflow and
point ledger idempotence; potion spend/heal atomicity and activation cooldown
reservation under abort/retry/repeated tap; potion amounts; equipment/passive/ability damage parity;
queued saves and failure UI; reload with cooldowns/Aegis; visibility/pagehide and
unannounced context closure after acknowledged commit; old/new service worker
compatibility; deny storage and verify no fake Saved/Continue state.

## Phase 3 — Persistent five-area campaign and playable Sanctuary

Extend Phase 2 campaign-state.js and controller/floor/narrative/boss lifecycle
adapters, plus
small original Sanctuary definitions. Reuse current generation/layout/rendering;
no combat rewrite or copied external hub assets. Support initial seed/layout
creation, revisits, first-clear unlocks, permanent boss completion, shrines, a safe
hub and travel. Keep authored Crypt NPC/story and add only approved original hub
lines; deeper narrative remains explicitly unwritten.

Acceptance:
- All five existing areas accessible in order and revisitable after unlock.
- Same area manifest/seed and stable spawn IDs reload; killed/claimed entities do
  not grant twice. Uncompleted bosses retry correctly; completed bosses stay dead.
- Kill quota/final/crown gates apply to first clear; seals stay open thereafter.
  Crown reappears correctly after loading a dead boss with uncollected quest item.
- Boss/chest/quest/XP/item ledger commits together; full bag preserves reward escrow.
  King completion survives skip/reload inside victory sequence.
- Travel commits one destination and first-clear recovery once; no travel-heal loop.
- Sanctuary is playable in 3D/Canvas with safe collision, NPCs, shrine travel and
  stash interaction placeholder (storage transactions completed in Phase 5).
- Explicit ordinary-area repopulation creates a new epoch only after safe loot
  recovery; bosses/unique quest rewards remain completed. No implicit reload farm.

Tests: deterministic campaign from start to ending/return hub; 100 seeds per floor;
revisit/death/save/restore chest/loot/kill/quest ledgers; guards retry without reward
farming; boss once-only outcomes under replayed events and every crash boundary;
full bag plus pending reward; crown gate recovery; travel interrupted pre/post commit;
unsafe imported coordinates; all floors, eight archetypes, bosses, cinematics,
touch/shrine travel, graphics presets, fallback and scene-budget regressions.

## Phase 4 — Deliberate permanent builds

Add passive/skill-allocation UI using original VESPER names; proposed capped
passives in SPEC.md. Level grants/spending remain versioned and atomic. Preserve
Execution/Aegis/Stunning defaults and existing damage/shield/stun/cooldown contracts.
New classes, mana and direct ability upgrades are separate future approval items.

Acceptance: finite point budget and rank caps; preview/spend/cancel behaves
predictably on mobile; duplicate taps/reload cannot grant or spend twice; every
build recalculates stats without accumulating modifiers. No cooldown/Aegis/gear
shield refill on allocation. Proposed initial policy: no respec until designed and
approved, rather than silently offering an exploitable reset. Balancing changes
require explicit versioned migration preserving earned allocations/point value.

Tests: full allocation matrix at boundary levels; points earned/spent; invalid rank,
future skill and stale-spend rejection; deterministic damage/DPS and defence caps
for shield/dual/two-hand/unarmed; reload identity; no respec exploit; starter and
reasonable level-appropriate builds defeat all bosses; device UI and pause checks.

## Phase 5 — Permanent stash and bounded blacksmith upgrades

Keep six bag slots/two hands/12 items and existing mods/rarity tables. Implement
proposed character-local 24-slot stash, withdrawal-only recovery pages and upgrade
ranks/costs after balance approval. Add future-slot metadata capability without
activating extra slots or rewriting equipment. No merchants/crafting/reroll economy.

Acceptance: atomic bag↔stash↔ground/escrow ownership moves; full capacity preserves
items and rewards; save/load keeps IDs/mods/upgrade ranks. Upgrade ash debit + rank
commit once; no duplicate bonus, legendary passive recursion or lost currency on
abort. Campaign boss guarantees retain existing rarity weights and escrow safety.

Tests: all three loadouts with upgraded/rolled gear; malformed stash/imports and
cross-container duplicates; capacity/withdrawal recovery limits; interrupted upgrade,
repeated tap/command IDs, stale revisions, price boundaries/insufficient ash; crit
healing/fire once-per-strike; atomic swaps after hydration; offline reopen and HUD.

## Phase 6 — Optional replay, recovery tools and release qualification

Add opt-in seeded procedural replay instances using existing five environment/
enemy/boss configurations, separate reward namespaces from campaign unique grants.
Extend Phase 2 emergency export/recovery with validated import and polished
backup management UX, storage-status explanation
and device acceptance. Do not erase a character when ending or abandoning replay.

Acceptance: replay deaths still checkpoint-respawn the same character; campaign
quests/unlocks/completion untouched; each replay reward once per instance;
abandon/reset resolves ground gear to recovery without loss. Same seeds produce
repeatable layout/drop outcomes with injected RNG; save resumes the same outcomes.
Export/import is explicit atomic replacement, never append/merge duplication.

Tests: concurrent tabs; corrupt/future/oversized/hostile import; old schema migration
and rollback; restore/reopen old backup without duplicating current inventory;
offline worker updates and DB compatibility; browser storage eviction/denial UX;
save interrupted at every critical command boundary. Run full suite on final agreed
baseline, with nine graphics browser suites and fresh 25-scene budget job where
present. Test on physical iPhone Safari/installed PWA and Android Chrome/PWA:
closure/reopen/offline/background, storage persistence, export/share/import, all
areas and checkpoints, HUD accessibility, Low/Medium/High performance, shaders,
thermal/load behaviour. Record devices/OS, actual results and unavailable checks.

## Per-PR review and stop conditions

Every PR supplies exact base/head, source changes, acceptance tests and actual
pass/fail/skipped results; never claim emulator or CI proves physical-device
behaviour. Review order: schema/data invariants → command atomicity/error paths →
combat/renderer/mobile regressions. Keep test hooks out of production globals.
Add failure injection and seeded clocks/IDs/RNG, not sleeps or paid hosted services.

Stop and request a decision if required graphics code is absent from the agreed
base; storage validation would discard existing items; migration cannot recover
safely; permanent balance breaks baseline combat; or a new class/asset/service is
needed. Do not solve those by deleting saves, substituting a mock-up or deploying.

Before release: owner approves tested behaviour and pending policy choices; Codex
independently reviews implementation; confirm backups/export and real devices.
No automatic merge or production deployment in any phase.
