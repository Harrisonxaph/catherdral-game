# Phase 2 persistent loop — current state and handover ledger

This file is the **cross-session coordination record** for milestones, approvals, correction-cycle counts and history. It is not a substitute for reading GitHub PRs, actual code or CI. Claude updates it inside its development PRs; Codex reviews exact pushed heads and must not change implementation during its independent review. Owner approval must come from an approval record (see [PHASE2-LOOP.md](PHASE2-LOOP.md#approval-evidence)), not be inferred from an issue, an AI statement or this template.

**Exact SHAs:** a tracked file cannot hold the SHA of the commit that contains its own final update. Exact pushed head SHAs and reviewer verdicts are therefore recorded in **PR comments** (developer handoff and Codex review templates in [PHASE2-PROMPTS.md](PHASE2-PROMPTS.md#comment-templates)). This file records base SHAs, PR URLs, statuses, counts and, in the next stage's first commit, the previous stage's merge commit. Never commit only to record a SHA. If an issue body asks for SHAs here, PHASE2-LOOP.md takes precedence.

## State snapshot — setup on 2026-10-29

- Repository: `Harrisonxaph/catherdral-game`
- Main at setup: `152f5178808f3e59c458ce1bc20320c09ae0eeff` (PR #31 merged). **Re-fetch main before every new phase.**
- Open PRs at setup: none observed.
- Phase 1A: PRs #29, #30, #31 merged. Save modules exist but are **not loaded by the game**; this is NOT a playable Save/Continue feature.
- Current stage: `P2_PR1` (planning/preparation only).
- Development status: `NEEDS_OWNER_APPROVAL` for `docs/arpg/SPEC.md` §10 policy choices, before Phase 2 gameplay implementation.
- Developer: Claude Code (separate implementation session).
- Reviewer: Codex (fresh independent review session, no implementation on same PR).
- Correction budget: **three reviewer-driven fix cycles per PR** after initial implementation, counted here and never reset across sessions.
- Deployment: **not authorised**. Automatic merging: **not authorised**.
- Orchestration: manual agent handoffs; no unattended Claude/Codex runner connected by these files.

## Owner design/policy gate

Record dated, explicit approval of the Phase 2 design and any deviations here *before* coding gameplay. The issue tickets and this loop setup are planning approval only. **Only the owner ticks these boxes** (by an owner commit), or links an `OWNER APPROVAL:` comment below; agents never tick them.

- [ ] Owner approves or revises `SPEC.md` §10 architecture, checkpoint and Continue approach.
- [ ] Owner approves or revises no-death-penalty and persistent resource/cooldown policies.
- [ ] Owner approves or revises one-character-slot, campaign/replay reset and legacy memory rules.
- [ ] Owner records treatment of proposed progression numbers (level cap, XP/stat growth, points) and stash/blacksmith defaults, even if implementation is deferred to later phases.
- [ ] Owner expressly authorises implementation of P2 PR1 (#32) after these decisions.
- [ ] Owner expressly authorises PR2–PR5 individually after acceptance/merge of the preceding PR.

Approval source (link to actual owner decision/PR comment): **NOT RECORDED**.
Policy deviations/approved decisions: **NONE RECORDED**.
Do not replace this with an AI assumption.

## Sequential work queue

| Step | Issue | Status | Base SHA | PR URL (head SHAs and verdicts in its comments) | Fix cycles | Merge commit | Owner decision |
|---|---|---|---|---|---|---|---|
| P2 PR1 | [#32](https://github.com/Harrisonxaph/catherdral-game/issues/32) | MERGED_BY_OWNER | `ef177df` | [#38](https://github.com/Harrisonxaph/catherdral-game/pull/38) | 0 / 3 | `0ab4890` | authorised ([approval](https://github.com/Harrisonxaph/catherdral-game/issues/32#issuecomment-6549470246)); merged by owner |
| P2 PR2 | [#33](https://github.com/Harrisonxaph/catherdral-game/issues/33) | MERGED_BY_OWNER | `0ab4890` | [#39](https://github.com/Harrisonxaph/catherdral-game/pull/39) | 1 / 3 | `562f4e7` | authorised ([approval](https://github.com/Harrisonxaph/catherdral-game/issues/33#issuecomment-6549916332)); merge approved ([record](https://github.com/Harrisonxaph/catherdral-game/pull/39#issuecomment-6550402823)) |
| P2 PR3 | [#34](https://github.com/Harrisonxaph/catherdral-game/issues/34) | MERGED_BY_OWNER | `562f4e7` | [#40](https://github.com/Harrisonxaph/catherdral-game/pull/40) | 1 / 3 | `2e3d810` | authorised ([approval](https://github.com/Harrisonxaph/catherdral-game/issues/34#issuecomment-6550265324)); merged by owner |
| P2 PR4 | [#35](https://github.com/Harrisonxaph/catherdral-game/issues/35) | MERGED_BY_OWNER | `2e3d810` | [#41](https://github.com/Harrisonxaph/catherdral-game/pull/41) | 0 / 3 | `258f67e` | authorised ([approval](https://github.com/Harrisonxaph/catherdral-game/issues/35#issuecomment-6550268869)); merged by owner |
| P2 PR5 | [#36](https://github.com/Harrisonxaph/catherdral-game/issues/36) | MERGED_BY_OWNER; follow-up fix in review | `258f67e` | [#42](https://github.com/Harrisonxaph/catherdral-game/pull/42) | 2 / 3 | `10cb19b` | authorised ([approval](https://github.com/Harrisonxaph/catherdral-game/issues/36#issuecomment-6550272090)); merged by owner; iPhone start fix in a separate owner-requested PR |

Update this table inside the commits that open, correct or block a stage. Record a stage's merge commit in the next stage's first commit. Do not mark a step merged on review success alone.

## Per-PR append-only handover format

Copy the following section under this heading **for each new PR and each review correction**, in the same commit as that work, keeping earlier attempts as history. The exact head SHA is posted afterwards in the PR's developer handoff comment, not here.

```md
### YYYY-MM-DD — P2 PRn — initial implementation / correction 1 / correction 2 / correction 3
- Issue:
- Approval source and scope:
- Developer: Claude Code
- Reviewer: independent Codex session
- Base branch + exact SHA:
- Feature branch:
- PR URL (exact head SHAs: developer handoff comments):
- Change summary + files:
- Acceptance criteria verified (evidence):
- Local commands executed + actual results:
- CI URL, job status and whether completed:
- Browser / physical device tests actually performed:
- Reviewer findings addressed (link to the Codex review comment, which names its reviewed SHA):
- Correction cycles consumed (0..3; never reset across sessions):
- Open blockers / risk of data loss:
- Rollback approach:
- Status: IN_DEVELOPMENT / AWAITING_REVIEW / FIX_REQUIRED / BLOCKED /
          NEEDS_OWNER_APPROVAL / READY_FOR_OWNER_REVIEW / MERGED_BY_OWNER
- Owner merge decision source, if any:
- Next action / next approval required:
```

### 2026-10-31 — P2 PR1 — initial implementation
- Issue: [#32](https://github.com/Harrisonxaph/catherdral-game/issues/32).
- Approval source and scope: [`OWNER APPROVAL: P2 PR1 (#32)`](https://github.com/Harrisonxaph/catherdral-game/issues/32#issuecomment-6549470246) (2026-10-31): approves the SPEC §10 defaults listed there and authorises PR1 within #32's scope. Each merge, later stage, scope expansion and deployment remain owner decisions. The gate boxes above are the owner's to tick.
- Developer: Claude Code. Reviewer: independent Codex session (pending).
- Base: `main @ ef177df605d9a19d02c1e1c2466062c82af0d4bd`. Feature branch: `development/arpg-p2-pr1-stable-identities`.
- PR URL and exact head SHAs: the draft PR linked from #32 and its developer handoff comments.
- Change summary: `floors.js` gains pure, RNG-free `instanceId`, `entityId`, `layoutHash`, `locations` and `GENERATOR_VERSION`; `index.html` captures the floor seed right after `reseed()` and, after population, assigns `spawnId` to every initial enemy and `chestId` to every chest, building a frozen in-memory `areaManifest`. Nothing is saved yet. Cache bumped to `v21-arpg-p2-identities`.
- Acceptance evidence: `area-identity.test.cjs` compares every floor × seeds 1–100 (and the graphics seed) against a golden fixture generated from `ef177df`; it checks layout, entity types/positions/HP, chests, traps, torches and the RNG state after population (draw order). IDs are unique across 500 instances, storable under the save schema's ID rule, reproduced in fresh games, and summons get none. Local results are in the developer handoff comment.
- Correction cycles consumed: 0 / 3.
- Open blockers / data-loss risk: none known; no save path is wired.
- Rollback: revert the PR; no stored data exists.
- Status: AWAITING_INDEPENDENT_REVIEW.
- Next action: independent Codex review of the PR's current head; owner decides merge.

### 2026-10-31 — P2 PR1 — merged by owner
- PR [#38](https://github.com/Harrisonxaph/catherdral-game/pull/38) merged into main as `0ab48900409e8d54c3ff5a0433f0cf0510e46b3d` (head `6243c5d`). Codex review of that head: no findings ([comment](https://github.com/Harrisonxaph/catherdral-game/pull/38#issuecomment-6549644823)); all five CI checks on the head passed. The later automatic Codex run on "ready for review" reported "Failed" (a tool error with no findings posted). Correction cycles used: 0 / 3.

### 2026-10-31 — P2 PR2 — initial implementation
- Issue: [#33](https://github.com/Harrisonxaph/catherdral-game/issues/33).
- Approval source and scope: [`OWNER APPROVAL: P2 PR2 (#33)`](https://github.com/Harrisonxaph/catherdral-game/issues/33#issuecomment-6549916332) (2026-10-31): #33's scope only, the pure campaign/world-state and once-only reward ledger with tests; no Save/Continue, combat, UI or unrelated changes. Merge, later stages and deployment remain owner decisions.
- Developer: Claude Code. Reviewer: independent Codex session (pending).
- Base: `main @ 0ab4890`. Feature branch: `development/arpg-p2-pr2-world-ledger`.
- PR URL and exact head SHAs: the draft PR linked from #33 and its developer handoff comments.
- Change summary: new pure `campaign-state.js` (enterArea, recordKill, openChest, pickUp, grantReward, claimEscrow, completeArea, campaignRewardKey). `character-state.js` schema 1 is amended in place (no save exists yet): area instances gain seed, generatorVersion, layoutHash, epoch, killed and opened, are keyed by their PR1 identity, and only accept IDs belonging to that area. The fixture is regenerated. Not loaded by the game; no cache bump needed.
- Owner choice to confirm at review: the approval did not answer whether schema 1 may be amended in place; this follows the documented rule that schema 1 is amended in place until persistence is enabled.
- Correction cycles consumed: 0 / 3.
- Open blockers / data-loss risk: none known; nothing is wired into the game or saved by it.
- Rollback: revert the PR; no stored data exists.
- Status: AWAITING_INDEPENDENT_REVIEW.

### 2026-10-31 — P2 PR2 — correction 1
- Finding: [Codex review of `de58cb5`](https://github.com/Harrisonxaph/catherdral-game/pull/39#issuecomment-6550295471), BLOCKING: drop IDs were built from the base spawn/chest ID without the instance mode/epoch, so the same initial enemy killed in a campaign instance and a replay epoch (drops left uncollected) collided with `duplicate drop ID`.
- Fix: drop IDs are now `<instance key>:<spawn|chest>:<n>:d<k>` and rewards `<instance key>:reward:<hash>`, scoped to the full saved instance key (mode and epoch). The schema accepts a drop only under its exact instance key and in that grammar (spawn/chest index below 4096, drop index below 64). Campaign reward keys stay globally once-only.
- Regression tests: campaign plus replay epochs 1 and 2 keep simultaneous drops from the same enemy and chest through save/hydrate round trips; per-instance kills still count once; picking up in one instance leaves the others alone; the campaign reward cannot be re-granted in any instance. Schema test rejects drop IDs under another instance key and malformed suffixes. Both fail on `de58cb5`.
- Correction cycles consumed: 1 / 3.
- Status: AWAITING_INDEPENDENT_REVIEW of the new head (exact SHA in the PR's "Correction 1" handoff comment).

### 2026-10-31 — P2 PR2 — merged by owner
- PR [#39](https://github.com/Harrisonxaph/catherdral-game/pull/39) merged into main as `562f4e77ccfc47b89a7261adea79c986056d26ea` (reviewed head `2550888`, unchanged). Codex review of that head: no findings ([comment](https://github.com/Harrisonxaph/catherdral-game/pull/39#issuecomment-6550366923)); owner merge approval [recorded](https://github.com/Harrisonxaph/catherdral-game/pull/39#issuecomment-6550402823). Correction cycles used: 1 / 3.

### 2026-10-31 — P2 PR3 — initial implementation
- Issue: [#34](https://github.com/Harrisonxaph/catherdral-game/issues/34).
- Approval source and scope: [`OWNER APPROVAL: P2 PR3 (#34)`](https://github.com/Harrisonxaph/catherdral-game/issues/34#issuecomment-6550265324), effective once P2 PR2 merged (it did, above): atomic potion spend and heal, ability cooldown reservation, recorded death and save-failure pause; preserve combat timing and all three abilities; do not enable Save/Continue.
- Developer: Claude Code. Reviewer: independent Codex session (pending).
- Base: `main @ 562f4e7`. Feature branch: `development/arpg-p2-pr3-commands`.
- PR URL and exact head SHAs: the draft PR linked from #34 and its developer handoff comments.
- Change summary: new `command-coordinator.js` (pure transitions `drinkPotion`, `reserveAbility`, `recordDeath`, plus `createCoordinator`, which commits each command to the save store before publishing it, refuses a second command while one is saving, pauses after a failed save until `retry`, and marks fenced or conflicting sessions stale). `campaign-state.js` exports its copy-validate `transition` helper. Not loaded by the game: wiring into `index.html` is P2 PR5.
- Correction cycles consumed: 0 / 3.
- Open blockers / data-loss risk: none known; nothing is wired into the game.
- Rollback: revert the PR; no stored data exists.
- Status: AWAITING_INDEPENDENT_REVIEW.

### 2026-10-31 — P2 PR3 — correction 1
- Finding: [Codex review of `2932a8f`](https://github.com/Harrisonxaph/catherdral-game/pull/40#issuecomment-6550629986), BLOCKING: `onStatus` ran inside the storage error path. An observer throwing on `saved` turned a completed commit into a retryable storage failure, so a retry spent a second potion. An observer throwing on `saving` ran outside the try/finally and left the coordinator permanently `busy`.
- Fix: observer notifications are contained, so their errors are ignored and never reach the save path. Only the store commit is inside the try; `pending` is cleared in `finally` before the outcome is published; a completed commit is always acknowledged and never kept for retry.
- Regression test: observers throwing at `saving`, `saved`, `failed` and `stale` leave the honest status, matching in-memory and stored state, no second potion spend, nothing to retry after a completed commit, and no stuck `busy`. Fails on `2932a8f` and when the observer containment alone is removed.
- Correction cycles consumed: 1 / 3.
- Status: AWAITING_INDEPENDENT_REVIEW of the new head (exact SHA in the PR's "Correction 1" handoff comment).

### 2026-10-31 — P2 PR3 — merged by owner
- PR [#40](https://github.com/Harrisonxaph/catherdral-game/pull/40) merged into main as `2e3d8108c2108a01945a97bbf20bb3f38c5af6d8` (reviewed head `1f57bd9`, unchanged). Codex review of that head: no findings ([comment](https://github.com/Harrisonxaph/catherdral-game/pull/40#issuecomment-6550664597)). Correction cycles used: 1 / 3.

### 2026-10-31 — P2 PR4 — initial implementation
- Issue: [#35](https://github.com/Harrisonxaph/catherdral-game/issues/35).
- Approval source and scope: [`OWNER APPROVAL: P2 PR4 (#35)`](https://github.com/Harrisonxaph/catherdral-game/issues/35#issuecomment-6550268869), effective once P2 PR3 merged (it did, above): validated emergency export including unsaved in-memory state, and safe selection of prior-good backups; preserve corruption checks, revision checks and writer fencing; no full import tooling; do not enable Save/Continue.
- Developer: Claude Code. Reviewer: independent Codex session (pending).
- Base: `main @ 2e3d810`. Feature branch: `development/arpg-p2-pr4-recovery`.
- PR URL and exact head SHAs: the draft PR linked from #35 and its developer handoff comments.
- Change summary:
  - `save-store.js`:
    - Every export is versioned, size-bounded (16 MiB, refused rather than truncated) and labelled `stored`/`saved:true` or `unsaved`/`saved:false`, with a notice that this version cannot import files and that the checksum detects accidental damage only.
    - `exportUnsaved` validates in-memory state against the save schema and signs it. It never touches storage and is not queued behind writes, so it works when storage is denied, hung or fenced.
    - `verifyExport` checks a file without importing it: size before parsing, then format, label, checksum and schema.
    - `recoveryOptions` reports `saved`, `recovery-required`, `read-only` or `missing`, and recommends only the newest backup that passes its checks.
    - `restoreBackup` over a good save must name the revision the player compared against (`expectedRevision`); a save that has moved on is a conflict and stays unchanged.
  - `command-coordinator.js`:
    - Keeps the candidate a save refused (`hasUnsaved`) and can export it, or caller-held state, as unsaved in any status.
    - `statusLabel` distinguishes Saved, Saving, Not saved (failed or stale), Recovery required and Read-only.
  - Not loaded by the game: wiring is P2 PR5.
- Correction cycles consumed: 0 / 3.
- Open blockers / data-loss risk: none known; nothing is wired into the game. `restoreBackup` callers over a good save must now pass `expectedRevision` (no runtime caller exists yet).
- Rollback: revert the PR; no stored data exists.
- Status: AWAITING_INDEPENDENT_REVIEW.

### 2026-11-01 — P2 PR4 — merged by owner
- PR [#41](https://github.com/Harrisonxaph/catherdral-game/pull/41) merged into main as `258f67e79ce41ef3bc6047cd3617b9584539840d` (reviewed head `6b2d0a8`, unchanged). Codex review of that head: no findings ([comment](https://github.com/Harrisonxaph/catherdral-game/pull/41#issuecomment-6550878425)). Correction cycles used: 0 / 3.

### 2026-11-01 — P2 PR5 — initial implementation
- Issue: [#36](https://github.com/Harrisonxaph/catherdral-game/issues/36).
- Approval source and scope: [`OWNER APPROVAL: P2 PR5 (#36)`](https://github.com/Harrisonxaph/catherdral-game/issues/36#issuecomment-6550272090), effective once P2 PR4 merged (it did, above): connect New Character, Continue, persistent progression and checkpoint respawning on the PR1–PR4 foundations; preserve equipment/mods, once-only rewards, combat, graphics, narrative, mobile controls and offline support; New Character never silently overwrites a save; record unverified physical-device testing.
- Developer: Claude Code. Reviewer: independent Codex session (pending).
- Base: `main @ 258f67e`. Feature branch: `development/arpg-p2-pr5-continue`.
- PR URL and exact head SHAs: the draft PR linked from #36 and its developer handoff comments.
- Change summary:
  - New `game-session.js`, with pure transitions:
    - runtime snapshot (health, equipment shield and timers, clamped; never revives or refills);
    - `respawn` (once per death, full health, everything kept);
    - `syncRun` (inventory rearrangement only: same saved items, same potions);
    - `arrive` (area instance, current area and entrance checkpoint in one change; the +20% health / +1 potion transition recovery once per location, marked by a `recovery:<location>` story flag);
    - `restorePlan`.
  - `createSession` queues runtime events in order (never refused as busy). It refuses repeated taps while saving, folds the latest snapshot into every command, and halts on a failed save until retry.
  - `index.html`:
    - Title: Continue · LVL n, New Character with a two-step confirmation when a save exists, recovery choices, stored export, and an explicitly labelled unsaved trial when storage is unavailable.
    - Kills, chests, ash/potion/relic pick-ups, inventory drops and rearrangement, the boss/elite reward (campaign key `campaign:<location>:final:item`), first clear at the seal, travel, death and respawn, potions and abilities all commit through the session.
    - Continue rebuilds the saved floor from its seed: killed enemies stay dead, opened chests stay open, ground loot returns, and the player starts at the entrance.
    - One-second autosave and a flush when hidden.
    - HUD save status, and a save-failure pause with Retry, Export unsaved progress and Return to title.
    - Deterministic level growth (+5 health, +1 damage, one banked skill point per level) replaces the random blessings.
    - The tab's lease ID is kept in sessionStorage, so a reload continues immediately.
  - `campaign-state.js` adds `dropItem`; save schema v1 (unreleased) accepts player drop IDs `<instance>:item:<item ID>`. `command-coordinator.js` adds a generic `run` command and a retry that re-runs any failed command.
  - Five new runtime modules are cached; `CACHE_VERSION` bumped to v22. CI runs the new `test:persistence-browser` suite.
- Not done in this PR (recorded, not claimed):
  - legacy best/narrative import into `payload.legacy` (stays `null`; old localStorage keys are untouched);
  - a save-aware service-worker update flow;
  - skill-point spending (Phase 4); Sanctuary, travel menu and replay (Phase 3).
- Physical iPhone/Android/Safari testing: NOT VERIFIED.
- Correction cycles consumed: 0 / 3.
- Open blockers / data-loss risk: none known. Known limitation (SPEC section 5): up to about 1 s of noncritical health/position may be lost on an OS kill, and events queued behind a failed save are not included in its unsaved export.
- Rollback: revert the PR. Saves created by this version stay in IndexedDB (`vesper-arpg`) and are ignored by older builds, which do not load the save modules.
- Status: AWAITING_INDEPENDENT_REVIEW.

### 2026-11-01 — P2 PR5 — correction 1
- Findings: [Codex review of `9b244d5`](https://github.com/Harrisonxaph/catherdral-game/pull/42#issuecomment-6553236480), three BLOCKING:
  1. The next queued command sampled the runtime before the previous command's effect was published (promise callbacks run later), so a snapshot could store a reserved cooldown as 0 or overwrite a committed heal.
  2. Pressing Enter on the title still called the old unsaved `startGame` flow.
  3. The emergency export after a failed save held only the failed command, not the commands queued behind it.
- Fixes:
  1. Each queued command now carries a `publish` callback that the session runs synchronously as it settles, before the next command samples the runtime. All twelve runtime adapters use it, ignored if their session has ended. A throwing publish never stops the queue.
  2. Enter on the title takes the same guarded path as the buttons: Continue a saved character, or begin a new character or the labelled unsaved trial when nothing is stored. It never confirms a replacement, and it prevents the stray keypress that used to close the opening dialog at once.
  3. `exportUnsaved` folds every pending command (the failed head, those queued behind it, and those a stale session could not save) over the committed state as pure transitions. It writes nothing and leaves the queue intact.
  - Also found while testing: after a successful retry, play resumed only if no further command was already saving. It now resumes whenever the queue is no longer halted.
- Regression tests:
  - Node:
    - an ability reservation, with a snapshot and kill queued behind it, stores the full cooldown;
    - a potion heal followed by a snapshot stores the healed health;
    - a throwing publish does not stop the queue;
    - an export after a failure with two queued kills holds both (XP, killed, drops), verifies, hydrates, writes nothing and leaves the queue intact, and retry then applies both once;
    - a stale session's export holds both commands it could not save.
  - Each fails when its fix is removed (4 mutations).
  - Browser: Enter starts a new character, continues a saved one and starts the trial without storage; the ability is reserved in the same turn as a kill; the failed-save export holds both kills, and retry resumes play and applies them once. The new browser suite fails on `9b244d5`.
- Correction cycles consumed: 1 / 3.
- Status: AWAITING_INDEPENDENT_REVIEW of the new head (exact SHA in the PR's "Correction 1" handoff comment).

### 2026-11-01 — P2 PR5 — correction 2
- Finding: [Codex review of `23a4e79`](https://github.com/Harrisonxaph/catherdral-game/pull/42#issuecomment-6553487958), BLOCKING. The emergency export re-applied the live runtime snapshot before every pending command. Export never publishes, so the runtime did not yet hold earlier pending effects: a pending Aegis reservation exported as 0 s instead of 20 s, and a pending heal could be overwritten.
- Fix: `exportUnsaved` folds the runtime snapshot into the committed state once, then applies the pending commands' pure transitions in order without re-sampling. It still writes, publishes and dequeues nothing.
- Regression test, for both a failed save and a stale session: an ability reservation, a snapshot, a kill, a potion and a snapshot are pending. The export holds the 20 s cooldown, the healed health, one potion spent and the kill's XP, and it hydrates. Storage, the queue and the runtime are unchanged. The test fails when per-command re-sampling is restored; the four correction-1 mutations still fail too.
- Correction cycles consumed: 2 / 3.
- Status: AWAITING_INDEPENDENT_REVIEW of the new head (exact SHA in the PR's "Correction 2" handoff comment).
- Codex review of `a6c9ea5`: no findings ([comment](https://github.com/Harrisonxaph/catherdral-game/pull/42#issuecomment-6555873503)).

### 2026-11-01 — P2 PR5 — merged by owner
- PR [#42](https://github.com/Harrisonxaph/catherdral-game/pull/42) merged into main as `10cb19b` (reviewed head `a6c9ea5`). Correction cycles used: 2 / 3. A correction pushed to the PR branch afterwards (`e48d8e9`) was not part of the merge; the owner asked for it as a separate fix PR (below).

### 2026-11-01 — P2 PR5 follow-up — iPhone start fix (separate owner-requested PR)
- Finding (owner, iPhone, on the merged PR5 build, screen recording): Begin Your Story → Start Adventure → Enter the crypt returned to the title. Gameplay never started and no error was shown. Automated Chromium tests had not established Safari behaviour.
- Investigation (cause not confirmed on a device): the recording shows the title's save note stayed empty. `refreshTitle()` therefore never finished its first IndexedDB request; on a fresh browser it would have shown "No saved character", and its error path would have offered the trial. New Character then waited on the same never-settling open, so nothing errored and the dialog closed back to the title. This matches WebKit leaving IndexedDB requests pending until `indexedDB.databases()` has been called. WebKit could not be installed in the development container (download host blocked), so this was simulated in Chromium, not reproduced in Safari.
- Fixes:
  - `save-store.js`'s IndexedDB adapter calls `indexedDB.databases()` (polled) before the first open.
  - An open that does not settle in 8 s is reported as `unavailable`, and is not cached, so the next request retries.
  - A transaction that does not finish in 15 s is aborted and reported as a retryable `timeout`, so a save cannot sit at SAVING forever.
  - `index.html` shows "Checking for a saved character…", "Preparing your character…" and "Loading your character…". Any failure in New Character, Continue, a title-time respawn or a title-time save is shown with its reason. Storage failures switch the title to the labelled unsaved trial. Unhandled errors on the title are shown.
- Regression tests:
  - Node: a never-answering open → `unavailable` within the timeout, with `databases()` called first and the failure not cached; a never-settling `databases()` cannot block the timeout; a never-finishing transaction is aborted as `timeout`.
  - Browser (`test:persistence-browser`), WebKit-style factory that answers only after `databases()`: New Character starts normally.
  - Browser, never-answering storage: the title shows progress, then "Could not start a character (unavailable: browser storage did not respond in time)" and PLAY UNSAVED TRIAL, and the trial plays.
- Branch: `development/arpg-p2-pr5-ios-storage-fix` from `main @ 10cb19b`; the same change as `e48d8e9`, ported onto main. PR URL and exact head SHA: in the fix PR and its handoff comment.
- Physical iPhone/Safari: NOT VERIFIED after this fix; owner retest required.
- `CACHE_VERSION` bumped to v23, so a device that cached the merged v22 build fetches the fixed files.
- Status: AWAITING_INDEPENDENT_REVIEW and full CI on the fix PR; the owner decides the merge.

## Setup event — 2026-10-29

- Created five ordered tracking issues (#32–#36) based on the existing `TASKS.md` PR sequence.
- Prepared role-separated prompts and bounded iteration policy on the dedicated setup branch.
- No gameplay modules, CI workflow settings, secrets, automatic agent launches or production configuration changed by the intended setup.
- This is a documentation-only setup, not a claim that P2 PR1–PR5 have been implemented or reviewed.

## Workflow revision — 2026-10-29 (PR #37 update)

- The developer prompt is now reusable for all five stages: it selects the earliest open, unmerged, authorised issue in #32–#36 and resumes an existing PR instead of starting a new one.
- Exact head SHAs and reviewer verdicts moved from this file to PR comments, because a tracked file cannot contain its own commit's SHA; this file keeps milestones, approvals, counts and history. Merge commits are recorded in the next stage's first commit.
- Approval evidence is defined in PHASE2-LOOP.md: agents post under the owner's account, so only an `OWNER APPROVAL:` comment without an AI footer, or an owner commit ticking the gates, counts.
- Two-level context strategy and duplicate-review rule added. Stage order, the three-cycle budget, role separation and all safety rules are unchanged. No stage has started; P2 PR1 remains `NEEDS_OWNER_APPROVAL`.
