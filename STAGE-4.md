# Stage 4 — Player abilities and combat feedback

Development branch: `development/stage-4-abilities`, based on Stage 3 main at
`636ae49` (merged PR #5). Stage 3 was verified before coding. This stage extends
`index.html`, `enemy-system.js`, `equipment.js` integration and the existing
Three.js/Canvas rendering paths. No custom bosses, boss sequences or cinematics
were implemented. Main/production are not automatically changed by this work.

## Abilities and controls

All three abilities are available at the start of a run, with no new mana/resource
system or unlock progression. Tap the three buttons above the existing combat
controls, or use keyboard **1**, **2**, **3**. Those keys had no previous bindings.
Existing attack, dodge, healing, inventory (I), loot (R), story and movement remain.
The icons are crimson swords, a blue shield and golden lightning. Numeric seconds
show cooldown; unavailable buttons dim. Input is immediate, not queued or repeated
while held. Ready state updates immediately on entering gameplay rather than
waiting for an animation frame. Movement and Aegis can coexist with melee windups.

| Ability | Cooldown | Behaviour |
| --- | --- | --- |
| Execution Strike (1) | 8 seconds | 0.18-second windup, 200% calculated weapon damage, crimson slash, strong impact and short stagger |
| Aegis of Ash (2) | 20 seconds | Immediate separate barrier of 35% max health at activation, lasting at most 3 seconds |
| Stunning Blow (3) | 18 seconds | 0.12-second windup, nearest valid forward target, golden impact, 2-second standard stun |

Stunning Blow also deals a configurable **50% weapon-damage hit**. This deliberate
initial balance value lets it interact with shields, critical hits and item passives
through the same pipeline. An intact Skeleton Guardian shield absorbs the damage
and halves the control duration to **1 second**. A shield-breaking blow is fully
absorbed under the existing enemy-shield rule; subsequent hits reach health. Other
ordinary enemies receive the full 2 seconds unless an explicit resistance says
otherwise. Execution uses a 0.45-second stagger, subject to the same resistance and
immunity hooks. Existing boss placeholders have a default stagger cap of 0.75 seconds.

Offensive abilities require a ready melee attack and no active dodge or other
windup. Aegis can activate while attacking or moving. A valid activation consumes
cooldown immediately even when its later impact misses. **Dodge cancels a pending
windup without refunding its cooldown.** Floor transitions and browser backgrounding
also cancel pending melee hits, preventing stale targets/delayed surprise attacks.
Ordinary inventory/menu/dialogue pauses freeze a windup until play resumes.

## Shared melee and equipment integration

`abilities.js` is a renderer-independent ability runtime: immutable definitions,
activation checks, cooldowns, pending casts, target validation, calculated damage,
temporary barrier and interruption/reset hooks. The existing game adapter resolves
actual hits rather than creating a second combat engine.

Normal attacks and abilities share `resolveMelee`. It uses the Stage 3 equipment
calculation once, with the existing 40% off-hand contribution and single character
base damage. Critical chance/multiplier and the original 0.91–1.12 damage variance
apply after the ability multiplier. Thus Execution's base hit is exactly 2× the
calculated weapon damage, followed by the same critical/variance rules as normal
attacks. Weapon speed affects readiness of ordinary attacks, never the fixed 8/18/20
second ability cooldowns. Empty main hand retains Stage 3 unarmed damage (70% base),
which is still multiplied by Execution.

Offensive casts snapshot gear, facing, range and arc at activation. The origin follows
the moving player, but facing remains locked. Changing gear/blessings while paused
cannot boost a pending hit. Targets must still be alive, within range plus their
collision radius, within the forward arc and visible through the dungeon collision
grid at impact. Stunning Blow selects only the closest such target; Execution
cleaves the valid arc once. Normal attack auto-facing is retained, but hits/auto-aim
now also reject enemies behind walls using this shared line-of-sight check.

Enemy health/shield damage, feedback, deaths, XP, loot and encounter completion all
use the original hooks. On-hit and critical-heal item effects apply once per attack
only when health damage occurs. Ashbringer can proc from an ability, using its existing
3-second item cooldown; its secondary explosion does not recursively trigger itself,
healing or another ability. Ability stun is applied after its damage without first
consuming interruption immunity through the ordinary weak hit reaction.

## Aegis ordering and lifetime

The incoming damage path is:

1. Ordinary defence and damage-kind reductions (including Oathguard poison reduction).
2. Aegis temporary capacity.
3. Equipment shield capacity.
4. Player health.

Aegis never writes or refills `player.shield`. Its capacity, duration and maximum are
separate runtime fields. Unused capacity disappears at expiry; depletion produces a
blue break pulse. Hits brighten the shell, and activation/expiry have distinct blue
feedback. Capacity is based on maximum health at activation, not continuously
recomputed when blessings or gear change. Existing dodge/damage invulnerability rules
remain, and incoming blocked hits still postpone ordinary equipment-shield recovery.

Cooldowns and remaining Aegis values persist across floor transitions, without any
refill or new activation. Inventory swaps only reconcile ordinary equipment capacity.
Death and new-run/retry reset ability state, casts and capacity. Refresh retains the
existing rule of starting a fresh run, not permanent ability progression.

## Simulation and mobile rendering

The runtime advances only during active gameplay and when the document is visible.
Inventory, pause, level-up selection and narrative dialogs stop ability timers.
Backgrounding clears held input, cancels pending offensive casts, and retains
cooldowns. There is no wall-clock catch-up. Repeated touch or keyboard-repeat events
cannot trigger another activation. UI text is only rewritten when it changes.

The ability row sits above the existing attack/dodge/heal cluster. Story interaction
moves to its left; pickup and stair actions have separate rows. Short landscape
screens move the top menu away from combat controls. Tests measure all interactive
rectangles, including simultaneous loot/stair/story controls, at 320×568, 393×852,
412×915 and 844×390. Inventory remains scrollable with its existing touch behavior.
The current touch-action/native-gesture cancellation includes the new buttons.

Three.js reuses existing geometry/material caching: one low-opacity blue shell and
ring for Aegis, crimson/gold slash/shockwave geometry, a raised weapon windup and a
small gold halo indicator above stunned enemies. Hits/breaks use bounded existing
particle bursts and short pulses. No new dynamic lights, textures or dependencies
were added. Canvas renders colored slashes, the blue barrier and a gold stun symbol.
The renderer remains 3D by default; the existing toggle/fallback is retained.
Offline cache version is bumped and includes `abilities.js` and `abilities.css`.

## Reuse for Stage 5

Future bosses can set `isBoss: true` and use the same health, shield and stun hooks.
They are excluded from ordinary archetype AI so a boss controller can own their
movement/actions. Configure per actor:

```
controlResistance: {
  immune: false,
  durationCap: 0.75,
  postRecoveryImmunity: 2,
  shieldMultiplier: 0.5
}
```

`combat.stun(enemy, duration, {source: 'ability'})` applies those rules. The legacy
weak weapon-hit stun keeps its existing Guardian/boss immunity. A successful stun
reserves immunity for its full duration plus the recovery-immunity period, and
stunned actors cannot move through local enemy separation. Control timers advance
even if an actor leaves the active enemy budget, so stuns do not persist indefinitely.

Set `attackInterruptible: false` or `majorMechanicActive: true` during a protected
sequence to reject body interruption. Pending ground attacks can independently set
`interruptible: false` to survive body stun. `cancel(enemy, 'stun')` cancels only
interruptible warnings; it never removes already active ground hazards. Death can
still end pending attacks. Existing poison pools and persistent arena hazards remain.
These hooks are intended for Snakeling's acid cross, Flameghoul's major flame walls,
and the King's ritual/axe mechanics. Stage 5 must flag those actions/hazards when
implementing their controllers; no boss-name matching or bespoke sequence exists here.

## Automated verification

Run:

```
npm test
npm run test:browser
npm run test:inventory-browser
npm run test:abilities-browser
```

Serve via `npm run dev` first for browser tests. Playwright/Chromium must be available,
with `BASE_URL` and `CHROMIUM_PATH` overrides supported as in Stage 3. Test hooks are
injected only into test HTML responses; production has no exposed cheat API.

The 44 Node test cases cover existing gameplay, eight enemy types, gear transactions,
rarity rewards, potions, 500 layouts, all five floor gates and ability-specific cases:
activation/misses, repeat protection, exact equipment/critical damage, enemy shields,
real dungeon-wall targeting, Aegis ordering/expiry/no-stacking, paused casts/cooldowns,
gear/floor persistence, retry/death reset, archetype interruption, Guardian resistance,
anti-stun-lock recovery, configurable bosses and protected/active hazard survival.

Browser tests cover simultaneous movement + ability touches, all three activations,
visible barrier/stun effects, cooldown pause in inventory, keyboard controls, double-tap
zoom prevention, non-overlapping HUD rectangles and both renderers. The pre-existing
browser suite still exercises all eight enemies and completes all five floors using
the melee/death/crown/exit hooks. That suite positions the player and resets ordinary
attack cooldowns; it is a progression regression, not a human survival/balance run.

## Real-device checklist and limits

On the preview, test on both iPhone Safari and Android Chrome:
1. Hold the joystick and tap 1/red swords. Check the delayed forward hit and 8s timer.
2. Try shield, dual-wield, two-handed and unarmed loadouts; check damage changes while
   the ability cooldown stays fixed. Repeat taps must not retrigger it.
3. Tap the blue shield, take damage and watch Aegis drain before ordinary capacity.
   Stop taking damage and verify Aegis disappears at 3 seconds.
4. Aim at a Summoner/Cultist/Ghoul/Wraith and tap gold lightning. Their preparing
   action should stop, a halo appears, then normal AI resumes. Check a Guardian too.
5. Open inventory/dialogue or pause during cooldown. It must freeze. Swap equipment,
   descend a floor, or background the browser: cooldown must not reset or auto-cast.
6. Try rapid taps, loot collection, stairs, inventory and story interactions in
   portrait and landscape. Check the Canvas toggle as well as default 3D.

Physical iPhone/Android FPS, thermal performance and Safari-specific gesture behavior
are not verified by Chromium emulation/software WebGL. Real-device testing and a
human balance pass remain necessary before merging. The short offensive windups
use lightweight poses, not new skeletal animation assets. Damage/stun values are
initial tuning. Existing missing installation icon URLs are outside this stage.
