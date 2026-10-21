# VESPER: Cathedral of Ash — project record

Last verified: **2026-10-20**, against fetched main
`8f2b572` (merge of PR #10). This file records the current design and progress;
[AGENTS.md](AGENTS.md) provides working instructions. Update this record when
significant decisions change, citing source files or commits. Do not treat
suggested follow-up work as authorization to implement it.

## Purpose and approved direction

A playable gothic action RPG with an isometric/orthographic Three.js presentation,
procedural dungeon floors, responsive combat and touch controls for mobile browsers.
A Canvas fallback and offline/PWA operation remain part of the product.

Approved development extends the existing engine rather than replacing it with a
mock-up, 2D prototype or unrelated combat system. Preserve movement, attack/dodge/
healing, camera/collision, enemies, loot, inventory, blessings, abilities and story
unless the owner explicitly requests a change. Maintain the original gothic
identity and clear combat warnings. Make focused changes on development branches;
the owner reviews/previews and merges into main. Do not automatically release.

## Implemented progress

The stages below are implemented in current main, not outstanding feature briefs.
Stage reports describe their original delivery snapshots and can be outdated.

### Dungeon progression and enemies

`floors.js` defines five increasingly large, connected procedural floors. Floor
configuration drives enemy scaling and roster selection. Floors 2 and 4 end with
elite encounters; Floors 1, 3 and 5 contain bespoke bosses. The kill quota and all
final encounter members gate the exit. Floor 1 additionally requires collecting
the narrative crown splinter (`narrative.js`, `canLeave`).

| Floor | Environment | Final encounter | Current boss HP |
| --- | --- | --- | ---: |
| 1 | The Forgotten Crypt | The Snakeling | 2,500 |
| 2 | Plague Halls | Elite exit encounter | — |
| 3 | Crimson Chapel | The Flameghoul | 2,500 |
| 4 | Hollow Sanctum | Elite exit encounter | — |
| 5 | Throne of Ash | The Undead King | 4,000 |

Eight regular enemy types exist in `enemy-system.js`: Skeleton Warrior (`bone`),
Skeleton Guardian (`guardian`), Ghoul (`ghoul`), Plague Ghoul (`plague`), Demon Brute
(`brute`), Demon Summoner (`summoner`), Fallen Cultist (`cultist`) and Wraith
(`wraith`). They share a state machine with type-specific melee, lunge, poison,
slam, summoning, ranged spell or teleport behaviour. Enemy health/shields, status
interruption/immunity, navigation, separation and simultaneous-attacker limits
are already implemented. Summoned minions yield no farming loot.

### Equipment, inventory and loot

`equipment.js` implements two equipment slots and a six-slot backpack. Supported
loadouts are one-hand/shield, dual wield and a two-handed weapon occupying both
slots. Transactions fail atomically when invalid or without backpack capacity.
Dual wield uses a 1.2 speed multiplier and a 0.4 off-hand damage contribution;
two-hand attack-rate scaling and defensive caps are configurable in `balance`.
There are 12 items across Common, Rare and Legendary rarity, with bounded passives,
weighted ordinary/chest loot and generic once-only final boss encounter rewards.

Potions have a carried maximum of three and use the existing heal control. New
runs begin with two potions, Rustbound Sword and Crypt Guardian Shield. Equipment,
backpack and potion state belong to the current run, persist between floors and
reset on retry/new run. Existing floor-transition recovery is retained.
Persistent best-score, narrative records and graphics preference are separate
from run inventory; there is no implemented permanent character progression or
cloud-synced run save.

### Player abilities and combat contracts

All three abilities are available at run start; no new mana or unlock system was
introduced. Source: `abilities.js` and its `index.html` adapters.

| Ability | Approved/current effect | Cooldown |
| --- | --- | ---: |
| Execution Strike | 200% calculated weapon damage; existing range/arc/visibility and critical rules | 8s |
| Aegis of Ash | Temporary absorption equal to 35% max HP for up to 3s | 20s |
| Stunning Blow | Nearest valid forward melee target; 2s standard stun, boss stagger capped at 0.75s, with resistance/immunity | 18s |

Cooldown starts on activation, including misses. Cooldowns pause with combat
pauses, survive equipment swaps/floor transitions and reset for a new run/death.
Aegis is separate from equipment shields: apply ordinary mitigation, then temporary
Aegis, then equipment shield, then health. Shield activation/equipment changes
must not duplicate capacity. Existing blessings and capped item effects still apply.

### Boss encounters and presentation

`boss-system.js` implements telegraph → execution → recovery and below-half-health
aggression. Bosses stay in their arenas and require their chamber guards first.

- Snakeling: sampled-position acid impacts with warnings, 10-second pools and a
  rotating four-direction acid cross. Pool/cross scheduling preserves escape space.
- Flameghoul: moving flame wall with a real safe gap, facing-based half-arena fire
  strike with rear escape, and flaming melee.
- King: four corner candles activate a skippable awakening sequence. Any unlit
  candle grants 80% damage reduction; candles can be extinguished/relit. Whirlwind
  and telegraphed axe toss coexist with at most three persistent axe hazards.

Stunning Blow cannot cancel protected major boss mechanics. Existing hazards
remain governed by their own lifetimes; defeat clears boss-owned hazards.

The later presentation pass adds original procedural articulated models: a
scaled/deforming serpent, burning armoured undead and a skeletal royal monarch
with a separate two-hand axe. Each has idle/movement/attack/hit/death presentation.
The King's existing four-second skippable death sequence now kneels, drops the
axe, flares all four candles and begins visual collapse through falling masonry
and restrained shake. It does not add collapse damage or change map collision.
Skipping leaves a terminal kneeling pose and clears cinematic debris.

These are **procedural surface models and pivot animations**. Professionally
sculpted/skinned GLB characters and authored animation clips have not been
supplied/bundled. The exact asset, rig, clip and licence requirements are in
[assets/bosses/ASSET-REQUIREMENTS.md](assets/bosses/ASSET-REQUIREMENTS.md).
Advanced boss rigs/death choreography are 3D features; Canvas remains simplified.

### Environment, UI, controls and persistence

The visual overhaul provides floor-specific palettes, reusable masonry/arches,
ornaments, textured materials, bounded torch lighting/fog, foreground fading,
contact-shadow approximations and articulated regular characters. Low/Medium/High
settings are in Pause → Graphics quality. Coarse-pointer/narrow devices default
to Low; explicit preference is stored as `vesperGraphics`. Quality changes are
presentation-only. No AAA sculpted-asset or physical-device FPS claim is approved.

Touch HUD controls include movement, attack, dodge, potion, three abilities,
inventory, contextual loot/story/candle interactions and descent. The inventory
button now uses a backpack SVG. Keyboard bindings include WASD/arrows, Space/J
attack, Shift/K dodge, Q heal, I inventory, 1/2/3 abilities, R equipment pickup,
F story interaction, L journal, C candles, E descent and Escape/P pause (Escape skips a boss
sequence). Verify handlers before changing bindings.

The story/journal currently develops the Forgotten Crypt/Chapter I. The narrative
explicitly says deeper story chapters are not yet written. Some journal/quest
records persist in localStorage; this is not full run-save persistence.

## Latest decisions and source precedence

- PR #8 integrated the environment overhaul with completed custom boss encounters;
  earlier “do not implement bosses yet” statements in historical reports do not
  describe current main.
- PR #9 added boss presentation and the King death sequence, with documented
  procedural-art limitations and external-asset handoff.
- PR #10 replaced the square inventory glyph with the backpack SVG and raised
  Snakeling HP from 1,000 to **2,500**, matching Flameghoul. No other gameplay change
  was requested for that patch. `docs/history/STAGE-5.md` and `docs/history/BOSS-PRESENTATION.md` still contain
  historical 1,000 HP figures; current `floors.js` and tests take precedence.
- This handoff adds only `AGENTS.md` and `PROJECT.md`. It authorizes no new gameplay
  stage, asset purchase or production deployment.
- Repository tidy (owner-requested): historical stage/visual/boss reports and the
  legacy Netlify install notes moved to `docs/history/`; the redundant npm `three`
  dependency was removed (runtime always used `vendor/`); the knight portrait was
  downscaled from 1024² to 384² (shown at 92×112 CSS px), with `CACHE_VERSION`
  bumped; README, `.gitignore`, MIT licence and CI were added. Gameplay unchanged.

## Validation record and known uncertainties

The source contains 61 named Node cases across seven root `*.test.cjs` files and
seven browser suites: gameplay, inventory, abilities, bosses, graphics, boss art
and offline. See AGENTS.md for runnable commands/tool prerequisites. Earlier
implementation sessions recorded successful suites and preview smoke tests;
the final health/icon patch additionally passed unit tests, boss browser tests
and a mobile inventory-button check. **Those are historical results, not a fresh
full-suite run performed for these documentation files.**

Comparison evidence and software-renderer metrics are in
`docs/visual-comparison/` and `docs/boss-presentation/`. More detail adds rendering
cost. These are controlled Chromium observations, not physical phone FPS.
Physical iPhone Safari/Android performance, thermals and driver behaviour remain
unverified in the recorded work.

Playwright is required by browser tests but is not a declared project dependency.
The supported minimum Node version and a portable, pinned browser-toolchain setup
are not specified in package.json. Current scripts assume a Chromium executable
unless `CHROMIUM_PATH` overrides it.

The project has used GitHub-linked Vercel previews/production in prior sessions.
No Vercel project config is checked into this repository. A GitHub Actions
workflow runs the Node unit tests (`npm test`) on pull requests and pushes to
`main`; browser suites are not run in CI; current
account access, deployment protection, dashboard settings and live production
status must be inspected rather than assumed. `_headers` alone does not prove
which rules the hosting platform applies. `docs/history/README-INSTALL.txt`'s Netlify upload
instructions are legacy installation guidance.

## Outstanding work and next steps

No further feature implementation has been approved by this handoff. The owner
has completed the previously requested stages and small health/icon follow-up.

Documented outstanding art work: obtain/commission and verify appropriately
licensed mobile-ready boss GLBs and animation clips, then use the existing
`createBoss` / `animateBoss` boundary without altering combat timing. The asset
handoff specifies the loader, offline-cache and validation work needed. Asset
availability, purchase approval and schedule are not established.

Recommended follow-ups **pending owner prioritization**:

1. Record a real-device acceptance pass on iPhone Safari and Android Chrome,
   starting on Low; verify touch input, all five floors/bosses, safe gaps, abilities,
   inventory pause, background/resume, offline reload and final-sequence skip.
2. Profile demanding combat scenes on those devices before increasing VFX/quality.
3. Decide whether to commission external character art, develop later narrative
   chapters, or make browser-test provisioning reproducible. These are options,
   not an agreed implementation schedule.

## Shared assistant workflow update — 2026-10-21

Re-audited main `31932ec` (PR #12 merged). Existing game architecture, features,
limits and health values above remain the project record. Added thin assistant
adapters and the handover guide; AGENTS.md is authoritative. TASKS.md tracks
current work and open-PR overlap; DECISIONS.md records new workflow decisions
without duplicating the existing design history. The new PR-only quality workflow
uses existing unit/browser scripts and isolated browser tooling; no production
application code or deployment setting is changed. Confirm actual hosted checks
and installed assistant context loading after review. The earlier statement that
no CI workflow is checked in describes the pre-change baseline, superseded by
this workflow PR once merged.
