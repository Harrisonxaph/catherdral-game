# VESPER — Stage 1

Development branch: `development/stage-1-five-floors`.

## Existing systems reviewed

`index.html` owns the requestAnimationFrame simulation, tile collision, flow-field AI,
melee arcs, bolts, health, dash invulnerability, potions, blessings and pointer controls.
`castle-view.js` renders that simulation with Three.js, instanced stonework, an
orthographic camera and nearby actors. Canvas is the existing fallback/view toggle.
`narrative.js` connects through setup/update/events and retains the first chapter,
including collecting the crown before leaving. Local storage retains memories and
best kills, not the current run. The service worker caches local game assets.

## Architecture and implementation

`floors.js` provides immutable floor definitions and a renderer-independent layout
factory. Add future areas through this interface. Layouts guarantee connected rooms,
a winding main route, extra loops, randomized room extents and a separate final
chamber with a single approach. Each floor grows in room count, room dimensions,
walkable area and enemy count. The initial room remains safe.

| Floor | Rooms | Enemies | Normal HP multiplier | Damage multiplier | Final encounter |
| --- | ---: | ---: | ---: | ---: | --- |
| Forgotten Crypt | 13 | 24 | 1.00 | 1.09 | Existing Keeper + guard |
| Ashen Cloister | 17 | 47 | 1.22 | 1.20 | 2 elite brutes |
| Bell Sanctum | 21 | 60 | 1.48 | 1.34 | Existing Warden + 2 guards |
| Cinder Vault | 26 | 99 | 1.78 | 1.50 | 3 elite brutes |
| Cathedral of Ash | 31 | 120 | 2.12 | 1.70 | Existing Warden + 3 guards |

Elite brutes reuse the existing model and AI, with 1.55× health and 1.2× damage.
Boss health is 165/440/680; floor one's existing Keeper damage/speed are preserved.
Final guards activate when the player enters the chamber. They can pursue the
player after activation; there is no new arena-lock mechanic. Every final guard
must die AND the existing soul quota must be met to open the exit. Killing ordinary
enemies alone cannot unlock it. Floor five's exit ends the run; retry starts floor one.
Floor transitions retain the existing 20% healing and potion replenishment.

Keep future enemy definitions behind the spawn interface and future encounter
controllers behind the final-encounter list. Equipment and abilities should modify
the existing player/combat parameters through separate modules. Cutscenes should
use the story adapter's pause/input clearing and events. These later systems are
architecture extension points only; none were added in this stage.

The 3D renderer remains the default. Static masonry stays instanced, pixel ratio
remains capped at 1.5, enemy AI stays distance limited, and chests/traps/loot/effects
now also use the existing nearby rendering pattern. Floor rebuilds release existing
instance buffers. The offline cache version was incremented and includes floors.js.

## Validation

Run `npm test`. Covers movement, attack, dodge, healing, reading pause, death/retry,
chapter hooks, all five progression gates, reachable enemy spawns, monotonic map/enemy
scaling, finite completion, and connectivity of 100 seeded layouts per floor.

Serve with `npm run dev`. With Playwright available and Chromium installed, run
`npm run test:browser` (`CHROMIUM_PATH` overrides `/usr/bin/chromium`). The browser
harness injects test hooks only into served HTML; production exposes no test API.
It uses real touch input for movement/dodge/healing, defeats enemies through repeated
melee attacks, collects the chapter-one crown, traverses all five exit transitions,
and checks that WebGL stays enabled without page errors at 393×852 and 412×915.
The combat automation positions the player beside enemies and resets attack cooldowns;
it verifies damage/death/progression, not unaided playthrough balance.

## Limits

Phone dimensions are tested in Chromium emulation with software WebGL. Actual iOS
Safari/Android GPU performance, thermal behavior, offline installation and a full
human survival/balance playthrough still need device testing. No device FPS claim
is made. The original game's missing icon URLs remain a pre-existing install issue.
Layouts have a structured grid silhouette despite randomized room sizes. No new
boss AI, enemy types, inventory, abilities, story chapters or save-run support were
added. Existing blessings are retained. Changes are not merged or deployed.

## Mobile input correction

Window blur now clears all held controls without pausing a visible game. Actual
backgrounding uses `visibilitychange` to pause, retaining explicit resume. Gameplay
surfaces cancel native touch-end defaults and gameplay cancels Safari gesture and
double-click zoom events; menu click handlers and story scrolling are preserved.
The restrictive viewport maximum-scale/user-scalable settings were removed, menu
buttons use `touch-action: manipulation`, and joystick capture loss clears movement.
The offline cache version was bumped so refreshed installs receive the fix.
Regression tests cover visible blur, background pause, touch gesture cancellation,
real double taps, explicit pause/resume and repeated combat taps. Browser tests accept
`BASE_URL` to select a local test server. Physical Safari confirmation is still needed.
