# Theory closure iteration: kernel-built gains and remaining boundaries

Status: implementation evidence; not QA-L4 approval  
Date: 2026-07-23  
Updated: 2026-07-25
Risk / quality / maturity: S2 / QA-L4 target / Pre-FCP-M1  
Owner / DRI: Joker-of-Gotham / project DRI  
Required independent reviewers: category/DPO/Petri, process semantics/FMS,
and Lean kernel assumptions (not yet assigned or signed)

## Scope

This iteration addresses the four concrete blockers handed off after the
earlier scaffold:

1. fixed-host/`InterfaceLocal` DPOI versus positional typed open hypergraphs,
   arbitrary legal monic matches, and categorical concurrency;
2. the difference between a nonconstant support functor and the actual
   Fiore--Moggi--Sangiorgi (FMS) CPO powerdomain/domain/full-abstraction model;
3. state-only stochastic agreement versus event labels, epochs, and replayable
   `DPOEvent` trajectories; and
4. missing native mismatch, reconnect, and quiescent-delete witnesses in P1c.

The requester authorized the finite-control π amendment. RFC-0002 and
ADR-0001 remain Proposed; implementation does not count as acceptance.

## Kernel-built results

### FreeSMC quotient and arbitrary-object interpretation

`formal/Cantilune/Core/FreeSMCUniversal.lean` now equips the actual hom-wise
quotient with mathlib `Category`, `MonoidalCategory`, and
`SymmetricCategory` instances. For an arbitrary assignment of atomic source
objects to objects of a locally small target SMC, `InterpretationData`
constructs a lawful quotient algebra and a quotient functor. Lean
checks tensor, associator, unitors, braiding, generator, explicit copy, and
explicit discard preservation. `SemanticWord.realization` is separately an
actual strong monoidal braided functor.

`formal/Cantilune/Core/FreeSMCStrongUniversal.lean` packages the
quotient-to-semantic-word functor as a mathlib `Monoidal` and `Braided`
functor: its unit and tensor comparisons are identities because empty word
and concatenation are definitionally preserved. Composition with
`SemanticWord.realization` therefore equips `interpretationFunctor D` with
actual strong symmetric-monoidal structure for arbitrary target object data.

`formal/Cantilune/Core/FreeSMCArbitraryUniversal.lean` now closes that
universal-property boundary. From atomic object isomorphisms and compatibility
on generators, explicit copy, and explicit discard, it recursively constructs
the word comparison, derives raw and quotient-arrow naturality, packages the
comparison as a mathlib natural isomorphism, proves both directions monoidal,
and proves uniqueness of the hom once singleton components are fixed. This is
kernel-built implementation evidence, not immutable or independently
reviewed QA-L4 evidence.

### Positional typed DPOI

`formal/Cantilune/Core/PositionalDPOI.lean` defines intrinsic finite typed
open hypergraphs with dependent finite node/edge fibres and ordered source and
target positions. Morphisms are all morphisms between their encodings in the
typed incidence-presheaf slice. The encoding is full and faithful and yields
an equivalence with its categorical essential image.

`formal/Cantilune/Core/PresheafComplementDPO.lean` treats arbitrary monic
matches in the typed incidence-presheaf slice. The retained-subpresheaf
construction proves:

- the incidence gluing condition implies a canonical pushout complement;
- any pushout complement implies that gluing condition;
- therefore `LegalMatch ↔ Nonempty PushoutComplement`; and
- every complement is compatibly isomorphic to the canonical one.

Complement existence is constructed pointwise; it is not inferred from
adhesivity alone.

`formal/Cantilune/Core/DPOConcurrency.lean` uses the standard
factorisation-through-the-other-context definition of parallel independence.
It constructs the joint context, both residual matches and derivations, and a
canonical isomorphism between the two sequential results, preserving both
original right-hand-side images.

Targeted local command (not immutable review evidence):

```text
lake build Cantilune.Core.PositionalDPOI
  Cantilune.Core.PresheafComplementDPO
  Cantilune.Core.DPOConcurrency
```

completed successfully in the pinned Lean/mathlib workspace.

### Native P1c reference matrix

The typed and raw finite-control syntax now contains proof-guarded mismatch
`[a≠b]P`; its rule propagates an actual body transition. Reconnect is ordinary
channel delegation, and quiescent deletion is a shutdown communication whose
two continuations are zero. They are native one-step derivations, not
metadata, reflexive steps, or weak closures.

`formal/Cantilune/Pi/P1cCompleteMatrix.lean` gives all
`15 events × 4 projections = 60` non-reflexive reference derivations:

- DAG: strict-rank acyclic graph rewrites;
- Petri: declaration-aware, identity-bearing individual-token firings;
- π: typed native strong derivations; and
- morphism: the total identity view.

`formal/Cantilune/Pi/P1cProjectionCertificates.lean` equips four separately
named target relations with exact operational certificates. Soundness,
reflection/exhaustiveness, terminal classification, and signature versions
are proved. The π target retains each actual typed derivation, and every such
step maps to the separately defined alpha/structural standard late semantics.
The four finite relations still share the same ready-event/completed-event
transition shape; DAG steps are not derived from arbitrary DPO matches and
Petri steps are not derived from a general enabling equation.

This is a complete operational theorem for the finite reference calculus. It
does not turn arbitrary future product rules into DAG, Petri, π, and morphism
derivations.

`formal/Cantilune/Pi/P1cAdmittedOperations.lean` goes beyond that fixture for
the three critical operations. An `Occurrence` contains a concrete `Config`,
a parameterized request, and proof of admission; its target is computed.
From it Lean derives enabled finite-support node/edge DPO updates, an enabled
Petri transition whose firing equals the target marking, a native standard
late step, the deterministic morphism step, and endpoint-free replay. The
replay interpreter checks all finite recipe fields and the concrete match
embedding fingerprint before recomputing the target.

`formal/Cantilune/Pi/P1cAdmittedTrajectory.lean` places any one of these
occurrences in a concrete two-state `ExecutionPackage`. The unique
positive-mass pending transition carries the admitted `DPOEvent`, while the
completed state has an explicit external hold. Lean proves that every
business-labelled trajectory position has the exact endpoints, replayed
record, both endpoint epochs, and the same
DAG/Petri/native-late-π/morphism `CommonDerivation`. The canonical path and
the almost-sure event/state/epoch/replay theorem are instantiated for all
three request forms. `EventTrajectorySupport` now proves that every edge
sampled under the actual Ionescu--Tulcea law has strictly positive matrix
mass almost surely and transfers this to the replayable event-path law.
`P1cAdmittedTrajectory.supported_complete_trajectory_almost_sure` combines
that support fact with the existing replay, four-view derivation, and hitting
result; totalization labels on null pairs are therefore not observed almost
surely.

This bridge is intentionally the executable ordinary-node/edge fragment of
`Config`, not an equivalence with the general typed incidence-presheaf DPOI
semantics. The other twelve P1c event families have not yet been lifted to
the same non-fixture common derivation. The two-state package represents one
admitted occurrence followed by external holds, not a general multi-event
epoch scheduler.

### Event-labelled stochastic trajectory

`formal/Cantilune/Feedback/EventTrajectoryMeasure.lean` puts a genuine
probability measure on replayable event paths by pushing the existing
Ionescu--Tulcea state law through the concrete deterministic native-event
decoration. It proves:

- forgetting event data returns the original state trajectory law exactly;
- every selected event is a native observable package step;
- every selected `DPOEvent` replays its recorded source and target
  configurations;
- event number, stable signature version, and the common fair epoch window
  agree; and
- almost-sure stable hitting holds on this same event-path probability space.

`CompleteCommonTrajectory` combines exact state projection, event identity,
replay, and epoch alignment. The Boolean nontrivial execution package
constructs it; callers do not supply a `TrajectoryAgreement` assumption.

`formal/Cantilune/Feedback/EventTrajectoryRandomized.lean` adds a second,
seed-indexed coupling. The native event may depend on source, target, and a
random seed stream. The joint law is the product of the genuine state law and
an arbitrary probability law on seed streams; Lean proves that its state
marginal is exactly the original Ionescu--Tulcea law. Every joint sample still
carries native labels, replay proofs, epoch alignment, and almost-sure stable
hitting. This permits distinct event identities for the same endpoints.

The coupling does not itself supply a runtime joint transition matrix and
does not strengthen `ExecutionPackage.eventEndpoints` into an implementation
of general presheaf-DPO match/complement/freshness/policy re-execution. Those
are separate remaining obligations. For the three admitted P1c operations,
`P1cAdmittedTrajectory` does supply a deterministic runtime kernel whose
business record delegates to the executable request replay kernel; this is
the first non-fixture DPOEvent-level instantiation of the generic theorem.

### Replay-verified runtime execution epochs

`formal/Cantilune/Core/ExecutionEpochTrace.lean` introduces a runtime notion
that is deliberately different from the fairness layer's
`opportunityEpoch`. A `ReplayEpoch` contains an arbitrary finite native event
list at one `Config.signatureVersion`. Lean proves every record has native
endpoints and verified replay, the whole event list replays from its source
to its target, and an all-internal epoch is bounded by the source rank.

`SignatureAdmissionEvent` boundaries are heterogeneous because their source
and target signatures differ. `AdmissionReplays` recomputes the reindexed
target and proves strict version advance. `EpochChain` then joins fixed-
signature replay epochs only through those certified boundaries, and
`EpochChain.complete_replay_agreement` constructs all within-epoch and
between-epoch replay equations.

`formal/Cantilune/Pi/P1cExecutionEpoch.lean` instantiates one two-event epoch:
an admitted business event followed by its productive completed-state
external hold. Both records carry the same runtime signature version and
replay from endpoint-free recipes. It also instantiates strict advance for
the reference four-view admission.

`formal/Cantilune/Feedback/ExecutionEpochTrajectory.lean` now packages every
finite prefix of an event-labelled Ionescu--Tulcea sample as an exact native
path and runtime `ReplayEpoch`, retaining the ordered event identities,
endpoint-free full-list replay, and every record's fixed signature version.
`RandomizedExecutionEpochTrajectory.lean` proves the same on the genuine
state/seed product measure, and `P1cAdmittedExecutionTrajectory.lean`
instantiates both complete theorems for the concrete admitted operations.
Observation opportunities and runtime epochs remain distinct fields. What is
still absent is a stochastic heterogeneous-signature `EpochChain` across
admission boundaries.

### Mechanized CPO fragment

The following are real constructions, not fields of an uninhabited external
package:

- `FMSCpoWorld`: the covariant finite-injection world category, successor
  shift, allocation natural transformation, and continuous support hiding;
- `FMSCpoFinitePower`: the finite-powerset monad on the equality-ordered
  discrete-CPO subcategory, Fubini/coherence, pointwise world lifting, and
  shift compatibility;
- `FMSCpoFiniteAgent`: equality-ordered finite recursive agent fold/unfold
  isomorphisms and a finite-height cocone universal property; and
- `FMSCpoContext`: a nonconstant CPO-valued supported-syntax functor with a
  natural support denotation.

The aggregate `mechanizedCpoFragment` contains exactly these results. A
targeted local build of the four modules and `FMSExternalPackage` completed
successfully after fixing two parser-level applications in the shift laws.

## Boundaries that remain binding

### DPOI

The intrinsic graph category is equivalent to its essential image, not to the
whole unrestricted typed slice. `PositionalDPOIBridge` supplies an
infinite-carrier counterexample, so whole-slice equivalence is a false target.
`PositionalPushoutClosure` now goes beyond the earlier six-object premise:
for any ambient-monic intrinsic finite positional legal match with explicit
fixed-boundary retention it constructs the canonical complement and second
pushout, proves the universal property in the intrinsic, presheaf, and typed
slice presentations, and proves both complement and result lie in the
essential image. `PositionalConcurrencyClosure` constructs the finite joint
pullback for two parallel-independent canonical derivations and proves both
residual contexts, both sequential results, and both residual DPO witnesses
remain intrinsic.

This is the finite positional closure needed for the canonical concurrency
diamond. It is not an abstract proof that the intrinsic category is
M-adhesive/van-Kampen for every categorical construction, nor critical-pair
completeness, global confluence, or a composite-production theorem.

### FMS

The discrete-CPO finite powerset is not Abramsky's powerdomain on all
`ωCPO`. The finite recursive agent is not an enriched initial solution of

```text
A ≅ P(H A)
```

in `ωCPO^I`. Support deletion is not yet the full FMS restriction operation
with all world, substitution, alpha, scope, and action-shape coherence.
`CompleteExternalFMSTheoremPackage` now records the exact acceptance boundary:
strong-commutative powerdomain coherence, the enriched agent-domain solution,
the model- and world-natural exact action shape, coherent name-abstraction
restriction, and operational strong-late full abstraction pinned to the
journal source. `CompleteFMSAvailable` is `Nonempty` of that structure;
Cantilune defines no inhabitant and does not reprove the FMS full-abstraction
theorem.

Those facts are not ordinary missing Lean tactics: they are substantial
domain-theory and process-semantics developments, or independently checked
external theorem imports. They remain stop conditions for a claim of a full
FMS instance.

### Whole-system consistency

The 60/60 P1c result is a reference operational matrix, not the full
five-layer `CompleteProjectionCertificate` family for every admitted
extension. The project still needs:

- substantive static SMC functors for DAG, Petri, π, and morphism views;
- an explicit acyclic/rankable source restriction for the DAG view:
  `DAGScopeObstruction` kernel-checks a well-typed self-loop and proves that no
  strict incidence rank can exist for every typed open hypergraph;
- one shared general source rule family and event provenance;
- resource/admission/terminal/replay compatibility for every admitted symbol;
- general product execution-package progress premises; and
- independent QA-L4 review, RFC FCP passage, and ADR acceptance.

No build, agent summary, or proof manifest may fabricate those human actions.

## Closure audit addendum (2026-07-24)

### Full-worktree build evidence

The current closure run completed a full pinned-worktree `lake build` with all
**8801 build targets successful**. The repository CI then rechecked the
146-file source aggregate, the 18-item proof manifest, the placeholder ban,
and the kernel dependency allowlist for **213 declarations**. This establishes
that the imported Lean
modules and regression examples in this worktree elaborate and kernel-check
together. It is local implementation evidence only: it is not an immutable
release result, an independent proof review, QA-L4 approval, RFC FCP passage,
or ADR acceptance.

### Newly closed finite bridges and kernel-checked negative results

`formal/Cantilune/Core/OpenHypergraphNormalization.lean` constructs an
intrinsic positional finite hypergraph from every concrete
`TypedOpenHypergraph` by discarding inactive ambient identifiers and
reindexing exactly the finite active node and edge support into dependent
type/label fibres. Ordered incidence and typed, injective boundaries are
retained. This is an object-level active-support normalization into the
finite positional subcategory; it is not a functorial equivalence with the
whole typed-presheaf slice.

That limitation is now finite, not merely an artefact of an infinite carrier.
`formal/Cantilune/Core/PositionalFiniteSliceObstruction.lean` constructs a
finite typed slice object containing one generator edge but omitting its
required source-incidence position. Lean proves that it is outside the
essential image of the positional encoding and hence that the encoding is
not essentially surjective even on all finite objects of the unrestricted
slice. Therefore a whole-slice equivalence is a false proof obligation; the
honest positive target remains the well-formed positional essential image
and its proved finite DPO closure.

`formal/Cantilune/Pi/FMSCpoFinitePowerObstruction.lean` records the exact
boundary of the discrete finite-power construction. On the ordinarily ordered
Boolean CPO, singleton into equality-ordered finite sets is not monotone, so
there is no continuous map with that carrier function. This does **not**
disprove or construct the Abramsky powerdomain. It proves that the existing
equality-ordered finite-powerset monad cannot simply be promoted objectwise to
all omega-CPOs and called the FMS powerdomain.

`formal/Cantilune/Pi/P1cLateExhaustiveness.lean` separates native-step
soundness from full-late-LTS reflection. The mismatch process has exactly its
designated native transition, but the current unrestricted reconnect and
quiescent-delete parallel handshakes also expose ordinary visible output
transitions to the environment. Lean constructs those additional transitions
and proves that no `ProjectionCertificate` mapping source states to these
actual raw reference processes can reflect the complete
`Late.NativeStep` target LTS. The event-indexed wrapper remains a sound native
one-step witness, but it is not exhaustive for the whole raw late LTS. Repair
requires an explicit RFC decision about protocol restriction/hiding,
observation scope, or process redesign; the implementation may not silently
replace the target by a restricted or weak relation.

### Probability bound now derived from the execution kernel

`formal/Cantilune/Feedback/KernelFiniteHeightProgress.lean` derives the
finite-height `H / epsilon` expected-opportunity bound from an actual
finite-state stochastic kernel plus its phase and stable-window certificate,
rather than accepting an unrelated tail sequence.
`formal/Cantilune/Pi/P1cAdmittedKernelExpectation.lean` instantiates that
bridge for the concrete admitted mismatch/reconnect/quiescent-delete execution
package with `H = 1` and `epsilon = 1`; Lean proves expected eligible
opportunities are at most `1`. The scope is one admitted occurrence in the
fixed-signature two-state package. It does not yet establish the same bound
for a heterogeneous-signature `EpochChain`, an arbitrary multi-event epoch
scheduler, or every future execution package.

### Functorial normalization, support coherence, closed π witnesses, and segment replay

`formal/Cantilune/Core/OpenHypergraphNormalizationFunctor.lean` extends the
earlier object-level active-support normalization to concrete
structure-preserving morphisms, including morphisms whose source and target
use different ambient identifier types. Lean proves incidence naturality,
identity and composition preservation, and that a globally injective concrete
match normalizes to a monomorphism in both the intrinsic category and ambient
typed-presheaf slice. `normalizedMatch` packages that map as the actual
general `AdhesiveDPOI.Match`, and
`normalized_monic_gluing_has_derivation` proves that the ordinary presheaf
gluing condition then yields a full DPO derivation. Consequently this
transport boundary no longer requires `InterfaceLocal`. This is still not a
full/faithful equivalence with the unrestricted slice, nor an unconditional
proof that the intrinsic category is M-adhesive; transport of arbitrary
parallel-independence witnesses back to a separately bundled concrete
active-support category remains open.

`formal/Cantilune/Pi/FMSCpoSupportHidingCoherence.lean` proves the actual
support-object allocation/hiding retraction equations, both pointwise and as
equalities of continuous natural transformations in the implemented
omega-CPO functor category. These are genuine coherence facts about the
nonconstant support model. They are not an inhabitant of the FMS agent-domain,
restriction/hiding, adequacy, or full-abstraction package.

`formal/Cantilune/Pi/P1cClosedNativeCertificate.lean` supplies a constructive
closed-protocol direction for four internal event families: communication,
open/close, reconnect, and quiescent delete each have one genuine strong
native $\tau$ transition, with no weak closure or event-generated target
relation. Lean now also proves exhaustiveness at all four sources: every
native derivative has exactly the designated $\tau$ label and endpoint. This
still does not repair the full event-isolated reflection obligation. The
closed open/close endpoint has a genuine subsequent payload $\tau$ transition,
and `ClosedFullNativeTarget.no_event_isolated_projection_certificate` proves
that the current two-state-per-event source LTS cannot reflect it. A reviewed
multi-state source protocol or different one-step terminal endpoint, followed
by fifteen-event and structural-congruence reflection, remains necessary.

`formal/Cantilune/Feedback/ExecutionEpochTrajectory.lean` now records the
exact stored source and target of every trajectory event and proves
endpoint-free `DPOEvent` replay plus fixed runtime-signature alignment for
every finite subsegment. Thus the fixed-signature probability bridge covers
event identity, native paths, stored endpoints, epoch alignment, and replay
on arbitrary finite intervals. It still does not place certified
heterogeneous signature admissions in one dependent probability space, and
its replay interpreter is not the general presheaf-DPO
match/complement/policy executor.

### Remaining decision, external-package, and human-review gates

The following boundaries remain open and must not be converted into completion
claims:

- **RFC-0002 decisions:** adopt the finite well-formed positional essential
  image as the DPOI categorical scope; state an acyclic/rankable source
  restriction (or change the DAG target); and resolve the full-late P1c
  protocol/observation obstruction without an undeclared weak-step fallback.
- **External FMS package or equivalent mechanization:** provide a genuine
  strong-commutative powerdomain on the intended CPO category, an enriched
  solution of the FMS agent domain equation, continuous natural
  fold/unfold isomorphisms, coherent restriction/hiding, adequacy, and the
  pinned strong-late full-abstraction result. `CompleteFMSAvailable` still has
  no inhabitant, so no real FMS/full-abstraction instance is claimed.
- **General projection closure:** supply substantive static SMC and
  operational certificates for the shared general source rule family, rather
  than extrapolating from the finite P1c reference matrix and three admitted
  operation packages.
- **Human governance:** the category/DPO/Petri, process-semantics/FMS, and
  Lean-assumption reviews remain unsigned. QA-L4 is a target, RFC-0002 has not
  passed FCP, and ADR-0001 remains Proposed rather than Accepted.

These are now explicit theorem-scope or governance gates. The 8801-target
build and 213-declaration axiom audit do not discharge them.

## Post-audit closure correction (2026-07-24)

This section records later kernel-built results and supersedes the earlier
“still absent” descriptions in this log where they conflict. It does not
promote RFC-0002 or ADR-0001, and it does not turn local worktree evidence
into QA-L4 review evidence.

### General finite typed-open-hypergraph DPOI

`formal/Cantilune/Core/GeneralFiniteOpenDPOI.lean` now collects the positive
categorical result at the exact scope that survived the finite-slice
counterexamples. Its principal exported results are:

- `finite_open_hypergraph_equivalence`: the category of finite,
  incidence-complete typed open hypergraphs with the prescribed ordered
  boundary is equivalent to the full, replete essential image of the
  positional encoding in the adhesive typed-presheaf slice;
- `arbitrary_legal_monic_match_has_intrinsic_dpoi`: an arbitrary categorical
  occurrence whose rule legs and match are monic after encoding, and which
  satisfies the ordinary gluing and fixed-boundary-retention conditions, has
  a complete intrinsic two-pushout DPO witness;
- `arbitrary_parallel_independent_matches_have_intrinsic_residuals`: both
  residual derivations of any two such parallel-independent matches transport
  back to the intrinsic finite category; and
- `arbitrary_parallel_independent_matches_commute`: the standard adhesive
  concurrency diamond has a canonical result isomorphism preserving both
  right-hand-side images; and
- `arbitrary_legal_monic_match_complement_vanKampen`,
  `arbitrary_legal_monic_match_result_vanKampen`, and their bundled theorem:
  both canonical DPO squares are Van Kampen in the ambient adhesive slice.

These statements remove the fixed-host, thin-inclusion, and
`InterfaceLocal` restrictions for the well-formed finite category. They do
not assert an equivalence with every object of the unrestricted slice,
because finite incidence-incomplete objects and infinite objects make that
claim false. Nor do they claim critical-pair completeness or global
confluence.

### Full native P1c reference refinement

`formal/Cantilune/Pi/P1cFullNativeRefinement.lean` replaces the failed
two-state-per-event reflection attempt with a kernel-checked proof shape that has
explicit intermediate states. All 15 reference event families start with an
actual `Late.NativeStep`; open/close and restriction use their genuine
two-stage payload transitions. The target relation contains every native
derivative of each family-tagged raw process and applies no observation
filter. Lean proves exact ready-state transition classification,
`native_sound`, `native_reflect`, native normality of every completed image,
terminal equivalence, signature-version preservation, and the resulting
`ProjectionCertificate`.

This closes full native soundness/reflection for the finite 15-family,
multi-state reference protocol, including mismatch decision, reconnect, and
quiescent delete as native steps. It supersedes the earlier statement that a
multi-state protocol was merely a future repair. It still does not manufacture
the shared product-wide admitted `Config` rule family, substantive static
SMC/resource/admission layers, or the four-projection total theorem.

### Corrected FMS acceptance boundary

`formal/Cantilune/Pi/FMSExternalPackageObstruction.lean` proves that the
former split acceptance API was inconsistent: its universal property did not
require divergence preservation, while a later coherence record did. On the
empty CPO this collapses the alleged free lift and makes the combined legacy
records uninhabited. The old records are retained under `Legacy*` names only
so this regression theorem remains checkable.

The corrected `CpoPowerdomainPackage` puts divergence, deadlock/empty, and
idempotent choice in one structure. It requires
`divergence_ne_empty`, strictness of functorial action and multiplication,
strong-commutative Fubini coherence, and a free universal property whose
candidates preserve unit, divergence, deadlock, and choice. The complete FMS
acceptance record further requires locally continuous action, exact
world/action and parallel-composition coherence, canonical
abstraction/restriction denotation, compositional hiding, and the operational
and world-indexed strong-late full-abstraction bridge.

This is an internally corrected specification of what an imported or
mechanized FMS model must prove. Cantilune still defines no inhabitant of
`CompleteFMSAvailable`: no genuine all-omega-CPO Abramsky powerdomain,
continuous recursive agent-domain solution, or checked full-abstraction
instance has been supplied. Consequently no unconditional FMS/full-abstraction
completion claim is licensed.

The binder-level hiding bridge is now exact rather than merely one-sided.
`FMSBinderInstantiation` proves the last-name abstraction/substitution
round-trip, including the required free-name renaming under nested binders,
and proves that canonical restriction of a freshly extended body is the
ordinary syntax restriction. `FMSExternalPackage` lifts that equation to its
conditional denotational coherence interface.

`FMSExactAcceptance` also pins the missing semantic construction more tightly.
Its stage transition is defined by domain unrolling and powerdomain
observation; restriction is a four-branch action fold; left merge uses
powerdomain map; synchronization uses Fubini, map, and multiplication; and
parallel is exactly the four-way choice of the two left merges and the two
synchronizations. All non-handshake action pairs are required to denote
deadlock. This is still an acceptance structure, not a construction:
the exact Table-2 restriction case maps remain supplied data, and no
`ExactFMSAvailable` or `CompleteFMSAvailable` inhabitant exists.

### Arbitrary finite heterogeneous event trajectories

`formal/Cantilune/Feedback/FiniteHeterogeneousTrajectory.lean` now constructs
`ChainTraceAgreement` for every finite `EpochChain`. The dependent ordered
event list contains both fixed-signature native `DPOEvent`s and certified
signature-admission boundaries. Every event is on the exact chain path,
replays according to its own event kind, and is aligned with the runtime
execution epoch; callers provide no trajectory-agreement premise.

`formal/Cantilune/Feedback/FiniteHeterogeneousProbability.lean` then samples
the canonical type-zero phase space
`Fin (length(traceEvents chain) + 1)` with a genuine deterministic
Ionescu--Tulcea kernel. Almost every path follows the exact finite schedule
and therefore carries the complete ordered native-event, DPO/admission
replay, and execution-epoch agreement. Once all recorded events have run,
the kernel stutters forever at the final phase. That self-loop is expressly
administrative: it is not decorated or counted as a `DPOEvent` or signature
admission.

This closes the finite heterogeneous execution-epoch probability bridge. It
does not identify runtime execution epochs with feedback
`opportunityEpoch`s. Aligning observation opportunities, fairness windows,
and accepted-progress opportunities with this event schedule still requires
a concrete scheduler certificate for each execution package.

`FiniteHeterogeneousRandomKernel` generalizes the deterministic phase kernel
to a caller-provided Markov kernel. If every nonterminal phase advances with
probability one and the terminal phase is absorbing, Lean derives almost-sure
equality with the canonical phase schedule and therefore the same complete
event-labelled, replayable, execution-epoch-aligned trajectory. The premise
forces the phase law to be Dirac; this theorem does not yet model random
choice among competing business events.

### Static/operational coherence is now an explicit gate

The earlier complete-certificate record packaged a static SMC functor and an
operational projection certificate without relating their state images.
`Core/CoherentProjection` now adds Arrow-category state representations,
source and target rewrite cells, state-image isomorphisms, and the exact
commuting-square equation for every mapped rewrite step.
`Theorems/CoherentFourProjection` requires four such cross-layer coherent
certificates before producing the corresponding total theorem.

The realization interface is now quotient-aware as well. Its chosen state
setoid is exactly categorical isomorphism on represented arrows; the chosen
isomorphisms satisfy reflexive, symmetric, and transitive coherence; and
changing step representatives conjugates the same rewrite cell. This is
required for α/structural π rather than assuming literal representative
equality.

These additions close an anti-vacuity defect in the theorem interface; they do
not supply the product theorem. The repository still has no shared source
execution package together with substantive DAG, Petri, π, and morphism
inhabitants of the coherent certificate record.

### Repository and governance status

The top-level ignore rule for `formal/` has been removed; only generated
Lean build/cache directories remain ignored. At the time of this note,
`.gitignore` is modified and `formal/` is still untracked in the worktree.
The new proofs therefore have neither immutable commit-bound provenance nor
independent review. QA-L4 remains a target, RFC-0002 remains pre-FCP/Draft,
and ADR-0001 remains Proposed.

## Final interface and stochastic corrections (2026-07-24)

These later results refine the preceding scope without changing the
governance status.

### Intrinsic DPO transport and an independent essential-image predicate

`GeneralFiniteOpenDPOI` now transports each arbitrary encoded-monic legal
match through the finite-image/preimage isomorphism and exposes commuting
equations for the original rule legs and occurrence. Both residual matches
and the concurrency result are transported back to intrinsic witnesses.

The categorical scope is no longer characterized only by “objects produced
by the encoder.” `PositionalImageCharacterization` defines the independent
ambient predicate `ExactPositionalObject`: finite carriers, exactly one typed
incidence per edge/port descriptor, the prescribed ordered boundary typing,
and no duplicate boundary attachment. It reconstructs an intrinsic graph and
proves `essImage X ↔ ExactPositionalObject X`, including repleteness under
ambient isomorphism. `PositionalBoundaryDuplicateObstruction` gives a finite,
incidence-complete, fixed-boundary object with a duplicate boundary
attachment and proves that it is outside this image. Thus the unrestricted
finite slice is mechanically ruled out, while the exact well-formed
subcategory has the requested equivalence and DPO/concurrency transport.

### Structural late-π boundary

`P1cStructuralLateBridge` proves that every step of the 15-family refined
protocol, including both payload follow-ups, is an actual step of the
unfiltered α/structural strong-late LTS. It also proves two exact limits of
the pure raw-process projection:

- delegation and reconnect have the same raw source/action/target triple, so
  source event identity cannot be recovered from that triple alone; and
- the canonical pure-process state map cannot inhabit the current
  `ProjectionCertificate`, because dynamic admission changes the runtime
  signature version from zero to one while the pure π LTS assigns version
  zero to every process.

The family-tagged native certificate remains complete at its declared finite
scope. The structural result is genuine one-step soundness, not weak
reduction, but a production certificate now requires an RFC-level choice:
separate runtime signature metadata from the pure π projection, or use an
explicitly version-enriched target. This mismatch is not hidden by changing
the target relation.

### Sampled dependent labels and genuine finite branching

`FiniteHeterogeneousMarkedKernel` strengthens the canonical heterogeneous
schedule: a positive business edge carries an actual dependent
`ChainStepMark`, its native `ChainStep`, exact event endpoints, replay, and
runtime execution-epoch alignment. The absorbing terminal edge is a
different administrative constructor and cannot be mistaken for a
`DPOEvent`.

`FiniteBranchingReplayKernel` removes the same-endpoint event-collapse
problem for finite kernels. Probabilities are assigned to explicit business
choices. The sampled successor stores that exact choice, so two positive
events with the same unmarked source and target remain distinct stochastic
states. Almost every Ionescu--Tulcea path carries the ordered sampled choices
and their dependent `ReplayEvent` witnesses. The witness type may bundle
native derivation, executable DPO/admission replay, and epoch alignment.

This is a real branching event-level construction, but not yet a production
instantiation over the unbounded runtime scheduler. Each concrete execution
package must still supply its finite choice family and weights, relate
feedback opportunity epochs to execution epochs, and derive its fairness,
stable-window, and positive-epsilon hypotheses.

### FMS is now a non-bypassable production gate

The FMS audit found that `ExactFMSAvailable` and `CompleteFMSAvailable` had no
inhabitants and, more importantly, were not required by the earlier
four-projection composition theorem. A zero-axiom build could therefore
compose four generic certificates without licensing the denotational FMS
claim.

`FMSGatedFourProjection` closes that interface defect. Its input contains a
concrete `ExactFMSAcceptancePackage` together with the four cross-layer
coherent certificates. It also requires `OperationalFMSPiCoherence`: mapped
source states are represented by closed raw π processes, target states have
FMS denotations, target events have raw actions, setoid-equivalent states
denote equally, and a target native step from a mapped source is equivalent
to the corresponding supplied FMS transition. The strongest conclusion
retains both the exact package and this π/FMS bridge. The finite/discrete
support fragment cannot apply this theorem. No package or bridge is
constructed in this repository, so the gate exposes rather than discharges
the remaining blocker.

The external mathematical work remains substantial: an all-ωCPO
powerdomain, a continuous solution of the recursive agent domain equation,
source-identified Table-2 restriction clauses, full action/parallel
coherence, an all-world operational bridge, and the strong-late
full-abstraction proof. Current mathlib supplies ωCPO and continuity
infrastructure but not the required algebraic-compactness/domain-equation or
Abramsky powerdomain development.

## Extension-family, support, and feedback continuation (2026-07-25)

This continuation records local kernel-built results. It is implementation
evidence only: none of the declarations below has immutable commit provenance
or independent QA-L4 review.

### Signature-indexed projection families

`Core/ProjectionFamily` now makes signature extension operational rather than
proof-valued. `ReindexableExecutionFamily` contains an `ExecutionPackage` at
every finite signature and actual state/event maps satisfying identity and
composition equations. `ExecutionPackage.Reindexing` additionally fixes the
reindexed configuration and the complete `DPOEvent.Verified` record by
equality. Its replay theorem therefore states that the target kernel executes
the same reindexed source and target configurations, not merely that some
event exists.

`Theorems/FourProjectionFamily` forces the DAG, Petri, π, and morphism target
families to share one source family. At every signature it derives the
ordinary four-projection path, reflection, terminal, and version results.
Across two composable admissions it proves all four state-naturality squares,
and after any extension it proves that all four projected event records replay
their exact reindexed configurations. The regression is inhabited by a real
all-signature identity execution family.

This closes the extension-indexed interface and replay-composition defect. It
does not construct production target families, and it does not misclassify a
cross-signature admission as a fixed-signature `DPOEvent`;
`AdmissionReplays` remains the heterogeneous boundary.

### A complete sampled edge inside one epoch

`Feedback/FourProjectionSampledTrajectory` derives all evidence from one
sampled dependent business edge: the source event and native derivation, the
verified DPO record and exact endpoints, runtime/opportunity epoch equality,
a singleton replay epoch and epoch chain, and all four native projected
steps with their endpoint versions. `PointwiseAgreement` is consequently a
nontrivial proposition, while
`completeSampledTrajectory_almostSure` obtains it from the actual branching
Ionescu--Tulcea path law.

The theorem is exact for a fixed signature. A later admission is still an
`AdmissionReplays` edge between epochs. A production heterogeneous scheduler
must combine those two cases and derive its authorization, fairness, stable
window, and positive-epsilon premises.

### Standard late request/accept boundary

`Pi/LateAlphaSupport` proves free-name and executable-prefix invariance under
alpha equivalence and structural congruence. It characterizes processes
structurally congruent to zero and mechanically proves that choice
idempotence is not generated by the current standard structural congruence.
Consequently the S4 law belongs to a separate equational or bisimulation
layer and cannot be used silently in native late-transition inversion.

`Pi/P1bStructuralLateBridge` proves that both finite request/accept source
events map to genuine unfiltered one-step structural strong-late
derivations, together with success, external-wait, and signature-version
equations. Its full certificate constructor remains explicitly conditional
on `StandardLateReflection`: a residual/uniqueness theorem must still classify
native derivatives from every structurally congruent representative of the
closed handshake. No weak-step closure or observation filter has been used.

### Rankable DAG and authorized feedback

`Projection/RankableDAG` gives the positive counterpart to the self-loop
obstruction. Every typed open hypergraph carrying an explicit strict
incidence rank maps to a finite strict DAG containing every active
source/target pair. Projected edges reflect to real hyperedge incidences,
input and output boundary nodes remain present, homomorphisms preserve the
dependency edges, and every projected directed cycle is impossible. DPO
rules must still carry target-rank preservation.

`Feedback/AuthorizedVoting` makes observer authorization an invariant of
stored ballots, proves identity-deduplicated recording idempotent and
distinct-observer recording commutative, and classifies approval, rejection,
and simultaneous quorum conflict without a hidden tie-break. A qualified
aggregate becomes one monotone evidence event but cannot autonomously change
the observed party's acceptance bit.

`Pi/P1cSupportedFeedbackBridge` connects the positive stochastic support of
each admitted occurrence to a concrete feedback execution package. Business
progress strictly raises evidence and the completed external hold preserves
stability. The separate theorem `no_totalized_feedback_map` proves that the
zero-mass administrative reset used only to totalize the event selector
cannot belong to any pathwise monotone pending/completed feedback map.
Probability zero is therefore not used to excuse a false transition theorem.

### The discrete finite-power model is not the FMS powerdomain

`Pi/FMSCpoFinitePowerObstruction` constructs the equality-ordered finite-set
endofunctor on actual ωCPO and its pointwise lift to
`World ⥤ ωCPO`. It then proves that a continuous singleton component would
force every comparable pair of the source CPO to be equal, and derives
`no_naive_singleton_unit` and `no_naive_pointwise_singleton_unit`.

This is a stronger type-correct negative boundary: the discrete `Finset`
fragment cannot be promoted pointwise into the FMS powerdomain monad. It does
not construct the required Abramsky powerdomain, solve the recursive agent
domain, or prove hiding/full abstraction.

The external source fixes the remaining acceptance claim more precisely.
FMS Proposition 2.2 says that a suitable Abramsky powerdomain on the base Cpo
category, if supplied, lifts pointwise to `Cpo^I`. The agent construction then
uses

```text
H X = N × (N ⇒ X) + N × N × X + N × δX + X
A   = μX. P(H X),
```

and Theorems 3.2 and 3.3 state the finite and full closed strong-late
full-abstraction results
([author-hosted PDF](https://person.dibris.unige.it/moggi-eugenio/ftp/lics96.pdf)).
These are external paper theorems, not declarations checked by this Lean
kernel. Recording them does not manufacture an axiom-free local powerdomain,
domain-equation solution, or acceptance-package inhabitant.

### Exact positional category, not an unrestricted slice

`Core/ExactPositionalDPOI` lifts the independent object predicate from
`PositionalImageCharacterization` to an explicit categorical equivalence.
The direct encoding into the full exact-positional subcategory is faithful,
full, and essentially surjective; its reconstruction isomorphism is explicit.
It also preserves and reflects monomorphisms and exposes the same underlying
encoded arrow used by the DPO development.

Thus fixed hosts, thin inclusions, and `InterfaceLocal` matches are no longer
part of the exact-positional categorical bridge. The target remains the full
subcategory selected by finite carriers, complete typed incidence, exact
ordered boundary, and injective boundary attachment. It is intentionally not
the unrestricted typed-presheaf slice.

### Heterogeneous four-projection sampled trajectory

`Feedback/FiniteHeterogeneousFourProjection` assigns one
`FourProjectionCertificate` to every fixed-signature epoch of a dependent
`EpochChain`. From the canonical marked-kernel path law it proves that almost
every nonterminal phase carries the one sampled dependent mark, its replay,
execution-epoch alignment, and projection evidence. Business edges retain a
`DPOOccurrence` and four native target derivations; signature boundaries
retain `AdmissionOccurrence`/`AdmissionReplays` and are never recast as
same-signature DPO events.

The family-level theorem requires `SourceFamilyAlignment`. This is not a
proof convenience: `SomeReplayEpoch.package` is arbitrary existential data
and cannot be identified definitionally with the shared source family.
Likewise, four target admission replays cannot be obtained from pure
reindexing. `pure_reindex_ne_admission_target` and its replay-specialized
corollary prove that `Config.reindex` preserves `signatureVersion`, while an
admission target strictly advances it. The production interface therefore
needs separate heterogeneous target-admission transitions and replay
evidence, not a hidden equality to `Reindexing.mapState`.

## Native-rule and generated-trajectory continuation (2026-07-25)

This continuation is working-tree implementation evidence. Targeted Lean
builds were executed locally, but the declarations still lack immutable
commit provenance and independent QA-L4 review.

### A normative typed standard-late relation

`Pi/OperationalBridge` now distinguishes the historical executable typed
kernel from the legal standard relation. `Step.StandardNativeStep` contains a
typed derivation together with every recursively required freshness and
capture-avoidance premise. The theorem
`Step.standard_typed_pi_erasure_operational` maps every such legal transition
to one independently defined `Late.NativeStep`; it does not use structural
closure, an observation filter, or a weak transition.

`Pi/P1cLateBridge` proves `piAdequate_standard_typed` for every one of the
fifteen P1c event families, including mismatch decision, reconnect, and
quiescent delete. Thus all sixty matrix cells now have both their independently
declared target derivation and a legal typed standard-late witness. The legacy
typed `Step` remains executable and still erases to `Raw.Step`, but it is not
silently reclassified as standard when an old constructor lacks the standard
freshness premise.

`LateAlphaSupport` additionally proves that capture-avoiding substitution
preserves prefix count, every native or structurally closed standard-late step
strictly decreases that count, a prefix-free source cannot step, and every
transition from a closed source has action `tau`. These are inversion
invariants rather than positive examples.

### P1c event records and actual admitted operations

`Pi/P1cBusinessReplayMatrix` packages every fixed-signature P1c family except
dynamic admission as one deterministic `Config` occurrence. Its endpoint-free
recipe recomputes the policy/audit endpoint; the common record carries the
verified `DPOEvent`, all four native matrix derivations, and a genuine
standard-late transition. A nonempty `ExecutionPackage` contains all fourteen
events. This package is deliberately an audit/reference calculus and does not
pretend that incrementing its policy cursor is the eventual product graph
semantics.

For mismatch, reconnect, and quiescent delete,
`P1cAdmittedOperations` remains the stronger construction: graph, resources,
names, enabling, match fingerprint, and exact replay are computed from the
same admitted occurrence. Dynamic partner admission remains a heterogeneous
`AdmissionReplays` edge because its source and target signatures differ.

The family-tagged `P1cFullNativeRefinement.certificate` is therefore the
complete operational P1c reference certificate. Forgetting the family/version
provenance is not semantics-preserving for reflection: delegation and
reconnect can have the same raw transition triple, and raw process syntax does
not carry a runtime signature version.

### Concrete event/epoch/replay agreement

`P1cAdmittedExecutionTrajectory.concreteTrajectoryAgreement` specializes the
generic deterministic decoration to each actual admitted-operation
`ExecutionPackage`. Its state projection is the sampled Boolean path, its
event at index `n` is exactly the label selected from adjacent states, every
selected `DPOEvent.Verified` independently replays between the two exact
adjacent `Config` values, and the same object is aligned with the
stable/fair opportunity window and runtime signature epoch. The corresponding
almost-sure theorem additionally excludes the zero-mass totalizer and retains
the hitting result.

`Feedback/FiniteExecutableHeterogeneousRuntime` removes the remaining
non-vacuity concern for a finite cross-signature reference run. Its scheduler
itself emits old-business, signature-admission, and new-business dependent
events; its stochastic kernel is generated from that transition function.
Almost every path retains both business `DPOOccurrence`s, the exact
`AdmissionOccurrence`, replay/epoch evidence, and four independently typed
native target derivations on every edge. Event marks are unique for a fixed
dependent edge, and each target admission strictly changes the target epoch.
This is a concrete finite reference scheduler, not a derivation of product
authorization, quorum policy, fairness, stable-window, or positive-epsilon
premises.

### A real finite strict CPO power fragment

`Pi/FMSCpoFiniteStrictPower` constructs

```text
P_s α = (Set α)⊥
```

for finite `α` as an actual non-discrete omega-CPO. The added bottom is
divergence, embedded empty is the distinct deadlock, and strict union is a
continuous associative, commutative, idempotent choice with deadlock identity.
Direct image is continuous on finite sources and respects identity and
composition; singleton is natural from equality-ordered finite bases. In
particular `P_s PUnit` contains the strict chain
`divergence < deadlock < return unit`. This gives a real inhabitant of the
local `NondeterministicComputation` interface.

It still cannot inhabit `CpoPowerdomainPackage`. The ordered-Boolean no-go
proves that the required singleton cannot be continuously extended by the
naive construction. A genuine all-omega-CPO Abramsky/omega-ideal completion,
its free universal property, strong-commutative and Kleisli coherence, a
locally continuous recursive agent-domain solution, coherent hiding/action
maps, and the paper's full-abstraction theorem remain unformalized external
mathematics.

### Exact remaining P1b inversion obligation

The complete request/accept state is now proved unable to take any structural
strong-late step: `newZero` and `parZero` cannot create prefixes. No strong
counterexample has been found for requesting or established states. The
remaining theorem is exact: transport a native communication residual through
an arbitrary `Struct.trans/symm/alpha/ACU/scopeExtrude` chain and prove that
input-binder alpha-renaming plus capture-avoiding substitution yields a
structurally congruent canonical residual, including the `res(com)` versus
`open+close` presentation. Until that residual-coherence theorem is kernel
proved, `StandardLateReflection` and the unfiltered structural P1b certificate
remain open.

### Shared P1a business certificates and concrete terminal classification

`P1aBusinessProjectionCertificates` now uses the fourteen fixed-signature
events of `P1cBusinessReplayMatrix.ReferenceExecution.package` as one shared
source. Its DAG, Petri, and morphism targets retain the event-family index and
require an independently defined native matrix derivation in every target
step. Each projection has one-step soundness, exact reflection, path coverage,
terminal preservation, and the source package's endpoint-free verified
`DPOEvent` replay. This is stronger than the earlier unrelated single-event
fixtures.

The carrier intentionally has empty graph and resource fibres. It therefore
does not prove that arbitrary admitted DPO rules preserve DAG ranks, rebuild a
declaration-order individual-token pre-net, or provide product static SMC,
resource, and heterogeneous-admission interpretations. Those obligations
remain explicit rather than being hidden behind the shared wrapper.

`P1cTerminalExecutionClassification` connects the terminal predicates to each
concrete admitted mismatch/reconnect/quiescent-delete occurrence. After the
one shared replayable business event, the external policy chooses exactly one
of successful termination, open external wait, genuine deadlock, or an
explicit productive infinite external-hold trace. The four classes are
pairwise disjoint. Every classified endpoint replays the same verified
business record, is equal to the occurrence's computed target `Config`, and
retains the four-view common derivation and ownership-based resource/session
proofs. The policy branch classifies the post-rewrite disposition; it does
not invent four graph rewrites or freeze a product policy.

### Full-worktree verification on 2026-07-25

The complete local evidence gate passed after these changes: 234 Lean source
files, 8889 build jobs, zero whole-word proof placeholders, and 487 parsed
kernel dependency reports. Every audited declaration depended only on the
allowlisted `propext`, `Classical.choice`, and `Quot.sound`. The source
aggregate was
`282869e3bae154431bd49e612fd34183350f81978f70d042af8a981b3f3574a2`.
The exact command and boundary are recorded in
`formal/build-evidence/2026-07-25-local.md`.

This evidence is local and uncommitted. It is not immutable provenance,
independent QA-L4 review, FCP approval, or ADR acceptance.

## 2026-07-25 P1b reflection-decomposition helpers and build restoration

This iteration adds kernel-checked scaffolding toward the open P1b
`StandardLateReflection` obligation and restores a clean full build of the
untracked `formal/` worktree. It does not promote any central obligation.

- `P1bStructuralLateBridge.step_decompose` is kernel-checked: every
  `Late.structuralLateLTS.ObservableStep (mapState state) action target`
  decomposes into `Struct (mapState state) source'`, a
  `Late.NativeStep source' action target'`, and `Struct target' target`.
  This is the verified substructure a completed `StandardLateReflection`
  proof must drive; it is the exact shape of `Step.congr` with the
  `Step.native` identity case folded in.
- `P1bStructuralLateBridge.complete_reflect` is kernel-checked: no
  `Late.Step` leaves the complete request/accept state through any
  structurally congruent representative, because structural congruence
  preserves `prefixCount` (`Late.Struct.prefixCount_eq`) and a native
  strong-late step requires a positive `prefixCount`
  (`Late.NativeStep.source_prefixCount_pos`). This discharges the
  `complete` case of `StandardLateReflection`.
- The `requesting` and `established` cases remain open. The required
  `requesting_structural_native_residual` must, from
  `Struct (mapState requesting) source'` and
  `NativeStep source' action target'`, derive `action = .tau` and
  `Struct target' (mapState established)` (and analogously for
  `established`), covering `res(com)` versus scope-extruded `open+close`,
  alpha-renamed input/restriction binders, capture-avoiding substitution,
  ACU, `newComm`, `trans`, and `symm`. The freshness-blocked
  `scopeExtrude` observation (the session name is free in the request
  component and the public name is free in the accept component, so neither
  restriction can extrude across its parallel partner) narrows the
  relevant congruence to ACU/α/`newComm`, which is the target of the next
  induction pass. This note records the narrowing; the induction is not
  yet kernel-checked.
- Two worktree defects had prevented a clean full build and are corrected:
  `P1cAdmittedP1aCertificates.lean` now imports `Cantilune.Core.Package`
  (its `ExecutionPackage` references were otherwise unresolvable), and its
  regression test now uses fully-qualified
  `Cantilune.Pi.P1cAdmittedOperations.DAG.Step` (and `Petri`/`Morphism`)
  identifiers.
- Two evidence-gate repairs: a doc comment that used the English verb
  "admit" is reworded so it no longer trips the forbidden-placeholder
  whole-word gate (the `sorry`/`admit`/`axiom`/`unsafe` security intent is
  unchanged); and `scripts/ci.ps1` now decodes the `lake env lean`
  axiom-audit output as UTF-8 before regex parsing, so non-ASCII
  declaration names such as `finite_chain_reaches_ωSup` round-trip and are
  audited against the same `propext`/`Classical.choice`/`Quot.sound`
  allowlist.
- The full evidence gate now passes: 241 Lean files, aggregate
  `8f36587fdbd23db27f251cd33c0a1e8d699a56ee48f97b4fad904e42817b5bef`,
  8894 build jobs, zero forbidden placeholders, 487 audited declarations
  on the recorded allowlist. See
  `formal/build-evidence/2026-07-25-worktree-2.md`.

This is uncommitted local evidence. No obligation is promoted. The FMS
implementation boundary is reaffirmed: no `CompleteFMSAvailable` inhabitant
exists, so the worktree theorem covers only the proven sublanguage. This is
not an adopted normative fallback; under the current RFC draft the complete
FMS inhabitant remains mandatory unless FCP accepts the proposed finite-control
boundary. The remaining load-bearing work is
unchanged in kind: the `requesting`/`established` structural-residual
transport, the genuine complete FMS inhabitant, production rule-family /
static / resource inhabitants, scheduler premises, immutable commit
evidence, and independent QA-L4/FCP/ADR review.

## Load-bearing convergence continuation (2026-07-25)

### The established P1b residual is now exact

`LateAlphaSupport` separates executable communication prefixes from unary
`tau`/guard prefixes and separately records the free names used as prefix
subjects. The latter distinction is necessary because the established
request/accept process has a free payload value but no free channel subject.
Alpha conversion, capture-avoiding substitution, and the selected structural
congruence preserve the relevant counts and free-subject interface. A native
silent transition from a two-prefix communication-only source consumes both
prefixes.

Using these invariants,
`P1bStructuralLateBridge.established_structural_residual` proves, for every
structural strong-late step from the mapped established state, that the action
is exactly `tau` and the target is structurally congruent to the mapped
complete state. The theorem uses neither a weak closure nor an observation
filter. Its targeted Lean build passed. Together with the previously checked
complete-state no-step theorem, this leaves only the requesting-state
residual before `StandardLateReflection` can be inhabited.

The requesting residual is not discharged by prefix counts alone. Its proof
must still transport the public-channel communication through arbitrary
alpha/ACU/restriction/scope-extrusion presentations and show that
capture-avoiding substitution yields the canonical established state modulo
`Late.Struct`. General exact equality of bound input labels is false under
alpha-renaming; a correct residual statement must account for the bound label
while retaining an exact top-level `tau` transition.

A stronger attempted shortcut is now mechanically refuted. Let
`L = send 0 1 (send 2 1 zero)`,
`P = par L (recv 0 2 zero)`, and
`Q = par L (recv 0 3 zero)`. The input binder alpha-conversion gives
`Struct P Q`. Process `Q` has a native `tau` synchronization because binder
`3` is fresh for the sender continuation, but `P` has no native `tau` because
binder `2` occurs free in that continuation. The checked declarations
`residualCounterexample_struct`,
`residualCounterexample_alpha_native`, and
`residualCounterexample_no_original_native` therefore rule out a global
theorem transporting every native `tau` step across `Struct`. The remaining
proof must be the source-specific requesting-orbit classification; it cannot
appeal to a false general native residual lemma.

### Authorized feedback and positive event trajectories

`Feedback/AuthorizedFeedbackExecution` now places approval, rejection,
conflict, observed-party acceptance/rejection, and explicit external holds in
one finite `ExecutionPackage`. Its event records are endpoint-free replay
recipes; authorized ballot updates are deduplicated and permutation
independent; conflict aggregation preserves observed-party autonomy; and the
post-decision holds are explicit productive infinite traces.

`Feedback/PositiveEventTrajectory` labels only positive-mass kernel edges.
It therefore avoids assigning a fabricated administrative event to a
zero-probability pair. `Feedback/AuthorizedFeedbackProbability` constructs a
deterministic native kernel on the same execution package, supplies one
stable/fair window with `epsilon = 1`, derives the two-phase expected hitting
bound, and couples every positive path to native event identity, exact
`DPOEvent` replay, and epoch alignment. The current augmented sources were
added after the last full-worktree evidence snapshot and require a fresh
pinned build before their manifest status can change.

### Complete FMS remains a foundational dependency, not a local interface gap

The primary Fiore--Moggi--Sangiorgi source uses the covariant functor category
`Cpo^I`, lifts an Abramsky powerdomain pointwise, and defines the agent domain
by

```text
H X = N × (N ⇒ X) + N × N × X + N × δX + X
A   = μX. P(H X).
```

The paper invokes standard domain-equation techniques for the solution and
does not supply a construction directly translatable to the current Lean
library. The remaining local dependency chain is still:

```text
all-omega-CPO powerdomain monad
  → locally continuous H
  → embedding/projection omega-chain bilimits
  → algebraic compactness and A ≅ P(H A)
  → coherent hiding/action maps
  → adequacy and definability
  → source-pinned full abstraction.
```

Current mathlib supplies omega-CPOs and continuous maps but not this combined
powerdomain/algebraic-compactness development. The finite strict
`WithBot (Set α)` fragment cannot fill that role. RFC-0002 §16 therefore
records a proposed finite-control P1 boundary, but the proposal is not
effective: under the current draft boundary, the complete FMS inhabitant
remains mandatory unless FCP accepts the scope change.

### Evidence and governance boundary

The standalone integrity helper previously treated `formal/scripts/` as the
formal source root. It now uses the same parent-directory boundary as
`scripts/ci.ps1`. This repairs future aggregate computation but does not
retroactively validate changed sources. The last complete evidence record
remains a historical snapshot; all later Lean changes need a fresh pinned
build, kernel-dependency audit, immutable commit, and independent QA-L4
review. RFC-0002 remains Draft/pre-FCP and ADR-0001 remains Proposed.

## Requesting normal form and product/feedback admission checkpoint
   (2026-07-25)

### Kernel-checked checkpoint

Before the later fingerprint draft was introduced,
`Cantilune.Pi.P1bRequestingNormalForm` and
`Cantilune.Pi.P1bStructuralLateBridge` both passed targeted Lake builds. The
normal-form theorem
`Late.NativeStep.two_communication_prefix_tau_pair_form` classifies a native
silent transition from a source with exactly two communication prefixes and
a prefix-free target as a structurally congruent output/input pair under a
finite list of restrictions. Its close cases retain the bound-output
restriction, so the theorem covers both free `com` and `open`/`close`
presentation at that two-prefix boundary.

This theorem closes the established-to-complete normal form. It does **not**
classify the requesting state's four-prefix source. In particular, raw
prefix/support counts do not determine whether the two guarded continuations
have the request/accept binder-incidence pattern. The requesting residual,
`StandardLateReflection`, and the resulting unfiltered standard-late P1b
certificate therefore remain open.

### Unverified incremental sources

Three later additions are deliberately recorded as source-level work rather
than kernel evidence:

- `P1bRequestingFingerprint` develops candidate polarity, guarded-thread,
  choice, and binder-incidence invariants. It is isolated from the built
  normal-form module and has no current targeted-build evidence.
- `ProductRuleAdmission` defines a parameterized product-rule certificate
  which requires one shared four-projection source occurrence, admission,
  rank/resource/session/deletion evidence, authorization, and either an
  internal rank decrease or a positive exact external kernel edge. It does
  not construct a product inhabitant. A later type audit found that this
  first version is in fact uninhabited; see the negative result below.
- `AuthorizedFeedbackClosure` attempts to bundle the already constructed
  authorized execution package and generated kernel into one nonempty
  reference witness carrying hard stability, autonomy, exact event replay,
  epoch alignment, the expected hitting bound, and productive accept/reject
  traces.

These modules were added after the last complete evidence snapshot. Their
targeted builds could not be run in the current sandbox: Elan could execute
but could no longer access the installed 4.32.0 toolchain, attempted a
GitHub download, and failed before Lean compilation because network access
is disabled. This is a verification-environment failure, not evidence that
the declarations are true or false. Consequently no central obligation is
promoted on their basis.

After settling the source files, the deterministic pre-build portion of
`scripts/ci.ps1` passed for 249 Lean sources: the aggregate is
`b47ad145a774b6f6063d2558269df255ed1111289c7f3a4304d84ecfd9f3a94a`,
the pinned-input hashes agree with `source-integrity.json`, and the
whole-word placeholder count is zero. The command then stopped before
`lake --version` because `lake` is not visible in the sandbox. No full build
or axiom report is claimed for this aggregate.

### Negative result: the seven-value requesting fingerprint is insufficient

A source-level counterexample refutes the attempted use of the seven
aggregate fingerprint values as a complete requesting normal form. With
`0` as the public name, `1` as the session name, and `2` as the input binder,
let

```text
B =
  new 0 (new 1
    (par
      (send 0 1 (send 1 0 zero))
      (recv 0 2 (recv 2 2 zero))))
```

`B` has `headPrefixCount = 2`, `topThreadSquareMass = 8`,
`choicePotential = 0`, two send prefixes, two receive prefixes, one output
link, and one input link. The public output/input pair has a legal native
strong `tau` synchronization, retained by the two restrictions, to

```text
B' =
  new 0 (new 1
    (par (send 1 0 zero) (recv 1 2 zero))).
```

However, the canonical established endpoint has the form

```text
new 0 (new 1
  (par (send 1 3 zero) (recv 1 4 zero))),
```

whose free-name set is `{3}`, whereas `B'` has no free names. Since
`Late.Struct` preserves free names, the endpoints cannot be structurally
congruent. This is a mathematical counterexample at the source-definition
level; a dedicated Lean regression still requires the unavailable toolchain
before it can be called kernel-checked.

The requesting proof must therefore retain a positional, binder-aware
continuation signature: at minimum the free payload identity/occurrence in
the guarded output, the sent-name/next-subject edge, the input-binder
edge, and restriction incidence. Numeric polarity and link counts remain
useful necessary invariants but are not sufficient for the 4-to-2 residual.

The isolated source now packages those seven numbers together with the exact
free-name set `{payload}` and the empty free-subject set. The new
`badRequesting_not_augmented` regression shows only that these two nominal
fields exclude the known seven-value counterexample. This nine-field
`AugmentedRequestingFingerprint` is still a necessary candidate, not a proved
complete normal form: no exhaustive structural/native inversion theorem
derives the requesting residual from it. The same unbuilt module now also
derives the exact arithmetic normal form—two enabled threads of length two,
four total prefixes, all four communication prefixes, and zero unary
prefixes. That removes the numeric upper-bound subgoal, but it still does not
identify the two guarded continuations, their binders, or the native
residual. All new declarations in this module remain pending a targeted
build.

### Negative result: the first product-admission interface is uninhabited

The first `ProductRuleAdmission.Certificate` cannot have a value for any
choice of its parameters. Its field
`coherent : FourCoherentProjectionCertificates ...` includes a
`CompleteProjectionCertificate.admissionCompatible` whose source step lives
in `source.lts`. But `source` is an `ExecutionPackage` at one fixed
signature. The kernel-checked theorem
`ExecutionEpochTrace.observable_step_lts_version_preserved` says every such
package step preserves its runtime signature version, because it replays a
same-signature `DPOEvent`.

The admission compatibility fields simultaneously identify the source
step's endpoint versions with `signatureAdmission.fromVersion` and
`signatureAdmission.toVersion`, while
`SignatureAdmissionEvent.advancesEpoch` requires the former to be strictly
smaller. Thus the interface derives both equality and strict inequality of
the same two versions. The source proof
`certificate_uninhabited_fixed_signature_admission` records this
contradiction; its new declaration still needs a targeted build before being
called kernel-checked.

This is not repaired by deleting the duplicate admission endpoint fields.
The incompatible same-LTS admission is already inside
`FourCoherentProjectionCertificates`. The replacement must separate:

1. fixed-signature business occurrence projections, replay, rank, resource,
   terminal, authorization, and scheduling evidence;
2. source admission as heterogeneous `AdmissionReplays` between old and new
   execution packages; and
3. independently typed heterogeneous native admission transitions in DAG,
   Petri, π, and morphism targets, all tied to the same
   `SignatureAdmissionEvent`.

Existing `AdjacentAdmission`, `AdmissionOccurrence`, and the four native
target derivations in `FiniteExecutableHeterogeneousRuntime` provide the
correct shape. The new unbuilt source
`Core/EpochSeparatedProjection.lean` implements the corrected interface
boundary: `CoherentFixedProjectionCertificate`,
`HeterogeneousPackageAdmission`,
`HeterogeneousAdmissionProjection`, and `FourTargetAdmissionBundle`, plus the
core-level fixed-package no-go theorem. It deliberately leaves the legacy
record unchanged. No concrete product inhabitant connects that draft bundle
to substantive static/categorical, rank, Petri-token, authorization,
resource, or scheduler evidence, and the new module is not yet root-imported
or kernel-built. The legacy product-rule interface therefore remains a
negative regression, while the replacement is an unverified interface draft
rather than a completion witness.

### FMS dependency reconnaissance is not a completion proof

The current official
[mathlib omega-CPO API](https://leanprover-community.github.io/mathlib4_docs/Mathlib/Order/OmegaCompletePartialOrder.html)
provides omega-complete partial orders, continuous morphisms, and fixed-point
foundations, but not the required Abramsky powerdomain or a general
algebraic-compactness package. The
[FMS source](https://person.dibris.unige.it/moggi-eugenio/ftp/lics96.pdf)
still requires the free powerdomain layer over `Cpo^I` and the recursive
solution `A = μX. P(HX)` before the hiding, adequacy, definability, and full
abstraction results can be instantiated locally.

The external
[`scott1972` Lean repository](https://github.com/catskillsresearch/scott1972)
is a possible future domain-equation dependency: it formalizes a continuous
lattice function-space tower and inverse-limit construction of `D∞`.
It does not provide the FMS powerdomain, algebraic compactness for the FMS
functor `H`, operational adequacy, or full abstraction, and therefore cannot
inhabit `CompleteFMSAvailable` as-is. Adopting it would additionally require
an RFC decision, Lean-version compatibility work, source/provenance review,
and QA-L4 review. This reconnaissance changes no manifest status.

The next valid evidence checkpoint must use the pinned toolchain without a
network fetch, build every new module and regression, recompute
`source-integrity.json`, run the whole-worktree placeholder and axiom audit,
and bind the results to an immutable commit. Human QA-L4, FCP, and ADR
acceptance remain separate later gates.

### Static checkpoint after epoch separation and arithmetic normal form

After adding the unbuilt epoch-separated interface and the requesting
arithmetic lemmas, the deterministic source checkpoint is:

- 250 Lean source files;
- aggregate SHA-256
  `810a2e19274f42544f3db42c22671c2d88695c807d9b4fbeb95790fe1716fc88`;
- every local `Cantilune.*` import resolves to an existing source file;
- zero whole-word `sorry`/`admit`/`axiom`/`unsafe` matches;
- 18 manifest obligations, still split as 10
  `implemented_unverified` and 8 `partial_scaffold`;
- 520 configured axiom-audit targets with no duplicate declaration names.

The ordinary evidence gate verified the pinned inputs, the 250-file
aggregate, and the placeholder scan, then stopped before any Lean invocation
because `lake` is not available on the sandbox `PATH`. The completion variant
stopped earlier, as designed, because none of the 18 obligations is
`reviewed`. Neither command is a kernel build. In particular,
`P1bRequestingFingerprint.lean` and
`Core/EpochSeparatedProjection.lean` remain outside the root import until
their targeted builds succeed; the aggregate hash and placeholder scan cover
their text but do not elaborate it.

## Exact quantitative P1b residual and inhabited epoch boundary
   (2026-07-25, unverified increment)

The isolated requesting-fingerprint module now proves at source level that a
native silent step with zero unary-prefix count and zero live-choice
potential consumes exactly two prefixes:

```text
Late.NativeStep.target_prefixCount_add_two_eq_of_tau_noUnary_noChoice
```

Applying this to the nine-field requesting candidate gives
`AugmentedRequestingFingerprint.native_tau_target_prefixCount_eq`: every
native silent derivative has exactly two residual prefixes.  This closes the
quantitative `4 -> 2` subgoal, subject to a targeted kernel build.  It still
does not identify the residual's two channels, binder occurrences, or free
payload position, and therefore does not imply
`Late.Struct target closedHandshakeResult.erase`.  The remaining P1b
argument needs an alpha/ACU-invariant positional profile of the two enabled
threads and a native-derivation inversion covering `res(com)`,
`open`/`close`, restriction commuting, scope extrusion, capture-avoiding
substitution, and transitive/symmetric structural chains.

The epoch-separated projection interface now additionally connects one
`ProjectionFamily` to a native heterogeneous admission through
`CoherentProjectionFamilyAdmission`.  Its old and new operational
projections are definitionally the corresponding family members, and each
endpoint retains static SMC, resource, terminal, and categorical
cross-layer evidence.  The target native admission is independently
required; event and endpoint equations only align it with the source.

`Feedback/EpochSeparatedProjectionReference.lean` supplies a nonempty
reference inhabitant of `FourTargetAdmissionBundle` using the already
concrete old/admission/new runtime.  Its four slots intentionally use
identity views.  This demonstrates that the corrected heterogeneous
interface is not contradictory and that strict version advance, native
derivability, and `AdmissionReplays` coexist.  It is not a substantive
DAG/Petri/pi/morphism product certificate and does not discharge any product
rule obligation.

An attempted isolated arithmetic check in Lean Web did not produce kernel
evidence: the editor accepted the text but reported `No connection to Lean`
when fetching goals.  The browser tab was closed and no online result is
counted.  The local pinned `lake` executable remains unavailable to the
sandbox, so every declaration in this increment remains unbuilt and no
manifest status is promoted.

### Complete-FMS inhabitant audit

A whole-tree declaration audit found no local value of
`CpoPowerdomainPackage`, `AgentDomainSolution`,
`CompleteExternalFMSTheoremPackage`, or
`ExactFMSAcceptancePackage`. All matches are structure declarations,
parameters, fields, or conditional consumer theorems. The construction
matrix is:

| Layer | Reusable local work | Missing constructive input |
|---|---|---|
| Abramsky powerdomain | finite `Finset`, equality-CPO and strict finite `WithBot (Set α)` fragments; pointwise lifting of a supplied monad; naive-unit no-go theorems | one locally continuous strong commutative powerdomain on every omega-CPO, with separated divergence/deadlock, free universal property, strength/Fubini/Kleisli/enrichment laws and observations |
| Domain equation | finite agent layers, bounded approximants, fold/unfold isomorphisms and height cocones; conditional `EndofunctorLocallyContinuous` and `AgentDomainSolution` interfaces | algebraic compactness or a checked bilimit construction for `World ⥤ ωCPO`, local continuity of the exact `P ∘ H`, and a continuous natural solution `P(H A) ≅ A` with initiality |
| Hiding | binder round trips, support-level allocation/hiding, and conditional hiding/coherence interfaces | restriction constructed from the actual domain solution, source-audited case equations, world naturality, delta/strength/substitution/scope coherence and compositional denotation |
| Adequacy | conditional stage-transition and operational-coherence interfaces | derive the semantic transition from the powerdomain observation and `roll.inv`, then prove the native strong-late step correspondence without defining the target transition as the source-step image |
| Definability/full abstraction | definitions of late bisimilarity/congruence and conditional full-abstraction consumers | compact domain approximants, finite-term definability/separation, adequacy, and a source-pinned world-indexed closed theorem from which the open theorem follows |

In particular, `StrongLateFullAbstraction.native_step_complete` is an input
field about transition completeness; it is not a theorem that every compact
semantic agent is definable by a finite pi term. Likewise,
`FMSGatedFourProjection` only combines a supplied exact package and cannot
construct one from the finite/support fragments. The FMS obstruction is
therefore constructive and foundational, not a missing final wrapper.

### Current deterministic checkpoint

After the exact quantitative and polarity residuals, linked-core source
theorem, coherent family/admission bridge, heterogeneous product-interface
replacement, identity-view reference, and FMS truth-boundary edits:

- 254 Lean source files;
- aggregate SHA-256
  `66d6e8c39220146b94fd8fed6ca63495613e1f5cff9486b89cae97de9c80ae1d`;
- all local `Cantilune.*` imports resolve;
- zero whole-word `sorry`/`admit`/`axiom`/`unsafe` matches;
- `proof-obligations.json` parses as 18 obligations: 10
  `implemented_unverified`, 8 `partial_scaffold`, 0 `proved`, and 0
  `reviewed`.

The ordinary CI command accepted the pinned inputs, source aggregate, and
placeholder scan, then failed before elaboration because `lake` is not on
the sandbox path. The completion command rejected all 18 non-reviewed
obligations as designed. Neither result is a Lean build or axiom audit.

### Bounded requesting-residual counterexample search

A separate finite search tested whether the nine-field
`AugmentedRequestingFingerprint` still admits a native first handshake whose
two-prefix endpoint is not the canonical same-subject send/receive core.
The search was deliberately independent of the Lean declarations and is
recorded only as counterexample evidence, not as a proof:

- 156,250 bare two-thread/global-restriction parameter skeletons over five
  names, of which 3,600 satisfied all nine fields and 2,400 also satisfied
  the native head-synchronization freshness conditions;
- 50,112 nine-field native candidates with optional sender/receiver outer
  restrictions and optional continuation-local restrictions;
- 5,120,000 scope cases with ordered continuation-local restriction depth at
  most two, containing 208,800 nine-field native candidates; and
- 9,469,952 scope cases with ordered side-outer restriction depth at most
  two, containing 181,440 nine-field native candidates.

No non-canonical endpoint core was found in any of these bounded families.
The enumeration checked the head send/receive polarity, standard late
freshness, exact free-name set `{payload}`, empty free-subject set, the two
subject-link counts, and capture-avoiding renaming incidence. It did not
cover infinitely many names, arbitrary restriction depth, arbitrary
parallel/choice nesting, all repeated-binder patterns, or construct an
actual `Late.Struct` derivation.

The finite result narrows the next mathematical obligation rather than
closing it.  In the strict two-length-two-thread skeleton, the existing
fields force one send and one receive at both the head and tail; the two
link counts identify the sent-name/input-binder continuation edges; native
late substitution aligns the tail subjects; and the nominal support fields
isolate the payload occurrence.  What remains is a general extraction
theorem from arbitrary no-unary/no-live-choice syntax to that skeleton,
followed by a source-specific endpoint proof through `sync`, `close`,
restriction, alpha conversion, ACU, scope extrusion, and structural
transitivity.  The bounded search therefore provides regression confidence
for the candidate invariant but cannot promote `CENTRAL-13`.

### Exact polarity residual and linked-core boundary

The isolated requesting-fingerprint source now proves two additional
constructor-count invariants. Capture-avoiding substitution preserves
`sendPrefixCount` and `recvPrefixCount`, including its alpha-freshening
branches. A native `tau` step from a unary-free source with zero live-choice
potential consequently consumes exactly one send and one receive prefix.
For an augmented requesting candidate, every native derivative therefore has
exactly one send and one receive in addition to the already derived total
prefix count two. These declarations cover the `sync`, `close`, restriction,
parallel, choice, and open constructors, but remain unbuilt.

`Pi/P1bLinkedCoreResidual.lean` separately proves the exact native
strong-late derivative for both direct (`syncLeft`) and crossed
(`syncRight`) presentations of two linked length-two threads. It explicitly
states the late binder-freshness and capture-safety premises, propagates the
step through any finite outer restriction list, removes a newly unused
public restriction only after the step by `Late.Struct`, and instantiates the
fixed closed request/accept process. This is a positive residual theorem for
the extracted core, not the missing extraction theorem: it accepts neither
an arbitrary `Late.Struct` representative nor an arbitrary process satisfying
the nine fields.

The remaining P1b chain is now more precisely localized:

1. extract arbitrary no-unary/no-live-choice `[2,2]` syntax into two
   communication threads plus structurally zero context;
2. localize the two link counts and nominal support to the head/tail binder,
   subject, and payload positions;
3. invert the native `sync`/`close` derivation on that skeleton; and
4. normalize its endpoint through alpha conversion, ACU, `newComm`, scope
   extrusion, capture-avoiding substitution, symmetry, and transitivity.

Until these four steps are kernel-built, `StandardLateReflection` and
`CENTRAL-13` remain open.

### Heterogeneous product-certificate replacement

The isolated `Theorems/HeterogeneousProductRuleAdmission.lean` draft now
assembles the corrected general interface rather than the contradictory
legacy record. It fixes one shared source `ReindexableExecutionFamily`,
requires four actual `CoherentProjectionFamilyAdmission` values at the epoch
boundary, and separately requires an ordinary fixed-signature occurrence in
the admitted epoch. Rank, concrete resource/session/deletion policy,
qualification, authorization, stable/fair window, `ProgressBridge`, positive
`epsilon`, and scheduling are all explicit fields. No target transition,
replay, policy, probability, or substantive DAG/Petri/pi/morphism witness is
synthesized.

The accompanying type-level regression file fabricates no inhabitant. The
interface and regression are now root imported and kernel built. The new
record therefore removes an interface contradiction and makes the
product-owner obligations precise, but it does not instantiate any product
rule and cannot promote `CENTRAL-18`.

## Pinned-kernel closure checkpoint (2026-07-26)

This section supersedes the preceding environment-status statements. The
pinned Lean toolchain was found locally and is executable:

- Lean `4.32.0`, commit
  `8c9756b28d64dab099da31a4c09229a9e6a2ef35`;
- Lake `5.0.0-src+8c9756b`;
- toolchain directory
  `C:\Users\NJHL\.elan\toolchains\leanprover--lean4---v4.32.0\bin`.

The final ordinary evidence gate completed successfully on the dirty
working tree. It checked 283 Lean files with aggregate
`f5a7dac8603a2547772a4c9207e479b1139b8b0eabf0bda028e35cab153f13a1`,
found zero whole-word `sorry`/`admit`/`axiom`/`unsafe`, completed the root
`lake build` in 8938 jobs, and parsed 667 kernel dependency reports. Every
audited declaration depends only on `propext`, `Classical.choice`, and
`Quot.sound`. Existing linter warnings remain, but there were no build
errors. The exact local record is
`formal/build-evidence/2026-07-26-p1b-p1c-feedback-root.md`.

The first audit run found a real generated dependency:
`AuthorizedFeedbackClosure.referenceClosure` retained a `native_decide`
proof through the configured feedback system. That proof was replaced by
ordinary reducible `decide`; the root build and complete audit were rerun
and passed. No audit target was removed.

### P1b residual progress now kernel checked

The formerly isolated P1b modules are root imported and built:

1. `P1bRequestingFingerprint` proves `[2,2]`, exact native `4 -> 2`
   prefix consumption, residual `send = 1` and `recv = 1`, and invariance
   of both polarity counts under capture-avoiding substitution.
2. `P1bTwoThreadExtraction` turns those metrics into actual
   `OneCommThread`, `TwoCommThread`, and `TwoThreadContext` syntax evidence,
   then gives a structural outer normal form
   `wrapNews binders (.par left right)`.
3. `P1bLinkedCoreResidual` proves the canonical direct/crossed native
   handshake and restriction propagation.
4. `P1bLinkedEndpointNormalization` covers `syncLeft`, `syncRight`,
   `closeLeft`, and `closeRight`; alpha payloads, restriction permutation,
   scope extrusion, and fresh restrictions all normalize to
   `closedHandshakeResult.erase`.

The exact remaining P1b theorem is not numeric. It must localize the nominal
link/support incidence inside the two extracted threads and invert an
arbitrary source-side `Late.Struct`/native representative into one of the
proved `LinkedEndpointForm` cases. That bridge must be stable under alpha
renaming, capture-avoiding substitution, ACU, `newComm`, scope extrusion,
symmetry, and transitivity. Until that representative-independence theorem
inhabits `StandardLateReflection`, `pi_ra_certificate` remains
`partial_scaffold`.

## 2026-07-26 finite Monad, nominal atom, and non-identity product checkpoint

`FMSCpoFiniteHoareMonad` strengthens the finite Hoare fragment from a
collection of continuous operations to an actual `CategoryTheory.Monad` on
the full subcategory of finite omega-CPOs and continuous maps. Its
kernel-checked laws include continuous Kleisli bind, bind as
flatten-after-map, both units, Kleisli associativity, input and pointwise
choice distributivity, multiplication naturality and associativity, and an
exact categorical Kleisli-extension computation theorem. The construction
still has neither an empty-deadlock element nor a separate divergence and
does not extend to all omega-CPOs. It therefore does not inhabit
`CpoPowerdomainPackage` or solve any FMS domain equation.

`OpenSMCNominalAtomBoundary` repairs one precise admission defect of the
sort-only open-process presentation. A named interface now carries distinct
typed ports, and an atom certificate requires its erased free-name set to be
exactly the disjoint union of its input and output supports. The earlier
public-output counterexample is admitted at its real named support and is
kernel-rejected at two empty named boundaries. This is an atomic support
gate, not yet a compositional named-interface category or a proof that
plug/hide and restriction preserve native late-pi behaviour.

`P1cProductRuleProofBundle` supplies the first substantive non-identity
inhabitant of the fixed-epoch product gate. Its reference reconnect
occurrence changes the graph from no edges to `{(0, 1)}`. Four distinct
target wrappers carry independent DAG, individual-token Petri, native
standard-late-pi, and morphism business derivations. The event map is
bijective, every one of the four source events has a native target step, and
every target step reflects to a source step; no observation filter is used.
The same bundle carries the real endpoint-free `DPOEvent` replay, rank,
authorization, quiescence, a stable/fair window, external scheduling, and
probability-one business progress. A separate no-go theorem proves that the
one-shot completed package cannot itself support a positive event labelling,
so the explicit productive hold in the trajectory wrapper is necessary.
This is one reference reconnect rule, not an instantiation of the eight
production packages.

An adversarial implementation review retraced the P1b chain from the four
`SplitCommunication` constructors to `pi_ra_certificate`. It found no
transported or fabricated transition, circular endpoint premise, weak
closure, or observation filter. It additionally kernel-checked ordinary
sync and open/close representatives that exercise the slow alpha-freshening
path. The eight reviewed declarations depend only on `propext`,
`Classical.choice`, and `Quot.sound`. This is internal implementation
evidence, not one of the required non-author QA-L4 signatures. General
bound-output action labels also remain outside this closed-tau P1b result:
their binders do not yet have an action-level alpha quotient.

The complete dirty-worktree evidence gate was rerun after these additions:
283 Lean files, aggregate
`f5a7dac8603a2547772a4c9207e479b1139b8b0eabf0bda028e35cab153f13a1`,
root build success in 8938 jobs, zero forbidden proof placeholders, and 667
kernel dependency reports restricted to `propext`, `Classical.choice`, and
`Quot.sound`. The manifest remains 11 `implemented_unverified` and 7
`partial_scaffold`; no entry is `proved` or `reviewed`.

### Product and probability progress now kernel checked

`ProductRuleAdmission.certificate_uninhabited_fixed_signature_admission`
is built and confirms the legacy same-package signature-admission interface
is contradictory. `HeterogeneousProductRuleAdmission` is root imported and
built as the corrected separation of fixed-epoch occurrences from genuinely
heterogeneous four-target admissions.

`P1cAdmittedFourOccurrence.fixedOccurrence` now gives every concrete
admitted mismatch/reconnect/quiescent-delete occurrence one substantive
fixed-epoch record containing:

- a DAG target step;
- an enabled/fired individual-token Petri target step;
- a genuine native strong-late pi target step;
- a morphism target step;
- the exact source replay record; and
- four explicit target replay records.

This closes a nonempty fixed-epoch reference occurrence, not cross-epoch
signature admission. The latter still needs four projection families and
four native heterogeneous admission relations.

The authorized feedback reference now has a built five-state execution
package and Markov kernel. Its positive labelling retains event identity,
exact replay, state projection, and epoch alignment in the same common
trajectory, and its two strict evidence phases derive the probability-one
progress bound from that kernel. This is a concrete reference
`TrajectoryAgreement`; arbitrary product packages must still provide
authorization, conflict policy, stable-signature fairness, accepted strict
progress, and a positive epsilon.

### Complete FMS remains a foundational blocker

The dependency audit in
`docs/research/0007-fms-lean-dependency-audit-2026-07-26.md` found no
publicly indexed Lean package that supplies the required complete stack.
Pinned mathlib supplies omega-CPO and continuity foundations. `scott1972`
formalizes a genuine inverse-limit `D∞ ≅ [D∞ → D∞]` construction but not
`A ≅ P(H A)`. `iris-lean` supplies a COFE solver with different semantics;
using it would require an RFC/ADR change rather than a transparent import.

Therefore no local inhabitant exists for
`CompleteExternalFMSTheoremPackage`. The remaining construction still
includes the locally continuous strong commutative Abramsky powerdomain,
algebraic compactness/bilimits, the continuous natural recursive domain
isomorphism, complete hiding/coherence, operational adequacy,
domain-element definability, and full abstraction.

### Status and governance consequence

The manifest remains intentionally unchanged at 10
`implemented_unverified`, 8 `partial_scaffold`, 0 `proved`, and 0
`reviewed`. The ordinary evidence gate passes; `ci.ps1 -RequireComplete`
rejects all 18 entries because none has immutable commit-bound independent
review evidence. This is the correct result.

The next completion boundary is consequently:

1. finish the nominal P1b representative bridge;
2. construct the complete FMS package or obtain the explicit RFC-0002
   finite-control scope ruling;
3. instantiate heterogeneous admission and probability obligations for
   each production rule package;
4. create an immutable candidate commit and rerun the gate;
5. obtain the three independent QA-L4 reviews;
6. complete RFC-0002 FCP and record ADR-0001's accepted or rejected
   decision.

No local implementation can self-award the last three governance results.

## Nominal orbit and cross-epoch admission checkpoint (2026-07-26)

### P1b source orbit strengthened without weak transitions

`P1bRequestingNominalOrbit` is now root imported and kernel built. It adds
`Raw.Proc.freeOutputValues`, proves that interface invariant through every
`Late.Alpha` and `Late.Struct` constructor, and combines it with the existing
two-thread extraction. For every structural representative of the canonical
requesting process, `orbit_normal_form` produces:

- two actual `TwoCommThread` witnesses;
- a finite outer restriction context;
- proof that the unique free payload is not captured by that context; and
- proof that the payload occurs in an active output-value position in one of
  the two threads.

For every genuine `Late.NativeStep` selected from that orbit,
`native_step_orbit_constraints` proves that the action is `tau` and the exact
residual contains two prefixes, one send, and one receive. No `tau*`,
observational filter, or caller-supplied target classification is used.

`P1bTwoThreadNativeInversion` then performs the actual native-constructor
inversion on the extracted syntax. It proves that one sequential
`TwoCommThread` cannot make a native `tau`, locates a `tau` at the unique
two-thread split through restrictions, inactive parallel/choice siblings,
and substitution, and extracts two residual `OneCommThread` values up to
structural congruence. Its substitution lemma covers the slow freshening
branch when the residual input binder clashes with the replacement; it does
not assume the earlier `captureRisk = false` shortcut.

`P1bResidualTargetBoundary` also fixes the exact strength of the remaining
theorem. A representative of the form `canonicalRequesting | 0` has a real
native first handshake whose exact target is `canonicalEstablished | 0`.
That target is structurally canonical but cannot itself inhabit any
`LinkedEndpointForm`, because every exact linked endpoint starts with a
restriction. Therefore the pending theorem must existentially produce a
linked endpoint and relate the actual target to it by `Late.Struct`; exact
target syntax would be a false claim.

The remaining P1b proof is consequently narrower but still substantive:
classify the public/session/input-binder incidence inside the two extracted
threads, invert the arbitrary native synchronization or close rule through
the permitted contexts, parameterize the linked endpoint over alpha-renamed
bound names, and normalize the resulting endpoint through alpha, ACU,
`newComm`, scope extrusion, symmetry, and transitivity.

### Nonempty four-target heterogeneous admission reference

`FiniteExecutableEpochProjectionReference` now joins the previously separate
fixed-epoch projection and heterogeneous-runtime references. It constructs
one nonempty `FourTargetAdmissionBundle` containing, for each of DAG, Petri,
pi, and morphism:

- distinct dependent target state, event, and native-step types;
- separate old-signature and new-signature `ExecutionPackage`s;
- old-epoch and new-epoch `ProjectionCertificate`s;
- a strict cross-epoch target admission;
- exact `AdmissionReplays` evidence; and
- a native runtime edge at the mapped endpoints.

The pi constructor additionally stores the real unfiltered visible
registration input from `AdmissionCertificate`. The other three views remain
finite executable reference semantics, not production graph, pre-net, or
categorical models. The construction therefore closes non-vacuity and exact
cross-epoch replay for the reference bundle, while leaving coherent static
projection families and product rule/policy/probability evidence to the
actual product packages.

Independent read-only review confirmed that every fixed-epoch target edge is
observable and reflected, and that native admission evidence is independent
of replay evidence. It also identified the exact non-production boundary:
`runtime_native` forgets the static/pi evidence and is only a forward map;
the abstract pi target states are not related back to concrete process
endpoints by a reverse coherence theorem; all four replay values use the
same finite reference configurations; and target event labels do not recover
full admission metadata. These facts prevent promotion of the reference to a
production four-projection admission certificate.

## Labelled split, restriction envelope, and certificate anti-vacuity

The P1b residual chain now has a derivation-preserving split theorem rather
than only aggregate syntax metrics.

- `P1bLabelledThreadInversion` recursively inverts the actual native
  `syncLeft`, `syncRight`, `closeLeft`, and `closeRight` constructors. The
  resulting labelled cores retain subjects, output values, input binders,
  exact targets, and the slow capture-avoiding freshening witness.
- `P1bRequestingPolarityOrbit` proves the guarded send/send and receive/
  receive pair counts invariant under substitution, every alpha constructor,
  and every structural-congruence constructor. Its checked crossed-polarity
  example cannot belong to the canonical requesting orbit.
- `P1bRequestingThreadPolarityClassifier` pushes those global invariants into
  the extracted two threads. `P1bNativeSplitContext` then combines the actual
  native derivation with the two-thread normal form: source and target share
  one restriction list, the split is one of the four concrete native
  derivations, and its two threads have opposite send/send versus
  receive/receive polarity.
- `P1bRestrictionEnvelope` proves both pair-essential and single-essential
  binder decompositions, produces the fresh garbage list, and removes that
  garbage up to `Late.Struct`. Its close-left counterexample proves that a
  literal outer-list permutation to `[public, session]` is false after scope
  extrusion; the single-essential close form is required.
- `P1bRequestingReflectionClosure` proves
  `StandardLateReflection <-> RequestingNativeResidual <->
  RequestingUpToLinkedEndpointResidual` and constructs the final operational
  certificate from the last classifier. Checked counterexamples show that
  exact linked-endpoint syntax and the partial two-prefix/one-send/one-receive
  shape are both too strong or too weak, respectively.

Consequently rule selection, shared context, polarity, slow freshening,
restriction garbage, and endpoint normalization are no longer the P1b gap.
The remaining lemma must recover the public/session subjects, payload value,
and input binder from the polarized split and choose the corresponding
parameterized linked endpoint.

`P1bNominalIncidenceBoundary` makes that last step a single non-circular
interface indexed by the genuine `SplitCommunication`. It asks only for an
unknown restricted residual channel carrying the fixed free payload; it does
not mention the canonical established state or `LinkedEndpointForm`. The
kernel-checked closure theorem normalizes that unknown channel and input
binder and then derives the complete up-to-structure residual and projection
certificate. The interface itself is not yet inhabited, so this is a precise
boundary reduction rather than completion of P1b.

`P1bNominalIncidenceProof` now discharges the target-side mechanics behind
that boundary. It proves capture-avoiding substitution preserves the
one-thread free-subject witness, derives exact target receive/send counts for
input, output, and bound-output native steps, transports link counts and the
fixed free output value, and normalizes the residual one-prefix threads
structurally. The resulting `SplitSupportTransfer` package is sufficient for
nominal incidence, and
`requestingPolarizedNominalIncidence_of_splitSupportTransfer` proves the
implication without mentioning an established state or a linked endpoint.

`P1bNominalIncidenceClosure` now closes that source-to-target step by
inverting each genuine `syncLeft`, `syncRight`, `closeLeft`, and `closeRight`
`SplitCommunication`. Its kernel-built `requestingSplitSupportTransfer`
inhabits the previously open interface. The module then derives
`requestingPolarizedNominalIncidence`, exact `requestingNativeResidual`, full
`standardLateReflection`, and the unconditional `pi_ra_certificate` for the
unfiltered alpha/structural strong-late LTS. No weak transition or
observational filter is introduced.

This closes the P1b operational proof in the working tree and promotes
CENTRAL-13 only to `implemented_unverified`. A fresh complete local CI and
axiom audit pass; immutable commit-bound evidence and independent QA-L4
review are still required before `proved` or `reviewed` is permissible.
Complete FMS,
product-specific four-view certificates, FCP, and ADR acceptance remain
separate blockers to total theory closure.

`HeterogeneousProductRuleAdmissionReference` now supplies a complete value of
the corrected generic product certificate. It has a strict heterogeneous
admission, four extension-indexed identity projection families, faithful
arrow realizations and commuting step cells, a distinct ranked native
business rewrite, policy and authorization evidence, and a finite stochastic
bridge. After independent review, the first all-stable diagonal kernel was
rejected as too weak and replaced: ready is unstable, done is stable, and the
actual ready-to-done business rewrite has probability one. The constructor
name that accidentally matched the repository's forbidden-word scanner was
also renamed before the full gate.

This value proves interface inhabitation and non-circularity only. A later
strengthening makes the execution family signature-sensitive: the business
relation is impossible at the old signature and available at the new one.
Its replay kernel validates the recorded recipe and source configuration,
with kernel-checked rejection of a wrong rule and a wrong source. The four
view families nevertheless remain the same identity reference semantics.
The witness therefore still proves neither substantive
DAG/pre-net/pi/morphism semantics, general DPO replay, product authorization,
nor production trajectory agreement. Those remain product-supplied
obligations.

`ProductRuleProofBundle` now makes that product-supplied boundary executable
for any fixed epoch. A candidate contains only endpoints and an event; the
separate proof bundle must provide the source native step and replay, rank,
resource/session quiescence, native/reflection/replay evidence for all four
views, qualification, authorization, and the stable-window/fairness/positive-
epsilon scheduling package. The reference bundle is admitted, while an
otherwise matching submission explicitly missing rank is kernel-rejected.
This closes the generic gate, not the eight production-package instances.

The FMS finite-fragment audit now also has a genuine nonempty Hoare
omega-CPO: nonempty lower sets over a finite partial order, with continuous
principal embedding, union, lower direct image and flattening, plus the
finite functor and unit laws. This removes a local finite-powerdomain
scaffold gap but does not provide empty deadlock, separate divergence, an
all-omega-CPO Abramsky monad, algebraic compactness, the recursive agent
domain, or full abstraction; CENTRAL-12 therefore remains
`partial_scaffold`.

## Final integrated checkpoint (2026-07-26)

The later integrated state supersedes the intermediate “remaining P1b
lemma” wording above. `P1bNominalIncidenceClosure` inhabits that interface
for all four genuine split constructors, so the finite request/accept
operational residual theorem is implemented. The full local gate and
adversarial implementation review pass; immutable provenance and independent
QA-L4 review do not.

Three further kernel-built increments are present:

- `FMSCpoFiniteHoareMonad` is a genuine Monad with continuous Kleisli laws on
  finite omega-CPOs, but not the all-omega-CPO Abramsky/FMS package;
- `P1cProductRuleProofBundle` is a substantive non-identity reconnect bundle
  with four native views, full event reflection, replay, and epsilon-one
  scheduling evidence, but not a production-package family; and
- `OpenSMCNominalAtomBoundary` enforces exact named free support for atoms,
  but not compositional plug/hide adequacy.

The final dirty-worktree gate covers 283 Lean files at aggregate
`f5a7dac8603a2547772a4c9207e479b1139b8b0eabf0bda028e35cab153f13a1`,
8938 build jobs, and 667 allowlisted dependency reports. The completion gate
still rejects 11 `implemented_unverified` and 7 `partial_scaffold`
obligations. Complete FMS (or an accepted scope change), all production-rule
instances, immutable provenance, three independent reviews, FCP, and ADR
acceptance remain outstanding.

## Load-bearing-gap convergence checkpoint (2026-07-26, later working tree)

This checkpoint supersedes the finite-powerdomain and sort-only Open-pi
boundaries recorded above, but it does not change any obligation to
`proved` or `reviewed`.

Four additional kernel-built increments are now present:

- `FMSCpoOmegaScottPower` equips every mathlib omega-CPO with the topology
  generated by omega-chain ranges. It proves that every `ContinuousHom` is
  continuous for those topologies and constructs the closed-lower-set
  endofunctor, natural unit, multiplication, and all Monad laws on the full
  omega-CPO category. This is an unseparated Hoare/lower monad: its empty
  closed set is simultaneously the order bottom and choice zero. It is not
  the Abramsky free pointed-semilattice powerdomain and does not inhabit the
  FMS package.
- `FMSCpoOmegaScottStrength` adds a continuous cartesian Fubini component and
  continuous left/right candidate strength components on arbitrary pairs of
  omega-CPOs. Object-level naturality, pure/principal compatibility, swap
  symmetry, cartesian associativity, and an explicit right-oriented
  swap/Fubini/swap equality are kernel-built. Bundled categorical strength,
  multiplication/Fubini coherence, full unitor/associator diagrams,
  choice/deadlock distributivity, and the free semilattice universal
  property are still absent.
- `FMSCpoSeparatedLowerPower` and `FMSCpoScottClosedPower` isolate the
  separation obstruction rather than hiding it. Adding an outer bottom can
  distinguish divergence from embedded empty deadlock, but a multiplication
  that collapses every family containing divergence contradicts the monad
  unit already at returned deadlock. The all-omega-CPO Monad above therefore
  cannot be promoted to FMS merely by adjoining `WithBot`.
- `FMSCpoOmegaScottSeparatedNoGo` strengthens that warning for the exact
  naive transformer `T X = WithBot (OmegaScottPower X)`: the embedded empty
  family is below the embedded principal-divergence family. Monotonicity plus
  the right-unit instance at embedded deadlock and left-unit instance at
  outer divergence would force deadlock below divergence, contradicting the
  fresh-bottom separation. This rules out that map/unit choice, not every
  separated or Abramsky powerdomain construction.
- `OpenSMCActionAlpha` provides freshness-safe quotients for input and
  general bound-output labels together with their derivatives. Fresh
  renaming preserves genuine one-step standard late-pi derivations; an
  illegal bound output whose binder equals its channel is not identified
  with a legal open label.
- `CrossEpochProductFamily` composes an actual four-view signature admission
  with an actual new-epoch `ProductRuleProofBundle`. It produces four native
  admission edges, four native business paths, exact admission and
  `DPOEvent` replay, and dependent epoch chains with strict version
  boundaries. This is the general combination theorem once package-owned
  premises are supplied; it does not synthesize those premises.

A second kernel-built FMS increment strengthens the unseparated boundary
without changing its acceptance status:

- `FMSCpoOmegaScottStrongCoherence` proves the exact
  multiplication/Fubini interchange both elementwise and as an equality of
  continuous morphism composites. It also transports Fubini and the two
  candidate strengths to genuine components over mathlib's chosen binary
  products. Full chosen-product natural transformations, unitors, and all
  strength diagrams are not yet bundled.
- `FMSCpoOmegaScottWorldMonad` instantiates the actual Monad on the real
  nonconstant `World ⥤ ωCPO` support model. Unit and multiplication commute
  with every finite-world injection, the support map from world zero to one
  is proved non-surjective, and the object-level Fubini components form a
  natural transformation across world injections. This is a genuine
  nonconstant functor-category instance, not an FMS agent-domain solution.

The exact-name layer in `OpenSMCNamedComposition` also makes the remaining
Open-pi design choice explicit. Exact external support plus direct plug/hide
rejects both unit composites at any nonempty middle boundary, and the
current presented identity erases to raw zero, which neither realizes that
support nor takes a native late-pi step. A genuine named operational category
therefore needs an RFC-selected alpha-fresh wiring semantics, linear
one-shot forwarders, or guarded replication/recursion. The last option
exceeds the current finite-control calculus and is an existing RFC stop
condition.

`OpenSMCFiniteControlIdentityBoundary` sharpens that choice. Every
length-indexed structural strong-late or native trace from a fixed
finite-control `Raw.Proc` has length at most its initial `prefixCount`;
therefore no such process has arbitrarily long or coherent infinite native
runs. This excludes an arbitrarily reusable identity when every use consumes
at least one transition. A concrete two-step receive/send relay still has a
genuine native trace, so the theorem deliberately leaves a linear one-shot
category route open.

The product audit in
`0008-product-package-certificate-audit-2026-07-26.md` found no package
source tree, manifest, rule inventory, or package-owned proof input for any
of the eight planned distributions. It is consequently impossible to
instantiate their DAG, pre-net, morphism, admission, resource/session,
authorization, fairness/stable-window, rank, and positive-epsilon evidence
without inventing product semantics that the repository deliberately has
not frozen.

Finally, `0009-fms-source-theorem-scope-audit-2026-07-26.md` separates source
claims from Cantilune additions. FMS requires the powerdomain, pointwise
lift, initial recursive solution, restriction/action coherence, process
denotation, and process-pair full abstraction. General algebraic compactness
is one possible stronger local construction route, while
all-domain-element definability is not a theorem stated by the checked FMS
sources. Divergence/deadlock disequality, exact per-label one-step
soundness/completeness, and the strong observation inverse-image laws are
additional Cantilune acceptance conditions.

The settled working tree passed the fresh complete ordinary gate: 305 Lean
files at aggregate
`5cfe4d74d579ed94bcc2d2c7eb3dc2584972e0c7026ec161154be77c986b0b3b`,
8960 build jobs, zero forbidden proof placeholders, and 804 dependency
reports restricted to `propext`, `Classical.choice`, and `Quot.sound`.
`ci.ps1 -RequireComplete` separately exited 1, correctly listing 11
`implemented_unverified` and 7 `partial_scaffold` obligations. The exact
record is
`formal/build-evidence/2026-07-26-fms-openpi-crossepoch-root.md`.

This dirty-tree gate cannot supply immutable provenance, independent QA-L4
signatures, an FCP decision, or ADR acceptance.

## FMS name-abstraction checkpoint (2026-07-26, independent review)

`FMSCpoInputTransport` and `FMSCpoNameAbstractionFunctor` close one exact
world-indexed FMS construction that was previously only implicit.  For every
covariant model `X : World ⥤ ωCPO`, they construct the genuine endofunctor

`B X(n) = (Fin n → X(n)) × X(n + 1)`

on the full functor category.  A finite-world injection transports an input
continuation by selecting its old branch when the target name is in the old
image, and otherwise by the unique injection extending the old world with
that target name as the distinguished fresh name.  The extension equations,
uniqueness, identity, composition, naturality in `X`, continuity of every
component, and both world- and model-level functor laws are kernel-checked.

Independent review confirmed the covariant injection direction and both
composition residuals: an intermediate fresh name composes by
`extendByName left middle ≫ right`, while a name fresh even at the
intermediate world composes by
`successorWorld.map left ≫ extendByName right name`.  The four targeted
modules build, and the twelve audited declarations depend only on
`propext`, `Classical.choice`, and `Quot.sound`.

This checkpoint closes only the name-abstraction summand `B`.  It does not
construct the complete action functor `H`, a separated Abramsky powerdomain,
the recursive continuous-natural domain solution `A ≅ P(H A)`,
allocation/hiding coherence, adequacy, definability, or full abstraction.
CENTRAL-12 therefore remains `partial_scaffold`; immutable provenance and
independent governance review also remain outstanding.

## Exact-action, finite-chain, and recursive-boundary checkpoint (2026-07-26)

This checkpoint supersedes the preceding statement that the complete action
functor `H` was absent.  It does not claim that the complete FMS model now
exists.

The following additional results are kernel-built:

- `FMSCpoActionFunctor` constructs the exact nonconstant FMS action shape on
  `World ⥤ ωCPO`,
  `N × B X + (N × N) × X + N × X(n+1) + X`, with its world and model maps.
  `FMSCpoActionLocallyContinuous` proves that this actual endofunctor is
  locally continuous.
- `FMSCpoOmegaScottChosenCoherence` bundles the already constructed
  unseparated lower/Hoare monad with chosen-product Fubini and strength and
  proves naturality, both unitors, associativity, symmetry, and
  multiplication coherence.  `FMSCpoOmegaScottLocallyContinuous` proves
  local continuity of the power endofunctor and of the concrete composite
  `P ∘ H`.
- `FMSCpoOmegaScottFreeCompleteJoin` proves a genuine universal extension
  theorem into complete-lattice targets whose morphisms preserve arbitrary
  suprema.  Every closed lower computation is the arbitrary supremum of its
  principal family, so such an extension is unique.  The
  arbitrary-`sSup`-preservation premise is load-bearing: this theorem is not
  the free pointed continuous-semilattice property required by the Abramsky
  powerdomain, and the construction still identifies order bottom with empty
  deadlock.
- `FMSCpoFiniteApproximationTower` constructs the finite initial chain
  `0 → F 0 → F² 0 → ...`.  Its seed has no retraction and its first two
  stages are not isomorphic.  Therefore the current chain is not silently an
  embedding-projection bilimit or a recursive-domain solution.
- `FMSCpoActualDomainEquationBoundary` fixes the recursive functor to this
  actual `P ∘ H`.  A proof-carrying input may supply a continuous natural
  isomorphism `A ≅ P(H A)`, an initial algebra, and a terminal coalgebra; the
  module then derives fold/unfold naturality, Lambek isomorphism evidence,
  and a conditional transport to `AgentDomainSolution`.  No inhabitant of
  that input, of `CpoPowerdomainPackage`, or of the complete FMS acceptance
  package is constructed.

The named operational layer is also sharper:

- `OpenSMCAlphaTransitionQuotient` retains actual standard late-pi steps
  while quotienting general bound-output labels and derivatives by
  freshness-safe alpha renaming.
- `OpenSMCContextualBoundaryCategory` supplies an actual category for
  contextual named boundary programs, and
  `OpenSMCContextualPartialTensor` supplies a proof-carrying disjoint partial
  tensor with the expected pure interchange equations.
- Kernel no-go theorems show that alpha-renaming of bound names alone cannot
  repair a nonempty plug identity, non-injective name fusion destroys
  mismatch behaviour, and unrestricted contextual tensor interchange fails.
  A total operational symmetric monoidal category therefore still needs a
  new polarized free-name wire/alias primitive or an RFC-approved extension
  of the finite-control syntax.

For general products, `FiniteCrossEpochProductChain` composes any finite
sequence of supplied certified rows.  It preserves all five replay chains,
fixed rule labels, typed admission labels, strict signature boundaries, and
execution epochs.  `FiniteCrossEpochProductTrajectory` couples the five
canonical paths on the source probability space while retaining each
dependent source event, four native projection derivations, and exact replay.
The direct `FMSGatedFiniteCrossEpochProductChain` adapter retains both the
rule and admission FMS transitions for one actual row.  Adversarial review
found that it must not be described as a direct multi-row theorem: an
adapter's after epoch contains one business event, whereas every next direct
before epoch is empty, so the dependent middle records cannot agree.
Moreover the row-wise record does not fix one common FMS package or store a
denotational endpoint-stitching equation.  A kernel theorem now records the
event-count obstruction explicitly.

The arbitrary finite operational five-view theorem remains valid for already
supplied exact boundaries; the direct FMS gate is one-row only.  Neither is a
production inhabitant.  The
repository still contains no package-owned rule inventories for the eight
planned distributions, so their DAG/Petri/morphism admission, rank,
resource/session, authorization, fairness, stable-window, and positive-
epsilon evidence cannot be constructed without inventing product semantics.
The complete separated powerdomain, recursive-domain inhabitant,
hiding/coherence, adequacy, process-pair full abstraction, immutable
provenance, independent QA-L4 signatures, FCP, and ADR acceptance remain
open.  CENTRAL-12 and CENTRAL-18 therefore remain `partial_scaffold`.

## 2026-07-27: unconditional bilimit and alpha closures

This checkpoint supersedes the earlier historical statements in this log
that the concrete bilimit and recursive substitution records had no
inhabitants. The current kernel-checked boundary is:

- `FMSCpoConcreteBilimitExhaustivity` constructs the canonical finite-stage
  maps, their projection/diagonal/successor equations, monotone limit and
  unfold approximants, and pointwise omega-exhaustion. It unconditionally
  inhabits `ConcreteBilimitExhaustivity` and constructs
  `concreteActualFixedPointWitness`, a continuous natural isomorphism
  `A ≅ P(H A)` for the actual **unseparated omega-Scott** functor. This is a
  fixed point only: it supplies neither initial-algebra/terminal-coalgebra
  evidence nor algebraic compactness, and it is not the separated Abramsky
  powerdomain required by the original FMS acceptance target.
- `LateGuardedReplicationAlphaSubstitutionCongruence` and its closure module
  construct the common-fresh normalizers and the combined depth/alpha
  induction. They unconditionally inhabit
  `RecursiveAlpha.SubstitutionCongruent` and prove genuine one-step
  permutation closure for every recursive native transition constructor,
  including sync and close, without a tau-star or observation filter.
- the actual unseparated omega-Scott world monad has `powerHiding`.
  Allocation, unit, multiplication, and chosen Fubini commute with hiding,
  and the concrete support denotation has an effectful
  allocate/denote/hide retraction. This is monadic support coherence, not an
  agent-domain restriction or an adequacy/full-abstraction theorem.
- `FMSCpoPowerdomainPackageCoherenceNoGo.no_distinguishedFubiniStrictness`
  is representation-independent: separated divergence/deadlock,
  commutative Fubini, and first-input strictness at both distinguished
  constants are jointly inconsistent. It does not depend on a finite
  powerset representation and does **not** refute a genuine Abramsky
  construction that does not impose that strengthened combination.

The aggregate regression import builds in the mutable tree, and the new
declarations use only the recorded kernel principles. CENTRAL-12 remains
`partial_scaffold`: still absent are a source-compatible separated Abramsky
package, algebraic compactness, complete agent restriction, adequacy,
definability, and full abstraction. Completion also remains blocked by the
RFC-selected named-boundary/FMS semantics and the absent production-owned
rule and randomized-kernel facts.
