# Phase 2 persistent development / independent-review loop

Status: **proposed coordination system, not gameplay authorisation**. Owner approval is required for the product choices in [SPEC.md §10](SPEC.md#10-approval-and-independent-review-gates) before Phase 2 implementation. The loop can be prepared without that approval. Do not treat this plan, an issue, a PR or an instruction to "set up the loop" as approval of gameplay defaults.

## Sources of truth and roles

- Read root [AGENTS.md](../../AGENTS.md), [PROJECT.md](../../PROJECT.md), [TASKS.md](../../TASKS.md), [DECISIONS.md](../../DECISIONS.md), [AGENT-WORKFLOW.md](../AGENT-WORKFLOW.md), [SPEC.md](SPEC.md), [ROADMAP.md](ROADMAP.md) and [AUDIT.md](AUDIT.md). Current source and merged main take precedence over stale dated prose; document conflicts.
- **Claude Code = developer:** inspects current main, implements one approved PR, adds tests, runs checks, pushes a focused branch and prepares evidence.
- **Codex = independent reviewer:** starts from a fresh session, checks exact pushed PR base/head/diff, reads current requirements and tests, reports ranked actionable findings and gaps. Codex must NOT implement or silently fix the same PR it is reviewing, and its self-review is not independent.
- **Owner = decision maker:** approves product policy, any expanded scope, each PR merge, start of the next step and any deployment. No auto-merge or automatic production changes.
- **GitHub Actions = automated verifier:** existing `.github/workflows/quality.yml` performs unit/docs/build/browser/graphics checks on PRs. Do not falsely label checks green before the completed run is inspected.
- **Persistent record:** [PHASE2-STATUS.md](PHASE2-STATUS.md) survives chat sessions. Agent session memory alone is not evidence. Each handoff includes repository, exact pushed SHA, branch, PR URL, tests and open concerns.
- **Run prompts:** [PHASE2-PROMPTS.md](PHASE2-PROMPTS.md). Users initiate independent Claude and Codex sessions manually unless a separate authenticated orchestration service is explicitly installed and authorised. Files in GitHub alone do not schedule or invoke either agent.

## Scope and dependency order

Follow the existing Phase 2 order from [TASKS.md](../../TASKS.md) and [ROADMAP.md](ROADMAP.md). Each stage is **one small independently reviewed PR** based on current main after the previous PR is owner-merged. No speculative stacked branches, or starting PR(n+1) from an unmerged head without separate owner approval.

| Step | Tracking issue | Branch suggestion | Scope | Dependency |
|---|---|---|---|---|
| PR1 | [#32](https://github.com/Harrisonxaph/catherdral-game/issues/32) | `development/arpg-p2-pr1-stable-identities` | Deterministic floors; stable spawn/chest IDs; unchanged RNG draw order/world digests | Phase 1A + §10 approval |
| PR2 | [#33](https://github.com/Harrisonxaph/catherdral-game/issues/33) | `development/arpg-p2-pr2-world-ledger` | Pure campaign world state and durable, once-only reward ledger | PR1 merged + owner go-ahead |
| PR3 | [#34](https://github.com/Harrisonxaph/catherdral-game/issues/34) | `development/arpg-p2-pr3-commands` | Critical atomic commands: potions, cooldown reservation, death, save-failure pause | PR2 merged + owner go-ahead |
| PR4 | [#35](https://github.com/Harrisonxaph/catherdral-game/issues/35) | `development/arpg-p2-pr4-recovery` | Validated emergency export and prior-good backup selection | PR3 merged + owner go-ahead |
| PR5 | [#36](https://github.com/Harrisonxaph/catherdral-game/issues/36) | `development/arpg-p2-pr5-continue` | New/Continue, persistent XP/gear/resources, checkpoint respawn and runtime wiring | PR4 merged + owner go-ahead |

PR1 is infrastructure for later durability, **not permission to tune or rewrite melee, bosses, ability values or enemy AI**. PR3 makes approved combat-resource transitions durable, not a full combat redesign. Future combat-balance changes require their own scoped acceptance criteria and owner approval.

## Bounded loop — each PR

1. **VERIFY GATE / INSPECT:** Claude reads [PHASE2-STATUS.md](PHASE2-STATUS.md), checks the recorded §10 approval, fetches upstream, inspects clean git status, source, tests, recent commits and open PRs. Record exact base SHA. On missing/ambiguous approval: **STOP: NEEDS_OWNER_APPROVAL**. Allowed preparation then is read-only analysis, test design or a documentation-only proposal; no gameplay implementation.
2. **PLAN:** Identify smallest implementation consistent with the issue, SPEC, current code and existing test contracts. Write measurable acceptance criteria, failure-injection cases, scope exclusions and rollback risks. Respect physics/combat simulation time, existing item `mods` schema, once-only rewards, mobile controls, Canvas fallback and graphics v2.
3. **IMPLEMENT:** Claude uses only a dedicated development branch; preserves main and other PRs. Add tests that fail on regression, ideally establish a before/after result for a bug. Keep changes narrow; no framework migration, hidden QA globals, unlicensed assets or paid compute.
4. **VERIFY:** Run `npm test`, `npm run build`, `python3 .github/scripts/check_agent_docs.py`, relevant unit/browser/offline suites and `npm run test:graphics-budget` or the PR CI graphics-budget job where appropriate. Record commands, pass/fail/skipped counts and known environmental limits. Relevant browser suites need Playwright and Chromium provisioned outside application dependencies. Physical devices are explicitly *not verified* unless actually tested. Never modify baselines to make failures pass.
5. **PUBLISH:** Claude pushes its branch, opens a **draft PR**, includes base/head SHA, issue link, files, evidence, limits and rollback note; updates status and project docs in the same PR where appropriate. Ask for Codex's independent review of the actual pushed head (not an unsynchronised local diff).
6. **REVIEW:** A fresh Codex session independently examines the exact PR base/head, changed files, tests and security/data invariants; observes CI results and reports actionable severity, paths and reproduction. An absence of findings means "no findings in this review", not guaranteed defect-free or approval to merge.
7. **ADAPTIVE CORRECTION:** For required reviewer findings Claude diagnoses cause and makes one targeted fix + regression test, re-runs relevant verification and pushes the changed head. Codex re-reviews **that exact new head**. Count each reviewer-driven fix submission as **one correction cycle**. Maximum **3 cycles per PR after its initial implementation**; never reset the count by starting a new chat, renaming a branch or changing reviewer. Stop sooner on critical risk, repeated failure without progress, missing permissions or policy ambiguity. Do not weaken tests or hide failures.
8. **STOP / HANDOFF:** Mark `READY_FOR_OWNER_REVIEW` only when mandatory acceptance criteria, observed required CI and current independent review have no unresolved blocking findings. Otherwise mark `BLOCKED` or `NEEDS_OWNER_APPROVAL`, with remaining findings and exact evidence. Never self-merge, auto-start next PR or deploy. Owner merges explicitly; then update [PHASE2-STATUS.md](PHASE2-STATUS.md), confirm new main SHA and begin next approved PR.

### Required stop states

- `NEEDS_OWNER_APPROVAL`: §10 decisions, a changed requirement/feature, or next-PR authorisation is not recorded.
- `BLOCKED`: critical correctness/save-safety problem, unresolved blocking review finding after 3 cycles, inaccessible tool/CI, or baseline drift.
- `READY_FOR_OWNER_REVIEW`: test evidence exists, required CI observed, review of current head complete, no blockers. Owner decides merge.
- `MERGED_BY_OWNER`: exact merge commit confirmed on main; only now is next step eligible for owner approval.

## Non-negotiable acceptance / safety

- Never silently overwrite/degrade character data; preserve backup, item ownership, numeric IDs, durable rewards, schema validation and revision/lease fencing.
- No duplicate XP/ash/potions/loot, no double rewards on replay, no cooldown reset or resource refill exploit introduced by persistence.
- PR1 preserves **the existing seeded draw order and graphics baseline world digests**; use stable IDs that do not consume additional gameplay random values. Check all five floors and at least the existing 100-seed connectivity coverage.
- No automatic merge, force-push over others, production deployment, branch deletion, purchases, credentials/secrets in source or elevated CI permissions.
- No outside-run claims: if tests cannot run, record the limitation. Simulation/emulator tests are not physical iPhone/Android validation.
- No change to approved combat mechanics, graphics assets, external libraries or unrelated systems unless explicitly authorised.
- Preserve historical source/PRs. New code must pass current `npm run build` and `APP_ASSETS`/service-worker rules when integrated.
- Follow the project's existing review handover format. In any conflict, stop and escalate rather than guessing.

## What is automated vs manual

**Already configured:** GitHub PR CI runs tests/build/browser/graphics checks using the existing workflow when its triggers and repository Actions settings allow it.

**Persistently configured by this setup (after merge):** shared state, role-specific prompts, per-PR issue tracking, owner gates and correction budget.

**NOT configured:** an unattended Claude-to-Codex invocation, an agent scheduler that reads a finished PR and launches the other assistant, approval/merging, or guaranteed overnight work. Those require separately authorised integrations/credentials, security checks and budget controls. Do not describe this as fully autonomous.
