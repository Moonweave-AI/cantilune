# ADR-0001: Unified Formal Structure for Cantilune

| Field | Value |
|---|---|
| Status | **Proposed** (awaiting second reviewer per RFC-0001) |
| Date | 2026-07-23 |
| Decision Owner | Joker-of-Gotham (DRI) |
| Reviewers | TBD (governance gap — see RFC-0001 §0) |
| Related | RFC-0001 |
| Risk | S2 |

## Context

RFC-0001 establishes `cantilune` as an agent-orchestration framework whose core is a **unified formal structure** subsuming four formalisms as aspects rather than choosing among them. The structural decision is the first irreversible architectural choice: every downstream phase (executor, comms, observability, eval) depends on it.

The triage decision (2026-07-23) explicitly chose this unification over single-formalism alternatives, on the reasoning that each formalism owns a distinct facet of orchestration and each facet maps to a distinct baseline failure mode:

| Formalism | Facet | Baseline failure mode addressed |
|---|---|---|
| DAG | Presentation / data-flow clarity | Cursor (fixed shape $\Rightarrow$ limited expressiveness) |
| Petri net | Concurrency / resource essence | Codex (no termination/boundedness $\Rightarrow$ uncontrollable) |
| π-calculus | Communication essence | Codex/A2A (informal comms $\Rightarrow$ unpredictable flow) |
| Morphisms (category theory) | Composition / mapping essence | OpenClaw (no parsimonious core $\Rightarrow$ bloat) |

## Decision

`cantilune` adopts a **unified formal object**, working name **`CantiluneGraph`**, that admits four well-defined projections, each grounded in one of the four formalisms. The four projections are **consistent views of one object** via functorial mappings, not four disconnected models.

### Projections

1. **DAG projection** — the typed data-dependency graph. Edges carry **data contracts** (schema + pre/post-conditions). Owns expressiveness and the "what depends on what" presentation.
2. **Petri projection** — the concurrency/control layer. Places model **resources** (context window, tool rate limits, human-attention slots); transitions fire on token readiness. Owns bounded concurrency, resource-bounding, termination/liveness.
3. **π-calculus projection** — the communications layer. Inter-agent channels as named processes; formal semantics for dynamic topology and channel mobility. Owns A2A comms essence.
4. **Morphism projection** — the composition layer. Agents/operations as morphisms in a category; orchestration $=$ composition. Owns minimal precise composition/refactor semantics.

### Consistency requirement (normative)

The framework **must** define functorial mappings between projections such that a fact in one projection has a well-defined interpretation in the others — e.g., a DAG edge corresponds to a Petri token-flow path corresponds to a π-calculus channel message corresponds to a morphism composition. **Without this, the four projections are four disconnected models and the "unified structure" claim is false.** This consistency proof is a P1 deliverable and a gate for ADR-0001 acceptance.

## Alternatives considered

| Alternative | Rejected because |
|---|---|
| DAG only | No formal concurrency/termination (weak vs Codex); no comms essence; reproduces "just DAG" (LangGraph-equivalent) |
| Single formalism (Petri / π / morphism) | Loses the other facets; each facet maps to a distinct failure mode the DRI wants addressed |
| Category theory as the sole foundation | Maximally general but abstract and hard to tie to concrete eval wins; inaccessible to the target ecosystem |
| Four disconnected models glued by code | Reproduces OpenClaw bloat; no formal consistency; observability-as-structure fails |

## Consequences

**Positive:**
- Addresses all four baseline failure modes by construction.
- Defensible vs LangGraph (combinatorial wedge: typed edges + resource semantics + model-decoupled routing + observability-as-structure).
- Observability and replay fall out of the formal model.
- Phased extension is natural (add projections incrementally).

**Negative / risks:**
- Specification complexity: the functorial-consistency requirement is non-trivial and is the main technical risk. **Mitigation:** make the consistency proof a P1 gate; if it cannot be shown for all four, reduce to the subset that is consistent and document the reduction.
- Scope/bloat risk if projections accrete without parsimony. **Mitigation:** phased plan (RFC §13); each projection must clear its eval claim.
- Reviewer gap: no second reviewer yet. **Mitigation:** gate ADR-0001 acceptance on reviewer sign-off.

## Open questions for ADR-0001 (to resolve before acceptance)

1. Concrete syntax/type-system for `CantiluneGraph`. — **Partially resolved:** see `docs/spec/formal-semantics.md` v0.1 (SMC $C$ $+$ rewriting $R$); Q4 (policy DSL) still open.
2. The functorial mappings between projections — stated precisely, not hand-waved. — **Partially resolved / split:** see RFC-0002. Three projections (DAG/Petri/morphism) by construction; π projection **待证** under the half-π (II) decision.
3. What is the minimal consistent subset if full four-way consistency cannot be proven? (fallback) — **Resolved as policy:** RFC-0002 §6 binds the fallback (reduce π to proven sublanguage, mark rest unverified); P1c (full π mobility) explicitly deferred.
4. Policy DSL expressiveness vs termination guarantees (interacts with the Petri projection). — **Still open.**

## 2026-07-23 follow-up decisions (recorded here as the structural ADR of record)

- **Unified object concretized:** $\text{CantiluneGraph} = (C, R)$ — SMC $C$ (static) $+$ string-diagram rewriting $R$ (dynamics). Replaces the earlier 6-tuple sketch $(N, E, S, T, C, M)$, which was a container, not a unity.
- **π-projection scope (half-π (II)):** request/accept dynamic channel creation + **free (untyped) post-handshake conversation** = full π-calculus with presheaf semantics. Consistency is **待证, not by construction**; phased proof in RFC-0002 (P1b sublanguage, P1c deferred).
- **Dynamics:** string-diagram rewriting (not bare LTS), so a single execution step is one rewrite read in four formalisms.
- **Proof strategy:** 明示分期 (phased, explicit) — P1a by-construction (3 projections) + P1b π sublanguage + P1c deferred π full, with binding fallback.

## Verifiability

This ADR is **Proposed**, not Accepted. Its claims (especially functorial consistency) are **unverified** until demonstrated in the P1 deliverable. Per governance, no implementation should proceed on an un-Accepted structural ADR beyond P1 scoping work.

## References

- RFC-0001 (`docs/rfc/0001-cantilune-architecture.md`)
- Triage record (2026-07-23, this conversation — to be written to an Issue as canonical source)
