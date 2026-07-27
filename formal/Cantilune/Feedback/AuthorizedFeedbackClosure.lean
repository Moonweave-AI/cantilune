import Cantilune.Feedback.AuthorizedFeedbackProbability

/-!
# Closed authorized-feedback reference package

This module bundles the deterministic authorized execution and its generated
finite Markov kernel.  Every field refers to the same execution package and
the same kernel; the proofs are the already checked component results.
-/

noncomputable section

namespace Cantilune.Feedback.AuthorizedFeedbackClosure

open MeasureTheory
open Cantilune.Core
open Cantilune.Feedback
open Cantilune.Feedback.Probability
open Cantilune.Feedback.StochasticExecution.FiniteDiscrete
open Cantilune.Feedback.EventTrajectory
open Cantilune.Feedback.EventTrajectory.FiniteDiscrete
open Cantilune.Feedback.AuthorizedFeedbackExecution
open Cantilune.Feedback.AuthorizedFeedbackProbability

local instance : MeasurableSpace State := ⊤

abbrev ReferencePayload := ExternalDecisionEvent Subject

/--
A single nonempty reference closure joining hard stability, exact execution
replay, external autonomy, generated probabilistic progress, and productive
post-decision traces.
-/
structure ReferenceClosure (σ : FinSignature) where
  sharedPackage : ExecutionPackage σ
  package_exact : sharedPackage = package σ
  sharedKernel : NativeMarkovKernel σ sharedPackage State
  kernel_exact : HEq sharedKernel (kernel σ)
  bridge_package_exact : (bridge σ).package = package σ
  conflict_hard_stable :
    (stateMap .conflict).evidence.HardStable
  conflict_stable_region :
    (stateMap .conflict).evidence.StableRegion 2
  stable_under_finite_replay :
    ∀ events : List (FeedbackEvent 2 ReferencePayload),
      (applyEvents (stateMap .conflict) events).evidence.StableRegion 2
  aggregate_autonomy :
    (BallotBox.applyAggregate (stateMap .approval) conflictBox.box).accepted =
      (stateMap .approval).accepted
  expected_kernel_epochs :
    (twoPhaseProgress σ).expectedKernelEpochCount ≤ 2
  positive_common_trajectory :
    ∀ᵐ rawPath ∂
        (kernel σ).toMarkovExecutionKernel.trajectoryMeasure
          (initialAt .empty).toMeasure,
      ∃ path : PositiveStatePath (kernel σ),
        path.state = rawPath ∧
          Nonempty ((positiveLabelling σ).TrajectoryAgreement path) ∧
          Nonempty
            (EpochAlignedTrajectory window
              ((positiveLabelling σ).decorate path))
  positive_path_conflict_in_two :
    ∀ path : PositiveStatePath (kernel σ),
      path.state 0 = .empty →
        path.state 2 = .conflict
  no_internal_oscillation :
    ∀ trace : InfiniteExecution (package σ).lts,
      (∀ n, (package σ).ranking.internal (trace.event n)) →
        False
  accepted_trace_productive :
    ExternallyProductive
      (package σ).ranking acceptedInfiniteExecution
  rejected_trace_productive :
    ExternallyProductive
      (package σ).ranking rejectedInfiniteExecution
  every_reference_edge :
    ∀ event : Event,
      lts.ObservableStep event.source event event.target ∧
        ((package σ).eventRecord event).Replays
          ((package σ).configOf event.source)
          ((package σ).configOf event.target) ∧
        stateMap event.target =
          applyEvent (stateMap event.source) (eventMap event)

/-- The concrete reference package inhabits every field of the closure. -/
def referenceClosure (σ : FinSignature) : ReferenceClosure σ where
  sharedPackage := package σ
  package_exact := rfl
  sharedKernel := kernel σ
  kernel_exact := by rfl
  bridge_package_exact := rfl
  conflict_hard_stable := by rfl
  conflict_stable_region := by
    norm_num [stateMap, Evidence.StableRegion]
  stable_under_finite_replay := by
    intro events
    exact feedback_state_stable_set
      (stateMap .conflict) events (by
        norm_num [stateMap, Evidence.StableRegion])
  aggregate_autonomy := conflict_aggregate_preserves_autonomy
  expected_kernel_epochs := expected_kernel_epochs_le_two σ
  positive_common_trajectory :=
    complete_positive_common_trajectory_almost_surely σ
  positive_path_conflict_in_two :=
    positive_path_reaches_conflict_in_two σ
  no_internal_oscillation := by
    intro trace allInternal
    exact
      Cantilune.Feedback.no_infinite_internal_oscillation
        (package σ).ranking trace allInternal
  accepted_trace_productive :=
    accepted_trace_externally_productive σ
  rejected_trace_productive :=
    rejected_trace_externally_productive σ
  every_reference_edge := complete_reference_edge σ

/-- The combined reference closure has a concrete inhabitant. -/
theorem referenceClosure_nonempty (σ : FinSignature) :
    Nonempty (ReferenceClosure σ) :=
  ⟨referenceClosure σ⟩

end Cantilune.Feedback.AuthorizedFeedbackClosure
