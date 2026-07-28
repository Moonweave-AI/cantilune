import Cantilune.Pi.LateMarkedResidualFreshness

namespace Cantilune.Tests.LateMarkedResidualFreshness

open Cantilune.Pi
open Cantilune.Pi.LateMarkedIndependentExchange

theorem leftStep :
    RecursiveMarkedStep
      (.send 1 2 .zero)
      (.output 1 2)
      (.prefixOutput 1 2)
      .zero :=
  RecursiveMarkedStep.prefixOutput

theorem rightStep :
    RecursiveMarkedStep
      (.send 3 4 .zero)
      (.output 3 4)
      (.prefixOutput 3 4)
      .zero :=
  RecursiveMarkedStep.prefixOutput

theorem sourceFreshIndependent :
    SourceFreshParallelIndependent leftStep rightStep where
  effects := by
    simp [RecursiveEventIndependent, RecursiveNativeEvent.support,
      Finset.disjoint_left]
  leftSourceFresh := by
    simp [Raw.Action.boundNames]
  rightSourceFresh := by
    simp [Raw.Action.boundNames]

/--
The left occurrence binds `5`, while the right derivative retains the
pre-existing free names `4` and `8`.  Thus this is a genuinely nominal
instance of source freshness being transported to residual freshness, rather
than the vacuous empty-`boundNames` output/output case above.
-/
theorem boundInputStep :
    RecursiveMarkedStep
      (.recv 1 5 (.send 6 7 .zero))
      (.input 1 5)
      (.prefixInput 1 5)
      (.send 6 7 .zero) :=
  RecursiveMarkedStep.prefixInput

theorem retainingOutputStep :
    RecursiveMarkedStep
      (.send 2 3 (.send 4 8 .zero))
      (.output 2 3)
      (.prefixOutput 2 3)
      (.send 4 8 .zero) :=
  RecursiveMarkedStep.prefixOutput

theorem boundInputSourceFreshIndependent :
    SourceFreshParallelIndependent boundInputStep retainingOutputStep where
  effects := by
    simp [RecursiveEventIndependent, RecursiveNativeEvent.support,
      Finset.disjoint_left]
  leftSourceFresh := by
    simp [Raw.Action.boundNames, RecursiveProc.freeNames]
  rightSourceFresh := by
    simp [Raw.Action.boundNames]

example :
    ((.input 1 5 : Raw.Action).boundNames).Nonempty := by
  simp [Raw.Action.boundNames]

example :
    Disjoint
      (.input 1 5 : Raw.Action).boundNames
      (RecursiveProc.send 4 8 .zero).freeNames :=
  boundInputSourceFreshIndependent.leftResidualFresh

example :
    ParallelResidualSquare
      (.par
        (.recv 1 5 (.send 6 7 .zero))
        (.send 2 3 (.send 4 8 .zero)))
      (.prefixInput 1 5)
      (.prefixOutput 2 3)
      (.par (.send 6 7 .zero) (.send 4 8 .zero)) :=
  boundInputSourceFreshIndependent.toResidualSquare

/--
Event-support disjointness alone does not replace source freshness: the right
event below does not mention `5`, but its derivative retains `5`.
-/
theorem sourceFreshness_is_essential :
    RecursiveEventIndependent
        (.prefixInput 1 5)
        (.prefixOutput 2 3) ∧
      ¬Disjoint
        (.input 1 5 : Raw.Action).boundNames
        (RecursiveProc.send 2 3 (.send 5 8 .zero)).freeNames ∧
      ¬Disjoint
        (.input 1 5 : Raw.Action).boundNames
        (RecursiveProc.send 5 8 .zero).freeNames := by
  simp [RecursiveEventIndependent, RecursiveNativeEvent.support,
    Raw.Action.boundNames, RecursiveProc.freeNames, Finset.disjoint_left]

example :
    ParallelResidualSquare
      (.par (.send 1 2 .zero) (.send 3 4 .zero))
      (.prefixOutput 1 2)
      (.prefixOutput 3 4)
      (.par .zero .zero) :=
  sourceFreshIndependent.toResidualSquare

example :
    RecursiveMarkedTrace
        (.par (.send 1 2 .zero) (.send 3 4 .zero))
        [.parLeft (.prefixOutput 1 2), .parRight (.prefixOutput 3 4)]
        (.par .zero .zero) ∧
      RecursiveMarkedTrace
        (.par (.send 1 2 .zero) (.send 3 4 .zero))
        [.parRight (.prefixOutput 3 4), .parLeft (.prefixOutput 1 2)]
        (.par .zero .zero) :=
  sourceFreshIndependent.exact_marked_diamond

/-- Sharing the subject name is detected and cannot yield this certificate. -/
theorem sameChannel_not_independent :
    ¬ RecursiveEventIndependent
      (.prefixOutput 1 2) (.prefixInput 1 3) := by
  simp [RecursiveEventIndependent, RecursiveNativeEvent.support,
    Finset.disjoint_left]

/--
Different subjects can still be conservatively rejected when the marks share
only a payload.  Both strong marked execution orders exist because output
labels bind no names, so this demonstrates that `RecursiveEventIndependent`
is sufficient for the packaged residual theorem, not necessary for native
commutation.
-/
theorem sharedPayload_not_supportIndependent :
    ¬ RecursiveEventIndependent
      (.prefixOutput 10 99) (.prefixOutput 20 99) := by
  simp [RecursiveEventIndependent, RecursiveNativeEvent.support,
    Finset.disjoint_left]

theorem sharedPayload_leftStep :
    RecursiveMarkedStep
      (.send 10 99 .zero)
      (.output 10 99)
      (.prefixOutput 10 99)
      .zero :=
  RecursiveMarkedStep.prefixOutput

theorem sharedPayload_rightStep :
    RecursiveMarkedStep
      (.send 20 99 .zero)
      (.output 20 99)
      (.prefixOutput 20 99)
      .zero :=
  RecursiveMarkedStep.prefixOutput

theorem sharedPayload_exact_native_commutation :
    RecursiveMarkedTrace
        (.par (.send 10 99 .zero) (.send 20 99 .zero))
        [.parLeft (.prefixOutput 10 99),
          .parRight (.prefixOutput 20 99)]
        (.par .zero .zero) ∧
      RecursiveMarkedTrace
        (.par (.send 10 99 .zero) (.send 20 99 .zero))
        [.parRight (.prefixOutput 20 99),
          .parLeft (.prefixOutput 10 99)]
        (.par .zero .zero) := by
  constructor
  · exact RecursiveMarkedTrace.cons
      (RecursiveMarkedStep.parLeft
        (by simp [Raw.Action.boundNames])
        sharedPayload_leftStep)
      (RecursiveMarkedTrace.cons
        (RecursiveMarkedStep.parRight
          (by simp [Raw.Action.boundNames])
          sharedPayload_rightStep)
        (RecursiveMarkedTrace.nil _))
  · exact RecursiveMarkedTrace.cons
      (RecursiveMarkedStep.parRight
        (by simp [Raw.Action.boundNames])
        sharedPayload_rightStep)
      (RecursiveMarkedTrace.cons
        (RecursiveMarkedStep.parLeft
          (by simp [Raw.Action.boundNames])
          sharedPayload_leftStep)
        (RecursiveMarkedTrace.nil _))

#print axioms Cantilune.Pi.LateMarkedIndependentExchange.RawMarkedStep.target_freeNames_subset_source_union_support
#print axioms Cantilune.Pi.LateMarkedIndependentExchange.RecursiveNativeEvent.action_names_subset_support
#print axioms Cantilune.Pi.LateMarkedIndependentExchange.RecursiveMarkedStep.target_freeNames_subset_source_union_support
#print axioms Cantilune.Pi.LateMarkedIndependentExchange.SourceFreshParallelIndependent.toResidualSquare
#print axioms Cantilune.Pi.LateMarkedIndependentExchange.SourceFreshParallelIndependent.exact_marked_diamond

end Cantilune.Tests.LateMarkedResidualFreshness
