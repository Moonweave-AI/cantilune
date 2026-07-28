import Cantilune.Pi.OpenSMCActionAlpha

/-!
# Action-level alpha regression

These examples exercise fresh input and bound-output renaming through real
native parallel/open derivations.  They intentionally use no weak closure.
-/

namespace Cantilune.Tests.OpenSMCActionAlpha

open Cantilune.Pi
open Cantilune.Pi.OpenSMCActionAlpha

#check ActionAlpha.setoid
#check AlphaAction
#check DerivativeAlpha.setoid
#check AlphaDerivative
#check ActionAlpha.iff_orbit_eq_and_boundOutputAdmissible
#check alphaAction_boundOutput_eq_iff
#check alphaRenameInput_compatible
#check alphaRenameBoundOutput_compatible

theorem invalid_open_label_is_not_alpha :
    ¬ ActionAlpha
      (.boundOutput 0 0)
      (.boundOutput 0 1) :=
  ActionAlpha.invalid_boundOutput_not_alpha_fresh
    0 1 (by decide)

theorem arbitrary_admissible_bound_outputs_are_same_class :
    (Quotient.mk ActionAlpha.setoid
        (.boundOutput 0 1) : AlphaAction) =
      Quotient.mk ActionAlpha.setoid
        (.boundOutput 0 37) := by
  exact
    (alphaAction_boundOutput_eq_iff 0 1 0 37).2
      ⟨rfl, by decide⟩

theorem invalid_self_bound_output_is_a_separate_class :
    (Quotient.mk ActionAlpha.setoid
        (.boundOutput 0 0) : AlphaAction) ≠
      Quotient.mk ActionAlpha.setoid
        (.boundOutput 0 37) := by
  intro equality
  have criterion :=
    (alphaAction_boundOutput_eq_iff 0 0 0 37).1 equality
  exact (criterion.2.mpr (by decide)) rfl

theorem bound_output_subject_is_observable :
    (Quotient.mk ActionAlpha.setoid
        (.boundOutput 0 1) : AlphaAction) ≠
      Quotient.mk ActionAlpha.setoid
        (.boundOutput 2 1) := by
  intro equality
  exact (by decide : (0 : Name) ≠ 2)
    ((alphaAction_boundOutput_eq_iff 0 1 2 1).1 equality).1

def inputSource : Raw.Proc :=
  .par (.recv 0 1 .zero) .zero

def inputTarget : Raw.Proc :=
  .par .zero .zero

theorem input_native :
    Late.NativeStep inputSource (.input 0 1) inputTarget := by
  exact Late.NativeStep.parLeft
    (by simp [Raw.Action.boundNames, Raw.Proc.freeNames])
    Late.NativeStep.prefixInput

theorem input_alpha_compatible :
    ∃ renamedSource renamedTarget,
      Late.Alpha inputSource renamedSource ∧
      Late.NativeStep renamedSource (.input 0 2) renamedTarget ∧
      DerivativeAlpha
        ⟨.input 0 1, inputTarget⟩
        ⟨.input 0 2, renamedTarget⟩ :=
  alphaRenameInput_compatible input_native
    (by simp [inputSource, Raw.Proc.allNames])
    (by simp [inputTarget, Raw.Proc.allNames])

def openSource : Raw.Proc :=
  .par (.new 1 (.send 0 1 .zero)) .zero

def openTarget : Raw.Proc :=
  .par .zero .zero

theorem open_native :
    Late.NativeStep openSource (.boundOutput 0 1) openTarget := by
  exact Late.NativeStep.parLeft
    (by simp [Raw.Action.boundNames, Raw.Proc.freeNames])
    (Late.NativeStep.open (by decide)
      Late.NativeStep.prefixOutput)

theorem boundOutput_alpha_compatible :
    ∃ renamedSource renamedTarget,
      Late.Alpha openSource renamedSource ∧
      Late.NativeStep renamedSource
        (.boundOutput 0 2) renamedTarget ∧
      DerivativeAlpha
        ⟨.boundOutput 0 1, openTarget⟩
        ⟨.boundOutput 0 2, renamedTarget⟩ :=
  alphaRenameBoundOutput_compatible open_native
    (by simp [openSource, Raw.Proc.allNames])
    (by simp [openTarget, Raw.Proc.allNames])

end Cantilune.Tests.OpenSMCActionAlpha
