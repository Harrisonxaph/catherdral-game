# Experimental VESPER loot modifiers

Owner scope: first Diablo II-inspired loot experiment, without imported content,
new dependencies, or changes to rarity/drop tables, existing items or passives.
Inspiration is individual variation between otherwise identical drops. Names,
values and additive integration are original VESPER mechanics.

Audited main: d391208 (2026-10-27); no open PRs. All four root memory documents,
equipment.js, inventory-ui.js, index.html, service worker and relevant tests read.

Approach: optional immutable `modifiers: [{key,value}]` on newly generated items;
keep `{id,key}` valid and `definition(instance)` returning the unchanged base.
A separate pure itemStats resolver combines bounded bonuses for calculation.
Changing shared definitions would leak rolls between items; introducing a new
inventory format would unnecessarily disrupt atomic transactions. Neither is used.

Initial engineering balance assumption (experimental, not device/playtest proven):
one modifier per new Common/Rare weapon, chosen uniformly from Ash-honed damage,
Quickened attack speed and Watchful critical chance. Common: +1–3 damage,
+2–4% speed, +1–2 percentage points crit. Rare: +2–5 damage, +3–6% speed,
+2–3 points crit. Integer steps; no floor scaling. Shields receive no offensive
rolls; Legendary items, starter equipment and legacy instances are unchanged.
Config is frozen and public for future balancing; generation accepts injected RNG.

Roll once in the existing weighted loot function after rarity/item choice. More
RNG draws change subsequent seeded world outcomes; this is intentional, while
repeatable same-seed drops and unchanged rarity probabilities remain required.
No rerolls on pickup/drop, previews, equip, floor transition or UI opening.

Damage adds to that weapon before existing 0.4 off-hand weighting. Speed/crit add
through existing gear aggregation; retain 0.65–1.7 speed factor before dual 1.2,
0.13 minimum attack interval, 75% crit, and all defensive/passive caps. Read-time
validation ignores unknown/ineligible rolls and clamps finite values to per-rarity
bounds; only one roll contributes. Immutable new rolls cannot be edited in place.

UI lists rolled bonuses separately from unchanged base/effect descriptions and
adds explicit attack-frequency/crit deltas beside existing damage/shield deltas.
Keep textContent safety, small-screen scrolling, pause and touch wiring unchanged.
Bump service worker version because runtime cached files change; no new runtime
files or cache entries. No main edits, merge or deployment.

Risks: passive effects must stay single-counted; speed means frequency rather
than interval in UI; full-backpack swaps must remain atomic; shield/Aegis capacity
must not refresh; repeatable drops exclude serial ownership IDs. Run baseline and
final unit/build checks, all relevant browser suites including offline and both
renderers. Real-device Safari/Android performance remains unverified.
