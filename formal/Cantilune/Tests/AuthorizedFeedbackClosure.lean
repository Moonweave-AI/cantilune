import Cantilune.Feedback.AuthorizedFeedbackClosure

/-! Regression checks for the combined authorized-feedback reference. -/

namespace Cantilune.Tests.AuthorizedFeedbackClosure

open Cantilune.Core
open Cantilune.Feedback
open Cantilune.Feedback.EventTrajectory.FiniteDiscrete
open Cantilune.Feedback.AuthorizedFeedbackExecution
open Cantilune.Feedback.AuthorizedFeedbackProbability
open Cantilune.Feedback.AuthorizedFeedbackClosure

variable {σ : FinSignature}

example :
    (stateMap .conflict).evidence.HardStable :=
  (referenceClosure σ).conflict_hard_stable

example :
    (stateMap .conflict).evidence.StableRegion 2 :=
  (referenceClosure σ).conflict_stable_region

example (events : List (FeedbackEvent 2 ReferencePayload)) :
    (applyEvents (stateMap .conflict) events).evidence.StableRegion 2 :=
  (referenceClosure σ).stable_under_finite_replay events

example :
    (twoPhaseProgress σ).expectedKernelEpochCount ≤ 2 :=
  (referenceClosure σ).expected_kernel_epochs

example (path : PositiveStatePath (kernel σ))
    (startsEmpty : path.state 0 = .empty) :
    path.state 2 = .conflict :=
  (referenceClosure σ).positive_path_conflict_in_two path startsEmpty

example (event : Event) :
    lts.ObservableStep event.source event event.target ∧
      ((package σ).eventRecord event).Replays
        ((package σ).configOf event.source)
        ((package σ).configOf event.target) ∧
      stateMap event.target =
        applyEvent (stateMap event.source) (eventMap event) :=
  (referenceClosure σ).every_reference_edge event

#check ReferenceClosure.aggregate_autonomy
#check ReferenceClosure.positive_common_trajectory
#check ReferenceClosure.no_internal_oscillation
#check ReferenceClosure.accepted_trace_productive
#check ReferenceClosure.rejected_trace_productive
#check referenceClosure_nonempty

end Cantilune.Tests.AuthorizedFeedbackClosure
