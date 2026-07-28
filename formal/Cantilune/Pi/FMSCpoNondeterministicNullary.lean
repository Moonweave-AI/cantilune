import Cantilune.Pi.FMSCpoNondeterministicLimits
import Cantilune.Pi.FMSCpoFiniteStrictPower
import Cantilune.Pi.FMSPowerdomainBoundary
import Mathlib.CategoryTheory.Limits.Shapes.Terminal

/-!
# The free nondeterministic omega-CPO on no generators

The all-object Abramsky powerdomain still requires the solution-set argument.
This file constructs the first nontrivial free object directly: the free
pointed continuous semilattice on the empty omega-CPO.

Its carrier is ordered `Bool`.  `false` is order-theoretic divergence,
`true` is deadlock, and choice is conjunction.  The two constants are
distinct, and every strict continuous semilattice map out of this object is
uniquely determined.
-/

noncomputable section

namespace Cantilune.Pi.FMSCpoNondeterministicNullary

open CategoryTheory
open CategoryTheory.Limits
open OmegaCompletePartialOrder
open Cantilune.Pi.FMSExternalPackage
open Cantilune.Pi.FMSPowerdomainBoundary
open Cantilune.Pi.FMSCpoFiniteStrictPower
open Cantilune.Pi.FMSCpoNondeterministicCategory

namespace NDωCPO

/-- The separated two-point nondeterministic computation. -/
def nullaryComputation : NondeterministicComputation where
  carrier := meetSemilattice.carrier
  divergence := false
  divergence_le := by
    intro value
    exact Bool.false_le value
  deadlock := true
  choice := meetSemilattice.choice
  choice_assoc := meetSemilattice.choice_assoc
  choice_comm := meetSemilattice.choice_comm
  choice_idem := meetSemilattice.choice_idem
  deadlock_choice := meetSemilattice.bottom_choice

/-- The free candidate on no generators. -/
def nullaryObject : NDωCPO where
  computation := nullaryComputation

theorem nullary_divergence_ne_deadlock :
    nullaryObject.computation.divergence ≠
      nullaryObject.computation.deadlock := by
  change (false : Bool) ≠ true
  exact Bool.false_ne_true

/-- Interpret the two nullary computations in any target algebra. -/
def nullaryEvaluation
    (target : NDωCPO) :
    Bool → target.carrier :=
  fun value =>
    if value then
      target.computation.deadlock
    else
      target.computation.divergence

theorem nullaryEvaluation_monotone
    (target : NDωCPO) :
    Monotone (nullaryEvaluation target) := by
  intro left right ordered
  cases left <;> cases right
  · exact le_rfl
  · exact
      target.computation.divergence_le
        target.computation.deadlock
  · exact False.elim ((by decide : ¬ true ≤ false) ordered)
  · exact le_rfl

/-- The nullary evaluation with a definitionally transparent function field. -/
def nullaryContinuousEvaluation
    (target : NDωCPO) :
    nullaryObject.carrier ⟶ target.carrier where
  toFun := nullaryEvaluation target
  monotone' := nullaryEvaluation_monotone target
  map_ωSup' :=
    (continuousOfFiniteMonotone
      (nullaryEvaluation target)
      (nullaryEvaluation_monotone target)).map_ωSup'

@[simp]
theorem nullaryContinuousEvaluation_apply
    (target : NDωCPO)
    (value : nullaryObject.carrier) :
    nullaryContinuousEvaluation target value =
      nullaryEvaluation target value :=
  rfl

@[simp]
theorem nullaryContinuousEvaluation_concrete_apply
    (target : NDωCPO)
    (value : nullaryObject.carrier) :
    (ConcreteCategory.hom (C := ωCPO)
        (nullaryContinuousEvaluation target)) value =
      nullaryEvaluation target value :=
  rfl

@[simp]
theorem nullaryChoice_concrete_apply
    (left right : nullaryObject.carrier) :
    (ConcreteCategory.hom (C := ωCPO)
        nullaryObject.computation.choice) (left, right) =
      (left && right) :=
  rfl

/-- The unique strict continuous semilattice arrow from the nullary object. -/
def nullaryTo (target : NDωCPO) :
    nullaryObject ⟶ target where
  hom := nullaryContinuousEvaluation target
  map_divergence := rfl
  map_deadlock := rfl
  map_choice := by
    intro left right
    cases left <;> cases right
    · change
        target.computation.divergence =
          target.computation.choice
            (target.computation.divergence,
              target.computation.divergence)
      exact
        (target.computation.choice_idem
          target.computation.divergence).symm
    · change
        target.computation.divergence =
          target.computation.choice
            (target.computation.divergence,
              target.computation.deadlock)
      exact
        ((target.computation.choice_comm
          target.computation.divergence
          target.computation.deadlock).trans
          (target.computation.deadlock_choice
            target.computation.divergence)).symm
    · change
        target.computation.divergence =
          target.computation.choice
            (target.computation.deadlock,
              target.computation.divergence)
      exact
        (target.computation.deadlock_choice
          target.computation.divergence).symm
    · change
        target.computation.deadlock =
          target.computation.choice
            (target.computation.deadlock,
              target.computation.deadlock)
      exact
        (target.computation.choice_idem
          target.computation.deadlock).symm

/-- Every strict arrow from the nullary object is the canonical evaluation. -/
theorem nullaryTo_unique
    (target : NDωCPO)
    (morphism : nullaryObject ⟶ target) :
    morphism = nullaryTo target := by
  apply NDωCPO.Hom.ext
  apply ContinuousHom.ext
  intro value
  cases value
  · change
      (ConcreteCategory.hom (C := ωCPO) morphism.hom) false =
        target.computation.divergence
    exact morphism.map_divergence
  · change
      (ConcreteCategory.hom (C := ωCPO) morphism.hom) true =
        target.computation.deadlock
    exact morphism.map_deadlock

/--
The separated two-point object is initial in `NDωCPO`; equivalently, it is
the actual free nondeterministic computation on zero generators.
-/
def nullaryIsInitial :
    IsInitial nullaryObject :=
  IsInitial.ofUniqueHom
    nullaryTo nullaryTo_unique

end NDωCPO

end Cantilune.Pi.FMSCpoNondeterministicNullary
