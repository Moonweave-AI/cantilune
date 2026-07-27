# Separated effects, nominal delta, and recursive pi evidence

Date: 2026-07-26  
Status: implemented in a mutable worktree; unverified by independent QA-L4  
Governance: RFC-0002 Pre-FCP; ADR-0001 Proposed  
Risk / quality / maturity: S2 / QA-L4 / M1

## Question

Can the remaining FMS and named Open-pi gaps be closed by preserving
divergence/deadlock separation, adding nominal support, and extending the
finite-control late-pi kernel with guarded replication?

## Primary sources

- [Fiore–Moggi–Sangiorgi, LICS 1996](https://person.dibris.unige.it/moggi-eugenio/ftp/lics96.pdf):
  the model uses a commutative powerdomain monad lifted pointwise to the
  finite-world functor category, defines the recursive agent by
  `A = μX.P(HX)`, and states process-level universality/full-abstraction
  results for a calculus containing guarded replication.
- [Abramsky–Jung, Domain Theory](https://www.cs.ox.ac.uk/people/samson.abramsky/handbook.pdf):
  locally continuous functors and bilimits provide a standard fixed-point
  route, and continuous-domain powerdomains arise through free continuous
  domain algebras.

These sources do not directly prove Cantilune's additional requirements:
two observably distinct strict constants, one exact labelled target event
per source event, total named-boundary wire adequacy, or production-package
runtime facts.

## Kernel-built evidence

The following new modules are root-imported:

- `FMSFiniteSupportSeparation`: relational partial commutative composition
  exactly on disjoint finite support, a generic frame theorem, a concrete
  finite-set resource model, support-preserving maps, and separated tensor
  coherence equations.
- `FMSCpoFiniteSupportTensor`: a category of supported omega-CPOs with
  explicit support monotonicity and omega-sup boundedness, continuous
  support-exact morphisms, an omega-CPO of disjoint pairs, continuous tensor
  maps, natural braiding/associator/unitors, and pentagon/triangle/hexagon
  equations. It is not a powerdomain, monad, or recursive-domain solution.
- `FMSCpoFiniteSupportStrictConstantsNoGo`: the empty-support case is now
  checked at the continuous separated-tensor level. Two empty-supported
  constants are compatible, and any symmetric pairing that is first-strict
  for both and fixes the constants under exchange collapses them. This is a
  no-go for that strengthened combination only; it is not a no-go for the
  Abramsky construction.
- `NominalFiniteSupport`: functorial finite support over finite injections,
  fresh allocation, and proof that fresh representatives differ by a swap
  fixing the old image.
- `NominalCpo`: a nonconstant world-indexed omega-CPO support model with
  continuous renaming/permutation, allocation, and natural
  allocation/hiding retraction.
- `OpenSMCBoundaryRenamingCalculus`: identity, composition, unit,
  associativity, and support-congruence laws for the existing boundary
  metadata renamings; sequential freshening and avoidance-preserving refresh;
  and an exact no-go for a nonempty same-name atom wire under the current
  disjoint-support certificate. It does not rename processes or construct a
  native identity wire, category, or SMC.
- `LateIndependentExchange`: exact two-step native diamonds for disjoint
  action supports and a replay quotient generated only by explicitly
  witnessed native commuting squares. Same-channel synchronization is explicitly
  dependent and remains native tau.
- `FMSCpoOmegaScottDeltaCoherence`: shift/power isomorphism and unit,
  multiplication-component, allocation, and pointwise-Fubini delta
  equations for the actual unseparated omega-Scott world monad.
- `FMSCpoOmegaScottChosenCoherence`: the actual unseparated all-omega-CPO
  monad has the complete chosen-product Fubini matrix: naturality, principal
  unit, braiding, associativity, multiplication, both unitors, and both
  strengths. This closes Fubini/multiplication coherence for that monad; it
  does not add distinct divergence/deadlock or the free pointed-semilattice
  universal property required by the stronger local acceptance package.
- `FMSCpoNondeterministicSequentialCoherence`: for the all-source enriched
  free/forgetful adjunction, the canonical left-to-right Fubini map now has
  kernel proofs of two-variable naturality, both unitors, reassociation,
  left multiplication, and the pure-left instance of right multiplication.
  Its symmetry remains kernel-refuted, and no arbitrary two-effect
  interchange law is claimed.
- `LateGuardedReplication`: a separate `RecursiveProc` syntax with
  single-prefix guarded replication, a deterministic alpha-freshening
  substitution algorithm proved compatible on embedded old terms, exact
  preservation/reflection of native transitions on the old image, and a
  no-capture-risk theorem for globally fresh replacements (including
  replicated input). It also constructs native
  replication/open/close/synchronization rules and runs of every finite
  length.
- `LateGuardedReplicationSubstitution`: an exact free-name formula for
  capture-avoiding substitution, the replicated-input conflict equation,
  self-substitution, support-level composition, and process-level
  composition under explicit whole-syntax freshness. Kernel counterexamples
  rule out both an unconditional syntactic no-op theorem and unrestricted
  substitution composition. Strict permutation equivariance of the
  deterministic fresh-name choice remains false; the remaining operational
  statement must be formulated up to alpha.
- `LateGuardedReplicationDivergence`: a genuine Nat-indexed infinite strong
  native tau run, operational deadlock as absence of every native step, and
  a proof that zero deadlock and replicated-tau divergence are disjoint.
  This is operational, not a powerdomain denotation or full abstraction.
- `LateGuardedReplicationAlpha`: generated alpha equivalence for all
  constructors and the `recv`/`new`/`repRecv` binders, a quotient, finite
  permutation of processes/actions, and exact native equivariance for every
  non-communication constructor. A concrete swap counterexample proves that
  numeric deterministic freshening is not literally equivariant.
- `LateGuardedReplicationAlphaOperational`: an action-and-derivative alpha
  quotient, existentially saturated strong native step, admissible general
  bound-output labels, strict equivariance when no freshening occurs, and
  derivative-alpha/target-alpha bridges for embedded, sync, and close. This
  closes the operational quotient route without pretending that the numeric
  fresh chooser is literally equivariant.
- `LateGuardedReplicationAlphaFreshChoice`: a common-fresh-name construction
  and fuel induction prove arbitrary-fuel and total executable
  capture-avoiding substitution are permutation-equivariant up to
  `RecursiveAlpha`, including every numeric freshening branch of
  `recv`/`new`/`repRecv`. Full sync/close `NativeStep` congruence additionally
  requires substitution to respect alpha-related source bodies.
- `FMSCpoEmbeddingProjectionBilimit`: continuous embedding-projection pairs,
  their concrete singleton-seeded iteration under the actual agent
  endofunctor, coherent-thread inverse limits in omega-CPO and the world
  model category, jointly monic projections, and the canonical continuous
  fold `F L -> L`. It proves that preservation of the shifted projection
  cone, existence of a continuous two-sided inverse, and `IsIso` for this
  fold are equivalent; any such preservation witness constructs an
  `ActualFixedPointWitness`. The preservation witness itself is not derived
  from the current hom-omega-sup local-continuity record.
- `FMSProductionKernelTrajectoryAgreement`: a common strict FMS seam over
  two caller-supplied genuine Ionescu--Tulcea production kernels. Under an
  exact coupling and supplied operational/FMS equivalences, it proves
  almost-sure native events, exact DPO replay, epoch/signature alignment,
  common actions, literal consecutive denotational endpoints, and equal
  denotations of related states. It constructs neither kernel nor the still
  uninhabited exact FMS package.

The integrated root build completed successfully. This evidence remains a
mutable-tree result and has not been promoted to `proved` or `reviewed`.

## Exact negative boundary

The theorem `no_commutative_first_strict_pairing` is carrier-independent.
If an all-pairs pairing is symmetric and maps each of two distinguished
first-argument constants strictly, symmetry forces those constants to be
equal. It therefore refutes the combined target:

```text
distinct divergence/deadlock
  + all-pairs symmetric pairing
  + strictness for both constants.
```

It does not refute an unseparated FMS powerdomain. A support-separated tensor
changes the quantification of exchange, but it is not automatically exempt:
if both distinguished constants carry empty support, they are compatible and
the same two-constant argument still applies at that pair. Avoiding the
contradiction requires an explicit support/strictness/algebra change, not
only replacing a total product by a partial one.

## Remaining load-bearing obligations

1. Bundle the support-separated construction at the required enriched
   omega-CPO categorical level and prove the relevant free adjunction and
   monad laws, or obtain an FCP decision selecting another effect route.
2. Prove that the concrete agent functor preserves the constructed shifted
   projection limit. Lean now proves this is exactly equivalent to a
   continuous inverse of `concreteIterationFold` and constructs the actual
   natural fixed-point witness from it; local continuity of hom omega-suprema
   alone does not supply the preservation theorem.
3. Define the FMS agent hiding operation and prove allocation, strength,
   substitution, scope, and recursive coherence.
4. Prove operational adequacy, the precisely quantified process-scope
   definability theorem (if retained), and source-pinned full abstraction.
5. Change the public named-boundary representation, then construct wire
   identities and prove total plug/hide/restriction SMC and native
   operational adequacy. The metadata renaming calculus is available, but
   positional-vs-concrete names, polarity/linear usage, identity-wire
   semantics, fresh environment, process/action renaming, quotient equality,
   and exact operational observation remain RFC/FCP choices.
6. Instantiate the now-kernel-built genuine two-kernel trajectory theorem
   with the actual production kernels, their coupling, common exact FMS
   package, event/action seam, and product-owned progress facts. The generic
   theorem no longer uses canonical deterministic replay, but no production
   inhabitant exists.
7. Obtain, from each of the eight package owners, the real rule inventory,
   DAG/Petri/morphism/pi admission, rank, resource/session, authorization,
   fairness, stable-window, and positive-epsilon facts. The repository audit
   confirms these inputs do not exist.

## Conclusion

The new work closes concrete support, nominal allocation, delta coherence,
sequential-Fubini coherence within its noncommutative boundary, independent
exchange, exact guarded-replication support/substitution laws, a strong
action-and-derivative alpha quotient, the projection-limit half of the
recursive-domain construction, and the generic real-kernel/common-FMS
trajectory theorem. It does not yet construct the inverse of the recursive
fold, the complete FMS model, a total named Open-pi category, actual
production kernels/couplings, or product instances. RFC/FCP and
package-owner facts remain necessary; no completion claim is justified.
