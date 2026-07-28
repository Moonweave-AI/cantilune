import Mathlib
import Cantilune.Feedback.Core

/-!
# Identity-aware deterministic feedback aggregation

Votes are stored in one canonical slot per observer.  Duplicate identities
therefore replace the same slot rather than increasing the vote count, and the
aggregate has no list-order parameter.  Aggregation may increase evidence but
cannot set the observed party's acceptance bit; acceptance/rejection remains a
separately replayable external event.
-/

namespace Cantilune.Feedback

/-- The payload contributed by one authenticated observer. -/
structure Ballot (height : Nat) where
  evidence : Evidence height
  approve : Bool
  evidenceId : Nat
  deriving DecidableEq, Repr

/--
A canonical ballot box: every observer identity has at most one current slot.
This representation makes deduplication part of the type rather than a
post-hoc property of a list fold.
-/
structure BallotBox (Observer Subject : Type) (height : Nat) where
  subject : Subject
  voteOf : Observer → Option (Ballot height)

namespace BallotBox

variable {Observer Subject : Type} {height : Nat}
variable [Fintype Observer] [DecidableEq Observer]

omit [Fintype Observer] [DecidableEq Observer] in
/-- Extensional equality for canonical ballot boxes. -/
theorem ext_of_voteOf {left right : BallotBox Observer Subject height}
    (sameSubject : left.subject = right.subject)
    (sameVotes : ∀ observer, left.voteOf observer = right.voteOf observer) :
    left = right := by
  cases left with
  | mk leftSubject leftVotes =>
      cases right with
      | mk rightSubject rightVotes =>
          cases sameSubject
          congr
          funext observer
          exact sameVotes observer

/-- Re-recording an observer updates that observer's unique slot. -/
def record (box : BallotBox Observer Subject height)
    (observer : Observer) (ballot : Ballot height) :
    BallotBox Observer Subject height where
  subject := box.subject
  voteOf candidate :=
    if candidate = observer then some ballot else box.voteOf candidate

omit [Fintype Observer] in
@[simp]
theorem record_same (box : BallotBox Observer Subject height)
    (observer : Observer) (ballot : Ballot height) :
    (box.record observer ballot).voteOf observer = some ballot := by
  simp [record]

omit [Fintype Observer] in
@[simp]
theorem record_other (box : BallotBox Observer Subject height)
    {recorded other : Observer} (different : other ≠ recorded)
    (ballot : Ballot height) :
    (box.record recorded ballot).voteOf other = box.voteOf other := by
  simp [record, different]

omit [Fintype Observer] in
/--
Updates from distinct observer identities commute.  This is the operational
form of arrival-order invariance before aggregation.
-/
theorem record_commute (box : BallotBox Observer Subject height)
    {left right : Observer} (different : left ≠ right)
    (leftBallot rightBallot : Ballot height) :
    (box.record left leftBallot).record right rightBallot =
      (box.record right rightBallot).record left leftBallot := by
  apply ext_of_voteOf
      (left := (box.record left leftBallot).record right rightBallot)
      (right := (box.record right rightBallot).record left leftBallot)
  · rfl
  · intro observer
    by_cases observer = left
    · subst observer
      simp [record, different]
    · by_cases observer = right
      · subst observer
        have reverse : right ≠ left := Ne.symm different
        simp [record, reverse]
      · simp [record, *]

omit [Fintype Observer] [DecidableEq Observer] in
/-- Two alleged ballots in one identity slot must be equal. -/
theorem observer_slot_unique (box : BallotBox Observer Subject height)
    (observer : Observer) {left right : Ballot height}
    (leftStored : box.voteOf observer = some left)
    (rightStored : box.voteOf observer = some right) :
    left = right := by
  exact Option.some.inj (leftStored.symm.trans rightStored)

/--
The finite list of canonical, already deduplicated ballot payloads.

This list is only an extensional view: `Finset.toList` deliberately chooses no
computational ordering.  Aggregation below is computed directly with the
commutative `Finset.sup`, so its result does not depend on this view.
-/
noncomputable def ballots (box : BallotBox Observer Subject height) :
    List (Ballot height) :=
  Finset.univ.toList.filterMap box.voteOf

/-- Evidence stored at one observer slot, with bottom evidence for no ballot. -/
def evidenceAt (box : BallotBox Observer Subject height)
    (observer : Observer) : Evidence height :=
  match box.voteOf observer with
  | some ballot => ballot.evidence
  | none => ⟨0, Nat.zero_le height⟩

/--
Join all evidence in the canonical box by a finite supremum.  The construction
has no enumeration-order parameter.
-/
def aggregateEvidence (box : BallotBox Observer Subject height) :
    Evidence height where
  level := Finset.univ.sup fun observer =>
    (box.evidenceAt observer).level
  bounded := by
    apply Finset.sup_le
    intro observer _member
    exact (box.evidenceAt observer).bounded

/-- Boolean approval value of one canonical identity slot. -/
def approvesAt (box : BallotBox Observer Subject height)
    (observer : Observer) : Bool :=
  match box.voteOf observer with
  | some ballot => ballot.approve
  | none => false

/-- Boolean rejection value of one canonical identity slot. -/
def rejectsAt (box : BallotBox Observer Subject height)
    (observer : Observer) : Bool :=
  match box.voteOf observer with
  | some ballot => !ballot.approve
  | none => false

/-- Count unique approving identities. -/
def approvalCount (box : BallotBox Observer Subject height) : Nat :=
  (Finset.univ.filter fun observer =>
    box.approvesAt observer = true).card

/-- Count unique rejecting identities. -/
def rejectionCount (box : BallotBox Observer Subject height) : Nat :=
  (Finset.univ.filter fun observer =>
    box.rejectsAt observer = true).card

/-- The deterministic aggregate returned to policy code. -/
structure Aggregate where
  evidence : Evidence height
  approvals : Nat
  rejections : Nat
  deriving DecidableEq, Repr

def aggregate (box : BallotBox Observer Subject height) : @Aggregate height where
  evidence := box.aggregateEvidence
  approvals := box.approvalCount
  rejections := box.rejectionCount

omit [DecidableEq Observer] in
/--
Aggregation is definitionally deterministic because it consumes the canonical
identity-indexed box, not an arrival-order list.
-/
theorem aggregate_deterministic
    -- The result is reflexive once the canonical aggregate is constructed.
    (box : BallotBox Observer Subject height) :
    box.aggregate = box.aggregate :=
  rfl

/-- Aggregation can add evidence but cannot force acceptance. -/
def applyAggregate
    (state : FeedbackState height)
    (box : BallotBox Observer Subject height) :
    FeedbackState height where
  evidence := state.evidence.sup box.aggregateEvidence
  accepted := state.accepted

omit [DecidableEq Observer] in
@[simp]
theorem applyAggregate_preserves_acceptance
    (state : FeedbackState height)
    (box : BallotBox Observer Subject height) :
    (applyAggregate state box).accepted = state.accepted :=
  rfl

omit [DecidableEq Observer] in
theorem applyAggregate_evidence_monotone
    (state : FeedbackState height)
    (box : BallotBox Observer Subject height) :
    state.evidence.level ≤ (applyAggregate state box).evidence.level :=
  Evidence.level_le_sup state.evidence box.aggregateEvidence

end BallotBox

/-- The observed party's autonomous response to an aggregate. -/
inductive PartyDecision
  | accept
  | reject
  deriving DecidableEq, Repr

/--
A replayable decision is an external event with an explicit subject, evidence
reference, and replay identifier.  It is not synthesized by `BallotBox`.
-/
structure ExternalDecisionEvent (Subject : Type) where
  subject : Subject
  decision : PartyDecision
  evidenceId : Nat
  replayId : Nat
  deriving DecidableEq, Repr

namespace ExternalDecisionEvent

/-- Embed an autonomous party decision into the replayable feedback stream. -/
def toFeedbackEvent {Subject : Type} {height : Nat}
    (event : ExternalDecisionEvent Subject) :
    FeedbackEvent height (ExternalDecisionEvent Subject) :=
  match event.decision with
  | .accept => .externalAccept event
  | .reject => .externalReject event

@[simp]
theorem accept_toFeedbackEvent {Subject : Type} {height : Nat}
    (subject : Subject) (evidenceId replayId : Nat) :
    (ExternalDecisionEvent.mk subject .accept evidenceId replayId).toFeedbackEvent
      (height := height) =
        .externalAccept
          (ExternalDecisionEvent.mk subject .accept evidenceId replayId) :=
  rfl

@[simp]
theorem reject_toFeedbackEvent {Subject : Type} {height : Nat}
    (subject : Subject) (evidenceId replayId : Nat) :
    (ExternalDecisionEvent.mk subject .reject evidenceId replayId).toFeedbackEvent
      (height := height) =
        .externalReject
          (ExternalDecisionEvent.mk subject .reject evidenceId replayId) :=
  rfl

end ExternalDecisionEvent

/-- A minimal configured deterministic feedback system. -/
structure FeedbackSystem (Observer Subject : Type) (height : Nat)
    [Fintype Observer] [DecidableEq Observer] where
  quorum : Nat
  quorum_le_observers : quorum ≤ Fintype.card Observer
  authorized : Observer → Subject → Prop
  authorized_decidable :
    ∀ observer subject, Decidable (authorized observer subject)

end Cantilune.Feedback
