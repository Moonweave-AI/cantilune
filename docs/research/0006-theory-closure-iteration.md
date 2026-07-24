# Theory closure iteration: kernel-built gains and remaining boundaries

Status: implementation evidence; not QA-L4 approval  
Date: 2026-07-23  
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
