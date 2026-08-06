# FMS Domain Theory Comprehensive Reference

**Status:** Consolidated background reference; current proof status lives in 0021–0027
**Date:** 2026-07-27 (consolidating research from 2026-07-26)  
**Risk:** S2 / **Quality:** QA-L4 target / **Maturity:** Pre-FCP M1  
**Owner/DRI:** Joker-of-Gotham  
**Governance:** RFC-0002 (Pre-FCP), ADR-0001 (Proposed)

> **Reading rule (2026-07-28):** this document consolidates the source,
> dependency, and construction-route research performed on 2026-07-26. Its
> “current status” and “open problems” sections are dated snapshots, not the
> controlling implementation state. For the accepted maximum-compatible
> boundary and immutable proof result, read records 0021–0027, the QA-L4
> packet, and the theory delivery. The six source logs listed below were
> removed after their durable content was merged here.

**Merged scope:** retired research logs 0007, 0009–0012, and 0014 (dependency
audit, source-theorem scope, construction route, Open-π/common-FMS seam,
separated commutativity, and bottom/zero scope).

---

## Executive Summary

This document consolidates six FMS domain-theory research logs into a single comprehensive reference for the Cantilune formal semantics foundation. The research establishes:

1. **Source alignment:** The FMS construction is source-backed but requires local implementation; no complete external Lean dependency exists.
2. **Construction route:** The Abramsky powerdomain must be built via enriched free-algebra adjunction for a combined nondeterministic-computation theory.
3. **Semantic fork:** Separated divergence/deadlock constants cannot coexist with symmetric all-pairs pairing that is strict for both constants—an RFC decision is required.
4. **Current kernel status:** All-source ordinary solution set, enriched adjunction, and sequential Fubini are kernel-built; symmetric commutative Fubini for separated constants remains blocked by a fundamental incompatibility.

**Decision boundary:** RFC-0002 must choose between (1) unseparated commutative FMS, (2) separated ordered/noncommutative effects, or (3) support-separated tensor with new semantic theorems.

---

## 1. Source Alignment

### 1.1 Primary Sources (from 0009)

The semantic foundation draws from:

1. **Fiore, Moggi, and Sangiorgi** — [*A Fully Abstract Model for the π-calculus*, LICS 1996](https://person.dibris.unige.it/moggi-eugenio/ftp/lics96.pdf) and [journal version](https://person.dibris.unige.it/moggi-eugenio/ftp/ic00.pdf)
2. **Abramsky** — *A Domain Equation for Bisimulation*, Information and Computation 92(2), 1991
3. **Abramsky & Jung** — [*Domain Theory* handbook chapter](https://www.cs.ox.ac.uk/people/samson.abramsky/handbook.pdf)

### 1.2 Source-Backed Theorem Matrix (from 0009)

| Topic | Source Statement | Cantilune Interface | Current Status |
|-------|------------------|---------------------|----------------|
| Base category | `Cpo`: posets with omega-chain suprema, continuous maps; base objects may be unpointed | `ωCPO`, `ContinuousHom` | **Foundation exists** |
| Nondeterminism | `ND(Cpo)` objects carry least `⊥`, semilattice identity `0`, idempotent choice; arrows are strict semilattice homomorphisms | `NondeterministicComputation`, `CpoPowerdomainPackage` | Interface only |
| Powerdomain | Forgetful functor has `Cpo`-enriched left adjoint, inducing Abramsky's commutative powerdomain monad | `CpoPowerdomainPackage` with coherence records | **Ordinary adjunction kernel-built**; symmetric Fubini blocked |
| Functor worlds | Pointwise lift to `Cpo^I` | `FMSPointwiseCpoMonad` | Conditional on base powerdomain |
| Domain equation | `A = μX.P(HX)` initial solution | `AgentDomainSolution` | Interface only; no recursive solution |
| Allocation/restriction | Name allocation, action-defined restriction with coherence | `CoherentHiding`, `AdequateHiding` | Interface and fragments; no FMS inhabitant |
| Full abstraction | Denotational equality ⟺ strong late bisimilarity (Theorems 3.2, 3.3) | `StrongLateFullAbstraction` | Theorem fields only |

### 1.3 Source Scope Clarifications (from 0009)

**What FMS requires:**
- Initial solution `A = μX.P(HX)` using "standard recursive-domain equation techniques"
- Process-pair full abstraction: two processes are bisimilar ⟺ their denotations are equal
- Commutative monad laws for the powerdomain

**What FMS does NOT require (additional Cantilune conditions):**
- Explicit `⊥ ≠ 0` stated in source (Cantilune adds this)
- General "algebraic compactness" as a named theorem (construction method flexibility exists)
- All-domain-element definability (source proves process-pair equivalence, not exhaustive definability)
- Exact per-label native-step soundness/completeness (Cantilune strengthening)
- `PowerdomainObservation` inverse-image laws (Cantilune strengthening)

---

## 2. Dependency Landscape

### 2.1 Pinned Local Baseline (from 0007)

**Current foundation:**
- Lean: `leanprover/lean4:v4.32.0`
- mathlib: commit `81a5d257c8e410db227a6665ed08f64fea08e997` (v4.32.0)
- License: Apache-2.0

**Mathlib provides:**
- `OmegaCompletePartialOrder`, `ωScottContinuous`, `ContinuousHom`
- Category `ωCPO` with products, equalizers, ordinary limits
- Lawful fixed-point foundations

**Mathlib does NOT provide:**
- Abramsky/Plotkin/Hoare/Smyth powerdomains
- Egli–Milner order
- Domain-theoretic bilimits or algebraic compactness for general endofunctors
- FMS domain equation or pi-calculus full abstraction

### 2.2 External Candidate Assessment (from 0007)

| Candidate | Version | Declarations | Cantilune Status | FMS Coverage |
|-----------|---------|--------------|------------------|--------------|
| **Pinned mathlib** | Lean 4.32.0 | omega-CPOs, continuous maps, limits | **Already imported** | Foundation only |
| **iris-lean** | v4.32.0 | `COFE`, `COFESolver.Fix`, step-indexed equivalence | Version-compatible; import unverified | Different semantics (guarded/step-indexed, not FMS CPO) |
| **scott1972** | Lean 4.30.0 | Inverse limits, `theorem_4_4` for `D∞ ≅ [D∞ → D∞]` | Conditional source-port only | Useful for one inverse-limit construction; not general |
| **zilberstein/domain-theory** | Lean 4.31.0 | DCPO, Scott continuity, way-below/compactness | Conditional port | Basic DCPO only; no powerdomain |
| **jonsterling/lean4-sgdt** | Lean nightly 2021 | Guarded synthetic domain theory (axiomatic) | Not admissible | Wrong semantics, no license, axioms |

### 2.3 Dependency Decision (from 0007)

**No external FMS package found.** The minimum credible dependency remains pinned mathlib. Selected Scott inverse-limit proofs may be ported from `scott1972`, but this is source-port work, not an import that closes the FMS stack.

**iris-lean** has a genuine COFE fixed-point solver, but replacing FMS CPO semantics with guarded step-indexed OFE semantics requires RFC architectural change.

---

## 3. Construction Routes

### 3.1 Unseparated Omega-Scott Route (from 0010, 0014)

**Status:** Ordinary adjunction and sequential Fubini kernel-built; recursive domain fixed-point achieved.

#### 3.1.1 Completed Steps (from 0010 §2026-07-26 correction, 0014 §2026-07-27 refinement)

**A. NDωCPO Category — IMPLEMENTED**

`FMSCpoNondeterministicCategory` defines objects with:
- `carrier : ωCPO`
- `divergence : carrier` (least element)
- `deadlock : carrier`
- continuous `choice : carrier × carrier →𝒄 carrier`
- associativity, commutativity, idempotence, `deadlock` identity

Morphisms: continuous maps preserving all three constants.

`FMSCpoNondeterministicEnrichment` proves hom sets are omega-CPOs with jointly continuous composition.

`FMSCpoNondeterministicNullary` constructs the initial two-point algebra (free on empty generator).

**B. Completeness and Limit Preservation — IMPLEMENTED**

`FMSCpoNondeterministicLimits` constructs componentwise products and equalizers, derives `HasLimits.{0} NDωCPO`, and proves the carrier functor `U : NDωCPO ⥤ ωCPO` preserves limits.

**C. All-Source Solution Set — IMPLEMENTED (from 0012)**

`FMSCpoNondeterministicGlobalSolutionSet` proves genuine `SolutionSetCondition.{0}` for every source `X : ωCPO`, with:
- Generated omega-closed subalgebra factorization
- Well-founded syntax for cardinal bound
- Small presentation reindexing into fixed `Type 0`

This is no longer a caller premise or empty-source special case.

**D. Ordinary Adjunction and Monad — IMPLEMENTED**

From the solution set:
- `freeAdjunctionOfSolutionSet` constructs `F ⊣ U`
- `ordinaryMonadOfSolutionSet` derives monad on `ωCPO`
- `ordinaryFreeLift` provides free-extension universal property

**E. Sequential Fubini — IMPLEMENTED (from 0012)**

The canonical sequential Fubini map is:
- Jointly continuous
- Satisfies pure-unit law
- Preserves divergence, deadlock, choice in first argument
- **NOT symmetric** (see §3.2)

**F. Recursive Domain Fixed Point — IMPLEMENTED (from 0010 §2026-07-27)**

`FMSCpoConcreteBilimitExhaustivity` proves:
- Monotonicity of finite-stage approximants
- Pointwise omega-exhaustion of identity
- Unfold monotonicity

This unconditionally inhabits `ConcreteBilimitExhaustivity` and constructs `concreteActualFixedPointWitness`: a continuous natural isomorphism `A ≅ P(H A)` for the **unseparated omega-Scott** functor.

**This is a fixed point, not initial algebra/terminal coalgebra or algebraic compactness.**

**G. Monadic Hiding — IMPLEMENTED (from 0010 §2026-07-27, 0014 §2026-07-27)**

The unseparated omega-Scott world monad now has `powerHiding` with:
- Allocation/hiding, unit, multiplication, chosen Fubini commute
- Effectful allocate/denote/hide retraction in support denotation

This is real monadic hiding coherence, but NOT agent restriction (no recursive agent, `AgentDomainSolution.res`, operational denotation, adequacy, definability, or full abstraction).

#### 3.1.2 Missing for Unseparated Route

- Algebraic compactness or initial/terminal universal properties
- Separated Abramsky powerdomain with distinguished `⊥ ≠ 0`
- Recursive agent with operational adequacy
- Process-scope definability
- Full abstraction

### 3.2 Separated Powerdomain Route — BLOCKED

**Status:** Fundamental incompatibility discovered.

#### 3.2.1 The Incompatibility (from 0012, 0014)

`no_commutative_first_strict_pairing` (general algebraic theorem) proves:

> If a pairing is:
> 1. Available on every pair
> 2. Symmetric
> 3. Strict at order bottom in first argument
> 4. Preserves semilattice zero in first argument
>
> Then bottom = zero.

The current Cantilune combination cannot be completed:
- `divergence_ne_empty` (kernel-proved separation)
- Strict preservation of both constants by free extension
- Canonical commutative Fubini

**Swap commutativity at `(divergence, deadlock)` would identify them, contradicting separation.**

#### 3.2.2 Source Reconciliation (from 0012, 0014)

The FMS source states:
- Commutative monad interchange law
- Absorbing law `let(f, 0) = 0`
- Arrows are strict semilattice homomorphisms
- **Source does NOT state `⊥ ≠ 0`** — this is Cantilune's additional condition

**Conclusion:** Local specification conflict, not FMS refutation. The ordinary free adjunction is valid; what fails is adding separation to canonical commutative sequencing.

#### 3.2.3 Scope Refinement (from 0014)

`FMSCpoFiniteSupportStrictConstantsNoGo` proves the obstruction extends to supported omega-CPOs: empty-supported constants compose at separation unit support, and a continuous symmetric first-strict pairing collapses them.

**This is representation-independent** for the stated combination of compatibility, exchange, strictness, and distinctness.

### 3.3 Exact Construction Sequence (from 0010)

For any complete route:

**A.** Bundle algebra category — **DONE**  
**B.** Prove completeness and limit preservation — **DONE**  
**C.** Prove solution-set condition — **DONE**  
**D.** Apply general adjoint functor theorem — **DONE (ordinary)**  
**E.** Recover algebraic laws — **PARTIAL** (divergence ≠ deadlock from nullary initial object)  
**F.** Prove enriched commutativity — **BLOCKED** (symmetric Fubini fails for separated constants)  
**G.** Lift pointwise and solve domain equation — **PARTIAL** (unseparated fixed point exists; separated initial solution missing)

### 3.4 Rejected Shortcuts (from 0010)

- `WithBot (OmegaScottPower X)` — multiplication unit/order obstruction
- `WithBot (LowerSet X)` — principal return and strict flattening fail on general omega limits
- SFP `P₀` representation alone — useful restricted construction, not all-`ωCPO` adjunction
- Structure assuming left adjoint, fixed point, adequacy, or full abstraction as fields — acceptance boundary, not implementation
- `Classical.choice` of caller-supplied existence proof — missing theorem remains premise

### 3.5 Exit Criteria (from 0010)

Theory closure requires ALL kernel-checked:

1. Inhabited `NDωCPO` category and carrier functor — ✓ **kernel-built**
2. Completeness, limit preservation, all-source solution set — ✓ **kernel-built**
3. Ordinary and enriched left adjoint and monad — ✓ **kernel-built (ordinary)**
4. Inhabitant of every required base-powerdomain coherence record — ✗ **symmetric Fubini blocked**
5. Proof that divergence ≠ deadlock — ✓ **kernel-built (nullary initial)**
6. Pointwise lifting to nonconstant world model — ✓ **kernel-built (unseparated)**
7. No `sorry`, `admit`, `axiom`, or unrecorded import — ✓ **verified for completed parts**

---

## 4. Open Problems

### 4.1 Named Open-Pi SMC Totality (from 0011)

#### 4.1.1 Concrete-Name Representation No-Go

`OpenSMCTotalNamedBoundary` proves:
- `no_totalOccurrenceTensor_of_nonempty`: no total tensor can preserve all concrete port occurrences up to permutation and return valid `NamedInterface` when nonempty boundary exists (self-tensoring duplicates concrete names, violating `Nodup`)
- `no_totalExactNamePlug_of_nonempty`: exact-name `PlugCertificate` cannot be total at nonempty identities

**This is a representation no-go, not a category no-go.**

#### 4.1.2 What IS Kernel-Built (from 0011)

- `SortedFreshBoundarySupply.tensorObject_sorts`: with explicit fresh supply, total object-level tensor exists with expected sort shape
- `hideMany_native`, `plugHide_syncLeft_native`, etc.: genuine single native late-pi transitions preserved through finite restrictions
- Action-label alpha quotient: `OpenSMCActionAlpha` quotients input/bound-output labels by freshness-safe binder renaming with native transports

#### 4.1.3 Missing for Total Open-Pi SMC (from 0011)

A future construction must add:
1. Infinite fresh-name supply for every sort
2. Coherent sort-preserving public-boundary renaming
3. Polarized linear alias/wire processes for nonempty identities
4. Transport of raw processes, alpha classes, actions, transitions along public renaming
5. Composition and tensor independent of fresh representatives
6. Category, interchange, pentagon, triangle, hexagon laws in chosen quotient
7. Operational sufficiency/reflection for plug, hide, restriction, communication, bound-output

**This requires RFC/ADR decision per RFC-0002 stop conditions.**

### 4.2 Common-FMS Two-Row Cross-Epoch Chain (from 0011)

#### 4.2.1 What IS Proven

`FMSCommonTwoRowCrossEpochChain` constructs:
- Non-erasing two-row cross-epoch chain with four exact native FMS edges (two admissions, two rules)
- Exact denotational path: `admission₁ ; rule₁ ; admission₂ ; rule₂`
- Couples operational chain to event-labelled stochastic trajectory
- `canonical_marked_replay_positioned_fms_actions_almost_sure`: under `FourPositionFMSActionAgreement`, every mark in canonical replay identified with FMS action at same position

#### 4.2.2 What IS Required (from 0011)

The theorem deliberately requires:
- Concrete `ExactFMSAcceptancePackage`
- Both complete product rows
- Equality of adjacent operational source endpoints
- Equality of denotational endpoints
- Explicit positional action interpretation for event/action identity

**None derived from package names or proof irrelevance.**

#### 4.2.3 What IS NOT Constructed (from 0011)

- All-omega-CPO powerdomain
- Recursive FMS domain
- Eight production-package certificates
- `TrajectoryAgreement` for production kernels
- Real rule inventory, rank, pre-net, authorization, fairness, stable-window, positive-epsilon facts

### 4.3 Recursive Agent Alpha Substitution (from 0010 §2026-07-27)

`LateGuardedReplicationAlphaSubstitutionCongruence` proves:
- Common-fresh normalization for `recv`, `new`, `repRecv`
- Combined depth/alpha induction
- Unconditionally inhabits `RecursiveAlpha.SubstitutionCongruent`
- Every recursive native-step constructor permutation-equivariant up to alpha-related target

**This is genuine one-step alpha congruence, but NOT:**
- Recursive agent domain solution
- Operational adequacy
- Full abstraction

### 4.4 Operational Divergence vs. Deadlock (from 0014)

`LateGuardedReplicationDivergence` separately proves:
- Replicated tau has genuine infinite native run
- Raw zero is deadlocked

**This operational distinction does NOT prove these processes denote the two distinguished constants of the powerdomain.** That denotational mapping requires the missing recursive agent, hiding, and adequacy.

---

## 5. Decision Points for RFC

### 5.1 Core Semantic Fork (from 0012, 0014)

RFC-0002 and ADR-0001 must select ONE coherent route:

#### Option 1: Unseparated Commutative FMS (Source-Aligned)
- Retain commutative powerdomain law
- Do NOT require effect-layer proof that `⊥ ≠ 0`
- Prove process-level distinction through recursive agent and source-pinned full-abstraction theorem
- **Status:** Ordinary adjunction and sequential operations kernel-built; lacks symmetric Fubini and separated constants

#### Option 2: Separated Ordered/Noncommutative Effects
- Retain separated constants `⊥ ≠ 0`
- Use ordered/noncommutative effect whose sequencing records evaluation order
- Accept that effect composition is not commutative
- **Status:** Requires new semantic theorems; current sequential Fubini is not symmetric

#### Option 3: Support-Separated Tensor
- Change algebra/morphism category
- Replace all-pairs cartesian pairing with support-separated tensor
- Prove new support-indexed semantic theorems
- **Status:** Experimental fragments exist (finite-support separation algebra, nominal allocation); no complete construction

**Critical:** Support-separated tensor is possible changed semantics, not automatic escape. If both constants have empty support, they're compatible, and the two-constant exchange argument still applies at that pair (proven in `FMSCpoFiniteSupportStrictConstantsNoGo`).

### 5.2 Open-Pi SMC Representation (from 0011)

RFC decision required for total Open-Pi SMC among:
1. Guarded replication/recursion (crosses RFC stop condition)
2. Separate wire semantics with proved operational quotient
3. Deliberately linear one-shot interface
4. Explicit fresh-supply + renaming transport (normative syntax change)

**Current status:** Alpha conversion closed; total tensor representation and full categorical coherence missing.

### 5.3 Dependency Admission Policy (from 0007)

If `scott1972` is used:
- Pin to exact audited commit `36bf01f99f00fcb78b999052212372ba026521ba`
- Either: port upstream to Lean/mathlib 4.32 with release, OR vendor with RFC decision
- Port acceptance test must: build in Cantilune, enumerate kernel assumptions, map theorems to FMS obligations, reproduce license/revision

**Stop conditions (from 0007):**
- Treating `ωCPO.HasLimits` as algebraic compactness
- Treating `scott1972.theorem_4_4` as solution of `A ≅ P(H A)`
- Treating `iris-lean` OFE equivalence as continuous natural isomorphism in `Cpo^I`
- Calling finite powerset on discrete CPOs the Abramsky powerdomain
- Declaring full abstraction from fold/unfold, soundness, or finite fragment alone

### 5.4 FMS Calculus Scope (from 0009)

FMS source includes guarded replication `!α.P`. Cantilune's finite-control `Raw.Proc` deliberately excludes replication/recursion.

**Decision required:**
- Current finite-control theorem is valid fragment, NOT implementation of arbitrary-process FMS Theorem 3.3
- Adding full FMS replication/recursion crosses RFC stop condition
- Requires explicit scope decision, not hidden proof assumption

---

## 6. Current Kernel Status Summary

### 6.1 What IS Kernel-Built

**Foundation (from 0007, 0010):**
- `ωCPO` category with products, equalizers, limits from mathlib
- `NDωCPO` nondeterministic-computation category
- Componentwise limits and preservation
- Enriched hom-object omega-CPOs with jointly continuous composition
- Nullary initial two-point algebra

**Free Construction (from 0010, 0012):**
- All-source `SolutionSetCondition.{0}` with genuine small presentations
- Ordinary free/forgetful adjunction `F ⊣ U`
- Induced monad with unit, multiplication, universal `freeLift`
- Enriched hom equivalence with continuity and naturality
- Canonical sequential Fubini (continuous, pure-unit coherent, first-argument strict)

**Recursive Domain (from 0010 §2026-07-27):**
- Concrete bilimit exhaustivity for unseparated omega-Scott functor
- Continuous natural isomorphism `A ≅ P(H A)` (fixed point, not initial algebra)
- Monadic `powerHiding` with allocation, unit, multiplication, chosen Fubini coherence
- Effectful allocate/denote/hide retraction in support model

**Alpha and Substitution (from 0010 §2026-07-27):**
- Action-label alpha quotient with native transports
- Recursive alpha substitution congruence for `recv`, `new`, `repRecv`
- Combined depth/alpha induction
- `RecursiveAlpha.SubstitutionCongruent` inhabited

**Open-Pi Fragments (from 0011):**
- Concrete-name representation no-go theorems
- Object-level tensor with explicit fresh supply
- Native transitions preserved through finite hiding
- Plug/hide sync/close native lemmas

**Cross-Epoch Composition (from 0011):**
- Two-row common-FMS cross-epoch chain (conditional on supplied package and rows)
- Four-event exact native path with denotational seam
- Canonical marked replay with positioned action agreement

### 6.2 What IS Missing

**Base Powerdomain:**
- Symmetric commutative Fubini for separated constants (blocked by incompatibility)
- Complete `CpoPowerdomainPackage` with all coherence records
- Separated Abramsky construction with `⊥ ≠ 0`

**Recursive Domain:**
- Initial algebra / terminal coalgebra universal properties
- Algebraic compactness for general locally continuous endofunctors
- Recursive agent with operational semantics

**Operational Semantics:**
- Agent-level restriction (`AgentDomainSolution.res`)
- Operational denotation for recursive agents
- Adequacy (syntax soundness/completeness)
- Process-scope definability
- Full abstraction (Theorems 3.2, 3.3)

**Open-Pi SMC:**
- Total tensor on morphisms with full categorical coherence
- Identity wires and structural quotient
- Operational plug/hide adequacy for total SMC

**Production Packages:**
- Real rule inventories for eight planned packages
- Rank, declaration-order pre-net
- Resource/session policy, authorization
- Fairness, stable-window, positive-epsilon facts

### 6.3 Governance Disposition

- RFC-0002: **Pre-FCP** (blocked by semantic fork)
- ADR-0001: **Proposed** (blocked by missing constructions)
- QA-L4 review: **Not recorded** (mutable-tree evidence only)
- Proof manifest: **`implemented_unverified`** or **`partial_scaffold`**
- Stop-Ship conditions: **None found**

**Do NOT promote CENTRAL-12, enter FCP, or accept ADR-0001 on current results.**

---

## 7. References

### 7.1 Primary Sources

1. Fiore, M., Moggi, E., & Sangiorgi, D. (1996). [A Fully-Abstract Model for the π-calculus](https://person.dibris.unige.it/moggi-eugenio/ftp/lics96.pdf). LICS 1996.
2. Fiore, M., Moggi, E., & Sangiorgi, D. (2002). A fully abstract model for the π-calculus. *Information and Computation*, 179(1). [Author manuscript](https://person.dibris.unige.it/moggi-eugenio/ftp/ic00.pdf).
3. Abramsky, S. (1991). A Domain Equation for Bisimulation. *Information and Computation*, 92(2). [Author PostScript](https://www.cs.ox.ac.uk/people/samson.abramsky/bisim.ps.gz).
4. Abramsky, S., & Jung, A. [Domain Theory](https://www.cs.ox.ac.uk/people/samson.abramsky/handbook.pdf). Handbook chapter.
5. Abramsky, S. [Domain Theory and the Logic of Observable Properties](https://www.cs.ox.ac.uk/people/samson.abramsky/thesis.pdf). PhD thesis, Chapter 5 §3.

### 7.2 External Candidates

- **mathlib4:** [commit 81a5d257](https://github.com/leanprover-community/mathlib4/tree/81a5d257c8e410db227a6665ed08f64fea08e997), [omega-CPO docs](https://leanprover-community.github.io/mathlib4_docs/Mathlib/Order/Category/OmegaCompletePartialOrder.html)
- **iris-lean:** [v4.32.0 release](https://github.com/leanprover-community/iris-lean/tree/v4.32.0), [COFESolver.lean](https://github.com/leanprover-community/iris-lean/blob/v4.32.0/Iris/Iris/Algebra/COFESolver.lean)
- **scott1972:** [commit 36bf01f9](https://github.com/catskillsresearch/scott1972/tree/36bf01f99f00fcb78b999052212372ba026521ba)
- **Reservoir:** [Lean package index](https://reservoir.lean-lang.org/packages)

### 7.3 Key Lean Modules

- `Cantilune.Pi.FMSCpoNondeterministicCategory`
- `Cantilune.Pi.FMSCpoNondeterministicLimits`
- `Cantilune.Pi.FMSCpoNondeterministicEnrichment`
- `Cantilune.Pi.FMSCpoNondeterministicNullary`
- `Cantilune.Pi.FMSCpoNondeterministicSolutionSet`
- `Cantilune.Pi.FMSCpoNondeterministicGlobalSolutionSet`
- `Cantilune.Pi.FMSCpoConcreteBilimitExhaustivity`
- `Cantilune.Pi.FMSCpoPowerdomainPackageCoherenceNoGo`
- `Cantilune.Pi.OpenSMCTotalNamedBoundary`
- `Cantilune.Pi.OpenSMCActionAlpha`
- `Cantilune.Theorems.FMSCommonTwoRowCrossEpochChain`

---

**End of Comprehensive Reference**
