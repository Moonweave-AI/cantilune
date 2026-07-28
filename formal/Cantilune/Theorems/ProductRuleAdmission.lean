import Cantilune.Core.ExecutionEpochTrace
import Cantilune.Feedback.PositiveEventTrajectory
import Cantilune.Theorems.CoherentFourProjection
import Cantilune.Theorems.FourProjection

/-!
# Legacy fixed-signature product-rule admission certificate

This module retains the original interface as a negative regression.  Its
`Certificate` cannot be inhabited: it asks one fixed-signature
`ExecutionPackage` step to represent a strictly epoch-advancing admission.
`certificate_uninhabited_fixed_signature_admission` records that
contradiction.

The replacement admission layer is
`Cantilune.Core.HeterogeneousPackageAdmission`, where the old and new
execution packages are separately typed.  The non-admission fields below
remain useful as an explicit checklist for one actual occurrence of a product
rule in the new signature, but they are not a constructible product
certificate in this legacy record.

The module deliberately remains separate from the heterogeneous replacement
until a concrete product certificate combines fixed-epoch coherence,
heterogeneous four-view admission, and occurrence/probability evidence.
-/

noncomputable section

namespace Cantilune.Theorems.ProductRuleAdmission

open CategoryTheory
open Cantilune.Core
open Cantilune.Feedback.Probability
open Cantilune.Feedback.StochasticExecution
open Cantilune.Feedback.StochasticExecution.FiniteDiscrete
open Cantilune.Feedback.EventTrajectory
open Cantilune.Feedback.EventTrajectory.FiniteDiscrete

universe u v w

/-- Per-occurrence use of the execution package's internal ranking. -/
structure RuleRankEvidence
    {σ : FinSignature}
    (package : ExecutionPackage σ)
    {before : package.lts.State}
    {event : package.lts.Event}
    {after : package.lts.State} : Prop where
  decreases_if_internal :
    package.ranking.internal event →
      package.ranking.rank after < package.ranking.rank before
  epoch_preserved_if_internal :
    package.ranking.internal event →
      package.ranking.epoch after = package.ranking.epoch before

/-- Positive exact-event evidence for an externally scheduled rule occurrence. -/
structure ExternalSchedulingEvidence
    {σ : FinSignature}
    (package : ExecutionPackage σ)
    {KernelState : Type*} [Fintype KernelState] [DecidableEq KernelState]
    (kernel : NativeMarkovKernel σ package KernelState)
    {initial : InitialDistribution KernelState}
    {epsilon : Real}
    (progress : ProgressBridge kernel initial epsilon)
    {before : package.lts.State}
    {event : package.lts.Event}
    {after : package.lts.State} where
  labelling : PositiveEventLabelling kernel
  alignment : PositiveEpochKernelAlignment labelling progress.window
  kernelSource : KernelState
  kernelTarget : KernelState
  kernelSourceMaps : kernel.stateEquiv kernelSource = before
  kernelTargetMaps : kernel.stateEquiv kernelTarget = after
  probabilityPositive :
    0 < kernel.probability kernelSource kernelTarget
  selectedRuleEvent :
    labelling.event probabilityPositive = event

namespace ExternalSchedulingEvidence

variable
    {σ : FinSignature}
    {package : ExecutionPackage σ}
    {KernelState : Type*} [Fintype KernelState] [DecidableEq KernelState]
    {kernel : NativeMarkovKernel σ package KernelState}
    {initial : InitialDistribution KernelState}
    {epsilon : Real}
    {progress : ProgressBridge kernel initial epsilon}
    {before : package.lts.State}
    {event : package.lts.Event}
    {after : package.lts.State}

theorem selectedRuleNative
    (evidence :
      ExternalSchedulingEvidence package kernel progress
        (before := before) (event := event) (after := after)) :
    package.lts.ObservableStep before event after := by
  have native := evidence.labelling.native evidence.probabilityPositive
  rw [evidence.kernelSourceMaps, evidence.kernelTargetMaps,
    evidence.selectedRuleEvent] at native
  exact native

theorem selectedRuleReplay
    (evidence :
      ExternalSchedulingEvidence package kernel progress
        (before := before) (event := event) (after := after)) :
    (package.eventRecord event).Replays
      (package.configOf before) (package.configOf after) :=
  package.eventEndpoints evidence.selectedRuleNative

/-- External scheduling and internal ranking classify disjoint rule events. -/
theorem selectedRuleNoninternal
    (evidence :
      ExternalSchedulingEvidence package kernel progress
        (before := before) (event := event) (after := after)) :
    ¬ package.ranking.internal event := by
  have noninternal :=
    evidence.alignment.opportunity_noninternal evidence.probabilityPositive
  rw [evidence.selectedRuleEvent] at noninternal
  exact noninternal

end ExternalSchedulingEvidence

/--
An internal occurrence consumes the finite-epoch rank.  An external
occurrence instead carries a positive exact event and positive-edge epoch
alignment.  Internal rules are not forced to be opportunity labels.
-/
inductive RuleSchedulingEvidence
    {σ : FinSignature}
    (package : ExecutionPackage σ)
    {KernelState : Type w} [Fintype KernelState] [DecidableEq KernelState]
    (kernel : NativeMarkovKernel σ package KernelState)
    {initial : InitialDistribution KernelState}
    {epsilon : Real}
    (progress : ProgressBridge kernel initial epsilon)
    {before : package.lts.State}
    {event : package.lts.Event}
    {after : package.lts.State}
    (rank : RuleRankEvidence package
      (before := before) (event := event) (after := after))
    : Type (w + 1)
  | internal
      (isInternal : package.ranking.internal event)
      (decreases :
        package.ranking.rank after < package.ranking.rank before)
      (epochPreserved :
        package.ranking.epoch after = package.ranking.epoch before)
  | external
      (evidence :
        ExternalSchedulingEvidence package kernel progress
          (before := before) (event := event) (after := after))

/--
Legacy evidence record for one product rule symbol and one actual occurrence.

The record is intentionally retained for
`certificate_uninhabited_fixed_signature_admission`; do not use it as the
constructor for new product rules.

`RuleQualified` and `RuleAuthorized` are product-defined predicates.  The
generic layer deliberately has no permissive default for either predicate.
-/
structure Certificate
    (SourceCategory DagCategory PetriCategory PiCategory MorphismCategory :
      Type u)
    [Category.{v} SourceCategory]
    [MonoidalCategory SourceCategory] [SymmetricCategory SourceCategory]
    [Category.{v} DagCategory]
    [MonoidalCategory DagCategory] [SymmetricCategory DagCategory]
    [Category.{v} PetriCategory]
    [MonoidalCategory PetriCategory] [SymmetricCategory PetriCategory]
    [Category.{v} PiCategory]
    [MonoidalCategory PiCategory] [SymmetricCategory PiCategory]
    [Category.{v} MorphismCategory]
    [MonoidalCategory MorphismCategory] [SymmetricCategory MorphismCategory]
    {universes : ProjectionUniverses}
    {oldSignature σ : FinSignature}
    (signatureAdmission :
      SignatureAdmissionEvent universes
        (source := oldSignature) (target := σ))
    (source dag petri pi morphism : ExecutionPackage σ)
    {KernelState : Type*} [Fintype KernelState] [DecidableEq KernelState]
    (kernel : NativeMarkovKernel σ source KernelState)
    (initial : InitialDistribution KernelState)
    (epsilon : Real)
    (RuleQualified RuleAuthorized :
      source.lts.State → source.lts.Event → source.lts.State → Prop) where
  before : source.lts.State
  event : source.lts.Event
  after : source.lts.State
  sourceStep : source.lts.ObservableStep before event after
  rank : RuleRankEvidence source
    (before := before) (event := event) (after := after)

  coherent :
    FourCoherentProjectionCertificates
      SourceCategory DagCategory PetriCategory PiCategory MorphismCategory
      source.lts dag.lts petri.lts pi.lts morphism.lts signatureAdmission

  admissionBefore : source.lts.State
  admissionAfter : source.lts.State
  admissionEvent : source.lts.Event
  sourceAdmissionStep :
    source.lts.ObservableStep
      admissionBefore admissionEvent admissionAfter
  dagAdmissionBefore :
    coherent.dag.complete.admissionCompatible.sourceBefore = admissionBefore
  dagAdmissionAfter :
    coherent.dag.complete.admissionCompatible.sourceAfter = admissionAfter
  dagAdmissionEvent :
    coherent.dag.complete.admissionCompatible.sourceEvent = admissionEvent
  petriAdmissionBefore :
    coherent.petri.complete.admissionCompatible.sourceBefore =
      admissionBefore
  petriAdmissionAfter :
    coherent.petri.complete.admissionCompatible.sourceAfter = admissionAfter
  petriAdmissionEvent :
    coherent.petri.complete.admissionCompatible.sourceEvent = admissionEvent
  piAdmissionBefore :
    coherent.pi.complete.admissionCompatible.sourceBefore = admissionBefore
  piAdmissionAfter :
    coherent.pi.complete.admissionCompatible.sourceAfter = admissionAfter
  piAdmissionEvent :
    coherent.pi.complete.admissionCompatible.sourceEvent = admissionEvent
  morphismAdmissionBefore :
    coherent.morphism.complete.admissionCompatible.sourceBefore =
      admissionBefore
  morphismAdmissionAfter :
    coherent.morphism.complete.admissionCompatible.sourceAfter =
      admissionAfter
  morphismAdmissionEvent :
    coherent.morphism.complete.admissionCompatible.sourceEvent =
      admissionEvent

  /-- The Petri view is explicitly selected as the product's native pre-net. -/
  preNetNative :
    petri.lts.ObservableStep
      (coherent.petri.complete.operational.mapState before)
      (coherent.petri.complete.operational.mapEvent event)
      (coherent.petri.complete.operational.mapState after)

  /--
  The resource predicates used by the complete categorical layers are exactly
  the predicates of the concrete execution packages.
  -/
  dagSourceResources :
    coherent.dag.complete.resources.sourceResourcesValid =
      source.resourcesClear
  dagTargetResources :
    coherent.dag.complete.resources.targetResourcesValid = dag.resourcesClear
  petriSourceResources :
    coherent.petri.complete.resources.sourceResourcesValid =
      source.resourcesClear
  petriTargetResources :
    coherent.petri.complete.resources.targetResourcesValid =
      petri.resourcesClear
  piSourceResources :
    coherent.pi.complete.resources.sourceResourcesValid =
      source.resourcesClear
  piTargetResources :
    coherent.pi.complete.resources.targetResourcesValid = pi.resourcesClear
  morphismSourceResources :
    coherent.morphism.complete.resources.sourceResourcesValid =
      source.resourcesClear
  morphismTargetResources :
    coherent.morphism.complete.resources.targetResourcesValid =
      morphism.resourcesClear

  sourceResourcesBefore : source.resourcesClear before
  sourceResourcesAfter : source.resourcesClear after
  sourceSessionsBefore : source.sessionsQuiescent before
  sourceSessionsAfter : source.sessionsQuiescent after

  dagSessions :
    ∀ state,
      dag.sessionsQuiescent
          (coherent.dag.complete.operational.mapState state) ↔
        source.sessionsQuiescent state
  petriSessions :
    ∀ state,
      petri.sessionsQuiescent
          (coherent.petri.complete.operational.mapState state) ↔
        source.sessionsQuiescent state
  piSessions :
    ∀ state,
      pi.sessionsQuiescent
          (coherent.pi.complete.operational.mapState state) ↔
        source.sessionsQuiescent state
  morphismSessions :
    ∀ state,
      morphism.sessionsQuiescent
          (coherent.morphism.complete.operational.mapState state) ↔
        source.sessionsQuiescent state

  dagDeletion :
    ∀ state,
      dag.deletionPermitted
          (coherent.dag.complete.operational.mapState state) ↔
        source.deletionPermitted state
  petriDeletion :
    ∀ state,
      petri.deletionPermitted
          (coherent.petri.complete.operational.mapState state) ↔
        source.deletionPermitted state
  piDeletion :
    ∀ state,
      pi.deletionPermitted
          (coherent.pi.complete.operational.mapState state) ↔
        source.deletionPermitted state
  morphismDeletion :
    ∀ state,
      morphism.deletionPermitted
          (coherent.morphism.complete.operational.mapState state) ↔
        source.deletionPermitted state

  qualified : RuleQualified before event after
  authorized : RuleAuthorized before event after

  stableWindow : StableFairWindow
  progress : ProgressBridge kernel initial epsilon
  progressWindow : progress.window = stableWindow
  positiveEpsilon : 0 < epsilon
  epsilonAtMostOne : epsilon ≤ 1
  scheduling :
    RuleSchedulingEvidence source kernel progress rank

/--
The current interface is uninhabited: an `ExecutionPackage` step is replayed
by a fixed-signature `DPOEvent` and therefore preserves its runtime signature
version, while the coherent complete projection's admission layer requires
such a step to realize a strictly version-advancing
`SignatureAdmissionEvent`.  The duplicated `sourceAdmissionStep` fields are
not needed for the contradiction.

This obstruction is recorded before replacing the same-signature admission
fields with heterogeneous `AdmissionReplays` evidence.

Verification status: proof source written; targeted build pending.
-/
theorem certificate_uninhabited_fixed_signature_admission
    {SourceCategory DagCategory PetriCategory PiCategory MorphismCategory :
      Type u}
    [Category.{v} SourceCategory]
    [MonoidalCategory SourceCategory] [SymmetricCategory SourceCategory]
    [Category.{v} DagCategory]
    [MonoidalCategory DagCategory] [SymmetricCategory DagCategory]
    [Category.{v} PetriCategory]
    [MonoidalCategory PetriCategory] [SymmetricCategory PetriCategory]
    [Category.{v} PiCategory]
    [MonoidalCategory PiCategory] [SymmetricCategory PiCategory]
    [Category.{v} MorphismCategory]
    [MonoidalCategory MorphismCategory] [SymmetricCategory MorphismCategory]
    {universes : ProjectionUniverses}
    {oldSignature newSignature : FinSignature}
    {signatureAdmission :
      SignatureAdmissionEvent universes
        (source := oldSignature) (target := newSignature)}
    {source dag petri pi morphism : ExecutionPackage newSignature}
    {KernelState : Type*} [Fintype KernelState] [DecidableEq KernelState]
    {kernel : NativeMarkovKernel newSignature source KernelState}
    {initial : InitialDistribution KernelState}
    {epsilon : Real}
    {RuleQualified RuleAuthorized :
      source.lts.State → source.lts.Event → source.lts.State → Prop}
    (certificate :
      Certificate
        SourceCategory DagCategory PetriCategory PiCategory MorphismCategory
        signatureAdmission source dag petri pi morphism
        kernel initial epsilon RuleQualified RuleAuthorized) :
    False := by
  let dagAdmission :=
    certificate.coherent.dag.complete.admissionCompatible
  have versionPreserved :
      source.lts.signatureVersion dagAdmission.sourceAfter =
        source.lts.signatureVersion dagAdmission.sourceBefore :=
    ExecutionEpochTrace.observable_step_lts_version_preserved
      source dagAdmission.sourceStep
  have versionsEqual :
      signatureAdmission.toVersion = signatureAdmission.fromVersion := by
    calc
      signatureAdmission.toVersion =
          source.lts.signatureVersion dagAdmission.sourceAfter :=
        dagAdmission.sourceAfterVersion.symm
      _ = source.lts.signatureVersion dagAdmission.sourceBefore :=
        versionPreserved
      _ = signatureAdmission.fromVersion :=
        dagAdmission.sourceBeforeVersion
  exact
    (Nat.ne_of_lt signatureAdmission.advancesEpoch) versionsEqual.symm

namespace Certificate

variable
    {SourceCategory DagCategory PetriCategory PiCategory MorphismCategory :
      Type u}
    [Category.{v} SourceCategory]
    [MonoidalCategory SourceCategory] [SymmetricCategory SourceCategory]
    [Category.{v} DagCategory]
    [MonoidalCategory DagCategory] [SymmetricCategory DagCategory]
    [Category.{v} PetriCategory]
    [MonoidalCategory PetriCategory] [SymmetricCategory PetriCategory]
    [Category.{v} PiCategory]
    [MonoidalCategory PiCategory] [SymmetricCategory PiCategory]
    [Category.{v} MorphismCategory]
    [MonoidalCategory MorphismCategory] [SymmetricCategory MorphismCategory]
    {universes : ProjectionUniverses}
    {oldSignature σ : FinSignature}
    {signatureAdmission :
      SignatureAdmissionEvent universes
        (source := oldSignature) (target := σ)}
    {source dag petri pi morphism : ExecutionPackage σ}
    {KernelState : Type*} [Fintype KernelState] [DecidableEq KernelState]
    {kernel : NativeMarkovKernel σ source KernelState}
    {initial : InitialDistribution KernelState}
    {epsilon : Real}
    {RuleQualified RuleAuthorized :
      source.lts.State → source.lts.Event → source.lts.State → Prop}

variable (certificate :
  Certificate
    SourceCategory DagCategory PetriCategory PiCategory MorphismCategory
    signatureAdmission source dag petri pi morphism
    kernel initial epsilon RuleQualified RuleAuthorized)

/-- Short names for the four complete components of the coherent bundle. -/
abbrev dagComplete := certificate.coherent.dag.complete
abbrev petriComplete := certificate.coherent.petri.complete
abbrev piComplete := certificate.coherent.pi.complete
abbrev morphismComplete := certificate.coherent.morphism.complete

/-- Operational four-view bundle extracted from the complete certificates. -/
def fourProjections : FourProjectionCertificate source.lts where
  dagLTS := dag.lts
  petriLTS := petri.lts
  piLTS := pi.lts
  morphismLTS := morphism.lts
  dag := certificate.dagComplete.operational
  petri := certificate.petriComplete.operational
  pi := certificate.piComplete.operational
  morphism := certificate.morphismComplete.operational

/-- The four static SMC and epoch-boundary admission layers remain available. -/
structure StaticAdmissionLayers where
  dagStatic :
    StaticSMCProjectionCertificate SourceCategory DagCategory
  petriStatic :
    StaticSMCProjectionCertificate SourceCategory PetriCategory
  piStatic :
    StaticSMCProjectionCertificate SourceCategory PiCategory
  morphismStatic :
    StaticSMCProjectionCertificate SourceCategory MorphismCategory
  dagAdmission :
    AdmissionProjectionCompatibility
      certificate.dagComplete.operational signatureAdmission
  petriAdmission :
    AdmissionProjectionCompatibility
      certificate.petriComplete.operational signatureAdmission
  piAdmission :
    AdmissionProjectionCompatibility
      certificate.piComplete.operational signatureAdmission
  morphismAdmission :
    AdmissionProjectionCompatibility
      certificate.morphismComplete.operational signatureAdmission

def staticAdmissionLayers : certificate.StaticAdmissionLayers where
  dagStatic := certificate.dagComplete.static
  petriStatic := certificate.petriComplete.static
  piStatic := certificate.piComplete.static
  morphismStatic := certificate.morphismComplete.static
  dagAdmission := certificate.dagComplete.admissionCompatible
  petriAdmission := certificate.petriComplete.admissionCompatible
  piAdmission := certificate.piComplete.admissionCompatible
  morphismAdmission := certificate.morphismComplete.admissionCompatible

/--
All four admission layers refer to one shared source redex rather than merely
sharing version numbers and a signature-extension record.
-/
structure SharedSourceAdmission : Prop where
  sourceStep :
    source.lts.ObservableStep
      certificate.admissionBefore certificate.admissionEvent
      certificate.admissionAfter
  dagBefore :
    certificate.dagComplete.admissionCompatible.sourceBefore =
      certificate.admissionBefore
  dagAfter :
    certificate.dagComplete.admissionCompatible.sourceAfter =
      certificate.admissionAfter
  dagEvent :
    certificate.dagComplete.admissionCompatible.sourceEvent =
      certificate.admissionEvent
  petriBefore :
    certificate.petriComplete.admissionCompatible.sourceBefore =
      certificate.admissionBefore
  petriAfter :
    certificate.petriComplete.admissionCompatible.sourceAfter =
      certificate.admissionAfter
  petriEvent :
    certificate.petriComplete.admissionCompatible.sourceEvent =
      certificate.admissionEvent
  piBefore :
    certificate.piComplete.admissionCompatible.sourceBefore =
      certificate.admissionBefore
  piAfter :
    certificate.piComplete.admissionCompatible.sourceAfter =
      certificate.admissionAfter
  piEvent :
    certificate.piComplete.admissionCompatible.sourceEvent =
      certificate.admissionEvent
  morphismBefore :
    certificate.morphismComplete.admissionCompatible.sourceBefore =
      certificate.admissionBefore
  morphismAfter :
    certificate.morphismComplete.admissionCompatible.sourceAfter =
      certificate.admissionAfter
  morphismEvent :
    certificate.morphismComplete.admissionCompatible.sourceEvent =
      certificate.admissionEvent

theorem sharedSourceAdmission : certificate.SharedSourceAdmission where
  sourceStep := certificate.sourceAdmissionStep
  dagBefore := certificate.dagAdmissionBefore
  dagAfter := certificate.dagAdmissionAfter
  dagEvent := certificate.dagAdmissionEvent
  petriBefore := certificate.petriAdmissionBefore
  petriAfter := certificate.petriAdmissionAfter
  petriEvent := certificate.petriAdmissionEvent
  piBefore := certificate.piAdmissionBefore
  piAfter := certificate.piAdmissionAfter
  piEvent := certificate.piAdmissionEvent
  morphismBefore := certificate.morphismAdmissionBefore
  morphismAfter := certificate.morphismAdmissionAfter
  morphismEvent := certificate.morphismAdmissionEvent

/-- Proposition asserting all four native epoch-boundary rule-symbol steps. -/
def AdmissionStepConditions : Prop :=
    dag.lts.ObservableStep
        (certificate.dagComplete.operational.mapState
          certificate.dagComplete.admissionCompatible.sourceBefore)
        certificate.dagComplete.admissionCompatible.targetEvent
        (certificate.dagComplete.operational.mapState
          certificate.dagComplete.admissionCompatible.sourceAfter) ∧
    petri.lts.ObservableStep
        (certificate.petriComplete.operational.mapState
          certificate.petriComplete.admissionCompatible.sourceBefore)
        certificate.petriComplete.admissionCompatible.targetEvent
        (certificate.petriComplete.operational.mapState
          certificate.petriComplete.admissionCompatible.sourceAfter) ∧
    pi.lts.ObservableStep
        (certificate.piComplete.operational.mapState
          certificate.piComplete.admissionCompatible.sourceBefore)
        certificate.piComplete.admissionCompatible.targetEvent
        (certificate.piComplete.operational.mapState
          certificate.piComplete.admissionCompatible.sourceAfter) ∧
    morphism.lts.ObservableStep
        (certificate.morphismComplete.operational.mapState
          certificate.morphismComplete.admissionCompatible.sourceBefore)
        certificate.morphismComplete.admissionCompatible.targetEvent
        (certificate.morphismComplete.operational.mapState
          certificate.morphismComplete.admissionCompatible.sourceAfter)

/-- Each view contains the native epoch-boundary transition for the rule symbol. -/
theorem admissionSteps : certificate.AdmissionStepConditions :=
  ⟨certificate.dagComplete.admissionCompatible.targetStep,
    certificate.petriComplete.admissionCompatible.targetStep,
    certificate.piComplete.admissionCompatible.targetStep,
    certificate.morphismComplete.admissionCompatible.targetStep⟩

/-- Exact replay proposition for the actual source occurrence. -/
def SourceReplayCondition : Prop :=
    (source.eventRecord certificate.event).Replays
      (source.configOf certificate.before)
      (source.configOf certificate.after)

/-- The actual source occurrence replays its exact concrete configurations. -/
theorem sourceReplay : certificate.SourceReplayCondition :=
  source.eventEndpoints certificate.sourceStep

/-- Exact replay proposition for all four mapped target occurrences. -/
def TargetReplayConditions : Prop :=
    (dag.eventRecord
        (certificate.dagComplete.operational.mapEvent
          certificate.event)).Replays
      (dag.configOf
        (certificate.dagComplete.operational.mapState certificate.before))
      (dag.configOf
        (certificate.dagComplete.operational.mapState certificate.after)) ∧
    (petri.eventRecord
        (certificate.petriComplete.operational.mapEvent
          certificate.event)).Replays
      (petri.configOf
        (certificate.petriComplete.operational.mapState certificate.before))
      (petri.configOf
        (certificate.petriComplete.operational.mapState certificate.after)) ∧
    (pi.eventRecord
        (certificate.piComplete.operational.mapEvent
          certificate.event)).Replays
      (pi.configOf
        (certificate.piComplete.operational.mapState certificate.before))
      (pi.configOf
        (certificate.piComplete.operational.mapState certificate.after)) ∧
    (morphism.eventRecord
        (certificate.morphismComplete.operational.mapEvent
          certificate.event)).Replays
      (morphism.configOf
        (certificate.morphismComplete.operational.mapState certificate.before))
      (morphism.configOf
        (certificate.morphismComplete.operational.mapState
          certificate.after))

/-- All four mapped occurrence records replay their exact target endpoints. -/
theorem targetReplays : certificate.TargetReplayConditions :=
  ⟨dag.eventEndpoints
      (certificate.dagComplete.operational.sound certificate.sourceStep),
    petri.eventEndpoints
      (certificate.petriComplete.operational.sound certificate.sourceStep),
    pi.eventEndpoints
      (certificate.piComplete.operational.sound certificate.sourceStep),
    morphism.eventEndpoints
      (certificate.morphismComplete.operational.sound certificate.sourceStep)⟩

/-- Exact source-path lift and native target-path reflection in all views. -/
theorem paths :
    PathConsistency certificate.dagComplete.operational ∧
      PathConsistency certificate.petriComplete.operational ∧
      PathConsistency certificate.piComplete.operational ∧
      PathConsistency certificate.morphismComplete.operational :=
  ⟨certificate.dagComplete.operational.projection_paths_lift_and_reflect,
    certificate.petriComplete.operational.projection_paths_lift_and_reflect,
    certificate.piComplete.operational.projection_paths_lift_and_reflect,
    certificate.morphismComplete.operational
      |>.projection_paths_lift_and_reflect⟩

/-- Complete terminal classification agrees at every mapped state. -/
theorem terminals (state : source.lts.State) :
    TerminalConsistency certificate.dagComplete.operational state ∧
      TerminalConsistency certificate.petriComplete.operational state ∧
      TerminalConsistency certificate.piComplete.operational state ∧
      TerminalConsistency certificate.morphismComplete.operational state :=
  ⟨⟨certificate.dagComplete.terminals.successfulTermination_iff state,
      certificate.dagComplete.terminals.externalWait_iff state,
      certificate.dagComplete.terminals.deadlocked_iff state⟩,
    ⟨certificate.petriComplete.terminals.successfulTermination_iff state,
      certificate.petriComplete.terminals.externalWait_iff state,
      certificate.petriComplete.terminals.deadlocked_iff state⟩,
    ⟨certificate.piComplete.terminals.successfulTermination_iff state,
      certificate.piComplete.terminals.externalWait_iff state,
      certificate.piComplete.terminals.deadlocked_iff state⟩,
    ⟨certificate.morphismComplete.terminals.successfulTermination_iff state,
      certificate.morphismComplete.terminals.externalWait_iff state,
      certificate.morphismComplete.terminals.deadlocked_iff state⟩⟩

private theorem dagResourcesIff (state : source.lts.State) :
    dag.resourcesClear
        (certificate.dagComplete.operational.mapState state) ↔
      source.resourcesClear state := by
  rw [← certificate.dagTargetResources,
    certificate.dagComplete.resources.resources_iff,
    certificate.dagSourceResources]

private theorem petriResourcesIff (state : source.lts.State) :
    petri.resourcesClear
        (certificate.petriComplete.operational.mapState state) ↔
      source.resourcesClear state := by
  rw [← certificate.petriTargetResources,
    certificate.petriComplete.resources.resources_iff,
    certificate.petriSourceResources]

private theorem piResourcesIff (state : source.lts.State) :
    pi.resourcesClear
        (certificate.piComplete.operational.mapState state) ↔
      source.resourcesClear state := by
  rw [← certificate.piTargetResources,
    certificate.piComplete.resources.resources_iff,
    certificate.piSourceResources]

private theorem morphismResourcesIff (state : source.lts.State) :
    morphism.resourcesClear
        (certificate.morphismComplete.operational.mapState state) ↔
      source.resourcesClear state := by
  rw [← certificate.morphismTargetResources,
    certificate.morphismComplete.resources.resources_iff,
    certificate.morphismSourceResources]

/-- Resource condition at both occurrence endpoints in all four views. -/
def EndpointResourceConditions : Prop :=
    dag.resourcesClear
        (certificate.dagComplete.operational.mapState certificate.before) ∧
      petri.resourcesClear
        (certificate.petriComplete.operational.mapState certificate.before) ∧
      pi.resourcesClear
        (certificate.piComplete.operational.mapState certificate.before) ∧
      morphism.resourcesClear
        (certificate.morphismComplete.operational.mapState
          certificate.before) ∧
      dag.resourcesClear
        (certificate.dagComplete.operational.mapState certificate.after) ∧
      petri.resourcesClear
        (certificate.petriComplete.operational.mapState certificate.after) ∧
      pi.resourcesClear
        (certificate.piComplete.operational.mapState certificate.after) ∧
      morphism.resourcesClear
        (certificate.morphismComplete.operational.mapState certificate.after)

/-- Both occurrence endpoints satisfy every target's concrete resource rule. -/
theorem endpointResources : certificate.EndpointResourceConditions :=
  ⟨(certificate.dagResourcesIff certificate.before).mpr
      certificate.sourceResourcesBefore,
    (certificate.petriResourcesIff certificate.before).mpr
      certificate.sourceResourcesBefore,
    (certificate.piResourcesIff certificate.before).mpr
      certificate.sourceResourcesBefore,
    (certificate.morphismResourcesIff certificate.before).mpr
      certificate.sourceResourcesBefore,
    (certificate.dagResourcesIff certificate.after).mpr
      certificate.sourceResourcesAfter,
    (certificate.petriResourcesIff certificate.after).mpr
      certificate.sourceResourcesAfter,
    (certificate.piResourcesIff certificate.after).mpr
      certificate.sourceResourcesAfter,
    (certificate.morphismResourcesIff certificate.after).mpr
      certificate.sourceResourcesAfter⟩

/-- Session condition at both occurrence endpoints in all four views. -/
def EndpointSessionConditions : Prop :=
    dag.sessionsQuiescent
        (certificate.dagComplete.operational.mapState certificate.before) ∧
      petri.sessionsQuiescent
        (certificate.petriComplete.operational.mapState certificate.before) ∧
      pi.sessionsQuiescent
        (certificate.piComplete.operational.mapState certificate.before) ∧
      morphism.sessionsQuiescent
        (certificate.morphismComplete.operational.mapState
          certificate.before) ∧
      dag.sessionsQuiescent
        (certificate.dagComplete.operational.mapState certificate.after) ∧
      petri.sessionsQuiescent
        (certificate.petriComplete.operational.mapState certificate.after) ∧
      pi.sessionsQuiescent
        (certificate.piComplete.operational.mapState certificate.after) ∧
      morphism.sessionsQuiescent
        (certificate.morphismComplete.operational.mapState certificate.after)

/-- Both occurrence endpoints satisfy every target's session discipline. -/
theorem endpointSessions : certificate.EndpointSessionConditions :=
  ⟨(certificate.dagSessions certificate.before).mpr
      certificate.sourceSessionsBefore,
    (certificate.petriSessions certificate.before).mpr
      certificate.sourceSessionsBefore,
    (certificate.piSessions certificate.before).mpr
      certificate.sourceSessionsBefore,
    (certificate.morphismSessions certificate.before).mpr
      certificate.sourceSessionsBefore,
    (certificate.dagSessions certificate.after).mpr
      certificate.sourceSessionsAfter,
    (certificate.petriSessions certificate.after).mpr
      certificate.sourceSessionsAfter,
    (certificate.piSessions certificate.after).mpr
      certificate.sourceSessionsAfter,
    (certificate.morphismSessions certificate.after).mpr
      certificate.sourceSessionsAfter⟩

/--
Deletion permission is preserved and reflected at both occurrence endpoints.
This proposition does not assert that every product rule is a deletion rule.
-/
def EndpointDeletionConditions : Prop :=
  (dag.deletionPermitted
      (certificate.dagComplete.operational.mapState certificate.before) ↔
    source.deletionPermitted certificate.before) ∧
  (petri.deletionPermitted
      (certificate.petriComplete.operational.mapState certificate.before) ↔
    source.deletionPermitted certificate.before) ∧
  (pi.deletionPermitted
      (certificate.piComplete.operational.mapState certificate.before) ↔
    source.deletionPermitted certificate.before) ∧
  (morphism.deletionPermitted
      (certificate.morphismComplete.operational.mapState certificate.before) ↔
    source.deletionPermitted certificate.before) ∧
  (dag.deletionPermitted
      (certificate.dagComplete.operational.mapState certificate.after) ↔
    source.deletionPermitted certificate.after) ∧
  (petri.deletionPermitted
      (certificate.petriComplete.operational.mapState certificate.after) ↔
    source.deletionPermitted certificate.after) ∧
  (pi.deletionPermitted
      (certificate.piComplete.operational.mapState certificate.after) ↔
    source.deletionPermitted certificate.after) ∧
  (morphism.deletionPermitted
      (certificate.morphismComplete.operational.mapState certificate.after) ↔
    source.deletionPermitted certificate.after)

theorem endpointDeletions : certificate.EndpointDeletionConditions :=
  ⟨certificate.dagDeletion certificate.before,
    certificate.petriDeletion certificate.before,
    certificate.piDeletion certificate.before,
    certificate.morphismDeletion certificate.before,
    certificate.dagDeletion certificate.after,
    certificate.petriDeletion certificate.after,
    certificate.piDeletion certificate.after,
    certificate.morphismDeletion certificate.after⟩

/-- Exact classification of this occurrence's scheduling discipline. -/
def SchedulingConditions : Prop :=
  (source.ranking.internal certificate.event ∧
      source.ranking.rank certificate.after <
        source.ranking.rank certificate.before ∧
      source.ranking.epoch certificate.after =
        source.ranking.epoch certificate.before) ∨
    Nonempty
      (ExternalSchedulingEvidence source kernel certificate.progress
        (before := certificate.before)
        (event := certificate.event)
        (after := certificate.after))

theorem schedulingConditions : certificate.SchedulingConditions := by
  cases certificate.scheduling with
  | internal isInternal decreases epochPreserved =>
      exact Or.inl ⟨isInternal, decreases, epochPreserved⟩
  | external evidence =>
      exact Or.inr ⟨evidence⟩

/-- The package-level stable/fair suffix and positive progress hypothesis. -/
structure ProbabilityConditions : Prop where
  windowAgreement :
    certificate.progress.window = certificate.stableWindow
  signatureStable :
    ∀ offset,
      certificate.stableWindow.signatureVersion
          (certificate.stableWindow.startEpoch + offset) =
        certificate.stableWindow.signatureVersion
          certificate.stableWindow.startEpoch
  fairnessCofinal :
    ∀ epoch,
      certificate.stableWindow.startEpoch ≤ epoch →
      ∃ n, epoch ≤ certificate.stableWindow.opportunityEpoch n
  epsilonPositive : 0 < epsilon
  epsilonAtMostOne : epsilon ≤ 1
  scheduling : certificate.SchedulingConditions

theorem probabilityConditions : certificate.ProbabilityConditions where
  windowAgreement := certificate.progressWindow
  signatureStable := certificate.stableWindow.signature_stable
  fairnessCofinal := certificate.stableWindow.cofinal
  epsilonPositive := certificate.positiveEpsilon
  epsilonAtMostOne := certificate.epsilonAtMostOne
  scheduling := certificate.schedulingConditions

/-- All layers extracted from a single product-supplied certificate. -/
structure Consequences where
  qualified :
    RuleQualified certificate.before certificate.event certificate.after
  authorized :
    RuleAuthorized certificate.before certificate.event certificate.after
  staticAdmission : certificate.StaticAdmissionLayers
  sharedSourceAdmission : certificate.SharedSourceAdmission
  admissionSteps : certificate.AdmissionStepConditions
  rank :
    RuleRankEvidence source
      (before := certificate.before)
      (event := certificate.event)
      (after := certificate.after)
  preNet :
    petri.lts.ObservableStep
      (certificate.petriComplete.operational.mapState certificate.before)
      (certificate.petriComplete.operational.mapEvent certificate.event)
      (certificate.petriComplete.operational.mapState certificate.after)
  paths :
    PathConsistency certificate.dagComplete.operational ∧
      PathConsistency certificate.petriComplete.operational ∧
      PathConsistency certificate.piComplete.operational ∧
      PathConsistency certificate.morphismComplete.operational
  terminals :
    ∀ state,
      TerminalConsistency certificate.dagComplete.operational state ∧
        TerminalConsistency certificate.petriComplete.operational state ∧
        TerminalConsistency certificate.piComplete.operational state ∧
        TerminalConsistency certificate.morphismComplete.operational state
  sourceReplay : certificate.SourceReplayCondition
  targetReplays : certificate.TargetReplayConditions
  resources : certificate.EndpointResourceConditions
  sessions : certificate.EndpointSessionConditions
  deletions : certificate.EndpointDeletionConditions
  probability : certificate.ProbabilityConditions

def rule_consequences : certificate.Consequences where
  qualified := certificate.qualified
  authorized := certificate.authorized
  staticAdmission := certificate.staticAdmissionLayers
  sharedSourceAdmission := certificate.sharedSourceAdmission
  admissionSteps := certificate.admissionSteps
  rank := certificate.rank
  preNet := certificate.preNetNative
  paths := certificate.paths
  terminals := certificate.terminals
  sourceReplay := certificate.sourceReplay
  targetReplays := certificate.targetReplays
  resources := certificate.endpointResources
  sessions := certificate.endpointSessions
  deletions := certificate.endpointDeletions
  probability := certificate.probabilityConditions

end Certificate

end Cantilune.Theorems.ProductRuleAdmission
