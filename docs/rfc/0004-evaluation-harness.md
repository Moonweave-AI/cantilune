# RFC-0004: Evaluation Harness — Falsifiable Claims, Paired Experiments, and Evidence Publishing

| Field                     | Value                                                                                                                                              |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status                    | **Draft** (pre-FCP)                                                                                                                                |
| Type                      | Architecture / Governance                                                                                                                          |
| Risk                      | S3 when used for public superiority claims or product termination gates; S2 for drafting scope                                                     |
| Champion / Decision Owner | Joker-of-Gotham (DRI)                                                                                                                              |
| Required Reviewers        | AI Eval, Statistics, Security/Threat Model, QA-L5 (**TBD / review-pending**; interim DRI with COI — see `docs/governance/reviewer-assignments.md`) |
| Created                   | 2026-08-12                                                                                                                                         |
| Related                   | RFC-0001 §8, RFC-0003 §7, ADR-0011 (companion), `@cantilune/evaluation`, `@cantilune/conformance`, `formal/proof-obligations.json`                 |

> **Governance note:** This RFC is the canonical source for the **Evaluation Harness** — the experience assertion verification and evidence publishing system that makes RFC-0001 superiority claims falsifiable. Chat discussion is not authoritative. Nothing in this RFC claims benchmark results exist, independent review signed, or public claims authorized.

> **Naming resolution (frozen by this RFC):** Evaluation claims use the **namespaced codes** `evaluation.c1`–`evaluation.c5`. Product Conformance certificates remain **C0–C9**. The two namespaces MUST NOT be conflated in code, docs, or published reports.

---

## 1. Summary

`@cantilune/evaluation` is the **experience assertion verification and evidence publishing system**. It preregisters and freezes evaluation protocols, binds candidate and baseline subjects under explicit conformance and provenance rules, executes paired benchmark runs, scores metrics through declared judge protocols, aggregates results with preregistered statistical analysis, integrates Lean theory oracles as premised definitions (not benchmark outcomes), and publishes sealed `ClaimDecision` values with full evidence chains.

The harness **decides** whether each `evaluation.c*` claim is supported, not supported, or inconclusive — never a single boolean. It **does not** verify product conformance (that is `@cantilune/conformance`) or re-prove Lean theorems.

**Current implementation status:** E0–E2 engineering prototype. **NOT** public benchmark authority until ADR-0011 Accepted, protocol frozen, and independent review quorum met.

## 2. Motivation

### 2.1 Problem

RFC-0001 §8 asserts five falsifiable superiority claims against named baselines. Without a formal evaluation framework, three failure modes recur:

| Failure mode                | Symptom                                            | Root cause                                                |
| --------------------------- | -------------------------------------------------- | --------------------------------------------------------- |
| Post-hoc benchmark design   | Metrics chosen after seeing results                | No preregistered, frozen protocol                         |
| Conformance/eval conflation | "Package released" treated as "superior to Cursor" | C9 certificate chain collapsed into benchmark attribution |
| Theory/benchmark conflation | Lean proof status cited as benchmark pass          | Kernel theorems treated as empirical outcomes             |

RFC-0003 §7 handoff established that conformance verifies evidence correctness; evaluation measures experience against baselines. This RFC operationalizes the **eval side**.

### 2.2 Who benefits / why now / cost of inaction

- **Beneficiaries:** product owners needing defensible superiority claims; independent reviewers requiring preregistered protocols; governance needing termination/rescope triggers per RFC-0001 §8.
- **Why now:** `@cantilune/conformance` (RFC-0003) can emit sealed C9 certificates; `@cantilune/evaluation` prototype exists. Without RFC-0004, the handoff contract lacks a governing document and C4/C5 naming remains ambiguous across RFCs.
- **Cost of inaction:** fabricated or unreproducible benchmark claims; reference→product escalation into marketing; project termination criteria (RFC-0001 §8) become unenforceable rhetoric.

## 3. Goals

1. Freeze **five evaluation claims** (`evaluation.c1`–`evaluation.c5`) with explicit baselines, metrics, and decision rules.
2. Define **claim lifecycle**, **protocol freeze/amendment** semantics, and **evidence publishing** contract.
3. Specify the **domain model** for claims, protocols, suites, subjects, runs, scoring, analysis, and decisions.
4. Integrate **theory oracles** as premised Lean definitions — `premiseMissing ≠ pass`.
5. Mandate **preregistered statistical analysis** with confidence intervals, effect sizes, and multiple-comparison adjustment.
6. Bind **candidate subjects** to sealed C9 certificates and **baseline subjects** to pinned version/commit/config.
7. Document **dependency rules** separating evaluation from conformance and core.
8. Amend **RFC-0003 §7** to resolve C4 definition conflict and add C5.

## 4. Non-goals

- Verifying product conformance or mutating C0–C9 certificate chains (RFC-0003 scope).
- Re-proving Lean theorems or updating `formal/proof-obligations.json` status from TypeScript.
- Holding private signing keys, runtime commit authority, or control-plane activation.
- Auto-approving human review or bypassing budget/security stop rules.
- Defining end-user product UI or marketing copy.
- Treating Vitest pass or non-empty metric fields as claim support.

## 5. Evaluation claims (evaluation.c1–evaluation.c5)

All claim codes are **namespaced** (`evaluation.cN`). They MUST NOT be abbreviated to bare `C1`–`C5` in evaluation contexts to avoid collision with conformance C0–C9.

| Code            | Claim                            | Baseline family            | Primary measurement intent (precise metrics in frozen protocol)                                                                                       |
| --------------- | -------------------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `evaluation.c1` | Expressiveness                   | Cursor                     | Existence and classification of workflows representable in CantiluneGraph that Cursor's fixed shape cannot express without contortion                 |
| `evaluation.c2` | Controllability / predictability | Codex                      | Certified finite-epoch step rank and explicit resource caps on benchmark suite; deterministic progress under fixed policy                             |
| `evaluation.c3` | Control-plane slimness           | Claude Code                | Ratio of structural-decision events to model-decision events; human-rated constraint overhead on paired tasks                                         |
| `evaluation.c4` | Engineering parsimony            | OpenClaw-family            | Feature-surface to core-code-complexity ratio; cyclomatic complexity of core vs comparable feature set (**RFC-0001 §8 definition retained**)          |
| `evaluation.c5` | Observability-as-structure       | Ad-hoc telemetry baselines | Trace–execution equivalence: replay fidelity, projection consistency across DAG/Petri/π/Morphism lenses, audit completeness vs instrumented baselines |

**C4/C5 resolution (frozen):** RFC-0001 §8 C4 (engineering parsimony vs OpenClaw) is **retained unchanged**. Observability-as-structure — previously mislabeled as C4 in RFC-0003 §7 — becomes **`evaluation.c5`**, reflecting RFC-0001 §6.3's structural observability thesis as a separately measurable claim.

Each claim MUST declare: statement, null hypothesis, target population, candidate subject policy, baseline family, primary/secondary/guardrail metrics, success/failure/inconclusive rules, sample plan, uncertainty method, multiple-comparison policy, stopping rule, rescope/termination rule, owner, and required reviewer roles.

**Governance bar:** Failure to meet any core claim (`evaluation.c1`–`evaluation.c4`) after protocol-frozen measurement is a valid project termination trigger per RFC-0001 §8. `evaluation.c5` failure triggers observability/rescope review, not automatic termination.

## 6. Claim lifecycle

Claims progress through an explicit state machine. Transitions outside this graph are forbidden.

```
proposed → protocolFrozen → measured → decided → reviewed → published → superseded | retracted
```

| Status           | Meaning                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------- |
| `proposed`       | Claim drafted; protocol not yet frozen                                                      |
| `protocolFrozen` | Parent protocol frozen; claim fields and metrics locked                                     |
| `measured`       | At least one completed run set scored and analyzed under frozen protocol                    |
| `decided`        | Aggregate analysis applied; outcome is **supported**, **notSupported**, or **inconclusive** |
| `reviewed`       | Independent reviewer quorum attested (`ClaimDecision` complete)                             |
| `published`      | Sealed decision and evidence root published to durable store                                |
| `superseded`     | Replaced by newer claim version with explicit `supersedes` link                             |
| `retracted`      | Prior published decision withdrawn with documented reason                                   |

**Invariant:** No claim may reach `published` without passing through `protocolFrozen`, `measured`, `decided`, and `reviewed`. Retroactive protocol edits after freeze require a new protocol version via **amendment** (see §7).

## 7. Evaluation protocol

An **EvaluationProtocol** bundles one or more claims with a **BenchmarkSuite**, subject selection rules, sampling/randomization/blinding plans, metric and analysis plans, missing-data and outlier policies, stopping policy, security/privacy plan refs, budget policy ref, and review policy ref.

### 7.1 Freeze and amendment

| Rule                       | Requirement                                                                                                                                             |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Preregistration            | Protocol MUST be registered and reviewed before any benchmark run attributed to it                                                                      |
| Freeze                     | `freezeProtocol` sets `frozenAt` and transitions associated claims to `protocolFrozen`; digest becomes immutable                                        |
| Amendment-only post-freeze | Changes after freeze MUST create a new protocol version with `amendmentOf` pointing to the prior protocol                                               |
| Run binding                | Every `EvaluationRun` MUST carry the frozen `planDigest` / protocol digest active at admission time                                                     |
| Analysis binding           | Aggregate analysis MUST reference the preregistered `analysisPlan`; undeclared analyses are exploratory only and MUST NOT support publishable decisions |

## 8. Domain model overview

The evaluation domain is organized into composable entities. Precise field contracts live in ADR-0011 and `@cantilune/evaluation` source; this section states roles and relationships.

| Entity                   | Role                                                                                                     |
| ------------------------ | -------------------------------------------------------------------------------------------------------- |
| **EvaluationClaim**      | A falsifiable assertion (`evaluation.cN`) with metrics, decision rules, and lifecycle status             |
| **EvaluationProtocol**   | Frozen bundle linking claims to suite, subjects, sampling, analysis, and governance plans                |
| **BenchmarkSuite**       | Versioned collection of benchmark cases with lifecycle (`draft` → `frozen` → `deprecated`)               |
| **EvaluationSubject**    | Discriminated union: **CandidateSubject** (C9-bound) or **BaselineSubject** (pinned external product)    |
| **EvaluationRunPlan**    | Executable plan: protocol ref, claim refs, subject pairing, case selection, budget reservation           |
| **EvaluationRun**        | One subject executing one plan; owns ordered **RunAttempt** list with lease/fencing for workers          |
| **RunAttempt**           | Single case execution with seeds, evidence refs (trace, observation, admission), usage, and cost records |
| **TheoryOracleEvidence** | Lean premised oracle check: scope, theorem symbol, premise refs, result (`premiseMissing` ≠ pass)        |
| **MetricDefinition**     | Declared metric: direction, aggregation, endpoint role (primary/secondary/guardrail), claim binding      |
| **MetricObservation**    | Scored observation per attempt; status `valid` / `invalid` / `missing` / `quarantined`                   |
| **JudgeProtocol**        | Scoring rubric: deterministic, schema, human, or LLM judge with blinding and inter-rater rules           |
| **AggregateAnalysis**    | Preregistered statistical summary: estimates, CIs, effect sizes, paired results, missingness audit       |
| **ClaimDecision**        | Final verdict with evidence root, reviewer attestations, guardrail violations, limitations — never bool  |
| **BudgetPolicy**         | Cost/run/token/time ceilings, provider quotas, hard-kill and safe-state rules                            |

**Evidence flow:**

```
EvaluationProtocol (frozen)
  → EvaluationRunPlan → EvaluationRun → RunAttempt
      → MetricObservation (+ TheoryOracleEvidence where applicable)
          → AggregateAnalysis → ClaimDecision → published evidence root
```

## 9. Theory oracle integration

Lean provides **premised oracle definitions**, not benchmark results.

| Rule       | Requirement                                                                                                                                                  |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Scope      | Oracles check structural properties (replay uniqueness, rank bounds, projection soundness, terminal preservation, etc.) against recorded run evidence        |
| Premises   | Each oracle lists `premiseEvidenceRefs`; missing premises yield `premiseMissing`, **never** `passed`                                                         |
| Baseline   | `theoryBaselineRef` and `proofManifestDigest` MUST pin `formal/proof-obligations.json` commit                                                                |
| Separation | Oracle pass/fail supplements empirical metrics; it does not substitute for paired baseline comparison                                                        |
| Symbols    | Known theorem symbols (e.g. `replayTargetUnique`, `projectionStepSound`, `internalRankDecrease`) are enumerated; ad-hoc symbols require protocol declaration |

**Invariant:** `kernel proved ≠ benchmark superior`. Theory oracle evidence MAY block a claim decision (`blocked` / `invalidated`) but MUST NOT alone establish `supported`.

## 10. Statistical requirements

All publishable decisions MUST satisfy preregistered analysis declared in the frozen protocol.

| Requirement                     | Rule                                                                                                      |
| ------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Preregistered analysis          | Primary estimand, method, and alpha declared before `protocolFrozen`                                      |
| Confidence / credible intervals | Reported for all primary metrics; decision rules reference interval–null relationship                     |
| Effect sizes                    | Reported alongside p-values or Bayesian equivalents; method named in analysis record                      |
| Missing data                    | Treatment declared (`exclude`, `impute`, `worstCase`, `fail`); missingness analysis included in aggregate |
| Multiple comparisons            | Adjustment method declared (e.g. Bonferroni, Holm); family of tests specified                             |
| Stopping rules                  | Interim analysis and early-stop criteria preregistered; stopping audit included in aggregate              |
| Paired design                   | Candidate–baseline pairs share case, seed policy, and blinding where applicable                           |
| Negative results                | Non-significant and inconclusive outcomes MUST be publishable with same evidence rigor as positive        |
| Exploratory analyses            | Post-hoc analyses labeled exploratory; MUST NOT flip a `notSupported` to `supported`                      |

## 11. Subject binding

### 11.1 Candidate subjects

Every candidate MUST bind a **sealed C9 `PackageConformanceCertificate`** (or equivalent release decision per RFC-0003):

- Certificate digest, artifact subject, policy ref, revocation checkpoint, and validity axis verified before run admission
- Expired, revoked, or superseded certificates block admission
- Published metrics MUST record: evidence root digest, verifier build, policy version alongside every metric row (RFC-0003 handoff §7)

### 11.2 Baseline subjects

Every baseline MUST bind **precise version/commit/config**:

- Product name, version, commit or service version, adapter version/digest
- Model, provider, tool, prompt, and policy configs pinned and digest-sealed
- Capability manifest and known limitations documented
- `provenanceUnavailable` flag required when full source pinning impossible; such runs MUST NOT support publishable superiority claims without reviewer exception

**Invariant:** Candidate and baseline are **structurally incompatible** subject kinds; pairing occurs at plan level, not by merging subject types.

## 12. Security and privacy

| Concern             | Requirement                                                                                      |
| ------------------- | ------------------------------------------------------------------------------------------------ |
| Untrusted inputs    | Benchmark cases, model outputs, tool results, and baseline artifacts treated as untrusted data   |
| Secret exclusion    | No secrets in published evidence roots; prompts and traces sanitized per privacy plan            |
| Budget hard-kill    | `BudgetPolicy.hardKillEnabled` stops runs and enters safe state on ceiling breach                |
| Provider isolation  | Worker leases with fencing tokens; stale workers cannot commit results                           |
| Data classification | Datasets carry privacy classification (`public` → `restricted`); quarantined data blocks scoring |
| LLM judges          | Judge protocols require blinding, calibration sets, and inter-rater statistics where applicable  |
| Audit trail         | Append-only run and decision ledger; tamper with metric rows invalidates claim decision          |
| Threat model        | Detailed STRIDE mapping in ADR-0011 companion                                                    |

## 13. Dependency rules

| Package                  | May depend on           | Must NOT depend on               | Relationship to conformance                         |
| ------------------------ | ----------------------- | -------------------------------- | --------------------------------------------------- |
| `@cantilune/evaluation`  | `@cantilune/core` types | `@cantilune/runtime` commit path | Reads C9 sealed output **read-only** via port       |
| `@cantilune/conformance` | core, runtime (verify)  | `@cantilune/evaluation`          | **No dependency** on evaluation                     |
| `@cantilune/core`        | —                       | evaluation, conformance          | Evaluation composes core identity/digest types only |

Evaluation domain types MUST NOT duplicate conformance certificate structures; they reference them by digest and port adapters. Cross-package test imports MUST use package exports (e.g. `@cantilune/evaluation`), not deep `src/` paths.

## 14. Implementation stages (E0–E6)

| Stage  | Scope                                                                   | Status (2026-08-12) |
| ------ | ----------------------------------------------------------------------- | ------------------- |
| **E0** | Foundation IDs, status enums, claim registry, state machines            | Prototype           |
| **E1** | Protocol freeze/amendment, claim lifecycle governance, opaque tokens    | Prototype           |
| **E2** | Subject binding (candidate C9 / baseline pin), run plan admission       | Prototype           |
| **E3** | Benchmark suite registry, run execution, attempt leasing, budget ledger | Partial             |
| **E4** | Metric definitions, judge protocols, observations, aggregate analysis   | Partial             |
| **E5** | Theory oracle evidence port, premise checking, Lean manifest bridge     | Partial             |
| **E6** | Claim decisions, reviewer attestations, durable evidence publish, CI    | Not started         |

Public benchmark claims require **E6 complete**, frozen protocol, ADR-0011 Accepted, and independent review quorum.

## 15. RFC-0003 amendment

RFC-0003 §7 currently misstates RFC-0001 §8 claims, listing C4 as observability-as-structure. **This RFC amends RFC-0003 as follows:**

| Location       | Before (RFC-0003 §7)                                                | After (amended)                                                                                                    |
| -------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Claim list     | C1 expressiveness, C2 predictability, C3 slimness, C4 observability | C1 expressiveness, C2 predictability, C3 slimness, **C4 engineering parsimony**, **C5 observability-as-structure** |
| Handoff ref    | "Eval Harness RFC/ADR pair (tracked separately)"                    | **RFC-0004** (this document) + **ADR-0011** (companion)                                                            |
| Namespace note | (absent)                                                            | Evaluation claims use `evaluation.c1`–`evaluation.c5`; conformance remains C0–C9                                   |

RFC-0003 §14 tracking row "Eval harness ADR | Not started" SHOULD read "Eval harness RFC | **Draft (RFC-0004)**; ADR-0011 companion pending".

## 16. Test / QA plan

| Tier  | Scope                                                                | Status             |
| ----- | -------------------------------------------------------------------- | ------------------ |
| L2–L4 | Unit/contract for state machines, registry, subject binding, budget  | Partial (in repo)  |
| L5    | Independent AI Eval + Statistics + QA-L5 review                      | **review-pending** |
| L6    | Integration: conformance C9 → evaluation admission → run → decision  | Partial            |
| L7    | Soak, crash-restart, tamper corpus, cross-process durable evidence   | **OPEN**           |
| CI    | Frozen-protocol benchmark workflow with published evidence artifacts | **OPEN**           |

## 17. Open questions

1. **Benchmark suite selection:** existing public suites vs bespoke Cantilune suites (RFC-0001 Q5).
2. **Baseline pinning for closed products:** minimum provenance when commit access unavailable.
3. **Human-rated C3 overhead:** rater pool size, calibration, and COI rules for publishable decisions.
4. **LLM judge policy:** when LLM judges are permitted vs required human-only for guardrail metrics.
5. **Second reviewer assignment** for Evaluation Harness RFC/ADR (governance gap).

## 18. FCP summary (not yet entered)

**Pre-FCP.** Draft complete for governance review. Entry requires:

- ADR-0011 Accepted (companion architecture decision)
- Resolution of open questions §17
- Independent AI Eval + Statistics + QA-L5 review
- Non-DRI second reader assigned
- RFC-0003 §7 amendment acknowledged by conformance maintainers

## 19. Decision record

- **Triage:** Evaluation Harness separated from Product Conformance per RFC-0003 §7 handoff; C4/C5 naming conflict resolved 2026-08-12.
- **RFC status:** Draft, 2026-08-12.
- **Implementation status:** E0–E2 prototype in `@cantilune/evaluation`; NOT public benchmark authority.

## 20. Implementation / ADR tracking

| Artifact                                 | Status             | Blocks                       |
| ---------------------------------------- | ------------------ | ---------------------------- |
| RFC-0004 Evaluation Harness (this doc)   | **Draft**          | ADR-0011, public claims      |
| ADR-0011 Evaluation harness architecture | **Accepted**       | E3–E6, CI benchmark workflow |
| RFC-0003 §7 amendment                    | Pending ack        | Conformance/eval alignment   |
| Durable evidence store                   | OPEN               | E6                           |
| Frozen-protocol CI workflow              | OPEN               | Public claims                |
| Independent AI Eval review               | **review-pending** | FCP                          |

## Next Steps

| Action                                            | Owner           | Due/Review  | Canonical Link                              |
| ------------------------------------------------- | --------------- | ----------- | ------------------------------------------- |
| Author ADR-0011 (evaluation harness architecture) | DRI + AI Eval   | Now         | `docs/adr/0011-evaluation-harness.md` (TBD) |
| Acknowledge RFC-0003 §7 amendment                 | Conformance DRI | Pre-FCP     | `docs/rfc/0003-product-conformance.md` §7   |
| Assign AI Eval + Statistics reviewers             | DRI             | Pre-FCP     | `docs/governance/reviewer-assignments.md`   |
| Complete E3–E6 implementation milestones          | Engineering     | Post-ADR    | `@cantilune/evaluation`                     |
| Enter FCP once §17 resolved                       | DRI             | post-review | this RFC §18                                |
