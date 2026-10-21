# Stage 2 — Enemy expansion and combat AI

Development branch: `development/stage-2-enemy-ai`, based on merged Stage 1 main
(`0eb2653`). This stage keeps the existing 3D renderer, world layout generator,
camera, movement, melee arcs, dodge, healing, blessings, story and mobile touch fixes.
The old placeholder bosses and the final-encounter gates remain; no new boss logic,
inventory or player powers were added. Do not merge this branch until phone testing.

## Enemy roster and counterplay

| Enemy | Behaviour | Counterplay |
| --- | --- | --- |
| Skeleton Warrior | Sword attack; 25% chance of a faster second strike | Watch the second windup before committing |
| Skeleton Guardian | Slow, armoured, separate blue shield and red health | Break shield, then attack health; breaking hit is absorbed completely |
| Ghoul | Fast pursuit and a committed short lunge | Dodge away from the fixed landing marker |
| Plague Ghoul | Poison pools alternating with lunges | Leave the green disk before it activates; poison briefly persists after exposure |
| Demon Brute | Slow, powerful melee and a 2-tile ground slam | Leave the orange ring during its 1.1-second windup, or interrupt |
| Demon Summoner | Fragile ranged support, summons smaller demonic ghouls | Prioritize the caster; three living minions maximum per summoner |
| Fallen Cultist | Telegraphs dark bolts and retreats when approached | Strafe the locked aim line or close the gap |
| Wraith | Fast melee and short, wall-safe evasive teleports | Use its recovery after blinking |

Floor rosters are data in `floors.js`:
1. Forgotten Crypt: Warriors and Guardians; two enemies per exploration room.
2. Plague Halls: Ghouls, Plague Ghouls and Guardians.
3. Crimson Chapel: Brutes, Summoners and Cultists.
4. Hollow Sanctum: Wraiths and mixed demon/undead groups.
5. Throne of Ash: All eight types, with elite health/damage and gold crests.

The Stage 1 floor health/damage multipliers and enemy counts remain. Floor five
adds 25% elite health and 12% elite damage on top. No extra XP, ash, potions, kill
quota credit or leech healing comes from summoned minions, preventing farming.

## Modules and integration

`enemy-system.js` contains the eight definitions, reusable shield-first damage,
AI runtime and circular/axis-aligned rectangular hazard runtime. It has no DOM or
Three.js dependency and is also imported by Node tests. The existing game supplies
world collision, flow-field navigation, spawning, melee damage, health and effects
through a small adapter. Both renderers consume the same enemy/hazard objects.

States: idle, patrol, detecting, chasing, preparing, attacking, recovering, stunned,
dead. Detection requires distance and line of sight. Pursuit uses the existing
flow field around walls; local separation and a lateral escape attempt reduce
crowding. Ranged units retreat using the same collision/flow information. Lunges
move in substeps, and teleports require a clear route and a walkable destination.
No navigation teleport or permanent collision bypass is used to unstick enemies.

Windups lock attack positions. Rings retain their complete damage radius while
the fill flashes to indicate timing. Melee, lunge, poison, magic and slam warnings
have separate colors. A lunge is checked against its final position; other ground
attacks use the exact disk/rectangle rendered. Poison is green, slams orange/fire,
and dark spells violet. Stuns cancel pending warnings; existing poison pools remain.
Normal melee health hits interrupt for 0.22 seconds, with a 0.9-second immunity
window to prevent permanent stun locks. Shielded Guardians resist interruption.
Boss placeholders retain their original interruption behaviour.

Hazard configuration: position, circle radius or rectangle width/height, warning,
active duration, damage, tick interval, color/kind, source owner, interruption policy
and optional poison payload. One-shot impacts share the same system as repeated
pool damage. `status` applies bounded, non-stacking poison to the player;
`targetStatus` supports timed effects (including burn) on enemies for future use.
Existing dodge and damage invulnerability apply to hazard and poison hits too.

Models reuse primitive geometries and materials: shield/armour, crouched claws,
plague sacs, horns, caster staff/hood, and spectral body/blade distinguish enemies.
Sword poses communicate windup/impact, hit flashes and floating damage show strikes,
and the existing death bursts provide a lightweight death effect. Combat health
bars are drawn above the scene; Guardians have a separate blue bar. The Canvas
fallback shows names, shield bars and matching ground areas; its sprite silhouettes
remain simpler than the primary 3D view.

## Mobile budgets and cleanup

- At most 18 ordinary enemies receive full nearby AI per tick.
- At most 3 ordinary enemies may prepare/attack simultaneously; legacy bosses are
  outside this budget, retaining their Stage 1 behaviour.
- At most 3 living minions per Summoner, 12 globally.
- At most 48 live projectiles and 24 hazards. If a warning cannot be allocated,
  the enemy waits rather than making an untelegraphed attack.
- Hazard objects use a reusable bounded pool. Rendering uses a unique hazard ID
  so a recycled object cannot reuse a different shape's mesh.
- Expired projectiles/hazards, defeated summoned minions and offscreen render meshes
  are removed. Ordinary dead enemies remain as small skipped records until the
  next floor, retaining the final-encounter references; they have no live models/AI.
- Particle cap (240), geometry instancing, nearby rendering and pixel ratio cap
  (1.5) are retained. Shared health-bar and hazard geometry avoids per-frame textures.
- Floor changes/restarts clear hazard and status state. Offline cache is bumped
  and includes the new runtime.

## Validation and how to test

`npm test` runs the original gameplay suite plus `enemy-system.test.cjs`. Checks
include eight types detecting/attacking/dying, shield absorption, warning timing,
poison/DOT/rectangle footprints, stun/death interruption, minion and attacker caps,
projectile cap/expiry, fast double strikes, Wraith blink, Cultist retreat, a wall
navigation scenario, warning-budget exhaustion, floor cleanup, existing touch fixes,
all five exit gates and 500 generated layouts.

Serve with `npm run dev`, then run `npm run test:browser` with Playwright and Chromium
available. `BASE_URL` can select another local server; `CHROMIUM_PATH` selects a browser.
The test injects hooks into its own HTML response only; production has no cheat API.
It checks actual touch controls and double taps at 393×852 and 412×915, renders all
eight enemies in a mixed encounter, checks the 3D shield bar and hazard scale, then
completes all five floors using the real melee/death/exit hooks and crown collection.
It positions the test player and resets attack cooldowns for progression, so this
is not an unaided survival or balance test. `SCREENSHOT_PATH=/tmp/combat.png` saves
combat screenshots with viewport-width suffixes.

On the Vercel preview, play normally: Floor 1 introduces shields; Floor 2 introduces
lunges and poison; Floor 3 introduces slams, summons and dark bolts; Floor 4 adds
Wraiths; Floor 5 combines elites. Check that each warning allows time to dodge,
blue shields break before red health drops, Summoners do not exceed three living
minions, poison expires, and all five final seals still open correctly. Verify
movement + attack together, dash, healing, pause/resume and rapid double taps.

## Limits

Automated Chromium phone viewports and software WebGL do not establish physical
iPhone/Android FPS, thermal behaviour or Safari gesture parity. Test both real
platforms before merging. Mixed-encounter simulation timing/draw-call observations
are diagnostics on this machine, not mobile performance promises. Navigation checks
exercise representative geometry and connectivity, not every possible crowd state;
dense doorway traffic may still need balancing. Rectangle hazards are axis-aligned;
rotating axes/flame walls and bespoke boss attacks are future work. No new story
chapters, inventory, player powers, animation assets or custom bosses were added.
Existing missing installation icon URLs are outside this stage.
