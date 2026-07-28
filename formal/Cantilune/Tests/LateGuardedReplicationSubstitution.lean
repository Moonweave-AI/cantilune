import Cantilune.Pi.LateGuardedReplicationSubstitution

namespace Cantilune.Tests.LateGuardedReplicationSubstitution

open Cantilune.Pi
open Cantilune.Pi.RecursiveProc

example :
    (RecursiveProc.repRecv 1 2
      (.send 2 3 .zero)).substituteCaptureAvoiding 4 4 =
      .repRecv 1 2 (.send 2 3 .zero) := by
  simp

example :
    replaceSupport ({1, 2, 3} : Finset Name) 2 7 = {1, 3, 7} := by
  native_decide

/-- The replicated-input conflict branch freshens binder `2` to `3`. -/
example :
    (RecursiveProc.repRecv 0 2
      (.send 1 2 .zero)).substituteCaptureAvoiding 1 2 =
        .repRecv 0 3 (.send 2 3 .zero) := by
  native_decide

/-- The replacement is free after freshening, rather than captured by `2`. -/
example :
    ((RecursiveProc.repRecv 0 2
      (.send 1 2 .zero)).substituteCaptureAvoiding 1 2).freeNames =
        {0, 2} := by
  native_decide

/--
Syntactic no-op is false when only the support side condition is known:
the conservative capture-risk detector alpha-freshens an unused conflicting
binder.  The exact support theorem is therefore the strongest general law.
-/
example :
    (RecursiveProc.new 2 .zero).substituteCaptureAvoiding 1 2 =
      .new 3 .zero := by
  native_decide

example :
    (RecursiveProc.new 2 .zero).substituteCaptureAvoiding 1 2 ≠
      .new 2 .zero := by
  native_decide

example :
    ((RecursiveProc.new 2 .zero).substituteCaptureAvoiding 1 2).freeNames =
      (RecursiveProc.new 2 .zero).freeNames :=
  freeNames_substituteCaptureAvoiding_eq_self_of_not_mem
    _ 1 2 (by native_decide)

/--
Unqualified syntactic composition is false: an initially free occurrence of
the intermediate name is affected by the second substitution.
-/
def compositionCounterexample : RecursiveProc :=
  .par (.send 1 9 .zero) (.send 2 9 .zero)

example :
    substituteCaptureAvoiding
        (compositionCounterexample.substituteCaptureAvoiding 1 2) 2 3 ≠
        compositionCounterexample.substituteCaptureAvoiding 1 3 := by
  native_decide

/-- With a fresh intermediate name, exact support composition holds. -/
example :
    (substituteCaptureAvoiding
      (substituteCaptureAvoiding
        (RecursiveProc.repRecv 0 4 (.send 1 4 .zero)) 1 2)
      2 3).freeNames =
      (substituteCaptureAvoiding
        (RecursiveProc.repRecv 0 4 (.send 1 4 .zero)) 1 3).freeNames := by
  apply freeNames_substituteCaptureAvoiding_compose
  native_decide

/-- The stronger syntactic composition theorem under whole-syntax freshness. -/
example :
    substituteCaptureAvoiding
        (substituteCaptureAvoiding
          (RecursiveProc.repRecv 0 4 (.send 1 4 .zero)) 1 2)
        2 3 =
      substituteCaptureAvoiding
        (RecursiveProc.repRecv 0 4 (.send 1 4 .zero)) 1 3 := by
  apply substituteCaptureAvoiding_compose_of_global_freshness
  · native_decide
  · native_decide
  · native_decide

#print axioms
  Cantilune.Pi.RecursiveProc.freeNames_substituteCaptureAvoiding
#print axioms
  Cantilune.Pi.RecursiveProc.freeNames_substituteCaptureAvoiding_compose
#print axioms
  Cantilune.Pi.RecursiveProc.substituteCaptureAvoiding_repRecv_conflict
#print axioms
  Cantilune.Pi.RecursiveProc.substituteCaptureAvoiding_compose_of_global_freshness
#print axioms
  Cantilune.Pi.RecursiveProc.substituteCaptureAvoiding_self

end Cantilune.Tests.LateGuardedReplicationSubstitution
