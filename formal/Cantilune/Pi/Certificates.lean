import Mathlib
import Cantilune.Core.Projection
import Cantilune.Pi.Protocols

/-!
# Finite native-step π projection certificates

This module turns the request/accept and delegation examples into genuine
`ProjectionCertificate` values.  The target transition system is the
independently defined native process relation from `Cantilune.Pi.Core`; its
observation policy selects native actions, never a reflexive-transitive or
weak closure. Typing is proved separately by the typed syntax and erasure
development; it is not hidden in this LTS state type.

The certificates are intentionally finite reference certificates.  They do
not claim completeness for a standard π-calculus modulo α-equivalence and
structural congruence.
-/

namespace Cantilune.Pi.Certificates

open Cantilune.Core
open Cantilune.Pi
open Cantilune.Pi.Protocols

/-- The native process relation viewed as an observable LTS with a chosen policy. -/
def nativeProcessLTS
    (observable : Action → Prop)
    (success waiting : Proc → Prop) :
    ObservableLTS where
  State := Proc
  Event := Action
  stateSetoid := ObservableLTS.equalitySetoid Proc
  step := Step
  observable := observable
  success := success
  waiting := waiting
  signatureVersion := fun _ => 0
  step_congr := by
    intro source source' event target target' hSource hTarget
    subst source'
    subst target'
    rfl
  success_congr := by
    intro source target h
    subst target
    rfl
  waiting_congr := by
    intro source target h
    subst target
    rfl
  signatureVersion_congr := by
    intros
    rfl

namespace RequestAccept

inductive State where
  | requesting
  | established
  | complete
  deriving DecidableEq, Repr, Fintype

inductive Event where
  | establishSession
  | transmitPayload
  deriving DecidableEq, Repr, Fintype

/-- Native source steps of the finite request/accept reference protocol. -/
inductive Step : State → Event → State → Prop where
  | establishSession :
      Step .requesting .establishSession .established
  | transmitPayload :
      Step .established .transmitPayload .complete

def success : State → Prop
  | .complete => True
  | .requesting
  | .established => False

def waiting (_ : State) : Prop := False

def sourceLTS : ObservableLTS where
  State := State
  Event := Event
  stateSetoid := ObservableLTS.equalitySetoid State
  step := Step
  observable := fun _ => True
  success := success
  waiting := waiting
  signatureVersion := fun _ => 0
  step_congr := by
    intro source source' event target target' hSource hTarget
    subst source'
    subst target'
    rfl
  success_congr := by
    intro source target h
    subst target
    rfl
  waiting_congr := by
    intro source target h
    subst target
    rfl
  signatureVersion_congr := by
    intros
    rfl

def completedProcess : Proc :=
  .new session (.par .zero .zero)

def closedProcess : Proc :=
  closedCompletedProcess

def mapState : State → Proc
  | .requesting => closedRestrictedHandshake
  | .established => closedHandshakeResult
  | .complete => closedProcess

def targetSuccess (process : Proc) : Prop :=
  process = closedProcess

def targetWaiting (_ : Proc) : Prop := False

/-- Every native action is observable; closed states exclude extra actions. -/
def targetLTS : ObservableLTS :=
  nativeProcessLTS (fun _ => True) targetSuccess targetWaiting

private theorem request_no_tau {target : Proc} :
    ¬Cantilune.Pi.Step request .tau target := by
  intro step
  cases step

private theorem request_no_input {ch : Channel} {binder : Name}
    {target : Proc} :
    ¬Cantilune.Pi.Step request (.input ch binder) target := by
  intro step
  cases step

private theorem request_no_boundOutput {ch : Channel} {fresh : Name}
    {target : Proc} :
    ¬Cantilune.Pi.Step request (.boundOutput ch fresh) target := by
  intro step
  cases step

private theorem accept_no_tau {target : Proc} :
    ¬Cantilune.Pi.Step accept .tau target := by
  intro step
  cases step

private theorem accept_no_output {ch : Channel} {value : Name}
    {target : Proc} :
    ¬Cantilune.Pi.Step accept (.output ch value) target := by
  intro step
  cases step

private theorem accept_no_boundOutput {ch : Channel} {fresh : Name}
    {target : Proc} :
    ¬Cantilune.Pi.Step accept (.boundOutput ch fresh) target := by
  intro step
  cases step

private theorem requestContinuation_no_tau {target : Proc} :
    ¬Cantilune.Pi.Step requestContinuation .tau target := by
  intro step
  cases step

private theorem requestContinuation_no_input {ch : Channel} {binder : Name}
    {target : Proc} :
    ¬Cantilune.Pi.Step requestContinuation (.input ch binder) target := by
  intro step
  cases step

private theorem requestContinuation_no_boundOutput {ch : Channel}
    {fresh : Name} {target : Proc} :
    ¬Cantilune.Pi.Step requestContinuation (.boundOutput ch fresh) target := by
  intro step
  cases step

private theorem payloadReceiver_no_tau {target : Proc} :
    ¬Cantilune.Pi.Step
      (.recv sessionChannel payloadBinder .zero) .tau target := by
  intro step
  cases step

private theorem payloadReceiver_no_output {ch : Channel} {value : Name}
    {target : Proc} :
    ¬Cantilune.Pi.Step
      (.recv sessionChannel payloadBinder .zero) (.output ch value) target := by
  intro step
  cases step

private theorem payloadReceiver_no_boundOutput {ch : Channel}
    {fresh : Name} {target : Proc} :
    ¬Cantilune.Pi.Step
      (.recv sessionChannel payloadBinder .zero)
      (.boundOutput ch fresh) target := by
  intro step
  cases step

private theorem zero_no_step {action : Action} {target : Proc} :
    ¬Cantilune.Pi.Step .zero action target := by
  intro step
  cases step

theorem payload_after_session :
    Cantilune.Pi.Step handshakeResult .tau completedProcess := by
  apply Cantilune.Pi.Step.restrict
  · simp [Action.names]
  · apply Cantilune.Pi.Step.syncLeft
      Cantilune.Pi.Step.prefixOutput Cantilune.Pi.Step.prefixInput
    decide

theorem requesting_tau_unique {target : Proc}
    (step : Cantilune.Pi.Step restrictedHandshake .tau target) :
    target = handshakeResult := by
  cases step with
  | restrict fresh inner =>
      cases inner with
      | parLeft step =>
          exact False.elim (request_no_tau step)
      | parRight step =>
          exact False.elim (accept_no_tau step)
      | syncLeft outputStep inputStep substitution =>
          cases outputStep
          cases inputStep
          simp only [accept_substitution] at substitution
          cases substitution
          rfl
      | syncRight inputStep outputStep substitution =>
          exact False.elim (request_no_input inputStep)
      | scopeCloseLeft outputStep inputStep substitution =>
          exact False.elim (request_no_boundOutput outputStep)
      | scopeCloseRight inputStep outputStep substitution =>
          exact False.elim (request_no_input inputStep)

theorem established_tau_unique {target : Proc}
    (step : Cantilune.Pi.Step handshakeResult .tau target) :
    target = completedProcess := by
  cases step with
  | restrict fresh inner =>
      cases inner with
      | parLeft step =>
          exact False.elim (requestContinuation_no_tau step)
      | parRight step =>
          exact False.elim (payloadReceiver_no_tau step)
      | syncLeft outputStep inputStep substitution =>
          cases outputStep
          cases inputStep
          have expected :
              (Proc.zero.substitute payloadBinder payload) = some Proc.zero := by
            decide
          rw [expected] at substitution
          cases substitution
          rfl
      | syncRight inputStep outputStep substitution =>
          exact False.elim (requestContinuation_no_input inputStep)
      | scopeCloseLeft outputStep inputStep substitution =>
          exact False.elim
            (requestContinuation_no_boundOutput outputStep)
      | scopeCloseRight inputStep outputStep substitution =>
          exact False.elim (requestContinuation_no_input inputStep)

theorem complete_no_tau {target : Proc} :
    ¬Cantilune.Pi.Step completedProcess .tau target := by
  intro step
  cases step with
  | restrict fresh inner =>
      cases inner with
      | parLeft step =>
          exact zero_no_step step
      | parRight step =>
          exact zero_no_step step
      | syncLeft outputStep inputStep substitution =>
          exact zero_no_step outputStep
      | syncRight inputStep outputStep substitution =>
          exact zero_no_step inputStep
      | scopeCloseLeft outputStep inputStep substitution =>
          exact zero_no_step outputStep
      | scopeCloseRight inputStep outputStep substitution =>
          exact zero_no_step inputStep

private theorem restrictedHandshake_step_tau_or_public
    {action : Action} {target : Proc}
    (step : Cantilune.Pi.Step restrictedHandshake action target) :
    action = .tau ∨ publicName ∈ action.names := by
  cases step with
  | restrict fresh inner =>
      cases inner with
      | parLeft requestStep =>
          cases requestStep
          exact Or.inr (by simp [Action.names, publicChannel, publicName])
      | parRight acceptStep =>
          cases acceptStep
          exact Or.inr (by simp [Action.names, publicChannel, publicName])
      | syncLeft outputStep inputStep substitution =>
          exact Or.inl rfl
      | syncRight inputStep outputStep substitution =>
          exact Or.inl rfl
      | scopeCloseLeft outputStep inputStep substitution =>
          exact Or.inl rfl
      | scopeCloseRight inputStep outputStep substitution =>
          exact Or.inl rfl

/--
The closed requesting state has exactly its intended native transition.  This
quantifies over every native action rather than relying on an observation
filter.
-/
theorem requesting_native_unique {action : Action} {target : Proc}
    (step : Cantilune.Pi.Step closedRestrictedHandshake action target) :
    action = .tau ∧ target = closedHandshakeResult := by
  cases step with
  | restrict publicFresh inner =>
      rcases restrictedHandshake_step_tau_or_public inner with isTau | publicUsed
      · subst action
        exact
          ⟨rfl, congrArg (Proc.new publicName) (requesting_tau_unique inner)⟩
      · exact False.elim (publicFresh publicUsed)

private theorem handshakeResult_step_is_tau
    {action : Action} {target : Proc}
    (step : Cantilune.Pi.Step handshakeResult action target) :
    action = .tau := by
  cases step with
  | restrict sessionFresh inner =>
      cases inner with
      | parLeft outputStep =>
          cases outputStep
          exact False.elim
            (sessionFresh (by simp [Action.names, sessionChannel, session]))
      | parRight inputStep =>
          cases inputStep
          exact False.elim
            (sessionFresh (by simp [Action.names, sessionChannel, session]))
      | syncLeft outputStep inputStep substitution =>
          rfl
      | syncRight inputStep outputStep substitution =>
          rfl
      | scopeCloseLeft outputStep inputStep substitution =>
          rfl
      | scopeCloseRight inputStep outputStep substitution =>
          rfl

/-- The closed established state likewise has exactly the payload τ step. -/
theorem established_native_unique {action : Action} {target : Proc}
    (step : Cantilune.Pi.Step closedHandshakeResult action target) :
    action = .tau ∧ target = closedProcess := by
  cases step with
  | restrict publicFresh inner =>
      have isTau := handshakeResult_step_is_tau inner
      subst action
      exact
        ⟨rfl, congrArg (Proc.new publicName) (established_tau_unique inner)⟩

/-- The closed completed state has no transition of any native action. -/
theorem complete_no_native_step {action : Action} {target : Proc} :
    ¬Cantilune.Pi.Step closedProcess action target := by
  intro step
  cases step with
  | restrict publicFresh outer =>
      cases outer with
      | restrict sessionFresh inner =>
          cases inner with
          | parLeft zeroStep =>
              exact zero_no_step zeroStep
          | parRight zeroStep =>
              exact zero_no_step zeroStep
          | syncLeft outputStep inputStep substitution =>
              exact zero_no_step outputStep
          | syncRight inputStep outputStep substitution =>
              exact zero_no_step inputStep
          | scopeCloseLeft outputStep inputStep substitution =>
              exact zero_no_step outputStep
          | scopeCloseRight inputStep outputStep substitution =>
              exact zero_no_step inputStep

def mapEvent : Event → Action
  | .establishSession
  | .transmitPayload => .tau

/--
The complete request/accept certificate.  Each source event maps to exactly
one native strong π transition.  Reflection uses the source state together
with the native transition; it does not pretend that the bare `τ` label alone
identifies the source event.
-/
def pi_ra_certificate : ProjectionCertificate sourceLTS targetLTS where
  mapState := mapState
  mapEvent := mapEvent
  Lift := fun sourceEvent targetEvent => mapEvent sourceEvent = targetEvent
  lift_chosen := by
    intro event
    rfl
  map_equiv := by
    intro source target h
    subst target
    rfl
  sound := by
    intro source event target h
    rcases h with ⟨step, _⟩
    cases step
    · exact ⟨closed_request_accept_handshake, trivial⟩
    · exact ⟨closed_payload_after_session, trivial⟩
  reflect := by
    intro source action target h
    rcases h with ⟨step, _⟩
    cases source with
    | requesting =>
        rcases requesting_native_unique step with ⟨isTau, endpoint⟩
        subst action
        subst target
        exact
          ⟨.establishSession, .established,
            ⟨Step.establishSession, trivial⟩, rfl, rfl⟩
    | established =>
        rcases established_native_unique step with ⟨isTau, endpoint⟩
        subst action
        subst target
        exact
          ⟨.transmitPayload, .complete,
            ⟨Step.transmitPayload, trivial⟩, rfl, rfl⟩
    | complete =>
        exact False.elim (complete_no_native_step step)
  success_iff := by
    intro state
    cases state <;>
      simp [targetLTS, nativeProcessLTS, sourceLTS, targetSuccess, mapState,
        success, closedCompletedProcess,
        closedProcess,
        closedRestrictedHandshake, closedHandshakeResult, restrictedHandshake,
        handshakeResult, publicName,
        request, accept, requestContinuation, acceptContinuation]
  waiting_iff := by
    intro state
    rfl
  signatureVersion_preserved := by
    intro state
    rfl

theorem pi_ra_native_sound
    {source : State} {event : Event} {target : State}
    (step : sourceLTS.ObservableStep source event target) :
    targetLTS.ObservableStep
      (pi_ra_certificate.mapState source)
      (pi_ra_certificate.mapEvent event)
      (pi_ra_certificate.mapState target) :=
  pi_ra_certificate.sound step

end RequestAccept

namespace Mobility

inductive State where
  | offering
  | delegated
  deriving DecidableEq, Repr, Fintype

inductive Event where
  | delegateChannel
  deriving DecidableEq, Repr, Fintype

inductive Step : State → Event → State → Prop where
  | delegateChannel : Step .offering .delegateChannel .delegated

def sourceLTS : ObservableLTS where
  State := State
  Event := Event
  stateSetoid := ObservableLTS.equalitySetoid State
  step := Step
  observable := fun _ => True
  success := fun state => state = .delegated
  waiting := fun _ => False
  signatureVersion := fun _ => 0
  step_congr := by
    intro source source' event target target' hSource hTarget
    subst source'
    subst target'
    rfl
  success_congr := by
    intro source target h
    subst target
    rfl
  waiting_congr := by
    intro source target h
    subst target
    rfl
  signatureVersion_congr := by
    intros
    rfl

def offeringProcess : Proc :=
  .par delegationSender delegationReceiver

def delegatedProcess : Proc :=
  .par .zero (.send delegatedChannel payload .zero)

def closedOfferingProcess : Proc :=
  closedDelegationOffering

def closedDelegatedProcess : Proc :=
  closedDelegationResult

def mapState : State → Proc
  | .offering => closedOfferingProcess
  | .delegated => closedDelegatedProcess

def targetLTS : ObservableLTS :=
  nativeProcessLTS
    (fun _ => True)
    (fun process => process = closedDelegatedProcess)
    (fun _ => False)

private theorem sender_no_tau {target : Proc} :
    ¬Cantilune.Pi.Step delegationSender .tau target := by
  intro step
  cases step

private theorem sender_no_input {ch : Channel} {binder : Name}
    {target : Proc} :
    ¬Cantilune.Pi.Step delegationSender (.input ch binder) target := by
  intro step
  cases step

private theorem sender_no_boundOutput {ch : Channel} {fresh : Name}
    {target : Proc} :
    ¬Cantilune.Pi.Step delegationSender (.boundOutput ch fresh) target := by
  intro step
  cases step

private theorem receiver_no_tau {target : Proc} :
    ¬Cantilune.Pi.Step delegationReceiver .tau target := by
  intro step
  cases step

private theorem receiver_no_output {ch : Channel} {value : Name}
    {target : Proc} :
    ¬Cantilune.Pi.Step delegationReceiver (.output ch value) target := by
  intro step
  cases step

private theorem delegatedSend_no_tau {target : Proc} :
    ¬Cantilune.Pi.Step
      (.send delegatedChannel payload .zero) .tau target := by
  intro step
  cases step

private theorem delegatedSend_no_input {ch : Channel} {binder : Name}
    {target : Proc} :
    ¬Cantilune.Pi.Step
      (.send delegatedChannel payload .zero) (.input ch binder) target := by
  intro step
  cases step

private theorem delegatedSend_no_boundOutput {ch : Channel} {fresh : Name}
    {target : Proc} :
    ¬Cantilune.Pi.Step
      (.send delegatedChannel payload .zero) (.boundOutput ch fresh) target := by
  intro step
  cases step

private theorem zero_no_step {action : Action} {target : Proc} :
    ¬Cantilune.Pi.Step .zero action target := by
  intro step
  cases step

theorem offering_tau_unique {target : Proc}
    (step : Cantilune.Pi.Step offeringProcess .tau target) :
    target = delegatedProcess := by
  cases step with
  | parLeft step =>
      exact False.elim (sender_no_tau step)
  | parRight step =>
      exact False.elim (receiver_no_tau step)
  | syncLeft outputStep inputStep substitution =>
      cases outputStep
      cases inputStep
      simp only [delegation_substitution] at substitution
      cases substitution
      rfl
  | syncRight inputStep outputStep substitution =>
      exact False.elim (sender_no_input inputStep)
  | scopeCloseLeft outputStep inputStep substitution =>
      exact False.elim (sender_no_boundOutput outputStep)
  | scopeCloseRight inputStep outputStep substitution =>
      exact False.elim (sender_no_input inputStep)

theorem delegated_no_tau {target : Proc} :
    ¬Cantilune.Pi.Step delegatedProcess .tau target := by
  intro step
  cases step with
  | parLeft step =>
      exact zero_no_step step
  | parRight step =>
      exact delegatedSend_no_tau step
  | syncLeft outputStep inputStep substitution =>
      exact zero_no_step outputStep
  | syncRight inputStep outputStep substitution =>
      exact zero_no_step inputStep
  | scopeCloseLeft outputStep inputStep substitution =>
      exact zero_no_step outputStep
  | scopeCloseRight inputStep outputStep substitution =>
      exact zero_no_step inputStep

private theorem openOffering_step_tau_or_bus
    {action : Action} {target : Proc}
    (step :
      Cantilune.Pi.Step
        (.par delegationSender delegationReceiver) action target) :
    action = .tau ∨ delegationBus ∈ action.names := by
  cases step with
  | parLeft senderStep =>
      cases senderStep
      exact Or.inr
        (by simp [Action.names, delegationChannel, delegationBus])
  | parRight receiverStep =>
      cases receiverStep
      exact Or.inr
        (by simp [Action.names, delegationChannel, delegationBus])
  | syncLeft outputStep inputStep substitution =>
      exact Or.inl rfl
  | syncRight inputStep outputStep substitution =>
      exact Or.inl rfl
  | scopeCloseLeft outputStep inputStep substitution =>
      exact Or.inl rfl
  | scopeCloseRight inputStep outputStep substitution =>
      exact Or.inl rfl

/-- The closed offering state exposes only its intended native τ transition. -/
theorem offering_native_unique {action : Action} {target : Proc}
    (step : Cantilune.Pi.Step closedOfferingProcess action target) :
    action = .tau ∧ target = closedDelegatedProcess := by
  cases step with
  | restrict busFresh restrictedDelegated =>
      cases restrictedDelegated with
      | restrict delegatedFresh inner =>
          rcases openOffering_step_tau_or_bus inner with isTau | busUsed
          · subst action
            have endpoint := offering_tau_unique inner
            exact
              ⟨rfl,
                congrArg (fun process =>
                  Proc.new delegationBus (Proc.new delegated process))
                  endpoint⟩
          · exact False.elim (busFresh busUsed)

/-- Restricting the delegated subject makes the result fully native-terminal. -/
theorem delegated_no_native_step {action : Action} {target : Proc} :
    ¬Cantilune.Pi.Step closedDelegatedProcess action target := by
  intro step
  cases step with
  | restrict busFresh restrictedDelegated =>
      cases restrictedDelegated with
      | restrict delegatedFresh inner =>
          cases inner with
          | parLeft zeroStep =>
              exact zero_no_step zeroStep
          | parRight sendStep =>
              cases sendStep
              exact delegatedFresh
                (by simp [Action.names, delegatedChannel, delegated])
          | syncLeft outputStep inputStep substitution =>
              exact zero_no_step outputStep
          | syncRight inputStep outputStep substitution =>
              exact zero_no_step inputStep
          | scopeCloseLeft outputStep inputStep substitution =>
              exact zero_no_step outputStep
          | scopeCloseRight inputStep outputStep substitution =>
              exact zero_no_step inputStep

/--
A finite mobility certificate for one native channel-delegation communication.
It covers the reference delegation event, not unrestricted finite-control
mobility, dynamic signature admission, or structural congruence.
-/
def pi_mobility_certificate : ProjectionCertificate sourceLTS targetLTS where
  mapState := mapState
  mapEvent := fun _ => .tau
  Lift := fun _ targetEvent => targetEvent = .tau
  lift_chosen := by
    intro event
    rfl
  map_equiv := by
    intro source target h
    subst target
    rfl
  sound := by
    intro source event target h
    rcases h with ⟨step, _⟩
    cases step
    exact ⟨closed_delegation_one_step, trivial⟩
  reflect := by
    intro source action target h
    rcases h with ⟨step, _⟩
    cases source with
    | offering =>
        rcases offering_native_unique step with ⟨isTau, endpoint⟩
        subst action
        subst target
        exact
          ⟨.delegateChannel, .delegated,
            ⟨Step.delegateChannel, trivial⟩, rfl, rfl⟩
    | delegated =>
        exact False.elim (delegated_no_native_step step)
  success_iff := by
    intro state
    cases state <;>
      simp [targetLTS, nativeProcessLTS, sourceLTS, mapState,
        closedOfferingProcess, closedDelegatedProcess,
        closedDelegationOffering, closedDelegationResult,
        delegationSender, delegationReceiver, delegationReceiverContinuation,
        delegationBus, delegated]
  waiting_iff := by
    intro state
    rfl
  signatureVersion_preserved := by
    intro state
    rfl

theorem pi_mobility_native_sound
    {source : State} {event : Event} {target : State}
    (step : sourceLTS.ObservableStep source event target) :
    targetLTS.ObservableStep
      (pi_mobility_certificate.mapState source)
      (pi_mobility_certificate.mapEvent event)
      (pi_mobility_certificate.mapState target) :=
  pi_mobility_certificate.sound step

end Mobility

end Cantilune.Pi.Certificates
