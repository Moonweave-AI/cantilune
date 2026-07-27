import Cantilune.Pi.P1cClosedNativeCertificate

/-!
# Non-normative multistage full-native P1c candidate

This module is an isolated design candidate.  It does not alter the normative
fifteen-event `P1cMatrix.sourceLTS`.

The existing event-isolated open/close witness reaches an established session
that can still transmit its payload.  Treating that intermediate process as a
completed source state makes full native reflection impossible.  The candidate
below exposes the two strong native transitions as two source events:

```
openReady --establishSession--> sessionEstablished
          --transmitPayload--> payloadComplete
```

The target states are actual raw pi processes and the target relation is the
complete `Late.NativeStep` relation.  No target step is generated from the
source relation, and no weak or transitive closure is used.
-/

namespace Cantilune.Pi.P1cMultistageNativeCandidate

open Cantilune.Core
open Cantilune.Pi
open Cantilune.Pi.Protocols
open Cantilune.Pi.P1cClosedNativeCertificate

inductive State where
  | openReady
  | sessionEstablished
  | payloadComplete
  deriving DecidableEq, Repr, Fintype

inductive Event where
  | establishSession
  | transmitPayload
  deriving DecidableEq, Repr, Fintype

inductive Step : State -> Event -> State -> Prop where
  | establishSession :
      Step .openReady .establishSession .sessionEstablished
  | transmitPayload :
      Step .sessionEstablished .transmitPayload .payloadComplete

def sourceSuccess : State -> Prop
  | .payloadComplete => True
  | .openReady
  | .sessionEstablished => False

def sourceLTS : ObservableLTS where
  State := State
  Event := Event
  stateSetoid := ObservableLTS.equalitySetoid State
  step := Step
  observable := fun _ => True
  success := sourceSuccess
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

def mapState : State -> Raw.Proc
  | .openReady => closedOpenCloseSource.erase
  | .sessionEstablished => closedOpenCloseTarget.erase
  | .payloadComplete => closedCompletedProcess.erase

def mapEvent : Event -> Raw.Action
  | .establishSession
  | .transmitPayload => .tau

def targetSuccess (process : Raw.Proc) : Prop :=
  process = closedCompletedProcess.erase

/-- The independently declared complete native late-pi target LTS. -/
def targetLTS : ObservableLTS where
  State := Raw.Proc
  Event := Raw.Action
  stateSetoid := ObservableLTS.equalitySetoid Raw.Proc
  step := Late.NativeStep
  observable := fun _ => True
  success := targetSuccess
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

/-! ## Exact native classification -/

theorem established_native :
    Late.NativeStep (mapState .sessionEstablished) .tau
      (mapState .payloadComplete) :=
  closed_open_close_target_followup_native

/--
The established state is an outer public restriction around precisely the
closed communication source.  Its only native derivative is therefore the
payload synchronization.
-/
theorem established_native_exact
    {action : Raw.Action} {next : Raw.Proc}
    (step : Late.NativeStep (mapState .sessionEstablished) action next) :
    action = .tau /\ next = mapState .payloadComplete := by
  change
    Late.NativeStep
      (.new publicName closedCommunicationSource.erase) action next at step
  cases step with
  | restrict _ inner =>
      rcases closed_communication_native_exact inner with
        ⟨actionEq, endpoint⟩
      subst action
      exact
        ⟨rfl, congrArg (Raw.Proc.new publicName) endpoint⟩
  | «open» _ inner =>
      rcases closed_communication_native_exact inner with
        ⟨actionEq, _endpoint⟩
      cases actionEq

private theorem zero_no_native
    {action : Raw.Action} {next : Raw.Proc} :
    ¬ Late.NativeStep .zero action next := by
  intro step
  cases step

private theorem parallel_zero_no_native
    {action : Raw.Action} {next : Raw.Proc} :
    ¬ Late.NativeStep (.par .zero .zero) action next := by
  intro step
  cases step with
  | parLeft _ leftStep => exact zero_no_native leftStep
  | parRight _ rightStep => exact zero_no_native rightStep
  | syncLeft outputStep _ _ => exact zero_no_native outputStep
  | syncRight inputStep _ _ => exact zero_no_native inputStep
  | closeLeft outputStep _ _ _ => exact zero_no_native outputStep
  | closeRight inputStep _ _ _ => exact zero_no_native inputStep

private theorem restricted_parallel_zero_no_native
    (binder : Name)
    {action : Raw.Action} {next : Raw.Proc} :
    ¬ Late.NativeStep (.new binder (.par .zero .zero)) action next := by
  intro step
  cases step with
  | restrict _ inner => exact parallel_zero_no_native inner
  | «open» _ inner => exact parallel_zero_no_native inner

theorem payload_complete_no_native
    {action : Raw.Action} {next : Raw.Proc} :
    ¬ Late.NativeStep (mapState .payloadComplete) action next := by
  intro step
  change
    Late.NativeStep
      (.new publicName (.new session (.par .zero .zero)))
      action next at step
  cases step with
  | restrict _ inner =>
      exact restricted_parallel_zero_no_native session inner
  | «open» _ inner =>
      exact restricted_parallel_zero_no_native session inner

/-- Both source transitions are genuine one-step native target transitions. -/
theorem native_sound
    {source : State} {event : Event} {target : State}
    (step : Step source event target) :
    Late.NativeStep (mapState source) (mapEvent event) (mapState target) := by
  cases step with
  | establishSession => exact closed_open_close_native
  | transmitPayload => exact established_native

/--
Every native transition from one of the three mapped states is one of the two
source transitions, with exactly the chosen action and endpoint.
-/
theorem native_reflect
    {source : State} {action : Raw.Action} {next : Raw.Proc}
    (step : Late.NativeStep (mapState source) action next) :
    ∃ event target,
      Step source event target /\
      mapEvent event = action /\
      mapState target = next := by
  cases source with
  | openReady =>
      rcases closed_open_close_native_exact step with
        ⟨actionEq, endpoint⟩
      subst action
      subst next
      exact
        ⟨.establishSession, .sessionEstablished,
          .establishSession, rfl, rfl⟩
  | sessionEstablished =>
      rcases established_native_exact step with
        ⟨actionEq, endpoint⟩
      subst action
      subst next
      exact
        ⟨.transmitPayload, .payloadComplete,
          .transmitPayload, rfl, rfl⟩
  | payloadComplete =>
      exact False.elim (payload_complete_no_native step)

/-! ## Complete projection certificate for the candidate protocol -/

def certificate : ProjectionCertificate sourceLTS targetLTS where
  mapState := mapState
  mapEvent := mapEvent
  Lift := fun sourceEvent targetAction =>
    mapEvent sourceEvent = targetAction
  lift_chosen := by
    intro event
    rfl
  map_equiv := by
    intro source target equality
    subst target
    rfl
  sound := by
    intro source event target observableStep
    exact ⟨native_sound observableStep.1, trivial⟩
  reflect := by
    intro source action target observableStep
    rcases native_reflect observableStep.1 with
      ⟨event, sourceTarget, sourceStep, actionEq, endpoint⟩
    exact
      ⟨event, sourceTarget, ⟨sourceStep, trivial⟩,
        actionEq, endpoint.symm⟩
  success_iff := by
    intro state
    cases state <;>
      simp [targetLTS, targetSuccess, mapState, sourceLTS, sourceSuccess,
        closedOpenCloseSource, closedOpenCloseTarget,
        closedCompletedProcess, extrudedHandshake, handshakeResult,
        requestContinuation, Proc.erase]
  waiting_iff := by
    intro state
    rfl
  signatureVersion_preserved := by
    intro state
    rfl

end Cantilune.Pi.P1cMultistageNativeCandidate
