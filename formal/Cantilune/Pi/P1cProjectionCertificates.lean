import Cantilune.Pi.P1cCompleteMatrix
import Cantilune.Pi.P1cLateBridge

/-!
# Operational projection certificates for the complete P1c reference calculus

The complete 60-cell matrix is lifted here from isolated derivations to four
full `ProjectionCertificate`s.  Each target transition relation is exact:
there are no additional target steps outside the image, so reflection and
terminal classification are proved rather than assumed.

The pi target is an event-indexed open-process LTS.  Every indexed transition
projects to one native typed step and one standard structurally closed late
step; indexing does not replace the underlying pi derivation.
-/

namespace Cantilune.Pi.P1cProjectionCertificates

open Cantilune.Core
open Cantilune.Pi
open Cantilune.Pi.P1cMatrix
open Cantilune.Pi.P1cCompleteMatrix

namespace DAG

def mapState : SourceState -> P1cCompleteMatrix.DAG.State
  | .ready event => P1cCompleteMatrix.DAG.ready event
  | .completed event => P1cCompleteMatrix.DAG.completed event

theorem mapState_injective : Function.Injective mapState := by
  intro left right equality
  cases left with
  | ready leftEvent =>
      cases right with
      | ready rightEvent =>
          have eventEquality :=
            congrArg P1cCompleteMatrix.DAG.State.event equality
          simp [mapState] at eventEquality
          subst rightEvent
          rfl
      | completed rightEvent =>
          have eventEquality :=
            congrArg P1cCompleteMatrix.DAG.State.event equality
          simp [mapState] at eventEquality
          subst rightEvent
          exact False.elim
            (P1cCompleteMatrix.DAG.changes leftEvent equality)
  | completed leftEvent =>
      cases right with
      | ready rightEvent =>
          have eventEquality :=
            congrArg P1cCompleteMatrix.DAG.State.event equality
          simp [mapState] at eventEquality
          subst rightEvent
          exact False.elim
            (P1cCompleteMatrix.DAG.changes leftEvent equality.symm)
      | completed rightEvent =>
          have eventEquality :=
            congrArg P1cCompleteMatrix.DAG.State.event equality
          simp [mapState] at eventEquality
          subst rightEvent
          rfl

def success (state : P1cCompleteMatrix.DAG.State) : Prop :=
  state = P1cCompleteMatrix.DAG.completed state.event

def lts : ObservableLTS where
  State := P1cCompleteMatrix.DAG.State
  Event := SourceEvent
  stateSetoid := ObservableLTS.equalitySetoid _
  step := P1cCompleteMatrix.DAG.Step
  observable := fun _ => True
  success := success
  waiting := fun _ => False
  signatureVersion := P1cCompleteMatrix.DAG.State.version
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

theorem step_characterization
    {source : lts.State} {event : lts.Event} {target : lts.State}
    (step : P1cCompleteMatrix.DAG.Step source event target) :
    source = P1cCompleteMatrix.DAG.ready event ∧
      target = P1cCompleteMatrix.DAG.completed event := by
  cases step
  exact ⟨rfl, rfl⟩

def certificate : ProjectionCertificate sourceLTS lts where
  mapState := mapState
  mapEvent := id
  Lift := Eq
  lift_chosen := by intro event; rfl
  map_equiv := by
    intro source target equality
    subst target
    rfl
  sound := by
    intro source event target sourceStep
    rcases sourceStep with ⟨step, _⟩
    cases step
    exact ⟨P1cCompleteMatrix.DAG.Step.execute event, trivial⟩
  reflect := by
    intro source event target targetStep
    rcases targetStep with ⟨step, _⟩
    rcases step_characterization step with ⟨sourceShape, targetShape⟩
    have sourceEquality :
        source = SourceState.ready event :=
      mapState_injective sourceShape
    subst source
    subst target
    exact
      ⟨event, .completed event, source_event_observable event,
        rfl, rfl⟩
  success_iff := by
    intro state
    cases state with
    | ready event =>
        constructor
        · intro targetSuccess
          change success (mapState (.ready event)) at targetSuccess
          have impossible :
              P1cCompleteMatrix.DAG.ready event =
                P1cCompleteMatrix.DAG.completed event := by
            simpa [success, mapState] using targetSuccess
          exact False.elim
            (P1cCompleteMatrix.DAG.changes event impossible)
        · intro sourceSuccess
          exact False.elim sourceSuccess
    | completed event =>
        constructor <;> intro
        · trivial
        · change success (mapState (.completed event))
          simp [success, mapState]
  waiting_iff := by
    intro state
    rfl
  signatureVersion_preserved := by
    intro state
    cases state with
    | ready event =>
        cases event <;> rfl
    | completed event =>
        cases event <;> rfl

end DAG

namespace Petri

def mapState : SourceState -> P1cCompleteMatrix.Petri.State
  | .ready event => P1cCompleteMatrix.Petri.ready event
  | .completed event => P1cCompleteMatrix.Petri.completed event

theorem mapState_injective : Function.Injective mapState := by
  intro left right equality
  cases left with
  | ready leftEvent =>
      cases right with
      | ready rightEvent =>
          have eventEquality :=
            congrArg P1cCompleteMatrix.Petri.State.event equality
          simp [mapState] at eventEquality
          subst rightEvent
          rfl
      | completed rightEvent =>
          have eventEquality :=
            congrArg P1cCompleteMatrix.Petri.State.event equality
          simp [mapState] at eventEquality
          subst rightEvent
          exact False.elim
            (P1cCompleteMatrix.Petri.changes leftEvent equality)
  | completed leftEvent =>
      cases right with
      | ready rightEvent =>
          have eventEquality :=
            congrArg P1cCompleteMatrix.Petri.State.event equality
          simp [mapState] at eventEquality
          subst rightEvent
          exact False.elim
            (P1cCompleteMatrix.Petri.changes leftEvent equality.symm)
      | completed rightEvent =>
          have eventEquality :=
            congrArg P1cCompleteMatrix.Petri.State.event equality
          simp [mapState] at eventEquality
          subst rightEvent
          rfl

def success (state : P1cCompleteMatrix.Petri.State) : Prop :=
  state = P1cCompleteMatrix.Petri.completed state.event

def version (state : P1cCompleteMatrix.Petri.State) : Nat :=
  if state.event = .dynamicPartnerAdmission ∧
      state.declared = {.dynamicPartnerAdmission}
    then 1
    else 0

def lts : ObservableLTS where
  State := P1cCompleteMatrix.Petri.State
  Event := SourceEvent
  stateSetoid := ObservableLTS.equalitySetoid _
  step := P1cCompleteMatrix.Petri.Step
  observable := fun _ => True
  success := success
  waiting := fun _ => False
  signatureVersion := version
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

theorem step_characterization
    {source : lts.State} {event : lts.Event} {target : lts.State}
    (step : P1cCompleteMatrix.Petri.Step source event target) :
    source = P1cCompleteMatrix.Petri.ready event ∧
      target = P1cCompleteMatrix.Petri.completed event := by
  cases step
  exact ⟨rfl, rfl⟩

def certificate : ProjectionCertificate sourceLTS lts where
  mapState := mapState
  mapEvent := id
  Lift := Eq
  lift_chosen := by intro event; rfl
  map_equiv := by
    intro source target equality
    subst target
    rfl
  sound := by
    intro source event target sourceStep
    rcases sourceStep with ⟨step, _⟩
    cases step
    exact ⟨P1cCompleteMatrix.Petri.Step.fire event, trivial⟩
  reflect := by
    intro source event target targetStep
    rcases targetStep with ⟨step, _⟩
    rcases step_characterization step with ⟨sourceShape, targetShape⟩
    have sourceEquality :
        source = SourceState.ready event :=
      mapState_injective sourceShape
    subst source
    subst target
    exact
      ⟨event, .completed event, source_event_observable event,
        rfl, rfl⟩
  success_iff := by
    intro state
    cases state with
    | ready event =>
        constructor
        · intro targetSuccess
          change success (mapState (.ready event)) at targetSuccess
          have impossible :
              P1cCompleteMatrix.Petri.ready event =
                P1cCompleteMatrix.Petri.completed event := by
            simpa [success, mapState] using targetSuccess
          exact False.elim
            (P1cCompleteMatrix.Petri.changes event impossible)
        · intro sourceSuccess
          exact False.elim sourceSuccess
    | completed event =>
        constructor <;> intro
        · trivial
        · change success (mapState (.completed event))
          simp [success, mapState]
  waiting_iff := by
    intro state
    rfl
  signatureVersion_preserved := by
    intro state
    cases state with
    | ready event =>
        cases event <;> rfl
    | completed event =>
        cases event <;> rfl

end Petri

namespace Morphism

def lts : ObservableLTS where
  State := SourceState
  Event := SourceEvent
  stateSetoid := ObservableLTS.equalitySetoid _
  step := P1cCompleteMatrix.Morphism.Step
  observable := fun _ => True
  success
    | .ready _ => False
    | .completed _ => True
  waiting := fun _ => False
  signatureVersion := sourceVersion
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

def certificate : ProjectionCertificate sourceLTS lts where
  mapState := id
  mapEvent := id
  Lift := Eq
  lift_chosen := by intro event; rfl
  map_equiv := by
    intro source target equality
    exact equality
  sound := by
    intro source event target sourceStep
    rcases sourceStep with ⟨step, _⟩
    cases step
    exact ⟨P1cCompleteMatrix.Morphism.Step.map event, trivial⟩
  reflect := by
    intro source event target targetStep
    rcases targetStep with ⟨step, _⟩
    cases step
    exact
      ⟨event, .completed event, source_event_observable event,
        rfl, rfl⟩
  success_iff := by
    intro state
    cases state <;> rfl
  waiting_iff := by
    intro state
    rfl
  signatureVersion_preserved := by
    intro state
    rfl

end Morphism

namespace PiTarget

/-- Event-indexed process states keep source-event identity without altering syntax. -/
inductive State where
  | ready (event : SourceEvent)
  | completed (event : SourceEvent)
  deriving DecidableEq, Repr, Fintype

def process : State -> Proc
  | .ready event => (piReferenceDerivation event).source
  | .completed event => (piReferenceDerivation event).target

abbrev Label := SourceEvent × Action

/-- Each indexed transition carries the actual native typed pi derivation. -/
inductive Step : State -> Label -> State -> Prop where
  | execute (event : SourceEvent)
      (native :
        Cantilune.Pi.Step
          (piReferenceDerivation event).source
          (piReferenceDerivation event).label
          (piReferenceDerivation event).target) :
      Step (.ready event)
        (event, (piReferenceDerivation event).label)
        (.completed event)

def success : State -> Prop
  | .ready _ => False
  | .completed _ => True

def version : State -> Nat
  | .completed .dynamicPartnerAdmission => 1
  | _ => 0

def lts : ObservableLTS where
  State := State
  Event := Label
  stateSetoid := ObservableLTS.equalitySetoid _
  step := Step
  observable := fun _ => True
  success := success
  waiting := fun _ => False
  signatureVersion := version
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

def mapState : SourceState -> State
  | .ready event => .ready event
  | .completed event => .completed event

def mapEvent (event : SourceEvent) : Label :=
  (event, (piReferenceDerivation event).label)

def unmapState : State -> SourceState
  | .ready event => .ready event
  | .completed event => .completed event

theorem unmap_mapState (state : SourceState) :
    unmapState (mapState state) = state := by
  cases state <;> rfl

theorem mapState_injective : Function.Injective mapState :=
  Function.LeftInverse.injective unmap_mapState

theorem step_characterization
    {source : State} {label : Label} {target : State}
    (step : Step source label target) :
    ∃ event,
      source = .ready event ∧
        label = mapEvent event ∧
        target = .completed event := by
  cases step with
  | execute event native =>
      exact ⟨event, rfl, rfl, rfl⟩

def certificate : ProjectionCertificate sourceLTS lts where
  mapState := mapState
  mapEvent := mapEvent
  Lift := fun source target => target = mapEvent source
  lift_chosen := by intro event; rfl
  map_equiv := by
    intro source target equality
    subst target
    rfl
  sound := by
    intro source event target sourceStep
    rcases sourceStep with ⟨step, _⟩
    cases step
    exact
      ⟨Step.execute event (piReferenceDerivation event).nativeStep,
        trivial⟩
  reflect := by
    intro source label target targetStep
    rcases targetStep with ⟨step, _⟩
    rcases step_characterization step with
      ⟨event, sourceShape, labelShape, targetShape⟩
    have sourceEquality :
        source = SourceState.ready event :=
      mapState_injective sourceShape
    subst source
    subst label
    subst target
    exact
      ⟨event, .completed event,
        source_event_observable event, rfl, rfl⟩
  success_iff := by
    intro state
    cases state <;> rfl
  waiting_iff := by
    intro state
    rfl
  signatureVersion_preserved := by
    intro state
    cases state with
    | ready event =>
        cases event <;> rfl
    | completed event =>
        cases event <;> rfl

/-- Forgetting the event index yields the exact native typed pi transition. -/
theorem step_native
    {source : State} {label : Label} {target : State}
    (step : Step source label target) :
    Cantilune.Pi.Step (process source) label.2 (process target) := by
  cases step with
  | execute event native => exact native

/--
The same transition erases to one constructor tree of the independently
defined native standard-late semantics.
-/
theorem step_standard_late_native
    {source : State} {label : Label} {target : State}
    (step : Step source label target) :
    Late.NativeStep
      (process source).erase label.2.erase (process target).erase := by
  cases step with
  | execute event native =>
      exact piAdequate_erases_to_standard_late_native
        (piReferenceDerivation event).adequate

/--
Embedding the native tree into structural closure gives the ordinary strong
late transition, still at exactly one-step granularity.
-/
theorem step_standard_late
    {source : State} {label : Label} {target : State}
    (step : Step source label target) :
    Late.Step (process source).erase label.2.erase (process target).erase :=
  Late.Step.native (step_standard_late_native step)

end PiTarget

/-- Four complete operational certificates for the finite P1c reference LTS. -/
structure OperationalCertificates where
  dag : ProjectionCertificate sourceLTS DAG.lts
  petri : ProjectionCertificate sourceLTS Petri.lts
  pi : ProjectionCertificate sourceLTS PiTarget.lts
  morphism : ProjectionCertificate sourceLTS Morphism.lts

def p1c_operational_certificates : OperationalCertificates where
  dag := DAG.certificate
  petri := Petri.certificate
  pi := PiTarget.certificate
  morphism := Morphism.certificate

end Cantilune.Pi.P1cProjectionCertificates
