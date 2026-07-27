import Cantilune.Feedback.EventTrajectoryMeasure
import Cantilune.Tests.EventTrajectory

/-!
# Event-path probability regression

The Boolean execution package carries a genuine probability measure on
replayable `DPOEvent` trajectories.  Forgetting the selected event at every
time recovers the original Ionescu--Tulcea state law exactly, and the
almost-sure hitting theorem holds directly on the event-path sample space.
-/

namespace Cantilune.Tests.EventTrajectoryMeasure

open MeasureTheory
open Cantilune.Feedback.EventTrajectory.FiniteDiscrete
open Cantilune.Tests.EventTrajectory

noncomputable section

local instance : MeasurableSpace Bool := ⊤

example :
    (replayableEventTrajectoryMeasure totalLabelling initial).map
        ReplayableEventPath.stateCode =
      stateKernel.toMarkovExecutionKernel.trajectoryMeasure
        initial.toMeasure :=
  map_stateCode_replayableEventTrajectoryMeasure totalLabelling initial

example :
    ∀ᵐ path ∂replayableEventTrajectoryMeasure
        eventProgress.labelling initial,
      eventProgress.progress.toKernelProgressAssumption.hittingBridge
        |>.EventuallyHits path.stateCode :=
  replayable_event_measure_almost_sure_hitting eventProgress

example :
    ∀ᵐ path ∂replayableEventTrajectoryMeasure
        eventProgress.labelling initial,
      Nonempty (CompleteCommonTrajectory eventProgress path) ∧
        (eventProgress.progress.toKernelProgressAssumption.hittingBridge
          |>.EventuallyHits path.stateCode) :=
  complete_common_trajectory_almost_sure eventProgress

end

end Cantilune.Tests.EventTrajectoryMeasure
