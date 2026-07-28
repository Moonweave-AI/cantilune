import Cantilune.Core.Execution
import Cantilune.Pi.Late

/-!
# Standard late-π modulo structural congruence

`Late.Step` was defined as the structural closure of the native strong-late
rules. This module proves the missing representative-independence `iff`,
forms the quotient transition relation, and packages the raw presentation as
an actual `ObservableLTS` whose selected state setoid is standard structural
congruence.
-/

namespace Cantilune.Pi.Late

open Cantilune.Core

/--
A structurally closed late step is invariant under changing both source and
target representatives.
-/
theorem step_congr_iff
    (sourceCongruence : Struct source source')
    (targetCongruence : Struct target target') :
    Step source action target ↔ Step source' action target' := by
  constructor
  · intro step
    exact Step.structural_closure
      (Struct.symm sourceCongruence) step targetCongruence
  · intro step
    exact Step.structural_closure
      sourceCongruence step (Struct.symm targetCongruence)

/-- Processes modulo α/structural congruence. -/
abbrev StructuralProcess := Quotient Struct.setoid

/--
The standard late transition relation on structural-congruence classes.
Well-definedness is discharged by `step_congr_iff`, not assumed.
-/
def StructuralStep
    (source : StructuralProcess) (action : Raw.Action)
    (target : StructuralProcess) : Prop :=
  Quotient.liftOn₂ source target
    (fun source target => Step source action target)
    (fun _ _ _ _ sourceCongruence targetCongruence =>
      propext (step_congr_iff sourceCongruence targetCongruence))

@[simp]
theorem structuralStep_mk_iff
    (source target : Raw.Proc) (action : Raw.Action) :
    StructuralStep
        (Quotient.mk Struct.setoid source) action
        (Quotient.mk Struct.setoid target) ↔
      Step source action target :=
  Iff.rfl

/--
Success modulo structural congruence. This treats exactly the class of `0` as
successful and is therefore representative-independent.
-/
def StructurallyZero (process : Raw.Proc) : Prop :=
  Struct process .zero

theorem structurallyZero_congr
    (congruence : Struct process process') :
    StructurallyZero process ↔ StructurallyZero process' := by
  constructor
  · intro zero
    exact Struct.trans (Struct.symm congruence) zero
  · intro zero
    exact Struct.trans congruence zero

/--
Raw standard late-π as an observable LTS with the intended structural setoid.
All native labels remain observable; no `τ*` weakening or event filtering is
introduced. The waiting predicate is intentionally false here because this
operational LTS exposes input labels rather than classifying them as normal
external-wait states.
-/
def structuralLateLTS : ObservableLTS where
  State := Raw.Proc
  Event := Raw.Action
  stateSetoid := Struct.setoid
  step := Step
  observable := fun _ => True
  success := StructurallyZero
  waiting := fun _ => False
  signatureVersion := fun _ => 0
  step_congr := step_congr_iff
  success_congr := structurallyZero_congr
  waiting_congr := by
    intro source target congruence
    rfl
  signatureVersion_congr := by
    intro source target congruence
    rfl

/--
The central representative-independence theorem now has a substantive
standard late-π instance rather than only equality-setoid fixtures.
-/
theorem observable_rewrite_respects_struct
    (sourceCongruence : Struct source source')
    (targetCongruence : Struct target target') :
    structuralLateLTS.ObservableStep source action target ↔
      structuralLateLTS.ObservableStep source' action target' :=
  ObservableLTS.rewrite_respects_equiv structuralLateLTS
    sourceCongruence targetCongruence

end Cantilune.Pi.Late
