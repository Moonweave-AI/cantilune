# Cantilune DRI Decision Dashboard

**Last Updated**: 2026-07-27  
**Decision Owner**: Joker-of-Gotham  
**Status**: Pre-FCP / M1

---

## Purpose

This document consolidates **all outstanding decisions** required to move Cantilune from Pre-FCP to FCP and eventual ADR-0001 acceptance. It is designed for **rapid DRI review and human-in-the-loop decision making**, separating implementation evidence from architectural choices that only humans can make.

---

## Critical Path Decisions (Block FCP Entry)

### D1. FMS Powerdomain Architecture Choice

**Decision Required**: How to resolve the kernel-proved inconsistency in the FMS effect layer?

**Context**: `no_commutative_first_strict_pairing` proves that commutative Fubini sequencing, strict preservation of both divergence and deadlock, and `divergence_ne_empty` cannot coexist.

**Options**:

| Option | Description | Pros | Cons | Effort |
|--------|-------------|------|------|--------|
| **A** | Drop `divergence_ne_empty` at effect layer; prove distinctions through recursive agent (source-compatible) | Matches FMS paper exactly; no semantic change | Loses effect-level separation | Low |
| **B** | Keep separation, drop commutativity (evaluation-ordered effects) | Retains separation | Changes observable exchange law; major reproof | High |
| **C** | Keep separation and commutativity, weaken strictness | Preserves commutativity | May break categorical structure | Medium |
| **D** | Different algebra/morphism theory | Maximum flexibility | Complete rework; high risk | Very High |

**Recommendation**: **Option A** - Source-compatible, minimal rework, preserves existing proofs.

**RFC Section**: RFC-0002 §22.1  
**ADR Section**: ADR-0001 "2026-07-26 FMS source-scope clarification"

**DRI Action Required**: [ ] Select option A/B/C/D and document in RFC-0002 §16 revision

---

### D2. Complete FMS vs Finite-Control P1 Scope

**Decision Required**: Is a complete Cpo^I Abramsky powerdomain mandatory for P1, or can P1 ship with finite-control operational π?

**Context**: RFC-0002 §16 proposes making complete FMS (powerdomain, domain equation, hiding, adequacy, full abstraction) an optional extension since P1 excludes recursion/replication.

**Options**:

| Option | Description | Impact on Timeline | Risk |
|--------|-------------|-------------------|------|
| **A** | Accept §16: finite-control normative, FMS optional | P1 proceeds after P1b reflection completes | Theory incomplete for future recursive extensions |
| **B** | Reject §16: complete FMS mandatory for P1 | P1 blocked until major domain-theory work | High confidence in foundations |

**Factors**:
- P1 admitted calculus is finite-control by design
- FMS source includes guarded replication (not in P1 scope)
- Complete FMS requires significant additional work (Abramsky construction, algebraic compactness, adequacy, full abstraction)

**Recommendation**: **Option A** - P1 scope matches P1 admitted language; defer FMS extension to post-P1.

**RFC Section**: RFC-0002 §16  
**ADR Section**: ADR-0001 "2026-07-25 pending FMS scope decision"

**DRI Action Required**: [ ] Accept or reject RFC-0002 §16 proposal and update ADR-0001 acceptance criteria

---

### D3. Theory vs Product Boundary for FCP

**Decision Required**: Should FCP gate on product instantiation or only on abstract theory completion?

**Context**: Current RFC-0002/ADR-0001 mix theory obligations (prove meta-theorems) with product obligations (eight packages provide certificates). The eight packages don't exist yet.

**Current Problematic Gates**:
- "arbitrary typed-DPO map absent" (RFC-0002 §3.1)
- "general rule-to-firing map absent" (RFC-0002 §4.1)
- "production rule-family/static/resource certificates" (ADR-0001)

**Proposed Split**:

**Core Theory FCP** includes:
- Generic interfaces (ProjectionCertificate, ExecutionPackage, etc.)
- Meta-theorems quantifying over abstract certificate carriers
- Reference witnesses proving non-vacuity
- Complete finite-control operational π (if D2 Option A)

**Core Theory FCP** excludes:
- Eight product packages
- Product-specific rule inventories
- Product rank/Petri/resource/authorization/fairness instances

**Product Conformance Gate** (後續門) includes:
- Each package's rule inventory
- Each package's projection certificates
- Product-specific policies

**Recommendation**: **Adopt the split**. Theory proves "for any X satisfying these interfaces, theorem T holds." Products later instantiate X.

**Reference Document**: `docs/research/0018-theory-product-boundary-clarification-2026-07-27.md`

**DRI Action Required**: [ ] Accept theory/product split and amend RFC-0002 §3.1, §4.3 and ADR-0001 acceptance criteria

---

### D4. π Metadata Layer - Version Provenance

**Decision Required**: How to handle runtime signature version tracking in the π projection?

**Context**: Pure π-calculus has no notion of "signature version." Dynamic admission advances version; pure π states have version 0. Delegation and reconnect share the same raw transition triple (lose provenance).

**Options**:

| Option | Description | Compatibility | Effort |
|--------|-------------|--------------|--------|
| **A** | Separate metadata layer (enriched π target) | Clean separation; pure π stays standard | Medium |
| **B** | Version-enriched π semantics | Single unified target | Non-standard π |
| **C** | Restrict to no dynamic admission | Avoids the conflict | Loses key capability |

**Recommendation**: **Option A** - Standard π for theory, enriched layer for product runtime.

**RFC Section**: RFC-0002 §4.3 P1c amendment  
**ADR Section**: ADR-0001 "2026-07-24 implementation-scope correction"

**DRI Action Required**: [ ] Select metadata representation strategy and document in RFC-0002

---

## High-Priority Decisions (Affect FCP Scope)

### D5. Strict DAG Projection Scope

**Decision Required**: Is DAG projection total or conditional on rankability?

**Context**: `DAGScopeObstruction` proves well-typed self-loops have no strict rank. Conversely, `RankableDAG` proves explicit ranks yield acyclic DAG projections.

**Options**:

| Option | Scope | Product Impact |
|--------|-------|----------------|
| **A** | Rankable/acyclic restriction (normative) | DAG projection defined only for acyclic graphs | Products must prove/maintain acyclicity |
| **B** | Extended DAG (handle cycles via SCC) | Total projection | Redefine "DAG view" semantics |
| **C** | Partial projection (best-effort) | DAG when possible | Runtime checks; graceful degradation |

**Recommendation**: **Option A** - Clean mathematical boundary; aligns with "data flow" intuition.

**RFC Section**: RFC-0002 Q8  
**ADR Section**: ADR-0001 proof status table

**DRI Action Required**: [ ] Fix normative DAG scope in RFC-0002 §4.1

---

### D6. Named Open-π SMC Representation

**Decision Required**: How to represent named boundaries for compositional Open-π category?

**Context**: Current concrete-name representation rejects nonempty same-name identity wires. Total plug/hide/composition require different boundary metadata.

**Options**:

| Option | Representation | Pros | Cons |
|--------|----------------|------|------|
| **A** | Positional boundaries with polarity/usage | Compositional by construction | Major infrastructure rework |
| **B** | Refined nominal with fresh supply | Smaller change | Must prove renaming adequacy |
| **C** | Accept non-compositional π | No change needed | Loses "build big from small" formally |

**Recommendation**: **Option B** - Balances effort with capability.

**RFC Section**: RFC-0002 P1b/P1c  
**ADR Section**: ADR-0001 "2026-07-26 NDωCPO and exact-boundary update"

**DRI Action Required**: [ ] Choose boundary representation and update π infrastructure plan

---

### D7. P1c Full Reflection - Environmental Transitions

**Decision Required**: How to achieve full standard-late reflection for reconnect/delete?

**Context**: Open handshakes expose environmental transitions; closed version has extra payload τ step. Current two-state-per-event LTS cannot reflect full target.

**Options**:

| Option | Approach | Correctness | Effort |
|--------|----------|-------------|--------|
| **A** | Multi-state protocol (3+ states per event) | Full reflection possible | High (redesign + reproof 60 cells) |
| **B** | Different terminal endpoint (merge payload) | May achieve reflection | Medium (encoding change) |
| **C** | Restricted protocol (structural hiding) | Avoids exposure | Limits where reconnect/delete work |

**Recommendation**: **Option A** if time permits; **Option C** as pragmatic fallback for P1.

**RFC Section**: RFC-0002 §4.3 P1c  
**ADR Section**: ADR-0001 "2026-07-26 labelled residual and product-interface update"

**DRI Action Required**: [ ] Select P1c reflection strategy (full vs restricted)

---

## Medium-Priority Decisions (Implementation Strategy)

### D8. Petri Pre-Net Semantics

**Decision Required**: Continue with individual-token provenance or switch to standard collective semantics?

**Context**: Current choice (declaration-order pre-nets, free SSMC) retains token identity for debugging. Requires defining marking/enabling for every rule.

**Options**:
- **Keep individual-token**: Better provenance, more proof work
- **Switch to collective**: Simpler proofs, lose identity tracking

**Recommendation**: Keep individual-token (differentiator vs standard tools).

**RFC Section**: RFC-0002 §4.1  
**DRI Action Required**: [ ] Confirm Petri semantics choice

---

### D9. Observable Derivation Granularity

**Decision Required**: What counts as "one observable step" in each projection? What is administrative?

**Context**: RFC-0002 clauses (2)-(3) require independently specified observable LTS quotients and administrative-step policies.

**Options**:
- **Define per-projection granularity**: Principled but requires careful design
- **Identity policy (every step observable)**: Simple but may expose noise

**Recommendation**: Define granularity policies before FCP.

**RFC Section**: RFC-0002 Q7  
**DRI Action Required**: [ ] Specify observable LTS and administrative policies for all four projections

---

### D10. Terminal Success Predicates

**Decision Required**: How to distinguish successful termination from deadlock?

**Context**: (C,R) alone classifies "stuck" but not "good stuck" vs "bad stuck."

**Options**:
- **Central predicate**: One T_ok for all workflows
- **Package-level**: Each workflow defines success
- **Trivial**: All terminal states are success (for P1)

**Recommendation**: Package-level (flexibility) with generic interface.

**RFC Section**: RFC-0002 Q7  
**DRI Action Required**: [ ] Define terminal classification strategy

---

## Low-Priority / Deferred Decisions

### D11. Cost Annotation for Time Bounds
**Status**: Explicitly deferred to post-v0.1 (Spec §8)  
**Action**: None required for P1

### D12. Marking Invariant Checkers
**Status**: Tooling, not theory (RFC-0002 §5)  
**Action**: Post-P1 formal simulator

### D13. Guarded Replication Extension
**Status**: Outside P1 scope unless D2 Option B chosen  
**Action**: None required for P1 if D2 Option A

### D14. Critical Pair Completeness
**Status**: Deferred (Spec §12)  
**Action**: None required for P1

---

## Documentation Decisions (Process)

### D15. Research Log Consolidation

**Decision Required**: Approve consolidation of 11 date-stamped logs (0007-0017)?

**Context**: 11 research logs created in 2 days (log-style accumulation). See full analysis in separate agent report.

**Proposed Consolidation**:
1. Merge FMS cluster (0007, 0009, 0010, 0011, 0012, 0014) → `fms-domain-theory-comprehensive.md`
2. Extract stable conclusions from 0006 → thematic documents
3. Create `CURRENT-STATUS.md` as single source of truth

**Effort**: 7-11 days  
**Risk**: Medium (technical synthesis required)

**DRI Action Required**: [ ] Approve consolidation plan and prioritize

---

### D16. Bilingual Documentation Strategy

**Decision Required**: Consolidate English first, then translate? Or maintain parallel?

**Recommendation**: Consolidate English → translate consolidated docs (reduces burden from 11 → 3 translations)

**DRI Action Required**: [ ] Approve bilingual workflow

---

## Decision Matrix Summary

| ID | Decision | Urgency | Blocks | Recommended | Status |
|----|----------|---------|--------|-------------|--------|
| D1 | FMS architecture | Critical | FCP | Option A | ⏸️ Pending DRI |
| D2 | FMS P1 scope | Critical | FCP | Option A (§16) | ⏸️ Pending DRI |
| D3 | Theory/product split | Critical | FCP | Accept split | ⏸️ Pending DRI |
| D4 | π metadata | Critical | P1c | Option A | ⏸️ Pending DRI |
| D5 | DAG scope | High | P1a | Option A | ⏸️ Pending DRI |
| D6 | π boundaries | High | P1b | Option B | ⏸️ Pending DRI |
| D7 | P1c reflection | High | P1c | Option A/C | ⏸️ Pending DRI |
| D8 | Petri semantics | Medium | P1a | Keep current | ⏸️ Pending DRI |
| D9 | Observable LTS | Medium | FCP | Define policies | ⏸️ Pending DRI |
| D10 | Terminal predicates | Medium | FCP | Package-level | ⏸️ Pending DRI |
| D11-14 | Deferred items | Low | None | No action | ✅ Deferred |
| D15 | Doc consolidation | Medium | Quality | Approve plan | ⏸️ Pending DRI |
| D16 | Bilingual workflow | Low | Quality | Consolidate first | ⏸️ Pending DRI |

---

## FCP Entry Checklist

To enter FCP, the following decisions must be made:

**Critical Path** (must all be decided):
- [ ] D1: FMS architecture choice recorded in RFC-0002
- [ ] D2: FMS P1 scope decision recorded in ADR-0001
- [ ] D3: Theory/product boundary split applied to RFC-0002 and ADR-0001
- [ ] D4: π metadata strategy documented in RFC-0002

**High Priority** (at least documented, even if work incomplete):
- [ ] D5: DAG scope fixed in RFC-0002 §4.1
- [ ] D6: π boundary representation chosen
- [ ] D7: P1c reflection strategy chosen (full or restricted)

**Process Requirements**:
- [ ] Independent reviewers assigned (formal-math, process-semantics)
- [ ] Immutable commit evidence prepared
- [ ] D15: Documentation consolidated to reduce review burden

---

## Next Steps for DRI

1. **Schedule decision session** to resolve D1-D4 (critical path)
2. **Review agent reports** for detailed technical context:
   - Conflicts report (16 conflicts extracted, plain language explanations)
   - Documentation structure analysis (consolidation strategy)
   - Theory/product boundary clarification (`docs/research/0018-...`)
3. **Update RFC-0002 and ADR-0001** with decisions
4. **Assign reviewers** (currently TBD)
5. **Approve documentation consolidation** (D15)
6. **Enter FCP** once critical decisions made

---

## Contact & Context

**Decision Owner**: Joker-of-Gotham (DRI)  
**Current Branch**: `codex/theory-foundation`  
**Governance Framework**: Moonweave AI governance (S2 risk, QA-L4 target)

**Supporting Documents**:
- Full conflict analysis: (agent report ac125815e31e32929)
- Documentation structure analysis: (agent report aa135ac7b0af0d05d)
- Theory/product boundary: `docs/research/0018-theory-product-boundary-clarification-2026-07-27.md`
- Current RFC-0002: `docs/rfc/0002-projection-consistency.md`
- Current ADR-0001: `docs/adr/0001-unified-formal-structure.md`
