import Cantilune.Pi.FMSCpoOmegaScottSupportLaxMonad
import Cantilune.Pi.FMSCpoOmegaScottChosenCoherence
import Mathlib.CategoryTheory.Monoidal.NaturalTransformation
import Mathlib.CategoryTheory.Monoidal.Braided.Basic

/-!
# Cartesian symmetric monoidal packaging of the support-lax power monad

Support-lax maps may discard finite support but may not introduce it.  This
closure condition is stable under cartesian products whose support is the
union of the two component supports.  The resulting category therefore has
an actual mathlib `MonoidalCategory` and `SymmetricCategory` structure.

The lower omega-Scott functor is lax braided for this cartesian tensor:
principal return supplies the unit comparison and cartesian Fubini supplies
the tensor comparison.  Both the monad unit and multiplication are monoidal
natural transformations.  This is the standard categorical package of a
commutative monoidal monad.

The result is deliberately scoped to the support-lax wrapper.  It is not a
Fubini map on the exact separated tensor, and it does not identify the lower
omega-Scott monad with the pointed Abramsky/FMS powerdomain.
-/

noncomputable section

namespace Cantilune.Pi.FMSCpoOmegaScottSupportLaxMonoidal

open CategoryTheory
open CategoryTheory.Category
open CategoryTheory.MonoidalCategory
open CategoryTheory.BraidedCategory
open CategoryTheory.Functor
open OmegaCompletePartialOrder
open Cantilune.Pi.FMSCpoFiniteSupportTensor
open Cantilune.Pi.FMSCpoFiniteSupportTensor.Separated
open Cantilune.Pi.FMSCpoOmegaScottPower
open Cantilune.Pi.FMSCpoOmegaScottStrength
open Cantilune.Pi.FMSCpoOmegaScottChosenCoherence
open Cantilune.Pi.FMSCpoOmegaScottSupportLaxMonad

universe u v

variable
    (Resource : Type u)
    [Fintype Resource]
    [DecidableEq Resource]

/-! ## Cartesian structural maps -/

/-- The empty-support singleton is the cartesian tensor unit. -/
def cartesianUnitObject :
    SupportLaxOmegaCpo.{u, v} Resource :=
  SupportLaxOmegaCpo.ofSupported
    (Separated.unit (Resource := Resource))

/-- Forward cartesian reassociation. -/
def cartesianAssociatorHom
    (first second third : SupportLaxOmegaCpo.{u, v} Resource) :
    cartesianObject (cartesianObject first second) third ⟶
      cartesianObject first (cartesianObject second third) where
  toContinuousHom := associatorMap
  support_subset := by
    intro value
    change
      first.toSupported.support value.1.1 ∪
          (second.toSupported.support value.1.2 ∪
            third.toSupported.support value.2) ⊆
        (first.toSupported.support value.1.1 ∪
          second.toSupported.support value.1.2) ∪
            third.toSupported.support value.2
    rw [Finset.union_assoc]

/-- Inverse cartesian reassociation. -/
def cartesianAssociatorInv
    (first second third : SupportLaxOmegaCpo.{u, v} Resource) :
    cartesianObject first (cartesianObject second third) ⟶
      cartesianObject (cartesianObject first second) third where
  toContinuousHom :=
    ContinuousHom.ofFun fun value =>
      ((value.1, value.2.1), value.2.2)
  support_subset := by
    intro value
    change
      (first.toSupported.support value.1 ∪
          second.toSupported.support value.2.1) ∪
            third.toSupported.support value.2.2 ⊆
        first.toSupported.support value.1 ∪
          (second.toSupported.support value.2.1 ∪
            third.toSupported.support value.2.2)
    rw [Finset.union_assoc]

/-- Cartesian associativity as an isomorphism in the support-lax category. -/
def cartesianAssociator
    (first second third : SupportLaxOmegaCpo.{u, v} Resource) :
    cartesianObject (cartesianObject first second) third ≅
      cartesianObject first (cartesianObject second third) where
  hom := cartesianAssociatorHom Resource first second third
  inv := cartesianAssociatorInv Resource first second third
  hom_inv_id := by
    apply SupportLaxOmegaCpo.Hom.ext
    apply ContinuousHom.ext
    intro value
    rfl
  inv_hom_id := by
    apply SupportLaxOmegaCpo.Hom.ext
    apply ContinuousHom.ext
    intro value
    rfl

/-- Projection from the left cartesian unit. -/
def cartesianLeftUnitorHom
    (object : SupportLaxOmegaCpo.{u, v} Resource) :
    cartesianObject (cartesianUnitObject Resource) object ⟶ object where
  toContinuousHom := ContinuousHom.ofFun Prod.snd
  support_subset := by
    intro value
    change
      object.toSupported.support value.2 ⊆
        ∅ ∪ object.toSupported.support value.2
    simp

/-- Insertion of the left cartesian unit. -/
def cartesianLeftUnitorInv
    (object : SupportLaxOmegaCpo.{u, v} Resource) :
    object ⟶ cartesianObject (cartesianUnitObject Resource) object where
  toContinuousHom :=
    ContinuousHom.ofFun fun value => (PUnit.unit, value)
  support_subset := by
    intro value
    change
      ∅ ∪ object.toSupported.support value ⊆
        object.toSupported.support value
    simp

/-- Left cartesian unitor. -/
def cartesianLeftUnitor
    (object : SupportLaxOmegaCpo.{u, v} Resource) :
    cartesianObject (cartesianUnitObject Resource) object ≅ object where
  hom := cartesianLeftUnitorHom Resource object
  inv := cartesianLeftUnitorInv Resource object
  hom_inv_id := by
    apply SupportLaxOmegaCpo.Hom.ext
    apply ContinuousHom.ext
    intro value
    cases value.1
    rfl
  inv_hom_id := by
    apply SupportLaxOmegaCpo.Hom.ext
    apply ContinuousHom.ext
    intro value
    rfl

/-- Projection from the right cartesian unit. -/
def cartesianRightUnitorHom
    (object : SupportLaxOmegaCpo.{u, v} Resource) :
    cartesianObject object (cartesianUnitObject Resource) ⟶ object where
  toContinuousHom := ContinuousHom.ofFun Prod.fst
  support_subset := by
    intro value
    change
      object.toSupported.support value.1 ⊆
        object.toSupported.support value.1 ∪ ∅
    simp

/-- Insertion of the right cartesian unit. -/
def cartesianRightUnitorInv
    (object : SupportLaxOmegaCpo.{u, v} Resource) :
    object ⟶ cartesianObject object (cartesianUnitObject Resource) where
  toContinuousHom :=
    ContinuousHom.ofFun fun value => (value, PUnit.unit)
  support_subset := by
    intro value
    change
      object.toSupported.support value ∪ ∅ ⊆
        object.toSupported.support value
    simp

/-- Right cartesian unitor. -/
def cartesianRightUnitor
    (object : SupportLaxOmegaCpo.{u, v} Resource) :
    cartesianObject object (cartesianUnitObject Resource) ≅ object where
  hom := cartesianRightUnitorHom Resource object
  inv := cartesianRightUnitorInv Resource object
  hom_inv_id := by
    apply SupportLaxOmegaCpo.Hom.ext
    apply ContinuousHom.ext
    intro value
    cases value.2
    rfl
  inv_hom_id := by
    apply SupportLaxOmegaCpo.Hom.ext
    apply ContinuousHom.ext
    intro value
    rfl

/-- Cartesian swap cannot introduce support. -/
def cartesianBraidingHom
    (left right : SupportLaxOmegaCpo.{u, v} Resource) :
    cartesianObject left right ⟶ cartesianObject right left where
  toContinuousHom := swapMap
  support_subset := by
    intro value
    change
      right.toSupported.support value.2 ∪
          left.toSupported.support value.1 ⊆
        left.toSupported.support value.1 ∪
          right.toSupported.support value.2
    rw [Finset.union_comm]

/-- Cartesian swap is an involutive isomorphism. -/
def cartesianBraiding
    (left right : SupportLaxOmegaCpo.{u, v} Resource) :
    cartesianObject left right ≅ cartesianObject right left where
  hom := cartesianBraidingHom Resource left right
  inv := cartesianBraidingHom Resource right left
  hom_inv_id := by
    apply SupportLaxOmegaCpo.Hom.ext
    apply ContinuousHom.ext
    intro value
    rfl
  inv_hom_id := by
    apply SupportLaxOmegaCpo.Hom.ext
    apply ContinuousHom.ext
    intro value
    rfl

/-! ## Actual mathlib symmetric monoidal instances -/

/-- Cartesian product/support union as mathlib's monoidal structure. -/
instance supportLaxMonoidalStruct :
    MonoidalCategoryStruct
      (SupportLaxOmegaCpo.{u, v} Resource) where
  tensorObj := cartesianObject
  whiskerLeft := fun object {_ _} morphism =>
    cartesianMap (𝟙 object) morphism
  whiskerRight := fun {_ _} morphism object =>
    cartesianMap morphism (𝟙 object)
  tensorHom := cartesianMap
  tensorUnit := cartesianUnitObject Resource
  associator := cartesianAssociator Resource
  leftUnitor := cartesianLeftUnitor Resource
  rightUnitor := cartesianRightUnitor Resource

/-- Complete pentagon/triangle coherence for the cartesian tensor. -/
instance supportLaxMonoidalCategory :
    MonoidalCategory
      (SupportLaxOmegaCpo.{u, v} Resource) :=
  MonoidalCategory.ofTensorHom
    (C := SupportLaxOmegaCpo.{u, v} Resource)
    (by
      intro left right
      apply SupportLaxOmegaCpo.Hom.ext
      apply ContinuousHom.ext
      intro value
      rfl)
    (by
      intro left source target morphism
      rfl)
    (by
      intro source target morphism right
      rfl)
    (by
      intro left₁ middle₁ right₁
        left₂ middle₂ right₂
        first₁ first₂ second₁ second₂
      apply SupportLaxOmegaCpo.Hom.ext
      apply ContinuousHom.ext
      intro value
      rfl)
    (by
      intro first₁ second₁ third₁
        first₂ second₂ third₂
        firstMap secondMap thirdMap
      apply SupportLaxOmegaCpo.Hom.ext
      apply ContinuousHom.ext
      intro value
      rfl)
    (by
      intro first second morphism
      apply SupportLaxOmegaCpo.Hom.ext
      apply ContinuousHom.ext
      intro value
      rfl)
    (by
      intro first second morphism
      apply SupportLaxOmegaCpo.Hom.ext
      apply ContinuousHom.ext
      intro value
      rfl)
    (by
      intro first second third fourth
      apply SupportLaxOmegaCpo.Hom.ext
      apply ContinuousHom.ext
      intro value
      rfl)
    (by
      intro first second
      apply SupportLaxOmegaCpo.Hom.ext
      apply ContinuousHom.ext
      intro value
      rfl)

/-- The cartesian support-lax monoidal category is symmetric. -/
instance supportLaxSymmetricCategory :
    SymmetricCategory
      (SupportLaxOmegaCpo.{u, v} Resource) where
  braiding := cartesianBraiding Resource
  braiding_naturality_right := by
    intro left source target morphism
    apply SupportLaxOmegaCpo.Hom.ext
    apply ContinuousHom.ext
    intro value
    rfl
  braiding_naturality_left := by
    intro source target morphism right
    apply SupportLaxOmegaCpo.Hom.ext
    apply ContinuousHom.ext
    intro value
    rfl
  hexagon_forward := by
    intro first second third
    apply SupportLaxOmegaCpo.Hom.ext
    apply ContinuousHom.ext
    intro value
    rfl
  hexagon_reverse := by
    intro first second third
    apply SupportLaxOmegaCpo.Hom.ext
    apply ContinuousHom.ext
    intro value
    rfl
  symmetry := by
    intro left right
    apply SupportLaxOmegaCpo.Hom.ext
    apply ContinuousHom.ext
    intro value
    rfl

/-! ## Fubini as a lax braided monoidal functor -/

/-- Universe-pinned spelling of the support-lax power endofunctor. -/
abbrev supportLaxPowerEndofunctor :
    SupportLaxOmegaCpo.{u, v} Resource ⥤
      SupportLaxOmegaCpo.{u, v} Resource :=
  supportLaxPowerFunctor (Resource := Resource)

/-- Universe-pinned spelling of principal return. -/
abbrev supportLaxPowerUnitNatural :
    𝟭 (SupportLaxOmegaCpo.{u, v} Resource) ⟶
      supportLaxPowerEndofunctor Resource :=
  supportLaxPowerUnit (Resource := Resource)

/-- Universe-pinned spelling of flattening. -/
abbrev supportLaxPowerMultiplicationNatural :
    supportLaxPowerEndofunctor Resource ⋙
        supportLaxPowerEndofunctor Resource ⟶
      supportLaxPowerEndofunctor Resource :=
  supportLaxPowerMultiplication (Resource := Resource)

/-- Principal return at the tensor unit is the lax monoidal unit comparison. -/
def supportLaxPowerTensorUnit :
    𝟙_ (SupportLaxOmegaCpo.{u, v} Resource) ⟶
      (supportLaxPowerFunctor (Resource := Resource)).obj
        (𝟙_ (SupportLaxOmegaCpo.{u, v} Resource)) :=
  (supportLaxPowerUnit (Resource := Resource)).app _

/-- Explicit associativity diagram for cartesian support-lax Fubini. -/
theorem fubiniLax_associativity_morphism
    (first second third :
      SupportLaxOmegaCpo.{u, v} Resource) :
    cartesianMap
          (fubiniLax first second)
          (𝟙 (powerObject third)) ≫
        fubiniLax (cartesianObject first second) third ≫
        mapLax
          (cartesianAssociatorHom Resource first second third) =
      cartesianAssociatorHom Resource
          (powerObject first) (powerObject second)
          (powerObject third) ≫
        cartesianMap
          (𝟙 (powerObject first))
          (fubiniLax second third) ≫
        fubiniLax first (cartesianObject second third) := by
  apply SupportLaxOmegaCpo.Hom.ext
  apply ContinuousHom.ext
  intro values
  change
    mapRaw associatorMap
        (fubiniRaw
          (fubiniRaw values.1.1 values.1.2)
          values.2) =
      fubiniRaw values.1.1
        (fubiniRaw values.1.2 values.2)
  exact
    fubiniLax_associative first second third
      values.1.1 values.1.2 values.2

/-- Explicit left-unit diagram for cartesian support-lax Fubini. -/
theorem fubiniLax_left_unitality_morphism
    (object : SupportLaxOmegaCpo.{u, v} Resource) :
    cartesianLeftUnitorHom Resource (powerObject object) =
      cartesianMap
          (supportLaxPowerTensorUnit Resource)
          (𝟙 (powerObject object)) ≫
        fubiniLax (cartesianUnitObject Resource) object ≫
        mapLax (cartesianLeftUnitorHom Resource object) := by
  apply SupportLaxOmegaCpo.Hom.ext
  apply ContinuousHom.ext
  intro values
  change
    values.2 =
      mapRaw
        (cartesianLeftUnitorHom Resource object).toContinuousHom
        (fubiniRaw
          (principalRaw values.1) values.2)
  exact
    (fubiniRaw_left_unitor values.1 values.2).symm

/-- Explicit right-unit diagram for cartesian support-lax Fubini. -/
theorem fubiniLax_right_unitality_morphism
    (object : SupportLaxOmegaCpo.{u, v} Resource) :
    cartesianRightUnitorHom Resource (powerObject object) =
      cartesianMap
          (𝟙 (powerObject object))
          (supportLaxPowerTensorUnit Resource) ≫
        fubiniLax object (cartesianUnitObject Resource) ≫
        mapLax (cartesianRightUnitorHom Resource object) := by
  apply SupportLaxOmegaCpo.Hom.ext
  apply ContinuousHom.ext
  intro values
  change
    values.1 =
      mapRaw
        (cartesianRightUnitorHom Resource object).toContinuousHom
        (fubiniRaw values.1
          (principalRaw values.2))
  exact
    (fubiniRaw_right_unitor values.1 values.2).symm

/-- Explicit symmetry diagram for cartesian support-lax Fubini. -/
theorem fubiniLax_braided_morphism
    (left right :
      SupportLaxOmegaCpo.{u, v} Resource) :
    fubiniLax left right ≫
        mapLax (cartesianBraidingHom Resource left right) =
      cartesianBraidingHom Resource
          (powerObject left) (powerObject right) ≫
        fubiniLax right left := by
  apply SupportLaxOmegaCpo.Hom.ext
  apply ContinuousHom.ext
  intro values
  change
    mapRaw swapMap
        (fubiniRaw values.1 values.2) =
      fubiniRaw values.2 values.1
  exact fubiniLax_swap left right values.1 values.2

/--
The lower omega-Scott power functor is lax monoidal for cartesian Fubini.
-/
instance supportLaxPowerFunctorLaxMonoidal :
    (supportLaxPowerEndofunctor Resource).LaxMonoidal :=
  Functor.LaxMonoidal.ofTensorHom
    (supportLaxPowerTensorUnit Resource)
    fubiniLax
    (by
      intro leftSource leftTarget rightSource rightTarget
        leftMap rightMap
      exact (fubiniLax_natural leftMap rightMap).symm)
    (by
      intro first second third
      change
        cartesianMap
              (fubiniLax first second)
              (𝟙 (powerObject third)) ≫
            fubiniLax (cartesianObject first second) third ≫
            mapLax
              (cartesianAssociatorHom Resource
                first second third) =
          cartesianAssociatorHom Resource
              (powerObject first) (powerObject second)
              (powerObject third) ≫
            cartesianMap
              (𝟙 (powerObject first))
              (fubiniLax second third) ≫
            fubiniLax first
              (cartesianObject second third)
      exact
        fubiniLax_associativity_morphism Resource
          first second third)
    (by
      intro object
      change
        cartesianLeftUnitorHom Resource (powerObject object) =
          cartesianMap
              (supportLaxPowerTensorUnit Resource)
              (𝟙 (powerObject object)) ≫
            fubiniLax (cartesianUnitObject Resource) object ≫
            mapLax
              (cartesianLeftUnitorHom Resource object)
      exact
        fubiniLax_left_unitality_morphism Resource object)
    (by
      intro object
      change
        cartesianRightUnitorHom Resource (powerObject object) =
          cartesianMap
              (𝟙 (powerObject object))
              (supportLaxPowerTensorUnit Resource) ≫
            fubiniLax object (cartesianUnitObject Resource) ≫
            mapLax
              (cartesianRightUnitorHom Resource object)
      exact
        fubiniLax_right_unitality_morphism Resource object)

/-- Cartesian Fubini is compatible with the symmetric braiding. -/
instance supportLaxPowerFunctorLaxBraided :
    (supportLaxPowerEndofunctor Resource).LaxBraided where
  braided left right := by
    change
      fubiniLax left right ≫
          mapLax (cartesianBraidingHom Resource left right) =
        cartesianBraidingHom Resource
            (powerObject left) (powerObject right) ≫
          fubiniLax right left
    exact fubiniLax_braided_morphism Resource left right

/-! ## Monad unit and multiplication are monoidal -/

/-- Principal return is a monoidal natural transformation. -/
instance supportLaxPowerUnitIsMonoidal :
    NatTrans.IsMonoidal
      (supportLaxPowerUnitNatural Resource) where
  unit := by
    apply SupportLaxOmegaCpo.Hom.ext
    apply ContinuousHom.ext
    intro value
    rfl
  tensor left right := by
    apply SupportLaxOmegaCpo.Hom.ext
    apply ContinuousHom.ext
    intro value
    exact
      fubiniLax_principal left right value.1 value.2 |>.symm

/-- Flattening is a monoidal natural transformation. -/
instance supportLaxPowerMultiplicationIsMonoidal :
    NatTrans.IsMonoidal
      (supportLaxPowerMultiplicationNatural Resource) where
  unit := by
    apply SupportLaxOmegaCpo.Hom.ext
    apply ContinuousHom.ext
    intro value
    exact flattenRaw_mapRaw_principal (principalRaw value)
  tensor left right := by
    apply SupportLaxOmegaCpo.Hom.ext
    apply ContinuousHom.ext
    intro values
    exact
      (fubiniLax_multiplication left right
        values.1 values.2).symm

/--
Stable combined certificate: the support-lax lower omega-Scott monad has a
lax braided functor structure and monoidal unit and multiplication.
-/
theorem supportLaxPower_commutativeMonoidalMonad :
    Nonempty
        ((supportLaxPowerEndofunctor Resource).LaxBraided) ∧
      NatTrans.IsMonoidal
        (supportLaxPowerUnitNatural Resource) ∧
      NatTrans.IsMonoidal
        (supportLaxPowerMultiplicationNatural Resource) :=
  ⟨⟨inferInstance⟩, inferInstance, inferInstance⟩

/-- Stable exposure of the actual symmetric monoidal typeclass instances. -/
theorem supportLax_omegaCpo_smc :
    Nonempty
        (MonoidalCategory
          (SupportLaxOmegaCpo.{u, v} Resource)) ∧
      Nonempty
        (SymmetricCategory
          (SupportLaxOmegaCpo.{u, v} Resource)) :=
  ⟨⟨inferInstance⟩, ⟨inferInstance⟩⟩

end Cantilune.Pi.FMSCpoOmegaScottSupportLaxMonoidal
