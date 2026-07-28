import Cantilune.Feedback.ExecutionEpochTrajectory
import Cantilune.Feedback.EventTrajectoryRandomized

/-!
# Runtime epochs for randomized event-labelled trajectories

The deterministic event bridge chooses one event for each state pair.
`EventTrajectoryRandomized` permits distinct event identities with the same
endpoints by sampling a seed stream.  This module adds the same exact
finite-prefix `DPOEvent` replay and runtime signature-epoch agreement to that
joint probability space.
-/

namespace Cantilune.Feedback.EventTrajectory.FiniteDiscrete

open MeasureTheory
open Cantilune.Core
open Cantilune.Feedback.StochasticExecution
open Cantilune.Feedback.StochasticExecution.FiniteDiscrete

variable {signature : FinSignature}
variable {package : ExecutionPackage signature}
variable {State : Type*} [Fintype State] [DecidableEq State]
variable {Seed : Type*}

/--
A randomized sample with native event identity, exact state marginal,
opportunity alignment, per-event replay, and runtime execution-epoch replay
for every finite prefix.
-/
structure CompleteRandomExecutionEpochTrajectory
    {kernel : NativeMarkovKernel signature package State}
    {initial : InitialDistribution State}
    {epsilon : Real}
    (bridge : RandomEventProgressBridge kernel initial epsilon Seed)
    (path : RandomizedEventPath State Seed) where
  common : CompleteRandomCommonTrajectory bridge path
  runtime : RuntimeEpochAgreement common.trajectory

/-- Construct the complete runtime-epoch package for every randomized sample. -/
def completeRandomExecutionEpochTrajectory
    {kernel : NativeMarkovKernel signature package State}
    {initial : InitialDistribution State}
    {epsilon : Real}
    (bridge : RandomEventProgressBridge kernel initial epsilon Seed)
    (path : RandomizedEventPath State Seed) :
    CompleteRandomExecutionEpochTrajectory bridge path where
  common := completeRandomCommonTrajectory bridge path
  runtime :=
    runtimeEpochAgreement
      (completeRandomCommonTrajectory bridge path).trajectory

variable [MeasurableSpace State]
variable [MeasurableSingletonClass State]
variable [MeasurableSpace Seed]

/--
Almost every joint state/seed sample reaches stability and carries the full
event-labelled, replayable, opportunity-aligned, runtime-epoch trajectory.
No deterministic choice of event identity is assumed.
-/
theorem complete_random_execution_epoch_trajectory_almost_sure
    {kernel : NativeMarkovKernel signature package State}
    {initial : InitialDistribution State}
    {epsilon : Real}
    (bridge : RandomEventProgressBridge kernel initial epsilon Seed)
    (seedMeasure : Measure (Nat → Seed))
    [IsProbabilityMeasure seedMeasure] :
    ∀ᵐ path ∂ randomizedEventTrajectoryMeasure bridge seedMeasure,
      Nonempty (CompleteRandomExecutionEpochTrajectory bridge path) ∧
        bridge.progress.toKernelProgressAssumption.hittingBridge.EventuallyHits
          path.1 := by
  filter_upwards
    [randomized_event_measure_almost_sure_hitting bridge seedMeasure]
      with path hits
  exact
    ⟨⟨completeRandomExecutionEpochTrajectory bridge path⟩, hits⟩

end Cantilune.Feedback.EventTrajectory.FiniteDiscrete
