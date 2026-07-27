import Cantilune.Core.CompleteProjection
import Cantilune.Pi.P1cBusinessReplayMatrix
import Cantilune.Projection.GeneralP1a

/-!
# Replayable P1a certificates for the fixed-signature P1c business calculus

The source of this module is the actual fourteen-family
`P1cBusinessReplayMatrix.ReferenceExecution.package`.  Each target LTS keeps
the business-family index in both its state and event types.  Its transition
constructor additionally contains a derivation in the independently defined
native relation from `P1cCompleteMatrix`; the wrappers therefore cannot gain a
transition merely because a source transition exists.

Signature admission is intentionally absent.  It changes the signature and
belongs to the heterogeneous admission trajectory, not to a same-signature
`ProjectionCertificate`.
-/

namespace Cantilune.Pi.P1aBusinessProjectionCertificates

open Cantilune.Core
open Cantilune.Pi.P1cMatrix
open Cantilune.Pi.P1cBusinessReplayMatrix

abbrev Source := ReferenceExecution.lts
abbrev Event := BusinessEvent

namespace DAG

/-- The family index is retained at both endpoints for exact reflection. -/
inductive State
  | ready (event : BusinessEvent)
  | completed (event : BusinessEvent)
  deriving DecidableEq, Repr

/-- Forget only the wrapper, retaining the native DAG state. -/
def nativeState : State → P1cCompleteMatrix.DAG.State
  | .ready event => P1cCompleteMatrix.DAG.ready event.1
  | .completed event => P1cCompleteMatrix.DAG.completed event.1

/--
Every wrapper transition contains an actual transition of the independently
defined event-indexed DAG relation.
-/
inductive Step : State → Event → State → Prop
  | execute (event : Event)
      (native :
        P1cCompleteMatrix.DAG.Step
          (nativeState (.ready event)) event.1
          (nativeState (.completed event))) :
      Step (.ready event) event (.completed event)

def success : State → Prop
  | .ready _ => False
  | .completed _ => True

def lts : ObservableLTS where
  State := State
  Event := Event
  stateSetoid := ObservableLTS.equalitySetoid State
  step := Step
  observable := fun _ => True
  success := success
  waiting := fun _ => False
  signatureVersion := fun _ => 0
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

def mapState : ReferenceExecution.State → State
  | .ready event => .ready event
  | .completed event => .completed event

def unmapState : State → ReferenceExecution.State
  | .ready event => .ready event
  | .completed event => .completed event

@[simp]
theorem unmap_mapState (state : ReferenceExecution.State) :
    unmapState (mapState state) = state := by
  cases state <;> rfl

theorem mapState_injective : Function.Injective mapState :=
  Function.LeftInverse.injective unmap_mapState

theorem step_characterization
    {source : State} {event : Event} {target : State}
    (step : Step source event target) :
    source = .ready event ∧ target = .completed event := by
  cases step
  exact ⟨rfl, rfl⟩

/-- Erasing the wrapper exposes the native DAG rewrite stored in the step. -/
theorem step_native
    {source : State} {event : Event} {target : State}
    (step : Step source event target) :
    P1cCompleteMatrix.DAG.Step
      (nativeState source) event.1 (nativeState target) := by
  cases step with
  | execute event native => exact native

def certificate : ProjectionCertificate Source lts where
  mapState := mapState
  mapEvent := id
  Lift := Eq
  lift_chosen := by intro event; rfl
  map_equiv := by
    intro source target equality
    subst target
    rfl
  sound := by
    rintro source event target ⟨step, _observable⟩
    cases step
    exact
      ⟨Step.execute event
          (P1cCompleteMatrix.DAG.Step.execute event.1),
        trivial⟩
  reflect := by
    rintro source event target ⟨step, _observable⟩
    obtain ⟨sourceShape, targetShape⟩ := step_characterization step
    have sourceEquality :
        source = ReferenceExecution.State.ready event :=
      mapState_injective sourceShape
    subst source
    subst target
    exact
      ⟨event, .completed event,
        ⟨ReferenceExecution.Step.execute event, trivial⟩, rfl, rfl⟩
  success_iff := by
    intro state
    cases state <;> rfl
  waiting_iff := by
    intro state
    rfl
  signatureVersion_preserved := by
    intro state
    rfl

def resourcesValid (_state : State) : Prop := True

end DAG

namespace Petri

/-- The family index is retained at both endpoints for exact reflection. -/
inductive State
  | ready (event : BusinessEvent)
  | completed (event : BusinessEvent)
  deriving DecidableEq, Repr

/-- Forget only the wrapper, retaining the native individual-token state. -/
def nativeState : State → P1cCompleteMatrix.Petri.State
  | .ready event => P1cCompleteMatrix.Petri.ready event.1
  | .completed event => P1cCompleteMatrix.Petri.completed event.1

/-- Every wrapper firing contains a native individual-token firing. -/
inductive Step : State → Event → State → Prop
  | fire (event : Event)
      (native :
        P1cCompleteMatrix.Petri.Step
          (nativeState (.ready event)) event.1
          (nativeState (.completed event))) :
      Step (.ready event) event (.completed event)

def success : State → Prop
  | .ready _ => False
  | .completed _ => True

def lts : ObservableLTS where
  State := State
  Event := Event
  stateSetoid := ObservableLTS.equalitySetoid State
  step := Step
  observable := fun _ => True
  success := success
  waiting := fun _ => False
  signatureVersion := fun _ => 0
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

def mapState : ReferenceExecution.State → State
  | .ready event => .ready event
  | .completed event => .completed event

def unmapState : State → ReferenceExecution.State
  | .ready event => .ready event
  | .completed event => .completed event

@[simp]
theorem unmap_mapState (state : ReferenceExecution.State) :
    unmapState (mapState state) = state := by
  cases state <;> rfl

theorem mapState_injective : Function.Injective mapState :=
  Function.LeftInverse.injective unmap_mapState

theorem step_characterization
    {source : State} {event : Event} {target : State}
    (step : Step source event target) :
    source = .ready event ∧ target = .completed event := by
  cases step
  exact ⟨rfl, rfl⟩

/-- Erasing the wrapper exposes the native individual-token firing. -/
theorem step_native
    {source : State} {event : Event} {target : State}
    (step : Step source event target) :
    P1cCompleteMatrix.Petri.Step
      (nativeState source) event.1 (nativeState target) := by
  cases step with
  | fire event native => exact native

def certificate : ProjectionCertificate Source lts where
  mapState := mapState
  mapEvent := id
  Lift := Eq
  lift_chosen := by intro event; rfl
  map_equiv := by
    intro source target equality
    subst target
    rfl
  sound := by
    rintro source event target ⟨step, _observable⟩
    cases step
    exact
      ⟨Step.fire event
          (P1cCompleteMatrix.Petri.Step.fire event.1),
        trivial⟩
  reflect := by
    rintro source event target ⟨step, _observable⟩
    obtain ⟨sourceShape, targetShape⟩ := step_characterization step
    have sourceEquality :
        source = ReferenceExecution.State.ready event :=
      mapState_injective sourceShape
    subst source
    subst target
    exact
      ⟨event, .completed event,
        ⟨ReferenceExecution.Step.execute event, trivial⟩, rfl, rfl⟩
  success_iff := by
    intro state
    cases state <;> rfl
  waiting_iff := by
    intro state
    rfl
  signatureVersion_preserved := by
    intro state
    rfl

def resourcesValid (_state : State) : Prop := True

end Petri

namespace Morphism

/-- The total-category view retains the event family in both state forms. -/
inductive State
  | ready (event : BusinessEvent)
  | completed (event : BusinessEvent)
  deriving DecidableEq, Repr

def nativeState : State → SourceState
  | .ready event => .ready event.1
  | .completed event => .completed event.1

/-- Every wrapper arrow contains an arrow of the native morphism relation. -/
inductive Step : State → Event → State → Prop
  | map (event : Event)
      (native :
        P1cCompleteMatrix.Morphism.Step
          (nativeState (.ready event)) event.1
          (nativeState (.completed event))) :
      Step (.ready event) event (.completed event)

def success : State → Prop
  | .ready _ => False
  | .completed _ => True

def lts : ObservableLTS where
  State := State
  Event := Event
  stateSetoid := ObservableLTS.equalitySetoid State
  step := Step
  observable := fun _ => True
  success := success
  waiting := fun _ => False
  signatureVersion := fun _ => 0
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

def mapState : ReferenceExecution.State → State
  | .ready event => .ready event
  | .completed event => .completed event

def unmapState : State → ReferenceExecution.State
  | .ready event => .ready event
  | .completed event => .completed event

@[simp]
theorem unmap_mapState (state : ReferenceExecution.State) :
    unmapState (mapState state) = state := by
  cases state <;> rfl

theorem mapState_injective : Function.Injective mapState :=
  Function.LeftInverse.injective unmap_mapState

theorem step_characterization
    {source : State} {event : Event} {target : State}
    (step : Step source event target) :
    source = .ready event ∧ target = .completed event := by
  cases step
  exact ⟨rfl, rfl⟩

/-- Erasing the wrapper exposes the native total-category arrow. -/
theorem step_native
    {source : State} {event : Event} {target : State}
    (step : Step source event target) :
    P1cCompleteMatrix.Morphism.Step
      (nativeState source) event.1 (nativeState target) := by
  cases step with
  | map event native => exact native

def certificate : ProjectionCertificate Source lts where
  mapState := mapState
  mapEvent := id
  Lift := Eq
  lift_chosen := by intro event; rfl
  map_equiv := by
    intro source target equality
    subst target
    rfl
  sound := by
    rintro source event target ⟨step, _observable⟩
    cases step
    exact
      ⟨Step.map event
          (P1cCompleteMatrix.Morphism.Step.map event.1),
        trivial⟩
  reflect := by
    rintro source event target ⟨step, _observable⟩
    obtain ⟨sourceShape, targetShape⟩ := step_characterization step
    have sourceEquality :
        source = ReferenceExecution.State.ready event :=
      mapState_injective sourceShape
    subst source
    subst target
    exact
      ⟨event, .completed event,
        ⟨ReferenceExecution.Step.execute event, trivial⟩, rfl, rfl⟩
  success_iff := by
    intro state
    cases state <;> rfl
  waiting_iff := by
    intro state
    rfl
  signatureVersion_preserved := by
    intro state
    rfl

def resourcesValid (_state : State) : Prop := True

end Morphism

/-! ## Shared operational, replay, resource, and terminal bundle -/

/-- The actual source configuration has no live linear resource token. -/
def sourceResourcesValid (σ : FinSignature)
    (state : Source.State) : Prop :=
  ((ReferenceExecution.package σ).configOf state).resourceTokens = ∅

theorem sourceResourcesValid_all (σ : FinSignature)
    (state : Source.State) :
    sourceResourcesValid σ state := by
  cases state <;> rfl

/-- The three independently native target LTSs share the same source package. -/
def operational :
    Cantilune.Projection.GeneralP1a.Certificate
      Source DAG.lts Petri.lts Morphism.lts where
  dag := DAG.certificate
  petri := Petri.certificate
  morphism := Morphism.certificate

def dagResources (σ : FinSignature) :
    ResourceProjectionCompatibility DAG.certificate where
  sourceResourcesValid := sourceResourcesValid σ
  targetResourcesValid := DAG.resourcesValid
  resources_iff := by
    intro state
    constructor
    · intro _targetValid
      exact sourceResourcesValid_all σ state
    · intro _sourceValid
      trivial

def petriResources (σ : FinSignature) :
    ResourceProjectionCompatibility Petri.certificate where
  sourceResourcesValid := sourceResourcesValid σ
  targetResourcesValid := Petri.resourcesValid
  resources_iff := by
    intro state
    constructor
    · intro _targetValid
      exact sourceResourcesValid_all σ state
    · intro _sourceValid
      trivial

def morphismResources (σ : FinSignature) :
    ResourceProjectionCompatibility Morphism.certificate where
  sourceResourcesValid := sourceResourcesValid σ
  targetResourcesValid := Morphism.resourcesValid
  resources_iff := by
    intro state
    constructor
    · intro _targetValid
      exact sourceResourcesValid_all σ state
    · intro _sourceValid
      trivial

theorem dagTerminals : TerminalProjectionCompatibility DAG.certificate :=
  TerminalProjectionCompatibility.ofOperational DAG.certificate

theorem petriTerminals : TerminalProjectionCompatibility Petri.certificate :=
  TerminalProjectionCompatibility.ofOperational Petri.certificate

theorem morphismTerminals :
    TerminalProjectionCompatibility Morphism.certificate :=
  TerminalProjectionCompatibility.ofOperational Morphism.certificate

/--
One value packages all operational P1a obligations that are meaningful inside
a fixed signature, together with the source's independently replayable
`DPOEvent` records.  Static SMC and heterogeneous admission remain separate.
-/
structure ReplayableCertificate (σ : FinSignature) where
  operational :
    Cantilune.Projection.GeneralP1a.Certificate
      Source DAG.lts Petri.lts Morphism.lts
  dagResources : ResourceProjectionCompatibility operational.dag
  petriResources : ResourceProjectionCompatibility operational.petri
  morphismResources : ResourceProjectionCompatibility operational.morphism
  dagTerminals : TerminalProjectionCompatibility operational.dag
  petriTerminals : TerminalProjectionCompatibility operational.petri
  morphismTerminals : TerminalProjectionCompatibility operational.morphism
  replay :
    ∀ event,
      ((ReferenceExecution.package σ).eventRecord event).Replays
        ((ReferenceExecution.package σ).configOf (.ready event))
        ((ReferenceExecution.package σ).configOf (.completed event))

def replayableCertificate (σ : FinSignature) :
    ReplayableCertificate σ where
  operational := operational
  dagResources := dagResources σ
  petriResources := petriResources σ
  morphismResources := morphismResources σ
  dagTerminals := dagTerminals
  petriTerminals := petriTerminals
  morphismTerminals := morphismTerminals
  replay := fun event =>
    ReferenceExecution.package_replay_exact (σ := σ) event

/-- Every one of the fourteen source events has three native P1a steps. -/
theorem every_business_event_native (event : BusinessEvent) :
    DAG.lts.ObservableStep
        (.ready event) event (.completed event) ∧
      Petri.lts.ObservableStep
        (.ready event) event (.completed event) ∧
      Morphism.lts.ObservableStep
        (.ready event) event (.completed event) :=
  operational.sound_all
    ⟨ReferenceExecution.Step.execute event, trivial⟩

/-- The target wrapper steps expose the three original matrix derivations. -/
theorem every_business_event_matrix_native (event : BusinessEvent) :
    P1cCompleteMatrix.DAG.Step
        (P1cCompleteMatrix.DAG.ready event.1) event.1
        (P1cCompleteMatrix.DAG.completed event.1) ∧
      P1cCompleteMatrix.Petri.Step
        (P1cCompleteMatrix.Petri.ready event.1) event.1
        (P1cCompleteMatrix.Petri.completed event.1) ∧
      P1cCompleteMatrix.Morphism.Step
        (.ready event.1) event.1 (.completed event.1) := by
  obtain ⟨dag, petri, morphism⟩ :=
    every_business_event_native event
  exact
    ⟨DAG.step_native dag.1,
      Petri.step_native petri.1,
      Morphism.step_native morphism.1⟩

/-- Soundness and exact reflection hold simultaneously for all three views. -/
theorem paths_lift_and_reflect_all :
    Cantilune.Projection.GeneralP1a.Certificate.PathCoverage
        operational.dag ∧
      Cantilune.Projection.GeneralP1a.Certificate.PathCoverage
        operational.petri ∧
      Cantilune.Projection.GeneralP1a.Certificate.PathCoverage
        operational.morphism :=
  operational.paths_lift_and_reflect_all

/-- The source replay record retains the exact family recipe identifier. -/
@[simp]
theorem replay_record_ruleId (σ : FinSignature) (event : BusinessEvent) :
    ((ReferenceExecution.package σ).eventRecord event).event.ruleId =
      event.ruleId :=
  rfl

/-- Replay and all three terminal classifications refer to the same source. -/
theorem replay_and_terminals
    (σ : FinSignature) (event : BusinessEvent) :
    ((ReferenceExecution.package σ).eventRecord event).Replays
        ((ReferenceExecution.package σ).configOf (.ready event))
        ((ReferenceExecution.package σ).configOf (.completed event)) ∧
      (DAG.lts.SuccessfulTermination
          (DAG.certificate.mapState (.completed event)) ↔
        Source.SuccessfulTermination (.completed event)) ∧
      (Petri.lts.SuccessfulTermination
          (Petri.certificate.mapState (.completed event)) ↔
        Source.SuccessfulTermination (.completed event)) ∧
      (Morphism.lts.SuccessfulTermination
          (Morphism.certificate.mapState (.completed event)) ↔
        Source.SuccessfulTermination (.completed event)) :=
  ⟨ReferenceExecution.package_replay_exact (σ := σ) event,
    DAG.certificate.successfulTermination_iff _,
    Petri.certificate.successfulTermination_iff _,
    Morphism.certificate.successfulTermination_iff _⟩

end Cantilune.Pi.P1aBusinessProjectionCertificates
