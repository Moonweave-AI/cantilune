import Cantilune.Pi.P1cLateExhaustiveness
import Cantilune.Pi.P1cMultistageNativeCandidate

/-!
# Shared full-native certificate for the critical P1c protocols

This module combines the exact mismatch, closed communication, closed
reconnect, closed quiescent-delete, and two-stage open/close protocols in one
source LTS. The target relation is the independently defined complete
`Late.NativeStep` relation on actual raw processes.
-/

namespace Cantilune.Pi.P1cCriticalMultistageCertificate

open Cantilune.Core
open Cantilune.Pi
open Cantilune.Pi.Protocols
open Cantilune.Pi.P1cClosedNativeCertificate
open Cantilune.Pi.P1cLateExhaustiveness

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

theorem closed_communication_target_no_native
    {action : Raw.Action} {next : Raw.Proc} :
    ¬ Late.NativeStep closedCommunicationTarget.erase action next := by
  simpa [closedCommunicationTarget, Proc.erase] using
    (restricted_parallel_zero_no_native session
      (action := action) (next := next))

theorem closed_quiescent_delete_target_no_native
    {action : Raw.Action} {next : Raw.Proc} :
    ¬ Late.NativeStep closedQuiescentDeleteTarget.erase action next := by
  simpa [closedQuiescentDeleteTarget, quiescentDeleteResult, Proc.erase] using
    (restricted_parallel_zero_no_native delegationBus
      (action := action) (next := next))

private theorem parallel_zero_send_native_exact
    {action : Raw.Action} {next : Raw.Proc}
    (step :
      Late.NativeStep
        (.par .zero (.send delegated payload .zero)) action next) :
    action = .output delegated payload ∧
      next = .par .zero .zero := by
  cases step with
  | parLeft _ leftStep => exact False.elim (zero_no_native leftStep)
  | parRight _ rightStep =>
      cases rightStep
      exact ⟨rfl, rfl⟩
  | syncLeft outputStep _ _ =>
      exact False.elim (zero_no_native outputStep)
  | syncRight inputStep _ _ =>
      exact False.elim (zero_no_native inputStep)
  | closeLeft outputStep _ _ _ =>
      exact False.elim (zero_no_native outputStep)
  | closeRight inputStep _ _ _ =>
      exact False.elim (zero_no_native inputStep)

private theorem restricted_delegated_send_no_native
    {action : Raw.Action} {next : Raw.Proc} :
    ¬ Late.NativeStep
      (.new delegated
        (.par .zero (.send delegated payload .zero)))
      action next := by
  intro step
  cases step with
  | restrict fresh inner =>
      rcases parallel_zero_send_native_exact inner with
        ⟨actionEq, endpoint⟩
      subst action
      simp [Raw.Action.names, delegated] at fresh
  | «open» distinct inner =>
      rcases parallel_zero_send_native_exact inner with
        ⟨actionEq, endpoint⟩
      cases actionEq

theorem closed_reconnect_target_no_native
    {action : Raw.Action} {next : Raw.Proc} :
    ¬ Late.NativeStep closedReconnectTarget.erase action next := by
  intro step
  change
    Late.NativeStep
      (.new delegationBus
        (.new delegated
          (.par .zero (.send delegated payload .zero))))
      action next at step
  cases step with
  | restrict _ inner => exact restricted_delegated_send_no_native inner
  | «open» _ inner => exact restricted_delegated_send_no_native inner

/-! ## One shared critical-protocol source LTS -/

inductive State where
  | communicationReady
  | communicationDone
  | openReady
  | sessionEstablished
  | payloadComplete
  | mismatchReady
  | mismatchDone
  | reconnectReady
  | reconnectDone
  | quiescentDeleteReady
  | quiescentDeleteDone
  deriving DecidableEq, Repr, Fintype

inductive Event where
  | communication
  | establishSession
  | transmitPayload
  | mismatchDecision
  | reconnect
  | quiescentDelete
  deriving DecidableEq, Repr, Fintype

inductive Step : State → Event → State → Prop where
  | communication :
      Step .communicationReady .communication .communicationDone
  | establishSession :
      Step .openReady .establishSession .sessionEstablished
  | transmitPayload :
      Step .sessionEstablished .transmitPayload .payloadComplete
  | mismatchDecision :
      Step .mismatchReady .mismatchDecision .mismatchDone
  | reconnect :
      Step .reconnectReady .reconnect .reconnectDone
  | quiescentDelete :
      Step .quiescentDeleteReady .quiescentDelete .quiescentDeleteDone

/-- Actual raw process carried by every critical source state. -/
def mapState : State → Raw.Proc
  | .communicationReady => closedCommunicationSource.erase
  | .communicationDone => closedCommunicationTarget.erase
  | .openReady => closedOpenCloseSource.erase
  | .sessionEstablished => closedOpenCloseTarget.erase
  | .payloadComplete => closedCompletedProcess.erase
  | .mismatchReady => mismatchDecision.erase
  | .mismatchDone => .zero
  | .reconnectReady => closedReconnectSource.erase
  | .reconnectDone => closedReconnectTarget.erase
  | .quiescentDeleteReady => closedQuiescentDeleteSource.erase
  | .quiescentDeleteDone => closedQuiescentDeleteTarget.erase

def mapEvent : Event → Raw.Action
  | .communication
  | .establishSession
  | .transmitPayload
  | .mismatchDecision
  | .reconnect
  | .quiescentDelete => .tau

/--
The designated completed process classes. Defining source success through
this same predicate makes terminal observations commute by construction while
the no-native lemmas above establish their operational normality.
-/
def terminalProcess (process : Raw.Proc) : Prop :=
  process = closedCommunicationTarget.erase ∨
  process = closedCompletedProcess.erase ∨
  process = .zero ∨
  process = closedReconnectTarget.erase ∨
  process = closedQuiescentDeleteTarget.erase

def sourceLTS : ObservableLTS where
  State := State
  Event := Event
  stateSetoid := ObservableLTS.equalitySetoid State
  step := Step
  observable := fun _ => True
  success := fun state => terminalProcess (mapState state)
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

/-- Complete independently defined target LTS on actual raw processes. -/
def targetLTS : ObservableLTS where
  State := Raw.Proc
  Event := Raw.Action
  stateSetoid := ObservableLTS.equalitySetoid Raw.Proc
  step := Late.NativeStep
  observable := fun _ => True
  success := terminalProcess
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

/-- Every source event is one genuine strong native target step. -/
theorem native_sound
    {source : State} {event : Event} {target : State}
    (step : Step source event target) :
    Late.NativeStep (mapState source) (mapEvent event) (mapState target) := by
  cases step with
  | communication =>
      exact native .communication
  | establishSession =>
      exact native .openClose
  | transmitPayload =>
      exact
        P1cMultistageNativeCandidate.established_native
  | mismatchDecision =>
      exact mismatch_native_iff.mpr ⟨rfl, rfl⟩
  | reconnect =>
      exact native .reconnect
  | quiescentDelete =>
      exact native .quiescentDelete

/--
Every native step from every mapped state is exactly one of the six source
events. Completed states have no native successor.
-/
theorem native_reflect
    {source : State} {action : Raw.Action} {next : Raw.Proc}
    (step : Late.NativeStep (mapState source) action next) :
    ∃ event target,
      Step source event target ∧
      mapEvent event = action ∧
      mapState target = next := by
  cases source with
  | communicationReady =>
      rcases native_exact .communication step with ⟨actionEq, endpoint⟩
      subst action
      subst next
      exact ⟨.communication, .communicationDone,
        .communication, rfl, rfl⟩
  | communicationDone =>
      exact False.elim (closed_communication_target_no_native step)
  | openReady =>
      rcases native_exact .openClose step with ⟨actionEq, endpoint⟩
      subst action
      subst next
      exact ⟨.establishSession, .sessionEstablished,
        .establishSession, rfl, rfl⟩
  | sessionEstablished =>
      rcases
          P1cMultistageNativeCandidate.established_native_exact step with
        ⟨actionEq, endpoint⟩
      subst action
      subst next
      exact ⟨.transmitPayload, .payloadComplete,
        .transmitPayload, rfl, rfl⟩
  | payloadComplete =>
      exact False.elim
        (P1cMultistageNativeCandidate.payload_complete_no_native step)
  | mismatchReady =>
      rcases mismatch_native_exact step with ⟨actionEq, endpoint⟩
      subst action
      subst next
      exact ⟨.mismatchDecision, .mismatchDone,
        .mismatchDecision, rfl, rfl⟩
  | mismatchDone =>
      exact False.elim (zero_no_native step)
  | reconnectReady =>
      rcases native_exact .reconnect step with ⟨actionEq, endpoint⟩
      subst action
      subst next
      exact ⟨.reconnect, .reconnectDone, .reconnect, rfl, rfl⟩
  | reconnectDone =>
      exact False.elim (closed_reconnect_target_no_native step)
  | quiescentDeleteReady =>
      rcases native_exact .quiescentDelete step with
        ⟨actionEq, endpoint⟩
      subst action
      subst next
      exact ⟨.quiescentDelete, .quiescentDeleteDone,
        .quiescentDelete, rfl, rfl⟩
  | quiescentDeleteDone =>
      exact False.elim (closed_quiescent_delete_target_no_native step)

/--
Complete operational projection of the shared critical P1c source into the
actual standard native late-π LTS.
-/
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
    rfl
  waiting_iff := by
    intro state
    rfl
  signatureVersion_preserved := by
    intro state
    rfl

end Cantilune.Pi.P1cCriticalMultistageCertificate
