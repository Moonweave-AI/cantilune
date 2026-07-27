import Cantilune.Feedback.FiniteHeterogeneousFourProjection

/-!
# Regression checks for the heterogeneous event-level four-projection bridge
-/

namespace Cantilune.Tests.FiniteHeterogeneousFourProjection

open Cantilune.Core
open Cantilune.Theorems
open Cantilune.Feedback.FiniteHeterogeneousFourProjection
open Cantilune.Feedback.HeterogeneousAdmissionTrajectory

/-- Identity four-view bundle used to instantiate the heterogeneous bridge. -/
def identityFourProjection (lts : ObservableLTS) :
    FourProjectionCertificate lts where
  dagLTS := lts
  petriLTS := lts
  piLTS := lts
  morphismLTS := lts
  dag := ProjectionCertificate.identity lts
  petri := ProjectionCertificate.identity lts
  pi := ProjectionCertificate.identity lts
  morphism := ProjectionCertificate.identity lts

/-- A concrete two-epoch assignment crossing the reference admission. -/
def referenceAssignment :
    ChainFourProjectionAssignment Reference.epochChain :=
  .cons
    (identityFourProjection Reference.oldPackage.lts)
    (.single (identityFourProjection Reference.newPackage.lts))

#check ChainFourProjectionAssignment
#check SourceFamilyAlignment
#check ReindexableExecutionFamily.pure_reindex_ne_admission_target
#check pure_reindex_ne_replayed_admission_target
#check ChainFourProjectionAssignment.ofFamilies
#check FourNativeDerivations.of_step
#check ProjectedChainStep.of_step_replay
#check CompleteProjectedSampledEdge.of_sampled
#check CompleteProjectedSampledEdge.eventReplay
#check CompleteProjectedSampledEdge.executionEpochAligned
#check CompleteProjectedSampledEdge.mark_unique
#check CompleteProjectedSampledEdge.witnesses_mark_eq
#check four_projection_common_trajectory_almost_sure
#check four_projection_family_common_trajectory_almost_sure
#check
  four_projection_common_trajectory_almost_sure
    Reference.epochChain referenceAssignment

end Cantilune.Tests.FiniteHeterogeneousFourProjection
