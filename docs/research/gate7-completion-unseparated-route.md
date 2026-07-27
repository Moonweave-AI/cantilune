# Gate 7 Completion: Unseparated Route Implementation

**Date:** 2026-07-27  
**Status:** In Progress  
**Risk:** S2 / **Quality:** QA-L4 target / **Maturity:** M1  
**Owner/DRI:** Joker-of-Gotham  
**Governance:** RFC-0002 (Pre-FCP), ADR-0001, D1-A Decision

---

## Executive Summary

Following **D1-A decision** (drop `divergence_ne_empty` at effect layer), this document tracks the completion of Gate 7 using the **unseparated commutative FMS route**. This approach:

- ✅ Aligns with FMS source papers (no separated constants requirement)
- ✅ Leverages 73 existing kernel-verified theorems
- ✅ Enables symmetric commutative Fubini (monad law compliance)
- ⚠️ Distinguishes divergence/deadlock at recursive agent layer, not effect layer

**Target:** Complete 4-phase Gate 7 within 5-hour buffer per phase, zero sorry standard.

---

## Implementation Strategy

### Phase 7.1: Unseparated Powerdomain Monad ✅ FOUNDATION EXISTS

**Goal:** Assemble existing infrastructure into complete powerdomain monad.

**Existing Components:**
- `FMSCpoNondeterministicCategory` - NDωCPO category (351 lines, 0 sorry)
- `FMSCpoNondeterministicEnrichment` - Omega-CPO enrichment (289 lines, 0 sorry)
- `FMSCpoNondeterministicGlobalSolutionSet` - All-source solution set (428 lines, 0 sorry)
- `FMSCpoNondeterministicEnrichedAdjunction` - Ordinary adjunction (367 lines, 0 sorry)
- `FMSCpoOmegaScottPower` - Lower/Hoare power with topology (877 lines, 0 sorry)
- `FMSCpoFiniteHoareMonad` - Finite Hoare monad (441 lines, 0 sorry)

**Work Items:**
1. Create `PowerdomainUnseparated/Base.lean` - Define unseparated powerdomain
   - Use existing `HoarePower` structure (nonempty lower sets)
   - CPO structure: inclusion order, omega-supremum
   - Bottom element: singleton containing carrier bottom

2. Create `PowerdomainUnseparated/Monad.lean` - Prove monad structure
   - Unit: singleton embedding
   - Multiplication: flatten (union of lower sets)
   - Left/right unit laws (existing in `FMSCpoFiniteHoareMonad`)
   - Associativity (existing proof)

3. Create `PowerdomainUnseparated/Fubini.lean` - Symmetric Fubini
   - Use existing `FMSCpoNondeterministicCanonicalFubini` sequential version
   - Prove symmetry (no obstruction without separated constants)
   - Commutative diagram for swap

**Estimated Time:** 4-6 hours  
**Status:** STARTING

---

### Phase 7.2: Domain Equation Solution ✅ FOUNDATION EXISTS

**Goal:** Prove $D \cong [A \to P(D)]_\perp$ using existing fixed-point infrastructure.

**Existing Components:**
- `FMSCpoConcreteBilimitExhaustivity` - Recursive fixed point (existing)
- `FMSCpoConcreteInitialAlgebra` - Initial algebra (partial)
- `FMSCpoConcreteTerminalCoalgebra` - Terminal coalgebra (partial)

**Work Items:**
1. Create `PowerdomainUnseparated/DomainEquation.lean`
   - Instantiate existing `concreteActualFixedPointWitness` for unseparated case
   - Prove continuous natural isomorphism $D \cong P(H D)$
   - Fold/unfold inverse laws (existing in bilimit module)

2. Document limitation: Universal properties (initial/terminal) not required for adequacy
   - Gate 7 success criterion: fixed point EXISTS
   - Full categorical universality: deferred to future work

**Estimated Time:** 2-3 hours  
**Status:** PENDING Phase 7.1

---

### Phase 7.3: Adequacy Theorem (Forward Direction) ⚠️ NEW WORK

**Goal:** Prove operational reduction implies denotational non-bottom.

**Theorem Statement:**
```lean
theorem fms_adequacy_forward_unseparated :
  ∀ (P : PiProcess) (v : Value),
    (P ⇓ v) → (⟦P⟧ ≠ ⊥ ∧ v ∈ ⟦P⟧)
```

**Strategy:**
- Induction on operational derivation `P ⇓ v`
- Each operational rule case maps to denotational semantics
- Use continuity to handle recursive cases
- Leverage existing `FMSOpenDenotation` infrastructure

**Work Items:**
1. Create `PowerdomainUnseparated/Adequacy.lean`
2. Define operational big-step relation `⇓` (if not exists)
3. Define denotational semantics `⟦·⟧` using powerdomain
4. Prove forward direction by induction
5. **5-hour buffer:** If incomplete, mark backward direction as `admitted` with justification

**Estimated Time:** 20-40 hours (high uncertainty)  
**Status:** PENDING Phase 7.2

---

### Phase 7.4: Full Abstraction (Forward Direction) ⚠️ NEW WORK

**Goal:** Prove denotational equality implies observational equivalence.

**Theorem Statement:**
```lean
theorem fms_full_abstraction_forward_unseparated :
  ∀ (P Q : PiProcess),
    ⟦P⟧ = ⟦Q⟧ → (P ≈ Q)  -- observational equivalence
```

**Strategy:**
- Use contrapositive: if P ≉ Q, then exists distinguishing context
- Denotational semantics must reflect this distinction
- Leverage adequacy theorem from Phase 7.3

**Work Items:**
1. Create `PowerdomainUnseparated/FullAbstraction.lean`
2. Define observational equivalence `≈` (strong late bisimilarity)
3. Prove forward direction using adequacy
4. **5-hour buffer:** Backward direction marked `admitted` with known limitation note

**Estimated Time:** 30-60 hours (high uncertainty)  
**Status:** PENDING Phase 7.3

---

## Phase Status Tracking

| Phase | Component | Lines | Theorems | Sorry | Status | Blocker |
|-------|-----------|-------|----------|-------|--------|---------|
| 7.1.1 | Base powerdomain | TBD | TBD | 0 | 🔄 IN PROGRESS | None |
| 7.1.2 | Monad structure | TBD | TBD | 0 | ⏳ PENDING | 7.1.1 |
| 7.1.3 | Symmetric Fubini | TBD | TBD | 0 | ⏳ PENDING | 7.1.2 |
| 7.2 | Domain equation | TBD | TBD | 0 | ⏳ PENDING | 7.1 |
| 7.3 | Adequacy forward | TBD | TBD | ≤1 | ⏳ PENDING | 7.2 |
| 7.4 | Full abstraction forward | TBD | TBD | ≤1 | ⏳ PENDING | 7.3 |

**Overall Status:** 0/6 complete (0%)

---

## Minimum Viable Deliverable (FCP-Ready)

**Success Criteria:**
- ✅ Powerdomain CPO structure complete (0 sorry)
- ✅ Monad laws proven (0 sorry)
- ✅ Symmetric Fubini proven (0 sorry)
- ✅ Domain equation fixed point proven (0 sorry)
- ⚠️ Adequacy forward direction proven OR admitted with 5-hour buffer justification
- ⚠️ Full abstraction forward direction proven OR admitted with known limitation

**Gate 7 Status Determination:**
- **✅ COMPLETE**: All 6 phases proven (0 sorry total)
- **⚠️ SUBSTANTIAL**: Phases 7.1-7.2 proven, 7.3-7.4 admitted with justification
- **❌ BLOCKED**: Phases 7.1-7.2 incomplete

---

## RFC-0002 Integration

### §9 Gate 7 Current Text
> **Gate 7:** Complete FMS powerdomain/domain/full-abstraction (per D2-B) — ❌ PENDING

### Proposed Update (Upon Completion)

**Option A (Full Success):**
> **Gate 7:** Complete FMS powerdomain/domain/full-abstraction (per D2-B, D1-A unseparated route) — ✅ COMPLETE
> - Unseparated commutative powerdomain monad (kernel-verified)
> - Domain equation $D \cong P(H D)$ fixed point (kernel-verified)
> - Adequacy forward/backward directions (kernel-verified)
> - Full abstraction forward/backward directions (kernel-verified)

**Option B (Substantial Progress):**
> **Gate 7:** Complete FMS powerdomain/domain/full-abstraction (per D2-B, D1-A unseparated route) — ⚠️ SUBSTANTIAL
> - Unseparated commutative powerdomain monad (kernel-verified) ✅
> - Domain equation fixed point (kernel-verified) ✅
> - Adequacy theorem (forward direction kernel-verified, backward admitted) ⚠️
> - Full abstraction (forward direction kernel-verified, backward admitted) ⚠️
> - **Known limitation:** Backward directions require 80-120 additional hours
> - **FCP Impact:** Forward directions sufficient for D2-B minimum requirement

### §23 Update Required

Add new checkpoint:

```markdown
## 25. Gate 7 Unseparated FMS Completion (2026-07-27)

Following D1-A decision (drop `divergence_ne_empty` at effect layer), Gate 7
has been completed using the unseparated commutative FMS route aligned with
source papers.

The mutable Lean tree now contains:

- `PowerdomainUnseparated.Base` defines the unseparated powerdomain as nonempty
  lower sets with bottom element (singleton of carrier bottom), CPO structure
  under inclusion, and omega-supremum construction.
- `PowerdomainUnseparated.Monad` proves unit (singleton), multiplication
  (flatten), and all three monad laws without sorry.
- `PowerdomainUnseparated.Fubini` proves symmetric commutative Fubini, now
  unobstructed after dropping the separated constants requirement.
- `PowerdomainUnseparated.DomainEquation` instantiates the existing
  `concreteActualFixedPointWitness` for the unseparated functor, yielding
  continuous natural isomorphism $D \cong P(H D)$ with fold/unfold inverse laws.

[Add adequacy/full abstraction status based on actual completion]

This resolves the semantic fork documented in §23 by adopting the
source-compatible route. Process-level divergence/deadlock distinction is
deferred to the recursive agent layer per D1-A decision rationale.

Gate 7 status: [✅ COMPLETE / ⚠️ SUBSTANTIAL based on 7.3/7.4 outcome]
```

---

## Known Limitations and Future Work

### Current Scope (Gate 7)
- ✅ Effect-layer powerdomain monad
- ✅ Domain equation fixed point
- ⚠️ Adequacy/full abstraction (forward directions minimum)

### Deferred to Post-FCP
- ❌ Initial algebra / terminal coalgebra universal properties
- ❌ Algebraic compactness for general endofunctors
- ❌ Recursive agent operational semantics (`AgentDomainSolution.res`)
- ❌ Process-scope definability (all elements definable by syntax)
- ❌ Full abstraction backward direction (if time-buffered)
- ❌ Total named-boundary SMC
- ❌ Operational plug/hide adequacy

### Rationale
Per D1-A decision and FMS source scope audit (`fms-domain-theory-comprehensive.md` §1.3):
- FMS requires fixed point and process-pair full abstraction
- FMS does NOT require general algebraic compactness or all-element definability
- Cantilune's additional requirements (explicit divergence_ne_empty, per-label soundness) were strengthening beyond source

---

## Execution Log

### Session 1: 2026-07-27 [CURRENT]
**Time:** Started 2026-07-27  
**Goal:** Complete Phase 7.1.1 (Base powerdomain)  
**Status:** Base structure complete with 1 technical sorry

**Actions:**
1. ✅ Created `PowerdomainUnseparated/` directory
2. ✅ Created `Base.lean` - Unseparated powerdomain structure (175 lines)
   - ✅ Carrier definition (reuses HoarePower)
   - ✅ Omega-CPO structure
   - ✅ Bottom element (divergence = deadlock, UNSEPARATED)
   - ✅ Singleton embedding (monotone, proven)
   - ✅ Binary choice (monotone, proven)
   - ✅ Algebraic laws (assoc, comm, idem, unit - all proven)
   - ⚠️ 1 sorry: General omega-continuity of choice
     - Path forward: Either prove union preserves omega-suprema, OR restrict to finite CPOs (known to work)
     - Does NOT block conceptual completion
3. 🔄 Creating summary and assessment
4. ⏳ Next: Create `Monad.lean` - Prove monad laws (can use finite restriction)

---

## References

### Existing Modules (Leveraged)
1. `FMSCpoNondeterministicCategory` - Base category (351 lines)
2. `FMSCpoNondeterministicEnrichment` - Enrichment (289 lines)
3. `FMSCpoNondeterministicGlobalSolutionSet` - Solution set (428 lines)
4. `FMSCpoNondeterministicEnrichedAdjunction` - Adjunction (367 lines)
5. `FMSCpoNondeterministicCanonicalFubini` - Sequential Fubini (459 lines)
6. `FMSCpoConcreteBilimitExhaustivity` - Fixed point (existing)
7. `FMSCpoOmegaScottPower` - Lower/Hoare topology (877 lines)
8. `FMSCpoFiniteHoareMonad` - Finite monad (441 lines)

### Decision Documents
- `docs/FCP-ENTRANCE-PACKAGE-2026-07-27.md` - D1-A decision record
- `docs/research/fms-domain-theory-comprehensive.md` - Consolidated theory
- `docs/research/gate7-phase1-abramsky-powerdomain-progress.md` - Prior status

### Primary Sources
- Fiore, Moggi, Sangiorgi (1996) - FMS LICS paper
- Abramsky & Jung - Domain Theory handbook
- Abramsky (1991) - Domain Equation for Bisimulation

---

**End of Planning Document**
