# Experimental weapon modifiers — 2026-10-27

## Design and balance

Diablo II inspires variation between drops of the same base item. This experiment
uses original VESPER names and additive stats; it does not copy item content,
affix catalogues, assets or formulas from another game.

All 12 existing definitions and effects are unchanged. Newly dropped Common/Rare
weapons get exactly one uniformly selected modifier. Shields, Legendary items,
new-run starters and older `{id,key}` instances have no rolled modifiers.

| Original VESPER modifier | Common | Rare |
| --- | --- | --- |
| Ash-honed | +1–3 weapon damage | +2–5 weapon damage |
| Quickened | +2–4% attack speed | +3–6% attack speed |
| Watchful | +1–2 percentage points critical chance | +2–3 percentage points critical chance |

Values use integer damage or percentage-point steps, with no floor-based scaling.
These are conservative engineering assumptions for an experiment, not a
playtested final balance. Configuration lives in `equipment.js` → `modifiers`.

`item(key)` and `definition(instance)` keep their previous contracts. `generate`
creates a frozen optional `modifiers: [{key,value}]` field and accepts an RNG.
`itemStats` resolves bonuses without modifying the base definition or player.
The existing `roll` entry point generates the instance exactly once. Transactions,
world drop/pickup and transitions retain that object; none reroll it. There is no
new persistent run-save or migration requirement. Serialized objects with valid
roll data resolve too; invalid/unknown/ineligible modifiers are ignored and values
are bounded by rarity, with at most one contribution.

Damage contributes through the existing main-hand and 0.4 off-hand calculation.
Speed and crit add to existing bonuses once. Existing 0.65–1.7 gear-speed factor,
1.2 dual-wield multiplier, 0.13 minimum attack interval, 75% crit limit and all
shield, mitigation and passive caps remain unchanged. No new global damage cap
is invented. Breaking an enemy shield still absorbs that entire strike; it does
not spill the remainder into health. Crit healing remains health-hit-only and
once per strike. Execution uses the resolved weapon damage through its existing
adapter, without a separate modifier path.

Rarity tables, drop chances and boss completion rewards are untouched. Additional
RNG draws after successful eligible drops change later results in a shared seeded
world stream; same-seed runs remain repeatable, excluding unique ownership IDs.

## Inventory and mobile acceptance checklist

Run `npm ci`, `npm run dev`; open port 3000 on a device-accessible development
host or use the branch's GitHub-generated preview if available. No preview was
manually deployed for this task. Start on Low graphics. Perform on physical
**iPhone Safari and Android Chrome**, portrait and landscape:

- Start a fresh run: sword/shield, two potions, no starter rolls; movement,
  attack, dodge, healing and ability buttons remain responsive with no zoom.
- Collect Common/Rare weapon loot; tap it in the bag. Confirm the Rolled line
  shows one bonus and both equip destinations show damage, attacks/sec, crit and
  shield differences. Shields and Legendary items retain existing descriptions.
- On a small screen, scroll the dialog to reach comparisons/actions/close without
  horizontal overflow. Opening/closing inventory must pause combat and cooldowns
  without resetting them or restoring equipment/Aegis shields.
- Equip a rolled weapon; confirm the summary changes. Check dual wield and
  two-hand displacement. Fill the backpack and attempt a two-hand swap requiring
  more space: it must fail without item loss or changed stats.
- Drop and recollect the same rolled weapon: same bonus, no extra item or reroll.
  Repeat swaps; stats must return to the same values, without accumulating bonuses.
- Use Execution Strike and crit-heal equipment; check enemy shields, health hits
  and healing. Existing Legendary effects and all three abilities still work.
- Progress between floors with equipped/backpack rolls unchanged. Final encounters
  gate exits and bosses grant only one reward. Retry resets to unrolled starters.
- Switch between 3D and Canvas. Background/resume must pause safely. Complete an
  online load, reload offline, start/play and inspect inventory; new rolls should
  still work. Old caches should be replaced by `vesper-cathedral-v12-loot-modifiers`.

## Validation and limitations

See the PR handover for exact automated results. Browser emulation uses Chromium
and software WebGL; it does not prove physical-device performance, thermals or
Safari behaviour. Manual checklist above remains outstanding until recorded.
No external dependencies, assets, backend, debug globals or production changes.

Possible later enhancements, **not approved or implemented**: more modifier
families, multiple rolls, floor-tier ranges, an independent loot RNG stream and
balance telemetry. Measure/playtest the current small pool before expanding it.

### Automated record — 2026-10-27

Baseline on main d391208: npm test, npm run build and all three inventory-browser
viewports passed before runtime changes. Tests demonstrated missing generation
and UI before implementation. Final local validation:

- `npm ci`: passed, lockfile unchanged, no added dependencies.
- `npm test`: 68 cases passed, zero failures (61 existing plus seven new cases).
- `npm run build`: passed, 32 declared resources verified.
- `test:browser`: passed, five-floor completion and eight enemy types at two phone
  viewports; controls, zoom prevention, healing and progression retained.
- `test:inventory-browser`: passed at 320×568, 393×852 and 412×915; rolled text and
  stat differences, equip/drop/collect, pause, touch scrolling and both renderers.
- `test:abilities-browser`: passed at three portrait sizes and 844×390 landscape.
- `test:bosses-browser`: passed in portrait/landscape; starter-weapon victories,
  enrage, candles, cinematic controls and renderer transitions.
- `test:graphics-browser`: passed across phone, desktop and landscape; all five
  floor themes, quality changes, cleanup, preference persistence and fallback.
- `test:boss-art-browser`: passed at phone/desktop sizes, all three models and
  signature effects, death/collapse lifecycle and bounded quality rebuilding.
- `test:offline-browser`: passed real service-worker install/reload, offline 3D,
  ability activation and newly generated rolled weapon stats.
- Shared document checker and all five validator tests passed; JavaScript syntax,
  feature-document links and `git diff --check` passed.

New unit coverage includes eligibility/extreme rolls, immutable metadata, unchanged
legacy/starter/Legendary gear, off-hand weighting, speed/crit stacking and caps,
malformed/inherited bonus names, atomic full-backpack two-hand swaps, seeded drop
repeatability and once-only rewards. Integration coverage preserves actual rolled
world pickup, five-floor inventory lifetime/retry and Execution/crit-heal/shield
interaction. Initial test assumptions about shield overflow were corrected to the
existing absorb-whole-hit contract; production shield behaviour was not changed.

No remaining local automated failures. Hosted CI status must be read from the PR;
these local results do not claim hosted completion. Physical-device acceptance and
extended loot-balance playtesting remain outstanding.
