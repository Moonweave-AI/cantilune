import Cantilune.Feedback.AuthorizedFeedbackProbability

/-!
Regression checks for kernel-derived, positively labelled feedback paths.
-/

namespace Cantilune.Tests.AuthorizedFeedbackProbability

open Cantilune.Core
open Cantilune.Feedback.EventTrajectory.FiniteDiscrete
open Cantilune.Feedback.AuthorizedFeedbackExecution
open Cantilune.Feedback.AuthorizedFeedbackProbability

variable {σ : FinSignature}

example :
    (package σ).lts.ObservableStep
        .empty .recordApproval .approval ∧
      (package σ).lts.ObservableStep
        .approval .recordRejection .conflict :=
  ⟨(two_native_progress_steps σ).1,
    (two_native_progress_steps σ).2.1⟩

example :
    (twoPhaseProgress σ).expectedKernelEpochCount ≤ 2 :=
  expected_kernel_epochs_le_two σ

example (path : PositiveStatePath (kernel σ))
    (startsEmpty : path.state 0 = .empty) :
    path.state 2 = .conflict :=
  positive_path_reaches_conflict_in_two σ path startsEmpty

#check complete_positive_common_trajectory_almost_surely

end Cantilune.Tests.AuthorizedFeedbackProbability
