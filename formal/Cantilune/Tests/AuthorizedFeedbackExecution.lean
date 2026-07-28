import Cantilune.Feedback.AuthorizedFeedbackExecution

/-! Regression checks for the shared authorized-feedback execution package. -/

namespace Cantilune.Tests.AuthorizedFeedbackExecution

open Cantilune.Core
open Cantilune.Feedback.AuthorizedFeedbackExecution

variable {σ : FinSignature}

example :
    (package σ).lts.ObservableStep
      .empty .recordApproval .approval :=
  Event.native .recordApproval

example :
    (package σ).lts.ObservableStep
      .approval .recordRejection .conflict :=
  Event.native .recordRejection

example :
    ((package σ).eventRecord .recordApproval).Replays
      (configOf σ .empty) (configOf σ .approval) :=
  (complete_reference_edge σ .recordApproval).2.1

example :
    ((package σ).eventRecord .partyReject).Replays
      (configOf σ .conflict) (configOf σ .rejected) :=
  (complete_reference_edge σ .partyReject).2.1

example : system.quorumStatus approvalBox.box = .approval := by
  native_decide

example : system.quorumStatus conflictBox.box = .conflict := by
  native_decide

#check approval_record_idempotent
#check authorized_updates_commute
#check accepted_trace_externally_productive
#check rejected_trace_externally_productive

end Cantilune.Tests.AuthorizedFeedbackExecution
