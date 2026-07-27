# Support-aware FMS and event-composition audit — 2026-07-27

Status: mutable-working-tree kernel evidence; not an immutable proof release  
Governance: S2 / QA-L4 / M1, RFC-0002 Pre-FCP, ADR-0001 Proposed  
DRI: Joker-of-Gotham

## Executive conclusion

This iteration closes several real support, nominal-allocation, and marked-event
obligations. It does **not** close the complete FMS, public named Open-pi, or
production-package obligations.

Three terminal blockers are different in kind and must not be conflated:

1. Cantilune's strengthened FMS acceptance laws contain a
   representation-independent inconsistent conjunction.
2. A total nonempty named-boundary Open-pi SMC requires a public boundary and
   wire representation decision reserved for RFC/FCP.
3. The two production kernels and the eight package-owned runtime fact sets do
   not exist in this repository.

Lean cannot construct an inhabitant of an inconsistent interface, choose a
public architecture on behalf of FCP, or derive missing product facts from
package names.

## Corrections to the incoming handoff

Several claims that major constructions were wholly absent are stale in the
current working tree:

- `Global.carrier_solutionSetCondition` is an all-source solution-set
  construction.
- The ordinary free/forgetful adjunction and monad and
  `cpoEnrichedFreeForgetAdjunction` are constructed.
- The actual unseparated omega-Scott monad has chosen-product commutative
  Fubini, strength, multiplication, and world-delta coherence.
- `concreteActualFixedPointWitness` is an actual continuous-natural
  `A ≅ P(H A)` witness for that unseparated functor.
- `powerHiding` and its unit, multiplication, allocation, and Fubini diagrams
  are constructed on that same unseparated line.
- A conditional theorem already relates two caller-supplied genuine
  Ionescu–Tulcea kernels while retaining native events, replay, epoch
  alignment, and one exact FMS package.

These facts do not imply algebraic compactness, a separated Abramsky
powerdomain, FMS Table-2 agent restriction, adequacy, definability, or full
abstraction.

## New kernel constructions

| Area | New construction | Exact boundary |
|---|---|---|
| Support-separated SMC | `FMSCpoFiniteSupportMonoidal` installs actual mathlib monoidal and symmetric instances, including pentagon, triangle, hexagon, and involutive braiding | This is `SupportedOmegaCpo Resource`, not yet a nominal `Cpo^I` or FMS agent category; its unscoped global instance is an RFC design risk if a cartesian instance is later required |
| Nominal allocation | `doubleSuccessorAlphaIso`, `doubleShiftAlphaIso`, and both allocation-exchange equations implement the last-two-fresh-name permutation | This is `δ/up/swap` reindexing coherence, not process alpha quotient, `new`, restriction, or agent hiding |
| Separated factorisation | `fubiniRaw_factors_through_separated_iff` proves lossless restriction exactly when every left/right outcome pair has disjoint support | It is computation-by-computation and does not construct a total natural separated Fubini map |
| Fixed finite resource support | `powerObject` and exact return/map/choice/multiplication support laws lift the lower omega-Scott construction | The union is finite because `[Fintype Resource]`; world-injection naturality and a supported monad are not yet constructed |
| Fubini support | `powerSupport_fubiniRaw` and `powerSupport_fubiniRaw_exact_iff` give the complete formula and exactness criterion | An empty lower/Hoare branch erases the other branch's support, so unrestricted Fubini is not a morphism in the current exact-support category |
| Allocation order | `allocation_alpha_exchange` and its inverse identify double allocation up to the finite-world swap | Literal fresh names are not equated |
| Marked residuals | derivative free names are bounded by source free names plus event support; two source-freshness premises derive both residual-freshness premises and the exact marked diamond | This is a conservative sufficient criterion, not a complete independence characterisation |

The residual regression suite now contains:

- a nonempty-bound-input example which genuinely transports source freshness
  to the residual;
- a proof that event-support disjointness alone cannot replace source
  freshness; and
- a different-channel/shared-payload example in which both exact native
  execution orders exist although the conservative support-disjoint
  certificate is unavailable.

## Representation-independent FMS obstruction

`no_distinguishedFubiniStrictness` uses no finite powerset representation.
For any candidate `CpoPowerdomainPackage`, assume:

1. divergence and deadlock are distinct;
2. Fubini is commutative;
3. Fubini absorbs divergence in its first computation argument; and
4. Fubini absorbs deadlock in its first computation argument.

Evaluate commutativity at `(divergence, deadlock)`. One side reduces to
deadlock by (4), the swapped side reduces to divergence by (3), and natural
preservation of divergence transports the latter across the product
braiding. Therefore deadlock equals divergence on a self-product, contradicting
(1).

The theorem rejects exactly this strengthened conjunction. It does not reject
an Abramsky construction which does not promise that conjunction.

## Primary-source boundary

Fiore–Moggi–Sangiorgi Section 2.1 assumes nondeterminism objects
`(D, bottom, 0, union)` and a commutative monad. It does not state
`bottom ≠ 0`, nor the two simultaneous first-input absorption laws used by the
strengthened Cantilune interface. Section 2.2 supplies the finite-injection
`up/swap/delta` structure. Section 2.3 states the agent equation
`A = μX.P(HX)`, and Section 3 states adequacy/full-abstraction results for the
completed FMS model.

Abramsky–Jung Chapter 6 gives the general domain-theoretic powerdomain
background. Its Plotkin construction and universal results do not identify
the current lower closed-set `OmegaScottPower` with the complete FMS
powerdomain automatically.

Consequently the remaining legitimate FMS task is still substantial:

- choose a source-compatible powerdomain law set;
- construct the pointwise/world-indexed functor and its continuous natural
  recursive solution with the required universal properties;
- construct FMS agent restriction rather than only monadic support hiding;
- define syntax denotation and prove adequacy, definability, and the
  source-pinned full-abstraction theorem.

The inconsistent strengthened law set must first be revised by RFC/FCP.

## Common-FMS chain boundary

The five-view `endpointAppend` operation correctly removes the duplicate
shared epoch and preserves dependent chain, replay, signature, and mark
evidence. `ExactFMSNativePath.append` also composes paths with a literally
shared denotational endpoint.

The older full-trace
`FiniteCommonFMSPathAgreement.endpointAppendWithPositions` is only
conditional. Both input action lists contain the shared epoch, while the
appended chain contains it once. If that epoch has events, the required
`List.Forall₂` position witness has incompatible lengths.
`no_full_concat_positions_of_shared_events` now proves this impossibility in
the kernel.

`ExactFMSSegmentPath` supplies the corresponding minimal representation
repair. It stores a nonempty list of exact native segments, exposes the
half-open prefix ending at the entry of the terminal segment, and defines
`endpointAppend` by discarding the left terminal segment and retaining the
right shared segment. Native endpoint continuity, full/prefix action
equations, and three-way action associativity are kernel-built.

This segmented path is not yet dependently indexed by a concrete
`EpochChain`. Therefore a general constructor relating each heterogeneous
epoch/admission segment to one common FMS path remains open; the old
full-trace theorem is no longer presented as that closure.

## Open-pi and production facts

The current exact-name boundary experiment rejects a reusable identity wire
on a nonempty boundary. A total named Open-pi SMC must choose public-name
occurrences, polarity/usage, freshening, wire identity, plug/hide semantics,
and the operational equality against which all coherence diagrams are
proved. That is a public semantic decision, not a consequence of alpha
conversion.

The repository audit also remains decisive:

- neither production Markov kernel nor their coupling is present;
- no exact FMS production package is inhabited; and
- none of the eight planned product packages has a package-owned rule
  inventory, rank, pre-net, resource/session policy, authorization predicate,
  fairness proof, stable window, or positive-epsilon progress fact.

The generic certificate and trajectory theorems consume such inputs; they
cannot manufacture them.

## Quality disposition

- The new targeted builds and aggregate root build succeeded in the mutable
  working tree.
- Audited declarations depend only on `propext`, `Classical.choice`, and
  `Quot.sound`.
- No project source contains a whole-word `sorry`, `admit`, `axiom`, or
  `unsafe`.
- Independent agent-level adversarial review found no scoped kernel
  correctness defect, but this is not an independent human QA-L4 signature.
- The proof manifest remains 11 `implemented_unverified`, 7
  `partial_scaffold`, 0 `proved`, and 0 `reviewed`.
- RFC-0002 remains Pre-FCP and ADR-0001 remains Proposed.

Disposition: **iterate on the consistent scoped constructions; do not promote
the terminal theorem**.

The exact mutable-tree hashes and command outcomes are recorded in
`formal/build-evidence/2026-07-27-support-separated-nominal-segmented-root.md`.

Primary references:

- [Fiore–Moggi–Sangiorgi, A fully abstract model for the pi-calculus](https://person.dibris.unige.it/moggi-eugenio/ftp/lics96.pdf)
- [Abramsky–Jung, Domain Theory](https://www.cs.ox.ac.uk/people/samson.abramsky/handbook.pdf)
