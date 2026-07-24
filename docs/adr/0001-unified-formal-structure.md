# ADR-0001: Unified Formal Structure for Cantilune

| Field | Value |
|---|---|
| Status | **Proposed** (awaiting second reviewer per RFC-0001) |
| Date | 2026-07-23 |
| Last reconciled | 2026-07-24 (proof scope only; no acceptance) |
| Decision Owner | Joker-of-Gotham (DRI) |
| Reviewers | TBD (governance gap — see RFC-0001 metadata / governance note) |
| Related | RFC-0001, RFC-0002, `docs/spec/formal-semantics.md`, `docs/research/0001-p1b-pi-bridge-audit.md` |
| Risk | S2 |

## Context

RFC-0001 establishes `cantilune` as an agent-orchestration framework whose core is a **unified formal structure** subsuming four formalisms as aspects rather than choosing among them. The structural decision is the first irreversible architectural choice: every downstream phase (executor, comms, observability, eval) depends on it.

The triage decision (2026-07-23) explicitly chose this unification over single-formalism alternatives, on the reasoning that each formalism owns a distinct facet of orchestration and each facet maps to a distinct baseline failure mode:

| Formalism | Facet | Baseline failure mode addressed |
|---|---|---|
| DAG | Presentation / data-flow clarity | Cursor (fixed shape $\Rightarrow$ limited expressiveness) |
| Petri net | Concurrency / resource essence | Codex (missing explicit termination and resource-bound evidence $\Rightarrow$ uncontrollable) |
| π-calculus | Communication essence | Codex/A2A (informal comms $\Rightarrow$ unpredictable flow) |
| Morphisms (category theory) | Composition / mapping essence | OpenClaw (no parsimonious core $\Rightarrow$ bloat) |

## Decision

`cantilune` adopts a **unified formal object**, working name **`CantiluneGraph`**, with the normative design target of four projections grounded in the four formalisms. Those projections are **required to become consistent views of one object** through event-preserving functorial mappings; this is an acceptance criterion, not the current proof state.

### Projections

1. **DAG projection** — the typed data-dependency graph. Edges carry **data contracts** (schema + pre/post-conditions). Owns expressiveness and the "what depends on what" presentation.
2. **Petri projection** — the concurrency/control layer. Places model **resources** (context window, tool rate limits, human-attention slots); transitions fire on token readiness. Owns resource and concurrency invariants plus explicit termination/liveness proof obligations; boundedness alone is not termination.
3. **π-calculus projection** — the communications layer. Inter-agent channels as named processes; formal semantics for dynamic topology and channel mobility. Owns A2A comms essence.
4. **Morphism projection** — the composition layer. Agents/operations as morphisms in a category; orchestration $=$ composition. Owns minimal precise composition/refactor semantics.

### Consistency requirement (normative)

The framework **must** define functorial mappings between projections such that a fact in one projection has a well-defined interpretation in the others — e.g., a DAG edge corresponds to a Petri token-flow path corresponds to a π-calculus channel message corresponds to a morphism composition. **Without this, the four projections are four disconnected models and the "unified structure" claim is false.** This consistency proof is a P1 deliverable and a gate for ADR-0001 acceptance.

**Status qualification:** this paragraph is the normative target, not an established theorem. The 2026-07-23 audit addendum below records that only the morphism identity case is complete; the other rule maps remain open.

## Alternatives considered

| Alternative | Rejected because |
|---|---|
| DAG only | No formal concurrency/termination (weak vs Codex); no comms essence; reproduces "just DAG" (LangGraph-equivalent) |
| Single formalism (Petri / π / morphism) | Loses the other facets; each facet maps to a distinct failure mode the DRI wants addressed |
| Category theory as the sole foundation | Maximally general but abstract and hard to tie to concrete eval wins; inaccessible to the target ecosystem |
| Four disconnected models glued by code | Reproduces OpenClaw bloat; no formal consistency; observability-as-structure fails |

## Consequences

**Positive (conditional on the acceptance gate):**
- Would address all four baseline failure modes once the corresponding projection theorems are actually proven.
- Defensible vs LangGraph (combinatorial wedge: typed edges + resource semantics + model-decoupled routing + observability-as-structure).
- Observability, replay, and deadlock classification follow only after the
  observable quotient LTSs, event-lift/exhaustiveness relations, shared event
  identity, granularity policies, and terminal predicates are independently
  defined and proven consistent.
- Phased extension is natural (add projections incrementally).

**Negative / risks:**
- Specification complexity: the functorial-consistency requirement is non-trivial and is the main technical risk. **Mitigation:** make the consistency proof a P1 gate; if it cannot be shown for all four, reduce to the subset that is consistent and document the reduction.
- Scope/bloat risk if projections accrete without parsimony. **Mitigation:** phased plan (RFC §13); each projection must clear its eval claim.
- Reviewer gap: no second reviewer yet. **Mitigation:** gate ADR-0001 acceptance on reviewer sign-off.

## Open questions for ADR-0001 (to resolve before acceptance)

1. Concrete syntax/type-system for `CantiluneGraph`. — **Partially resolved:** see `docs/spec/formal-semantics.md` v0.1 (SMC $C$ $+$ rewriting $R$); Q4 (policy DSL) still open.
2. The functorial mappings between projections — stated precisely, not hand-waved. — **Still open, split in RFC-0002.** The original expectation was “three by construction”; the audit establishes only the morphism identity case. DAG/Petri rewrite preservation remains unproven; the π dual-route architecture is selected, but its proof remains open.
3. What is the minimal consistent subset if full four-way consistency cannot be proven? (fallback) — **Resolved as policy:** RFC-0002 §6 binds the fallback (reduce π to proven sublanguage, mark rest unverified); P1c (full π mobility) explicitly deferred.
4. Policy DSL expressiveness vs termination guarantees (interacts with the Petri projection). — **Still open.**
5. Ownership of state congruences, administrative-step policies, observable
   derivation domains, and successful-terminal predicates. — **Still open;
   required by RFC-0002 clause (4).**

## 2026-07-23 follow-up decisions (recorded here as the structural ADR of record)

- **Unified object concretized:** $\text{CantiluneGraph} = (C, R)$ — SMC $C$ (static) $+$ string-diagram rewriting $R$ (dynamics). Replaces the earlier 6-tuple sketch $(N, E, S, T, C, M)$, which was a container, not a unity.
- **π-projection scope (half-π (II)):** request/accept dynamic channel creation + finite-epoch post-handshake conversation and mobility, without internal recursion or replication. The verified FMS reference uses covariant functor categories, not the contravariant presheaf notation previously used here. The proposed implementation now selects a typed open-process SMC plus a pointwise-cartesian FMS denotational route, with a mandatory commuting theorem; consistency remains **待证, not by construction**.
- **Dynamics:** string-diagram rewriting (not bare LTS). Once concrete event records, independently specified observable quotient LTSs, event lifts, terminal predicates, and all projection maps are defined and proven, one execution event is intended to have four formal readings without terminal-state drift; this is not yet established.
- **Proof strategy:** 明示分期 (phased, explicit) — P1a for the three non-π projections + P1b π sublanguage + P1c deferred π full, with binding fallback. The per-projection statuses are governed by RFC-0002 §3.1, not the original “three by construction” expectation.

## 2026-07-23 independent-audit addendum

This addendum corrects proof status and source usage; it does **not** select a replacement π target or alter the unified-structure decision.

| Field | Result |
|---|---|
| Classification | Formal architecture audit; S2; QA-L4; Pre-FCP/M1 |
| P1a | Static construction partial; morphism identity complete; DAG/Petri rule maps open |
| P1b A–B | Verified; target variance corrected to covariant $\mathbf{Set}^{\mathbb I}/\mathbf{Cpo}^{\mathbb I}$ |
| P1b C | Handed-off non-standard π-parallel tensor rejected as ill-typed |
| P1b D | Pointwise-cartesian conditional theorem identified; actual object/generator map absent |
| P1b E | Not well-formed until request/accept BNF and $R_{\mathrm{RA}}$ are defined |
| Disposition | **Iterate, not Promote**; ADR remains Proposed |

The audit also rejects two load-bearing shortcuts: strong monoidality does not imply preservation of DPO pushouts, and a bisimulation quotient is neither necessary nor sufficient to turn π process elements into the required target SMC.

## 2026-07-23 implementation-decision addendum

Subsequent to the independent audit, the implementation scope selects both
targets instead of choosing one as a substitute for the other:

1. a typed open-process SMC, where interfaces are objects, composition is
   plugging plus hiding, and tensor is parallel composition; and
2. the covariant FMS functor-category route with its pointwise cartesian
   tensor, where π parallel remains an internal operation on the agent object.

Acceptance requires a commuting and observational-compatibility theorem from
the typed route, through erased native π, to the pinned FMS interface. Native
one-step source events may not be silently weakened to $\tau^*$.

This addendum selects the proof architecture only. The current unreviewed Lean
tree now kernel-builds the presented open-process SMC, native erasure, finite
closed request/accept and one-delegation certificates that reflect every
native action from their mapped states, finite-control alpha/structural
late-π, the genuine pointwise finite-power monad, natural supported-process
support semantics, finite `P_f(H-)` stages, and a conditional support-level
FMS commutation theorem. Support allocation followed by hiding now satisfies
continuous-natural-transformation retraction equations, but this is only a
support-object law, not the FMS agent restriction/coherence package. The
strengthened version-pinned
`CompleteExternalFMSTheoremPackage` states the full acceptance interface, but
`CompleteFMSAvailable` has no inhabitant. The finite reference π column is now
native in all 15 rows, and the three critical admitted operations have exact
event/epoch/replay trajectory theorems, including exact stored endpoints,
arbitrary finite-subsegment replay and fixed-signature epoch alignment, and
kernel-derived finite-height expectation bounds. However, the current open
reconnect/delete encodings have additional standard-late environmental
transitions, so their event-indexed certificate is not full reflection for
the whole raw late LTS. A separate closed redesign supplies genuine native
$\tau$ steps for four internal event families and now classifies every native
transition from those four closed sources exactly. This still does not supply
a full reflection certificate: the closed open/close endpoint has a further
payload $\tau$ step, and Lean proves that the current two-state-per-event
source LTS cannot reflect that full target. A reviewed multi-state protocol or
different terminal endpoint is required. The remaining product-wide rule
family is still not constructed. The tree also does not
supply the shared
four-projection execution package or the total theorem.
Exact scope is recorded in `formal/proof-obligations.json`; the ADR therefore
remains **Proposed**.

**Proposed amendment, 2026-07-23:** following explicit requester
authorization to continue the full theory, the finite-control π reference
calculus adds the standard proof-guarded mismatch form `[a≠b]P`. Instance
reconnect is interpreted as ordinary channel delegation, and quiescent
instance deletion as a native shutdown handshake with zero continuations.
All three are genuine one-step π derivations; no metadata transition or weak
closure is introduced. This lifts the earlier missing-witness obstruction:
all 15 P1c π cells now have native witnesses. It does not lift the stronger
full-late-reflection obstruction: the open reconnect/delete handshakes also
have environmental transitions. The finite reference calculus subsequently
closed all 60 event-indexed cells and four restricted operational
certificates.
The ADR remains Proposed until Owner/DRI and process-semantics review; the
general admitted-rule/static/resource/admission theorem remains open.

Required evidence before acceptance:

1. define exact source syntax, configurations, rules, freshness, and granularity;
2. construct and independently check an inhabitant of the now-explicit
   complete FMS powerdomain/domain/action/hiding/full-abstraction interface;
3. extend the implemented SMC/reference certificates to the full admitted rule set;
4. independently define observable target derivations, state congruences,
   administrative-step policies, and event-lift/exhaustiveness relations;
5. define and prove preservation/reflection of successful-terminal predicates;
6. complete DAG/Petri direct rule-map proofs; and
7. obtain independent formal-math/category/process-semantics review.

## Verifiability

This ADR is **Proposed**, not Accepted. Its claims (especially functorial consistency) are **unverified** until demonstrated in the P1 deliverable. Per governance, no implementation should proceed on an un-Accepted structural ADR beyond P1 scoping work.

## References

- RFC-0001 (`docs/rfc/0001-cantilune-architecture.md`)
- RFC-0002 (`docs/rfc/0002-projection-consistency.md`)
- Formal semantics (`docs/spec/formal-semantics.md`)
- P1b independent audit (`docs/research/0001-p1b-pi-bridge-audit.md`)
- Triage record (2026-07-23, this conversation — to be written to an Issue as canonical source)
