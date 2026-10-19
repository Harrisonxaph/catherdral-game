# Stage 3 — Inventory, equipment and loot

Branch: `development/stage-3-equipment`. Based on latest merged Stage 2 `main`
(`89b02f6`, PR #4). All five floors, eight enemy types, original player movement,
attack arcs, dodge, healing, blessings, 3D scene/camera and touch/zoom fixes remain.
No Stage 4 abilities, custom bosses or cinematics were added. This is a preview;
merging and production deployment are separate user actions.

## Controls

Tap **▦** on the gameplay HUD, or press **I**, to open Arms & Relics. Tap any of the
two equipment slots or six backpack slots to inspect its stats and passive. Backpack
items show the replacement, resulting loadout, and damage/shield differences. Tap
**Equip main hand** or **Equip off hand**; invalid actions are disabled with a reason.
Tap an equipped item and **Unequip to backpack** to remove it. A second one-handed
weapon moves from off hand to main hand when the main-hand weapon is unequipped.

**Drop item** requires a second **Confirm drop** tap. The item is placed at a nearby
walkable position before removal from the bag, and can be collected again. Dropping
is refused if there is no safe position or already 40 equipment drops on the floor.
Displaced equipment must fit in the backpack: otherwise the entire equip operation
fails with no loss or change. Two-handed weapons occupy both slots, represented by
one owned item and an explicitly occupied off-hand slot.

Approach equipment and tap **Collect [item]**, or press **R**. Equipment collection is
explicit; ash and potions retain proximity collection. A full backpack leaves the
item on the ground. A full potion pouch leaves potions on the ground. Drops have a
short simulation-time pickup delay to prevent accidental immediate recapture.
Story/crown interactions remain separate, with space between the buttons even on
short phone screens. The HUD menu uses two columns to avoid covering the journal.

The inventory is a scrollable modal with 44px touch buttons, focus handling, keyboard
cancel and a sticky Close button. Combat, cooldowns, hazards, statuses, shield
recovery and equipment proc timers freeze while it is open. Held controls clear on
both open and close. The renderer retains its last frame while inventory is open
to avoid spending GPU time drawing an obscured, paused scene.

## Loadouts and stat calculation

`equipment.js` owns immutable item instances, definitions, rarity colors, balancing,
run inventory, atomic equipment transactions, pure stat calculation and weighted
loot tables. `inventory-ui.js` owns the tap-based view; the game supplies pause,
resume, carried state and world-drop adapters. Neither replaces the combat engine.

Existing player properties remain base stats, including changes from the existing
blessings. Gear is calculated on top for each attack/damage evaluation; equipping
never repeatedly multiplies the player object. This prevents swap/preview stacking.

- Main-hand weapon damage is added to base damage. Off-hand weapons contribute
  40% of their damage bonus; the base character damage is counted once.
- Dual wield adds a 1.20 speed multiplier. Item speed bonuses are additive before
  that multiplier; cooldown is base cooldown divided by effective speed.
- Two-handed weapons have larger damage bonuses and a 1.35 cooldown multiplier.
  Equipping an off-hand item while using one requires changing main hand first.
- Empty main hand uses 70% base damage, with no main-hand weapon bonus.
- Defence reduction is `defence / (defence + 60)`, capped at 45%.
- Shield capacity absorbs remaining incoming damage before health. It regenerates
  at 4 capacity/second after 4 seconds without damage, only in active simulation.
  Swapping/equipping clamps current capacity; it never refills it. The starting
  shield begins full once per new run. Unequipping forfeits remaining capacity.
- Critical chance caps at 75%; item critical-damage bonuses cap at +80% over the
  original 1.9 multiplier. Healing bonuses cap at 2 on-hit plus 3 critical-heal per
  attack. They require health damage and apply once per swing, not per target.
- Ashbringer's 1.15-tile fire burst deals 20% calculated weapon damage, does not
  recursively trigger healing/fire effects, and has a 3-second simulation cooldown.
  Reopening inventory or changing equipment cannot refresh that cooldown.
- Oathguard's poison reduction applies before ordinary defence and capacity.
  Enemy damage kinds are forwarded through the existing damage adapter.

All the limits and coefficients live in definitions or the balance configuration.
Player weapon/shield models update to reflect two-handed, dual and shield loadouts.
Dropped gear uses lightweight weapon/shield models with white/blue/gold ground glows;
Legendary gear adds two small emissive shards. Potions use red bottle models. The
Canvas fallback retains colored gear symbols, red potions and fire burst feedback.

## Initial item pool

| Common | Rare | Legendary |
| --- | --- | --- |
| Rustbound Sword — one-handed | Bloodforged Blade — critical-hit healing | Ashbringer — two-handed fire-burst axe |
| Gravedigger Axe — heavier one-handed | Dusk Dagger — attack speed | King's Mercy — on-hit healing |
| Crypt Guardian Shield — defence/capacity | Bulwark of the Dead — greater defence/capacity | Oathguard — shield with poison reduction |
| Mourner's Greatsword — two-handed | Executioner's Axe — two-handed critical damage | Twin Moon — critical chance and damage |

## Rewards and ownership

A generic encounter context tracks its required members and completion. On the
last required member's death it emits `encounter-complete` and grants a boss-kind
encounter's equipment reward once. It does not inspect a boss name; the existing
boss placeholders use this hook. Future custom bosses inherit it by joining the
floor's boss-kind encounter. Encounter completion is independent of the soul quota;
the exit still requires both the encounter and the original quota. First-floor
crown collection and narrative gates remain unchanged.

| Source | Equipment probability | Rarity weights |
| --- | --- | --- |
| Floor 1 boss encounter | Guaranteed 1 | Common 72%, Rare 28% |
| Floor 3 boss encounter | Guaranteed 1 | Rare 94%, Legendary 6% |
| Floor 5 boss encounter | Guaranteed 1 | Rare 65%, Legendary 35% |
| Ordinary enemy | 7.5% | Common only |
| Chest | 55% | Common 75%, Rare 23%, Legendary 2% |

Within each rarity, items are selected uniformly. Boss-encounter members skip ordinary
equipment rolls so their completion produces exactly one equipment reward. Ash,
ordinary potion chance (4.5%), existing boss potion chance (90%), chest ash and chest
potion chance (40%) remain. Summoned minions grant no loot, XP, quota or healing rewards.
Chests still open once and keep their existing rewards and story interactions.

Each owned item has a unique ID. Collection checks ownership and marks the world
pickup consumed before another collection can occur. Items/potions have a single
run-owned source of truth. Health potions live in a separate three-potion pouch;
they do not consume the six equipment backpack slots. The HUD and inventory read
that same quantity. Drinking at full health consumes nothing; healing is clamped
to max health. Restored Grace and floor potion grants also respect the cap of three.
The original floor transition still restores 20% maximum health and grants one
potion, subject to that cap.

Equipment, backpack and potion state persist across floors. Floor generation does
not recreate them. Ground loot belongs to its floor and is left behind on descent;
collected/carried gear is retained. Death/retry or refresh starts a new run with a
Rustbound Sword, Crypt Guardian Shield and two potions. Existing narrative memories
and best-kill storage retain their original persistence. No permanent gear save or
character progression was introduced.

## Testing

Run `npm test` for equipment transaction, combat/AI and progression tests. Coverage
includes all three loadouts, invalid combinations, full-bag displacement, repeated
swap/preview stability, shield benefit, once-per-swing healing, fire cooldown,
rarity thresholds and 20,000 seeded probability samples, once-only encounter rewards,
potion capacity/consumption, repeated ground pickup, run reset and floor persistence.
Existing enemy AI, mobile blur/zoom and 500 procedural layout checks remain.

With Playwright and Chromium available, serve the repository (`npm run dev`), then:

```
npm run test:browser
npm run test:inventory-browser
```

`BASE_URL` can select another local server; `CHROMIUM_PATH` selects Chromium.
Inventory browser tests cover 320×568, 393×852 and 412×915, including real touch scroll,
modal pause, taps for dual/two-hand loadouts, invalid shield combinations, confirmation,
drop/recollection, restored controls and 3D/Canvas toggling. The original browser
suite still checks all eight enemies and completes all five floors through the real
melee/death/exit code. Test hooks are injected into test responses only, not shipped
as a production API. Progression automation moves the player/reset attack cooldowns;
it is not a normal survival/balance playthrough.

On real iPhone Safari and Android Chrome:
1. Move/attack/dodge/heal, then open ▦ during combat. Confirm the world waits.
2. Inspect all six slots and scroll to actions. Close and confirm controls respond.
3. Test a shield, two one-handed weapons, then a two-handed weapon. Check both slots
   and visible player equipment. Fill the bag and try a swap that cannot fit.
4. Take damage, open/close inventory repeatedly and swap shields: capacity must not
   refill without active recovery time. Check cooldowns and poison also remain paused.
5. Collect/drop equipment, approach it again, and check there are no duplicates.
6. Reach three potions, leave another on the floor, drink, then collect it once.
7. Complete final encounters and collect the one guaranteed reward on floors 1/3/5.
8. Carry items to the next floor; die/retry and confirm the run resets.

## Limits

Physical mobile FPS, Safari gesture behavior and a full human balance playthrough
still need real-device confirmation. Automated viewports/software WebGL cannot
prove them. Gear has no permanent save, selling, crafting or armor slots. There are
no added dependencies or custom character animation assets. The fallback uses
simpler equipment symbols rather than the 3D silhouettes. Existing missing install
icon URLs remain outside this stage. Ground drops intentionally do not travel
between floors. Balance values are initial tuning, particularly late-game healing,
shield recovery and Legendary drop rates.
