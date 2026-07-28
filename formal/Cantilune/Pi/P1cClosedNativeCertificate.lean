import Cantilune.Pi.P1cLateBridge

/-!
# Closed native late-pi witnesses for internal P1c events

The existing event matrix deliberately uses several open handshakes, so its
designated step is not exhaustive for the whole standard late LTS.  This file
constructs a separate closed encoding for the four internal events that would
otherwise expose an endpoint to the environment.

Every theorem below is one `Late.NativeStep`.  There is no weak closure and no
event-generated target relation.  The four redesigned sources are now
classified exhaustively.  A complete fifteen-event reflection certificate
still requires a reviewed protocol-state refinement: the current closed
open/close endpoint has a subsequent payload transition, which cannot be
reflected by the event-isolated two-state source LTS.
-/

namespace Cantilune.Pi.P1cClosedNativeCertificate

open Cantilune.Core
open Cantilune.Pi
open Cantilune.Pi.Protocols
open Cantilune.Pi.P1cMatrix

/-- Ordinary communication with its session subject hidden. -/
def closedCommunicationSource : Proc :=
  .new session (.par messageSender messageReceiver)

def closedCommunicationTarget : Proc :=
  .new session (.par .zero .zero)

/--
The open/close derivation is retained internally, while its public bus is
hidden from the surrounding environment.
-/
def closedOpenCloseSource : Proc :=
  .new publicName extrudedHandshake

def closedOpenCloseTarget : Proc :=
  .new publicName handshakeResult

/-- Reconnection reuses the already closed delegation protocol. -/
def closedReconnectSource : Proc :=
  closedDelegationOffering

def closedReconnectTarget : Proc :=
  closedDelegationResult

/-- Quiescent shutdown with its acknowledgement bus hidden. -/
def closedQuiescentDeleteSource : Proc :=
  .new delegationBus quiescentDeleteOffering

def closedQuiescentDeleteTarget : Proc :=
  .new delegationBus quiescentDeleteResult

theorem closed_communication_native :
    Late.NativeStep closedCommunicationSource.erase .tau
      closedCommunicationTarget.erase := by
  apply Late.NativeStep.restrict
  · decide
  · exact
      piAdequate_erases_to_standard_late_native
        PiAdequate.communication

theorem closed_open_close_native :
    Late.NativeStep closedOpenCloseSource.erase .tau
      closedOpenCloseTarget.erase := by
  apply Late.NativeStep.restrict
  · decide
  · exact
      piAdequate_erases_to_standard_late_native
        PiAdequate.openClose

theorem closed_reconnect_native :
    Late.NativeStep closedReconnectSource.erase .tau
      closedReconnectTarget.erase :=
  piAdequate_erases_to_standard_late_native
    PiAdequate.delegation

theorem closed_quiescent_delete_native :
    Late.NativeStep closedQuiescentDeleteSource.erase .tau
      closedQuiescentDeleteTarget.erase := by
  apply Late.NativeStep.restrict
  · decide
  · exact
      piAdequate_erases_to_standard_late_native
        PiAdequate.instanceDeleteQuiescent

private theorem raw_zero_no_native
    {action : Raw.Action} {next : Raw.Proc} :
    ¬ Late.NativeStep .zero action next := by
  intro step
  cases step

/--
Hiding the communication subject removes both environmental prefix steps:
the synchronization is the only native derivative of the closed source.
-/
theorem closed_communication_native_exact
    {action : Raw.Action} {next : Raw.Proc}
    (step :
      Late.NativeStep closedCommunicationSource.erase action next) :
    action = .tau ∧ next = closedCommunicationTarget.erase := by
  change
    Late.NativeStep
      (.new session
        (.par
          (.send session payload .zero)
          (.recv session payloadBinder .zero)))
      action next at step
  cases step with
  | restrict outerFresh inner =>
      cases inner with
      | parLeft _ senderStep =>
          cases senderStep
          exact False.elim
            (outerFresh
              (by simp [Raw.Action.names, session]))
      | parRight _ receiverStep =>
          cases receiverStep
          exact False.elim
            (outerFresh
              (by simp [Raw.Action.names, session]))
      | syncLeft outputStep inputStep binderFresh =>
          cases outputStep
          cases inputStep
          exact ⟨rfl, rfl⟩
      | syncRight inputStep outputStep binderFresh =>
          cases inputStep
      | closeLeft outputStep inputStep freshForReceiver binderFresh =>
          cases outputStep
      | closeRight inputStep outputStep freshForReceiver binderFresh =>
          cases inputStep
  | «open» distinct bodyStep =>
      cases bodyStep with
      | parLeft _ senderStep =>
          cases senderStep
      | parRight _ receiverStep =>
          cases receiverStep

private theorem raw_open_close_substitution :
    (Raw.Proc.recv sessionBinder payloadBinder .zero).substituteCaptureAvoiding
        sessionBinder session =
      .recv session payloadBinder .zero := by
  decide

/--
The outer public-name restriction turns the open/close handshake into one
closed transition: neither the bound output nor the matching input can escape.
-/
theorem closed_open_close_native_exact
    {action : Raw.Action} {next : Raw.Proc}
    (step :
      Late.NativeStep closedOpenCloseSource.erase action next) :
    action = .tau ∧ next = closedOpenCloseTarget.erase := by
  change
    Late.NativeStep
      (.new publicName
        (.par
          (.new session
            (.send publicName session
              (.send session payload .zero)))
          (.recv publicName sessionBinder
            (.recv sessionBinder payloadBinder .zero))))
      action next at step
  cases step with
  | restrict outerFresh inner =>
      cases inner with
      | parLeft _ leftStep =>
          cases leftStep with
          | restrict innerFresh senderStep =>
              cases senderStep
              exact False.elim
                (innerFresh
                  (by simp [Raw.Action.names, session]))
          | «open» _ senderStep =>
              cases senderStep
              exact False.elim
                (outerFresh
                  (by simp [Raw.Action.names, publicName]))
      | parRight _ receiverStep =>
          cases receiverStep
          exact False.elim
            (outerFresh
              (by simp [Raw.Action.names, publicName]))
      | syncLeft outputStep inputStep binderFresh =>
          cases outputStep with
          | restrict innerFresh senderStep =>
              cases senderStep
              exact False.elim
                (innerFresh
                  (by simp [Raw.Action.names, session]))
      | syncRight inputStep outputStep binderFresh =>
          cases inputStep with
          | restrict innerFresh senderStep =>
              cases senderStep
      | closeLeft outputStep inputStep freshForReceiver binderFresh =>
          cases outputStep with
          | restrict innerFresh senderStep =>
              cases senderStep
          | «open» _ senderStep =>
              cases senderStep
              cases inputStep
              rw [raw_open_close_substitution]
              exact ⟨rfl, rfl⟩
      | closeRight inputStep outputStep freshForReceiver binderFresh =>
          cases inputStep with
          | restrict innerFresh senderStep =>
              cases senderStep
  | «open» distinct bodyStep =>
      cases bodyStep with
      | parLeft _ leftStep =>
          cases leftStep with
          | restrict innerFresh senderStep =>
              cases senderStep
      | parRight _ receiverStep =>
          cases receiverStep

/--
The exact source classification above does not make the event-isolated target
terminal: the established session still performs its ordinary payload
communication.  A complete full-native certificate must therefore model this
intermediate state (or redesign the protocol), rather than silently dropping
the following transition.
-/
theorem closed_open_close_target_followup_native :
    Late.NativeStep closedOpenCloseTarget.erase .tau
      closedCompletedProcess.erase := by
  apply Late.NativeStep.restrict
  · decide
  · apply Late.NativeStep.restrict
    · decide
    · apply Late.NativeStep.syncLeft
        Late.NativeStep.prefixOutput Late.NativeStep.prefixInput
      decide

private theorem raw_delegation_substitution :
    (Raw.Proc.send delegatedBinder payload .zero).substituteCaptureAvoiding
        delegatedBinder delegated =
      .send delegated payload .zero := by
  decide

/--
Both names of the delegation protocol are restricted.  The ordinary sender
and receiver prefixes therefore cannot escape; their synchronization is the
unique native reconnect derivative.
-/
theorem closed_reconnect_native_exact
    {action : Raw.Action} {next : Raw.Proc}
    (step :
      Late.NativeStep closedReconnectSource.erase action next) :
    action = .tau ∧ next = closedReconnectTarget.erase := by
  change
    Late.NativeStep
      (.new delegationBus
        (.new delegated
          (.par
            (.send delegationBus delegated .zero)
            (.recv delegationBus delegatedBinder
              (.send delegatedBinder payload .zero)))))
      action next at step
  cases step with
  | restrict busFresh delegatedStep =>
      cases delegatedStep with
      | restrict delegatedFresh bodyStep =>
          cases bodyStep with
          | parLeft _ senderStep =>
              cases senderStep
              exact False.elim
                (delegatedFresh
                  (by simp [Raw.Action.names, delegated]))
          | parRight _ receiverStep =>
              cases receiverStep
              exact False.elim
                (busFresh
                  (by simp [Raw.Action.names, delegationBus]))
          | syncLeft outputStep inputStep binderFresh =>
              cases outputStep
              cases inputStep
              rw [raw_delegation_substitution]
              exact ⟨rfl, rfl⟩
          | syncRight inputStep outputStep binderFresh =>
              cases inputStep
          | closeLeft outputStep inputStep freshForReceiver binderFresh =>
              cases outputStep
          | closeRight inputStep outputStep freshForReceiver binderFresh =>
              cases inputStep
      | «open» _ bodyStep =>
          cases bodyStep with
          | parLeft _ senderStep =>
              cases senderStep
              exact False.elim
                (busFresh
                  (by simp [Raw.Action.names, delegationBus]))
          | parRight _ receiverStep =>
              cases receiverStep
  | «open» distinct delegatedStep =>
      cases delegatedStep with
      | restrict delegatedFresh bodyStep =>
          cases bodyStep with
          | parLeft _ senderStep =>
              cases senderStep
          | parRight _ receiverStep =>
              cases receiverStep

/--
The shutdown bus is hidden and both continuations are zero, so quiescent
deletion has exactly the one acknowledgement synchronization.
-/
theorem closed_quiescent_delete_native_exact
    {action : Raw.Action} {next : Raw.Proc}
    (step :
      Late.NativeStep closedQuiescentDeleteSource.erase action next) :
    action = .tau ∧ next = closedQuiescentDeleteTarget.erase := by
  change
    Late.NativeStep
      (.new delegationBus
        (.par
          (.send delegationBus delegated .zero)
          (.recv delegationBus delegatedBinder .zero)))
      action next at step
  cases step with
  | restrict busFresh inner =>
      cases inner with
      | parLeft _ senderStep =>
          cases senderStep
          exact False.elim
            (busFresh
              (by simp [Raw.Action.names, delegationBus]))
      | parRight _ receiverStep =>
          cases receiverStep
          exact False.elim
            (busFresh
              (by simp [Raw.Action.names, delegationBus]))
      | syncLeft outputStep inputStep binderFresh =>
          cases outputStep
          cases inputStep
          exact ⟨rfl, rfl⟩
      | syncRight inputStep outputStep binderFresh =>
          cases inputStep
      | closeLeft outputStep inputStep freshForReceiver binderFresh =>
          cases outputStep
      | closeRight inputStep outputStep freshForReceiver binderFresh =>
          cases inputStep
  | «open» distinct bodyStep =>
      cases bodyStep with
      | parLeft _ senderStep =>
          cases senderStep
      | parRight _ receiverStep =>
          cases receiverStep

/-- The four internal event families covered by the closed redesign. -/
inductive ClosedInternalEvent where
  | communication
  | openClose
  | reconnect
  | quiescentDelete
  deriving DecidableEq, Repr, Fintype

def source : ClosedInternalEvent → Raw.Proc
  | .communication => closedCommunicationSource.erase
  | .openClose => closedOpenCloseSource.erase
  | .reconnect => closedReconnectSource.erase
  | .quiescentDelete => closedQuiescentDeleteSource.erase

def target : ClosedInternalEvent → Raw.Proc
  | .communication => closedCommunicationTarget.erase
  | .openClose => closedOpenCloseTarget.erase
  | .reconnect => closedReconnectTarget.erase
  | .quiescentDelete => closedQuiescentDeleteTarget.erase

/-- Every redesigned internal event has a genuine strong native tau step. -/
theorem native (event : ClosedInternalEvent) :
    Late.NativeStep (source event) .tau (target event) := by
  cases event with
  | communication => exact closed_communication_native
  | openClose => exact closed_open_close_native
  | reconnect => exact closed_reconnect_native
  | quiescentDelete => exact closed_quiescent_delete_native

/--
The constructive witnesses are exhaustive at each of the four redesigned
source processes: every raw native transition has exactly the designated
label and endpoint.
-/
theorem native_exact
    (event : ClosedInternalEvent)
    {action : Raw.Action} {next : Raw.Proc}
    (step : Late.NativeStep (source event) action next) :
    action = .tau ∧ next = target event := by
  cases event with
  | communication =>
      exact closed_communication_native_exact step
  | openClose =>
      exact closed_open_close_native_exact step
  | reconnect =>
      exact closed_reconnect_native_exact step
  | quiescentDelete =>
      exact closed_quiescent_delete_native_exact step

/-!
## Remaining event-isolation obstruction

Exact source classification is necessary but not sufficient for the existing
two-state-per-event source LTS: the open/close endpoint is an intermediate
session state and has the payload transition proved above.
-/

namespace ClosedFullNativeTarget

structure State where
  event : SourceEvent
  process : Raw.Proc
  deriving DecidableEq, Repr

inductive Step : State → Raw.Action → State → Prop where
  | native (event : SourceEvent)
      (step : Late.NativeStep process action next) :
      Step ⟨event, process⟩ action ⟨event, next⟩

def sourceProcess : SourceEvent → Raw.Proc
  | .communication => closedCommunicationSource.erase
  | .openClose => closedOpenCloseSource.erase
  | .instanceReconnect => closedReconnectSource.erase
  | .instanceDeleteQuiescent => closedQuiescentDeleteSource.erase
  | event => (piReferenceDerivation event).source.erase

def targetProcess : SourceEvent → Raw.Proc
  | .communication => closedCommunicationTarget.erase
  | .openClose => closedOpenCloseTarget.erase
  | .instanceReconnect => closedReconnectTarget.erase
  | .instanceDeleteQuiescent => closedQuiescentDeleteTarget.erase
  | event => (piReferenceDerivation event).target.erase

def mapState : SourceState → State
  | .ready event => ⟨event, sourceProcess event⟩
  | .completed event => ⟨event, targetProcess event⟩

def success (state : State) : Prop :=
  state.process = targetProcess state.event

def lts : ObservableLTS where
  State := State
  Event := Raw.Action
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

def openCloseFollowupState : State :=
  ⟨.openClose, closedCompletedProcess.erase⟩

theorem open_close_followup_observable :
    lts.ObservableStep
      (mapState (.completed .openClose))
      .tau openCloseFollowupState := by
  exact
    ⟨Step.native .openClose
      closed_open_close_target_followup_native, trivial⟩

/--
Closing the four source protocols removes their environmental branches, but
the current event-isolated source LTS still cannot reflect the complete raw
native LTS: its `completed openClose` state has no source step while the
actual process has the payload step.  Resolving this requires a multi-state
source protocol or a different one-step endpoint, not a restricted target
wrapper.
-/
theorem no_event_isolated_projection_certificate :
    ¬ ∃ certificate : ProjectionCertificate sourceLTS lts,
        ∀ state, certificate.mapState state = mapState state := by
  rintro ⟨certificate, mapAgreement⟩
  have targetStep :
      lts.ObservableStep
        (certificate.mapState (.completed .openClose))
        .tau openCloseFollowupState := by
    rw [mapAgreement]
    exact open_close_followup_observable
  obtain ⟨event, sourceTarget, sourceStep, _lift, _endpoint⟩ :=
    certificate.reflect targetStep
  rcases sourceStep with ⟨step, _observable⟩
  cases step

end ClosedFullNativeTarget

end Cantilune.Pi.P1cClosedNativeCertificate
