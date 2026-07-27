import Cantilune.Pi.P1cCompleteMatrix

/-!
# Complete P1c reference-matrix regression

All sixty event/projection cells contain a direct non-reflexive native
derivation.  The DAG and Petri targets additionally expose their structural
invariants independently of the matrix wrapper.
-/

namespace Cantilune.Tests.P1cCompleteMatrix

open Cantilune.Pi.P1cMatrix
open Cantilune.Pi.P1cCompleteMatrix

example :
    RuleMatrix.Complete completeMatrix :=
  p1c_rule_matrix_complete

example :
    Cantilune.Pi.P1cCompleteMatrix.nativeCellCount = 60 :=
  all_sixty_cells_native

example (event : SourceEvent) :
    (completeMatrix.cell event .dag).isNative = true := by
  rfl

example (event : SourceEvent) :
    (completeMatrix.cell event .petri).isNative = true := by
  rfl

example (event : SourceEvent) :
    (completeMatrix.cell event .morphism).isNative = true := by
  rfl

example (event : SourceEvent) :
    DAG.ready event ≠ DAG.completed event :=
  DAG.changes event

example :
    (DAG.completed .dynamicPartnerAdmission).version =
      (DAG.ready .dynamicPartnerAdmission).version + 1 :=
  DAG.admission_increases_version

example :
    (DAG.ready .instanceDeleteQuiescent).quiescent = true ∧
      DAG.Vertex.operation .instanceDeleteQuiescent ∈
        (DAG.ready .instanceDeleteQuiescent).nodes ∧
      DAG.Vertex.operation .instanceDeleteQuiescent ∉
        (DAG.completed .instanceDeleteQuiescent).nodes :=
  DAG.quiescent_delete_removes_operation

example (event : SourceEvent) :
    (Petri.inputToken event).identity =
      (Petri.outputToken event).identity :=
  Petri.firing_preserves_identity event

example :
    (Petri.ready .instanceDeleteQuiescent).quiescent = true ∧
      (Petri.ready .instanceDeleteQuiescent).marking = ∅ ∧
      (Petri.completed .instanceDeleteQuiescent).declared = ∅ :=
  Petri.quiescent_delete_has_empty_marking

end Cantilune.Tests.P1cCompleteMatrix
