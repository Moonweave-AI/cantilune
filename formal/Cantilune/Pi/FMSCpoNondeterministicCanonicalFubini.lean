import Cantilune.Pi.FMSCpoNondeterministicEnrichedAdjunction

/-!
# The canonical sequential Fubini map and its exact obstruction

A Cpo-enriched free/forgetful adjunction has a canonical tensorial strength:
pair a pure value with an effectful value by free extension. Extending once
more in the first effectful argument gives the usual left-to-right
sequential Fubini candidate.

This file constructs that candidate as an actual jointly continuous map from
the global `SolutionSetCondition`; no Fubini witness is assumed. It proves
the pure-unit equation and the strict algebra laws in the first argument.

Those strict laws expose an exact obstruction in the current category
`NDωCPO`: its morphisms preserve *both* the order-bottom divergence and the
distinct semilattice identity/deadlock. A symmetric Fubini map that is
strict in its first argument would identify those two constants. Hence the
canonical enriched-adjunction construction cannot be commutative.

The construction is first presented over explicit cartesian carriers. This
avoids hiding the mathematical issue behind mathlib's opaque choice of a
binary-product cone. Symmetry is stated using the explicit continuous swap.
Transport of the candidate to mathlib's chosen binary products is not
claimed in this file; the kernel-checked obstruction is the explicit-product
equation below.

This is a boundary theorem about the current formal category, not a no-go
theorem for Abramsky's original powerdomain. It identifies the point that
must be reconciled with the original notion of strict semilattice
homomorphism before commutative Fubini coherence can be claimed.
-/

noncomputable section

namespace Cantilune.Pi.FMSCpoNondeterministicCanonicalFubini

open CategoryTheory
open OmegaCompletePartialOrder
open Cantilune.Pi.FMSExternalPackage
open Cantilune.Pi.FMSCpoNondeterministicCategory
open Cantilune.Pi.FMSCpoNondeterministicSolutionSet
open Cantilune.Pi.FMSCpoNondeterministicSolutionSet.SolutionSet
open Cantilune.Pi.FMSCpoNondeterministicEnrichedAdjunction.NDωCPO

/-- Cartesian product with its carrier definitionally exposed. -/
abbrev explicitProduct (left right : ωCPO) : ωCPO :=
  ωCPO.of (left.carrier × right.carrier)

/-- Continuous swapping on an explicit product. -/
def explicitSwap (left right : ωCPO) :
    explicitProduct left right ⟶ explicitProduct right left :=
  ContinuousHom.ofFun fun value => (value.2, value.1)

/-- Pair a fixed left value with a varying right value. -/
def pairWithLeft (left right : ωCPO) (leftValue : left) :
    right ⟶ explicitProduct left right :=
  ContinuousHom.ofFun (fun rightValue => (leftValue, rightValue))
    (by fun_prop)

/-- Pair a varying left value with a fixed right value. -/
def pairWithRight (left right : ωCPO) (rightValue : right) :
    left ⟶ explicitProduct left right :=
  ContinuousHom.ofFun (fun leftValue => (leftValue, rightValue))
    (by fun_prop)

/-- Unit after pairing with a fixed right value. -/
def unitPairWithRight
    (solution : SolutionSetCondition.{0} carrierFunctor)
    (left right : ωCPO) (rightValue : right) :
    left ⟶
      (ordinaryMonadOfSolutionSet solution).obj
        (explicitProduct left right) :=
  ContinuousHom.comp
    ((ordinaryMonadOfSolutionSet solution).η.app
      (explicitProduct left right))
    (pairWithRight left right rightValue)

/-- The unit applied to a pair, curried in its second argument. -/
def pairUnitCurried
    (solution : SolutionSetCondition.{0} carrierFunctor)
    (left right : ωCPO) :
    ContinuousHom left.carrier
      (ContinuousHom right.carrier
        ((ordinaryMonadOfSolutionSet solution).obj
          (explicitProduct left right)).carrier) where
  toFun leftValue :=
    ContinuousHom.comp
      ((ordinaryMonadOfSolutionSet solution).η.app
        (explicitProduct left right))
      (pairWithLeft left right leftValue)
  monotone' := by
    intro lower upper ordered rightValue
    exact
      ((ordinaryMonadOfSolutionSet solution).η.app
        (explicitProduct left right)).monotone
        ⟨ordered, le_rfl⟩
  map_ωSup' := by
    intro chain
    apply ContinuousHom.ext
    intro rightValue
    exact
      (unitPairWithRight solution left right rightValue).continuous chain

/--
For a pure left value, freely extend pairing in the right computation.
The outer map is continuous because free extension is continuous in its
generator.
-/
def leftStrengthCurried
    (solution : SolutionSetCondition.{0} carrierFunctor)
    (left right : ωCPO) :
    ContinuousHom left.carrier
      (ContinuousHom
        ((ordinaryMonadOfSolutionSet solution).obj right).carrier
        ((ordinaryMonadOfSolutionSet solution).obj
          (explicitProduct left right)).carrier) :=
  ContinuousHom.comp
    (ordinaryFreeLiftContinuous solution right
      ((freeFunctorOfSolutionSet solution).obj
        (explicitProduct left right)).computation)
    (pairUnitCurried solution left right)

/-- The canonical tensorial strength as one jointly continuous map. -/
def leftStrength
    (solution : SolutionSetCondition.{0} carrierFunctor)
    (left right : ωCPO) :
    ContinuousHom
      (left.carrier ×
        ((ordinaryMonadOfSolutionSet solution).obj right).carrier)
      ((ordinaryMonadOfSolutionSet solution).obj
        (explicitProduct left right)).carrier :=
  ContinuousHom.ofFun fun value =>
    leftStrengthCurried solution left right value.1 value.2

/--
Turn the strength around as a continuous family of generators indexed by
the right computation. The proof is pointwise and uses continuity of every
section of `leftStrengthCurried`.
-/
def fubiniGenerators
    (solution : SolutionSetCondition.{0} carrierFunctor)
    (left right : ωCPO) :
    ContinuousHom
      ((ordinaryMonadOfSolutionSet solution).obj right).carrier
      (ContinuousHom left.carrier
        ((ordinaryMonadOfSolutionSet solution).obj
          (explicitProduct left right)).carrier) where
  toFun rightValue :=
    { toFun := fun leftValue =>
        leftStrengthCurried solution left right leftValue rightValue
      monotone' := by
        intro lower upper ordered
        exact
          (leftStrengthCurried solution left right).monotone ordered rightValue
      map_ωSup' := by
        intro chain
        exact
          ContinuousHom.congr_fun
            ((leftStrengthCurried solution left right).continuous chain)
            rightValue }
  monotone' := by
    intro lower upper ordered leftValue
    exact
      (leftStrengthCurried solution left right leftValue).monotone ordered
  map_ωSup' := by
    intro chain
    apply ContinuousHom.ext
    intro leftValue
    exact
      (leftStrengthCurried solution left right leftValue).continuous chain

/--
The canonical left-to-right sequential Fubini map, curried in the right
computation.
-/
def sequentialFubiniCurried
    (solution : SolutionSetCondition.{0} carrierFunctor)
    (left right : ωCPO) :
    ContinuousHom
      ((ordinaryMonadOfSolutionSet solution).obj right).carrier
      (ContinuousHom
        ((ordinaryMonadOfSolutionSet solution).obj left).carrier
        ((ordinaryMonadOfSolutionSet solution).obj
          (explicitProduct left right)).carrier) :=
  ContinuousHom.comp
    (ordinaryFreeLiftContinuous solution left
      ((freeFunctorOfSolutionSet solution).obj
        (explicitProduct left right)).computation)
    (fubiniGenerators solution left right)

/-- The uncurried, jointly continuous sequential Fubini candidate. -/
def sequentialFubini
    (solution : SolutionSetCondition.{0} carrierFunctor)
    (left right : ωCPO) :
    ContinuousHom
      (((ordinaryMonadOfSolutionSet solution).obj left).carrier ×
        ((ordinaryMonadOfSolutionSet solution).obj right).carrier)
      ((ordinaryMonadOfSolutionSet solution).obj
        (explicitProduct left right)).carrier :=
  ContinuousHom.ofFun fun value =>
    sequentialFubiniCurried solution left right value.2 value.1

@[simp]
theorem leftStrength_apply
    (solution : SolutionSetCondition.{0} carrierFunctor)
    (left right : ωCPO)
    (leftValue : left)
    (rightValue : (ordinaryMonadOfSolutionSet solution).obj right) :
    leftStrength solution left right (leftValue, rightValue) =
      ordinaryFreeLift solution right
        ((freeFunctorOfSolutionSet solution).obj
          (explicitProduct left right)).computation
        (pairUnitCurried solution left right leftValue)
        rightValue :=
  rfl

@[simp]
theorem sequentialFubini_apply
    (solution : SolutionSetCondition.{0} carrierFunctor)
    (left right : ωCPO)
    (leftValue : (ordinaryMonadOfSolutionSet solution).obj left)
    (rightValue : (ordinaryMonadOfSolutionSet solution).obj right) :
    sequentialFubini solution left right (leftValue, rightValue) =
      ordinaryFreeLift solution left
        ((freeFunctorOfSolutionSet solution).obj
          (explicitProduct left right)).computation
        (fubiniGenerators solution left right rightValue)
        leftValue :=
  rfl

/-- Pairing two pure values is pure pairing. -/
theorem sequentialFubini_unit_pointwise
    (solution : SolutionSetCondition.{0} carrierFunctor)
    (left right : ωCPO)
    (leftValue : left)
    (rightValue : right) :
    sequentialFubini solution left right
        ((ordinaryMonadOfSolutionSet solution).η.app left leftValue,
          (ordinaryMonadOfSolutionSet solution).η.app right rightValue) =
      (ordinaryMonadOfSolutionSet solution).η.app
        (explicitProduct left right) (leftValue, rightValue) := by
  change
    ordinaryFreeLift solution left
        ((freeFunctorOfSolutionSet solution).obj
          (explicitProduct left right)).computation
        (fubiniGenerators solution left right
          ((ordinaryMonadOfSolutionSet solution).η.app right rightValue))
        ((ordinaryMonadOfSolutionSet solution).η.app left leftValue) =
      _
  have outerUnit :=
    ContinuousHom.congr_fun
      (ordinaryFreeLift_unit solution left
        ((freeFunctorOfSolutionSet solution).obj
          (explicitProduct left right)).computation
        (fubiniGenerators solution left right
          ((ordinaryMonadOfSolutionSet solution).η.app right rightValue)))
      leftValue
  have innerUnit :
      ordinaryFreeLift solution right
          ((freeFunctorOfSolutionSet solution).obj
            (explicitProduct left right)).computation
          (pairUnitCurried solution left right leftValue)
          ((ordinaryMonadOfSolutionSet solution).η.app right rightValue) =
        pairUnitCurried solution left right leftValue rightValue := by
    exact
      ContinuousHom.congr_fun
        (ordinaryFreeLift_unit solution right
          ((freeFunctorOfSolutionSet solution).obj
            (explicitProduct left right)).computation
          (pairUnitCurried solution left right leftValue))
        rightValue
  have generatorUnit :
      fubiniGenerators solution left right
          ((ordinaryMonadOfSolutionSet solution).η.app right rightValue)
          leftValue =
        pairUnitCurried solution left right leftValue rightValue := by
    change
      ordinaryFreeLift solution right
          ((freeFunctorOfSolutionSet solution).obj
            (explicitProduct left right)).computation
          (pairUnitCurried solution left right leftValue)
          ((ordinaryMonadOfSolutionSet solution).η.app right rightValue) =
        pairUnitCurried solution left right leftValue rightValue
    exact innerUnit
  calc
    _ =
        fubiniGenerators solution left right
          ((ordinaryMonadOfSolutionSet solution).η.app right rightValue)
          leftValue :=
      outerUnit
    _ =
        pairUnitCurried solution left right leftValue rightValue :=
      generatorUnit
    _ =
        (ordinaryMonadOfSolutionSet solution).η.app
          (explicitProduct left right) (leftValue, rightValue) :=
      rfl

/-- The sequential Fubini candidate is divergence-strict in its first input. -/
theorem sequentialFubini_left_divergence
    (solution : SolutionSetCondition.{0} carrierFunctor)
    (left right : ωCPO)
    (rightValue : (ordinaryMonadOfSolutionSet solution).obj right) :
    sequentialFubini solution left right
        (ordinaryDivergence solution left, rightValue) =
      ordinaryDivergence solution (explicitProduct left right) := by
  rw [sequentialFubini_apply]
  exact
    ordinaryFreeLift_divergence solution left
      ((freeFunctorOfSolutionSet solution).obj
        (explicitProduct left right)).computation
      (fubiniGenerators solution left right rightValue)

/-- The sequential Fubini candidate preserves deadlock in its first input. -/
theorem sequentialFubini_left_deadlock
    (solution : SolutionSetCondition.{0} carrierFunctor)
    (left right : ωCPO)
    (rightValue : (ordinaryMonadOfSolutionSet solution).obj right) :
    sequentialFubini solution left right
        (ordinaryDeadlock solution left, rightValue) =
      ordinaryDeadlock solution (explicitProduct left right) := by
  rw [sequentialFubini_apply]
  exact
    ordinaryFreeLift_deadlock solution left
      ((freeFunctorOfSolutionSet solution).obj
        (explicitProduct left right)).computation
      (fubiniGenerators solution left right rightValue)

/-- The sequential Fubini candidate preserves choice in its first input. -/
theorem sequentialFubini_left_choice
    (solution : SolutionSetCondition.{0} carrierFunctor)
    (left right : ωCPO)
    (first second :
      (ordinaryMonadOfSolutionSet solution).obj left)
    (rightValue : (ordinaryMonadOfSolutionSet solution).obj right) :
    sequentialFubini solution left right
        (ordinaryChoice solution left (first, second), rightValue) =
      ordinaryChoice solution (explicitProduct left right)
        (sequentialFubini solution left right (first, rightValue),
          sequentialFubini solution left right (second, rightValue)) := by
  change
    ordinaryFreeLift solution left
        ((freeFunctorOfSolutionSet solution).obj
          (explicitProduct left right)).computation
        (fubiniGenerators solution left right rightValue)
        (ordinaryChoice solution left (first, second)) =
      ((freeFunctorOfSolutionSet solution).obj
        (explicitProduct left right)).computation.choice
        (ordinaryFreeLift solution left
            ((freeFunctorOfSolutionSet solution).obj
              (explicitProduct left right)).computation
            (fubiniGenerators solution left right rightValue) first,
          ordinaryFreeLift solution left
            ((freeFunctorOfSolutionSet solution).obj
              (explicitProduct left right)).computation
            (fubiniGenerators solution left right rightValue) second)
  exact
    ordinaryFreeLift_choice solution left
      ((freeFunctorOfSolutionSet solution).obj
        (explicitProduct left right)).computation
      (fubiniGenerators solution left right rightValue)
      first second

/--
The canonical sequential Fubini map is not symmetric. At the pair
`(divergence, deadlock)`, symmetry would equate deadlock with divergence.
-/
theorem sequentialFubini_not_commutative
    (solution : SolutionSetCondition.{0} carrierFunctor)
    (object : ωCPO) :
    ¬
      (ContinuousHom.comp
          (sequentialFubini solution object object)
          (explicitSwap
            ((ordinaryMonadOfSolutionSet solution).obj object)
            ((ordinaryMonadOfSolutionSet solution).obj object)) =
        ContinuousHom.comp
          ((ordinaryMonadOfSolutionSet solution).map
            (explicitSwap object object))
          (sequentialFubini solution object object)) := by
  intro commutes
  have pointwise :=
    ContinuousHom.congr_fun commutes
      (ordinaryDivergence solution object,
        ordinaryDeadlock solution object)
  change
    sequentialFubini solution object object
        (ordinaryDeadlock solution object,
          ordinaryDivergence solution object) =
      (ordinaryMonadOfSolutionSet solution).map
        (explicitSwap object object)
        (sequentialFubini solution object object
          (ordinaryDivergence solution object,
            ordinaryDeadlock solution object))
    at pointwise
  rw [
    sequentialFubini_left_deadlock,
    sequentialFubini_left_divergence,
    ordinaryMap_divergence] at pointwise
  exact
    ordinaryDivergence_ne_deadlock solution
      (explicitProduct object object) pointwise.symm

/--
More generally, a symmetric pairing operation cannot be strict for both
distinguished constants in its first argument. This statement does not
depend on how the pairing operation was built.
-/
theorem no_commutative_first_strict_pairing
    (solution : SolutionSetCondition.{0} carrierFunctor)
    (object : ωCPO)
    (pairing :
      ContinuousHom
        (((ordinaryMonadOfSolutionSet solution).obj object).carrier ×
          ((ordinaryMonadOfSolutionSet solution).obj object).carrier)
        ((ordinaryMonadOfSolutionSet solution).obj
          (explicitProduct object object)).carrier)
    (leftDivergence :
      ∀ rightValue,
        pairing (ordinaryDivergence solution object, rightValue) =
          ordinaryDivergence solution (explicitProduct object object))
    (leftDeadlock :
      ∀ rightValue,
        pairing (ordinaryDeadlock solution object, rightValue) =
          ordinaryDeadlock solution (explicitProduct object object))
    (commutes :
      ContinuousHom.comp pairing
          (explicitSwap
            ((ordinaryMonadOfSolutionSet solution).obj object)
            ((ordinaryMonadOfSolutionSet solution).obj object)) =
        ContinuousHom.comp
          ((ordinaryMonadOfSolutionSet solution).map
            (explicitSwap object object))
          pairing) :
    False := by
  have pointwise :=
    ContinuousHom.congr_fun commutes
      (ordinaryDivergence solution object,
        ordinaryDeadlock solution object)
  change
    pairing
        (ordinaryDeadlock solution object,
          ordinaryDivergence solution object) =
      (ordinaryMonadOfSolutionSet solution).map
        (explicitSwap object object)
        (pairing
          (ordinaryDivergence solution object,
            ordinaryDeadlock solution object))
    at pointwise
  rw [
    leftDeadlock,
    leftDivergence,
    ordinaryMap_divergence] at pointwise
  exact
    ordinaryDivergence_ne_deadlock solution
      (explicitProduct object object) pointwise.symm

end Cantilune.Pi.FMSCpoNondeterministicCanonicalFubini
