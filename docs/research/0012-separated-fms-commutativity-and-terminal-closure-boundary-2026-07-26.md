---
title: Separated FMS commutativity and terminal closure boundary
status: Implemented-unverified research record
date: 2026-07-26
risk: S2
superseded_by: fms-domain-theory-comprehensive.md
superseded_date: 2026-07-27
quality_target: QA-L4
maturity: Pre-FCP/M1
owner: Joker-of-Gotham
---

# Conclusion

The mutable Lean tree now closes the all-source ordinary
solution-set construction and the CPO-enriched free-extension layer.  It
also exposes a load-bearing incompatibility in the current Cantilune FMS
acceptance target:

> A separated divergence/deadlock pair cannot coexist with a symmetric
> pairing which is strict for both constants in its first computation
> argument.

The canonical sequential Fubini map derived from the enriched free
adjunction is jointly continuous and satisfies the pure-unit equation.  It
preserves divergence, deadlock, and choice in its first computation
argument.  Swap commutativity at `(divergence, deadlock)` would therefore
identify deadlock with divergence, contradicting their kernel-proved
separation.

This result does **not** refute the FMS/Abramsky construction when
divergence/deadlock separation is not required, or when a different
algebra-morphism/effect theory is selected.  It does prove that the present
Cantilune combination

1. `divergence_ne_empty`;
2. strict preservation of divergence and deadlock by free extension; and
3. canonical commutative Fubini

cannot be completed as stated.  Associativity or multiplication coherence
cannot repair a symmetry equation which is already contradictory.

Consequently this iteration cannot truthfully inhabit the current complete
FMS acceptance package or declare total theory closure.  RFC-0002 must choose
which premise changes before the recursive domain, hiding, adequacy, and
full-abstraction stages can have a consistent target.

# Kernel construction completed in this iteration

## All-source ordinary solution set

The construction is no longer a caller premise or an empty-source special
case:

- the generated omega-closed nondeterministic subalgebra is factored
  explicitly;
- a well-founded syntax gives the source-dependent cardinal bound;
- every generated carrier is reindexed into a support of one fixed
  `Type 0`;
- the supported omega-CPO, constants, choice, and generator are encoded as
  a small presentation; and
- these presentations inhabit mathlib's
  `SolutionSetCondition.{0}` for every source.

The main declarations are in:

- `FMSCpoNondeterministicGeneratedSubalgebra`;
- `FMSCpoNondeterministicGeneratedCardinality`;
- `FMSCpoNondeterministicBoundedRepresentatives`; and
- `FMSCpoNondeterministicGlobalSolutionSet`.

The targeted mutable-tree build completed successfully.  This is kernel
evidence, not immutable commit-bound QA-L4 evidence.

## Enriched adjunction and canonical Fubini

From the actual solution set, Lean constructs:

- continuity of free extension in the generator;
- continuity of functorial action on hom omega-CPOs;
- the enriched free/forgetful hom equivalence and its four naturality laws;
- a jointly continuous canonical sequential Fubini candidate;
- the pure-unit law; and
- strict divergence/deadlock/choice laws in the first argument.

`no_commutative_first_strict_pairing` is independent of the particular
implementation of the pairing: given separation, the two strict-constant
laws and swap commutativity imply `False`.

# Source-scope reconciliation

The author-hosted FMS extended abstract states the commutative-monad
interchange law for `let`, the absorbing law `let(f, 0) = 0`, and describes
`ND(Cpo)` arrows as strict semilattice homomorphisms.  The source definition
does not state `bottom != 0`; that disequality is an additional Cantilune
acceptance condition.

Primary sources:

- [Fiore--Moggi--Sangiorgi, *A Fully-Abstract Model for the
  pi-calculus*](https://person.dibris.unige.it/moggi-eugenio/ftp/lics96.pdf)
- [Abramsky--Jung, *Domain
  Theory*](https://www.cs.ox.ac.uk/people/samson.abramsky/handbook.pdf)

The correct conclusion is therefore a local specification conflict, not a
claim that the cited FMS theorem is false.  The ordinary all-source free
adjunction remains a valid construction.  What fails is adding the present
separation requirement to the canonical commutative sequencing laws.

# Required RFC/ADR decisions

RFC-0002 and ADR-0001 must select one coherent route:

1. align with the unseparated commutative FMS effect, dropping the additional
   divergence/deadlock disequality at this layer;
2. retain the separation but use an ordered/noncommutative effect whose
   sequencing records evaluation order; or
3. change the algebra objects/morphisms and re-prove the free construction,
   operational observations, and full-abstraction statement for that new
   theory.

No implementer may silently choose among these routes because each changes
the observable semantics.

# Named Open-pi boundary

`OpenSMCCanonicalPositional` supplies an experimental canonical
sort-by-position public-name representation, fresh realizations, and a
genuine algebraically presented symmetric monoidal category. Independent
review confirmed those algebraic equations but rejected an operational-plug
interpretation: `freshPlugProcess` restricts names deliberately disjoint from
both operands, never renames either endpoint onto the middle, and its sync
lemma does not require the communication channel to be a realized port.
There is also no well-defined quotient-Hom-to-raw-process realization or
identity/tensor/composition adequacy bridge.

The finite-control no-go is conditional as well. It proves that one fixed raw
process cannot satisfy the explicitly assumed arbitrarily-long-native-run
condition. It does not derive that condition from categorical identity and
does not exclude zero-step structural wires, generated/budget-indexed wires,
contextual wiring, or replication/recursion.

A total operational named Open-pi SMC therefore still needs both an endpoint
realization/adequacy construction and an RFC choice
among guarded replication/recursion, a separate wire semantics with a proved
operational quotient, or a deliberately linear one-shot interface.  Alpha
conversion alone is insufficient.

# Production probability and package boundary

The tree now includes two probability layers:

- a coupling theorem for two supplied finite native state kernels with total
  event labellings; and
- a sparse event-payload kernel whose genuine Ionescu--Tulcea path stores the
  entering event in each node, requires native/replay evidence only on
  positive event mass, and permits an unlabelled diagonal hold.

Both remain conditional on two caller-supplied kernels and an explicit
semantic coupling/seam.  Neither constructs any of the eight production
packages.

The package audit remains decisive: the repository contains no real rule
inventory, rank, declaration-order pre-net, resource/session policy,
authorization, fairness, stable-window, or positive-epsilon fact set for any
of the eight planned packages.  Those are runtime/product facts and cannot
be derived from a package name or a generic theorem.

# Governance disposition

- RFC-0002 remains Pre-FCP.
- ADR-0001 remains Proposed.
- No human QA-L4 review or acceptance signature is recorded.
- The proof manifest must remain `implemented_unverified` or
  `partial_scaffold` until an immutable commit and independent review exist.
- The current complete-theory goal is blocked by a real specification
  conflict, a pending named-boundary decision, and absent product inputs; it
  is not blocked by a missing tactic invocation.
