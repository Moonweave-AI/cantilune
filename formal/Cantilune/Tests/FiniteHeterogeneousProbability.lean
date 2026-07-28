import Cantilune.Feedback.FiniteHeterogeneousProbability

/-!
# Regression checks for finite heterogeneous probability-one trajectories
-/

namespace Cantilune.Tests.FiniteHeterogeneousProbability

open MeasureTheory ProbabilityTheory
open Cantilune.Pi.AdmissionCertificate
open Cantilune.Feedback.HeterogeneousAdmissionTrajectory.Reference
open Cantilune.Feedback.FiniteHeterogeneousProbability

example :
    ∀ᵐ path ∂
        (phaseKernel epochChain).toMarkovExecutionKernel.trajectoryMeasure
          (initial epochChain),
      CompleteFiniteChainTrajectory epochChain path :=
  finite_chain_common_trajectory_almost_sure epochChain

example {path : Nat → Phase epochChain}
    (starts : path 0 = initialPhase epochChain)
    (steps :
      ∀ n, path (n + 1) = advance epochChain (path n)) :
    ∀ n, path n = phaseAt epochChain n :=
  path_eq_phaseAt epochChain path starts steps

end Cantilune.Tests.FiniteHeterogeneousProbability
