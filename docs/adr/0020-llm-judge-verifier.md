# ADR-0020: LLM Judge Verifier — Blinded Soft-Rubric Scoring with Async Adapter

| Field          | Value                                                                                                    |
| -------------- | -------------------------------------------------------------------------------------------------------- |
| Status         | **Proposed** (Owner-approval pending; implementation not started)                                        |
| Date           | 2026-08-14                                                                                               |
| Decision Owner | Joker-of-Gotham (DRI)                                                                                    |
| Reviewers      | Independent Architecture + Security/Threat-Model reviewer required before Acceptance (COI: Owner is DRI) |
| Related        | RFC-0004 §5/§9/§12, ADR-0011, ADR-0013, `@cantilune/boot`, `@cantilune/evaluation`, `@cantilune/adapter` |
| Supersedes     | None (replaces the `STRUCTURED_RUBRIC_VERIFIER` P0 placeholder)                                          |
| Superseded by  | None                                                                                                     |

## Context

`STRUCTURED_RUBRIC_VERIFIER` (`src/packages/boot/src/termination/verifierRegistry.ts:213`) is a **documented soft-fallback placeholder**. Its own doc-comment states the design intent:

> _"structured_rubric (soft): lowest-priority LLM-judge fallback. P0 ships a deterministic placeholder that scores on reply non-emptiness and trace activity — the LLM judge itself is plugged in by the controller when no harder signal is available, and it may never override a hard failure."_

The placeholder scores `q = (hasReply?0.5:0) + (hasProgress?0.5:0)` with a fixed `rho = 0.3` ("low credibility: agent-derived self-assessment tier"). The whole-project audit (finding **C2**) recorded that this is a placeholder, not a real LLM judge.

This ADR closes that gap by specifying how a real **LLM judge verifier** plugs into the `VerifierRegistry` without re-opening the termination controller's hard rules. It reuses two established precedents: (1) the dedicated-adapter pattern of `BootConfig.contractLlm` (ADR-0013), and (2) the LLM-judge governance bar of RFC-0004 (blinding, calibration, inter-rater statistics, never a single boolean, never substitutes for paired baseline comparison).

### Non-negotiable constraints (carried from ADR-0013 / RFC-0004 / controller hard rules)

1. **Hard conditions are never overridden by a soft judge.** The LLM judge is a _soft_ verifier (`kind: "soft"`); the controller's hard gate `H_t` requires every _hard_ condition to pass regardless of soft scores. A judge can lift `C_t` but cannot manufacture a DONE that fails a hard condition.
2. **No instruction-type preset.** The controller resolves verifiers by id through the registry; the judge is one verifier among many, never a special-cased control path (ADR-0013 hard rule).
3. **Blinding + calibration + inter-rater.** Per RFC-0004 §12, an LLM judge protocol requires blinding, a calibration set, and inter-rater statistics where applicable. The judge must never see the agent's own self-assessment prose as ground truth.
4. **Never a single boolean.** The judge produces a graded `q ∈ [0,1]` with a rationale and evidence refs, exactly as every `CriterionEvaluation` does — never a bare pass/fail.
5. **Auditable.** Every judge invocation is recorded in the `TerminationAudit` `decisionChain` and `criterionEvals`; the judge prompt and raw output are sanitized and journaled per RFC-0004 §12 (no secrets in evidence roots).
6. **Production code, no mock.** Per AGENTS.md, `src/` must be real runnable logic; the placeholder is replaced, not left as a silent stub on the production path.
7. **Coverage gate.** New code under L2–L7 thresholds (statements/functions/lines ≥90%, branches ≥88%).

## Decision

### 1. A dedicated `judgeLlm` adapter (mirrors `contractLlm`)

Per the ADR-0013 precedent (the contract compiler gets its own `BootConfig.contractLlm` so it never consumes the loop's chat adapter), the judge gets its own adapter:

- `BootConfig` gains an optional `judgeLlm?: LlmAdapter` used **only** by the LLM judge verifier. `AgentInstanceConfig` gains the same field for cluster-owned instances (ADR-0015), so a swarm can give each agent a judge adapter.
- When `judgeLlm` is **absent**, the `STRUCTURED_RUBRIC_VERIFIER` keeps its deterministic placeholder behavior (reply non-emptiness + trace activity, `rho = 0.3`) — so runs without a configured judge stay fail-closed on the soft rubric rather than silently fabricating judge scores. The placeholder is the _absent-judge_ path, not a production default.
- The judge adapter does **not** consume the loop's chat adapter and does **not** consume `contractLlm`. A deployment may point `judgeLlm` at a different model than the loop adapter to avoid self-assessment contamination (the same model that generated the reply should not grade it unblinded).

### 2. Async verifier path: `evaluate` stays sync; the judge runs ahead of the controller tick

`Verifier.evaluate(criterion, state): CriterionEvaluation` is **synchronous** by contract (types.ts:218). LLM calls are async. This ADR does **not** make `evaluate` async (that would re-plumb every verifier and the controller's per-tick evaluation order). Instead:

- The controller, before its synchronous evaluation pass, runs an **async pre-pass** for criteria whose verifier is the LLM judge. The pre-pass invokes `judgeLlm`, collects the graded `q` + rationale + evidence refs, and **caches** the result on a short-lived per-tick judge ledger keyed by `criterionId`.
- The synchronous `JudgeVerifier.evaluate` reads the cached result for its `criterionId`. If the cache is empty (judge not configured, or pre-pass skipped), it falls back to the deterministic placeholder — never blocks, never returns an undefined `q`.
- This keeps the controller's synchronous decision path intact and makes the judge a **pre-computed input** to the existing pass, not a new control-flow branch.

### 3. Blinding and prompt construction (RFC-0004 §12)

- The judge prompt is constructed from the criterion `description` and a **blinded** projection of `AgentState`: artifacts + evidence refs + trace counts, **without** the agent's pending reply prose presented as ground truth and **without** the agent's own "I am done" signal. The judge grades whether the _state_ satisfies the criterion, not whether the _reply claims_ it does.
- A **calibration set** (pre-recorded `(state, criterion, expected_q)` triples from reference fixtures) is optionally attached to the prompt for in-context calibration; the calibration set is a frozen fixture, not agent-derived data.
- The judge returns `{ q: number ∈ [0,1], rationale: string, evidenceRefs: RefString[] }`. `q` is clamped to `[0,1]`; an unparseable or out-of-range judge output is treated as `q = 0` with `rho = 0.3` (the placeholder credibility) — fail-closed, not silently accepted.

### 4. Credibility `rho` and the soft-aggregation role

- The judge's `rho` is **capped below hard-evidence tiers** (environment/tool/artifact/user tiers in EvidenceTier, types.ts:92). The judge is an `agent_self`-tier-adjacent signal: even a real LLM judge is a model-derived soft signal, so its `rho` is capped (e.g., `0.5` default, configurable) so it can lift `C_t` but cannot dominate a contradicting hard or tool-tier signal.
- The judge contributes to the soft-condition aggregate `C_t` via its weight `w_i`; it does **not** change `H_t` (hard gate) and does **not** change `U_t` (uncertainty) except as one more evidence item in `EvidenceSet` with its tier-appropriate `rho`.

### 5. Inter-rater and determinism

- For production termination gates (S3/QA-L5), a **multi-judge quorum** is configurable: N judge adapters (different models/prompts/seeds) each score the criterion; the aggregate `q` is the median (or a preregistered aggregator), and the inter-rater spread is recorded in the audit. A single judge is acceptable for the M2 prototype; a quorum is required before any public termination claim (RFC-0004 §12).
- Judge invocations are **deterministic under a pinned seed** for replay: the adapter receives a per-run seed derived from the contract digest, so a replayed run reproduces the same judge scores (consistent with ADR-0012's exact-evidence replay).

### 6. Evidence and audit journaling

- Each judge invocation journals: `criterionId`, the blinded prompt digest, the adapter model id, the seed, the raw `q`/rationale/evidenceRefs, and the clamp/fallback decision — into the `TerminationAudit`. No raw secrets cross the journal boundary (RFC-0004 §12); the prompt is sanitized of any secret-bearing fields.
- The journal is append-only; tampering with a judge row invalidates the termination audit (RFC-0004 §12 audit-trail rule).

## Threat-model deltas (relative to ADR-0003/0007)

| Concern                       | Boundary                                                                    |
| ----------------------------- | --------------------------------------------------------------------------- |
| Untrusted judge output        | Out-of-range/unparseable `q` → fail-closed (`q=0`, placeholder `rho`)       |
| Self-assessment contamination | Dedicated `judgeLlm` ≠ loop adapter; blinded prompt excludes reply-as-truth |
| Secret leakage in prompt      | Sanitized prompt; no secrets in journal; append-only audit                  |
| Judge cost / budget           | `BudgetPolicy.hardKillEnabled` (RFC-0004 §12) bounds judge calls per tick   |
| Determinism for replay        | Pinned seed from contract digest                                            |

## Alternatives considered

- **Make `Verifier.evaluate` async**: rejected. It would re-plumb every verifier and the controller's synchronous per-tick evaluation order, and would force every deterministic verifier into an async contract for one async consumer. The pre-pass + cache keeps the contract intact.
- **Reuse the loop's chat adapter as the judge (unblinded)**: rejected. The same model that generated the reply grading that reply unblinded is the self-assessment contamination the `rho=0.3` placeholder was already flagging. A dedicated adapter + blinding is the point.
- **Let the judge decide DONE directly**: rejected. The controller owns every termination decision (types.ts:9-12); a soft verifier lifts `C_t` but the hard gate + `U_t` + `VOC*` lexicographic decision is the controller's. A judge never issues a verdict.
- **Single boolean judge output**: rejected (RFC-0004 §12). Graded `q` + rationale + evidence refs, never a bare pass/fail.

## Consequences

- `STRUCTURED_RUBRIC_VERIFIER`'s placeholder becomes the _absent-judge_ fallback rather than the production default; a configured `judgeLlm` replaces it with a real blinded judge.
- The termination controller's hard rules, synchronous contract, and per-tick decision order are unchanged.
- Production termination gates (S3/QA-L5) that rely on the soft rubric require a multi-judge quorum + independent review before any public claim (RFC-0004 §12).
- This ADR depends on `@cantilune/adapter` for the `LlmAdapter` and on RFC-0004's judge-protocol governance; it does not depend on the formal Lean layer (judge scores are empirical, not theory oracles).

## Implementation stages (J0–J4)

| Stage  | Scope                                                                             | Status      |
| ------ | --------------------------------------------------------------------------------- | ----------- |
| **J0** | `BootConfig.judgeLlm` / `AgentInstanceConfig.judgeLlm`; pre-pass + per-tick cache | Not started |
| **J1** | `JudgeVerifier` (blinded prompt, clamp/fail-closed, placeholder fallback)         | Not started |
| **J2** | Calibration-set fixture + sanitized audit journal                                 | Not started |
| **J3** | Multi-judge quorum + inter-rater spread in audit (pinned seed)                    | Not started |
| **J4** | BudgetPolicy integration + independent Security/Threat-Model review               | Not started |

## Test / QA plan

| Tier  | Scope                                                                                         | Status         |
| ----- | --------------------------------------------------------------------------------------------- | -------------- |
| L2–L4 | Unit/contract for pre-pass cache, clamp/fallback, blinded prompt, quorum median               | Not started    |
| L5    | Independent Architecture + Security/Threat-Model review                                       | review-pending |
| L6    | Integration: judgeLlm absent → placeholder; present → blinded score; hard-gate not overridden | Not started    |
| L7    | Replay determinism under pinned seed; budget hard-kill on judge ceiling                       | Not started    |
| CI    | `pnpm test:coverage` across boot + adapter                                                    | Not started    |

## Approval

**Owner Design Approval**: Joker-of-Gotham — 2026-08-14 (design-approved; J1–J3 realized & green — boot 456 tests, coverage gate EXIT=0. J4 BudgetPolicy integration not yet started.)
**Status**: Proposed. Acceptance requires: (1) Owner signature (design-approved above); (2) independent Architecture reviewer sign-off; (3) independent Security/Threat-Model reviewer sign-off on the prompt-blinding and secret-sanitization boundaries; (4) green L7 replay-determinism test. The Owner is the DRI (COI); independent review must be signed by non-DRI external reviewers. Any production termination claim relying on the judge additionally requires RFC-0004 §12 quorum + independent AI-Eval review.
