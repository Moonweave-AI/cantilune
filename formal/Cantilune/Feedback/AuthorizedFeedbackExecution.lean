import Cantilune.Feedback.AuthorizedVoting
import Cantilune.Feedback.Execution

/-!
# A replayable authorized feedback reference execution

This module supplies the nonempty reference calculus required by the feedback
metatheory.  Two independently authorized observers first create an approval
quorum and then a simultaneous approval/rejection conflict.  The aggregate
does not decide that conflict.  The observed party subsequently emits either
an explicit acceptance or rejection event, after which an external hold can
continue forever.

The same finite LTS is packaged as an `ExecutionPackage`: every edge has an
endpoint-free replay recipe, the replay kernel validates its source stage,
and the feedback interpretation commutes with every native edge.
-/

noncomputable section

namespace Cantilune.Feedback.AuthorizedFeedbackExecution

open Cantilune.Core
open Cantilune.Feedback

/-- Five qualitative stages of the reference feedback run. -/
inductive State
  | empty
  | approval
  | conflict
  | accepted
  | rejected
  deriving DecidableEq, Repr, Fintype

/-- Every event identifies one edge, so replay cannot confuse equal endpoints. -/
inductive Event
  | recordApproval
  | recordRejection
  | partyAccept
  | partyReject
  | conflictExternalHold
  | acceptedExternalHold
  | rejectedExternalHold
  deriving DecidableEq, Repr, Fintype

/-- Independently specified native transition relation. -/
inductive Step : State → Event → State → Prop
  | recordApproval : Step .empty .recordApproval .approval
  | recordRejection : Step .approval .recordRejection .conflict
  | partyAccept : Step .conflict .partyAccept .accepted
  | partyReject : Step .conflict .partyReject .rejected
  | conflictHold : Step .conflict .conflictExternalHold .conflict
  | acceptedHold : Step .accepted .acceptedExternalHold .accepted
  | rejectedHold : Step .rejected .rejectedExternalHold .rejected

/-- All seven events are externally visible and retain their replay identities. -/
def lts : ObservableLTS where
  State := State
  Event := Event
  stateSetoid := ObservableLTS.equalitySetoid State
  step := Step
  observable := fun _ => True
  success := fun _ => False
  waiting := fun
    | .accepted | .rejected => True
    | _ => False
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

/-- Stable numeric stage codes stored in replay configurations. -/
def State.code : State → Nat
  | .empty => 0
  | .approval => 1
  | .conflict => 2
  | .accepted => 3
  | .rejected => 4

theorem State.code_injective : Function.Injective State.code := by
  intro left right equality
  cases left <;> cases right <;> simp_all [State.code]

/-- Rule identifiers are disjoint from the business-rule range. -/
def Event.ruleId : Event → Nat
  | .recordApproval => 70
  | .recordRejection => 71
  | .partyAccept => 72
  | .partyReject => 73
  | .acceptedExternalHold => 74
  | .rejectedExternalHold => 75
  | .conflictExternalHold => 76

def Event.source : Event → State
  | .recordApproval => .empty
  | .recordRejection => .approval
  | .partyAccept | .partyReject => .conflict
  | .conflictExternalHold => .conflict
  | .acceptedExternalHold => .accepted
  | .rejectedExternalHold => .rejected

def Event.target : Event → State
  | .recordApproval => .approval
  | .recordRejection => .conflict
  | .partyAccept => .accepted
  | .partyReject => .rejected
  | .conflictExternalHold => .conflict
  | .acceptedExternalHold => .accepted
  | .rejectedExternalHold => .rejected

theorem Event.native (event : Event) :
    lts.ObservableStep event.source event event.target := by
  cases event <;> constructor <;> constructor

/-- Empty graph configuration whose policy field records the feedback stage. -/
def configOf (σ : FinSignature) (state : State) : Config σ where
  signatureVersion := 0
  nodes := ∅
  edges := ∅
  nodeLabel := fun _ => none
  dataTokens := ∅
  resourceTokens := ∅
  names := ∅
  dataOwner := fun _ => none
  resourceOwner := fun _ => none
  sessionOwner := fun _ => none
  externalObservations := [state.code]
  policyState := state.code
  tombstones := ∅

theorem configOf_wellFormed (σ : FinSignature) (state : State) :
    (configOf σ state).WellFormed := by
  simp [configOf, Config.WellFormed]

/-- Decode only the seven allocated rule identifiers. -/
def decodeRule : Nat → Option Event
  | 70 => some .recordApproval
  | 71 => some .recordRejection
  | 72 => some .partyAccept
  | 73 => some .partyReject
  | 74 => some .acceptedExternalHold
  | 75 => some .rejectedExternalHold
  | 76 => some .conflictExternalHold
  | _ => none

@[simp]
theorem decodeRule_ruleId (event : Event) :
    decodeRule event.ruleId = some event := by
  cases event <;> rfl

/--
The kernel checks the complete finite recipe fingerprint and the exact source
stage before computing the target stage.
-/
def replayKernel (σ : FinSignature) : DPOEvent.ReplayKernel σ where
  run recipe source :=
    match decodeRule recipe.ruleId with
    | none => none
    | some event =>
        if recipe.signatureVersion = source.signatureVersion ∧
            recipe.matchDomainSize = 0 ∧
            recipe.matchCodomainSize = 0 ∧
            recipe.complementTag = event.ruleId ∧
            recipe.freshNames = ∅ ∧
            recipe.policyEvidence = [event.source.code] ∧
            recipe.externalEvidence = [event.target.code] ∧
            recipe.kind = .external ∧
            source.policyState = event.source.code ∧
            source.externalObservations = [event.source.code] then
          some
            { source with
              externalObservations := [event.target.code]
              policyState := event.target.code }
        else
          none

/-- Complete endpoint record for one native feedback edge. -/
def eventRecord (σ : FinSignature) (event : Event) : DPOEvent σ where
  signatureVersion := 0
  ruleId := event.ruleId
  source := configOf σ event.source
  target := configOf σ event.target
  matchDomainSize := 0
  matchCodomainSize := 0
  matchEmbedding :=
    { toFun := Fin.elim0
      inj' := fun value => Fin.elim0 value }
  complementTag := event.ruleId
  freshNames := ∅
  policyEvidence := [event.source.code]
  externalEvidence := [event.target.code]
  kind := .external
  sourceVersion := rfl
  targetVersion := rfl
  freshForSource := by simp
  sourceWellFormed := configOf_wellFormed σ event.source
  targetWellFormed := configOf_wellFormed σ event.target

/-- The endpoint-free kernel recomputes the recorded target. -/
def verifiedRecord (σ : FinSignature) (event : Event) :
    DPOEvent.Verified (replayKernel σ) where
  event := eventRecord σ event
  replay_correct := by
    cases event <;>
      simp [eventRecord, DPOEvent.replayRecipe, replayKernel, decodeRule,
        Event.ruleId, Event.source, Event.target, State.code, configOf]

/-- A real execution package shared by voting and feedback semantics. -/
def package (σ : FinSignature) : ExecutionPackage σ where
  lts := lts
  configOf := configOf σ
  replayKernel := replayKernel σ
  eventRecord := verifiedRecord σ
  eventEndpoints := by
    intro source event target step
    rcases step with ⟨native, _observed⟩
    cases native <;>
      refine ⟨rfl, ?_⟩ <;>
      exact (verifiedRecord σ _).replay_correct
  stateVersion := by intro state; rfl
  resourcesClear := fun state => (configOf σ state).resourceTokens = ∅
  sessionsQuiescent := fun state => (configOf σ state).names = ∅
  deletionPermitted := fun _ => False
  deletion_requires_resources := by simp
  deletion_requires_quiescence := by simp
  ranking :=
    { internal := fun _ => False
      rank := fun _ => 0
      epoch := fun _ => 0
      decreases := by simp
      epoch_preserved := by simp }

/-! ## Authorized ballots and explicit conflict -/

abbrev Observer := Fin 2
abbrev Subject := Unit

def system : FeedbackSystem Observer Subject 2 where
  quorum := 1
  quorum_le_observers := by decide
  authorized := fun _ _ => True
  authorized_decidable := by
    intro observer subject
    infer_instance

def approvalBallot : Ballot 2 where
  evidence := ⟨1, by omega⟩
  approve := true
  evidenceId := 100

def rejectionBallot : Ballot 2 where
  evidence := ⟨2, by omega⟩
  approve := false
  evidenceId := 101

def approvalBox : AuthorizedBallotBox system :=
  (AuthorizedBallotBox.empty system ()).record 0 approvalBallot trivial

def conflictBox : AuthorizedBallotBox system :=
  approvalBox.record 1 rejectionBallot trivial

theorem approvalBox_status :
    system.quorumStatus approvalBox.box = .approval := by
  decide

theorem conflictBox_status :
    system.quorumStatus conflictBox.box = .conflict := by
  decide

/-- Recording either identity twice remains deduplicated. -/
theorem approval_record_idempotent :
    approvalBox.record 0 approvalBallot trivial = approvalBox :=
  AuthorizedBallotBox.record_idempotent
    (AuthorizedBallotBox.empty system ()) 0 approvalBallot trivial

/-- The two distinct authorized updates commute before aggregation. -/
theorem authorized_updates_commute :
    ((AuthorizedBallotBox.empty system ()).record
        0 approvalBallot trivial).record 1 rejectionBallot trivial =
      ((AuthorizedBallotBox.empty system ()).record
        1 rejectionBallot trivial).record 0 approvalBallot trivial := by
  exact AuthorizedBallotBox.record_commute
    (AuthorizedBallotBox.empty system ())
    (by decide) approvalBallot rejectionBallot trivial trivial

/-! ## Exact feedback interpretation of the same execution -/

def stateMap : State → FeedbackState 2
  | .empty => { evidence := ⟨0, by omega⟩, accepted := false }
  | .approval => { evidence := ⟨1, by omega⟩, accepted := false }
  | .conflict => { evidence := ⟨2, by omega⟩, accepted := false }
  | .accepted => { evidence := ⟨2, by omega⟩, accepted := true }
  | .rejected => { evidence := ⟨2, by omega⟩, accepted := false }

def acceptDecision : ExternalDecisionEvent Subject where
  subject := ()
  decision := .accept
  evidenceId := 101
  replayId := 200

def rejectDecision : ExternalDecisionEvent Subject where
  subject := ()
  decision := .reject
  evidenceId := 101
  replayId := 201

def eventMap :
    Event → FeedbackEvent 2 (ExternalDecisionEvent Subject)
  | .recordApproval => .evidence ⟨1, by omega⟩
  | .recordRejection => .evidence ⟨2, by omega⟩
  | .partyAccept => acceptDecision.toFeedbackEvent
  | .partyReject => rejectDecision.toFeedbackEvent
  | .conflictExternalHold
  | .acceptedExternalHold
  | .rejectedExternalHold => .evidence ⟨0, by omega⟩

/--
Every native execution edge is exactly one feedback update.  Acceptance is
changed only by the two explicit external decision events.
-/
def bridge (σ : FinSignature) :
    ExecutionFeedbackBridge
      σ Observer Subject 2 (ExternalDecisionEvent Subject) where
  package := package σ
  feedbackSystem := system
  stateMap := stateMap
  eventMap := eventMap
  step_commutes := by
    intro source event target step
    rcases step with ⟨native, _observed⟩
    cases native <;> rfl

/-- Aggregation alone leaves the observed party autonomous. -/
theorem conflict_aggregate_preserves_autonomy :
    (BallotBox.applyAggregate (stateMap .approval) conflictBox.box).accepted =
      (stateMap .approval).accepted :=
  BallotBox.applyAggregate_preserves_acceptance _ _

theorem explicit_accept_changes_only_decision_bit :
    applyEvent (stateMap .conflict) (eventMap .partyAccept) =
      stateMap .accepted :=
  rfl

theorem explicit_reject_changes_only_decision_bit :
    applyEvent (stateMap .conflict) (eventMap .partyReject) =
      stateMap .rejected :=
  rfl

/- Both post-decision branches carry productive infinite external traces. -/
def acceptedInfiniteExecution : InfiniteExecution lts where
  state _ := .accepted
  event _ := .acceptedExternalHold
  step _ := Event.native .acceptedExternalHold

def rejectedInfiniteExecution : InfiniteExecution lts where
  state _ := .rejected
  event _ := .rejectedExternalHold
  step _ := Event.native .rejectedExternalHold

theorem accepted_trace_externally_productive (σ : FinSignature) :
    ExternallyProductive (package σ).ranking acceptedInfiniteExecution :=
  infinite_execution_productive (package σ).ranking acceptedInfiniteExecution

theorem rejected_trace_externally_productive (σ : FinSignature) :
    ExternallyProductive (package σ).ranking rejectedInfiniteExecution :=
  infinite_execution_productive (package σ).ranking rejectedInfiniteExecution

/--
All seven reference edges simultaneously carry a native step, exact DPO-event
replay, and the commuting feedback update.
-/
theorem complete_reference_edge
    (σ : FinSignature) (event : Event) :
    lts.ObservableStep event.source event event.target ∧
      ((package σ).eventRecord event).Replays
        ((package σ).configOf event.source)
        ((package σ).configOf event.target) ∧
      stateMap event.target =
        applyEvent (stateMap event.source) (eventMap event) := by
  refine ⟨event.native, (package σ).eventEndpoints event.native, ?_⟩
  exact (bridge σ).step_commutes event.native

end Cantilune.Feedback.AuthorizedFeedbackExecution
