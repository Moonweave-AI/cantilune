import Cantilune.Pi.LateStructuralQuotient

/-!
# Regression checks for late-π structural quotienting
-/

namespace Cantilune.Tests.LateStructuralQuotient

open Cantilune.Pi
open Cantilune.Pi.Late

example {source source' target target' : Raw.Proc}
    {action : Raw.Action}
    (sourceCongruence : Struct source source')
    (targetCongruence : Struct target target') :
    Step source action target ↔ Step source' action target' :=
  step_congr_iff sourceCongruence targetCongruence

example (channel value : Name) :
    StructuralStep
        (Quotient.mk Struct.setoid
          (.send channel value .zero))
        (.output channel value)
        (Quotient.mk Struct.setoid .zero) :=
  structuralStep_mk_iff _ _ _ |>.mpr
    (Step.native NativeStep.prefixOutput)

example {source source' target target' : Raw.Proc}
    {action : Raw.Action}
    (sourceCongruence : Struct source source')
    (targetCongruence : Struct target target') :
    structuralLateLTS.ObservableStep source action target ↔
      structuralLateLTS.ObservableStep source' action target' :=
  observable_rewrite_respects_struct
    sourceCongruence targetCongruence

end Cantilune.Tests.LateStructuralQuotient
