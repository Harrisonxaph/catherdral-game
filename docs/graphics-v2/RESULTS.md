# Graphics overhaul v2 — results, measurements and device checklist

Status: **all seven increments implemented on stacked development branches; nothing
merged or deployed.** Plan and decisions: [SPEC.md](SPEC.md). Side-by-side gallery:
serve the repository and open [index.html](index.html). Before = main `387a900`.

## Increments and pull requests

| # | Increment | PR | Branch |
| --- | --- | --- | --- |
| 0 | Specification, decisions D1–D5, baseline | #19 | `development/graphics-overhaul-v2` |
| 1 | Capture tooling, enforced budgets, readability floor | #20 | `development/graphics-v2-tooling` |
| 2 | Baked torch light and AO, value pass, CSS grade | #21 | `development/graphics-v2-lighting` |
| 3 | Architecture and five floor identities | #22 | `development/graphics-v2-architecture` |
| 4 | Telegraph progress, trails, impacts, puffs, halos | #23 | `development/graphics-v2-effects` |
| 5 | Rim light, armour detail, character animation | #24 | `development/graphics-v2-characters` |
| 6 | Loot rarity light, item icons, HUD ornament | #25 | `development/graphics-v2-loot-hud` |
| 7 | Wall cutaway and frustum chunk culling | #26 | `development/graphics-v2-camera` |

Each PR is based on the previous branch. Merge them in order (#19 → #26); each one's
diff then shows only its own increment.

## Increment 7 (camera, fade and culling)

- **Wall cutaway** replaces the old whole-chunk swap to translucent material clones,
  in two parts. A **front band** keeps main's behaviour: wall fragments more than 1.2
  south of the view target and within 9 sideways are dithered to about main's ghost
  level (72%), so telegraphs, loot and enemies behind south walls stay visible. (The
  first version cut only around actors; comparing against increment 6 showed south
  walls had become solid, which was corrected before review.) Around actors,
  wall-capable environment materials (`envMaterial`) discard fragments that are
  above ankle height (0.22), nearer the camera than a tracked actor, and within a
  soft screen radius (1.7) of it, using a 4×4 ordered dither with a faint remaining
  outline (88% maximum). Tracked actors: the hero always, plus up to three nearby
  living enemies eased in and out over 0.2 s. Walls stay opaque (no transparency
  sorting), with no material clones and no extra draw calls. Floors, puddles and ash
  use plain materials and are never cut.
- **Frustum culling:** chunk groups are tested against the real camera frustum with
  precomputed bounds (0.5 margin), replacing the fixed 22×26 box. Three.js still
  culls each batch; this mainly avoids traversing off-screen chunks (desktop High
  test scene: 9 chunks traversed instead of 16; Low's larger chunks: 4 either way).
- **Framing unchanged** (decision D1). No camera pitch change.

## Final measurements

Chromium software WebGL in this container, **not phone FPS**. Same seeded scene,
eight archetypes, all five floors.

| Preset · view | Draw calls vs main | Triangles vs main | Play-area brightness vs main | Contrast spread vs main | Min draw-call headroom | Min triangle headroom | Textures | Real-time torch lights |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Medium · desktop 960×720 | -2 to +20 | -20% to +9% | +13% to +39% | +42% to +117% | 32 | 17.6k | 9 | 2 |
| High · desktop 960×720 | -6 to +11 | -21% to -6% | +12% to +37% | +44% to +113% | 42 | 29.4k | 9 | 3 |
| Low · phone 393×852 | -8 to +8 | -33% to +10% | +4% to +24% | +41% to +51% | 14 | 6.0k | 8 | 0 |
| Medium · phone 393×852 | -9 to +18 | -33% to +13% | +6% to +23% | +10% to +24% | 33 | 15.2k | 9 | 2 |
| High · phone 393×852 | -8 to +17 | -16% to +13% | +5% to +22% | +11% to +23% | 36 | 13.1k | 9 | 3 |

Negative draw-call and triangle deltas come from increment 7's frustum chunk culling
(Three.js's per-batch sphere culling is looser than the chunk boxes). The budget check
(`npm run test:graphics-budget`) passes for all 25 scenes. Headroom is the margin left
against the per-preset limits (Low +10% draw calls/+20% triangles, Medium/High
+20%/+30%).

Readability floor: every scene keeps at least 60% of main's play-area luminance and
90% of its luminance spread (decision D3); desktop scenes gained 30–80% contrast.
Floor build time: about 27–105 ms against main's 24–69 ms (one-off per floor).
Frame-time samples are advisory only: identical code varied by up to 2.7×.

## Tests added across the overhaul

- Unit: `tests/graphics-budget.test.cjs` (budget and readability checker),
  `vfx-state.test.cjs` (budgets, telegraph progress truthfulness against
  `containsHazard`, trails, pools, pose curves), and light-field, occlusion, theme
  and mote tests in `graphics.test.cjs`.
- Browser: `tests/effects-browser.cjs` (halos, trails, impacts, puffs, pause freeze,
  scorch budget, telegraph growth, rim, swing, wind-up, cape, death, loot, icons,
  cutaway, frustum culling; Low and High) and `tests/hud-layout-browser.cjs` (main
  `387a900` and the head rendered in the same browser at four viewports, 23
  HUD/control/inventory rectangles compared, and 44px touch targets). The graphics suite gained baked-light, grade and the
  walkable-cell decoration rule. Each new check was verified to fail when its
  feature was deliberately broken.
- Capture and budget: `npm run capture:graphics-v2`, `npm run test:graphics-budget`.

## Review fixes (2026-10-28)

Applied on the owning branch and merged forward through the stack:

1. **#20, budget coverage:** `check()` fails on missing, duplicate or unknown scenes
   and empty inputs (an after-capture with 1 of 25 scenes now fails). The PR
   workflow's `graphics-budget` job captures the baseline and the current head on
   the same runner and runs the check; the unit job checks the committed captures.
2. **#23, paused trails:** `pushTrail()` adds no samples and ages nothing when no
   simulation time elapsed. Repeated paused redraws during a swing leave the trail
   identical (unit and browser tests).
3. **#25, loot instance buffers:** ring, glint and beam writes and draw counts are
   bounded by capacity (beams keep room for pickups); the nearest drops get effects
   and no gameplay loot is removed. Tested with 60 drops and 8 simultaneous pickups.
4. **#25, HUD layout:** the stored snapshot (font- and machine-dependent; it failed
   on unchanged main in CI) is replaced by a same-browser comparison against the
   baseline commit. Under forced different fonts the old test fails (47 mismatches)
   and the new one passes; a 6px shift and a 40px attack button are both caught.

Each new check was verified to fail with its fix removed.

## Known limitations

- Characters and bosses are still **procedural pivot rigs**: no skinned meshes,
  sculpted models, painted textures or authored animation clips.
- The rim light and the wall cutaway modify Three.js standard-material shaders. They
  compile in Chromium; iOS Safari and older Android GPUs are unverified. A GLSL
  compile failure there would break the affected materials rather than fall back.
- Not done from the spec: fire flipbook textures (Low has no texture slot left),
  per-actor dissolve (shared materials; ash puffs instead), new acid visuals, a camera
  pitch change (kept with D1), and a full-screen grade/bloom pass (D2).
- The dithered cutaway shows a visible stipple up close. Slab edges catch the
  directional light as thin lines (present on main; more edges now).
- Budgets are tight on Low (textures at the 8 limit) and Medium (triangles).
- Portrait and PWA icon provenance remains unverified (D4).

## Remaining asset work (not in scope)

Licensed, mobile-ready skinned GLB models and animation clips for the hero, the eight
archetypes and the three bosses (with the royal axe), each with recorded source,
author and redistribution licence. See `assets/bosses/ASSET-REQUIREMENTS.md`.
Optional: painted item art and a texture atlas if Low's texture budget is
re-planned.

## Physical-device checklist (iPhone Safari and Android Chrome)

Start on **Low**, then repeat key checks on Medium and High, in portrait and landscape.

1. Load online once, then reload offline; confirm the game starts (cache
   `vesper-cathedral-v19-graphics-camera-r2`).
2. On every floor: torch pools visible, rooms without torches still readable, wall
   tops dark, floor variety present, nothing standing in doorways.
3. Characters render (rim light visible, no missing or black materials) and bosses
   render on floors 1, 3 and 5. **If any character or wall is invisible or black,
   stop and report the device and browser: it indicates a shader compile failure.**
4. Walk behind a south wall: a soft dithered window opens around the hero; it closes
   when you step away. Same for a nearby enemy.
5. Telegraphs: circles, rects and crosses grow to their outline; flame walls only
   brighten and their safe gap never moves; the final quarter pulses.
6. Combat: swing trail follows the strike arc; hit flashes; ash puffs on deaths;
   Execution leaves a scorch on Medium/High only.
7. Loot: rarity beams (legendary tallest), ring glow, glint on bonus items; pickup
   flash and rarity-coloured toast.
8. Inventory: twelve distinct icons, no horizontal scroll at small widths, 44px
   buttons; HUD frames do not overlap or shift controls.
9. Pause, background/resume and inventory freeze effects; 2D toggle hides the grade
   and still plays.
10. Note sustained frame rate and device warmth after five minutes of combat on each
    preset.
