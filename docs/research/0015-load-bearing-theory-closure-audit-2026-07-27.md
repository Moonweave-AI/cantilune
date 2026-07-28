# Load-bearing theory closure audit — 2026-07-27

Status: mutable-tree kernel evidence; not an immutable proof release  
Governance: S2 / QA-L4 / M1, RFC-0002 Pre-FCP, ADR-0001 Proposed  
DRI: Joker-of-Gotham

## Executive result

This iteration materially extends the formal theory but does **not** establish
the requested terminal theorem. The remaining gap is not one undifferentiated
implementation task. It consists of:

1. exact mathematical inhabitants still absent from the Lean tree;
2. public semantic choices reserved for RFC/FCP; and
3. production facts and kernels absent from the repository.

No theorem, package name, or generic interface can manufacture items in
groups 2 or 3.

## Kernel construction matrix

| Requested layer | Kernel state | Exact evidence or boundary |
|---|---|---|
| All-source `SolutionSetCondition` | Constructed | `Global.carrier_solutionSetCondition` |
| Ordinary free/forgetful adjunction and monad | Constructed | `Global.freeAdjunction` and induced monad/free lift |
| CPO-enriched hom adjunction | Constructed | `cpoEnrichedFreeForgetAdjunction` |
| Complete commutative Fubini for the actual unseparated omega-Scott monad | Constructed | chosen-product naturality, unitors, associativity, braiding, multiplication, and strengths in `FMSCpoOmegaScottChosenCoherence` |
| Separated divergence/deadlock plus symmetric Fubini strict for both constants | Rejected for the strengthened law set | `no_distinguishedFubiniStrictness` is representation-independent and does not use finite powersets |
| Concrete EP tower and projection limit | Constructed | `FMSCpoEmbeddingProjectionBilimit` |
| Actual `A ≅ P(H A)` for the unseparated omega-Scott functor | Constructed | `concreteBilimitExhaustivity` and `concreteActualFixedPointWitness` |
| Monadic world hiding | Constructed for the unseparated monad | `powerHiding` and allocation/unit/μ/Fubini coherence |
| Agent restriction, adequacy, definability, full abstraction | Absent | requires recursive agent, restriction transformation, syntax denotation, and source-scoped operational equivalences |
| Recursive late-π substitution under arbitrary permutation | Constructed up to alpha | `substituteCaptureAvoiding_permute_alpha` |
| All-constructor recursive native-step permutation | Constructed unconditionally | `substitutionCongruent`, `native_permute_up_to_alpha_unconditional`, and quotient lifting |
| Total nonempty named-boundary operational Open-π SMC | Absent and decision-blocked | current certificate rejects the same-name nonempty wire; boundary/polarity/usage/wire/equality must be selected by RFC/FCP |
| Two genuine production-kernel common trajectories | Generic theorem only | `complete_common_fms_production_agreement_almost_sure` consumes real kernels, coupling, and an exact FMS package |
| Eight production package certificates | Inputs absent | the package audit finds no package trees, rule inventories, or runtime fact sets |

## Closed witnesses and exact remaining boundary

### Bilimit

`ConcreteBilimitExhaustivity` is now inhabited. The kernel construction
defines canonical finite-stage maps and proves:

- monotonicity of `pₙ ≫ eₙ`;
- pointwise equality of the identity with the omega supremum of those
  approximants; and
- monotonicity of the unfold approximants.

The coordinate bridge includes projection compatibility, diagonal identity,
successor-embedding compatibility, and
`εₙ ≫ πₖ = s n k`. EP deflation and eventual coordinate identity then yield
the two-sided continuous natural inverse and the unconditional fixed-point
witness.

This closes a fixed point for the **unseparated omega-Scott** functor only. It
does not prove that the fold algebra is initial, that the unfold coalgebra is
terminal, or that the surrounding category is algebraically compact.

### Recursive alpha/substitution

The executable fresh-name algorithm is permutation-equivariant up to
`RecursiveAlpha`. Common-fresh normalizers now cover `recv`, `new`, and
`repRecv`. An outer syntax-depth induction and inner alpha-derivation induction
construct `RecursiveAlpha.substitutionCongruent`. Substituting that witness
closes the all-constructor native-step and joint action/derivative quotient
permutation theorems without a condition and without a weak-step closure.

This removes the alpha/substitution residual. It does not select or construct
the public named-boundary representation, reusable identity wires, total
plug/hide, or the equality used by an operational Open-π SMC.

### Full FMS semantics

The actual unseparated monad and the separated free nondeterminism construction
remain different lines:

- the former has the complete commutative Fubini and monadic hiding diagrams
  and now an actual continuous-natural fixed point, but not separated
  constants/free pointed-semilattice acceptance, algebraic compactness, agent
  restriction, adequacy, definability, or full abstraction;
- the latter has the all-source free/enriched construction but its canonical
  sequential Fubini is not symmetric under the strengthened two-constant
  laws.

The new package-level theorem `no_distinguishedFubiniStrictness` is not a
finite-powerset shortcut result. For any proposed package, commutative Fubini,
first-input strictness for both divergence and deadlock, and natural
preservation of divergence collapse the two constants on a self-product,
contradicting the package's separation field. It does not refute an Abramsky
construction which does not promise this strengthened combination.

The cited FMS interface requires commutative monadic sequencing and strict
semilattice homomorphisms but does not state divergence/deadlock inequality.
Therefore the current strengthened acceptance target cannot be completed
unchanged. An RFC/FCP decision must remove or reinterpret at least one of
separation, commutativity, or the two strictness laws before a single recursive
agent, restriction/hiding, adequacy, definability, and full-abstraction package
can be constructed.

## Non-derivable external inputs

The repository does not contain either production Markov kernel, a coupling
between them, or an exact FMS acceptance package. It also does not contain
package-owned rules, rank functions, pre-nets, resource/session policies,
authorization predicates, fairness/stable windows, or positive-epsilon
progress evidence for the eight planned packages.

These are runtime/product facts, not mathematical consequences of the generic
certificate interface. Creating placeholder inhabitants would falsify the
theorem scope and is prohibited.

## Governance disposition

- Proof manifest: no `proved` or `reviewed` promotion.
- QA-L4: independent human review not performed.
- RFC-0002: remains Pre-FCP.
- ADR-0001: remains Proposed.
- Disposition: **Iterate; do not promote**.

Primary semantic references:

- [Fiore–Moggi–Sangiorgi, LICS extended abstract](https://person.dibris.unige.it/moggi-eugenio/ftp/lics96.pdf)
- [Abramsky–Jung, Domain Theory](https://www.cs.ox.ac.uk/people/samson.abramsky/handbook.pdf)

The primary-source boundary was checked again. FMS §2 equips each
nondeterminism-domain object with both a least element and a semilattice zero
but does not require them to be unequal, and its commutative monad assumption
does not add Cantilune's two simultaneous first-input Fubini absorption laws.
The equation `A = μX.P(HX)` is the source-specific agent-domain construction,
not a theorem obtained from the general Abramsky–Jung powerdomain chapter
alone. FMS restriction is the action-by-action agent operation in Table 2,
not arbitrary monadic support hiding. The full-abstraction theorems in FMS
§3 quantify over the completed FMS process model and strong late
bisimilarity; they do not entail Cantilune's strengthened separated-effects
acceptance package.

## Nominal separation and occurrence-provenance increment

The mutable 2026-07-27 tree now closes one additional support seam:

- `disjoint_mapSupport_iff` proves that every finite-world injection
  preserves and reflects finite-support separation;
- permutation and canonical allocation inherit the exact `iff`;
- `rename_freshChoiceAlpha` turns the fresh-choice permutation equation into
  equality of actual continuous maps in `World ⥤ ωCPO`; and
- `FMSNominalSeparationTransport.compose_rename_iff` proves faithful
  transport of the concrete `FinsetPCM` partial composition, including
  identity and sequential renaming.

This is nominal transport of the separation predicate, not a separated
powerdomain or a separated Fubini theorem.

The operational independence audit also found that the former label-only
replay-square interface was too weak: a pair of reversed traces through
opposite branches of
`(a.b) + (b.a)` could have the same endpoint without being residuals of the
same two occurrences, and a `tau` label did not retain its synchronization
channel. `LateMarkedIndependentExchange` therefore adds data-valued raw and
guarded-recursive events, complete mark/erase correspondence, and
`ParallelResidualSquare`, whose only constructor consumes one marked
occurrence from each parallel component. Same-channel silent
synchronizations retain their hidden subject and are not independent; the
choice counterexample cannot construct a residual square.

The stronger nominal residual theorem is still open: the current square
carries four source/residual freshness premises explicitly. It does not yet
derive residual freshness from one-step support evolution, alpha-freshen a
conflicting bound action, lift through recursive structural congruence, or
replace the older label-only replay quotient globally.
