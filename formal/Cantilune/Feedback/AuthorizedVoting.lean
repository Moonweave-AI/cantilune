import Cantilune.Feedback.Voting

/-!
# Authorization- and quorum-aware voting

`BallotBox` provides canonical identity deduplication and order-independent
aggregation.  This module adds the two policy-independent invariants that a
configured `FeedbackSystem` can enforce without deciding a product conflict
policy:

* every stored ballot has an authorization proof for the box subject; and
* approval/rejection quorum outcomes are classified explicitly, including the
  case where both quorums hold.

The conflict case is data, not an implicit tie-breaker.  The observed party's
acceptance bit remains unchanged until a separate external decision event is
replayed.
-/

namespace Cantilune.Feedback

variable {Observer Subject : Type} {height : Nat}
variable [Fintype Observer] [DecidableEq Observer]

/--
A canonical ballot box whose every occupied observer slot is authorized for
the selected subject.
-/
structure AuthorizedBallotBox
    (system : FeedbackSystem Observer Subject height) where
  box : BallotBox Observer Subject height
  stored_authorized :
    ∀ observer ballot,
      box.voteOf observer = some ballot →
        system.authorized observer box.subject

namespace AuthorizedBallotBox

variable {system : FeedbackSystem Observer Subject height}

/-- Extensionality; authorization witnesses are propositions. -/
@[ext]
theorem ext
    {left right : AuthorizedBallotBox system}
    (sameBox : left.box = right.box) :
    left = right := by
  cases left
  cases right
  cases sameBox
  rfl

/-- Empty authorized box for a selected subject. -/
def empty
    (system : FeedbackSystem Observer Subject height)
    (subject : Subject) :
    AuthorizedBallotBox system where
  box :=
    { subject := subject
      voteOf := fun _ => none }
  stored_authorized := by
    intro observer ballot stored
    simp at stored

/--
Record a ballot only together with authorization evidence.  Deduplication is
still inherited from the single observer slot in `BallotBox`.
-/
def record
    (state : AuthorizedBallotBox system)
    (observer : Observer) (ballot : Ballot height)
    (authorized : system.authorized observer state.box.subject) :
    AuthorizedBallotBox system where
  box := state.box.record observer ballot
  stored_authorized := by
    intro candidate storedBallot stored
    by_cases same : candidate = observer
    · subst candidate
      change system.authorized observer state.box.subject
      exact authorized
    · change system.authorized candidate state.box.subject
      rw [BallotBox.record_other state.box same ballot] at stored
      exact state.stored_authorized candidate storedBallot stored

@[simp]
theorem empty_voteOf
    (system : FeedbackSystem Observer Subject height)
    (subject : Subject) (observer : Observer) :
    (empty system subject).box.voteOf observer = none :=
  rfl

@[simp]
theorem record_same
    (state : AuthorizedBallotBox system)
    (observer : Observer) (ballot : Ballot height)
    (authorized : system.authorized observer state.box.subject) :
    (state.record observer ballot authorized).box.voteOf observer =
      some ballot :=
  BallotBox.record_same state.box observer ballot

@[simp]
theorem record_other
    (state : AuthorizedBallotBox system)
    {recorded other : Observer} (different : other ≠ recorded)
    (ballot : Ballot height)
    (authorized : system.authorized recorded state.box.subject) :
    (state.record recorded ballot authorized).box.voteOf other =
      state.box.voteOf other :=
  BallotBox.record_other state.box different ballot

@[simp]
theorem record_subject
    (state : AuthorizedBallotBox system)
    (observer : Observer) (ballot : Ballot height)
    (authorized : system.authorized observer state.box.subject) :
    (state.record observer ballot authorized).box.subject =
      state.box.subject :=
  rfl

/-- Authorization is recoverable from every occupied canonical slot. -/
theorem authorized_of_stored
    (state : AuthorizedBallotBox system)
    {observer : Observer} {ballot : Ballot height}
    (stored : state.box.voteOf observer = some ballot) :
    system.authorized observer state.box.subject :=
  state.stored_authorized observer ballot stored

/-- A repeated identical ballot is idempotent, including its authorization proof. -/
theorem record_idempotent
    (state : AuthorizedBallotBox system)
    (observer : Observer) (ballot : Ballot height)
    (authorized : system.authorized observer state.box.subject) :
    (state.record observer ballot authorized).record observer ballot
        (by
          change system.authorized observer state.box.subject
          exact authorized) =
      state.record observer ballot authorized := by
  apply AuthorizedBallotBox.ext
  apply BallotBox.ext_of_voteOf
  · rfl
  · intro candidate
    by_cases same : candidate = observer
    · subst candidate
      simp
    · simp [record, BallotBox.record, same]

/--
Distinct authorized observer updates commute.  The proof fields are
propositionally irrelevant; the canonical ballot boxes commute extensionally.
-/
theorem record_commute
    (state : AuthorizedBallotBox system)
    {left right : Observer} (different : left ≠ right)
    (leftBallot rightBallot : Ballot height)
    (leftAuthorized : system.authorized left state.box.subject)
    (rightAuthorized : system.authorized right state.box.subject) :
    (state.record left leftBallot leftAuthorized).record right rightBallot
        (by
          change system.authorized right state.box.subject
          exact rightAuthorized) =
      (state.record right rightBallot rightAuthorized).record left leftBallot
        (by
          change system.authorized left state.box.subject
          exact leftAuthorized) := by
  apply AuthorizedBallotBox.ext
  exact BallotBox.record_commute state.box different leftBallot rightBallot

end AuthorizedBallotBox

/-- The four policy-independent quorum outcomes. -/
inductive QuorumStatus
  | none
  | approval
  | rejection
  | conflict
  deriving DecidableEq, Repr

namespace FeedbackSystem

variable (system : FeedbackSystem Observer Subject height)

def ApprovalQuorum (box : BallotBox Observer Subject height) : Prop :=
  system.quorum ≤ box.approvalCount

def RejectionQuorum (box : BallotBox Observer Subject height) : Prop :=
  system.quorum ≤ box.rejectionCount

instance (box : BallotBox Observer Subject height) :
    Decidable (system.ApprovalQuorum box) :=
  by
    unfold ApprovalQuorum
    infer_instance

instance (box : BallotBox Observer Subject height) :
    Decidable (system.RejectionQuorum box) :=
  by
    unfold RejectionQuorum
    infer_instance

/--
Classify quorum without silently resolving a simultaneous approval/rejection
conflict.
-/
def quorumStatus (box : BallotBox Observer Subject height) : QuorumStatus :=
  if system.ApprovalQuorum box then
    if system.RejectionQuorum box then .conflict else .approval
  else if system.RejectionQuorum box then .rejection else .none

theorem quorumStatus_eq_none_iff
    (box : BallotBox Observer Subject height) :
    system.quorumStatus box = .none ↔
      ¬system.ApprovalQuorum box ∧ ¬system.RejectionQuorum box := by
  by_cases approval : system.ApprovalQuorum box <;>
    by_cases rejection : system.RejectionQuorum box <;>
    simp [quorumStatus, approval, rejection]

theorem quorumStatus_eq_approval_iff
    (box : BallotBox Observer Subject height) :
    system.quorumStatus box = .approval ↔
      system.ApprovalQuorum box ∧ ¬system.RejectionQuorum box := by
  by_cases approval : system.ApprovalQuorum box <;>
    by_cases rejection : system.RejectionQuorum box <;>
    simp [quorumStatus, approval, rejection]

theorem quorumStatus_eq_rejection_iff
    (box : BallotBox Observer Subject height) :
    system.quorumStatus box = .rejection ↔
      ¬system.ApprovalQuorum box ∧ system.RejectionQuorum box := by
  by_cases approval : system.ApprovalQuorum box <;>
    by_cases rejection : system.RejectionQuorum box <;>
    simp [quorumStatus, approval, rejection]

theorem quorumStatus_eq_conflict_iff
    (box : BallotBox Observer Subject height) :
    system.quorumStatus box = .conflict ↔
      system.ApprovalQuorum box ∧ system.RejectionQuorum box := by
  by_cases approval : system.ApprovalQuorum box <;>
    by_cases rejection : system.RejectionQuorum box <;>
    simp [quorumStatus, approval, rejection]

/-- A non-`none` status is exactly the existence of at least one quorum. -/
theorem quorumStatus_ne_none_iff
    (box : BallotBox Observer Subject height) :
    system.quorumStatus box ≠ .none ↔
      system.ApprovalQuorum box ∨ system.RejectionQuorum box := by
  by_cases approval : system.ApprovalQuorum box <;>
    by_cases rejection : system.RejectionQuorum box <;>
    simp [quorumStatus, approval, rejection]

/--
Quorum classification cannot autonomously change the observed party's
acceptance state; only an explicit external decision event can do so.
-/
theorem aggregate_after_quorum_preserves_acceptance
    (state : FeedbackState height)
    (box : AuthorizedBallotBox system) :
    (BallotBox.applyAggregate state box.box).accepted = state.accepted :=
  BallotBox.applyAggregate_preserves_acceptance state box.box

end FeedbackSystem

/--
An authorized aggregate that has reached at least one quorum.  A simultaneous
quorum remains representable; this record does not choose an acceptance
policy for it.
-/
structure AuthorizedQuorumEvent
    (system : FeedbackSystem Observer Subject height) where
  ballots : AuthorizedBallotBox system
  hasQuorum :
    system.ApprovalQuorum ballots.box ∨
      system.RejectionQuorum ballots.box

namespace AuthorizedQuorumEvent

variable {system : FeedbackSystem Observer Subject height}

/-- Embed the qualified aggregate as a monotone evidence event. -/
def toFeedbackEvent
    (event : AuthorizedQuorumEvent system) (Payload : Type) :
    FeedbackEvent height Payload :=
  .evidence event.ballots.box.aggregateEvidence

/-- The event replay is exactly the canonical aggregate update. -/
theorem apply_toFeedbackEvent
    (event : AuthorizedQuorumEvent system)
    (state : FeedbackState height) (Payload : Type) :
    applyEvent state (event.toFeedbackEvent Payload) =
      BallotBox.applyAggregate state event.ballots.box :=
  rfl

/-- Qualified evidence still cannot force party acceptance. -/
theorem preserves_acceptance
    (event : AuthorizedQuorumEvent system)
    (state : FeedbackState height) (Payload : Type) :
    (applyEvent state (event.toFeedbackEvent Payload)).accepted =
      state.accepted := by
  rw [event.apply_toFeedbackEvent state Payload]
  exact BallotBox.applyAggregate_preserves_acceptance state event.ballots.box

end AuthorizedQuorumEvent

end Cantilune.Feedback
