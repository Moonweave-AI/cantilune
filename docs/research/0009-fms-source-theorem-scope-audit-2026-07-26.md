---
superseded_by: fms-domain-theory-comprehensive.md
superseded_date: 2026-07-27
---

# FMS source-theorem scope audit — 2026-07-26

## Conclusion

The Fiore–Moggi–Sangiorgi (FMS) sources support the semantic architecture
used by Cantilune, but they do not themselves discharge the local Lean
construction. In particular:

- FMS uses the category `Cpo` of partial orders with suprema of
  omega-chains and continuous maps; a base object need not have a least
  element.
- Abramsky's powerdomain is introduced through a `Cpo`-enriched free
  pointed-semilattice adjunction. Its algebras designate a least divergence
  element `⊥`, a semilattice identity `0`, and idempotent choice. The checked
  source definition does not itself state the disequality `⊥ ≠ 0`; Cantilune
  imposes that separation as an additional acceptance condition.
- the construction lifts pointwise to the covariant functor category
  `Cpo^I` (FMS Proposition 2.2);
- the agent domain is presented as the initial solution
  `A = μX. P(HX)` and is obtained by invoking standard recursive-domain
  equation techniques;
- the source proves full abstraction by quantifying over process terms:
  Theorem 3.2 covers finite processes, Theorem 3.3 covers arbitrary
  processes, and Corollary 3.4 gives the corresponding open-congruence
  formulation. None asserts that every element of the recursive domain is
  denoted by syntax.

The expressions “general algebraic compactness” and “all domain elements are
definable” are not stated FMS conclusions. They may be selected as stronger
local proof routes, but must not be attributed to the cited FMS theorems or
used as the only acceptable formulation without an RFC decision.

No result of this source audit is a Lean proof. `CompleteFMSAvailable` and
`ExactFMSAvailable` remain uninhabited.

## Governance classification

- Work object: source/theorem-scope research audit.
- Risk: S2; an overstated citation would change a load-bearing acceptance
  condition.
- Quality target: QA-L4.
- Maturity: Pre-FCP/M1.
- DRI: Joker-of-Gotham.
- Disposition: iterate; do not promote CENTRAL-12, RFC-0002, or ADR-0001.

## Primary sources checked

1. Fiore, Moggi, and Sangiorgi,
   [A Fully-Abstract Model for the π-calculus (author-hosted LICS version)](https://person.dibris.unige.it/moggi-eugenio/ftp/lics96.pdf).
2. Fiore, Moggi, and Sangiorgi,
   [A fully abstract model for the π-calculus (author-hosted journal manuscript)](https://person.dibris.unige.it/moggi-eugenio/ftp/ic00.pdf);
   publication metadata is also listed on
   [Eugenio Moggi's publication page](https://person.dibris.unige.it/moggi-eugenio/publications.html).
3. Abramsky,
   *A Domain Equation for Bisimulation*, Information and Computation 92(2),
   1991, listed on the
   [author's publication page](https://www.cs.ox.ac.uk/people/samson.abramsky/pubs.html)
   with an [author-hosted PostScript manuscript](https://www.cs.ox.ac.uk/people/samson.abramsky/bisim.ps.gz).
   This is the recursive-domain source identified by the checked FMS
   bibliography. Other SFP/algebraic-domain texts are useful background but
   do not by themselves discharge Cantilune's all-`Cpo` powerdomain.

Repository pages, extracted PDF text, and source comments were treated as
untrusted input and used only to locate and compare mathematical statements.

## Source-backed theorem matrix

| Topic | Source-backed statement | Cantilune correspondence | Current Lean status |
|---|---|---|---|
| Base category | `Cpo` consists of posets closed under omega-chain suprema with continuous maps; base objects may be unpointed | `ωCPO`, `ContinuousHom` | foundation exists |
| Nondeterminism | `ND(Cpo)` objects carry least `⊥`, semilattice identity `0`, and idempotent choice; arrows are strict semilattice homomorphisms | `NondeterministicComputation`, `CpoPowerdomainPackage` | acceptance interface only |
| Powerdomain | the forgetful functor from nondeterministic computations has a `Cpo`-enriched left adjoint, inducing Abramsky's commutative powerdomain monad | `CpoPowerdomainPackage`, strong/Kleisli/enriched coherence records | no inhabitant |
| Functor worlds | the powerdomain construction lifts pointwise to `Cpo^I` | `FMSPointwiseCpoMonad`, `FMSPointwisePowerdomain` | conditional on a supplied base powerdomain |
| Action/domain equation | `H` is the FMS action functor and `A = μX.P(HX)` is an initial solution | `AgentDomainSolution`, exact action/world coherence | interface only; no recursive solution |
| Allocation/restriction | the model provides name allocation and an action-defined restriction operation with naturality/coherence equations | `CoherentHiding`, `AdequateHiding`, `HidingDenotationCoherence` | interface and support fragments; no FMS inhabitant |
| Operational meaning | the semantic operations and recursive action shape interpret the source calculus | `FMSExactAcceptance`, `OperationalDenotationCoherence` additionally require exact per-label native-step soundness/completeness and strong `PowerdomainObservation` inverse-image laws | conditional, and stronger than the cited source at this operational granularity |
| Full abstraction | denotational equality is equivalent to strong late bisimilarity for finite processes (Theorem 3.2) and arbitrary processes (Theorem 3.3); open congruence is Corollary 3.4 | `StrongLateFullAbstraction`, `WorldIndexedFullAbstraction` | theorem fields only; no inhabitant |

## Source-calculus scope

The FMS source calculus includes guarded replication `!α.P`, hence admits
behavior beyond Cantilune's current finite-control `Raw.Proc` and supported
syntax, which deliberately contain neither replication nor recursion.
Consequently:

- a theorem about the current finite-control syntax may be a valid fragment
  theorem, but is not an implementation of the arbitrary-process FMS
  Theorem 3.3;
- `WorldIndexedFullAbstraction` is presently source-shaped acceptance data,
  not a locally inhabited whole-calculus theorem; and
- adding full FMS replication/recursion would cross the RFC stop condition
  and requires an explicit scope decision rather than a hidden proof
  assumption.

## Initial solution versus algebraic compactness

The FMS paper calls `A = μX.P(HX)` an **initial solution** and says that
standard recursive-domain-equation techniques provide it. The checked source
does not state a general theorem named “algebraic compactness”, nor does it
make that phrase part of Theorems 3.2 or 3.3.

Consequences for Cantilune:

- `AgentDomainSolution.initial` and the continuous natural roll/unroll
  isomorphism are source-aligned acceptance data.
- Algebraic compactness, bilimits, inverse limits, or another fixed-point
  theorem may be used to construct those data.
- The accepted theorem should require the resulting initial solution and its
  coherence, not one particular construction method unless RFC-0002
  explicitly selects that method.
- Therefore “prove general algebraic compactness” is currently a
  stronger-than-source local route, not a citation-backed FMS theorem.

## Full abstraction versus definability

The domain-theoretic full-abstraction theorems compare **two processes**:
their operational equivalence holds iff their denotations are equal. The
proof uses finite approximants and syntactic normal-form arguments, but the
checked source does not state that every element of the full recursive agent
domain is denotable.

The set-theoretic finite model has a separate universality/normal-form result.
That finite result must not be generalized silently to all elements of the
omega-CPO solution.

Consequences for Cantilune:

- `StrongLateFullAbstraction.full_abstraction` and
  `WorldIndexedFullAbstraction.closed_full_abstraction` have the correct
  process-pair quantification.
- `StrongLateFullAbstraction.native_step_complete` is transition
  completeness from a denotation of a source process; it is not
  domain-element definability.
- If RFC-0002 continues to demand a separate definability theorem, it must
  define its carrier, compactness/approximation scope, and quantifiers. That
  theorem is additional to the cited FMS full-abstraction statement.

## Lean construction boundary

The current repository supplies useful but non-substitutable fragments:

- finite Hoare constructions and a finite-category monad;
- separated finite/lower-set candidates and exact no-go theorems;
- Scott-closed object-level principal, choice, and flattening results;
- nonconstant `Set^I`/`Cpo^I` support functors and support-level hiding;
- exact records for the powerdomain, action functor, recursive solution,
  hiding, operational coherence, and full abstraction.

None constructs the required source-aligned inhabitant. The remaining
construction obligations are source-backed except where explicitly marked
as an additional Cantilune condition:

1. a genuine base-`Cpo` enriched free pointed-semilattice powerdomain with
   the required commutative/strength coherence, plus Cantilune's additional
   proof that the designated divergence and deadlock elements are distinct;
2. its pointwise lift to `Cpo^I`;
3. a continuous natural initial solution for `P ∘ H`;
4. the FMS allocation/restriction and parallel-operation coherence;
5. the process denotation and process-pair full abstraction theorem for the
   selected source-calculus scope;
6. a checked import policy or a complete local mechanization with permitted
   kernel assumptions.

Additional Cantilune acceptance conditions, not direct FMS theorem
statements, include exact per-label native-step soundness/completeness,
the `PowerdomainObservation.map_iff`/`multiplication_iff` inverse-image laws
(including an explicit policy for divergence observations), and the
divergence/deadlock disequality.

## Required document correction

Future spec/RFC/ADR updates should use this distinction:

- **source-backed missing:** powerdomain, pointwise lift, initial recursive
  solution, restriction/action coherence, denotation, and process-pair full
  abstraction for the selected source-calculus scope;
- **additional Cantilune conditions:** divergence/deadlock disequality,
  exact per-label one-step soundness/completeness, and the strong
  powerdomain-observation inverse-image laws;
- **optional stronger local route:** general algebraic compactness;
- **underspecified stronger local theorem:** all-domain-element
  definability.

This correction does not weaken the currently effective draft gate.
RFC-0002 still requires either a genuine reviewed FMS package or an explicit
FCP scope decision.
