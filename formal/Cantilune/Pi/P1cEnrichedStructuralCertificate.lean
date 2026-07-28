import Cantilune.Pi.OpenSMCActionAlpha
import Cantilune.Pi.P1cOperationRegistry
import Cantilune.Pi.P1cStructuralLateBridge

/-!
# Enriched structural P1c certificate

The raw P1c certificate proves genuine native late-pi steps, but its target
stores a literal process and a literal action.  This module constructs the
load-bearing target used at the public semantic boundary:

* operation, normative family, phase, and replay-stable metadata remain
  outside every quotient;
* process states are quotiented by the project's standard `Late.Struct`
  relation (alpha, parallel ACU, and the admitted scope laws);
* a label and its derivative are quotiented jointly by
  `OpenSMCActionAlpha.DerivativeAlpha`; and
* every transition is one strong structural late-pi step.  There is no weak
  closure and no observation filter.

The quotient relation is defined by existence of a raw representative.  A
complete `ProjectionCertificate` then proves both directions between the raw
structural presentation and the enriched quotient.  Separately, all sixty
registry entries and every explicit phase of the fifteen-family reference
protocol are shown to have a genuine `Late.NativeStep` representative.

The historical no-go remains valid at exactly its old boundary: a bare raw
transition triple cannot recover the source family.  The enriched target does
not contradict that theorem; it retains the registry operation and stable
metadata outside the raw transition triple.
-/

namespace Cantilune.Pi.P1cEnrichedStructuralCertificate

open Cantilune.Core
open Cantilune.Pi
open Cantilune.Pi.OpenSMCActionAlpha
open Cantilune.Pi.P1cFullNativeRefinement
open Cantilune.Pi.P1cMatrix
open Cantilune.Pi.P1cOperationRegistry

/-! ## Explicit phase policy -/

/--
The only phase edges admitted by the normative P1c target.

The first constructor covers the first strong step of every family.  The
remaining constructors expose the three transactions which have a second
strong step rather than hiding it in a weak transition.
-/
inductive PhaseEdge : SourceEvent → Phase → Phase → Prop where
  | first (family : SourceEvent) :
      PhaseEdge family .requested (firstTargetPhase family)
  | openClosePayload :
      PhaseEdge .openClose .sessionEstablished .completed
  | restrictionPayload :
      PhaseEdge .restriction .sessionEstablished .completed
  | admissionReconnect :
      PhaseEdge .dynamicPartnerAdmission .admitted .reconnected

/-! ## Raw structural presentation -/

/--
The proof-relevant raw state.  Audit identity is not quotiented; only
`process` participates in `RawStateEquiv`.
-/
structure RawState where
  operation : OperationId
  metadata : StableMetadata
  phase : Phase
  process : Raw.Proc

namespace RawState

/-- The normative family is the total registry image of the operation. -/
def family (state : RawState) : SourceEvent :=
  familyAt state.operation

end RawState

/--
A raw labelled derivative with all audit fields outside the derivative.
`derivativeTarget` is part of the label because input and bound-output labels
bind names jointly in their derivative.
-/
structure RawAction where
  operation : OperationId
  metadata : StableMetadata
  fromPhase : Phase
  toPhase : Phase
  nativeAction : Raw.Action
  derivativeTarget : Raw.Proc

/-- Equality of audit data and structural congruence of the carried process. -/
def RawStateEquiv (left right : RawState) : Prop :=
  left.operation = right.operation ∧
    left.metadata = right.metadata ∧
    left.phase = right.phase ∧
    Late.Struct left.process right.process

theorem rawStateEquiv_equivalence : Equivalence RawStateEquiv := by
  constructor
  · intro state
    exact ⟨rfl, rfl, rfl, Late.Struct.refl _⟩
  · intro left right relation
    exact
      ⟨relation.1.symm, relation.2.1.symm, relation.2.2.1.symm,
        Late.Struct.symm relation.2.2.2⟩
  · intro left middle right first second
    exact
      ⟨first.1.trans second.1,
        first.2.1.trans second.2.1,
        first.2.2.1.trans second.2.2.1,
        Late.Struct.trans first.2.2.2 second.2.2.2⟩

def rawStateSetoid : Setoid RawState where
  r := RawStateEquiv
  iseqv := rawStateEquiv_equivalence

/--
One raw strong structural late-pi step.

The operational derivative is allowed to differ structurally from the stored
target representative.  This is exactly what makes the presentation stable
under changing the target representative while keeping the event fixed.
-/
def RawStep (source : RawState) (event : RawAction)
    (target : RawState) : Prop :=
  source.operation = event.operation ∧
    event.operation = target.operation ∧
    source.metadata = event.metadata ∧
    event.metadata = target.metadata ∧
    source.phase = event.fromPhase ∧
    target.phase = event.toPhase ∧
    PhaseEdge (familyAt event.operation) event.fromPhase event.toPhase ∧
    Late.Step source.process event.nativeAction event.derivativeTarget ∧
    Late.Struct event.derivativeTarget target.process

private theorem rawStep_transport
    {source source' target target' : RawState}
    {event : RawAction}
    (sourceEquiv : RawStateEquiv source source')
    (targetEquiv : RawStateEquiv target target')
    (step : RawStep source event target) :
    RawStep source' event target' := by
  rcases sourceEquiv with
    ⟨sourceOperation, sourceMetadata, sourcePhase, sourceProcess⟩
  rcases targetEquiv with
    ⟨targetOperation, targetMetadata, targetPhase, targetProcess⟩
  rcases step with
    ⟨sourceEventOperation, eventTargetOperation,
      sourceEventMetadata, eventTargetMetadata,
      sourceEventPhase, targetEventPhase,
      phaseEdge, operational, endpoint⟩
  refine
    ⟨sourceOperation.symm.trans sourceEventOperation,
      eventTargetOperation.trans targetOperation,
      sourceMetadata.symm.trans sourceEventMetadata,
      eventTargetMetadata.trans targetMetadata,
      sourcePhase.symm.trans sourceEventPhase,
      targetPhase.symm.trans targetEventPhase,
      phaseEdge, ?_, Late.Struct.trans endpoint targetProcess⟩
  exact
    (Late.step_congr_iff sourceProcess
      (Late.Struct.refl event.derivativeTarget)).mp operational

theorem rawStep_congr_iff
    {source source' target target' : RawState}
    {event : RawAction}
    (sourceEquiv : RawStateEquiv source source')
    (targetEquiv : RawStateEquiv target target') :
    RawStep source event target ↔ RawStep source' event target' := by
  constructor
  · exact rawStep_transport sourceEquiv targetEquiv
  · exact rawStep_transport
      (rawStateEquiv_equivalence.symm sourceEquiv)
      (rawStateEquiv_equivalence.symm targetEquiv)

def successfulPhase : Phase → Prop
  | .completed
  | .reconnected
  | .quiescentDeleted => True
  | .requested
  | .sessionEstablished
  | .admitted => False

/-- The raw presentation, saturated under structural state equivalence. -/
def rawLTS : ObservableLTS where
  State := RawState
  Event := RawAction
  stateSetoid := rawStateSetoid
  step := RawStep
  observable := fun _ => True
  success := fun state => successfulPhase state.phase
  waiting := fun _ => False
  signatureVersion := fun state => state.metadata.version
  step_congr := by
    intro source source' event target target' sourceEquiv targetEquiv
    exact rawStep_congr_iff sourceEquiv targetEquiv
  success_congr := by
    intro source target relation
    rw [show source.phase = target.phase from relation.2.2.1]
  waiting_congr := by
    intro source target relation
    rfl
  signatureVersion_congr := by
    intro source target relation
    rw [show source.metadata = target.metadata from relation.2.1]

/-! ## Enriched structural quotient target -/

/--
The target state.  Registry identity, the derived family, replay metadata,
and phase remain concrete; only the process is a `Late.Struct` quotient.
-/
structure State where
  operation : OperationId
  metadata : StableMetadata
  phase : Phase
  process : Late.StructuralProcess

@[ext]
theorem State.ext
    {left right : State}
    (operation : left.operation = right.operation)
    (metadata : left.metadata = right.metadata)
    (phase : left.phase = right.phase)
    (process : left.process = right.process) :
    left = right := by
  cases left
  cases right
  simp_all

namespace State

def family (state : State) : SourceEvent :=
  familyAt state.operation

end State

/--
The target event.  The binder-bearing action and derivative are one
`DerivativeAlpha` quotient; audit fields and phases remain outside it.
-/
structure Action where
  operation : OperationId
  metadata : StableMetadata
  fromPhase : Phase
  toPhase : Phase
  derivative : AlphaDerivative

@[ext]
theorem Action.ext
    {left right : Action}
    (operation : left.operation = right.operation)
    (metadata : left.metadata = right.metadata)
    (fromPhase : left.fromPhase = right.fromPhase)
    (toPhase : left.toPhase = right.toPhase)
    (derivative : left.derivative = right.derivative) :
    left = right := by
  cases left
  cases right
  simp_all

/--
The exact quotient transition relation.

An inhabitant contains one raw strong structural late-pi representative.
Both process endpoints and the joint derivative are related to the public
quotients by equality.  Thus the definition does not choose representatives.
-/
def Step (source : State) (event : Action) (target : State) : Prop :=
  source.operation = event.operation ∧
    event.operation = target.operation ∧
    source.metadata = event.metadata ∧
    event.metadata = target.metadata ∧
    source.phase = event.fromPhase ∧
    target.phase = event.toPhase ∧
    PhaseEdge (familyAt event.operation) event.fromPhase event.toPhase ∧
    ∃ rawSource nativeAction rawTarget,
      source.process =
          Quotient.mk Late.Struct.setoid rawSource ∧
      event.derivative =
          Quotient.mk DerivativeAlpha.setoid
            ({ action := nativeAction, target := rawTarget } :
              LabelledDerivative) ∧
      target.process =
          Quotient.mk Late.Struct.setoid rawTarget ∧
      Late.Step rawSource nativeAction rawTarget

/--
Exhaustiveness is definitional: target steps are exactly raw strong
structural representatives satisfying the public quotient equalities.
-/
theorem step_iff_raw_representative
    (source : State) (event : Action) (target : State) :
    Step source event target ↔
      source.operation = event.operation ∧
        event.operation = target.operation ∧
        source.metadata = event.metadata ∧
        event.metadata = target.metadata ∧
        source.phase = event.fromPhase ∧
        target.phase = event.toPhase ∧
        PhaseEdge (familyAt event.operation)
          event.fromPhase event.toPhase ∧
        ∃ rawSource nativeAction rawTarget,
          source.process =
              Quotient.mk Late.Struct.setoid rawSource ∧
          event.derivative =
              Quotient.mk DerivativeAlpha.setoid
                ({ action := nativeAction, target := rawTarget } :
                  LabelledDerivative) ∧
          target.process =
              Quotient.mk Late.Struct.setoid rawTarget ∧
          Late.Step rawSource nativeAction rawTarget :=
  Iff.rfl

/-- The enriched target is already quotiented, so its outer setoid is equality. -/
def targetLTS : ObservableLTS where
  State := State
  Event := Action
  stateSetoid := ObservableLTS.equalitySetoid State
  step := Step
  observable := fun _ => True
  success := fun state => successfulPhase state.phase
  waiting := fun _ => False
  signatureVersion := fun state => state.metadata.version
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

def mapState (state : RawState) : State where
  operation := state.operation
  metadata := state.metadata
  phase := state.phase
  process := Quotient.mk Late.Struct.setoid state.process

def mapAction (event : RawAction) : Action where
  operation := event.operation
  metadata := event.metadata
  fromPhase := event.fromPhase
  toPhase := event.toPhase
  derivative :=
    Quotient.mk DerivativeAlpha.setoid
      ({ action := event.nativeAction, target := event.derivativeTarget } :
        LabelledDerivative)

theorem mapState_respects_equiv
    {source target : RawState}
    (relation : RawStateEquiv source target) :
    mapState source = mapState target := by
  rcases relation with
    ⟨operation, metadata, phase, process⟩
  cases source with
  | mk sourceOperation sourceMetadata sourcePhase sourceProcess =>
      cases target with
      | mk targetOperation targetMetadata targetPhase targetProcess =>
          simp only at operation metadata phase process
          subst targetOperation
          subst targetMetadata
          subst targetPhase
          apply State.ext <;> simp only [mapState]
          exact Quotient.sound process

/-- Raw structural soundness into the fully enriched quotient target. -/
theorem quotient_sound
    {source : RawState} {event : RawAction} {target : RawState}
    (step : RawStep source event target) :
    Step (mapState source) (mapAction event) (mapState target) := by
  rcases step with
    ⟨sourceOperation, targetOperation,
      sourceMetadata, targetMetadata,
      sourcePhase, targetPhase,
      phaseEdge, operational, endpoint⟩
  refine
    ⟨sourceOperation, targetOperation,
      sourceMetadata, targetMetadata,
      sourcePhase, targetPhase,
      phaseEdge,
      source.process, event.nativeAction, event.derivativeTarget,
      rfl, rfl, ?_, operational⟩
  exact Quotient.sound (Late.Struct.symm endpoint)

/--
Reflection chooses one raw representative of the quotient event and transports
its structural step back to the caller's raw source representative.
-/
theorem quotient_reflect
    {source : RawState} {event : Action} {target : State}
    (step : Step (mapState source) event target) :
    ∃ rawEvent rawTarget,
      RawStep source rawEvent rawTarget ∧
      mapAction rawEvent = event ∧
      mapState rawTarget = target := by
  rcases step with
    ⟨sourceOperation, targetOperation,
      sourceMetadata, targetMetadata,
      sourcePhase, targetPhase,
      phaseEdge,
      rawSource, nativeAction, rawDerivativeTarget,
      sourceRepresentative, derivativeRepresentative,
      targetRepresentative, operational⟩
  have sourceStruct :
      Late.Struct source.process rawSource := by
    exact Quotient.exact sourceRepresentative
  let rawEvent : RawAction :=
    { operation := event.operation
      metadata := event.metadata
      fromPhase := event.fromPhase
      toPhase := event.toPhase
      nativeAction := nativeAction
      derivativeTarget := rawDerivativeTarget }
  let rawTarget : RawState :=
    { operation := target.operation
      metadata := target.metadata
      phase := target.phase
      process := rawDerivativeTarget }
  refine ⟨rawEvent, rawTarget, ?_, ?_, ?_⟩
  · refine
      ⟨sourceOperation,
        targetOperation,
        sourceMetadata,
        targetMetadata,
        sourcePhase,
        targetPhase,
        phaseEdge, ?_, Late.Struct.refl _⟩
    exact
      (Late.step_congr_iff sourceStruct
        (Late.Struct.refl rawDerivativeTarget)).mpr operational
  · apply Action.ext <;> simp only [mapAction, rawEvent]
    exact derivativeRepresentative.symm
  · apply State.ext <;> simp only [mapState, rawTarget]
    exact targetRepresentative.symm

/-- The quotient map is a complete one-step projection, not merely a map. -/
def certificate : ProjectionCertificate rawLTS targetLTS where
  mapState := mapState
  mapEvent := mapAction
  Lift := fun sourceEvent targetEvent =>
    mapAction sourceEvent = targetEvent
  lift_chosen := by
    intro event
    rfl
  map_equiv := mapState_respects_equiv
  sound := by
    intro source event target observableStep
    exact ⟨quotient_sound observableStep.1, trivial⟩
  reflect := by
    intro source event target observableStep
    rcases quotient_reflect observableStep.1 with
      ⟨rawEvent, rawTarget, rawStep, eventEq, targetEq⟩
    exact
      ⟨rawEvent, rawTarget, ⟨rawStep, trivial⟩,
        eventEq, targetEq.symm⟩
  success_iff := by
    intro state
    rfl
  waiting_iff := by
    intro state
    rfl
  signatureVersion_preserved := by
    intro state
    rfl

theorem stable_metadata_preserved
    {source : State} {event : Action} {target : State}
    (step : Step source event target) :
    source.metadata = event.metadata ∧
      event.metadata = target.metadata := by
  exact ⟨step.2.2.1, step.2.2.2.1⟩

theorem stable_identifiers_preserved
    {source : State} {event : Action} {target : State}
    (step : Step source event target) :
    source.metadata.version = target.metadata.version ∧
      source.metadata.rule = target.metadata.rule ∧
      source.metadata.session = target.metadata.session ∧
      source.metadata.correlation = target.metadata.correlation ∧
      source.metadata.occurrence = target.metadata.occurrence := by
  have metadata :=
    (stable_metadata_preserved step).1.trans
      (stable_metadata_preserved step).2
  exact
    ⟨congrArg StableMetadata.version metadata,
      congrArg StableMetadata.rule metadata,
      congrArg StableMetadata.session metadata,
      congrArg StableMetadata.correlation metadata,
      congrArg StableMetadata.occurrence metadata⟩

theorem operation_family_and_phase_preserved
    {source : State} {event : Action} {target : State}
    (step : Step source event target) :
    source.operation = event.operation ∧
      event.operation = target.operation ∧
      source.family = target.family ∧
      source.phase = event.fromPhase ∧
      target.phase = event.toPhase := by
  exact
    ⟨step.1, step.2.1,
      congrArg familyAt (step.1.trans step.2.1),
      step.2.2.2.2.1, step.2.2.2.2.2.1⟩

/-! ## Canonical representatives for all registry operations and phases -/

def phaseOf : P1cFullNativeRefinement.State → Phase
  | .ready _ => .requested
  | .openCloseEstablished
  | .restrictionEstablished => .sessionEstablished
  | .admissionEstablished => .admitted
  | .completed .dynamicPartnerAdmission
  | .completed .instanceReconnect => .reconnected
  | .completed .instanceDeleteQuiescent => .quiescentDeleted
  | .completed _ => .completed

@[simp]
theorem phaseOf_afterFirst (family : SourceEvent) :
    phaseOf (afterFirst family) = firstTargetPhase family := by
  cases family <;> rfl

def rawStateOf
    (operation : OperationId) (metadata : StableMetadata)
    (state : P1cFullNativeRefinement.State) : RawState where
  operation := operation
  metadata := metadata
  phase := phaseOf state
  process := stateProcess state

def rawActionOf
    (operation : OperationId) (metadata : StableMetadata)
    (source : P1cFullNativeRefinement.State)
    (event : P1cFullNativeRefinement.Event)
    (target : P1cFullNativeRefinement.State) : RawAction where
  operation := operation
  metadata := metadata
  fromPhase := phaseOf source
  toPhase := phaseOf target
  nativeAction := mapEvent event
  derivativeTarget := stateProcess target

private theorem phaseEdge_of_refined_step
    {source : P1cFullNativeRefinement.State}
    {event : P1cFullNativeRefinement.Event}
    {target : P1cFullNativeRefinement.State}
    (step : P1cFullNativeRefinement.Step source event target)
    (operation : OperationId)
    (familyCompatible :
      stateFamily source = familyAt operation) :
    PhaseEdge (familyAt operation) (phaseOf source) (phaseOf target) := by
  cases step with
  | execute family =>
      change family = familyAt operation at familyCompatible
      rw [← familyCompatible]
      cases family <;> exact PhaseEdge.first _
  | openClosePayload =>
      change SourceEvent.openClose = familyAt operation at familyCompatible
      rw [← familyCompatible]
      exact PhaseEdge.openClosePayload
  | restrictionPayload =>
      change SourceEvent.restriction = familyAt operation at familyCompatible
      rw [← familyCompatible]
      exact PhaseEdge.restrictionPayload
  | admissionReconnect =>
      change
        SourceEvent.dynamicPartnerAdmission = familyAt operation
          at familyCompatible
      rw [← familyCompatible]
      exact PhaseEdge.admissionReconnect

/--
Every one of the fifteen first events and every explicit follow-up phase maps
to one raw structural source step.  Its operational witness is the existing
genuine `Late.NativeStep`, injected once into `Late.Step`.
-/
theorem refined_step_raw_observable
    {source : P1cFullNativeRefinement.State}
    {event : P1cFullNativeRefinement.Event}
    {target : P1cFullNativeRefinement.State}
    (step : P1cFullNativeRefinement.Step source event target)
    (operation : OperationId)
    (metadata : StableMetadata)
    (familyCompatible :
      stateFamily source = familyAt operation) :
    rawLTS.ObservableStep
      (rawStateOf operation metadata source)
      (rawActionOf operation metadata source event target)
      (rawStateOf operation metadata target) := by
  refine ⟨?_, trivial⟩
  exact
    ⟨rfl, rfl, rfl, rfl, rfl, rfl,
      phaseEdge_of_refined_step step operation familyCompatible,
      Late.Step.native (P1cFullNativeRefinement.native_sound step),
      Late.Struct.refl _⟩

/-- The corresponding enriched quotient step, obtained by certificate soundness. -/
theorem refined_step_target_observable
    {source : P1cFullNativeRefinement.State}
    {event : P1cFullNativeRefinement.Event}
    {target : P1cFullNativeRefinement.State}
    (step : P1cFullNativeRefinement.Step source event target)
    (operation : OperationId)
    (metadata : StableMetadata)
    (familyCompatible :
      stateFamily source = familyAt operation) :
    targetLTS.ObservableStep
      (mapState (rawStateOf operation metadata source))
      (mapAction (rawActionOf operation metadata source event target))
      (mapState (rawStateOf operation metadata target)) :=
  certificate.sound
    (refined_step_raw_observable
      step operation metadata familyCompatible)

/-- All sixty registered first events have a genuine raw native witness. -/
theorem all_registry_first_native
    (operation : OperationId) (_metadata : StableMetadata) :
    Late.NativeStep
      (readyProcess (familyAt operation))
      (firstAction (familyAt operation))
      (firstTarget (familyAt operation)) :=
  registry_has_genuine_strong_step operation

/-- All sixty registered first events inhabit the enriched quotient target. -/
theorem all_registry_first_target_step
    (operation : OperationId) (metadata : StableMetadata) :
    targetLTS.ObservableStep
      (mapState
        (rawStateOf operation metadata
          (.ready (familyAt operation))))
      (mapAction
        (rawActionOf operation metadata
          (.ready (familyAt operation))
          (.execute (familyAt operation))
          (afterFirst (familyAt operation))))
      (mapState
        (rawStateOf operation metadata
          (afterFirst (familyAt operation)))) := by
  exact refined_step_target_observable
    (.execute (familyAt operation)) operation metadata rfl

/--
The raw triple still cannot recover all source families.  This theorem is
deliberately re-exported rather than weakened by the enriched construction.
-/
theorem bare_raw_transition_recovery_no_go :
    ¬ ∃ recover : Raw.Proc → Raw.Action → Raw.Proc → SourceEvent,
      ∀ family,
        recover (readyProcess family) (firstAction family)
            (firstTarget family) =
          family :=
  P1cStructuralLateBridge.Refined.no_source_event_recovery_from_raw_transition

/-! ## Product-occurrence adapter -/

/--
The minimal exact seam a product candidate supplies to enter the enriched
P1c target.

The source occurrence remains an independently proved step of `product`.
The remaining fields decode that exact occurrence into one registry
operation, canonical replay metadata, an admitted phase edge, and one
genuine raw native late-pi step.  No target theorem is supplied as a field.
-/
structure ProductOccurrenceAlignment
    (product : ObservableLTS)
    (source : product.State) (event : product.Event)
    (target : product.State) where
  productStep : product.ObservableStep source event target
  operation : OperationId
  metadata : StableMetadata
  fromPhase : Phase
  toPhase : Phase
  sourceProcess : Raw.Proc
  nativeAction : Raw.Action
  targetProcess : Raw.Proc
  phaseEdge :
    PhaseEdge (familyAt operation) fromPhase toPhase
  native :
    Late.NativeStep sourceProcess nativeAction targetProcess

namespace ProductOccurrenceAlignment

variable
    {product : ObservableLTS}
    {source : product.State} {event : product.Event}
    {target : product.State}

def rawSource
    (alignment :
      ProductOccurrenceAlignment product source event target) :
    RawState :=
  { operation := alignment.operation
    metadata := alignment.metadata
    phase := alignment.fromPhase
    process := alignment.sourceProcess }

def rawEvent
    (alignment :
      ProductOccurrenceAlignment product source event target) :
    RawAction :=
  { operation := alignment.operation
    metadata := alignment.metadata
    fromPhase := alignment.fromPhase
    toPhase := alignment.toPhase
    nativeAction := alignment.nativeAction
    derivativeTarget := alignment.targetProcess }

def rawTarget
    (alignment :
      ProductOccurrenceAlignment product source event target) :
    RawState :=
  { operation := alignment.operation
    metadata := alignment.metadata
    phase := alignment.toPhase
    process := alignment.targetProcess }

/-- The product seam constructs the raw source edge; it does not assume it. -/
theorem rawStructuralStep
    (alignment :
      ProductOccurrenceAlignment product source event target) :
    RawStep alignment.rawSource alignment.rawEvent alignment.rawTarget :=
  ⟨rfl, rfl, rfl, rfl, rfl, rfl, alignment.phaseEdge,
    Late.Step.native alignment.native, Late.Struct.refl _⟩

/-- Every aligned product occurrence constructs its enriched quotient edge. -/
theorem enrichedTargetStep
    (alignment :
      ProductOccurrenceAlignment product source event target) :
    targetLTS.ObservableStep
      (mapState alignment.rawSource)
      (mapAction alignment.rawEvent)
      (mapState alignment.rawTarget) :=
  certificate.sound ⟨alignment.rawStructuralStep, trivial⟩

theorem family_exact
    (alignment :
      ProductOccurrenceAlignment product source event target) :
    (mapState alignment.rawSource).family =
      familyAt alignment.operation :=
  rfl

theorem metadata_exact
    (alignment :
      ProductOccurrenceAlignment product source event target) :
    (mapState alignment.rawSource).metadata = alignment.metadata ∧
      (mapAction alignment.rawEvent).metadata = alignment.metadata ∧
      (mapState alignment.rawTarget).metadata = alignment.metadata :=
  ⟨rfl, rfl, rfl⟩

end ProductOccurrenceAlignment

/-! ## One load-bearing aggregate -/

/--
The kernel-checked CENTRAL-14 claim.

`certificate` is the reusable data interface.  This proposition records its
load-bearing coverage facts: exact 15/60 cardinalities, total registry
coverage, genuine native representatives, complete quotient
soundness/reflection, stable audit identity, and the raw-recovery no-go.
-/
structure CompleteEnrichedStructuralP1c : Prop where
  familyCount : Fintype.card SourceEvent = 15
  registryCount : Fintype.card OperationId = 60
  registryCoversFamilies : Function.Surjective familyAt
  everyRegistryFirstIsNative :
    ∀ (operation : OperationId) (_metadata : StableMetadata),
      Late.NativeStep
        (readyProcess (familyAt operation))
        (firstAction (familyAt operation))
        (firstTarget (familyAt operation))
  everyRegistryFirstIsEnriched :
    ∀ (operation : OperationId) (metadata : StableMetadata),
      targetLTS.ObservableStep
        (mapState
          (rawStateOf operation metadata
            (.ready (familyAt operation))))
        (mapAction
          (rawActionOf operation metadata
            (.ready (familyAt operation))
            (.execute (familyAt operation))
            (afterFirst (familyAt operation))))
        (mapState
          (rawStateOf operation metadata
            (afterFirst (familyAt operation))))
  everyExplicitRefinedPhaseIsNative :
    ∀ {source event target},
      P1cFullNativeRefinement.Step source event target →
        Late.NativeStep
          (stateProcess source) (mapEvent event) (stateProcess target)
  quotientSound :
    ∀ {source event target},
      RawStep source event target →
        Step (mapState source) (mapAction event) (mapState target)
  quotientReflect :
    ∀ {source event target},
      Step (mapState source) event target →
        ∃ rawEvent rawTarget,
          RawStep source rawEvent rawTarget ∧
          mapAction rawEvent = event ∧
          mapState rawTarget = target
  stableIdentity :
    ∀ {source event target},
      Step source event target →
        source.metadata.version = target.metadata.version ∧
        source.metadata.rule = target.metadata.rule ∧
        source.metadata.session = target.metadata.session ∧
        source.metadata.correlation = target.metadata.correlation ∧
        source.metadata.occurrence = target.metadata.occurrence
  rawRecoveryNoGo :
    ¬ ∃ recover : Raw.Proc → Raw.Action → Raw.Proc → SourceEvent,
      ∀ family,
        recover (readyProcess family) (firstAction family)
            (firstTarget family) =
          family

/-- Complete enriched structural P1c certificate used by CENTRAL-14. -/
theorem complete_enriched_structural_p1c_certificate :
    CompleteEnrichedStructuralP1c where
  familyCount := by decide
  registryCount := by simp
  registryCoversFamilies := by decide
  everyRegistryFirstIsNative := all_registry_first_native
  everyRegistryFirstIsEnriched := all_registry_first_target_step
  everyExplicitRefinedPhaseIsNative := by
    intro source event target step
    exact P1cFullNativeRefinement.native_sound step
  quotientSound := quotient_sound
  quotientReflect := quotient_reflect
  stableIdentity := stable_identifiers_preserved
  rawRecoveryNoGo := bare_raw_transition_recovery_no_go

end Cantilune.Pi.P1cEnrichedStructuralCertificate
