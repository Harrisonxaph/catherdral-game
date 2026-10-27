# Graphics overhaul v2 — visual specification and plan

Status: **approved by the owner on 2026-10-27** ("Approve"), with the default
answers to the section 9 decisions recorded there. Implementation proceeds in the
increments of section 7, one PR each. Branch `development/graphics-overhaul-v2`, based on main `387a900`
(2026-10-27, after PR #17). No merge or deployment is authorised.

## 1. Starting point

This is a second pass, not a rebuild. Stage 4.5 (`docs/history/VISUAL-OVERHAUL.md`)
and the boss presentation pass already provide chunked instanced masonry, arches,
columns, tombs, banners, ACES tone mapping, per-floor fog and palettes, nearest-torch
point lights (0/2/3 by preset), shared contact-shadow decals, foreground wall fading,
articulated procedural characters, procedural bosses, instanced hit/projectile
batches, hazard motes and Low/Medium/High presets. All of it stays and is extended.

Baseline captures of current main (same seeded scene, all five floors; phone
393×852 at Low/Medium/High and desktop 960×720 at Medium/High) are the
`before-*` files in [`captures/`](captures/), with `before-metrics.json`. They are
produced by `CAPTURE_PHASE=before npm run capture:graphics-v2`, which serves every
runtime file from main `387a900`. View them side by side with [`index.html`](index.html).
What they show:

| Observed weakness | Evidence | Cause in source |
| --- | --- | --- |
| Flat, evenly lit rooms; torch pools barely read | `main-1-960`, `main-5-960` | Hemisphere 1.35 + directional 3.2 dominate; on Low (the phone default) there are no local lights |
| Repetitive grid floors | all floors | one slab size, 4 rotations, sparse flush details |
| Wall tops read as flat cardboard slabs (sand-coloured on Floor 5) | `main-5-960` | single trim box cap lit by the top-down directional light |
| Characters merge with the floor, small on phones | `main-3-393` | similar values in body and floor materials, no rim/edge separation, 10.8-unit portrait span |
| Floors differ mainly by tint | all floors | palette swap over a shared kit; few signature props |
| Telegraphs are flat translucent fills with no wind-up progress | boss captures | constant-opacity warning material |
| Weapon swings are a torus arc; deaths topple and vanish | source | `flashes` torus, 0.4s tip-over |
| Loot is a coloured disc plus a primitive; inventory has three icon shapes | source | `castle-view.js` loot block, `inventory-ui.js icon()` |

Baseline cost (Chromium software WebGL, **not** phone FPS): 250–272 draw calls and
79–100k triangles per scene; mobile Chapel Low/Medium/High = 221/256/269 draw calls.

## 2. Visual identity: "Ash and candlelight"

An original look built on one rule: **warm, flickering light pools against cold,
heavy stone, with darkness between them.** The deeper you go, the warmer and more
ruined the cathedral becomes, ending in ember and ash.

- Light is the main subject. Readable warm pools at torches and braziers, cool
  bounce elsewhere, true darkness at room edges. Combat areas are never unreadable.
- Weathered, heavy materials: chipped masonry, worn walkways, soot above flames,
  damp or ash staining at wall bases.
- Silhouettes first: every actor separates from the floor by value and a rim of
  light, even on Low.
- Restraint: a small palette per floor and one signature accent colour.

Diablo IV and Dark Souls are used only as a **quality and mood bar** (contrast of
warm light and cold shadow, weathered surfaces, readable silhouettes). Guardrails:
no reference images traced or copied; no models, textures, icons, UI layouts, fonts,
logos, characters, creature designs or named motifs taken from them; no asset rips,
no "in the style of" generation from their art. All new art is procedural code in
this repository, or externally sourced only with a recorded licence (section 4).

## 3. Workstreams

Each item names the technique, the files it touches and how it scales by preset.
"Free" means build-time work with no extra per-frame draw calls.

### W1 Architecture (`environment-art.js`, `art-materials.js`)
- Wall tops: chamfered cornice profile with a darkened top face and soot gradient,
  replacing the flat trim slab. Free (same instance batches).
- Floor variety: three slab sizes, border courses along walls, cracked and missing
  slabs, worn centre paths (lighter, smoother instances along room axes), flush
  grout lines. Flush only; never above ankle height or on collision.
- New props in **blocked cells only**: rubble piles, collapsed column drums,
  sarcophagus variants with carved lids, wall reliefs (canvas-generated relief map
  on a shared material), candle clusters on niches, iron braziers.
- Procedural texture set grows from 4 to about 7 shared 128px canvases (adding
  relief, cracked slab and grime). Still no downloaded textures.
- Presets: Low keeps bevel-free blocks and the larger chunks but gets the cornice,
  floor variety and value work; Medium adds props and reliefs; High adds the densest
  props and far-wall ribs (existing).

### W2 Light, fog, shadow and grade (`castle-view.js`, `environment-art.js`, `graphics.js`)
- **Baked torch light (key mobile technique):** at build time, compute each floor
  and wall instance's distance to nearby torches and write a warm per-instance colour
  (`InstancedMesh.setColorAt`). This gives Low its torch pools at zero per-frame cost.
  Medium/High keep 2/3 real flickering point lights on top.
- Baked ambient occlusion: darken instances at wall bases, corners and under props
  the same way. Free.
- Rebalance: lower hemisphere/directional intensity so baked and real torch light
  dominate; per-floor exposure and fog density in `graphics.js` themes.
- Ground light decals: additive radial sprites under torches, pulsing with the
  existing flicker phase (one shared material, instanced).
- Fog: keep `FogExp2`; tune per floor; add a low "ground haze" band (instanced,
  translucent, depth-write off) on Medium/High.
- Contact shadows extended to pillars, tombs and props (existing shared decal).
  No real-time shadow maps on any preset.
- Colour grade: CSS vignette and per-floor overlay on every preset (no GPU cost).
  A full-screen grade/bloom render pass is **High-only and optional**, kept only if
  its measured cost fits the budget (see decision D2).

### W3 Characters (`character-art.js`, `boss-art.js`)
- Silhouette: fresnel rim light injected with `onBeforeCompile` into the shared
  character materials (no extra draw calls), tinted by the floor accent; higher value
  contrast for armour versus floor.
- Armour and cloth detail: layered pauldrons, tabards, belts and hood folds on the
  hero; class-specific additions per archetype; wraith translucency layers.
- Animation (still pivot rigs driven by simulation state): breathing idle, cape and
  cloth secondary motion, weight shift on turns, clearer wind-up anticipation,
  hit-flinch direction from the damage source, stun wobble, and a longer readable
  death (collapse, then ash dissolve, W4). Timing never moves a damage event.
- Bosses keep their models; gain the rim light, telegraph posing and improved
  materials. Professional skinned GLBs remain an asset gap (section 4).

### W4 Effects (`castle-view.js`, `boss-effects.js`, new pure `vfx-state.js`)
- Weapon trails: ribbon built from the blade-tip positions sampled during the
  existing attack window; pooled geometry, colour from rarity/ability.
- Hit impacts: additive flash sprite, directional spark spray (existing particle
  batch), brief ground scorch decal for heavy hits.
- Telegraphs: the warning fill grows from centre or edge in step with
  `h.age / h.warning`, with an edge pulse in the final 25%. Geometry stays exactly
  `hazardPolygons` / `containsHazard`; only opacity and fill progress change.
- Fire: procedural flipbook canvas (shared) for torches, flame wall and fire burst.
  Acid: animated pool surface plus bubbles from the existing mote budget.
- Death: alpha-hashed noise dissolve into an ash puff, inside the existing
  0.4s / boss death durations.
- A pure `vfx-state.js` holds budgets and progress maths, so Node tests can verify
  them without WebGL.

### W5 Loot, items and HUD (`castle-view.js`, `inventory-ui.js`, `inventory.css`, `visual-ui.css`, `index.html` HUD markup)
- Ground drops: rarity light beam (additive, instanced; Legendary taller with a slow
  pulse), rune ring decal, item-shaped mesh from the item's kind, and a small glint
  for items with rolled bonuses (✦).
- Pickup feedback: short beam collapse and spark burst at the drop, styled toast.
- Inventory icons: twelve original per-item SVG icons replacing the three generic
  shapes, plus rarity frames.
- HUD: textured iron frame, health and shield bar fill gradients, ability icon
  frames. Touch targets, layout positions and sizes stay unchanged.
- No changes to item rules, rarity tables, `equipment.js` or inventory transactions.

### W6 Camera, depth, culling and transparency (`castle-view.js`)
- Smooth foreground fade: per-chunk opacity eased over about 0.2s (shared faded
  materials), replacing the instant swap; walls in front of any visible actor fade too.
- Culling: camera-frustum test for chunks, flames and props, replacing the fixed
  22×26 box; keeps the 13-unit actor range.
- Depth: subtle height-based darkening of distant floor; slight camera pitch tweak
  for taller-reading walls.
- Framing: optional slight portrait zoom-in (see decision D1).

### W7 Five distinct floors (`graphics.js` themes, `environment-art.js`)

| Floor | Palette and light | Signature set dressing | Ambient |
| --- | --- | --- | --- |
| 1 Forgotten Crypt | Cold blue-grey stone; candle-amber pools | Burial niches with skulls, ossuary walls, cobwebs, sarcophagi | Dust motes, low cold haze |
| 2 Plague Halls | Sickly green-grey; jaundiced torchlight | Cracked floors with stagnant puddles, hanging censers, fungal growth, stained sheets | Drifting spores, green ground haze |
| 3 Crimson Chapel | Marble and plum; red stained-glass light | Pews and broken altars, candelabra, tattered crimson runners, lancet glass patches on the floor | Incense smoke wisps |
| 4 Hollow Sanctum | Deep blue stone; cold spectral blue flames | Floating broken masonry, rune circles, suspended chains, cracked mirrors | Rising spectral motes |
| 5 Throne of Ash | Charcoal and gold; ember-orange braziers | Ash drifts, collapsed columns, royal banners, scorched gold inlays, throne approach | Falling ash, ember sparks |

## 4. Asset and licence inventory

| Asset | Origin | Licence status | Action |
| --- | --- | --- | --- |
| Three.js 0.180.0 (`vendor/`) | three.js authors | MIT header present | none |
| All geometry, textures, characters, bosses, effects | procedural code in this repo | original, covered by repo MIT licence | stays procedural |
| UI and inventory SVG icons | inline in source | original | new icons also inline/original |
| Fonts | system fonts (Georgia, system-ui) | none bundled | no web fonts added |
| `images/forgotten-knight.png` (384², painted knight portrait) | **not recorded** | **unverified** | owner to confirm origin and licence (decision D4); not modified by this work |
| `icons/*.png` (PWA icons) | **not recorded** | **unverified** | owner to confirm; not modified |
| External GLB characters/bosses, authored animation | none bundled | n/a | remains outstanding; see below |

Remaining asset work, **not** in this scope unless approved and supplied: nine
skinned mobile GLB characters (hero plus eight archetypes) and the three boss GLBs
plus royal axe, per `assets/bosses/ASSET-REQUIREMENTS.md`, each with a recorded
source, author and redistribution licence. This plan improves the procedural rigs;
it does not claim professional sculpted or skinned quality.

## 5. Preset matrix (proposed)

| Feature | Low (phone default) | Medium | High |
| --- | --- | --- | --- |
| DPR cap | 0.85 (unchanged) | 1.25 | 1.75 |
| Baked torch light and AO | yes | yes | yes |
| Real torch point lights | 0 | 2 | 3 |
| Ground light decals | yes | yes | yes |
| Ground haze band | no | yes | yes |
| Rim light on actors | yes | yes | yes |
| Bump maps | no | yes | yes |
| Props and reliefs | minimal | full | full plus dense |
| Weapon trails | single ribbon | ribbon | ribbon plus glow |
| Death dissolve | fade | dissolve | dissolve plus ash |
| Loot beams | yes, short | yes | yes plus pulse |
| Full-screen grade/bloom | no | no | optional (D2) |
| Particle budget | 36 | 72 | 120 (unchanged) |

## 6. Performance budgets and risks

Acceptance budgets, measured with the capture harness in the same seeded scenes
against `captures/before-metrics.json` (software WebGL as a relative signal only).
`npm run test:graphics-budget` enforces draw calls, triangles, real-time lights,
texture counts and unchanged world digests per scene. Timings are reported but
only advisory: on identical code, repeated software-WebGL p50 samples differed by
up to 2.7× (1.4 → 3.8 ms), so they cannot gate a change.

- Low: draw calls ≤ baseline + 10% (≤ 245 in the mobile Chapel scene); triangles
  ≤ baseline + 20%; no new real-time lights; shared texture count ≤ 8.
- Medium/High: draw calls ≤ baseline + 20%; p50 frame time ≤ 1.5× baseline.
- No per-frame allocation in render loops (pooled trails, decals, beams).
- GPU allocation bounds through quality rebuilds and floor changes, as the graphics
  suite already checks.

| Risk | Likelihood | Mitigation |
| --- | --- | --- |
| Draw-call growth from props and decals | high | Everything instanced inside the existing chunk batches; budget assertions in tests |
| Fill-rate cost of additive decals, haze, beams on phones | high | Small screen coverage, Low variants, DPR caps unchanged; haze Medium/High only |
| Full-screen grade pass too expensive on mobile | medium | High-only, behind a measured gate, CSS grade elsewhere |
| `onBeforeCompile` shader changes break on Safari/older GPUs | medium | Minimal GLSL, graceful fallback to the plain material; WebKit check where available; device check |
| Baked light makes the build step slower on large floors | medium | Spatial grid of torches; measure `buildMs` (already reported) |
| Effects drifting from simulation (telegraph shown wrong) | low | Read-only use of hazard state; tests compare visual fill to `containsHazard` samples |
| Darker grade hurts readability | medium | Readability floor: hazards and enemies keep minimum contrast; screenshot review per floor |
| Regressions in Canvas fallback | low | Canvas path untouched except shared colour tokens; existing fallback tests |
| Shader compile hitches on first frame | medium | Warm-up compile at floor build behind the existing loading path |
| Merge friction with other open work | low now | No open PRs at audit; increments kept small |

Physical-device FPS, thermals and Safari behaviour cannot be verified here; each
increment's PR will list the device checks still required.

## 7. Implementation sequence (one reviewable increment each)

0. **This spec, baseline captures and approval** (this PR).
1. Capture tooling: make the visual-capture baseline commit configurable and write
   to `docs/graphics-v2/` so historic galleries are untouched; add budget assertions
   to the graphics suite.
2. Light and value pass (W2): baked torch light and AO, rebalanced lights, ground
   light decals, CSS grade, per-floor exposure. Largest visual gain for least cost.
3. Architecture and floor identities (W1, W7).
4. Effects (W4) with `vfx-state.js` unit tests.
5. Characters and animation (W3).
6. Loot, inventory icons and HUD (W5).
7. Camera, fade and culling (W6), final full measurements, gallery and device
   checklist.

Each increment: before/after screenshots for all five floors at 960×720 and
393×852 plus Low/Medium/High samples, metrics JSON, all unit and seven browser
suites, Canvas fallback and offline checks, `CACHE_VERSION` bump whenever cached
runtime files change, and new runtime files added to `APP_ASSETS` and the build
check. Increments can be separate PRs or commits on one PR (decision D5).

## 8. Validation plan

- Unchanged: world-grid digests, simulation timing and collision (existing digest
  in the capture metrics; `npm test` 69 cases).
- New unit tests: `vfx-state.js` budgets and progress maths; baked-light function
  (pure) bounds and determinism; theme completeness for five floors.
- Browser: graphics suite extended with per-preset draw-call/texture budgets and
  allocation bounds after rebuilds; telegraph fill compared to `containsHazard`
  samples; trail/decal pools never exceed limits; Canvas fallback and context loss;
  offline reload with new modules cached.
- Manual (owner, real devices): iPhone Safari and Android Chrome on Low, then
  Medium/High; portrait and landscape; all five floors and bosses; readability of
  telegraphs; inventory; background/resume; offline reload.

## 9. Decisions (resolved 2026-10-27)

The owner approved the specification without answering each question separately,
so the defaults proposed here apply. Any of them can be revisited in a later PR.

- **D1 Camera zoom on phones: keep current framing** (10.8-unit portrait span).
  A closer camera would show less of the room and change how early enemies are seen.
- **D2 Full-screen grade/bloom: CSS-only grading on every preset for now.** A
  High-only render pass needs a separate measured proposal before it is added.
- **D3 Darker balance: approved**, with the contrast floor for hazards and enemies
  in section 6.
- **D4 Portrait and PWA icons: provenance remains unverified.** This work does not
  modify `images/forgotten-knight.png` or `icons/*.png`.
- **D5 Delivery: one PR per increment**, each based on the previous increment's
  branch, so each review shows only its own change.
- **External art: out of scope.** The plan stays fully procedural.
