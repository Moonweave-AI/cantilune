import Mathlib
import Cantilune.Pi.P1cLateBridge

/-!
# P1c rule-matrix regressions

These checks pin the finite key space, the complete native π column, the
remaining three-column obligations, and duplicate-key rejection.
-/

namespace Cantilune.Tests.P1cMatrix

open Cantilune.Pi.P1cMatrix

example : Fintype.card SourceEvent = 15 := by
  native_decide

example : Fintype.card Projection = 4 := by
  native_decide

/-- Every event/projection pair occurs once in the finite key set. -/
example : allKeys.card = 60 := by
  native_decide

example : allKeys.toList.Nodup :=
  all_keys_unique

example (sourceEvent : SourceEvent) (projection : Projection) :
    (sourceEvent, projection) ∈ allKeys :=
  all_keys_covered sourceEvent projection

/-- Re-inserting an existing key is detected as a duplicate. -/
example :
    ¬((.freeOutput, .dag) :: allKeys.toList).Nodup := by
  simp [allKeys]

/-- All fifteen π cells now carry direct strong derivations. -/
example : nativeCellCount = 15 :=
  pi_native_cell_count

/-- The other forty-five cells remain explicit typed obligations. -/
example : partialCellCount = 45 :=
  partial_cell_count_after_pi_extension

/-- Exhaustive status check over all fifteen π-column events. -/
example (sourceEvent : SourceEvent) :
    (referenceMatrix.cell sourceEvent .pi).isNative = true := by
  cases sourceEvent <;> native_decide

/-- No unavailable non-π column is accidentally marked native. -/
example (sourceEvent : SourceEvent) (projection : Projection)
    (notPi : projection ≠ .pi) :
    (referenceMatrix.cell sourceEvent projection).isNative = false :=
  non_pi_cell_not_native sourceEvent projection notPi

/-- A concrete direct native output cell is logically complete. -/
example :
    (referenceMatrix.cell .freeOutput .pi).Complete := by
  trivial

example :
    (referenceMatrix.cell .mismatchGuard .pi).Complete :=
  pi_column_complete .mismatchGuard

example :
    (referenceMatrix.cell .instanceReconnect .pi).Complete :=
  pi_column_complete .instanceReconnect

example :
    (referenceMatrix.cell .instanceDeleteQuiescent .pi).Complete :=
  pi_column_complete .instanceDeleteQuiescent

/-- Each amended pi cell also has an independently defined standard late step. -/
example (event : SourceEvent) :
    ∃ process action target,
      Cantilune.Pi.Step process action target ∧
        PiAdequate event process action target ∧
        Cantilune.Pi.Late.Step
          process.erase action.erase target.erase :=
  piCell_erases_to_standard_late event

/-- Nominal freshness is part of legal typed-step membership, not a later premise. -/
example {event : SourceEvent} {process target : Cantilune.Pi.Proc}
    {action : Cantilune.Pi.Action}
    (adequate : PiAdequate event process action target) :
    Cantilune.Pi.Step.StandardNativeStep process action target :=
  piAdequate_standard_typed adequate

example {event : SourceEvent} {process target : Cantilune.Pi.Proc}
    {action : Cantilune.Pi.Action}
    (adequate : PiAdequate event process action target) :
    Cantilune.Pi.Late.NativeStep
      process.erase action.erase target.erase :=
  piAdequate_standard_typed_erases_native adequate

/-- One pending non-π cell prevents construction of matrix completeness. -/
example :
    ¬RuleMatrix.Complete referenceMatrix :=
  referenceMatrix_not_complete

end Cantilune.Tests.P1cMatrix
