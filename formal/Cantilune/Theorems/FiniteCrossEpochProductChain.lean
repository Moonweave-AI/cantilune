import Cantilune.Theorems.CrossEpochProductFamily

/-!
# Finite composition of certified cross-epoch product cells

This module is a conditional composition layer.  It does not construct a
product-package certificate.  Its input is a finite indexed chain whose every
epoch already contains one source replay epoch, four projected replay epochs,
the four operational projections, exact endpoint equations, and exact
event-list equations.  Every boundary is already an `AdjacentAdmission` in
all five views.

The indexed presentation is intentional.  The middle endpoint of two
consecutive cells is definitionally shared, so no heterogeneous package or
event type is erased to an untyped list.

The adapter at the end constructs one row directly from
`CrossEpochProductFamily`.  Independently packaged rows do not concatenate
merely because their epoch numbers match: the caller must provide the exact
shared middle `FourProjectionReplayEpoch` (or an equality to it), including
the source/four endpoint and event equations.
-/

namespace Cantilune.Theorems

open Cantilune.Core
open Cantilune.Core.ExecutionEpochTrace

universe u

/--
One fixed-signature epoch together with its four exact operational images.

The event equations are about the actual `ProjectionCertificate.mapEvent`
functions.  Thus a caller cannot replace event preservation by equality of
unrelated booleans or by an unlabelled reachability claim.
-/
structure FourProjectionReplayEpoch where
  source : SomeReplayEpoch
  dag : SomeReplayEpoch
  petri : SomeReplayEpoch
  pi : SomeReplayEpoch
  morphism : SomeReplayEpoch
  dagProjection :
    ProjectionCertificate source.package.lts dag.package.lts
  petriProjection :
    ProjectionCertificate source.package.lts petri.package.lts
  piProjection :
    ProjectionCertificate source.package.lts pi.package.lts
  morphismProjection :
    ProjectionCertificate source.package.lts morphism.package.lts
  dagExecutionEpoch :
    dag.epoch.executionEpoch = source.epoch.executionEpoch
  petriExecutionEpoch :
    petri.epoch.executionEpoch = source.epoch.executionEpoch
  piExecutionEpoch :
    pi.epoch.executionEpoch = source.epoch.executionEpoch
  morphismExecutionEpoch :
    morphism.epoch.executionEpoch = source.epoch.executionEpoch
  dagSource :
    dag.epoch.source =
      dagProjection.mapState source.epoch.source
  dagTarget :
    dag.epoch.target =
      dagProjection.mapState source.epoch.target
  dagEvents :
    dag.epoch.events =
      source.epoch.events.map dagProjection.mapEvent
  petriSource :
    petri.epoch.source =
      petriProjection.mapState source.epoch.source
  petriTarget :
    petri.epoch.target =
      petriProjection.mapState source.epoch.target
  petriEvents :
    petri.epoch.events =
      source.epoch.events.map petriProjection.mapEvent
  piSource :
    pi.epoch.source =
      piProjection.mapState source.epoch.source
  piTarget :
    pi.epoch.target =
      piProjection.mapState source.epoch.target
  piEvents :
    pi.epoch.events =
      source.epoch.events.map piProjection.mapEvent
  morphismSource :
    morphism.epoch.source =
      morphismProjection.mapState source.epoch.source
  morphismTarget :
    morphism.epoch.target =
      morphismProjection.mapState source.epoch.target
  morphismEvents :
    morphism.epoch.events =
      source.epoch.events.map morphismProjection.mapEvent

namespace FourProjectionReplayEpoch

/-- Exact preservation of the four event-label lists at one epoch. -/
structure EventAgreement (epoch : FourProjectionReplayEpoch) : Prop where
  dag :
    epoch.dag.epoch.events =
      epoch.source.epoch.events.map epoch.dagProjection.mapEvent
  petri :
    epoch.petri.epoch.events =
      epoch.source.epoch.events.map epoch.petriProjection.mapEvent
  pi :
    epoch.pi.epoch.events =
      epoch.source.epoch.events.map epoch.piProjection.mapEvent
  morphism :
    epoch.morphism.epoch.events =
      epoch.source.epoch.events.map epoch.morphismProjection.mapEvent

/-- The stored equations immediately yield the public event agreement. -/
theorem eventAgreement (epoch : FourProjectionReplayEpoch) :
    EventAgreement epoch where
  dag := epoch.dagEvents
  petri := epoch.petriEvents
  pi := epoch.piEvents
  morphism := epoch.morphismEvents

end FourProjectionReplayEpoch

/--
Typed preservation of one heterogeneous admission label in four target views.

The four maps and five event values are data.  The equalities rule out
replacing the source admission by an unrelated target label.
-/
structure FourAdmissionEventMapping where
  SourceEvent : Type
  DagEvent : Type
  PetriEvent : Type
  PiEvent : Type
  MorphismEvent : Type
  sourceEvent : SourceEvent
  dagEvent : DagEvent
  petriEvent : PetriEvent
  piEvent : PiEvent
  morphismEvent : MorphismEvent
  dagMap : SourceEvent → DagEvent
  petriMap : SourceEvent → PetriEvent
  piMap : SourceEvent → PiEvent
  morphismMap : SourceEvent → MorphismEvent
  dagCommutes : dagMap sourceEvent = dagEvent
  petriCommutes : petriMap sourceEvent = petriEvent
  piCommutes : piMap sourceEvent = piEvent
  morphismCommutes : morphismMap sourceEvent = morphismEvent

namespace FourAdmissionEventMapping

/-- Public proposition exposing all four typed admission-label equations. -/
structure Agreement (mapping : FourAdmissionEventMapping) : Prop where
  dag : mapping.dagMap mapping.sourceEvent = mapping.dagEvent
  petri : mapping.petriMap mapping.sourceEvent = mapping.petriEvent
  pi : mapping.piMap mapping.sourceEvent = mapping.piEvent
  morphism :
    mapping.morphismMap mapping.sourceEvent = mapping.morphismEvent

theorem agreement (mapping : FourAdmissionEventMapping) :
    Agreement mapping where
  dag := mapping.dagCommutes
  petri := mapping.petriCommutes
  pi := mapping.piCommutes
  morphism := mapping.morphismCommutes

end FourAdmissionEventMapping

/--
One synchronized signature boundary in the source and all four projections.

All five fields are genuine `AdjacentAdmission`s and therefore contain
endpoint-free admission replay proofs and strict version advancement.
-/
structure FiveViewBoundary
    (universes : ProjectionUniverses)
    (before after : FourProjectionReplayEpoch) where
  source :
    AdjacentAdmission universes before.source after.source
  dag :
    AdjacentAdmission universes before.dag after.dag
  petri :
    AdjacentAdmission universes before.petri after.petri
  pi :
    AdjacentAdmission universes before.pi after.pi
  morphism :
    AdjacentAdmission universes before.morphism after.morphism
  admissionEvents : FourAdmissionEventMapping

namespace FiveViewBoundary

/-- Every component of a synchronized boundary strictly advances version. -/
structure VersionsStrict
    {universes : ProjectionUniverses}
    {before after : FourProjectionReplayEpoch}
    (boundary : FiveViewBoundary universes before after) : Prop where
  source :
    before.source.epoch.executionEpoch <
      after.source.epoch.executionEpoch
  dag :
    before.dag.epoch.executionEpoch <
      after.dag.epoch.executionEpoch
  petri :
    before.petri.epoch.executionEpoch <
      after.petri.epoch.executionEpoch
  pi :
    before.pi.epoch.executionEpoch <
      after.pi.epoch.executionEpoch
  morphism :
    before.morphism.epoch.executionEpoch <
      after.morphism.epoch.executionEpoch

/-- Strictness is derived from the five certified admissions. -/
theorem versionsStrict
    {universes : ProjectionUniverses}
    {before after : FourProjectionReplayEpoch}
    (boundary : FiveViewBoundary universes before after) :
    VersionsStrict boundary where
  source := boundary.source.execution_epoch_strict
  dag := boundary.dag.execution_epoch_strict
  petri := boundary.petri.execution_epoch_strict
  pi := boundary.pi.execution_epoch_strict
  morphism := boundary.morphism.execution_epoch_strict

end FiveViewBoundary

/--
A finite nonempty chain of already-certified cross-epoch cells.

The `cons` constructor enforces the adjacent endpoint equation by sharing the
same `middle` index between the boundary and the tail.  This is stronger than
an erased equality between runtime identifiers.
-/
inductive FiniteCrossEpochProductChain
    (universes : ProjectionUniverses) :
    FourProjectionReplayEpoch →
      FourProjectionReplayEpoch → Type 2
  | single (epoch : FourProjectionReplayEpoch) :
      FiniteCrossEpochProductChain universes epoch epoch
  | cons {first middle last : FourProjectionReplayEpoch} :
      FiveViewBoundary universes first middle →
      FiniteCrossEpochProductChain universes middle last →
      FiniteCrossEpochProductChain universes first last

namespace FiniteCrossEpochProductChain

variable {universes : ProjectionUniverses}
variable {first last : FourProjectionReplayEpoch}

/--
Prepend a cell when independently constructed endpoint records are proved
equal.  The equality transports all five package-indexed epoch types and all
four event-map equations together.
-/
def consOfEndpointEq
    {middle nextFirst : FourProjectionReplayEpoch}
    (boundary : FiveViewBoundary universes first middle)
    (endpoint : middle = nextFirst)
    (tail : FiniteCrossEpochProductChain universes nextFirst last) :
    FiniteCrossEpochProductChain universes first last := by
  subst nextFirst
  exact .cons boundary tail

/-- Forget only the four projected components, retaining the dependent source chain. -/
def sourceChain :
    {first last : FourProjectionReplayEpoch} →
      FiniteCrossEpochProductChain universes first last →
        EpochChain universes first.source last.source
  | _, _, .single epoch =>
      .single epoch.source
  | _, _, .cons boundary tail =>
      .cons boundary.source
        (sourceChain tail)

/-- The DAG dependent epoch chain. -/
def dagChain :
    {first last : FourProjectionReplayEpoch} →
      FiniteCrossEpochProductChain universes first last →
        EpochChain universes first.dag last.dag
  | _, _, .single epoch =>
      .single epoch.dag
  | _, _, .cons boundary tail =>
      .cons boundary.dag
        (dagChain tail)

/-- The Petri dependent epoch chain. -/
def petriChain :
    {first last : FourProjectionReplayEpoch} →
      FiniteCrossEpochProductChain universes first last →
        EpochChain universes first.petri last.petri
  | _, _, .single epoch =>
      .single epoch.petri
  | _, _, .cons boundary tail =>
      .cons boundary.petri
        (petriChain tail)

/-- The π dependent epoch chain. -/
def piChain :
    {first last : FourProjectionReplayEpoch} →
      FiniteCrossEpochProductChain universes first last →
        EpochChain universes first.pi last.pi
  | _, _, .single epoch =>
      .single epoch.pi
  | _, _, .cons boundary tail =>
      .cons boundary.pi
        (piChain tail)

/-- The morphism dependent epoch chain. -/
def morphismChain :
    {first last : FourProjectionReplayEpoch} →
      FiniteCrossEpochProductChain universes first last →
        EpochChain universes first.morphism last.morphism
  | _, _, .single epoch =>
      .single epoch.morphism
  | _, _, .cons boundary tail =>
      .cons boundary.morphism
        (morphismChain tail)

/-- Replay agreement for the source and all four projections. -/
structure ReplayAgreement
    (chain : FiniteCrossEpochProductChain universes first last) : Prop where
  source : EpochChain.ReplayAgreement chain.sourceChain
  dag : EpochChain.ReplayAgreement chain.dagChain
  petri : EpochChain.ReplayAgreement chain.petriChain
  pi : EpochChain.ReplayAgreement chain.piChain
  morphism : EpochChain.ReplayAgreement chain.morphismChain

/-- Every fixed epoch and every heterogeneous boundary replays exactly. -/
theorem completeReplayAgreement
    (chain : FiniteCrossEpochProductChain universes first last) :
    ReplayAgreement chain where
  source := chain.sourceChain.complete_replay_agreement
  dag := chain.dagChain.complete_replay_agreement
  petri := chain.petriChain.complete_replay_agreement
  pi := chain.piChain.complete_replay_agreement
  morphism := chain.morphismChain.complete_replay_agreement

/-- Pointwise strictness evidence for every boundary in a finite chain. -/
inductive AllBoundariesStrict :
    {first last : FourProjectionReplayEpoch} →
      FiniteCrossEpochProductChain universes first last → Prop
  | single (epoch : FourProjectionReplayEpoch) :
      AllBoundariesStrict (.single epoch)
  | cons {first middle last : FourProjectionReplayEpoch}
      (boundary : FiveViewBoundary universes first middle)
      (tail : FiniteCrossEpochProductChain universes middle last) :
      FiveViewBoundary.VersionsStrict boundary →
      AllBoundariesStrict tail →
      AllBoundariesStrict (.cons boundary tail)

/-- Every boundary is strict because every cell contains real admissions. -/
theorem allBoundariesStrict
    (chain : FiniteCrossEpochProductChain universes first last) :
    AllBoundariesStrict chain := by
  induction chain with
  | single epoch =>
      exact .single epoch
  | cons boundary tail ih =>
      exact .cons boundary tail boundary.versionsStrict ih

/-- Exact source-to-view event mapping at every epoch in the chain. -/
inductive AllEventMarksPreserved :
    {first last : FourProjectionReplayEpoch} →
      FiniteCrossEpochProductChain universes first last → Prop
  | single (epoch : FourProjectionReplayEpoch) :
      FourProjectionReplayEpoch.EventAgreement epoch →
      AllEventMarksPreserved (.single epoch)
  | cons {first middle last : FourProjectionReplayEpoch}
      (boundary : FiveViewBoundary universes first middle)
      (tail : FiniteCrossEpochProductChain universes middle last) :
      FourProjectionReplayEpoch.EventAgreement first →
      AllEventMarksPreserved tail →
      AllEventMarksPreserved (.cons boundary tail)

/--
No rule event is erased while composing cells: each projected event list is
still the pointwise image of the exact source event list.
-/
theorem allEventMarksPreserved
    (chain : FiniteCrossEpochProductChain universes first last) :
    AllEventMarksPreserved chain := by
  induction chain with
  | single epoch =>
      exact .single epoch epoch.eventAgreement
  | @cons first middle last boundary tail ih =>
      exact .cons boundary tail first.eventAgreement ih

/-- Exact typed admission-label mapping at every heterogeneous boundary. -/
inductive AllAdmissionMarksPreserved :
    {first last : FourProjectionReplayEpoch} →
      FiniteCrossEpochProductChain universes first last → Prop
  | single (epoch : FourProjectionReplayEpoch) :
      AllAdmissionMarksPreserved (.single epoch)
  | cons {first middle last : FourProjectionReplayEpoch}
      (boundary : FiveViewBoundary universes first middle)
      (tail : FiniteCrossEpochProductChain universes middle last) :
      FourAdmissionEventMapping.Agreement boundary.admissionEvents →
      AllAdmissionMarksPreserved tail →
      AllAdmissionMarksPreserved (.cons boundary tail)

/-- No admission boundary may substitute an unrelated target event label. -/
theorem allAdmissionMarksPreserved
    (chain : FiniteCrossEpochProductChain universes first last) :
    AllAdmissionMarksPreserved chain := by
  induction chain with
  | single epoch =>
      exact .single epoch
  | cons boundary tail ih =>
      exact
        .cons boundary tail boundary.admissionEvents.agreement ih

/-- The complete conditional finite-composition result. -/
structure CompleteAgreement
    (chain : FiniteCrossEpochProductChain universes first last) : Prop where
  replay : ReplayAgreement chain
  strict : AllBoundariesStrict chain
  events : AllEventMarksPreserved chain
  admissions : AllAdmissionMarksPreserved chain

/--
Arbitrarily many supplied certified cells compose without losing dependent
package types, replay equations, strict version advancement, or event labels.
-/
theorem composeComplete
    (chain : FiniteCrossEpochProductChain universes first last) :
    CompleteAgreement chain where
  replay := chain.completeReplayAgreement
  strict := chain.allBoundariesStrict
  events := chain.allEventMarksPreserved
  admissions := chain.allAdmissionMarksPreserved

end FiniteCrossEpochProductChain

/-! ## Adapter from one certified product-family row -/

namespace CrossEpochProductFamily

open Cantilune.Feedback.StochasticExecution.FiniteDiscrete
open Cantilune.Theorems.ProductRuleProofBundle
open Cantilune.Theorems.HeterogeneousProductRuleAdmission

universe v w

variable
    {SourceCategory DagCategory PetriCategory PiCategory MorphismCategory :
      Type u}
    [CategoryTheory.Category.{v} SourceCategory]
    [CategoryTheory.MonoidalCategory SourceCategory]
    [CategoryTheory.SymmetricCategory SourceCategory]
    [CategoryTheory.Category.{v} DagCategory]
    [CategoryTheory.MonoidalCategory DagCategory]
    [CategoryTheory.SymmetricCategory DagCategory]
    [CategoryTheory.Category.{v} PetriCategory]
    [CategoryTheory.MonoidalCategory PetriCategory]
    [CategoryTheory.SymmetricCategory PetriCategory]
    [CategoryTheory.Category.{v} PiCategory]
    [CategoryTheory.MonoidalCategory PiCategory]
    [CategoryTheory.SymmetricCategory PiCategory]
    [CategoryTheory.Category.{v} MorphismCategory]
    [CategoryTheory.MonoidalCategory MorphismCategory]
    [CategoryTheory.SymmetricCategory MorphismCategory]
    {source : ReindexableExecutionFamily}
    {dagFamily :
      ProjectionFamilyOver SourceCategory DagCategory source}
    {petriFamily :
      ProjectionFamilyOver SourceCategory PetriCategory source}
    {piFamily :
      ProjectionFamilyOver SourceCategory PiCategory source}
    {morphismFamily :
      ProjectionFamilyOver SourceCategory MorphismCategory source}
    {universes : ProjectionUniverses}
    {oldSignature newSignature : FinSignature}
    {admission :
      SignatureAdmissionEvent universes
        (source := oldSignature) (target := newSignature)}
    {sourceSemantics :
      HeterogeneousAdmissionLTS
        (source.package oldSignature)
        (source.package newSignature)}
    {sourceOccurrence :
      HeterogeneousPackageAdmission
        (source.package oldSignature)
        (source.package newSignature)
        sourceSemantics admission}
    {signatureCertificate :
      FourCoherentFamilyAdmission
        SourceCategory DagCategory PetriCategory PiCategory MorphismCategory
        source dagFamily petriFamily piFamily morphismFamily
        admission sourceSemantics sourceOccurrence}
    {KernelState : Type w} [Fintype KernelState] [DecidableEq KernelState]
    {kernel :
      NativeMarkovKernel newSignature
        (source.package newSignature) KernelState}
    {initial : InitialDistribution KernelState}
    {epsilon : Real}
    {RuleQualified RuleAuthorized :
      (source.package newSignature).lts.State →
        (source.package newSignature).lts.Event →
        (source.package newSignature).lts.State → Prop}
    {candidate : Candidate (source.package newSignature)}

variable
    (family :
      CrossEpochProductFamily
        SourceCategory DagCategory PetriCategory PiCategory MorphismCategory
        source dagFamily petriFamily piFamily morphismFamily
        admission sourceSemantics sourceOccurrence signatureCertificate
        kernel initial epsilon RuleQualified RuleAuthorized candidate)

include family

/-- Source-side empty replay epoch immediately before the certified admission. -/
def sourceBeforeEpoch :
    ReplayEpoch (source.package oldSignature) where
  executionEpoch := admission.fromVersion
  source := sourceOccurrence.beforeState
  target := sourceOccurrence.beforeState
  events := []
  path := .nil _
  source_epoch := sourceOccurrence.replays.1

/-- Source-side one-rule replay epoch immediately after the admission. -/
def sourceAfterEpoch :
    ReplayEpoch (source.package newSignature) where
  executionEpoch := admission.toVersion
  source := candidate.before
  target := candidate.after
  events := [candidate.event]
  path :=
    .cons
      (CrossEpochProductFamily.ruleBundle family).sourceOccurrence.native
      (.nil candidate.after)
  source_epoch :=
    (CrossEpochProductFamily.source_replay_chain family).1.target_version

/-- Existential package for the source epoch before admission. -/
def sourceBeforeSomeEpoch : SomeReplayEpoch where
  signature := oldSignature
  package := source.package oldSignature
  epoch :=
    sourceBeforeEpoch
      (admission := admission)
      (sourceSemantics := sourceSemantics)
      (sourceOccurrence := sourceOccurrence)

/-- Existential package for the source epoch after admission. -/
def sourceAfterSomeEpoch : SomeReplayEpoch where
  signature := newSignature
  package := source.package newSignature
  epoch := sourceAfterEpoch family

/--
The exact five-view row before admission.  All event lists are empty and all
four target endpoints are definitionally the mapped source endpoint.
-/
def beforeReplayEpoch :
    FourProjectionReplayEpoch where
  source :=
    sourceBeforeSomeEpoch
      (admission := admission)
      (sourceSemantics := sourceSemantics)
      (sourceOccurrence := sourceOccurrence)
  dag := (CrossEpochProductFamily.dagTrace family).beforeSomeEpoch
  petri := (CrossEpochProductFamily.petriTrace family).beforeSomeEpoch
  pi := (CrossEpochProductFamily.piTrace family).beforeSomeEpoch
  morphism := (CrossEpochProductFamily.morphismTrace family).beforeSomeEpoch
  dagProjection := dagFamily.operational oldSignature
  petriProjection := petriFamily.operational oldSignature
  piProjection := piFamily.operational oldSignature
  morphismProjection := morphismFamily.operational oldSignature
  dagExecutionEpoch := rfl
  petriExecutionEpoch := rfl
  piExecutionEpoch := rfl
  morphismExecutionEpoch := rfl
  dagSource := rfl
  dagTarget := rfl
  dagEvents := rfl
  petriSource := rfl
  petriTarget := rfl
  petriEvents := rfl
  piSource := rfl
  piTarget := rfl
  piEvents := rfl
  morphismSource := rfl
  morphismTarget := rfl
  morphismEvents := rfl

/--
The exact five-view row after admission.  Each target event list is the
singleton image of the source rule event under its real operational
projection.
-/
def afterReplayEpoch :
    FourProjectionReplayEpoch where
  source := sourceAfterSomeEpoch family
  dag := (CrossEpochProductFamily.dagTrace family).afterSomeEpoch
  petri := (CrossEpochProductFamily.petriTrace family).afterSomeEpoch
  pi := (CrossEpochProductFamily.piTrace family).afterSomeEpoch
  morphism := (CrossEpochProductFamily.morphismTrace family).afterSomeEpoch
  dagProjection := dagFamily.operational newSignature
  petriProjection := petriFamily.operational newSignature
  piProjection := piFamily.operational newSignature
  morphismProjection := morphismFamily.operational newSignature
  dagExecutionEpoch := rfl
  petriExecutionEpoch := rfl
  piExecutionEpoch := rfl
  morphismExecutionEpoch := rfl
  dagSource := rfl
  dagTarget := rfl
  dagEvents := rfl
  petriSource := rfl
  petriTarget := rfl
  petriEvents := rfl
  piSource := rfl
  piTarget := rfl
  piEvents := rfl
  morphismSource := rfl
  morphismTarget := rfl
  morphismEvents := rfl

/-- One actual `CrossEpochProductFamily` row supplies a synchronized cell. -/
def toFiveViewBoundary :
    FiveViewBoundary universes
      (beforeReplayEpoch family) (afterReplayEpoch family) where
  source :=
    { admission := admission
      replays := (CrossEpochProductFamily.source_replay_chain family).1 }
  dag := (CrossEpochProductFamily.dagTrace family).adjacentAdmission
  petri := (CrossEpochProductFamily.petriTrace family).adjacentAdmission
  pi := (CrossEpochProductFamily.piTrace family).adjacentAdmission
  morphism :=
    (CrossEpochProductFamily.morphismTrace family).adjacentAdmission
  admissionEvents :=
    { SourceEvent := sourceSemantics.Event
      DagEvent := signatureCertificate.dagSemantics.Event
      PetriEvent := signatureCertificate.petriSemantics.Event
      PiEvent := signatureCertificate.piSemantics.Event
      MorphismEvent := signatureCertificate.morphismSemantics.Event
      sourceEvent := sourceSemantics.eventOf admission
      dagEvent := signatureCertificate.dagSemantics.eventOf admission
      petriEvent := signatureCertificate.petriSemantics.eventOf admission
      piEvent := signatureCertificate.piSemantics.eventOf admission
      morphismEvent :=
        signatureCertificate.morphismSemantics.eventOf admission
      dagMap :=
        signatureCertificate.dag.admissionProjection.mapAdmissionEvent
      petriMap :=
        signatureCertificate.petri.admissionProjection.mapAdmissionEvent
      piMap :=
        signatureCertificate.pi.admissionProjection.mapAdmissionEvent
      morphismMap :=
        signatureCertificate.morphism.admissionProjection.mapAdmissionEvent
      dagCommutes :=
        signatureCertificate.dag.admissionProjection.event_commutes
      petriCommutes :=
        signatureCertificate.petri.admissionProjection.event_commutes
      piCommutes :=
        signatureCertificate.pi.admissionProjection.event_commutes
      morphismCommutes :=
        signatureCertificate.morphism.admissionProjection.event_commutes }

/-- A certified product-family row is a one-cell finite synchronized chain. -/
def toFiniteChain :
    FiniteCrossEpochProductChain universes
      (beforeReplayEpoch family) (afterReplayEpoch family) :=
  .cons (toFiveViewBoundary family)
    (.single (afterReplayEpoch family))

/-- The adapter inherits the complete finite-chain theorem without new assumptions. -/
theorem finiteChain_complete :
    FiniteCrossEpochProductChain.CompleteAgreement
      (toFiniteChain family) :=
  (toFiniteChain family).composeComplete

end CrossEpochProductFamily

end Cantilune.Theorems
