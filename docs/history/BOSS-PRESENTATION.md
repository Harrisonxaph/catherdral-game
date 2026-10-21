# Boss presentation upgrade

Branch: `development/boss-presentation`, based on main `3bf7fb5` (merged PR #8).
This is an in-game Three.js presentation extension. Boss health remains
**1,000 / 2,500 / 4,000**. Boss AI, damage, hitboxes, timings, stun resistance,
loot, progression, player abilities, equipment and input are preserved.

## Implemented art and animation

- **Snakeling:** a continuous deforming serpent surface with a tapered, articulated
  head/jaw, curved poisonous fangs, green slit eyes, and an original 256px scale
  texture/bump map. Its spine ripples during movement, breathes at idle, rears and
  opens its jaw to attack, recoils when hit and slumps on death.
- **Flameghoul:** exposed ribs/skull/jaw, hunched undead proportions, layered charred
  armour, glowing fissures and animated fire tongues. Articulated shoulders,
  elbows, hips and knees support idle breathing, a heavy gait, melee swings and
  raised-arm fire gestures. Hit recoil overlays the attack pose without cancelling
  protected mechanics. On death it buckles forward and the flames die down.
- **Undead King:** skull/jaw/ribs, layered ancient royal armour, torn dark cloak,
  blackened crown and tarnished gold. A separately articulated, double-edged axe
  is held with two-hand grip poses and reused for the toss and persistent hazards.
  Idle, walking, wind-up, attacks, hit reaction and death all animate. Whirlwind
  retains the existing rotation and damage circle.

`boss-presentation.js` defines pure pose timing and quality budgets.
`boss-art.js` builds/animates the original models and exposes a clean replacement
boundary for future rigged GLBs. `boss-effects.js` batches bounded hazard effects
and falling masonry. `castle-view.js` integrates them with existing entities;
`index.html` loads the pure timing definitions. No boss simulation rewrite occurs.

## Signature effects and warnings

Acid bolts follow a visible arc from the boss into the sampled impact marker;
active pools bubble. The cross has animated flowing strips inside the two exact
rotating collision rectangles. Fire wall and frontal-strike flames are sampled
inside the same polygons used for damage. The safe gap remains empty. Physical
hazards use metallic sparks, and the King tosses the same recognisable axe model.
Warnings retain complete ground outlines and continuous fills; damaging effects
only appear after the existing warning period. Effects never expand a hitbox.

The existing four-second, skippable victory sequence now shows:

1. 0–0.85s: the King falls to his knees.
2. 0.85–1.5s: he releases the axe, which drops to the floor.
3. 1.15–1.45s: all four ritual candles flare, even if previously extinguished.
4. After 1.7s: falling masonry and bounded camera shake begin the cathedral collapse.

This is visual collapse, not a new damaging hazard or permanent map destruction.
Candle `lit` flags and ward calculations are never changed by the sequence.
Skipping clears the effects and retains the existing victory/exit flow.

## Assets, licensing and honest quality limits

**These are bespoke procedural surface models and pivot animations, not purchased
or professionally sculpted/skinned characters.** No third-party boss art was
bundled; all new geometry, textures and effects were authored in this change.
They are materially more distinct than the previous primitive assemblies, but
professional creature anatomy, painted textures, cloth skinning and authored
motion remain external art work. This does not claim AAA asset fidelity.

No matching rigged boss models exist in the supplied repository. Arbitrary models
from asset sites were not bundled without verifying both their licence and actual
rig/animation suitability. The precise external asset requirements, clip names,
web redistribution rights and integration steps are in
[assets/bosses/ASSET-REQUIREMENTS.md](../../assets/bosses/ASSET-REQUIREMENTS.md).

## Performance, cleanup and offline support

Shared geometries/materials, merged rigid surfaces per bone and instanced flame,
acid, spark and rubble batches keep rendering bounded. The serpent updates a
40×12-ring surface, rather than allocating geometry each frame. Quality changes
and floor changes dispose instance buffers, per-model merged geometry and owned
candle materials. Decorative effects have no real-time shadow maps or extra
lights. No dependencies or downloaded asset libraries were added.

| Quality | Ghoul flame tongues | Total hazard motes | Victory masonry |
|---|---:|---:|---:|
| Low | 8 | 48 | 12 |
| Medium | 14 | 96 | 24 |
| High | 18 | 144 | 36 |

The new modules are service-worker cached with a new cache version. The Canvas
fallback and its existing functional warnings/controls remain available. The
advanced rigs and full kneel/drop/collapse sequence are Three.js features; Canvas
retains simplified sprites and the existing skippable narrative sequence.

## Verification and device testing

Run `npm test`, `npm run test:boss-art-browser`, and the existing gameplay,
bosses, inventory, abilities, graphics and offline browser suites. Serve locally
first; use `BASE_URL` when not serving port 3011 (existing suites may default to
3000). Browser testing uses Chromium software WebGL; it does not verify actual
Safari/Android GPU frame rates or thermals.

The new browser tests check every boss's pose states, non-mutating rendering,
finite geometry, quality rebuild allocation bounds, fire/effect budgets, exact
hazard boundaries, all four candle flares, axe-drop timing and skip cleanup.
Unit tests cover the pure animation clocks, death ordering and collision samples.

`npm run capture:bosses` records equivalent seeded before/after scenes using
main `3bf7fb5` as the baseline. See `docs/boss-presentation/metrics.json` for actual
software-renderer draw calls, triangles and median/95th-percentile submission +
GPU-finish timings. These measure an idle boss scene, not worst-case encounters.
Visual additions have a cost; do not treat software timing as a phone FPS promise.

For a real-device acceptance pass, start with Low on iPhone Safari and Android
Chrome. Fight each boss with the starter equipment; inspect acid/cross boundaries,
the moving wall's clear gap, frontal-strike rear escape, the three-axe cap and
candle interactions. Try all three player abilities, inventory pause, background
and resume, and offline reload. Observe kneel → dropped axe → four candle flares
→ falling masonry, then test Skip and the final exit. Repeat at Medium only if
frame pacing stays responsive on that device.

### Recorded equivalent desktop scenes (Medium)

| Boss | Draw calls before → after | Triangles before → after | Median ms before → after |
|---|---:|---:|---:|
| Snakeling | 95 → 94 | 32,116 → 35,612 | 1.3 → 3.4 |
| Flameghoul | 93 → 115 | 34,552 → 42,884 | 1.3 → 2.9 |
| Undead King | 107 → 127 | 39,846 → 48,638 | 1.3 → 2.9 |

These software-renderer samples were collected alongside browser verification;
shared-host load and shader compilation introduce noise (King after p95: 32.5ms).
Use the gallery to judge visual differences, and real devices to judge performance.
