import Cantilune.Pi.OpenSMCAlphaTransitionQuotient

/-!
# Bound-output alpha-transition quotient regression

The example freshens a real `open` derivation nested under parallel.  Its
quotient transition is witnessed by a native step, not by weak closure.
-/

namespace Cantilune.Tests.OpenSMCAlphaTransitionQuotient

open Cantilune.Pi
open Cantilune.Pi.OpenSMCActionAlpha
open Cantilune.Pi.OpenSMCAlphaTransitionQuotient

#check AlphaProcess
#check AlphaNativeStep
#check derivativeAction
#check boundOutput_fresh_representative
#check alphaNativeStep_boundOutput_fresh

def source : Raw.Proc :=
  .par (.new 1 (.send 0 1 .zero)) .zero

def target : Raw.Proc :=
  .par .zero .zero

theorem native :
    Late.NativeStep source (.boundOutput 0 1) target := by
  exact Late.NativeStep.parLeft
    (by simp [Raw.Action.boundNames, Raw.Proc.freeNames])
    (Late.NativeStep.open (by decide)
      Late.NativeStep.prefixOutput)

theorem quotient_transition :
    AlphaNativeStep
      (Quotient.mk Late.Alpha.setoid source)
      (Quotient.mk DerivativeAlpha.setoid
        ({ action := .boundOutput 0 1, target := target } :
          LabelledDerivative)) :=
  alphaNativeStep_boundOutput_fresh native

theorem normalized_native_representative :
    ∃ renamedSource renamedTarget,
      Late.NativeStep renamedSource
        (.boundOutput 0
          (transitionFreshBinder source target 0))
        renamedTarget ∧
      (Quotient.mk Late.Alpha.setoid renamedSource : AlphaProcess) =
        Quotient.mk Late.Alpha.setoid source ∧
      (Quotient.mk DerivativeAlpha.setoid
          ({ action :=
              .boundOutput 0 (transitionFreshBinder source target 0),
             target := renamedTarget } :
            LabelledDerivative) : AlphaDerivative) =
        Quotient.mk DerivativeAlpha.setoid
          ({ action := .boundOutput 0 1, target := target } :
            LabelledDerivative) :=
  boundOutput_fresh_representative native

theorem normalized_action_is_same_class :
    let fresh := transitionFreshBinder source target 0
    (Quotient.mk ActionAlpha.setoid
        (.boundOutput 0 fresh) : AlphaAction) =
      Quotient.mk ActionAlpha.setoid (.boundOutput 0 1) :=
  normalized_boundOutput_action_eq native

end Cantilune.Tests.OpenSMCAlphaTransitionQuotient
