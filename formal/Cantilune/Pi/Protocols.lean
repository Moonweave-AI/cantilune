import Mathlib
import Cantilune.Pi.Core

/-!
# Executable request/accept and mobility witnesses

The constants below form a non-empty reference calculus.  They are proof
witnesses for strong transitions of `Cantilune.Pi.Step`, not a frozen product
API or, by themselves, a proof of equivalence with a complete standard π LTS.
-/

namespace Cantilune.Pi.Protocols

open Cantilune.Pi

def publicName : Name := 0
def session : Name := 1
def sessionBinder : Name := 2
def payload : Name := 3
def payloadBinder : Name := 4
def delegationBus : Name := 5
def delegated : Name := 6
def delegatedBinder : Name := 7

def publicChannel : Channel := ⟨publicName, .channel⟩
def sessionChannel : Channel := ⟨session, .data⟩
def boundSessionChannel : Channel := ⟨sessionBinder, .data⟩
def delegationChannel : Channel := ⟨delegationBus, .channel⟩
def delegatedChannel : Channel := ⟨delegated, .data⟩
def boundDelegatedChannel : Channel := ⟨delegatedBinder, .data⟩

/-- A finite environment that validates the names used by this reference suite. -/
def protocolEnv : TypeEnv where
  sort name :=
    if name ∈ ([publicName, session, sessionBinder, delegationBus,
        delegated, delegatedBinder] : List Name)
    then .channel
    else .data
  payload name :=
    if name = publicName ∨ name = delegationBus then .channel else .data

def requestContinuation : Proc :=
  .send sessionChannel payload .zero

def acceptContinuation : Proc :=
  .recv boundSessionChannel payloadBinder .zero

def request : Proc :=
  .send publicChannel session requestContinuation

def accept : Proc :=
  .recv publicChannel sessionBinder acceptContinuation

/-- Restriction around both partners: communication is `res(com)`. -/
def restrictedHandshake : Proc :=
  .new session (.par request accept)

def handshakeResult : Proc :=
  .new session
    (.par requestContinuation (.recv sessionChannel payloadBinder .zero))

/--
Closed request/accept states used by the projection certificates.  The outer
restriction prevents either endpoint from exposing a public input/output,
while the existing session restriction prevents the payload endpoints from
escaping independently.
-/
def closedRestrictedHandshake : Proc :=
  .new publicName restrictedHandshake

def closedHandshakeResult : Proc :=
  .new publicName handshakeResult

def closedCompletedProcess : Proc :=
  .new publicName (.new session (.par .zero .zero))

theorem accept_substitution :
    acceptContinuation.substitute sessionBinder session =
      some (.recv sessionChannel payloadBinder .zero) := by
  decide

/-- A request/accept handshake under a shared restriction is one kernel τ step. -/
theorem request_accept_handshake :
    Step restrictedHandshake .tau handshakeResult := by
  apply Step.restrict
  · simp [Action.names]
  · apply Step.syncLeft Step.prefixOutput Step.prefixInput
    exact accept_substitution

theorem closed_request_accept_handshake :
    Step closedRestrictedHandshake .tau closedHandshakeResult := by
  apply Step.restrict
  · simp [Action.names]
  · exact request_accept_handshake

theorem closed_payload_after_session :
    Step closedHandshakeResult .tau closedCompletedProcess := by
  apply Step.restrict
  · simp [Action.names]
  · apply Step.restrict
    · simp [Action.names]
    · apply Step.syncLeft Step.prefixOutput Step.prefixInput
      decide

/-- Restriction around the sender only: communication uses `open` and `close`. -/
def extrudedHandshake : Proc :=
  .par (.new session request) accept

theorem request_accept_scope_extrusion :
    Step extrudedHandshake .tau handshakeResult := by
  apply Step.scopeCloseLeft
  · exact Step.scopeOpen (by decide)
  · exact Step.prefixInput
  · exact accept_substitution

def messageSender : Proc :=
  .send sessionChannel payload .zero

def messageReceiver : Proc :=
  .recv sessionChannel payloadBinder .zero

/-- Ordinary value passing uses one `com`-shaped kernel τ transition. -/
theorem message_one_step :
    Step
      (.par messageSender messageReceiver)
      .tau
      (.par .zero .zero) := by
  apply Step.syncLeft Step.prefixOutput Step.prefixInput
  decide

def delegationSender : Proc :=
  .send delegationChannel delegated .zero

def delegationReceiverContinuation : Proc :=
  .send boundDelegatedChannel payload .zero

def delegationReceiver : Proc :=
  .recv delegationChannel delegatedBinder delegationReceiverContinuation

/--
Closed delegation states used by the projection certificate.  Restricting the
bus hides the offer/accept prefixes; restricting the delegated channel also
makes the post-delegation state genuinely terminal for the full native LTS.
-/
def closedDelegationOffering : Proc :=
  .new delegationBus
    (.new delegated (.par delegationSender delegationReceiver))

def closedDelegationResult : Proc :=
  .new delegationBus
    (.new delegated
      (.par .zero (.send delegatedChannel payload .zero)))

theorem delegation_substitution :
    delegationReceiverContinuation.substitute delegatedBinder delegated =
      some (.send delegatedChannel payload .zero) := by
  decide

/--
Delegation is ordinary name passing in the reference relation.  After the one
τ step, the receiver can use the received channel as a subject.
-/
theorem delegation_one_step :
    Step
      (.par delegationSender delegationReceiver)
      .tau
      (.par .zero (.send delegatedChannel payload .zero)) := by
  apply Step.syncLeft Step.prefixOutput Step.prefixInput
  exact delegation_substitution

theorem closed_delegation_one_step :
    Step closedDelegationOffering .tau closedDelegationResult := by
  apply Step.restrict
  · simp [Action.names]
  · apply Step.restrict
    · simp [Action.names]
    · exact delegation_one_step

/-! ## Finite-epoch administrative protocols

These witnesses do not add metadata-only transitions.  Reconnection is
ordinary channel delegation, while quiescent deletion is a shutdown
handshake whose two continuations are both `zero`.  The mismatch guard is a
native guard of the finite-control calculus and requires an actual inequality
proof.
-/

def mismatchDecision : Proc :=
  .matchNe payload payloadBinder (.tau .zero)

theorem mismatch_decision_one_step :
    Step mismatchDecision .tau .zero := by
  exact Step.mismatchGuard (by decide) Step.prefixTau

/--
Reconnect an instance by passing the replacement endpoint.  The receiver's
continuation immediately uses that endpoint, making this more than a
metadata-only relabelling.
-/
def reconnectOffering : Proc :=
  .par delegationSender delegationReceiver

def reconnectResult : Proc :=
  .par .zero (.send delegatedChannel payload .zero)

theorem reconnect_one_step :
    Step reconnectOffering .tau reconnectResult :=
  delegation_one_step

/--
Shutdown protocol for an already quiescent instance.  Both sides have no
continuation after the acknowledgement, so the resulting instance contains
no live session process.
-/
def quiescentDeleteOffering : Proc :=
  .par
    (.send delegationChannel delegated .zero)
    (.recv delegationChannel delegatedBinder .zero)

def quiescentDeleteResult : Proc :=
  .par .zero .zero

theorem quiescent_delete_one_step :
    Step quiescentDeleteOffering .tau quiescentDeleteResult := by
  apply Step.syncLeft Step.prefixOutput Step.prefixInput
  decide

theorem erased_mismatch_decision_one_step :
    Raw.Step mismatchDecision.erase .tau .zero :=
  Step.erase_preserves mismatch_decision_one_step

theorem erased_reconnect_one_step :
    Raw.Step reconnectOffering.erase .tau reconnectResult.erase :=
  Step.erase_preserves reconnect_one_step

theorem erased_quiescent_delete_one_step :
    Raw.Step
      quiescentDeleteOffering.erase .tau quiescentDeleteResult.erase :=
  Step.erase_preserves quiescent_delete_one_step

theorem mismatchDecision_wellTyped :
    mismatchDecision.WellTyped protocolEnv := by
  norm_num [mismatchDecision, Proc.WellTyped, protocolEnv, publicName,
    session, sessionBinder, payload, payloadBinder, delegationBus,
    delegated, delegatedBinder]

theorem reconnectOffering_wellTyped :
    reconnectOffering.WellTyped protocolEnv := by
  norm_num [reconnectOffering, delegationSender, delegationReceiver,
    delegationReceiverContinuation, Proc.WellTyped, protocolEnv,
    delegationChannel, delegatedChannel, boundDelegatedChannel, publicName,
    session, sessionBinder, payload, payloadBinder, delegationBus, delegated,
    delegatedBinder]

theorem reconnectResult_wellTyped :
    reconnectResult.WellTyped protocolEnv := by
  norm_num [reconnectResult, Proc.WellTyped, protocolEnv, delegatedChannel,
    publicName, session, sessionBinder, payload, payloadBinder, delegationBus,
    delegated, delegatedBinder]

theorem quiescentDeleteOffering_wellTyped :
    quiescentDeleteOffering.WellTyped protocolEnv := by
  norm_num [quiescentDeleteOffering, Proc.WellTyped, protocolEnv,
    delegationChannel, publicName, session, sessionBinder, payload,
    payloadBinder, delegationBus, delegated, delegatedBinder]

theorem quiescentDeleteResult_wellTyped :
    quiescentDeleteResult.WellTyped protocolEnv := by
  simp [quiescentDeleteResult, Proc.WellTyped]

theorem mismatch_decision_typed_step :
    TypedStep protocolEnv mismatchDecision .tau .zero :=
  ⟨mismatchDecision_wellTyped, mismatch_decision_one_step, trivial⟩

theorem reconnect_typed_step :
    TypedStep protocolEnv reconnectOffering .tau reconnectResult :=
  ⟨reconnectOffering_wellTyped, reconnect_one_step,
    reconnectResult_wellTyped⟩

theorem quiescent_delete_typed_step :
    TypedStep protocolEnv
      quiescentDeleteOffering .tau quiescentDeleteResult :=
  ⟨quiescentDeleteOffering_wellTyped, quiescent_delete_one_step,
    quiescentDeleteResult_wellTyped⟩

/--
A signature-admission request is represented by an ordinary visible input on a
registry channel; the core has no non-π registration rule.
-/
def admissionWait : Proc :=
  .recv delegationChannel delegatedBinder delegationReceiverContinuation

theorem admission_is_native_input :
    Step
      admissionWait
      (.input delegationChannel delegatedBinder)
      delegationReceiverContinuation :=
  Step.prefixInput

theorem admission_wait_is_open :
    OpenWait admissionWait :=
  ⟨delegationChannel, delegatedBinder, delegationReceiverContinuation, rfl⟩

theorem admission_wait_not_deadlocked :
    ¬Deadlocked admissionWait :=
  open_wait_not_deadlocked admission_wait_is_open

/-- The complete restricted request/accept witness is well typed. -/
theorem restrictedHandshake_wellTyped :
    restrictedHandshake.WellTyped protocolEnv := by
  norm_num [restrictedHandshake, request, accept, requestContinuation,
    acceptContinuation, Proc.WellTyped, protocolEnv, publicChannel,
    sessionChannel, boundSessionChannel, publicName, session, sessionBinder,
    payload, payloadBinder, delegationBus, delegated, delegatedBinder]

theorem handshakeResult_wellTyped :
    handshakeResult.WellTyped protocolEnv := by
  norm_num [handshakeResult, requestContinuation, Proc.WellTyped, protocolEnv,
    sessionChannel, publicName, session, sessionBinder, payload, payloadBinder,
    delegationBus, delegated, delegatedBinder]

theorem request_accept_typed_step :
    TypedStep protocolEnv restrictedHandshake .tau handshakeResult :=
  ⟨restrictedHandshake_wellTyped, request_accept_handshake,
    handshakeResult_wellTyped⟩

/-- The complete delegation witness is well typed. -/
theorem delegation_wellTyped :
    (Proc.par delegationSender delegationReceiver).WellTyped protocolEnv := by
  norm_num [delegationSender, delegationReceiver,
    delegationReceiverContinuation, Proc.WellTyped, protocolEnv,
    delegationChannel, delegatedChannel, boundDelegatedChannel, publicName,
    session, sessionBinder, payload, payloadBinder, delegationBus, delegated,
    delegatedBinder]

theorem delegationResult_wellTyped :
    (Proc.par .zero (.send delegatedChannel payload .zero)).WellTyped
      protocolEnv := by
  norm_num [Proc.WellTyped, protocolEnv, delegatedChannel, publicName, session,
    sessionBinder, payload, payloadBinder, delegationBus, delegated,
    delegatedBinder]

theorem delegation_typed_step :
    TypedStep protocolEnv
      (Proc.par delegationSender delegationReceiver)
      .tau
      (Proc.par .zero (.send delegatedChannel payload .zero)) :=
  ⟨delegation_wellTyped, delegation_one_step, delegationResult_wellTyped⟩

/-- Erasure preserves the request/accept τ step as one raw kernel step. -/
theorem erased_request_accept_handshake :
    Raw.Step
      restrictedHandshake.erase
      .tau
      handshakeResult.erase :=
  Step.erase_preserves request_accept_handshake

/-- Erasure preserves delegation with the same one-step granularity. -/
theorem erased_delegation_one_step :
    Raw.Step
      (Proc.par delegationSender delegationReceiver).erase
      .tau
      (Proc.par .zero (.send delegatedChannel payload .zero)).erase :=
  Step.erase_preserves delegation_one_step

end Cantilune.Pi.Protocols
