# Shared coding-agent instructions — VESPER: Cathedral of Ash

## Start here

Read [PROJECT.md](PROJECT.md) before working. It records approved designs,
current progress, important decisions and outstanding work. Update it when a
significant decision, shipped capability, balance value, limitation or next step
changes. Distinguish approved work from suggestions; mark unverified facts.

Inspect `git status`, the current branch and relevant source/tests first. Check
current upstream main when access permits; do not overwrite user changes. Work
on a dedicated development branch. Do not automatically merge into main or
promote/deploy to production. Deliver a reviewable change and describe validation.

## Purpose and stack

VESPER is a playable gothic action RPG/dungeon crawler for iPhone, Android and
desktop browsers. Preserve its real isometric 3D gameplay and mobile controls.
It is a static client application: HTML, CSS and vanilla JavaScript, with a
Three.js WebGL renderer and Canvas 2D fallback. There is no bundler, transpiler
or backend. `npm run build` (`scripts/build.mjs`) only copies the unchanged static
files into `dist/` for Vercel and fails if a declared runtime file is missing. Three.js `0.180.0` is vendored in `vendor/` and is the single source
for runtime imports; there are no npm runtime dependencies. `packageManager`
specifies npm `10.8.2`. PWA support uses a manifest and service worker.

## File map

| Location | Responsibility |
| --- | --- |
| `index.html` | HUD, controls, game state, requestAnimationFrame loop, simulation adapters, melee/player damage, loot/floor transitions, Canvas rendering and PWA registration |
| `floors.js` | Five immutable floor configurations, rosters, scaling, boss HP, connected procedural layouts and pure RNG-free area/spawn/chest identities (ARPG Phase 2 PR1) |
| `enemy-system.js` | Eight archetypes, state machine, navigation/separation, shields/statuses, hazard/projectile/summon budgets and exact hazard geometry |
| `equipment.js` | Pure equipment definitions, rolled bonus modifiers, loadout/stat calculations, atomic inventory transactions and weighted loot |
| `character-state.js`, `tests/fixtures/` | Proposed persistent-character save schema: validation, item ownership graph, hydration, derived stats and migrations; area instances use `floors.js` identities, so load `floors.js` before it in browsers (ARPG Phase 1A/2; not loaded by the game yet) |
| `campaign-state.js` | Pure campaign world state and once-only reward ledger: area instances from PR1 manifests, idempotent kills/chests/pick-ups, reward escrow and first clears (ARPG Phase 2 PR2; not loaded by the game yet) |
| `command-coordinator.js` | Critical gameplay commands committed before they take effect: atomic potion spend and heal, ability cooldown reservation, recorded death, save-failure pause and stale-session detection (ARPG Phase 2 PR3; not loaded by the game yet) |
| `save-store.js` | Persistent character repository over IndexedDB: signed revisions, compare-and-swap commits, rotating/pinned backups, fenced writer lease, quarantine and recovery (ARPG Phase 1A; not loaded by the game yet) |
| `inventory-ui.js`, `inventory.css` | Tap-based inventory UI and pause integration |
| `abilities.js`, `abilities.css` | Three simulation-time player abilities, cooldowns, temporary Aegis and targeting helpers |
| `boss-system.js`, `bosses.css` | Boss encounter state machines, candles, protected actions, sequence lifecycle and boss UI |
| `castle-view.js` | Three.js renderer, orthographic camera, entity-to-model integration, culling, effects and resource lifecycle |
| `graphics.js`, `visual-ui.css` | Quality presets/preferences, floor palettes, baked-light helpers and gothic UI styling |
| `vfx-state.js` | Pure effect budgets, telegraph progress, trail and impact pools used by `castle-view.js` |
| `art-materials.js`, `environment-art.js`, `character-art.js` | Shared procedural materials/geometry, dungeon scenery and articulated regular characters |
| `boss-art.js`, `boss-presentation.js`, `boss-effects.js` | Procedural boss models, pure presentation clocks/budgets, signature VFX and visual collapse |
| `story-content.js`, `narrative.js`, `narrative.css` | Narrative content, journal/interactions, reading pause and first-floor story gating |
| `service-worker.js`, `manifest.webmanifest`, `_headers`, `icons/` | Offline asset cache, install metadata, PWA/home-screen icons and hosting header rules |
| `scripts/build.mjs`, `vercel.json` | Static deploy packaging into `dist/` (no bundling) and Vercel build/output/header configuration |
| `*.test.cjs`, `tests/*.cjs` | Node tests, Playwright browser tests and capture scripts; `tests/generation-harness.cjs` runs any revision's floor generation in Node, and `tests/fixtures/p2-pr1-generation-golden.json` pins generation to main `ef177df` (regenerate only to move that baseline deliberately) |
| `docs/visual-comparison/`, `docs/boss-presentation/` | Actual before/after screenshots and software-renderer metrics; not loaded by gameplay |
| `assets/bosses/ASSET-REQUIREMENTS.md` | External model, rig, animation and licence handoff; no external boss models bundled |

`docs/history/` holds `STAGE-1.md` through `STAGE-5.md`, `VISUAL-OVERHAUL.md` and
`BOSS-PRESENTATION.md`: historical implementation reports. They may describe
old branch state or balance. Use current source/tests and PROJECT.md to establish
present behaviour; do not restore old exclusions such as “bosses not implemented.”
`docs/history/README-INSTALL.txt` describes an older Netlify ZIP workflow, not verified current
Vercel configuration.

## Code conventions and integration rules

- Follow the surrounding vanilla JavaScript style: `const`/`let`, semicolons,
  small named helpers and data definitions. Existing files are compact; avoid
  whole-file reformatting, framework migration or unrelated rewrites.
- Simulation/data modules generally use an IIFE, export CommonJS for Node tests
  and expose a `window.Vesper*` API in browsers. Rendering/art files use browser
  ES modules importing the same vendored Three.js. Preserve script load order
  and existing public APIs when extending them.
- Keep simulation independent of DOM/Three.js. Extend existing `createRuntime`
  adapters instead of introducing a parallel combat engine. Presentation must
  not change entity positions, damage windows, cooldowns or collision geometry.
- Use the existing simulation clocks and pause gates for combat. Avoid wall-clock
  timers for abilities or hazards. Preserve inventory/dialogue/pause behaviour,
  background input clearing and cancellation of pending attacks.
- Preserve touch targets, pointer capture, simultaneous movement/ability input,
  no accidental touch-induced pause and prevention of double-tap browser zoom.
  Test small portrait and landscape screens. Keep Canvas fallback usable.
- Reuse equipment stat calculations. Do not count off-hand/base damage twice,
  duplicate on-hit effects, refresh cooldowns on swapping, refill equipment
  shields through Aegis, or duplicate inventory/once-only encounter rewards.
- Use shared collision definitions (`hazardPolygons`, `containsHazard`) for
  readable telegraphs/effects. Preserve safe gaps, stun immunity and protected
  boss mechanics. Established hazards must not disappear merely from a stun.
- Respect enemy/projectile/hazard budgets, quality settings, shared materials,
  pooling/instancing and GPU disposal. No large dependencies/assets without a
  concrete reason. Record source, licence and attribution for external assets.
- When runtime cached files change, bump `CACHE_VERSION` in `service-worker.js`.
  Add new required runtime files to `APP_ASSETS`; do not cache comparison galleries
  or these handoff documents. Documentation-only changes need no cache bump.
- Test hooks inject source into isolated browser pages. Do not ship QA globals,
  teleport/kill helpers or debug shortcuts into the game. Several tests match
  literal snippets in `index.html`; update affected hooks if those snippets move.

## Run locally

Serve the repository over HTTP; opening `index.html` via `file://` is insufficient
for ES modules and offline testing. Python 3 is required by the dev command.

```sh
npm ci
npm run dev
# Open http://127.0.0.1:3000/
```

Local play needs no build. For deployment, `npm run build` copies root HTML/JS/CSS,
the manifest, `_headers`, `assets/`, `icons/`, `images/` and `vendor/` into
`dist/` without transforming them, then checks every file referenced by
`index.html`, the manifest and the service worker's `APP_ASSETS` is present.
When adding a runtime file outside those locations, update `scripts/build.mjs`.
Use Node.js with the built-in `node:test` runner for
unit tests; the repository does not declare a supported Node engine range.

## Tests and tooling

```sh
npm test
```

Browser scripts require the `playwright` Node module and Chromium. **Playwright
is not declared in package.json**; `npm ci` alone does not provision browser
validation. Reuse an existing tool installation when available. One isolated
setup, without changing project dependencies, is:

```sh
npm install --prefix /tmp/vesper-browser-tools --no-save --package-lock=false playwright
export NODE_PATH="/tmp/vesper-browser-tools/node_modules${NODE_PATH:+:$NODE_PATH}"
export CHROMIUM_PATH=/absolute/path/to/chromium
export BASE_URL=http://127.0.0.1:3000
```

Install/provide a suitable Chromium binary separately. Scripts default to
`/usr/bin/chromium` and launch with software-WebGL flags. `BASE_URL` should be
explicit because existing scripts otherwise mix ports 3000 and 3011. Keep the
HTTP server running in a separate terminal, then run applicable suites:

```sh
npm run test:browser
npm run test:inventory-browser
npm run test:abilities-browser
npm run test:bosses-browser
npm run test:graphics-browser
npm run test:effects-browser
npm run test:hud-layout-browser
npm run test:boss-art-browser
npm run test:offline-browser
npm run test:save-store-browser
```

The offline suite installs the actual service worker; localhost or HTTPS is
required. Most other browser suites block service workers for deterministic
checks. Run browser suites serially for meaningful performance observations.

For deliberate visual/performance changes:

```sh
CAPTURE_PHASE=before npm run capture:visuals
CAPTURE_PHASE=after npm run capture:visuals
npm run capture:bosses
```

For the graphics v2 work ([docs/graphics-v2/SPEC.md](docs/graphics-v2/SPEC.md)), capture
`after` and run the deterministic budget check against the main baseline:

```sh
CAPTURE_PHASE=after npm run capture:graphics-v2
npm run test:graphics-budget
```

`CAPTURE_PHASE=before` regenerates the baseline from `CAPTURE_BASELINE` (default
`387a900`); only do that when deliberately moving the baseline. The budget check fails
unless every baseline scene is measured exactly once. The PR workflow's
`graphics-budget` job captures both phases on the same runner (`CAPTURE_SAMPLES=4`,
timings advisory) and enforces the budgets on the current head.

Capture scripts overwrite tracked gallery files and need the historical commits
available locally: `3b9b40e` for the floor baseline and `3bf7fb5` for the boss
baseline. `CAPTURE_BOSS_ART=1 npm run test:boss-art-browser` also writes boss images.
Inspect diffs before committing regenerated evidence.

Run tests appropriate to the change and report what actually ran. For gameplay
or rendering integration changes, use unit tests plus relevant browser suites;
verify all floors/both renderers when affected. For documentation-only changes,
check source accuracy, links and the diff; do not claim gameplay was retested.
Browser emulation/software WebGL does not establish physical iPhone/Android
performance, thermal behaviour or Safari compatibility. Keep that uncertainty
explicit until device testing is recorded.

## Phase 2 ARPG persistent development loop

For Phase 2 PR1–PR5, also read `docs/arpg/PHASE2-LOOP.md`,
`docs/arpg/PHASE2-STATUS.md` and `docs/arpg/PHASE2-PROMPTS.md` before
modifying related code. These files define a strictly sequential,
owner-gated five-PR process: **Claude Code develops; Codex independently
reviews the actual pushed PR head; Claude can correct at most three
reviewer-driven cycles per PR; the owner alone approves merges and
starting the next stage.** Missing explicit approval for the product
decisions in `docs/arpg/SPEC.md` §10 is a STOP condition for Phase 2
gameplay changes. Updating documentation/issue tickets does not grant
implementation permission; approval counts only as the approval record
defined in `PHASE2-LOOP.md`. Existing CI runs tests but does not
automatically invoke either coding agent. Exact pushed head SHAs and
reviewer verdicts are recorded in PR comments, not in tracked files. For
these loop sessions, the core/targeted context strategy in `PHASE2-LOOP.md`
satisfies the "Start here" reading: read the current-status sections of
PROJECT.md, TASKS.md and DECISIONS.md, and older history only when needed.

## Shared assistant handover

This is the authoritative instruction source for Codex, Claude Code, Copilot and
Gemini CLI. Read [TASKS.md](TASKS.md), [DECISIONS.md](DECISIONS.md) and
[docs/AGENT-WORKFLOW.md](docs/AGENT-WORKFLOW.md) alongside PROJECT.md. Check open
PRs before starting and do not overwrite unmerged work (including older preview
branches). The workflow guide defines start/development/completion steps and the
required handover summary. Record the exact pushed commit and PR URL; local-only
changes are not available to another assistant. Keep API credentials, private
information and assistant authentication out of source and CI logs.
