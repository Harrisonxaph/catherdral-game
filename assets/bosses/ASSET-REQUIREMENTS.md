# External boss art handoff

No external models or animation files are currently bundled. The game uses
original procedural boss geometry and textures in `boss-art.js`.
This manifest specifies what is still required for professionally authored art;
it is not a list of downloaded or licensed assets.

| Asset | Target mobile budget | Required rig and clips |
|---|---|---|
| `snakeling.glb` | 5–8k triangles; 18–24 bones; 512–1024px atlas | Continuous coiled spine, head/jaw/fangs; Idle, Slither, WindupAcid, SpitAcid, WindupCross, ChannelCross, Hit, Stagger, Death |
| `flameghoul.glb` | 6–10k triangles; 24–35 bones; 512–1024px atlas | Deformed undead body/charred armour; Idle, Walk, WindupMelee, Melee, WindupWall, CastWall, WindupHalf, CastHalf, Hit, Stagger, Death |
| `undead-king.glb` | 8–12k triangles; 28–40 bones; 512–1024px atlas | Skeletal monarch/royal armour/skinned cloak; Idle, Walk, WindupMelee, Melee, WindupWhirlwind, Whirlwind, WindupToss, Toss, Extinguish, Hit, Stagger, KneelDeath |
| `royal-axe.glb` | 500–1,000 triangles; shared texture atlas | Separate object with two grip sockets and release transform; reused for held, airborne, ground and death axe |

Use one body material (two maximum when transparency is necessary), packed ORM,
normal maps, no embedded large lights or cameras, no baked root motion moving the
actual entity, and consistently named hand/head/weapon/flame sockets. Aim for
at most 1–1.5 MB per character, with shared atlases where possible. Validate the
actual decoded textures and GPU memory on mobile, not just compressed file size.

Animation timing is subordinate to the existing simulation. Export wind-up,
strike and recovery clips separately so they can be sampled at existing action
phases. `KneelDeath` must kneel by .85s, release the separately rendered axe at
.85–1.5s and hold the kneeling pose through 4s. Candles/masonry are existing engine
effects, not part of the character file. The 0.75s boss stagger must not restart
or cancel protected attacks.

## Licence acceptance record required per delivered file

Before including an asset, record its exact source URL, author, original filename,
asset version/date, licence name/version, attribution text and the licence file.
A purchased model must explicitly allow embedding and serving its files inside a
commercial browser game; retain proof of purchase privately. CC0 assets are useful
where suitable; CC-BY requires the correct attribution. Do not assume that a free
preview, game-engine-only licence, noncommercial licence or "editorial use" allows
web redistribution. Check animation and texture licences as well as mesh rights.

## Integration steps

1. Supply the three optimised GLBs, separate axe and verified licence records in
   `assets/bosses/`; inspect real scale, topology, clips and material counts.
2. Add Three.js's matching-version GLTFLoader as a local offline dependency, without
   a large model library. Cache loader and assets in the service worker.
3. Implement a GLB adapter behind `createBoss` / `animateBoss`, mapping the pure
   `VesperBossPresentation.pose` and actual boss action phases into clip sampling.
   Keep the current procedural models available if loading fails.
4. Preserve entity positions/radii, hit times, targeting, hazards and cooldowns;
   release/reuse the axe through its sockets. Preserve health and stun indicators.
5. Dispose mixers, per-instance resources and loader assets correctly; rerun unit,
   all browser, offline and real-device tests. Review actual gameplay screenshots
   and performance before replacing procedural art in production.
