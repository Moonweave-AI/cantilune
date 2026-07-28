import Cantilune.Pi.FMSCpoNondeterministicCanonicalFubini
import Cantilune.Pi.FMSCpoNondeterministicKleisli

/-!
# Coherence of the canonical sequential Fubini map

The ordinary free pointed-semilattice adjunction determines a canonical
left-to-right sequencing operation.  Unlike a commutative Fubini map, this
operation exists for every monad.  This file proves its laws on products
whose carriers are definitionally exposed:

* Kleisli unit and associativity;
* naturality in both product components;
* associativity modulo the explicit cartesian reassociation;
* both explicit unitors; and
* compatibility with monad multiplication.

No symmetry law is included.  The imported
`sequentialFubini_not_commutative` theorem proves that symmetry is false for
the separated divergence/deadlock free algebra.
-/

noncomputable section

namespace Cantilune.Pi.FMSCpoNondeterministicSequentialCoherence

set_option backward.isDefEq.respectTransparency false

open CategoryTheory
open OmegaCompletePartialOrder
open Cantilune.Pi.FMSExternalPackage
open Cantilune.Pi.FMSCpoNondeterministicCategory
open Cantilune.Pi.FMSCpoNondeterministicSolutionSet
open Cantilune.Pi.FMSCpoNondeterministicSolutionSet.SolutionSet
open Cantilune.Pi.FMSCpoNondeterministicKleisli
open Cantilune.Pi.FMSCpoNondeterministicCanonicalFubini

/-- Functorial pairing on products with definitionally exposed carriers. -/
def explicitProductMap
    {left left' right right' : ωCPO}
    (leftMap : left ⟶ left')
    (rightMap : right ⟶ right') :
    explicitProduct left right ⟶ explicitProduct left' right' :=
  ContinuousHom.ofFun (fun value =>
    (leftMap value.1, rightMap value.2)) (by fun_prop)

/-- Reassociate an explicitly represented triple to the right. -/
def explicitAssociator
    (first second third : ωCPO) :
    explicitProduct (explicitProduct first second) third ⟶
      explicitProduct first (explicitProduct second third) :=
  ContinuousHom.ofFun (fun value =>
    (value.1.1, (value.1.2, value.2))) (by fun_prop)

/-- Reassociate an explicitly represented triple to the left. -/
def explicitAssociatorInv
    (first second third : ωCPO) :
    explicitProduct first (explicitProduct second third) ⟶
      explicitProduct (explicitProduct first second) third :=
  ContinuousHom.ofFun (fun value =>
    ((value.1, value.2.1), value.2.2)) (by fun_prop)

/-- Explicit cartesian unit carrier. -/
abbrev explicitUnit : ωCPO :=
  ωCPO.of PUnit

/-- Left unitor for the explicit cartesian unit. -/
def explicitLeftUnitor (object : ωCPO) :
    explicitProduct explicitUnit object ⟶ object :=
  ContinuousHom.ofFun Prod.snd (by fun_prop)

/-- Inverse left unitor for the explicit cartesian unit. -/
def explicitLeftUnitorInv (object : ωCPO) :
    object ⟶ explicitProduct explicitUnit object :=
  ContinuousHom.ofFun (fun value => (PUnit.unit, value)) (by fun_prop)

/-- Right unitor for the explicit cartesian unit. -/
def explicitRightUnitor (object : ωCPO) :
    explicitProduct object explicitUnit ⟶ object :=
  ContinuousHom.ofFun Prod.fst (by fun_prop)

/-- Inverse right unitor for the explicit cartesian unit. -/
def explicitRightUnitorInv (object : ωCPO) :
    object ⟶ explicitProduct object explicitUnit :=
  ContinuousHom.ofFun (fun value => (value, PUnit.unit)) (by fun_prop)

/-! ## Generic Kleisli laws used by every subsequent diagram -/

/-- The selected Kleisli extension of the monad unit is the identity. -/
theorem ordinaryKleisliExtension_pure
    (solution : SolutionSetCondition.{0} carrierFunctor)
    (source : ωCPO) :
    ordinaryKleisliExtension solution
        ((ordinaryMonadOfSolutionSet solution).η.app source) =
      𝟙 ((ordinaryMonadOfSolutionSet solution).obj source) := by
  exact (ordinaryMonadOfSolutionSet solution).right_unit source

/-- Kleisli extension is associative, as an equality of continuous maps. -/
theorem ordinaryKleisliExtension_assoc
    (solution : SolutionSetCondition.{0} carrierFunctor)
    {first second third : ωCPO}
    (left :
      first ⟶ (ordinaryMonadOfSolutionSet solution).obj second)
    (right :
      second ⟶ (ordinaryMonadOfSolutionSet solution).obj third) :
    ordinaryKleisliExtension solution left ≫
        ordinaryKleisliExtension solution right =
      ordinaryKleisliExtension solution
        (left ≫ ordinaryKleisliExtension solution right) := by
  simp [ordinaryKleisliExtension,
    ← (ordinaryMonadOfSolutionSet solution).μ.naturality_assoc,
    (ordinaryMonadOfSolutionSet solution).assoc]

/-- Mapping a pure function is the same as binding its pure composite. -/
theorem ordinaryMap_eq_kleisli_pure
    (solution : SolutionSetCondition.{0} carrierFunctor)
    {source target : ωCPO}
    (morphism : source ⟶ target) :
    (ordinaryMonadOfSolutionSet solution).map morphism =
      ordinaryKleisliExtension solution
        (morphism ≫
          (ordinaryMonadOfSolutionSet solution).η.app target) := by
  simp [ordinaryKleisliExtension,
    (ordinaryMonadOfSolutionSet solution).map_comp,
    (ordinaryMonadOfSolutionSet solution).right_unit]

/-- Post-mapping a Kleisli computation pushes the map into its continuation. -/
theorem ordinaryKleisliExtension_post_map
    (solution : SolutionSetCondition.{0} carrierFunctor)
    {source middle target : ωCPO}
    (generator :
      source ⟶ (ordinaryMonadOfSolutionSet solution).obj middle)
    (morphism : middle ⟶ target) :
    ordinaryKleisliExtension solution generator ≫
        (ordinaryMonadOfSolutionSet solution).map morphism =
      ordinaryKleisliExtension solution
        (generator ≫
          (ordinaryMonadOfSolutionSet solution).map morphism) := by
  rw [ordinaryMap_eq_kleisli_pure,
    ordinaryKleisliExtension_assoc]

/-- Pre-mapping a Kleisli computation pushes the map into its generator. -/
theorem ordinaryMap_kleisliExtension
    (solution : SolutionSetCondition.{0} carrierFunctor)
    {source middle target : ωCPO}
    (morphism : source ⟶ middle)
    (generator :
      middle ⟶ (ordinaryMonadOfSolutionSet solution).obj target) :
    (ordinaryMonadOfSolutionSet solution).map morphism ≫
        ordinaryKleisliExtension solution generator =
      ordinaryKleisliExtension solution
        (morphism ≫ generator) := by
  rw [ordinaryMap_eq_kleisli_pure,
    ordinaryKleisliExtension_assoc]
  congr 1
  simp [ordinaryKleisliExtension_unit]

/--
Every Kleisli extension is an Eilenberg--Moore algebra morphism between
free algebras.  This is the multiplication law that remains valid without
any interchange or commutativity hypothesis.
-/
theorem ordinaryKleisliExtension_multiplication
    (solution : SolutionSetCondition.{0} carrierFunctor)
    {source target : ωCPO}
    (generator :
      source ⟶ (ordinaryMonadOfSolutionSet solution).obj target) :
    (ordinaryMonadOfSolutionSet solution).μ.app source ≫
        ordinaryKleisliExtension solution generator =
      (ordinaryMonadOfSolutionSet solution).map
          (ordinaryKleisliExtension solution generator) ≫
        (ordinaryMonadOfSolutionSet solution).μ.app target := by
  simp [ordinaryKleisliExtension,
    ← (ordinaryMonadOfSolutionSet solution).μ.naturality_assoc,
    (ordinaryMonadOfSolutionSet solution).assoc]

/-! ## The free-extension construction is exactly sequential Kleisli bind -/

/-- The outer free extension in `sequentialFubini` is Kleisli extension. -/
theorem sequentialFubini_eq_kleisli
    (solution : SolutionSetCondition.{0} carrierFunctor)
    (left right : ωCPO)
    (leftValue : (ordinaryMonadOfSolutionSet solution).obj left)
    (rightValue : (ordinaryMonadOfSolutionSet solution).obj right) :
    sequentialFubini solution left right (leftValue, rightValue) =
      ordinaryKleisliExtension solution
        (fubiniGenerators solution left right rightValue)
        leftValue := by
  rw [sequentialFubini_apply,
    ordinaryFreeLift_free]
  rfl

/-- The inner strength is itself one Kleisli extension. -/
theorem fubiniGenerators_eq_kleisli
    (solution : SolutionSetCondition.{0} carrierFunctor)
    (left right : ωCPO)
    (rightValue : (ordinaryMonadOfSolutionSet solution).obj right)
    (leftValue : left) :
    fubiniGenerators solution left right rightValue leftValue =
      ordinaryKleisliExtension solution
        (pairUnitCurried solution left right leftValue)
        rightValue := by
  change
    ordinaryFreeLift solution right
        ((freeFunctorOfSolutionSet solution).obj
          (explicitProduct left right)).computation
        (pairUnitCurried solution left right leftValue)
        rightValue =
      _
  rw [ordinaryFreeLift_free]
  rfl

/-! ## Naturality -/

@[simp]
theorem explicitProductMap_apply
    {left left' right right' : ωCPO}
    (leftMap : left ⟶ left')
    (rightMap : right ⟶ right')
    (value : explicitProduct left right) :
    explicitProductMap leftMap rightMap value =
      (leftMap value.1, rightMap value.2) :=
  rfl

theorem pairWithLeft_productMap
    {left left' right right' : ωCPO}
    (leftMap : left ⟶ left')
    (rightMap : right ⟶ right')
    (leftValue : left) :
    pairWithLeft left right leftValue ≫
        explicitProductMap leftMap rightMap =
      rightMap ≫
        pairWithLeft left' right' (leftMap leftValue) := by
  apply ContinuousHom.ext
  intro rightValue
  rfl

/--
Pure pairing is natural.  This is the generator equation from which both
strength and sequential-Fubini naturality follow.
-/
theorem pairUnitCurried_natural
    (solution : SolutionSetCondition.{0} carrierFunctor)
    {left left' right right' : ωCPO}
    (leftMap : left ⟶ left')
    (rightMap : right ⟶ right')
    (leftValue : left) :
    pairUnitCurried solution left right leftValue ≫
        (ordinaryMonadOfSolutionSet solution).map
          (explicitProductMap leftMap rightMap) =
      rightMap ≫
        pairUnitCurried solution left' right'
          (leftMap leftValue) := by
  apply ContinuousHom.ext
  intro rightValue
  change
    (ordinaryMonadOfSolutionSet solution).map
        (explicitProductMap leftMap rightMap)
        ((ordinaryMonadOfSolutionSet solution).η.app
          (explicitProduct left right)
          (leftValue, rightValue)) =
      (ordinaryMonadOfSolutionSet solution).η.app
        (explicitProduct left' right')
        (leftMap leftValue, rightMap rightValue)
  exact
    ContinuousHom.congr_fun
      ((ordinaryMonadOfSolutionSet solution).η.naturality
        (explicitProductMap leftMap rightMap))
      (leftValue, rightValue) |>.symm

/-- Naturality of the inner, right-computation Kleisli section. -/
theorem innerSequential_natural
    (solution : SolutionSetCondition.{0} carrierFunctor)
    {left left' right right' : ωCPO}
    (leftMap : left ⟶ left')
    (rightMap : right ⟶ right')
    (leftValue : left) :
    ordinaryKleisliExtension solution
        (pairUnitCurried solution left right leftValue) ≫
        (ordinaryMonadOfSolutionSet solution).map
          (explicitProductMap leftMap rightMap) =
      (ordinaryMonadOfSolutionSet solution).map rightMap ≫
        ordinaryKleisliExtension solution
          (pairUnitCurried solution left' right'
            (leftMap leftValue)) := by
  rw [ordinaryKleisliExtension_post_map,
    ordinaryMap_kleisliExtension,
    pairUnitCurried_natural]

/-- Naturality of the generator used by the outer Kleisli extension. -/
theorem fubiniGenerators_natural
    (solution : SolutionSetCondition.{0} carrierFunctor)
    {left left' right right' : ωCPO}
    (leftMap : left ⟶ left')
    (rightMap : right ⟶ right')
    (rightValue :
      (ordinaryMonadOfSolutionSet solution).obj right) :
    fubiniGenerators solution left right rightValue ≫
        (ordinaryMonadOfSolutionSet solution).map
          (explicitProductMap leftMap rightMap) =
      leftMap ≫
        fubiniGenerators solution left' right'
          ((ordinaryMonadOfSolutionSet solution).map
            rightMap rightValue) := by
  apply ContinuousHom.ext
  intro leftValue
  change
    (ordinaryKleisliExtension solution
      (pairUnitCurried solution left right leftValue) ≫
      (ordinaryMonadOfSolutionSet solution).map
        (explicitProductMap leftMap rightMap)) rightValue =
    ordinaryKleisliExtension solution
      (pairUnitCurried solution left' right'
        (leftMap leftValue))
      ((ordinaryMonadOfSolutionSet solution).map
        rightMap rightValue)
  exact
    ContinuousHom.congr_fun
      (innerSequential_natural solution
        leftMap rightMap leftValue)
      rightValue

/--
The canonical sequential Fubini operation is natural in both variables.
This is an equality before any product or symmetry quotient.
-/
theorem sequentialFubini_natural
    (solution : SolutionSetCondition.{0} carrierFunctor)
    {left left' right right' : ωCPO}
    (leftMap : left ⟶ left')
    (rightMap : right ⟶ right')
    (leftValue :
      (ordinaryMonadOfSolutionSet solution).obj left)
    (rightValue :
      (ordinaryMonadOfSolutionSet solution).obj right) :
    (ordinaryMonadOfSolutionSet solution).map
        (explicitProductMap leftMap rightMap)
        (sequentialFubini solution left right
          (leftValue, rightValue)) =
      sequentialFubini solution left' right'
        ((ordinaryMonadOfSolutionSet solution).map
            leftMap leftValue,
          (ordinaryMonadOfSolutionSet solution).map
            rightMap rightValue) := by
  rw [sequentialFubini_eq_kleisli,
    sequentialFubini_eq_kleisli]
  change
    (ordinaryKleisliExtension solution
        (fubiniGenerators solution left right rightValue) ≫
      (ordinaryMonadOfSolutionSet solution).map
        (explicitProductMap leftMap rightMap)) leftValue =
    ((ordinaryMonadOfSolutionSet solution).map leftMap ≫
      ordinaryKleisliExtension solution
        (fubiniGenerators solution left' right'
          ((ordinaryMonadOfSolutionSet solution).map
            rightMap rightValue))) leftValue
  rw [ordinaryKleisliExtension_post_map,
    ordinaryMap_kleisliExtension,
    fubiniGenerators_natural]

/-! ## Explicit cartesian unitors -/

theorem pairUnit_leftUnitor
    (solution : SolutionSetCondition.{0} carrierFunctor)
    (object : ωCPO) :
    pairUnitCurried solution explicitUnit object PUnit.unit ≫
        (ordinaryMonadOfSolutionSet solution).map
          (explicitLeftUnitor object) =
      (ordinaryMonadOfSolutionSet solution).η.app object := by
  apply ContinuousHom.ext
  intro value
  change
    (ordinaryMonadOfSolutionSet solution).map
        (explicitLeftUnitor object)
        ((ordinaryMonadOfSolutionSet solution).η.app
          (explicitProduct explicitUnit object)
          (PUnit.unit, value)) =
      (ordinaryMonadOfSolutionSet solution).η.app object value
  exact
    ContinuousHom.congr_fun
      ((ordinaryMonadOfSolutionSet solution).η.naturality
        (explicitLeftUnitor object))
      (PUnit.unit, value) |>.symm

theorem pairUnit_rightUnitor
    (solution : SolutionSetCondition.{0} carrierFunctor)
    (object : ωCPO)
    (value : object) :
    pairUnitCurried solution object explicitUnit value ≫
        (ordinaryMonadOfSolutionSet solution).map
          (explicitRightUnitor object) =
      (ContinuousHom.const value) ≫
        (ordinaryMonadOfSolutionSet solution).η.app object := by
  apply ContinuousHom.ext
  intro unitValue
  cases unitValue
  change
    (ordinaryMonadOfSolutionSet solution).map
        (explicitRightUnitor object)
        ((ordinaryMonadOfSolutionSet solution).η.app
          (explicitProduct object explicitUnit)
          (value, PUnit.unit)) =
      (ordinaryMonadOfSolutionSet solution).η.app object value
  exact
    ContinuousHom.congr_fun
      ((ordinaryMonadOfSolutionSet solution).η.naturality
        (explicitRightUnitor object))
      (value, PUnit.unit) |>.symm

/-- A pure outer computation immediately exposes the inner generator. -/
theorem sequentialFubini_left_pure
    (solution : SolutionSetCondition.{0} carrierFunctor)
    (left right : ωCPO)
    (leftValue : left)
    (rightValue :
      (ordinaryMonadOfSolutionSet solution).obj right) :
    sequentialFubini solution left right
        ((ordinaryMonadOfSolutionSet solution).η.app left leftValue,
          rightValue) =
      fubiniGenerators solution left right rightValue leftValue := by
  rw [sequentialFubini_eq_kleisli]
  exact
    ContinuousHom.congr_fun
      (ordinaryKleisliExtension_unit solution
        (fubiniGenerators solution left right rightValue))
      leftValue

/-- A pure inner computation immediately exposes pure pairing. -/
theorem fubiniGenerators_right_pure
    (solution : SolutionSetCondition.{0} carrierFunctor)
    (left right : ωCPO)
    (leftValue : left)
    (rightValue : right) :
    fubiniGenerators solution left right
        ((ordinaryMonadOfSolutionSet solution).η.app right rightValue)
        leftValue =
      pairUnitCurried solution left right leftValue rightValue := by
  rw [fubiniGenerators_eq_kleisli]
  exact
    ContinuousHom.congr_fun
      (ordinaryKleisliExtension_unit solution
        (pairUnitCurried solution left right leftValue))
      rightValue

/-- Sequencing a pure unit on the left obeys the explicit left unitor. -/
theorem sequentialFubini_left_unitor
    (solution : SolutionSetCondition.{0} carrierFunctor)
    (object : ωCPO)
    (value : (ordinaryMonadOfSolutionSet solution).obj object) :
    (ordinaryMonadOfSolutionSet solution).map
        (explicitLeftUnitor object)
        (sequentialFubini solution explicitUnit object
          ((ordinaryMonadOfSolutionSet solution).η.app
              explicitUnit PUnit.unit,
            value)) =
      value := by
  calc
    _ =
        (ordinaryMonadOfSolutionSet solution).map
          (explicitLeftUnitor object)
          (fubiniGenerators solution explicitUnit object
            value PUnit.unit) := by
      congr 1
      exact
        sequentialFubini_left_pure solution
          explicitUnit object PUnit.unit value
    _ =
        (ordinaryKleisliExtension solution
          (pairUnitCurried solution explicitUnit object PUnit.unit) ≫
          (ordinaryMonadOfSolutionSet solution).map
            (explicitLeftUnitor object)) value := by
      rw [fubiniGenerators_eq_kleisli]
      rfl
    _ =
        ordinaryKleisliExtension solution
          ((ordinaryMonadOfSolutionSet solution).η.app object)
          value := by
      rw [ordinaryKleisliExtension_post_map,
        pairUnit_leftUnitor]
      rfl
    _ = value := by
      rw [ordinaryKleisliExtension_pure]
      rfl

/-- Sequencing a pure unit on the right obeys the explicit right unitor. -/
theorem sequentialFubini_right_unitor
    (solution : SolutionSetCondition.{0} carrierFunctor)
    (object : ωCPO)
    (value : (ordinaryMonadOfSolutionSet solution).obj object) :
    (ordinaryMonadOfSolutionSet solution).map
        (explicitRightUnitor object)
        (sequentialFubini solution object explicitUnit
          (value,
            (ordinaryMonadOfSolutionSet solution).η.app
              explicitUnit PUnit.unit)) =
      value := by
  rw [sequentialFubini_eq_kleisli]
  change
    (ordinaryKleisliExtension solution
        (fubiniGenerators solution object explicitUnit
          ((ordinaryMonadOfSolutionSet solution).η.app
            explicitUnit PUnit.unit)) ≫
      (ordinaryMonadOfSolutionSet solution).map
        (explicitRightUnitor object)) value =
      value
  rw [ordinaryKleisliExtension_post_map]
  have generatorEq :
      fubiniGenerators solution object explicitUnit
          ((ordinaryMonadOfSolutionSet solution).η.app
            explicitUnit PUnit.unit) ≫
          (ordinaryMonadOfSolutionSet solution).map
            (explicitRightUnitor object) =
        (ordinaryMonadOfSolutionSet solution).η.app object := by
    apply ContinuousHom.ext
    intro objectValue
    calc
      _ =
          (ordinaryMonadOfSolutionSet solution).map
            (explicitRightUnitor object)
            (pairUnitCurried solution object explicitUnit
              objectValue PUnit.unit) := by
        exact
          congrArg
            (fun paired =>
              (ordinaryMonadOfSolutionSet solution).map
                (explicitRightUnitor object) paired)
            (fubiniGenerators_right_pure solution
              object explicitUnit objectValue PUnit.unit)
      _ =
          (ordinaryMonadOfSolutionSet solution).η.app
            object objectValue := by
        exact
          ContinuousHom.congr_fun
            (pairUnit_rightUnitor solution object objectValue)
            PUnit.unit
  rw [generatorEq, ordinaryKleisliExtension_pure]
  rfl

/-! ## Associativity up to explicit reassociation -/

/--
At pure generators, reassociating after pairing agrees with pairing in two
successive stages.
-/
theorem pairUnit_associative
    (solution : SolutionSetCondition.{0} carrierFunctor)
    (first second third : ωCPO)
    (firstValue : first)
    (secondValue : second) :
    pairUnitCurried solution
        (explicitProduct first second) third
        (firstValue, secondValue) ≫
        (ordinaryMonadOfSolutionSet solution).map
          (explicitAssociator first second third) =
      pairUnitCurried solution second third secondValue ≫
        ordinaryKleisliExtension solution
          (pairUnitCurried solution first
            (explicitProduct second third) firstValue) := by
  apply ContinuousHom.ext
  intro thirdValue
  change
    (ordinaryMonadOfSolutionSet solution).map
        (explicitAssociator first second third)
        ((ordinaryMonadOfSolutionSet solution).η.app
          (explicitProduct (explicitProduct first second) third)
          ((firstValue, secondValue), thirdValue)) =
      ordinaryKleisliExtension solution
        (pairUnitCurried solution first
          (explicitProduct second third) firstValue)
        ((ordinaryMonadOfSolutionSet solution).η.app
          (explicitProduct second third)
          (secondValue, thirdValue))
  calc
    _ =
        (ordinaryMonadOfSolutionSet solution).η.app
          (explicitProduct first
            (explicitProduct second third))
          (firstValue, (secondValue, thirdValue)) := by
      exact
        ContinuousHom.congr_fun
          ((ordinaryMonadOfSolutionSet solution).η.naturality
            (explicitAssociator first second third))
          ((firstValue, secondValue), thirdValue) |>.symm
    _ = _ := by
      exact
        (ContinuousHom.congr_fun
          (ordinaryKleisliExtension_unit solution
            (pairUnitCurried solution first
              (explicitProduct second third) firstValue))
          (secondValue, thirdValue)).symm

/-- Associativity after executing the third computation. -/
theorem innerSequential_associative
    (solution : SolutionSetCondition.{0} carrierFunctor)
    (first second third : ωCPO)
    (firstValue : first)
    (secondValue : second) :
    ordinaryKleisliExtension solution
        (pairUnitCurried solution
          (explicitProduct first second) third
          (firstValue, secondValue)) ≫
        (ordinaryMonadOfSolutionSet solution).map
          (explicitAssociator first second third) =
      ordinaryKleisliExtension solution
          (pairUnitCurried solution second third secondValue) ≫
        ordinaryKleisliExtension solution
          (pairUnitCurried solution first
            (explicitProduct second third) firstValue) := by
  rw [ordinaryKleisliExtension_post_map,
    ordinaryKleisliExtension_assoc,
    pairUnit_associative]

/-- Associativity after additionally executing the second computation. -/
theorem middleSequential_associative
    (solution : SolutionSetCondition.{0} carrierFunctor)
    (first second third : ωCPO)
    (firstValue : first)
    (thirdValue :
      (ordinaryMonadOfSolutionSet solution).obj third) :
    ordinaryKleisliExtension solution
        (pairUnitCurried solution first second firstValue) ≫
        ordinaryKleisliExtension solution
          (fubiniGenerators solution
            (explicitProduct first second) third thirdValue) ≫
        (ordinaryMonadOfSolutionSet solution).map
          (explicitAssociator first second third) =
      ordinaryKleisliExtension solution
          (fubiniGenerators solution second third thirdValue) ≫
        ordinaryKleisliExtension solution
          (pairUnitCurried solution first
            (explicitProduct second third) firstValue) := by
  rw [ordinaryKleisliExtension_assoc]
  rw [ordinaryKleisliExtension_post_map]
  rw [ordinaryKleisliExtension_assoc]
  congr 1
  apply ContinuousHom.ext
  intro secondValue
  calc
    _ =
        (fubiniGenerators solution
          (explicitProduct first second) third thirdValue ≫
          (ordinaryMonadOfSolutionSet solution).map
            (explicitAssociator first second third))
          (firstValue, secondValue) := by
      exact
        ContinuousHom.congr_fun
          (ordinaryKleisliExtension_unit solution
            (fubiniGenerators solution
              (explicitProduct first second) third thirdValue ≫
              (ordinaryMonadOfSolutionSet solution).map
                (explicitAssociator first second third)))
          (firstValue, secondValue)
    _ =
        (ordinaryKleisliExtension solution
            (pairUnitCurried solution
              (explicitProduct first second) third
              (firstValue, secondValue)) ≫
          (ordinaryMonadOfSolutionSet solution).map
            (explicitAssociator first second third))
          thirdValue := by
      exact
        congrArg
          (fun computation =>
            (ordinaryMonadOfSolutionSet solution).map
              (explicitAssociator first second third)
              computation)
          (fubiniGenerators_eq_kleisli solution
            (explicitProduct first second) third
            thirdValue (firstValue, secondValue))
    _ =
        (ordinaryKleisliExtension solution
            (pairUnitCurried solution second third secondValue) ≫
          ordinaryKleisliExtension solution
            (pairUnitCurried solution first
              (explicitProduct second third) firstValue))
          thirdValue := by
      exact
        ContinuousHom.congr_fun
          (innerSequential_associative solution
            first second third firstValue secondValue)
          thirdValue
    _ =
        (fubiniGenerators solution second third thirdValue ≫
          ordinaryKleisliExtension solution
            (pairUnitCurried solution first
              (explicitProduct second third) firstValue))
          secondValue := by
      exact
        (congrArg
          (fun computation =>
            ordinaryKleisliExtension solution
              (pairUnitCurried solution first
                (explicitProduct second third) firstValue)
              computation)
          (fubiniGenerators_eq_kleisli solution
            second third thirdValue secondValue)).symm

/-- The two outer generators agree after explicit reassociation. -/
theorem fubiniGenerators_associative
    (solution : SolutionSetCondition.{0} carrierFunctor)
    (first second third : ωCPO)
    (secondValue :
      (ordinaryMonadOfSolutionSet solution).obj second)
    (thirdValue :
      (ordinaryMonadOfSolutionSet solution).obj third) :
    fubiniGenerators solution first second secondValue ≫
        ordinaryKleisliExtension solution
          (fubiniGenerators solution
            (explicitProduct first second) third thirdValue) ≫
        (ordinaryMonadOfSolutionSet solution).map
          (explicitAssociator first second third) =
      fubiniGenerators solution first
        (explicitProduct second third)
        (sequentialFubini solution second third
          (secondValue, thirdValue)) := by
  apply ContinuousHom.ext
  intro firstValue
  change
    (ordinaryKleisliExtension solution
        (pairUnitCurried solution first second firstValue) ≫
      ordinaryKleisliExtension solution
        (fubiniGenerators solution
          (explicitProduct first second) third thirdValue) ≫
      (ordinaryMonadOfSolutionSet solution).map
        (explicitAssociator first second third)) secondValue =
    ordinaryKleisliExtension solution
      (pairUnitCurried solution first
        (explicitProduct second third) firstValue)
      (sequentialFubini solution second third
        (secondValue, thirdValue))
  rw [sequentialFubini_eq_kleisli]
  exact
    ContinuousHom.congr_fun
      (middleSequential_associative solution
        first second third firstValue thirdValue)
      secondValue

/--
Canonical left-to-right sequencing is associative, with the two explicit
product carriers related by `explicitAssociator`.
-/
theorem sequentialFubini_associative
    (solution : SolutionSetCondition.{0} carrierFunctor)
    (first second third : ωCPO)
    (firstValue :
      (ordinaryMonadOfSolutionSet solution).obj first)
    (secondValue :
      (ordinaryMonadOfSolutionSet solution).obj second)
    (thirdValue :
      (ordinaryMonadOfSolutionSet solution).obj third) :
    (ordinaryMonadOfSolutionSet solution).map
        (explicitAssociator first second third)
        (sequentialFubini solution
          (explicitProduct first second) third
          (sequentialFubini solution first second
              (firstValue, secondValue),
            thirdValue)) =
      sequentialFubini solution first
        (explicitProduct second third)
        (firstValue,
          sequentialFubini solution second third
            (secondValue, thirdValue)) := by
  rw [sequentialFubini_eq_kleisli,
    sequentialFubini_eq_kleisli,
    sequentialFubini_eq_kleisli]
  change
    (ordinaryKleisliExtension solution
        (fubiniGenerators solution first second secondValue) ≫
      ordinaryKleisliExtension solution
        (fubiniGenerators solution
          (explicitProduct first second) third thirdValue) ≫
      (ordinaryMonadOfSolutionSet solution).map
        (explicitAssociator first second third)) firstValue =
    ordinaryKleisliExtension solution
      (fubiniGenerators solution first
        (explicitProduct second third)
        (sequentialFubini solution second third
          (secondValue, thirdValue)))
      firstValue
  have arrowEquality :
      (ordinaryKleisliExtension solution
          (fubiniGenerators solution first second secondValue) ≫
        ordinaryKleisliExtension solution
          (fubiniGenerators solution
            (explicitProduct first second) third thirdValue)) ≫
          (ordinaryMonadOfSolutionSet solution).map
            (explicitAssociator first second third) =
        ordinaryKleisliExtension solution
          (fubiniGenerators solution first
            (explicitProduct second third)
            (sequentialFubini solution second third
              (secondValue, thirdValue))) := by
    rw [ordinaryKleisliExtension_assoc]
    rw [ordinaryKleisliExtension_post_map]
    congr 1
    rw [Category.assoc]
    exact
      fubiniGenerators_associative solution
        first second third secondValue thirdValue
  exact ContinuousHom.congr_fun arrowEquality firstValue

/-! ## Multiplication laws which do not require exchange -/

/--
For every fixed right computation, sequential Fubini preserves monad
multiplication in its first (executed-first) argument.
-/
theorem sequentialFubini_left_multiplication
    (solution : SolutionSetCondition.{0} carrierFunctor)
    (left right : ωCPO)
    (leftFamily :
      (ordinaryMonadOfSolutionSet solution).obj
        ((ordinaryMonadOfSolutionSet solution).obj left))
    (rightValue :
      (ordinaryMonadOfSolutionSet solution).obj right) :
    sequentialFubini solution left right
        ((ordinaryMonadOfSolutionSet solution).μ.app left leftFamily,
          rightValue) =
      (ordinaryMonadOfSolutionSet solution).μ.app
        (explicitProduct left right)
        ((ordinaryMonadOfSolutionSet solution).map
          (ordinaryKleisliExtension solution
            (fubiniGenerators solution left right rightValue))
          leftFamily) := by
  rw [sequentialFubini_eq_kleisli]
  exact
    ContinuousHom.congr_fun
      (ordinaryKleisliExtension_multiplication solution
        (fubiniGenerators solution left right rightValue))
      leftFamily

/--
For a pure left value, the inner right-computation strength preserves monad
multiplication.  Extending this equation to an arbitrary effectful left
argument would require an interchange law between the two effect orders.
-/
theorem sequentialFubini_pure_left_right_multiplication
    (solution : SolutionSetCondition.{0} carrierFunctor)
    (left right : ωCPO)
    (leftValue : left)
    (rightFamily :
      (ordinaryMonadOfSolutionSet solution).obj
        ((ordinaryMonadOfSolutionSet solution).obj right)) :
    sequentialFubini solution left right
        ((ordinaryMonadOfSolutionSet solution).η.app left leftValue,
          (ordinaryMonadOfSolutionSet solution).μ.app right rightFamily) =
      (ordinaryMonadOfSolutionSet solution).μ.app
        (explicitProduct left right)
        ((ordinaryMonadOfSolutionSet solution).map
          (ordinaryKleisliExtension solution
            (pairUnitCurried solution left right leftValue))
          rightFamily) := by
  rw [sequentialFubini_left_pure]
  rw [fubiniGenerators_eq_kleisli]
  exact
    ContinuousHom.congr_fun
      (ordinaryKleisliExtension_multiplication solution
        (pairUnitCurried solution left right leftValue))
      rightFamily

/--
The absent symmetric/two-sided multiplication diagram is not silently
postulated: a symmetric Fubini law for this same operation is refuted by the
kernel-checked theorem imported from `CanonicalFubini`.
-/
theorem sequential_two_sided_exchange_requires_new_data
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
          (sequentialFubini solution object object)) :=
  sequentialFubini_not_commutative solution object

end Cantilune.Pi.FMSCpoNondeterministicSequentialCoherence
