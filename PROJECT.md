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

**Experimental rolled bonus modifiers (development branch `development/loot-modifiers`,
pending owner review — not in main until merged).** Newly generated Common/Rare
*weapons* from ordinary, chest and boss drops can carry per-instance rolled bonuses
stored on the item instance as `mods` (`{stat,value}`); the 12 definitions are unchanged.
Pool (`affixes` in `equipment.js`): Honed (+damage), Hastened (+attack speed),
Omened (+critical chance). Common: 35% chance of one bonus; Rare: 60% chance of
one, then 40% chance of a second distinct bonus. Ranges — Common: damage 1–3,
speed 3–5%, crit 2–3%; Rare: damage 2–5, speed 4–8%, crit 3–5%. Legendary items,
shields and starting gear never roll. Off-hand rolled damage uses the same 0.4
contribution; totals remain inside the existing speed (0.65–1.7), attack-interval
(≥0.13s) and crit (≤75%) clamps. These values are untested balance assumptions,
not playtested tuning. The inventory lists rolled bonuses and Δ damage/attack
rate/crit/shield/defence per target slot; pickup prompt and toast show them too.
This is the single modifier schema and balance model. Competing PR #18 (one
guaranteed bonus stored as `modifiers:[{key,value}]`, different names/ranges) is
superseded by owner decision on 2026-10-27; its five-floor persistence,
Execution/crit-heal and offline regression tests were adapted to this schema.

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

The source contains 61 named Node cases (69 on `development/loot-modifiers`) across seven root `*.test.cjs` files and
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

## Graphics overhaul v2 — 2026-10-27/28 (in review, not merged)

Owner-approved plan: [docs/graphics-v2/SPEC.md](docs/graphics-v2/SPEC.md) ("Ash and
candlelight"), decisions D1–D5 in its section 9 (camera framing unchanged, CSS-only
grade, darker balance with a readability floor, portrait/icon provenance still
unverified, one stacked PR per increment, no external art). Increments:

1. PR #20 — capture tooling (`npm run capture:graphics-v2`) and enforced budgets
   (`npm run test:graphics-budget`): draw calls, triangles, real-time lights,
   textures, world digests and a play-area luminance/contrast floor per scene.
2. Light and value pass (branch `development/graphics-v2-lighting`): torch light
   and ambient occlusion baked into per-instance colours at floor build
   (`VesperGraphics.lightField` / `occlusion`, no per-frame cost), one instanced
   additive pool decal per torch plus a hero lantern pool, darker cornice caps,
   per-floor torch colour/exposure/fog density, rebalanced hemisphere (1.35→1.15),
   directional (3.2→2.4), torch (7→4.8) and hero (9→11.5) lights, and a CSS
   vignette grade hidden with the 3D canvas. Cost: +1 draw call per scene; floor
   build roughly +20–40% (still under 100 ms in software WebGL). No gameplay,
   collision, Canvas fallback or HUD layout change.

3. Architecture and floor identities (branch `development/graphics-v2-architecture`):
   generated `flagstone` (floors, uniform roughness 0.55 so grout cannot shine) and
   `relief` textures; varied slab layouts (border courses along walls, split,
   cracked and sunken slabs, worn centre-line paths) reusing the floor batch;
   chamfered cornice caps; rubble and fallen drums on broken walls; back-wall
   reliefs and per-floor features (crypt skull niches/ossuary, plague censers,
   fungus and puddles, chapel runner/hangings/candelabra, sanctum floating masonry
   and non-emissive rune inlays, throne braziers that join the baked light and ash
   drifts); per-floor motes (falling ash on floor 5) and a darker floor-5 base.
   Fixed existing decorations that sat on walkable cells (window tracery on the
   wall/floor boundary; banners and High vault ribs across doorways); the graphics
   suite now fails any decoration taller than 0.2 centred on a walkable cell.
   Owner decision 2026-10-28 (option 1): quarter, half and cracked slab splits are
   High-only; Medium keeps border courses, sunken slabs and worn paths. Remaining
   budget after increment 3: Medium triangles about 9.9k in the tightest scene
   (floor 2 desktop; 15–21k elsewhere, was 4.2k), Low textures at the 8 limit.

4. Effects (branch `development/graphics-v2-effects`): pure `vfx-state.js`
   (budgets per preset, telegraph progress, trail and pool maths). Warning fills
   grow from the hazard origin to exactly the final shape for circles, rects and
   crosses, while walls and free polygons only ramp opacity so safe gaps never
   move; the final quarter pulses. Swing trail sweeps the real strike arc/range
   from the melee flash (the swing pose is static), coloured by rarity or ability;
   additive impact flashes from each enemy's hit flash; scorch decals for heavy
   hits (Medium/High); ash puffs on regular-enemy deaths; torch halos facing the
   fixed camera. All reuse the existing glow texture (Low is at its texture limit)
   and freeze with simulation time. Not done: fire flipbook textures (no Low
   texture slot), per-actor dissolve (character materials are shared; ash puffs
   instead) and new acid visuals (existing acid streams/motes kept).

5. Characters (branch `development/graphics-v2-characters`): `actorMaterial` in
   `art-materials.js` adds a shared fresnel rim (strength 0.42, floor accent mixed
   45% toward white) to character and boss materials through `onBeforeCompile`,
   with one program cache key and no extra draw calls; environment materials are
   unchanged. Hero layered pauldrons, gauntlet cuffs, armoured skirt and helm brim;
   brute shoulder spikes, ghoul spine ridges, skull crack, plague boils, robe hood
   folds and wraith wisps, each reusing a material already on its bone. Animation
   reads existing timers: hero swing from the melee flash, ability wind-up from the
   cast's remaining windup, enemy wind-up/attack from `stateTime`; breathing idle,
   turn lean, hit flinch, stun sway with head droop, cape secondary motion (cape
   kept as its own mesh: one draw call per caped actor) and a 0.7 s two-phase
   death for regular enemies (`VesperVFX.deathDuration`; was 0.4 s; visual only).
   Still procedural pivot rigs, not skinned or sculpted assets.

6. Loot, inventory icons and HUD (branch `development/graphics-v2-loot-hud`):
   item-shaped ground drops (shield, axe, two-handed or one-handed blade); three
   instanced batches for rarity light (beam taller for Rare, tallest and pulsing for
   Legendary), rune-ring glow and a glint for rolled-bonus items, drawn only while
   loot is visible; a beam collapse and rarity-coloured flash on pickup and a
   rarity-coloured "RELIC ACQUIRED" toast (`showToast` gained an optional rarity).
   Twelve original line-art inventory icons (one per item) with rarity glows. HUD
   ornament only (health striations, panel corner brackets, inner button frames):
   `tests/hud-layout-browser.cjs` compares 23 HUD/control/inventory rectangles at
   four viewports with a baseline recorded on, and verified against, main
   `387a900`, and requires 44px touch targets. No item rules, rarity tables or
   equipment logic changed.

7. Camera, fade and culling (branch `development/graphics-v2-camera`): wall-capable
   environment materials (`envMaterial`) use a per-pixel dithered cutaway: a front
   band ghosts walls more than 1.2 south of the view target (as main's chunk fade
   did) and soft windows open around the hero and up to three nearby enemies (eased
   0.2 s). Walls stay opaque, with no material clones or extra draws. Chunks are
   culled against the camera frustum with precomputed bounds. Framing unchanged
   (D1). Final measurements, device checklist and remaining asset work:
   [docs/graphics-v2/RESULTS.md](docs/graphics-v2/RESULTS.md).

Measurements are software WebGL, not phone FPS; physical-device checks remain
outstanding for every increment.
