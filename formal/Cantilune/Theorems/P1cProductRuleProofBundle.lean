import Cantilune.Pi.P1cAdmittedFourOccurrence
import Cantilune.Pi.P1cAdmittedTrajectory
import Cantilune.Theorems.ProductRuleProofBundle

/-!
# A non-identity product-rule bundle for a substantive P1c occurrence

This module passes the generic `ProductRuleProofBundle` gate with the
existing admitted P1c operation, its endpoint-free `DPOEvent` replay, and its
deterministic probability kernel.  The four target views have state and event
types distinct from the source sampler.  Their business constructors carry,
respectively, the concrete finite-support DAG update, individual-token Petri
firing, native standard-late pi transition, and deterministic morphism.

All four source events are encoded, including the two zero-mass
totalisation events.  Conversely every target step reflects to a source step.
Thus this construction is neither an identity projection nor an observation
filter.

The final `Reference` inhabitant is a reconnect occurrence on two live nodes:
the target graph genuinely adds the edge `(0, 1)`.  It is a reference rule,
not evidence that any production package has supplied its own bundle.
-/

noncomputable section

namespace Cantilune.Theorems.P1cProductRuleProofBundle

open Cantilune.Core
open Cantilune.Feedback.Probability
open Cantilune.Feedback.StochasticExecution
open Cantilune.Feedback.StochasticExecution.FiniteDiscrete
open Cantilune.Feedback.EventTrajectory
open Cantilune.Feedback.EventTrajectory.FiniteDiscrete
open Cantilune.Pi.P1cAdmittedOperations
open Cantilune.Pi.P1cAdmittedTrajectory
open Cantilune.Theorems.ProductRuleAdmission
open Cantilune.Theorems.HeterogeneousProductRuleAdmission
open Cantilune.Theorems.ProductRuleProofBundle

variable {σ : FinSignature}

/-! ## Why the productive sampler is required -/

/--
The completed state of the one-shot fixed-occurrence source package has no
native outgoing event.
-/
theorem fixedOccurrence_completed_no_step
    (occurrence : Occurrence σ)
    (request :
      Cantilune.Pi.P1cAdmittedP1aCertificates.Family occurrence)
    (event :
      (Cantilune.Pi.P1cAdmittedP1aCertificates.sourcePackage occurrence)
        |>.lts.Event)
    (target :
      (Cantilune.Pi.P1cAdmittedP1aCertificates.sourcePackage occurrence)
        |>.lts.State) :
    ¬((Cantilune.Pi.P1cAdmittedP1aCertificates.sourcePackage occurrence)
      |>.lts.ObservableStep (.completed request) event target) := by
  intro observable
  rcases observable with ⟨step, _isObservable⟩
  cases step

/--
Consequently no finite Markov kernel on that exact one-shot package can have
a positive-event labelling: row mass at the completed state would have to
select a native outgoing event.  The productive P1c sampler used below adds
an explicit completed-state external hold and therefore crosses this genuine
kernel/package boundary without inventing a business transition.
-/
theorem no_positive_labelling_on_fixed_occurrence
    (occurrence : Occurrence σ)
    {KernelState : Type*} [Fintype KernelState] [DecidableEq KernelState]
    (kernel :
      NativeMarkovKernel σ
        (Cantilune.Pi.P1cAdmittedP1aCertificates.sourcePackage occurrence)
        KernelState) :
    ¬Nonempty (PositiveEventLabelling kernel) := by
  rintro ⟨labelling⟩
  let completedState :
      (Cantilune.Pi.P1cAdmittedP1aCertificates.sourcePackage occurrence)
        |>.lts.State :=
    .completed
      (Cantilune.Pi.P1cAdmittedP1aCertificates.family occurrence)
  let completedKernel : KernelState :=
    kernel.stateEquiv.symm completedState
  have positiveTarget :
      ∃ target, 0 < kernel.probability completedKernel target := by
    by_contra noPositive
    push Not at noPositive
    have allZero :
        ∀ target, kernel.probability completedKernel target = 0 := by
      intro target
      exact
        le_antisymm (noPositive target)
          (kernel.probability_nonnegative completedKernel target)
    have row := kernel.row_sum completedKernel
    simp only [allZero, Finset.sum_const_zero] at row
    norm_num at row
  obtain ⟨target, positive⟩ := positiveTarget
  have native := labelling.native positive
  have sourceEq :
      kernel.stateEquiv completedKernel = completedState :=
    kernel.stateEquiv.apply_symm_apply completedState
  rw [sourceEq] at native
  exact
    fixedOccurrence_completed_no_step occurrence
      (Cantilune.Pi.P1cAdmittedP1aCertificates.family occurrence)
      (labelling.event positive)
      (kernel.stateEquiv target)
      native

/-- The four target semantics carried by the non-identity wrapper. -/
inductive ViewKind
  | dag
  | petri
  | pi
  | morphism
  deriving DecidableEq, Repr

/-- A target state type intentionally distinct from the source `Bool`. -/
inductive ViewState
  | pending
  | completed
  deriving DecidableEq, Repr

/-- A target event type intentionally distinct from the source event type. -/
inductive ViewEvent
  | business
  | pendingExternalHold
  | completedExternalHold
  | nullPathAdministrativeReset
  deriving DecidableEq, Repr

def encodeState : Bool → ViewState
  | false => .pending
  | true => .completed

def decodeState : ViewState → Bool
  | .pending => false
  | .completed => true

def encodeEvent : Cantilune.Pi.P1cAdmittedTrajectory.Event → ViewEvent
  | .business => .business
  | .pendingExternalHold => .pendingExternalHold
  | .completedExternalHold => .completedExternalHold
  | .nullPathAdministrativeReset => .nullPathAdministrativeReset

def decodeEvent : ViewEvent → Cantilune.Pi.P1cAdmittedTrajectory.Event
  | .business => .business
  | .pendingExternalHold => .pendingExternalHold
  | .completedExternalHold => .completedExternalHold
  | .nullPathAdministrativeReset => .nullPathAdministrativeReset

@[simp] theorem decode_encode_state (state : Bool) :
    decodeState (encodeState state) = state := by
  cases state <;> rfl

@[simp] theorem encode_decode_state (state : ViewState) :
    encodeState (decodeState state) = state := by
  cases state <;> rfl

@[simp] theorem decode_encode_event
    (event : Cantilune.Pi.P1cAdmittedTrajectory.Event) :
    decodeEvent (encodeEvent event) = event := by
  cases event <;> rfl

@[simp] theorem encode_decode_event (event : ViewEvent) :
    encodeEvent (decodeEvent event) = event := by
  cases event <;> rfl

/-- No source event is dropped by the target encoding. -/
theorem encodeEvent_bijective : Function.Bijective encodeEvent :=
  ⟨by
      intro left right equality
      cases left <;> cases right <;> simp_all [encodeEvent],
    by
      intro event
      exact ⟨decodeEvent event, encode_decode_event event⟩⟩

/--
The independently defined native payload carried by the business constructor
of each target view.
-/
def NativePayload (kind : ViewKind) (occurrence : Occurrence σ) : Prop :=
  match kind with
  | .dag =>
      Cantilune.Pi.P1cAdmittedOperations.DAG.Step
        occurrence.source occurrence.request occurrence.target
  | .petri =>
      Cantilune.Pi.P1cAdmittedOperations.Petri.Step
        occurrence.source occurrence.request occurrence.target
  | .pi =>
      Cantilune.Pi.Late.NativeStep
        (PiView.source occurrence.request)
        .tau
        (PiView.target occurrence.request)
  | .morphism =>
      Cantilune.Pi.P1cAdmittedOperations.Morphism.Step
        occurrence.source occurrence.request occurrence.target

theorem nativePayload (kind : ViewKind) (occurrence : Occurrence σ) :
    NativePayload kind occurrence := by
  cases kind with
  | dag =>
      exact Cantilune.Pi.P1cAdmittedOperations.DAG.ofOccurrence occurrence
  | petri =>
      exact Cantilune.Pi.P1cAdmittedOperations.Petri.ofOccurrence occurrence
  | pi =>
      exact PiView.native occurrence
  | morphism =>
      exact
        Cantilune.Pi.P1cAdmittedOperations.Morphism.ofOccurrence occurrence

/-- The target relation contains every source event and no additional event. -/
inductive TargetStep (kind : ViewKind) (occurrence : Occurrence σ) :
    ViewState → ViewEvent → ViewState → Prop
  | business (native : NativePayload kind occurrence) :
      TargetStep kind occurrence .pending .business .completed
  | pendingHold :
      TargetStep kind occurrence
        .pending .pendingExternalHold .pending
  | completedHold :
      TargetStep kind occurrence
        .completed .completedExternalHold .completed
  | nullReset :
      TargetStep kind occurrence
        .completed .nullPathAdministrativeReset .pending

theorem TargetStep.business_native
    {kind : ViewKind} {occurrence : Occurrence σ}
    (step :
      TargetStep kind occurrence .pending .business .completed) :
    NativePayload kind occurrence := by
  cases step with
  | business native => exact native

def targetLTS (kind : ViewKind) (occurrence : Occurrence σ) :
    ObservableLTS where
  State := ViewState
  Event := ViewEvent
  stateSetoid := ObservableLTS.equalitySetoid ViewState
  step := TargetStep kind occurrence
  observable := fun _ => True
  success := fun _ => False
  waiting := fun _ => False
  signatureVersion := fun _ => occurrence.source.signatureVersion
  step_congr := by
    intro source source' event target target' sourceEq targetEq
    subst source'
    subst target'
    rfl
  success_congr := by
    intro source target equality
    subst target
    rfl
  waiting_congr := by
    intro source target equality
    subst target
    rfl
  signatureVersion_congr := by
    intro source target equality
    subst target
    rfl

def targetConfig (occurrence : Occurrence σ) :
    ViewState → Config σ
  | .pending => occurrence.source
  | .completed => occurrence.target

@[simp] theorem targetConfig_encodeState
    (occurrence : Occurrence σ) (state : Bool) :
    targetConfig occurrence (encodeState state) =
      Cantilune.Pi.P1cAdmittedTrajectory.configOf occurrence state := by
  cases state <;> rfl

@[simp] theorem targetConfig_signatureVersion
    (occurrence : Occurrence σ) (state : ViewState) :
    (targetConfig occurrence state).signatureVersion =
      occurrence.source.signatureVersion := by
  cases state
  · rfl
  · change
      (applyRequest occurrence.source occurrence.request).signatureVersion =
        occurrence.source.signatureVersion
    cases occurrence.request <;> rfl

/-- A target package reuses the verified recipe but not the source LTS type. -/
def targetPackage (kind : ViewKind) (occurrence : Occurrence σ) :
    ExecutionPackage σ where
  lts := targetLTS kind occurrence
  configOf := targetConfig occurrence
  replayKernel := Cantilune.Pi.P1cAdmittedTrajectory.replayKernel occurrence
  eventRecord := fun event =>
    Cantilune.Pi.P1cAdmittedTrajectory.verifiedRecord occurrence
      (decodeEvent event)
  eventEndpoints := by
    rintro source event target ⟨step, _observable⟩
    cases step with
    | business _ =>
        exact
          (Cantilune.Pi.P1cAdmittedTrajectory.verifiedRecord occurrence
            .business).replays_recorded
    | pendingHold =>
        exact
          (Cantilune.Pi.P1cAdmittedTrajectory.verifiedRecord occurrence
            .pendingExternalHold).replays_recorded
    | completedHold =>
        exact
          (Cantilune.Pi.P1cAdmittedTrajectory.verifiedRecord occurrence
            .completedExternalHold).replays_recorded
    | nullReset =>
        exact
          (Cantilune.Pi.P1cAdmittedTrajectory.verifiedRecord occurrence
            .nullPathAdministrativeReset).replays_recorded
  stateVersion := targetConfig_signatureVersion occurrence
  resourcesClear := fun state =>
    (targetConfig occurrence state).resourceTokens = ∅
  sessionsQuiescent := fun state =>
    (targetConfig occurrence state).names = ∅
  deletionPermitted := fun _ => False
  deletion_requires_resources := by simp
  deletion_requires_quiescence := by simp
  ranking :=
    { internal := fun _ => False
      rank
        | .pending => 1
        | .completed => 0
      epoch := fun _ => occurrence.source.signatureVersion
      decreases := by simp
      epoch_preserved := by simp }

/--
The target is a typed, event-bijective recoding of the complete source
sampler, with a substantive view-specific proof on its business branch.
-/
def projection (kind : ViewKind) (occurrence : Occurrence σ) :
    ProjectionCertificate
      (Cantilune.Pi.P1cAdmittedTrajectory.lts occurrence)
      (targetLTS kind occurrence) where
  mapState := encodeState
  mapEvent := encodeEvent
  Lift := fun sourceEvent targetEvent =>
    targetEvent = encodeEvent sourceEvent
  lift_chosen := by intro event; rfl
  map_equiv := by
    intro source target equality
    subst target
    rfl
  sound := by
    rintro source event target ⟨step, _observable⟩
    cases step with
    | business =>
        exact ⟨TargetStep.business (nativePayload kind occurrence), trivial⟩
    | pendingHold =>
        exact ⟨TargetStep.pendingHold, trivial⟩
    | completedHold =>
        exact ⟨TargetStep.completedHold, trivial⟩
    | nullReset =>
        exact ⟨TargetStep.nullReset, trivial⟩
  reflect := by
    intro source event target targetStep
    cases source with
    | false =>
        rcases targetStep with ⟨step, _observable⟩
        cases step with
        | business _ =>
            exact
              ⟨.business, true,
                Cantilune.Pi.P1cAdmittedTrajectory.native_business occurrence,
                rfl, rfl⟩
        | pendingHold =>
            exact
              ⟨.pendingExternalHold, false,
                Cantilune.Pi.P1cAdmittedTrajectory.native_pending_hold
                  occurrence,
                rfl, rfl⟩
    | true =>
        rcases targetStep with ⟨step, _observable⟩
        cases step with
        | completedHold =>
            exact
              ⟨.completedExternalHold, true,
                Cantilune.Pi.P1cAdmittedTrajectory.native_completed_hold
                  occurrence,
                rfl, rfl⟩
        | nullReset =>
            exact
              ⟨.nullPathAdministrativeReset, false,
                Cantilune.Pi.P1cAdmittedTrajectory.native_null_reset occurrence,
                rfl, rfl⟩
  success_iff := by
    intro state
    simp [targetLTS, Cantilune.Pi.P1cAdmittedTrajectory.lts]
  waiting_iff := by
    intro state
    simp [targetLTS, Cantilune.Pi.P1cAdmittedTrajectory.lts]
  signatureVersion_preserved := by intro state; rfl

/-- The projection maps all four source event constructors bijectively. -/
theorem projection_event_bijective
    (kind : ViewKind) (occurrence : Occurrence σ) :
    Function.Bijective (projection kind occurrence).mapEvent :=
  encodeEvent_bijective

/--
Universal reflection for every target event, including both holds and the
zero-mass administrative reset.  This is the complete projection field, not
a theorem specialized to the business cell.
-/
theorem all_target_steps_reflect
    (kind : ViewKind) (occurrence : Occurrence σ)
    {source : Bool} {event : ViewEvent} {target : ViewState}
    (step :
      (targetLTS kind occurrence).ObservableStep
        ((projection kind occurrence).mapState source) event target) :
    ∃ sourceEvent sourceTarget,
      (Cantilune.Pi.P1cAdmittedTrajectory.lts occurrence).ObservableStep
          source sourceEvent sourceTarget ∧
        (projection kind occurrence).Lift sourceEvent event ∧
        (targetLTS kind occurrence).stateSetoid.r
          target ((projection kind occurrence).mapState sourceTarget) :=
  (projection kind occurrence).reflect step

/-- Every source constructor has its native target counterpart. -/
theorem all_four_source_events_native
    (kind : ViewKind) (occurrence : Occurrence σ) :
    (targetLTS kind occurrence).ObservableStep
        .pending .business .completed ∧
      (targetLTS kind occurrence).ObservableStep
        .pending .pendingExternalHold .pending ∧
      (targetLTS kind occurrence).ObservableStep
        .completed .completedExternalHold .completed ∧
      (targetLTS kind occurrence).ObservableStep
        .completed .nullPathAdministrativeReset .pending := by
  exact
    ⟨(projection kind occurrence).sound
        (Cantilune.Pi.P1cAdmittedTrajectory.native_business occurrence),
      (projection kind occurrence).sound
        (Cantilune.Pi.P1cAdmittedTrajectory.native_pending_hold occurrence),
      (projection kind occurrence).sound
        (Cantilune.Pi.P1cAdmittedTrajectory.native_completed_hold occurrence),
      (projection kind occurrence).sound
        (Cantilune.Pi.P1cAdmittedTrajectory.native_null_reset occurrence)⟩

abbrev sourcePackage (occurrence : Occurrence σ) :=
  Cantilune.Pi.P1cAdmittedTrajectory.package occurrence

def candidate (occurrence : Occurrence σ) :
    Candidate (sourcePackage occurrence) where
  before := false
  event := .business
  after := true

/-- The source package explicitly classifies the business event as external. -/
theorem rankEvidence (occurrence : Occurrence σ) :
    RuleRankEvidence
      (sourcePackage occurrence)
      (before := (candidate occurrence).before)
      (event := (candidate occurrence).event)
      (after := (candidate occurrence).after) where
  decreases_if_internal := by
    intro internal
    change False at internal
    contradiction
  epoch_preserved_if_internal := by
    intro internal
    change False at internal
    contradiction

/-- Qualification identifies the actual admitted P1c business occurrence. -/
def RuleQualified (occurrence : Occurrence σ) :
    Bool → Cantilune.Pi.P1cAdmittedTrajectory.Event → Bool → Prop :=
  fun before event after =>
    before = false ∧ event = .business ∧ after = true ∧
      occurrence.request.Enabled occurrence.source

/--
Authorization additionally requires concrete source resource clearance and
session quiescence.
-/
def RuleAuthorized (occurrence : Occurrence σ) :
    Bool → Cantilune.Pi.P1cAdmittedTrajectory.Event → Bool → Prop :=
  fun before event after =>
    RuleQualified occurrence before event after ∧
      (sourcePackage occurrence).resourcesClear before ∧
      (sourcePackage occurrence).sessionsQuiescent before

theorem safety
    (occurrence : Occurrence σ)
    (sourceResources : occurrence.source.resourceTokens = ∅)
    (targetResources : occurrence.target.resourceTokens = ∅)
    (sourceNames : occurrence.source.names = ∅)
    (targetNames : occurrence.target.names = ∅) :
    ResourceQuiescenceEvidence
      (sourcePackage occurrence)
      (targetPackage .dag occurrence)
      (targetPackage .petri occurrence)
      (targetPackage .pi occurrence)
      (targetPackage .morphism occurrence)
      (projection .dag occurrence)
      (projection .petri occurrence)
      (projection .pi occurrence)
      (projection .morphism occurrence)
      (candidate occurrence) where
  sourceResourcesBefore := sourceResources
  sourceResourcesAfter := targetResources
  sourceSessionsBefore := sourceNames
  sourceSessionsAfter := targetNames
  dagResourcesBefore := sourceResources
  dagResourcesAfter := targetResources
  dagSessionsBefore := sourceNames
  dagSessionsAfter := targetNames
  petriResourcesBefore := sourceResources
  petriResourcesAfter := targetResources
  petriSessionsBefore := sourceNames
  petriSessionsAfter := targetNames
  piResourcesBefore := sourceResources
  piResourcesAfter := targetResources
  piSessionsBefore := sourceNames
  piSessionsAfter := targetNames
  morphismResourcesBefore := sourceResources
  morphismResourcesAfter := targetResources
  morphismSessionsBefore := sourceNames
  morphismSessionsAfter := targetNames

def positiveLabelling (occurrence : Occurrence σ) :
    PositiveEventLabelling
      (Cantilune.Pi.P1cAdmittedTrajectory.stateKernel occurrence) :=
  (Cantilune.Pi.P1cAdmittedTrajectory.totalLabelling occurrence).toPositive

theorem positiveAlignment (occurrence : Occurrence σ) :
    PositiveEpochKernelAlignment
      (positiveLabelling occurrence)
      (Cantilune.Pi.P1cAdmittedTrajectory.window occurrence) where
  stable_state_version := by
    intro state
    cases state <;> rfl
  opportunity_noninternal := by
    intro source target positive
    change ¬False
    simp

def externalScheduling (occurrence : Occurrence σ) :
    ExternalSchedulingEvidence
      (sourcePackage occurrence)
      (Cantilune.Pi.P1cAdmittedTrajectory.stateKernel occurrence)
      (Cantilune.Pi.P1cAdmittedTrajectory.progress occurrence)
      (before := false) (event := .business) (after := true) where
  labelling := positiveLabelling occurrence
  alignment := positiveAlignment occurrence
  kernelSource := false
  kernelTarget := true
  kernelSourceMaps := rfl
  kernelTargetMaps := rfl
  probabilityPositive := by
    norm_num [Cantilune.Pi.P1cAdmittedTrajectory.stateKernel,
      Cantilune.Pi.P1cAdmittedTrajectory.transition]
  selectedRuleEvent := rfl

def probabilityObligations (occurrence : Occurrence σ) :
    ProbabilitySchedulingObligations
      (sourcePackage occurrence)
      (Cantilune.Pi.P1cAdmittedTrajectory.stateKernel occurrence)
      Cantilune.Pi.P1cAdmittedTrajectory.initial
      (1 : Real)
      (rankEvidence occurrence) where
  stableWindow := Cantilune.Pi.P1cAdmittedTrajectory.window occurrence
  progress := Cantilune.Pi.P1cAdmittedTrajectory.progress occurrence
  progressWindow := rfl
  positiveEpsilon := by norm_num
  epsilonAtMostOne := by norm_num
  scheduling := .external (externalScheduling occurrence)

/--
Every admitted P1c occurrence with empty live resource and name sets yields a
complete non-identity four-view product-rule proof bundle.
-/
def bundle
    (occurrence : Occurrence σ)
    (sourceResources : occurrence.source.resourceTokens = ∅)
    (targetResources : occurrence.target.resourceTokens = ∅)
    (sourceNames : occurrence.source.names = ∅)
    (targetNames : occurrence.target.names = ∅) :
    ProductRuleProofBundle
      (sourcePackage occurrence)
      (targetPackage .dag occurrence)
      (targetPackage .petri occurrence)
      (targetPackage .pi occurrence)
      (targetPackage .morphism occurrence)
      (projection .dag occurrence)
      (projection .petri occurrence)
      (projection .pi occurrence)
      (projection .morphism occurrence)
      (Cantilune.Pi.P1cAdmittedTrajectory.stateKernel occurrence)
      Cantilune.Pi.P1cAdmittedTrajectory.initial
      (1 : Real)
      (RuleQualified occurrence)
      (RuleAuthorized occurrence)
      (candidate occurrence) where
  sourceOccurrence :=
    SourceOccurrenceEvidence.ofNative
      (Cantilune.Pi.P1cAdmittedTrajectory.native_business occurrence)
  rank := rankEvidence occurrence
  resourceQuiescence :=
    safety occurrence sourceResources targetResources sourceNames targetNames
  dag :=
    ProjectionOccurrenceEvidence.ofProjection
      (Cantilune.Pi.P1cAdmittedTrajectory.native_business occurrence)
  petri :=
    ProjectionOccurrenceEvidence.ofProjection
      (Cantilune.Pi.P1cAdmittedTrajectory.native_business occurrence)
  pi :=
    ProjectionOccurrenceEvidence.ofProjection
      (Cantilune.Pi.P1cAdmittedTrajectory.native_business occurrence)
  morphism :=
    ProjectionOccurrenceEvidence.ofProjection
      (Cantilune.Pi.P1cAdmittedTrajectory.native_business occurrence)
  qualified :=
    ⟨rfl, rfl, rfl, occurrence.request_enabled⟩
  authorized :=
    ⟨⟨rfl, rfl, rfl, occurrence.request_enabled⟩,
      sourceResources, sourceNames⟩
  probability := probabilityObligations occurrence

/-! ## Concrete nontrivial reconnect reference -/

namespace Reference

def signature : FinSignature where
  Obj := PUnit
  Gen := PUnit
  objFintype := inferInstance
  genFintype := inferInstance
  objDecidableEq := inferInstance
  genDecidableEq := inferInstance
  input := fun _ => []
  output := fun _ => []
  mode := fun _ => .linear
  contract := fun _ => {}

def pairConfig : Config signature where
  signatureVersion := 3
  nodes := {0, 1}
  edges := ∅
  nodeLabel := fun node =>
    if node = 0 ∨ node = 1 then some PUnit.unit else none
  dataTokens := ∅
  resourceTokens := ∅
  names := ∅
  dataOwner := fun _ => none
  resourceOwner := fun _ => none
  sessionOwner := fun _ => none
  externalObservations := []
  policyState := 5
  tombstones := ∅

theorem pair_wellFormed : pairConfig.WellFormed := by
  constructor
  · intro node
    simp [pairConfig]
  · intro edge member
    simp [pairConfig] at member

theorem pair_acyclic : Acyclic pairConfig :=
  acyclic_of_edges_empty rfl

theorem pair_ownershipWellFormed : pairConfig.OwnershipWellFormed := by
  simp [Config.OwnershipWellFormed, pairConfig]

theorem reconnect_target_wellFormed :
    (applyRequest pairConfig (.reconnect 0 1)).WellFormed := by
  constructor
  · intro node
    simp [applyRequest, pairConfig]
  · intro edge member
    have edgeShape : edge = (0, 1) := by
      simpa [applyRequest, pairConfig] using member
    subst edge
    decide

theorem reconnect_target_acyclic :
    Acyclic (applyRequest pairConfig (.reconnect 0 1)) := by
  apply acyclic_of_rank (rank := id)
  intro edge member
  simp [applyRequest, pairConfig] at member
  subst edge
  decide

def occurrence : Occurrence signature where
  source := pairConfig
  request := .reconnect 0 1
  admitted :=
    ⟨pair_wellFormed, pair_acyclic, by decide,
      reconnect_target_wellFormed, reconnect_target_acyclic,
      pair_ownershipWellFormed⟩

@[simp] theorem source_resources_empty :
    occurrence.source.resourceTokens = ∅ := rfl

@[simp] theorem target_resources_empty :
    occurrence.target.resourceTokens = ∅ := rfl

@[simp] theorem source_names_empty :
    occurrence.source.names = ∅ := rfl

@[simp] theorem target_names_empty :
    occurrence.target.names = ∅ := rfl

/-- The reference target really adds an edge; it is not an identity update. -/
theorem reconnect_changes_graph :
    occurrence.target.edges = {(0, 1)} ∧
      occurrence.target.edges ≠ occurrence.source.edges := by
  constructor
  · rfl
  · simp [occurrence, Occurrence.target, pairConfig, applyRequest]

def proofBundle :
    ProductRuleProofBundle
      (sourcePackage occurrence)
      (targetPackage .dag occurrence)
      (targetPackage .petri occurrence)
      (targetPackage .pi occurrence)
      (targetPackage .morphism occurrence)
      (projection .dag occurrence)
      (projection .petri occurrence)
      (projection .pi occurrence)
      (projection .morphism occurrence)
      (Cantilune.Pi.P1cAdmittedTrajectory.stateKernel occurrence)
      Cantilune.Pi.P1cAdmittedTrajectory.initial
      (1 : Real)
      (RuleQualified occurrence)
      (RuleAuthorized occurrence)
      (candidate occurrence) :=
  bundle occurrence rfl rfl rfl rfl

def submission :
    Submission
      (sourcePackage occurrence)
      (targetPackage .dag occurrence)
      (targetPackage .petri occurrence)
      (targetPackage .pi occurrence)
      (targetPackage .morphism occurrence)
      (projection .dag occurrence)
      (projection .petri occurrence)
      (projection .pi occurrence)
      (projection .morphism occurrence)
      (Cantilune.Pi.P1cAdmittedTrajectory.stateKernel occurrence)
      Cantilune.Pi.P1cAdmittedTrajectory.initial
      (1 : Real)
      (RuleQualified occurrence)
      (RuleAuthorized occurrence)
      (candidate occurrence) :=
  .complete proofBundle

theorem admitted : submission.Admitted :=
  Submission.complete_admitted proofBundle

/-- The four business cells expose the four independently native payloads. -/
theorem four_business_steps_native :
    Cantilune.Pi.P1cAdmittedOperations.DAG.Step
        occurrence.source occurrence.request occurrence.target ∧
      Cantilune.Pi.P1cAdmittedOperations.Petri.Step
        occurrence.source occurrence.request occurrence.target ∧
      Cantilune.Pi.Late.NativeStep
        (PiView.source occurrence.request)
        .tau
        (PiView.target occurrence.request) ∧
      Cantilune.Pi.P1cAdmittedOperations.Morphism.Step
        occurrence.source occurrence.request occurrence.target := by
  have dagStep := proofBundle.dag.native.1
  have petriStep := proofBundle.petri.native.1
  have piStep := proofBundle.pi.native.1
  have morphismStep := proofBundle.morphism.native.1
  exact
    ⟨TargetStep.business_native dagStep,
      TargetStep.business_native petriStep,
      TargetStep.business_native piStep,
      TargetStep.business_native morphismStep⟩

/-- The business event has exact positive mass one in the concrete kernel. -/
theorem business_probability_one :
    (Cantilune.Pi.P1cAdmittedTrajectory.stateKernel occurrence).probability
        false true =
      1 := rfl

/-- The selected target business record replays the actual graph update. -/
theorem dag_business_replays :
    ((targetPackage .dag occurrence).eventRecord .business).Replays
      occurrence.source occurrence.target :=
  proofBundle.dag.replay

end Reference

end Cantilune.Theorems.P1cProductRuleProofBundle
