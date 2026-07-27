---
superseded_by: fms-domain-theory-comprehensive.md
superseded_date: 2026-07-27
---

# Abramsky powerdomain construction route — 2026-07-26

## Conclusion

The remaining all-`ωCPO` construction must be approached through the
free-algebra adjunction for one *combined* nondeterministic-computation
theory. It cannot be obtained by adding `WithBot` to the current lower/Hoare
power object, and the concrete SFP Plotkin-powerdomain representation is not
by itself an all-`ωCPO` construction.

The load-bearing categorical object has:

- an order-theoretic least element `⊥` for divergence;
- a separate semilattice identity `0` for deadlock; and
- a continuous associative, commutative, idempotent binary choice.

Morphisms are continuous homomorphisms preserving all three operations. The
required powerdomain is the monad induced by a `Cpo`-enriched left adjoint to
the carrier/forgetful functor. An ordinary unverified `IsRightAdjoint`
parameter would only rename the missing theorem and is not an acceptable
construction.

Disposition: **iterate**. This record fixes the construction route; it is not
a Lean proof and does not inhabit `CpoPowerdomainPackage`.

> **Supersession note (2026-07-26):** the status statements below that call
> Step C, the all-source solution set, or the enriched adjunction “missing”
> are historical checkpoints. They are superseded by the final correction
> section of this record. The all-source condition and enriched adjunction
> are now mutable-tree kernel constructions; the separated commutative
> Fubini package, recursive domain, and semantic theorems remain missing.

## Current kernel checkpoint

Route steps A/B and the following auxiliary categorical checkpoints are now
implemented in Lean:

- `Cantilune.Pi.FMSCpoNondeterministicCategory` defines the actual
  `NDωCPO` category, its faithful carrier functor, and proves that any
  *already supplied* `CpoPowerdomainPackage` induces the expected ordinary
  free/forgetful hom equivalence and adjunction.  This latter theorem is a
  validation of the package interface, not a construction of that package.
- `Cantilune.Pi.FMSCpoNondeterministicLimits` constructs arbitrary small
  products and equalizers componentwise, derives `HasLimits.{0} NDωCPO`,
  and proves that the carrier functor preserves those products, equalizers,
  and hence all small limits at the implemented universe level.
- `Cantilune.Pi.FMSCpoNondeterministicEnrichment` constructs the pointwise
  omega-CPO on each strict hom set and proves that categorical composition is
  jointly omega-continuous.  This supplies the hom-object side of the
  enriched category; it does not construct an enriched left adjoint.
- `Cantilune.Pi.FMSCpoNondeterministicNullary` constructs the free algebra on
  zero generators as ordered `Bool`, with `false` as divergence, `true` as
  deadlock, conjunction as choice, and a kernel-checked initiality proof.
  Thus divergence/deadlock separation is witnessed by a real algebra rather
  than postulated for every object.
- `Cantilune.Pi.FMSCpoNondeterministicSolutionSet` proves the exact AFT
  boundary

  ```text
  SolutionSetCondition U ↔ U.IsRightAdjoint
  ```

  and, from the left side, constructs the ordinary free functor, adjunction,
  monad, strict algebraic multiplication, and the complete free-extension
  universal property.  It also constructs the singleton local solution set
  for the empty omega-CPO and isolates `OrdinaryFubiniWitness` as a separate
  uninhabited input.
- `Cantilune.Pi.FMSCpoFiniteStrictFreeBoundary` proves that the tempting
  finite separated carrier does not extend this result.  For every nonempty
  finite equality source, its singleton structured arrow is not initial and
  there is no extension operation for all `NDωCPO` targets.  The ordered
  Boolean meet target gives the contradiction
  `deadlock < singleton a` but `true ≰ false`.  The empty source remains the
  one genuine local solution-set case.

Thus steps A and B, the hom-object enrichment, the nullary free case, and
the exact AFT reduction are kernel-built.  Step C—the genuine all-source
solution-set inhabitant—is now the first unclosed existence obligation.  The
nullary initial object does not provide free algebras on arbitrary `ωCPO`
sources, and the new finite no-go rules out extrapolating the raw strict
finite-powerset carrier to nonempty finite sources.  Even after a global
solution set, the commutative Fubini witness
and enriched/strong coherence remain separate.  None of the recursive-domain,
hiding, adequacy, definability, or full-abstraction conclusions follows from
the local empty-source result.

## Governance

- Work object: load-bearing formal-semantics research and implementation.
- Risk: S2; a wrong powerdomain changes divergence, deadlock, and the
  full-abstraction claim.
- Quality target: QA-L4.
- Maturity: Pre-FCP/M1.
- DRI: Joker-of-Gotham.
- Canonical decision artifacts: RFC-0002 and ADR-0001, both still pending
  acceptance.

No Stop-Ship condition was found. Repository and source text were treated as
untrusted data and used only as mathematical evidence.

## Primary-source findings

The author-hosted Fiore–Moggi–Sangiorgi LICS paper defines
`ND(D)` objects as `(D, ⊥, 0, ∪)`, with `⊥` the least element and
`(D, 0, ∪)` a semilattice; its arrows are strict semilattice homomorphisms.
It defines Abramsky's powerdomain monad as the `Cpo`-monad induced by the
corresponding enriched adjunction and states that it exists for `D = Cpo`.
It then lifts the construction pointwise to `Cpo^W` and uses the initial
solution of

```text
X = P(H X)
```

in `Cpo^I`.

Source:
[Fiore–Moggi–Sangiorgi, LICS 1996, §§2.1 and 3](https://person.dibris.unige.it/moggi-eugenio/ftp/lics96.pdf).

Abramsky and Jung give the general existence route for free dcpo-algebras:
the category of dcpo-algebras for a finitary inequational theory is complete,
the forgetful functor preserves limits, and a cardinality solution-set
argument permits the general adjoint functor theorem. They separately
describe free strict algebras and locally continuous free constructions.

Source:
[Abramsky–Jung, *Domain Theory*, §§6.1–6.2](https://www.cs.ox.ac.uk/people/samson.abramsky/handbook.pdf).

Abramsky's synchronization-tree construction gives a useful concrete
representation on SFP/algebraic domains. The Plotkin carrier uses
Lawson/convex closure and Egli–Milner order. Its empty-set extension
`P₀[D]` orders a computation below every other one exactly when it is
`{⊥}`; this separates divergent `{⊥}` from convergent empty deadlock.
That representation is source evidence for the intended distinction, but
its SFP assumptions do not establish the all-`ωCPO` adjunction required by
the current RFC.

Source:
[Abramsky, *Domain Theory and the Logic of Observable Properties*,
Chapter 5 §3](https://www.cs.ox.ac.uk/people/samson.abramsky/thesis.pdf).

## Exact Lean construction sequence

### A. Bundle the algebra category — implemented

Define a category `NDωCPO` whose objects contain:

1. `carrier : ωCPO`;
2. `divergence : carrier` and a proof it is least;
3. `deadlock : carrier`;
4. continuous `choice : carrier × carrier →𝒄 carrier`;
5. associativity, commutativity, idempotence, and `deadlock` identity.

A morphism must be a continuous map preserving `divergence`, `deadlock`, and
`choice`. Identity and composition laws must be extensional equalities of
the underlying continuous maps.

`FMSCpoNondeterministicCategory` implements this category.  It also derives
the ordinary free/forgetful adjunction from a supplied
`CpoPowerdomainPackage`; it does not use that conditional direction as an
existence proof.

`FMSCpoNondeterministicEnrichment` additionally proves that every hom set is
an omega-CPO under pointwise order and that composition is a jointly
continuous map

```text
(A ⟶ B) × (B ⟶ C) →𝒄 (A ⟶ C).
```

`FMSCpoNondeterministicNullary` constructs and proves initial the separated
two-point algebra.  This is the free object for the empty generator source,
not the missing general free functor.

### B. Prove completeness and limit preservation — implemented

Construct products and equalizers componentwise and prove their universal
properties. Derive all small limits for `NDωCPO` using products plus
equalizers. Define the carrier functor

```text
U : NDωCPO ⥤ ωCPO
```

and prove that it preserves the limits used by the general adjoint functor
theorem. Merely adding a field saying that these limits exist is not
sufficient.

`FMSCpoNondeterministicLimits` carries out these constructions and derives
both completeness and preservation from their universal properties.  The
implementation currently states the small-limit result at universe level
`HasLimits.{0}` / `PreservesLimitsOfSize.{0,0}`.

### C. Prove the solution-set condition

For each source `X : ωCPO`, prove that maps `X ⟶ U A` factor through a
generated subalgebra whose carrier has a cardinal bound depending only on
`X` and the finite signature. The closure must include:

- finite algebraic terms;
- all required omega-chain suprema; and
- repeated closure until both operations and omega suprema are stable.

The proof must produce an actual small family of representatives and a
factorization, in the exact shape of mathlib's
`CategoryTheory.SolutionSetCondition U`. A prose cardinality argument or a
caller-supplied solution set is not an inhabitant.

`FMSCpoNondeterministicSolutionSet` proves that this condition is exactly
equivalent to `U.IsRightAdjoint` under the already constructed completeness
and limit-preservation instances.  It also supplies a genuine singleton
solution set for `EmptyCpo`.  No theorem in the repository extends that
singleton construction to an arbitrary source `X`; the cardinal closure and
small representative family above remain the missing proof.

### D. Apply the general adjoint functor theorem

Mathlib already contains:

- all small limits for `ωCPO`;
- the general adjoint functor theorem; and
- construction of a monad from an adjunction.

After A–C, apply the theorem to construct an actual left adjoint `F ⊣ U`.
Derive the monad on `ωCPO`, its unit, multiplication, and universal
`freeLift` from this adjunction.

This implication is now kernel-built as
`freeAdjunctionOfSolutionSet`, `ordinaryMonadOfSolutionSet`, and
`ordinaryFreeLift`.  It remains conditional precisely because Step C has no
global inhabitant.

### E. Recover the required algebraic laws

Prove, rather than postulate:

- functorial preservation of divergence, deadlock, and choice;
- strictness of multiplication;
- preservation of deadlock and choice by multiplication;
- the full free-extension existence and uniqueness property;
- `divergence ≠ deadlock`.

The last property can be derived from freeness only after constructing a
concrete target nondeterministic computation whose two constants are
distinct and using preservation by the unique extension.

### F. Prove enrichment and commutativity

An ordinary categorical adjunction does not automatically discharge the
FMS enriched fields. Prove that:

- action on continuous hom-objects is omega-continuous;
- `generator ↦ freeLift(generator)` is omega-continuous;
- the tensor/Fubini map is continuous and natural;
- unit, symmetry, associativity, and multiplication/Fubini laws hold; and
- the remaining pure/effectful and deadlock/choice strength laws hold.

Only after these theorems may the construction inhabit
`CpoPowerdomainPackage`,
`CpoEnrichedPowerdomainCoherence`,
`StrongCommutativePowerdomainCoherence`, and
`KleisliPowerdomainCoherence`.

### G. Lift pointwise and solve the domain equation

Lift the constructed monad pointwise to `World ⥤ ωCPO`, combine it with the
already constructed exact locally continuous action functor `H`, and
construct an initial solution of `A ≅ P(H A)`.

The current finite approximation tower and
`ActualFixedPointWitness` interface alone do not construct this solution.
`FMSCpoEmbeddingProjectionBilimit` now builds the concrete EP iteration
tower, its coherent-thread projection limit in omega-CPO and the world-model
category, and the canonical continuous fold `F L -> L`. It also proves that
preservation of the shifted projection cone is equivalent both to an
explicit two-sided inverse and to `IsIso` for this fold. The next proof must
derive that preservation property (which is not a field of the current
hom-local-continuity record), then prove the required initial/terminal
universal properties.

## Rejected shortcuts

- `WithBot (OmegaScottPower X)`: contradicted by the checked multiplication
  unit/order obstruction.
- `WithBot (LowerSet X)`: principal return and strict flattening fail on
  general omega limits.
- The SFP `P₀` representation alone: it is a useful restricted construction,
  not an all-`ωCPO` adjunction.
- A structure whose fields assume the left adjoint, fixed point, adequacy, or
  full abstraction: this is an acceptance boundary, not an implementation.
- Treating `Classical.choice` of a caller-supplied existence proof as a local
  construction: the missing existence theorem would remain a premise.

## Exit criteria

This powerdomain stage closes only when all of the following are kernel
checked in the repository:

1. an inhabited `NDωCPO` category and carrier functor — **kernel-built**;
2. completeness, limit preservation, and a genuine all-source solution-set
   proof — **kernel-built**;
3. a constructed ordinary and enriched left adjoint and induced monad —
   **kernel-built**;
4. an inhabitant of every required base-powerdomain coherence record;
5. a proof that divergence and deadlock are distinct;
6. pointwise lifting to the actual nonconstant world model; and
7. no `sorry`, `admit`, `axiom`, or unrecorded theorem import.

## 2026-07-26 correction: all-source AFT and the remaining semantic fork

The earlier Step C/D status above is obsolete. The mutable tree now
constructs an all-source `SolutionSetCondition.{0}`, hence the ordinary free
functor, adjunction, monad, and free extension. It also constructs the
omega-CPO-enriched hom equivalence, including continuity and naturality of
free extension. These are real kernel constructions and no longer caller
premises.

What remains is not “find any Fubini map.” The canonical sequential map is
continuous and pure-unit coherent, with first-argument
divergence/deadlock/choice laws, but it is not symmetric. Associativity and
multiplication coherence for this separated candidate remain unconstructed
and cannot repair the failed symmetry. The general theorem
`no_commutative_first_strict_pairing` shows that an
all-pairs symmetric pairing which is strict for both distinguished
first-argument constants identifies divergence and deadlock. This theorem
is independent of carrier finiteness and therefore cannot be dismissed as
the earlier finite strict-powerset shortcut obstruction.

The source-aligned choices are now:

1. use an unseparated commutative powerdomain at the FMS layer;
2. retain separated constants and an ordered/noncommutative effect; or
3. replace all-pairs cartesian pairing by a support-separated tensor and
   prove a new support-indexed semantic theorem.

The repository has begun option 3 only as an experiment: it has a
finite-support separation algebra, separated tensor coherence, nominal
allocation up to finite permutation, and independent native action
diamonds. Separately, the concrete existing agent endofunctor now has an
EP iteration tower, pointwise/world-natural projection limit, jointly monic
finite observations, and canonical fold. It does not yet construct the
enriched separated powerdomain adjunction or the inverse/unfold proving that
fold is an isomorphism.

Consequently Step G and the semantic theorems remain open: there is no
actual continuous natural `A ≅ P(H A)`, complete agent hiding/coherence,
operational adequacy, process-scope definability, or full abstraction
package. The
[FMS paper](https://person.dibris.unige.it/moggi-eugenio/ftp/lics96.pdf)
provides the pointwise powerdomain/action/domain-equation semantic route and
process-level full-abstraction result; the
[Abramsky–Jung chapter](https://www.cs.ox.ac.uk/people/samson.abramsky/handbook.pdf)
provides the domain-theoretic fixed-point and powerdomain background. Neither
source makes Cantilune's additional separated-two-constant, exact-event, or
production-package acceptance obligations automatic.

## 2026-07-27 kernel convergence checkpoint

This checkpoint supersedes the earlier historical statements in this note
that the concrete bilimit or recursive substitution records had no
inhabitants.

First, `FMSCpoConcreteBilimitExhaustivity` now proves the three concrete
bilimit obligations rather than assuming them: monotonicity of the
finite-stage endomorphism approximants, pointwise omega-exhaustion of the
identity, and monotonicity of the unfold approximants. It unconditionally
inhabits `ConcreteBilimitExhaustivity` and constructs
`concreteActualFixedPointWitness`, a continuous natural isomorphism
`A ≅ P(H A)` for the actual **unseparated omega-Scott** functor. Local
continuity is not used as a substitute for the coordinate calculation. This
is nevertheless only a fixed point: it proves neither initial
algebra/terminal coalgebra nor algebraic compactness, and it is not an
Abramsky separated powerdomain construction.

Second, the actual unseparated omega-Scott world monad now has a general
`powerHiding` transformation. Allocation/hiding, unit, multiplication, and
chosen Fubini commute, and the concrete support denotation satisfies an
effectful allocate/denote/hide retraction. This is real monadic hiding
coherence, but it is not yet agent restriction: there is still no constructed
recursive agent, `AgentDomainSolution.res`, operational denotation,
adequacy, process-scope definability, or full-abstraction inhabitant.

Third, `LateGuardedReplicationAlphaSubstitutionCongruence` and its closure
module prove common-fresh normalization for `recv`, `new`, and `repRecv`
together with the combined depth/alpha induction. They unconditionally
inhabit `RecursiveAlpha.SubstitutionCongruent`. Every recursive native-step
constructor is therefore permutation-equivariant up to an alpha-related
target, including embedded communication, sync, close, open, restriction,
and replication, with a genuine one-step target rather than a tau-star.

Finally,
`FMSCpoPowerdomainPackageCoherenceNoGo.no_distinguishedFubiniStrictness`
proves a representation-independent obstruction: separated
divergence/deadlock, commutative Fubini, and first-input strictness at both
distinguished constants cannot coexist. This is not merely a finite
powerset counterexample. It also does not refute a genuine Abramsky
construction that omits that strengthened combination.

These results narrow the implementation frontier but do not meet the exit
criteria. CENTRAL-12 remains `partial_scaffold`: no source-compatible
separated Abramsky package, algebraic compactness, complete agent
restriction, adequacy, definability, or full abstraction has been
constructed. In addition, no product-owned rule inventory, production
kernel, coupling, rank, pre-net, authorization, fairness/stable-window, or
positive-epsilon fact exists for any of the eight planned packages.
