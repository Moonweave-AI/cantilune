import Cantilune.Feedback.EventTrajectoryRandomized
import Cantilune.Tests.EventTrajectory

/-!
# Randomized event-path coupling regression

The regression instantiates the seed-indexed bridge on the existing finite
execution package.  The event selector ignores this particular seed; the
generic theorem itself permits seed-dependent labels.
-/

namespace Cantilune.Tests.EventTrajectoryRandomized

open MeasureTheory
open Cantilune.Feedback.EventTrajectory.FiniteDiscrete
open Cantilune.Tests.EventTrajectory

noncomputable section

local instance : MeasurableSpace Bool := ⊤

def randomizedLabelling :
    RandomTotalNativeLabelling stateKernel Bool where
  event source target _seed :=
    totalLabelling.event source target
  native source target _seed :=
    totalLabelling.native source target

theorem randomizedAlignment :
    RandomEpochKernelAlignment randomizedLabelling progress.window where
  stable_state_version := alignment.stable_state_version
  opportunity_noninternal source target _seed :=
    alignment.opportunity_noninternal source target

def randomizedBridge :
    RandomEventProgressBridge stateKernel initial (1 / 2 : Real) Bool where
  progress := progress
  labelling := randomizedLabelling
  alignment := randomizedAlignment

def seedStream : Nat → Bool := fun _ => false

noncomputable def seedMeasure : Measure (Nat → Bool) :=
  Measure.dirac seedStream

noncomputable instance : IsProbabilityMeasure seedMeasure := by
  unfold seedMeasure
  infer_instance

example :
    (randomizedEventTrajectoryMeasure randomizedBridge seedMeasure).map
        Prod.fst =
      stateKernel.toMarkovExecutionKernel.trajectoryMeasure
        initial.toMeasure :=
  map_fst_randomizedEventTrajectoryMeasure randomizedBridge seedMeasure

example :
    ∀ᵐ path ∂randomizedEventTrajectoryMeasure randomizedBridge seedMeasure,
      Nonempty
          (CompleteRandomCommonTrajectory randomizedBridge path) ∧
        (randomizedBridge.progress.toKernelProgressAssumption.hittingBridge
          |>.EventuallyHits path.1) :=
  complete_random_common_trajectory_almost_sure
    randomizedBridge seedMeasure

end

end Cantilune.Tests.EventTrajectoryRandomized
