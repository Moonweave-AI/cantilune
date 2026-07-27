import Cantilune.Pi.FMSCpoConcreteBilimitExhaustivity

/-! Kernel regression checks for the unconditional concrete EP bilimit. -/

namespace Cantilune.Tests.FMSCpoConcreteBilimitExhaustivity

open Cantilune.Pi.FMSCpoEmbeddingProjectionBilimit

example : ConcreteBilimitExhaustivity :=
  concreteBilimitExhaustivity

#print axioms concreteStageMap_target_projection
#print axioms concreteStageMap_diagonal
#print axioms concreteStageMap_source_embedding
#print axioms concreteIterationLimitEmbedding_projection_stageMap
#print axioms concreteLimitApproximation_monotone
#print axioms concreteLimitApproximation_exhaustive
#print axioms concreteUnfoldApproximation_monotone
#print axioms concreteBilimitExhaustivity
#print axioms concreteActualFixedPointWitness

end Cantilune.Tests.FMSCpoConcreteBilimitExhaustivity
