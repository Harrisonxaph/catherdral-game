# Stage 5 — Playable boss encounters

Branch: `development/stage-5-bosses`, based on merged Stage 4 main `3b9b40e`.
No production merge is performed. Stage 4's abilities, equipment, player movement,
eight enemy archetypes, narrative interactions and both renderers remain in use.

## Finding the encounters

Explore normally. Floors 1, 3 and 5 retain their existing final chambers, with increased health
values (1,000, 2,500 and 4,000). Boss damage is unchanged. Defeat their existing chamber guards first; the boss
cannot be damaged before activation. Floors 2 and 4 keep their elite exit encounters.
The exit still requires the floor kill quota and every final encounter member.
Bosses stay in their chambers. Retreating into the approach prevents boss damage
and ends temporary attacks; it does not heal the boss, reset candles, or remove the
King's already landed axes. Re-enter to resume. Rewards continue through the generic
once-only Stage 3 encounter-completion hook. The Snakeling still drops the narrative
crown fragment required for the first floor exit.

### The Snakeling — Floor 1

Acid shots arc toward the player's position sampled at wind-up, marked for 1.5s
before landing. Move away from the marker. Pools have radius 0.85 and persist for
10s after impact. The controller caps them at two and waits for pools to expire
before its cross, so a rotating sweep does not trap the player between acid pools.

The four perpendicular streams form two intersecting 0.65-wide strips, radius 34%
of room width. The entire shape rotates after a 1.5s stationary warning. Reach the
outer part of the room, beyond the stream tips, or move with a safe quadrant.
Rotation is 0.55 radians/s normally and 0.9 below half health; the active period is
3.5s/4s. Recovery is 1.6s. Below half health, scheduling intervals shorten by 28%.
Acid wind-ups can be interrupted; the rotating cross is protected. Landing acid
continues existing after a later body stun.

### The Flameghoul — Floor 3

A flame wall warns for 1.8s, then traverses the entire chamber at 1.5 units/s. Its
2.8-unit gap is positioned using the player's sampled horizontal position. Both
solid segments have exact collision geometry; edge hugging cannot bypass them.
Find the visible gap and remain in its lane as the wall passes. The boss stays
committed during the crossing, with no concurrent frontal strike.

The frontal attack marks the exact half of the room ahead of the boss's locked
facing for 1.65s, then burns for 0.35s. Cross behind the boss before impact.
Flaming melee attacks warn for 0.7s and can be interrupted. Major walls and frontal
strikes resist interruption. A 1.7s recovery follows committed attacks. Below half
health, pursuit and attack scheduling become faster; warning times remain readable.

### The Undead King — Floor 5

Approach each corner candle, then tap **Light candle** or press **C**. All four start
unlit and guards must be defeated before lighting them. The fourth flame starts a
3s camera sequence in the existing 3D scene. Tap **Skip sequence** or press Escape
to skip. Combat, input and ability timers are suspended during sequences.

While any candle is dark, damage through the ordinary equipment/critical pipeline
is multiplied by 0.2. A lit candle is periodically extinguished after a visible
1s announcement. Approach the dark candle and relight it to remove the ward.
Extinguish checks become eligible after 17s normally or 10s below half health;
committed attacks finish first, so actual intervals include their remaining time.

Whirlwind warns for 1.4s and spins within a fixed 2.5-unit radius for 2.3s (3s below
half health). Move outside the ring. The axe toss marks its landing for 1.6s and
leaves a continuously rotating axe in a 1.05-radius circle until defeat/floor reset.
There are at most three; a fourth replaces the oldest. Landing sites stay separated
by over 2.8 units and away from corner candle routes. Existing axes remain through
stuns and retreat. Major attacks cannot be cancelled by Stunning Blow; ordinary
melee can. The King has a collapsing in-engine victory sequence, then the existing
stair and run-completion flow remain available.

## Architecture and integration

- `boss-system.js`: frozen floor configurations and encounter state machine;
  dormant, preparing, attacking, recovering, chasing, stunned and dead actors;
  candle interactions, damage ward, attack choices, enrage and cinematic lifecycle.
- `enemy-system.js`: extends the existing bounded, pooled hazard runtime with
  rotated crosses, moving split walls and convex polygons. `hazardPolygons` is
  consumed by both renderers; `containsHazard` uses the same local coordinates.
  Movement and rotation advance only after warning time. Pooled objects reset all
  shape, movement, owner and protection fields between uses.
- `index.html`: replaces only the legacy placeholder boss AI loop, adapts existing
  damage/rewards to encounters, and adds candle/HUD/sequence controls. Ordinary
  attacks, Execution, passives and shields continue through their shared paths.
- `castle-view.js`: lightweight boss silhouettes, candles, acid flights, axes,
  camera sequences, exact hazard meshes and outlines. New custom geometries and
  line materials are disposed on expiration and floor rebuild. Shared primitives
  and cached materials remain; no dynamic lights, textures or dependencies added.
- `bosses.css`: touch-friendly candle button beside the ability row, status and
  skippable cinematic overlay. During bosses the journal tracker yields space to
  encounter status; it returns afterward. Existing story dialogs still pause play.
- `narrative.js`/`story-content.js`: display-name changes from Crypt Keeper to
  Snakeling while preserving saved quest IDs, crown pickup and story events.
- `service-worker.js`: v8 cache includes the new runtime and stylesheet.

Player abilities retain their Stage 4 values: Execution 200%/8s, Aegis 35% maximum
HP for 3s/20s and Stunning Blow 2s standard/0.75s boss/18s. Boss recovery immunity
is 2s after stagger. Non-interruptible major sequences and already active hazards
survive stun. Mitigation, Aegis, equipment shield, health ordering is unchanged.
Inventory, pause, narrative and hidden-browser states freeze encounter simulation;
new runs/floors clear the previous encounter. No unlock or permanent progression
system is added.

## Tests

Run `npm test`, then serve with `npm run dev` and run:

```
npm run test:browser
npm run test:inventory-browser
npm run test:abilities-browser
npm run test:bosses-browser
```

Browser commands accept `BASE_URL` and `CHROMIUM_PATH`. All debug adapters are
injected into test HTML responses; they are absent from the shipped game.

The 54 Node test cases cover sampling, warning/damage/expiry timing, safe cross perimeter,
wall gap and movement, frontal/rear collision, local candle requirements, exact
80% ward, cinematic activation, three-axe cap and safe candle access, cleanup,
threshold changes, faster extinguishing, protected actions and stun recovery.
Integration tests verify actual equipment damage and Aegis against bosses, existing
floor gates/rewards, inventory and all earlier systems. Browser tests exercise real
candle taps and Skip, boss meshes/hazard polygons, full-health starter-weapon kills,
all five floor transitions, ability effects, control rectangles and both renderers.

These use controlled positioning and attack cooldown resets to test damage and
progression. They do not establish human survival difficulty. Physical iPhone and
Android FPS, thermal behavior, Safari gestures and encounter balance require a
real-device playthrough. Chromium emulation/software WebGL does not verify those.

## Real-device acceptance checklist

1. Use the development preview, refresh after its new offline cache installs, and
   confirm 3D is the default. Try Canvas as well.
2. Fight each boss normally with starter equipment. Verify every warning allows
   the counterplay described above, including portrait/landscape visibility.
3. Compare attacks above/below half HP. Test Execution and Aegis during danger;
   stun melee/wind-ups and try a protected major sequence.
4. Open inventory/dialogue or pause during a warning and cooldown; nothing should
   advance until play resumes. Background and return without surprise attacks.
5. Relight King candles with touch while moving. Check the ward falls from 80% to
   zero reduction when all four burn. Verify three axes leave corner routes clear.
6. Defeat each encounter, collect its single equipment reward and proceed. Confirm
   Floor 1 crown interaction and Floor 5 victory/ending still work. Retry after death
   and verify candles, hazards and abilities reset.

The short sequences use camera motion, simple poses and text; there are no authored
skeletal animations or video assets. Balance values are initial tuning. The boss
can be retreated from, retaining health/ritual/hazards as described; there is no new
arena-door locking system or checkpoint rule.
