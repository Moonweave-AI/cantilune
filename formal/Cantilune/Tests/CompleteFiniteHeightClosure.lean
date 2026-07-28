import Cantilune.Feedback.CompleteFiniteHeightClosure

/-!
# Regression checks for the complete finite-height feedback closure
-/

namespace Cantilune.Tests.CompleteFiniteHeightClosure

open Cantilune.Core
open Cantilune.Feedback
open Cantilune.Feedback.CompleteFiniteHeightClosure
open Cantilune.Feedback.CompleteFiniteHeightClosure.AuthorizedReference

def signature : FinSignature where
  Obj := PUnit
  Gen := Empty
  objFintype := inferInstance
  genFintype := inferInstance
  objDecidableEq := inferInstance
  genDecidableEq := inferInstance
  input := Empty.elim
  output := Empty.elim
  mode := fun _ => .linear
  contract := Empty.elim

local instance : MeasurableSpace ReferenceState := ⊤

example : Nonempty (Witness signature) :=
  witness_nonempty signature

example :
    (closure signature).progress.expectedKernelEpochCount ≤ 2 :=
  (witness signature).expected_epochs

example :
    ∀ index : Fin (closure signature).evidenceOrder.height,
      (closure signature).PhaseCompleteTrajectory index :=
  (witness signature).complete_trajectory

example :
    (closure signature).PhaseCompleteTrajectory
      (closure signature).hittingPhase :=
  (closure signature).feedback_almost_sure_hitting_with_replay
    (closure signature).hittingPhase

example
    (trace : InfiniteExecution (closure signature).package.lts)
    (allInternal :
      ∀ n, (closure signature).package.ranking.internal (trace.event n)) :
    False :=
  (closure signature).no_internal_oscillation trace allInternal

example :
    (closure signature).stableRegion.holds
      (RankedJoinEvidence.accumulate
        (stateEvidence .conflict) ([] : List ReferenceEvidence)) :=
  (witness signature).hard_stable

#print axioms
  FiniteHeightFeedbackClosure.hard_forward_invariant
#print axioms
  FiniteHeightFeedbackClosure.no_internal_oscillation
#print axioms
  FiniteHeightFeedbackClosure.expected_epoch_count_le
#print axioms
  FiniteHeightFeedbackClosure.feedback_almost_sure_hitting_with_replay
#print axioms witness_nonempty

end Cantilune.Tests.CompleteFiniteHeightClosure
