import Cantilune.Feedback.AuthorizedVoting

namespace Cantilune.Tests.AuthorizedVoting

open Cantilune.Feedback

def system : FeedbackSystem Bool Bool 2 where
  quorum := 1
  quorum_le_observers := by native_decide
  authorized := fun _ _ => True
  authorized_decidable := by
    intro observer subject
    infer_instance

def approval : Ballot 2 where
  evidence := ⟨1, by omega⟩
  approve := true
  evidenceId := 7

def recorded : AuthorizedBallotBox system :=
  (AuthorizedBallotBox.empty system false).record false approval trivial

def quorumEvent : AuthorizedQuorumEvent system where
  ballots := recorded
  hasQuorum := Or.inl (by native_decide)

example : recorded.box.voteOf false = some approval :=
  AuthorizedBallotBox.record_same
    (AuthorizedBallotBox.empty system false) false approval trivial

example : system.authorized false recorded.box.subject :=
  recorded.authorized_of_stored rfl

example : system.quorumStatus recorded.box = .approval := by
  native_decide

example :
    (BallotBox.applyAggregate
      (FeedbackState.mk ⟨0, by omega⟩ false)
      recorded.box).accepted = false :=
  system.aggregate_after_quorum_preserves_acceptance
    (FeedbackState.mk ⟨0, by omega⟩ false) recorded

example :
    applyEvent
        (FeedbackState.mk ⟨0, by omega⟩ false)
        (quorumEvent.toFeedbackEvent Unit) =
      BallotBox.applyAggregate
        (FeedbackState.mk ⟨0, by omega⟩ false) recorded.box :=
  quorumEvent.apply_toFeedbackEvent
    (FeedbackState.mk ⟨0, by omega⟩ false) Unit

#check AuthorizedBallotBox.record_idempotent
#check AuthorizedBallotBox.record_commute
#check FeedbackSystem.quorumStatus_eq_conflict_iff
#check AuthorizedQuorumEvent.preserves_acceptance

end Cantilune.Tests.AuthorizedVoting
