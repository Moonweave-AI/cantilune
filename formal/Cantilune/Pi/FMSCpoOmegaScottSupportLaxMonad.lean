import Cantilune.Pi.FMSCpoOmegaScottSupportedMonad
import Cantilune.Pi.FMSCpoOmegaScottStrongCoherence

/-!
# The support-lax lower omega-Scott monad

The exact-support category is the right setting for linear support-preserving
maps, but unrestricted lower/Hoare Fubini is not an exact-support map: pairing
with an empty computation can erase the support of the other branch.  This
file isolates the weaker, still useful category whose maps may erase support
but never introduce it.

The wrapper is deliberately a new object type.  It therefore does not install
a second `Category` instance on `SupportedOmegaCpo`.  On this category the
lower omega-Scott power construction is an actual monad and cartesian Fubini
is a total morphism.  Naturality, symmetry, associativity, preservation of
return, and compatibility with multiplication are proved from the underlying
closed-set equations.

This is not an exact Fubini map for the separated tensor and is not the
pointed Abramsky/FMS powerdomain.
-/

noncomputable section

namespace Cantilune.Pi.FMSCpoOmegaScottSupportLaxMonad

open CategoryTheory
open OmegaCompletePartialOrder
open Cantilune.Pi.FMSCpoFiniteSupportTensor
open Cantilune.Pi.FMSCpoOmegaScottPower
open Cantilune.Pi.FMSCpoOmegaScottStrength
open Cantilune.Pi.FMSCpoOmegaScottStrongCoherence
open Cantilune.Pi.FMSCpoOmegaScottPowerSupport

universe u v

variable
    {Resource : Type u}
    [Fintype Resource]
    [DecidableEq Resource]

/--
A wrapper around a finite-support omega-CPO used to select support-lax
morphisms without changing the exact-support category.
-/
@[ext]
structure SupportLaxOmegaCpo
    (Resource : Type u)
    [DecidableEq Resource] where
  toSupported : SupportedOmegaCpo.{u, v} Resource

namespace SupportLaxOmegaCpo

/-- Underlying carrier of a support-lax object. -/
abbrev Carrier
    (object : SupportLaxOmegaCpo.{u, v} Resource) : Type v :=
  object.toSupported.Carrier

/--
A continuous map which can forget resources but cannot introduce resources.
-/
@[ext]
structure Hom
    (source target : SupportLaxOmegaCpo.{u, v} Resource) where
  toContinuousHom : source.Carrier →𝒄 target.Carrier
  support_subset :
    ∀ value,
      target.toSupported.support (toContinuousHom value) ⊆
        source.toSupported.support value

instance
    {source target : SupportLaxOmegaCpo.{u, v} Resource} :
    CoeFun (Hom source target)
      (fun _ => source.Carrier → target.Carrier) :=
  ⟨fun morphism => morphism.toContinuousHom⟩

/-- Identity support-lax continuous map. -/
def Hom.id
    (object : SupportLaxOmegaCpo.{u, v} Resource) :
    Hom object object where
  toContinuousHom := ContinuousHom.id
  support_subset := fun _ => Finset.Subset.rfl

/-- Composition of support-lax continuous maps. -/
def Hom.comp
    {first second third : SupportLaxOmegaCpo.{u, v} Resource}
    (left : Hom first second)
    (right : Hom second third) :
    Hom first third where
  toContinuousHom :=
    ContinuousHom.comp
      right.toContinuousHom left.toContinuousHom
  support_subset := by
    intro value
    exact
      (right.support_subset (left.toContinuousHom value)).trans
        (left.support_subset value)

@[simp]
theorem Hom.id_apply
    (object : SupportLaxOmegaCpo.{u, v} Resource)
    (value : object.Carrier) :
    Hom.id object value = value :=
  rfl

@[simp]
theorem Hom.comp_apply
    {first second third : SupportLaxOmegaCpo.{u, v} Resource}
    (left : Hom first second)
    (right : Hom second third)
    (value : first.Carrier) :
    left.comp right value = right (left value) :=
  rfl

/-- Support-lax finite-support omega-CPOs form a category. -/
instance : Category (SupportLaxOmegaCpo.{u, v} Resource) where
  Hom := Hom
  id := Hom.id
  comp := Hom.comp
  id_comp := by
    intro first second morphism
    ext value
    rfl
  comp_id := by
    intro first second morphism
    ext value
    rfl
  assoc := by
    intro first second third fourth left middle right
    ext value
    rfl

/-- Regard an exact-support object as a support-lax object. -/
def ofSupported
    (object : SupportedOmegaCpo.{u, v} Resource) :
    SupportLaxOmegaCpo.{u, v} Resource :=
  ⟨object⟩

/-- Every exact-support map is support-lax. -/
def homOfExact
    {source target : SupportedOmegaCpo.{u, v} Resource}
    (morphism : SupportedOmegaCpo.Hom source target) :
    ofSupported source ⟶ ofSupported target where
  toContinuousHom := {
    toFun := fun value => morphism.toContinuousHom value
    monotone' := morphism.toContinuousHom.monotone
    map_ωSup' := morphism.toContinuousHom.continuous
  }
  support_subset := by
    intro value
    change
      target.support (morphism.toContinuousHom value) ⊆
        source.support value
    rw [morphism.support_eq]

end SupportLaxOmegaCpo

open SupportLaxOmegaCpo

/-! ## Cartesian products and the lower omega-Scott monad -/

/-- Cartesian support is the union of the two component supports. -/
def cartesianObject
    (left right : SupportLaxOmegaCpo.{u, v} Resource) :
    SupportLaxOmegaCpo.{u, v} Resource :=
  ofSupported
    (cartesianProduct left.toSupported right.toSupported)

/-- Cartesian action of two support-lax maps. -/
def cartesianMap
    {leftSource leftTarget rightSource rightTarget :
      SupportLaxOmegaCpo.{u, v} Resource}
    (leftMap : leftSource ⟶ leftTarget)
    (rightMap : rightSource ⟶ rightTarget) :
    cartesianObject leftSource rightSource ⟶
      cartesianObject leftTarget rightTarget where
  toContinuousHom :=
    productMap
      leftMap.toContinuousHom rightMap.toContinuousHom
  support_subset := by
    intro value
    exact
      Finset.union_subset_union
        (leftMap.support_subset value.1)
        (rightMap.support_subset value.2)

/-- Lower omega-Scott computations as a support-lax object. -/
def powerObject
    (object : SupportLaxOmegaCpo.{u, v} Resource) :
    SupportLaxOmegaCpo.{u, v} Resource :=
  ofSupported
    (FMSCpoOmegaScottPowerSupport.powerObject object.toSupported)

/--
Direct image along a support-lax map cannot introduce computation support.
-/
theorem powerSupport_mapRaw_subset
    {source target : SupportLaxOmegaCpo.{u, v} Resource}
    (morphism : source ⟶ target)
    (values : OmegaScottPower source.Carrier) :
    powerSupport target.toSupported
        (mapRaw morphism.toContinuousHom values) ⊆
      powerSupport source.toSupported values := by
  apply
    (powerSupport_subset_iff target.toSupported
      (mapRaw morphism.toContinuousHom values)
      (powerSupport source.toSupported values)).2
  apply
    (mapRaw_le_iff morphism.toContinuousHom values
      (supportBound target.toSupported
        (powerSupport source.toSupported values))).2
  intro value valueMember
  change
    target.toSupported.support
        (morphism.toContinuousHom
          (WithOmegaScott.ofOmegaScott value)) ⊆
      powerSupport source.toSupported values
  intro resource resourceMember
  exact
    (mem_powerSupport_iff source.toSupported values resource).2
      ⟨WithOmegaScott.ofOmegaScott value, valueMember,
        morphism.support_subset _ resourceMember⟩

/-- Functorial direct image lifted to support-lax maps. -/
def mapLax
    {source target : SupportLaxOmegaCpo.{u, v} Resource}
    (morphism : source ⟶ target) :
    powerObject source ⟶ powerObject target where
  toContinuousHom := map morphism.toContinuousHom
  support_subset :=
    powerSupport_mapRaw_subset morphism

/-- Lower omega-Scott power as an endofunctor on support-lax maps. -/
def supportLaxPowerFunctor :
    SupportLaxOmegaCpo.{u, v} Resource ⥤
      SupportLaxOmegaCpo.{u, v} Resource where
  obj := powerObject
  map := mapLax
  map_id object := by
    apply SupportLaxOmegaCpo.Hom.ext
    apply ContinuousHom.ext
    intro values
    exact mapRaw_id values
  map_comp first second := by
    apply SupportLaxOmegaCpo.Hom.ext
    apply ContinuousHom.ext
    intro values
    exact
      (mapRaw_comp
        first.toContinuousHom
        second.toContinuousHom
        values).symm

/-- Principal return is natural and exact, hence support-lax. -/
def supportLaxPowerUnit :
    𝟭 (SupportLaxOmegaCpo.{u, v} Resource) ⟶
      supportLaxPowerFunctor (Resource := Resource) where
  app object :=
    homOfExact
      (principalSupported object.toSupported)
  naturality := by
    intro source target morphism
    apply SupportLaxOmegaCpo.Hom.ext
    apply ContinuousHom.ext
    intro value
    exact
      (mapRaw_principal
        morphism.toContinuousHom value).symm

/-- Flattening is natural and exact, hence support-lax. -/
def supportLaxPowerMultiplication :
    supportLaxPowerFunctor (Resource := Resource) ⋙
        supportLaxPowerFunctor (Resource := Resource) ⟶
      supportLaxPowerFunctor (Resource := Resource) where
  app object :=
    homOfExact
      (flattenSupported object.toSupported)
  naturality := by
    intro source target morphism
    apply SupportLaxOmegaCpo.Hom.ext
    apply ContinuousHom.ext
    intro family
    exact
      flattenRaw_mapRaw_natural
        morphism.toContinuousHom family

/-- The lower omega-Scott monad on the support-lax wrapper category. -/
def supportLaxPowerMonad :
    CategoryTheory.Monad
      (SupportLaxOmegaCpo.{u, v} Resource) where
  toFunctor :=
    supportLaxPowerFunctor (Resource := Resource)
  η :=
    supportLaxPowerUnit (Resource := Resource)
  μ :=
    supportLaxPowerMultiplication (Resource := Resource)
  assoc object := by
    apply SupportLaxOmegaCpo.Hom.ext
    apply ContinuousHom.ext
    intro family
    exact flattenRaw_assoc family
  left_unit object := by
    apply SupportLaxOmegaCpo.Hom.ext
    apply ContinuousHom.ext
    intro values
    exact flattenRaw_principal values
  right_unit object := by
    apply SupportLaxOmegaCpo.Hom.ext
    apply ContinuousHom.ext
    intro values
    exact flattenRaw_mapRaw_principal values

/-! ## Total cartesian Fubini and coherence -/

/--
Cartesian lower Fubini is total in the support-lax category.  It may erase
support when either computation has no outcomes, but never introduces it.
-/
def fubiniLax
    (left right : SupportLaxOmegaCpo.{u, v} Resource) :
    cartesianObject (powerObject left) (powerObject right) ⟶
      powerObject (cartesianObject left right) where
  toContinuousHom := fubini
  support_subset := by
    intro values resource resourceMember
    rcases
        (mem_powerSupport_fubiniRaw_iff
          left.toSupported right.toSupported
          values.1 values.2 resource).1
          resourceMember with
      leftMember | rightMember
    · exact Finset.mem_union_left _ leftMember.1
    · exact Finset.mem_union_right _ rightMember.2

/-- Naturality of total support-lax Fubini. -/
theorem fubiniLax_natural
    {leftSource leftTarget rightSource rightTarget :
      SupportLaxOmegaCpo.{u, v} Resource}
    (leftMap : leftSource ⟶ leftTarget)
    (rightMap : rightSource ⟶ rightTarget) :
    (fubiniLax leftSource rightSource).comp
        (mapLax (cartesianMap leftMap rightMap)) =
      (cartesianMap (mapLax leftMap) (mapLax rightMap)).comp
        (fubiniLax leftTarget rightTarget) := by
  apply SupportLaxOmegaCpo.Hom.ext
  apply ContinuousHom.ext
  intro values
  exact
    fubiniRaw_natural
      leftMap.toContinuousHom rightMap.toContinuousHom
      values.1 values.2

/-- Fubini preserves principal return. -/
@[simp]
theorem fubiniLax_principal
    (left : SupportLaxOmegaCpo.{u, v} Resource)
    (right : SupportLaxOmegaCpo.{u, v} Resource)
    (leftValue : left.Carrier)
    (rightValue : right.Carrier) :
    (fubiniLax left right).toContinuousHom
        (principalRaw leftValue, principalRaw rightValue) =
      principalRaw (leftValue, rightValue) :=
  fubiniRaw_principal leftValue rightValue

/-- Fubini is symmetric, up to the ordinary product swap. -/
theorem fubiniLax_swap
    (left : SupportLaxOmegaCpo.{u, v} Resource)
    (right : SupportLaxOmegaCpo.{u, v} Resource)
    (leftValues : OmegaScottPower left.Carrier)
    (rightValues : OmegaScottPower right.Carrier) :
    mapRaw swapMap
        ((fubiniLax left right).toContinuousHom
          (leftValues, rightValues)) =
      (fubiniLax right left).toContinuousHom
        (rightValues, leftValues) :=
  fubiniRaw_swap leftValues rightValues

/-- Fubini is associative, up to the ordinary product associator. -/
theorem fubiniLax_associative
    (first : SupportLaxOmegaCpo.{u, v} Resource)
    (second : SupportLaxOmegaCpo.{u, v} Resource)
    (third : SupportLaxOmegaCpo.{u, v} Resource)
    (firstValues : OmegaScottPower first.Carrier)
    (secondValues : OmegaScottPower second.Carrier)
    (thirdValues : OmegaScottPower third.Carrier) :
    mapRaw associatorMap
        (fubiniRaw
          (fubiniRaw firstValues secondValues)
          thirdValues) =
      fubiniRaw firstValues
        (fubiniRaw secondValues thirdValues) :=
  fubiniRaw_associative firstValues secondValues thirdValues

/-- Fubini commutes with monad multiplication on both inputs. -/
theorem fubiniLax_multiplication
    (left : SupportLaxOmegaCpo.{u, v} Resource)
    (right : SupportLaxOmegaCpo.{u, v} Resource)
    (leftFamily :
      OmegaScottPower (OmegaScottPower left.Carrier))
    (rightFamily :
      OmegaScottPower (OmegaScottPower right.Carrier)) :
    fubiniRaw
        (flattenRaw leftFamily)
        (flattenRaw rightFamily) =
      flattenRaw
        (mapRaw
          (fubini :
            OmegaScottPower left.Carrier ×
                OmegaScottPower right.Carrier →𝒄
              OmegaScottPower
                (left.Carrier × right.Carrier))
          (fubiniRaw leftFamily rightFamily)) :=
  fubiniRaw_flattenRaw leftFamily rightFamily

end Cantilune.Pi.FMSCpoOmegaScottSupportLaxMonad
