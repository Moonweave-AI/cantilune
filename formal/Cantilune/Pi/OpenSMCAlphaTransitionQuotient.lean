import Cantilune.Pi.OpenSMCActionAlpha

/-!
# Strong-late transitions on the action/derivative alpha quotient

`OpenSMCActionAlpha` proves the difficult raw operational fact: a native
input or bound-output transition can be freshened while renaming the source
up to process alpha and the derivative up to label-binder alpha.  This module
uses that fact to expose an actual quotient-level transition relation.

The quotient is deliberately on a *labelled derivative*, not independently
on an action and a target.  A late input or bound-output label binds
occurrences in its derivative, so quotienting those components independently
would lose the binding incidence.

No weak transition, structural closure, or assumed equivariance principle is
used below.  Every witness stored by `AlphaNativeStep` is a genuine
`Late.NativeStep`.
-/

namespace Cantilune.Pi.OpenSMCAlphaTransitionQuotient

open Cantilune.Pi
open Cantilune.Pi.OpenSMCActionAlpha

/-- Raw processes modulo the alpha relation used by the strong-late kernel. -/
abbrev AlphaProcess := Quotient Late.Alpha.setoid

/--
A strong native transition between alpha classes.

Existential saturation is essential here: changing a bound label also changes
the source representative and the occurrences bound in the derivative.  The
definition therefore cannot be a quotient of the action alone.
-/
def AlphaNativeStep
    (source : AlphaProcess) (derivative : AlphaDerivative) : Prop :=
  ∃ rawSource rawAction rawTarget,
    Late.NativeStep rawSource rawAction rawTarget ∧
    (Quotient.mk Late.Alpha.setoid rawSource : AlphaProcess) = source ∧
    (Quotient.mk DerivativeAlpha.setoid
        ({ action := rawAction, target := rawTarget } :
          LabelledDerivative) : AlphaDerivative) = derivative

/-- Every genuine raw native step injects into the quotient transition. -/
theorem alphaNativeStep_mk
    (step : Late.NativeStep source action target) :
    AlphaNativeStep
      (Quotient.mk Late.Alpha.setoid source)
      (Quotient.mk DerivativeAlpha.setoid
        ({ action := action, target := target } : LabelledDerivative)) :=
  ⟨source, action, target, step, rfl, rfl⟩

/-- The quotient relation is extensional in both quotient endpoints. -/
theorem alphaNativeStep_congr
    (sourceEq : source = source')
    (derivativeEq : derivative = derivative')
    (step : AlphaNativeStep source derivative) :
    AlphaNativeStep source' derivative' := by
  simpa [sourceEq, derivativeEq] using step

/--
Project the observable action class from a derivative class.

This is well-defined because every constructor of `DerivativeAlpha` induces
the corresponding `ActionAlpha` relation.
-/
def derivativeAction : AlphaDerivative → AlphaAction :=
  Quotient.map (fun derivative => derivative.action) (by
    intro left right relation
    exact relation.action)

@[simp]
theorem derivativeAction_mk
    (derivative : LabelledDerivative) :
    derivativeAction
        (Quotient.mk DerivativeAlpha.setoid derivative) =
      Quotient.mk ActionAlpha.setoid derivative.action :=
  rfl

/-- A deterministic name fresh for both endpoints and the free subject. -/
def transitionFreshBinder
    (source target : Raw.Proc) (channel : Name) : Name :=
  (Raw.Proc.par source target).freshName channel channel

theorem transitionFreshBinder_not_mem_source
    (source target : Raw.Proc) (channel : Name) :
    transitionFreshBinder source target channel ∉ source.allNames := by
  intro member
  exact
    (Raw.Proc.freshName_not_mem_allNames
      (Raw.Proc.par source target) channel channel)
      (by
        simp only [Raw.Proc.allNames, Finset.mem_union]
        exact Or.inl member)

theorem transitionFreshBinder_not_mem_target
    (source target : Raw.Proc) (channel : Name) :
    transitionFreshBinder source target channel ∉ target.allNames := by
  intro member
  exact
    (Raw.Proc.freshName_not_mem_allNames
      (Raw.Proc.par source target) channel channel)
      (by
        simp only [Raw.Proc.allNames, Finset.mem_union]
        exact Or.inr member)

theorem transitionFreshBinder_ne_channel
    (source target : Raw.Proc) (channel : Name) :
    transitionFreshBinder source target channel ≠ channel :=
  Raw.Proc.freshName_ne_needle
    (Raw.Proc.par source target) channel channel

/--
Every native bound output has a deterministically fresh representative.

The representative is still a genuine one-step `Late.NativeStep`; its source
is alpha-equivalent to the original source, and its labelled derivative is
equal to the original derivative in `AlphaDerivative`.  This is the
operational well-definedness statement for general bound-output action labels.
-/
theorem boundOutput_fresh_representative
    (step :
      Late.NativeStep source (.boundOutput channel binder) target) :
    ∃ renamedSource renamedTarget,
      Late.NativeStep renamedSource
        (.boundOutput channel
          (transitionFreshBinder source target channel))
        renamedTarget ∧
      (Quotient.mk Late.Alpha.setoid renamedSource : AlphaProcess) =
        Quotient.mk Late.Alpha.setoid source ∧
      (Quotient.mk DerivativeAlpha.setoid
          ({ action :=
              .boundOutput channel
                (transitionFreshBinder source target channel),
             target := renamedTarget } :
            LabelledDerivative) : AlphaDerivative) =
        Quotient.mk DerivativeAlpha.setoid
          ({ action := .boundOutput channel binder, target := target } :
            LabelledDerivative) := by
  rcases
      alphaRenameBoundOutput_compatible step
        (transitionFreshBinder_not_mem_source source target channel)
        (transitionFreshBinder_not_mem_target source target channel) with
    ⟨renamedSource, renamedTarget, sourceAlpha, renamedStep,
      derivativeAlpha⟩
  exact
    ⟨renamedSource, renamedTarget, renamedStep,
      (Quotient.sound sourceAlpha).symm,
      (Quotient.sound derivativeAlpha).symm⟩

/--
The quotient transition represented by a bound output is independent of the
spelling of its bound name: the deterministic fresh representative witnesses
the very same quotient endpoints.
-/
theorem alphaNativeStep_boundOutput_fresh
    (step :
      Late.NativeStep source (.boundOutput channel binder) target) :
    AlphaNativeStep
      (Quotient.mk Late.Alpha.setoid source)
      (Quotient.mk DerivativeAlpha.setoid
        ({ action := .boundOutput channel binder, target := target } :
          LabelledDerivative)) := by
  rcases boundOutput_fresh_representative step with
    ⟨renamedSource, renamedTarget, renamedStep, sourceEq, derivativeEq⟩
  exact
    ⟨renamedSource,
      .boundOutput channel (transitionFreshBinder source target channel),
      renamedTarget, renamedStep, sourceEq, derivativeEq⟩

/--
The action projected from the normalized derivative is alpha-equal to the
original bound-output action.  This connects the operational quotient to the
standalone action quotient without discarding the derivative binder.
-/
theorem normalized_boundOutput_action_eq
    (step :
      Late.NativeStep source (.boundOutput channel binder) target) :
    let fresh := transitionFreshBinder source target channel
    (Quotient.mk ActionAlpha.setoid
        (.boundOutput channel fresh) : AlphaAction) =
      Quotient.mk ActionAlpha.setoid
        (.boundOutput channel binder) := by
  intro fresh
  exact Quotient.sound
    (ActionAlpha.boundOutput
      (transitionFreshBinder_ne_channel source target channel)
      (OpenSMCActionAlpha.nativeBoundOutput_binder_ne_channel step))

end Cantilune.Pi.OpenSMCAlphaTransitionQuotient
