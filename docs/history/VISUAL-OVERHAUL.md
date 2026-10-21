# Stage 4.5 — Visual overhaul

Development branch: `development/stage-4-visual-overhaul`. Based on completed Stage
4 (`3b9b40e`, merged PR #6), exactly as requested. The three abilities were verified
before work. PR #8 now integrates main's completed Stage 5 encounters, retaining
Snakeling 1,000 HP, Flameghoul 2,500 HP and Undead King 4,000 HP. The upgraded
regular-character rigs and environment remain alongside the existing bespoke boss
models, cinematic camera, candles and exact collision-matched boss hazards.
No production merge is performed.

## What actually changed

The real Three.js game remains the default. The renderer consumes the same world,
player/enemy objects, hit events, hazards, equipment and simulation time. There is
no replacement combat engine or static background. `floors.js`, `enemy-system.js`,
`equipment.js` and `abilities.js` remain unchanged. Stage 5 simulation and
narrative changes are preserved from main. World-grid hashes in all ten before/after scenes match exactly.

### Cathedral architecture and five floor identities

`environment-art.js` builds chunked instanced masonry with bevelled blocks and
floor slabs, broken wall courses, fluted columns with bases/capitals, pointed
lancet arches, recessed tracery, torn banners, tomb niches, sarcophagi, statuary,
wall chains/web-like fans and small flush debris/bone details. Final rooms retain
open approaches and the existing stair. The fifth floor adds a throne recess,
gold ornament and four **decorative** corner ritual markers, without interaction
or any King implementation. High quality adds far-wall broken vault ribs and
subtle additive light-shaft approximations; there is no opaque overhead ceiling.

Crypt: cool blue-grey masonry and burial details. Plague Halls: damp green stone,
toxic stains/growths and oxidised metal. Chapel: marble, crimson cloth, ritual
colours and luminous lancet panes. Sanctum: spectral blue surfaces and suspended
motes. Throne: charcoal stone, pale ash inlays, royal metal and the throne recess.

Tall ornaments are attached to blocked wall cells. Dirt, chips, bone fragments,
ash inlays and corner markers on walkable cells are shallow, non-colliding details.
Neither world occupancy nor entity movement/collision changes. Nearby foreground
wall chunks fade so they do not hide the hero. Ceilings are represented by far-wall
ribs, retaining combat visibility.

### Materials, lighting and effects

`art-materials.js` generates original deterministic 128×128 stone, marble, fabric
and weathered-metal surfaces in memory, shared across floors and actors. Textures
provide colour, roughness variation and optional bump mapping. No texture downloads
or model libraries were added. Canvas-based contact shadows are shared 32px maps.

The renderer uses ACES tone mapping, cool hemisphere/directional light, bounded
nearest-torch point lights, warm flicker, floor-tinted exponential fog and restrained
atmospheric motes. Low disables local point lights, bump maps and atmospheric motes.
Contact shadows are approximations, not expensive real-time shadow maps. High light
shafts are translucent geometry, not physical volumetric scattering.

Existing hit sparks and magical projectiles now use two reusable instance batches,
with per-instance colours and bounded counts. Existing ability flashes have luminous
trails; Aegis has a smoother shell and blue sigils. Dangerous ground-warning shapes
and damage radii remain unchanged. Damage numbers, stun halos, shield bars and the
Canvas effects are preserved. Small visual camera shake is bounded and does not
change the camera target or movement.

### Characters and animation

`character-art.js` replaces the old single-piece block figures with articulated
procedural models: shaped torsos/robes, skull sockets/jaws/ribs/spines, segmented
arms and legs, shoulder armour, gauntlets/boots, helmets/visors, cloth capes,
blade/axe profiles and shield bosses/rims. Ghouls hunch and have elongated claws;
plague growths, brute horns/armour, caster hoods/staffs and semi-transparent spectral
wraiths make the eight types distinct. Equipment still controls main/off-hand
visibility and two-handed/dual-wield poses through the original definitions.

Pivot rigs animate walking limbs, turns, wind-up, strike follow-through, heavy
Execution recovery, dodge lean, shield reactions, damage/stun motion and short death
collapse. Damage still occurs at the existing simulation instant; animation never
holds up a hit or changes attack speed/range. Rigid pieces sharing a material are
merged per bone. Recently culled actors use a small per-type pool; merged geometry
is disposed on excess eviction, floor rebuild and quality rebuild.

These are original, improved procedural rigs, **not professionally sculpted,
skinned glTF characters or authored animation clips**. They remain stylised and are
not AAA character assets. The largest remaining fidelity gap is bespoke character
sculpting, skinning, texture painting and animation.

### Interface and quality

`visual-ui.css` adds iron/stone panel treatment, restrained metallic edging,
health-bar highlights, rarity styling and compact SVG equipment icons. Inventory
transactions, capacity and tap controls remain unchanged. Ability cooldowns retain
numeric seconds and add a lightweight conic overlay, updated only when its angle
changes. No combat control is moved or resized.

Open **Pause → Graphics quality** to select Low, Medium or High. It is stored as
`vesperGraphics` in localStorage, with safe fallback if storage is unavailable.
Touch/coarse-pointer or narrow devices default to Low; other devices to Medium.
Manual selection is respected on subsequent visits, including touch devices.

| Quality | DPR cap | Decorative level | Torch lights | Rendered hit particles |
| --- | ---: | --- | ---: | ---: |
| Low | 0.85 | Basic architecture, larger instance chunks, no bump | 0 | 36 |
| Medium | 1.25 | Bevels, wall detailing, bump, 24 motes | 2 | 72 |
| High | 1.75 | Additional ribs/shafts, 42 motes | 3 | 120 |

DPR never exceeds the device's native DPR. The player light is also disabled on Low.
The Canvas toggle and WebGL-context-loss fallback remain available at every quality.
Changing quality rebuilds only presentation resources; it cannot refill shields,
reset abilities, change gear or move entities. Shared geometry/material/texture
caches are bounded; instance buffers, per-actor merged geometry, transient trail
geometry and damage-label textures are explicitly released when appropriate.

## Before/after evidence and performance

Open `docs/visual-comparison/index.html` on the preview. It includes actual gameplay
captures for **all five floors**, both 960×720 and 393×852, with identical seeded
layouts, actors, camera and simulation time. The fixed scene arranges all eight
archetypes in a room through test-only injection, rather than changing production
spawns. JPEG encoding keeps the comparison assets compact; the game does not load
or offline-cache this gallery.

`tests/visual-capture.cjs` can reproduce both sides: `CAPTURE_PHASE=before` reads
renderer/HTML/inventory code from commit `3b9b40e`; `CAPTURE_PHASE=after` uses the
working tree. Both JSON reports record draw calls, triangles, geometry/texture
counts and median/95th-percentile frame submission + GPU-finish time after warm-up.
The upgraded report also measures all three quality settings in the same mobile
Chapel scene. Measurements run in Chromium/software WebGL, not on physical phones.
More detailed actors/materials can cost more frame time and draw calls; chunk
culling reduces whole-dungeon triangle submission. See the actual JSON rather than
assuming that fewer triangles guarantees higher FPS.

Representative desktop measurements from the recorded run:

| Scene | Draw calls before → after | Triangles before → after | Median ms before → after |
| --- | ---: | ---: | ---: |
| Floor 1 | 167 → 272 | 83,384 → 89,602 | 1.4 → 6.0 |
| Floor 5 | 152 → 263 | 287,180 → 83,990 | 0.8 → 3.0 |

The extra draw calls/material work has a measurable cost despite reduced geometry
submission on larger floors. Some software-renderer 95th-percentile samples are
noisy; these are observations, not guaranteed frame budgets. The mobile-sized
Chapel measured Low/Medium/High at 221/256/269 draw calls, with Low using DPR 0.85,
no point lights or bump maps. Physical-device profiling is still required.

## Verification and mobile acceptance

Commands:

```
npm test
npm run test:browser
npm run test:inventory-browser
npm run test:abilities-browser
npm run test:graphics-browser
npm run test:offline-browser
CAPTURE_PHASE=before npm run capture:visuals
CAPTURE_PHASE=after npm run capture:visuals
```

Serve via `npm run dev`, with optional `BASE_URL` and `CHROMIUM_PATH` overrides.
There are 46 Node cases across gameplay, enemies, equipment, abilities and graphics
policy. Browser tests exercise eight enemies, all five floor exits, equipment
loadouts, loot, inventory pause, abilities, touch movement, cooldowns, small-screen
control rectangles and both renderers. Graphics tests check quality defaults,
settings persistence, unchanged player/gear/grid/timer state, GPU allocation bounds
through rebuilds, all floor themes and synthetic context loss/restoration. An offline browser check
installs the actual service worker, reloads without network, starts 3D play and
activates Aegis with the new modules served from cache.

Before production use, test iPhone Safari and Android Chrome on real devices:
walk and fight through each floor on Low, try Medium/High, rotate the phone, check
foreground visibility and telegraph edges, use all loadouts/abilities, inspect the
scrolling inventory, and test background/resume, offline reload and Canvas fallback.
Physical FPS, thermal behaviour, Safari driver recovery and real-device gesture
behaviour have not been verified by browser emulation.

## Outstanding asset requirements and precise next step

For professional character quality, supply or commission **nine licensed,
mobile-ready skinned glTF/GLB assets** (hero + eight archetypes), each roughly
2–6k triangles, one compact material/atlas and 512px–1k textures. Include idle,
walk/run, attack/wind-up/recovery, hit, stun and death clips; the hero also needs
one-hand/shield, dual-wield and two-handed poses plus dodge. Validate commercial
redistribution licences and record source/author/licence in an asset manifest.
Then add a GLTFLoader/AnimationMixer adapter behind `createCharacter` and
`animateCharacter`, preserving their sockets and mapping current simulation states
to clips without moving damage events. This requires art assets and animation work;
no external character licence or production asset quality is claimed here.

Full vaulted interiors, physically accurate volumetrics and high-resolution
photogrammetry are also outside this mobile-focused pass. The current alternatives
are deliberately visible, efficient geometry/material improvements. The integration preserves main’s custom bosses and balance; it adds no new
abilities, inventory mechanics or changes to their gameplay.
