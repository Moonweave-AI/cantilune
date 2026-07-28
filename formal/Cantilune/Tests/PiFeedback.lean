import Mathlib
import Cantilune.Pi
import Cantilune.Feedback

/-!
# π and feedback regressions

These executable checks stay inside the finite reference boundary.  They
cover capture rejection, the three native communication witnesses, open
waiting, identity-aware voting, explicit rejection, and stable evidence.
-/

namespace Cantilune.Tests.PiFeedback

open Cantilune.Pi
open Cantilune.Pi.Protocols
open Cantilune.Pi.Certificates
open Cantilune.Feedback

/-! Capture-safe substitution rejects a replacement captured by an input. -/

def captureCandidate : Proc :=
  .recv publicChannel sessionBinder
    (.send sessionChannel payload .zero)

example :
    captureCandidate.substitute payload sessionBinder = none := by
  native_decide

example :
    Proc.zero.substitute payload sessionBinder = some .zero := by
  native_decide

/-! Both handshake presentations and ordinary communication are native steps. -/

example :
    Cantilune.Pi.Step restrictedHandshake .tau handshakeResult :=
  request_accept_handshake

example :
    Cantilune.Pi.Step extrudedHandshake .tau handshakeResult :=
  request_accept_scope_extrusion

example :
    Cantilune.Pi.Step
      (.par messageSender messageReceiver)
      .tau
      (.par .zero .zero) :=
  message_one_step

example :
    Cantilune.Pi.Step
      (.par delegationSender delegationReceiver)
      .tau
      (.par .zero (.send delegatedChannel payload .zero)) :=
  delegation_one_step

/-!
Certificate states are closed: every native action is observable, and each
nonterminal image state has only its intended τ transition.
-/

example (action : Action) :
    RequestAccept.targetLTS.observable action :=
  trivial

example :
    Cantilune.Pi.Step
      closedRestrictedHandshake .tau closedHandshakeResult :=
  closed_request_accept_handshake

example {action : Action} {target : Proc}
    (step :
      Cantilune.Pi.Step closedRestrictedHandshake action target) :
    action = .tau ∧ target = closedHandshakeResult :=
  RequestAccept.requesting_native_unique step

example {action : Action} {target : Proc}
    (step :
      Cantilune.Pi.Step closedHandshakeResult action target) :
    action = .tau ∧ target = closedCompletedProcess :=
  RequestAccept.established_native_unique step

example {action : Action} {target : Proc} :
    ¬Cantilune.Pi.Step closedCompletedProcess action target :=
  RequestAccept.complete_no_native_step

example (action : Action) :
    Mobility.targetLTS.observable action :=
  trivial

example {action : Action} {target : Proc}
    (step :
      Cantilune.Pi.Step
        Mobility.closedOfferingProcess action target) :
    action = .tau ∧ target = Mobility.closedDelegatedProcess :=
  Mobility.offering_native_unique step

example {action : Action} {target : Proc} :
    ¬Cantilune.Pi.Step
      Mobility.closedDelegatedProcess action target :=
  Mobility.delegated_no_native_step

example : OpenWait admissionWait :=
  admission_wait_is_open

example : ¬Deadlocked admissionWait :=
  admission_wait_not_deadlocked

/-! Canonical observer slots deduplicate votes and commute when distinct. -/

def emptyBox : BallotBox (Fin 2) PUnit 3 where
  subject := PUnit.unit
  voteOf := fun _ => none

def observerZero : Fin 2 := ⟨0, by omega⟩
def observerOne : Fin 2 := ⟨1, by omega⟩

def approveBallot : Ballot 3 :=
  ⟨⟨2, by omega⟩, true, 10⟩

def rejectBallot : Ballot 3 :=
  ⟨⟨3, by omega⟩, false, 11⟩

def conflictingBox : BallotBox (Fin 2) PUnit 3 :=
  (emptyBox.record observerZero approveBallot).record
    observerOne rejectBallot

def replacementBox : BallotBox (Fin 2) PUnit 3 :=
  (emptyBox.record observerZero approveBallot).record
    observerZero rejectBallot

example :
    replacementBox.voteOf observerZero = some rejectBallot :=
  BallotBox.record_same _ _ _

example :
    conflictingBox.approvalCount = 1 ∧
      conflictingBox.rejectionCount = 1 := by
  native_decide

example :
    replacementBox.approvalCount = 0 ∧
      replacementBox.rejectionCount = 1 := by
  native_decide

example :
    (emptyBox.record observerZero approveBallot).record
        observerOne rejectBallot =
      (emptyBox.record observerOne rejectBallot).record
        observerZero approveBallot :=
  BallotBox.record_commute emptyBox (by decide) _ _

/-! Aggregation cannot force acceptance; decisions remain explicit events. -/

def pendingState : FeedbackState 3 :=
  ⟨⟨1, by omega⟩, false⟩

example :
    (BallotBox.applyAggregate pendingState conflictingBox).accepted = false :=
  BallotBox.applyAggregate_preserves_acceptance _ _

example :
    applyEvent pendingState
        (.externalReject ("declined" : String)) =
      pendingState :=
  externalReject_preserves_state _ _

example :
    ¬Productive pendingState
      (.externalReject ("declined" : String)) :=
  externalReject_not_productive _ _

def rejectionDecision : ExternalDecisionEvent PUnit :=
  ⟨PUnit.unit, .reject, 11, 99⟩

example :
    rejectionDecision.toFeedbackEvent (height := 3) =
      .externalReject rejectionDecision :=
  rfl

example :
    (applyEvents pendingState
      ([.evidence ⟨2, by omega⟩,
        .externalReject ("declined" : String)] :
        List (FeedbackEvent 3 String))).evidence.StableRegion 1 :=
  feedback_state_stable_set pendingState _ (by simp [Evidence.StableRegion,
    pendingState])

/-! The hard stable-set theorem is generic over finite-height join evidence. -/

def abstractEvidenceSystem : RankedJoinEvidence (Fin 4) where
  height := 3
  rank := Fin.val
  rank_bounded := by
    intro evidence
    omega
  rank_strict := by
    intro less more strict
    exact strict

def abstractStableRegion :
    RankedJoinEvidence.StableRegion (Fin 4) where
  holds := fun evidence => 1 ≤ evidence.val
  upward_closed := by
    intro less more order stable
    exact le_trans stable order

example :
    abstractStableRegion.holds
      (RankedJoinEvidence.accumulate
        (⟨1, by omega⟩ : Fin 4)
        [⟨2, by omega⟩, ⟨3, by omega⟩]) :=
  feedback_stable_set abstractEvidenceSystem abstractStableRegion
    ⟨1, by omega⟩ [⟨2, by omega⟩, ⟨3, by omega⟩] (by
      change 1 ≤ (⟨1, by omega⟩ : Fin 4).val
      exact le_rfl)

end Cantilune.Tests.PiFeedback
