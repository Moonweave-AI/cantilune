import Cantilune.Feedback.FiniteHeterogeneousRandomKernel

/-!
# Caller-supplied finite heterogeneous kernel regressions
-/

namespace Cantilune.Tests.FiniteHeterogeneousRandomKernel

open MeasureTheory
open Cantilune.Core
open Cantilune.Core.ExecutionEpochTrace
open Cantilune.Feedback.FiniteHeterogeneousProbability
open Cantilune.Feedback.FiniteHeterogeneousRandomKernel

#check advance_terminal
#check AlmostSureSuccessorPhaseKernel
#check AlmostSureSuccessorPhaseKernel.successor_probability_one
#check AlmostSureSuccessorPhaseKernel.step_ae_eq_advance
#check AlmostSureSuccessorPhaseKernel.trajectory_ae_follows_advance
#check AlmostSureSuccessorPhaseKernel.trajectory_ae_eq_phaseAt
#check AlmostSureSuccessorPhaseKernel.common_trajectory_almost_sure

variable {universes : ProjectionUniverses}
variable {first last : SomeReplayEpoch}
variable {chain : EpochChain universes first last}

example (kernel : AlmostSureSuccessorPhaseKernel chain) :
    ∀ᵐ path ∂kernel.semantics.trajectoryMeasure (initial chain),
      CompleteFiniteChainTrajectory chain path :=
  kernel.common_trajectory_almost_sure

end Cantilune.Tests.FiniteHeterogeneousRandomKernel
