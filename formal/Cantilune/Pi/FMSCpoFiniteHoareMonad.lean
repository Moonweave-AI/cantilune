import Cantilune.Pi.FMSCpoFiniteHoarePower
import Mathlib.CategoryTheory.ObjectProperty.FullSubcategory

/-!
# The finite Hoare monad and its continuous Kleisli extension

The nonempty lower-set construction from `FMSCpoFiniteHoarePower` is closed
under finite omega-CPOs.  This file packages that construction as an actual
`CategoryTheory.Monad` on the full subcategory of finite objects in mathlib's
`ωCPO` and proves the corresponding Kleisli equations.  Its functor, unit,
and multiplication are all genuine omega-Scott-continuous maps.

This closes the functoriality, multiplication naturality, multiplication
associativity, unit, and finite Kleisli-coherence obligations for this exact
finite subcategory.  It deliberately does not add an empty lower set or a
separate divergence element.  Consequently it is not an Abramsky
powerdomain on all omega-CPOs and does not inhabit `CpoPowerdomainPackage`.
-/

noncomputable section

namespace Cantilune.Pi.FMSCpoFiniteHoareMonad

open CategoryTheory
open OmegaCompletePartialOrder
open Cantilune.Pi.FMSCpoFiniteHoarePower
open Cantilune.Pi.FMSCpoFiniteStrictPower

universe u

/-! ## Continuous Kleisli extension on finite bases -/

/--
Kleisli extension is union over all generators in the input lower set.
Monotonicity of the continuation is needed for the monadic interpretation,
while lower closure of each returned Hoare value proves that the result is
again lower.
-/
def bindRaw
    {α β : Type u}
    [PartialOrder α] [PartialOrder β]
    (function : α → HoarePower β) (_monotone : Monotone function)
    (values : HoarePower α) :
    HoarePower β :=
  ⟨{ target |
      ∃ source ∈ carrier values, target ∈ carrier (function source) }, by
    constructor
    · rcases values.property.1 with ⟨source, sourceMember⟩
      rcases (function source).property.1 with ⟨target, targetMember⟩
      exact ⟨target, source, sourceMember, targetMember⟩
    · intro upper lower
      rintro ⟨source, sourceMember, upperMember⟩ lowerLe
      exact
        ⟨source, sourceMember,
          (function source).property.2 upperMember lowerLe⟩⟩

theorem bindRaw_monotone
    {α β : Type u}
    [PartialOrder α] [PartialOrder β]
    (function : α → HoarePower β) (monotone : Monotone function) :
    Monotone (bindRaw function monotone : HoarePower α → HoarePower β) := by
  intro left right subset target
  rintro ⟨source, sourceMember, targetMember⟩
  exact ⟨source, subset sourceMember, targetMember⟩

/-- Kleisli extension is an actual continuous map whenever the source is finite. -/
def bind
    {α β : Type u}
    [PartialOrder α] [PartialOrder β] [Finite α]
    (function : α → HoarePower β) (monotone : Monotone function) :
    hoareCpo α ⟶ hoareCpo β :=
  continuousOfFiniteMonotone
    (bindRaw function monotone)
    (bindRaw_monotone function monotone)

@[simp]
theorem bind_apply
    {α β : Type u}
    [PartialOrder α] [PartialOrder β] [Finite α]
    (function : α → HoarePower β) (monotone : Monotone function)
    (values : HoarePower α) :
    bind function monotone values = bindRaw function monotone values :=
  rfl

/-- Kleisli extension is multiplication after lower direct image. -/
theorem bindRaw_eq_flatten_mapRaw
    {α β : Type u}
    [PartialOrder α] [PartialOrder β]
    (function : α → HoarePower β) (monotone : Monotone function)
    (values : HoarePower α) :
    bindRaw function monotone values =
      flattenRaw (mapRaw function monotone values) := by
  apply Subtype.ext
  ext target
  constructor
  · rintro ⟨source, sourceMember, targetMember⟩
    exact
      ⟨function source,
        ⟨source, sourceMember, le_rfl⟩,
        targetMember⟩
  · rintro ⟨member, ⟨source, sourceMember, memberSubset⟩,
      targetMember⟩
    exact ⟨source, sourceMember, memberSubset targetMember⟩

/-- The principal lower set is the left unit of Kleisli extension. -/
theorem bindRaw_principal
    {α β : Type u}
    [PartialOrder α] [PartialOrder β]
    (function : α → HoarePower β) (monotone : Monotone function)
    (value : α) :
    bindRaw function monotone (principalRaw value) = function value := by
  apply Subtype.ext
  ext target
  constructor
  · rintro ⟨source, sourceLe, targetMember⟩
    exact monotone sourceLe targetMember
  · intro targetMember
    exact ⟨value, le_rfl, targetMember⟩

/-- The principal embedding is the right unit of Kleisli extension. -/
theorem bindRaw_principal_right
    {α : Type u} [PartialOrder α]
    (values : HoarePower α) :
    bindRaw principalRaw principalRaw_monotone values = values := by
  apply Subtype.ext
  ext target
  constructor
  · rintro ⟨source, sourceMember, targetLe⟩
    exact values.property.2 sourceMember targetLe
  · intro targetMember
    exact ⟨target, targetMember, le_rfl⟩

/-- The continuation appearing on the right of Kleisli associativity is monotone. -/
theorem bindRaw_continuation_monotone
    {α β γ : Type u}
    [PartialOrder α] [PartialOrder β] [PartialOrder γ]
    (first : α → HoarePower β) (second : β → HoarePower γ)
    (firstMonotone : Monotone first)
    (secondMonotone : Monotone second) :
    Monotone (fun value => bindRaw second secondMonotone (first value)) :=
  (bindRaw_monotone second secondMonotone).comp firstMonotone

/-- Exact one-step Kleisli associativity, with no weak closure. -/
theorem bindRaw_assoc
    {α β γ : Type u}
    [PartialOrder α] [PartialOrder β] [PartialOrder γ]
    (first : α → HoarePower β) (second : β → HoarePower γ)
    (firstMonotone : Monotone first)
    (secondMonotone : Monotone second)
    (values : HoarePower α) :
    bindRaw second secondMonotone
        (bindRaw first firstMonotone values) =
      bindRaw
        (fun value => bindRaw second secondMonotone (first value))
        (bindRaw_continuation_monotone
          first second firstMonotone secondMonotone)
        values := by
  apply Subtype.ext
  ext target
  constructor
  · rintro
      ⟨middle, ⟨source, sourceMember, middleMember⟩, targetMember⟩
    exact
      ⟨source, sourceMember,
        ⟨middle, middleMember, targetMember⟩⟩
  · rintro
      ⟨source, sourceMember,
        ⟨middle, middleMember, targetMember⟩⟩
    exact
      ⟨middle,
        ⟨source, sourceMember, middleMember⟩,
        targetMember⟩

/-- Hoare choice in the input distributes through Kleisli extension. -/
theorem bindRaw_choice
    {α β : Type u}
    [PartialOrder α] [PartialOrder β]
    (function : α → HoarePower β) (monotone : Monotone function)
    (left right : HoarePower α) :
    bindRaw function monotone (choiceRaw (left, right)) =
      choiceRaw
        (bindRaw function monotone left,
          bindRaw function monotone right) := by
  apply Subtype.ext
  ext target
  constructor
  · rintro ⟨source, sourceMember, targetMember⟩
    rcases sourceMember with inLeft | inRight
    · exact Or.inl ⟨source, inLeft, targetMember⟩
    · exact Or.inr ⟨source, inRight, targetMember⟩
  · intro targetMember
    rcases targetMember with inLeft | inRight
    · rcases inLeft with ⟨source, sourceMember, member⟩
      exact ⟨source, Or.inl sourceMember, member⟩
    · rcases inRight with ⟨source, sourceMember, member⟩
      exact ⟨source, Or.inr sourceMember, member⟩

/-- Pointwise Hoare choice of continuations distributes through Kleisli extension. -/
theorem bindRaw_pointwise_choice
    {α β : Type u}
    [PartialOrder α] [PartialOrder β]
    (left right : α → HoarePower β)
    (leftMonotone : Monotone left)
    (rightMonotone : Monotone right)
    (values : HoarePower α) :
    bindRaw
        (fun value => choiceRaw (left value, right value))
        (fun source target ordered member memberProof => by
          rcases memberProof with inLeft | inRight
          · exact Or.inl (leftMonotone ordered inLeft)
          · exact Or.inr (rightMonotone ordered inRight))
        values =
      choiceRaw
        (bindRaw left leftMonotone values,
          bindRaw right rightMonotone values) := by
  apply Subtype.ext
  ext target
  constructor
  · rintro ⟨source, sourceMember, targetMember⟩
    rcases targetMember with inLeft | inRight
    · exact Or.inl ⟨source, sourceMember, inLeft⟩
    · exact Or.inr ⟨source, sourceMember, inRight⟩
  · intro targetMember
    rcases targetMember with inLeft | inRight
    · rcases inLeft with ⟨source, sourceMember, member⟩
      exact ⟨source, sourceMember, Or.inl member⟩
    · rcases inRight with ⟨source, sourceMember, member⟩
      exact ⟨source, sourceMember, Or.inr member⟩

/-! ## Raw multiplication coherence -/

/-- Lower direct image commutes with Hoare multiplication. -/
theorem flattenRaw_mapRaw_natural
    {α β : Type u}
    [PartialOrder α] [PartialOrder β]
    (function : α → β) (monotone : Monotone function)
    (family : HoarePower (HoarePower α)) :
    flattenRaw
        (mapRaw
          (mapRaw function monotone)
          (mapRaw_monotone function monotone)
          family) =
      mapRaw function monotone (flattenRaw family) := by
  apply Subtype.ext
  ext target
  constructor
  · rintro
      ⟨mappedMember,
        ⟨member, memberInFamily, mappedSubset⟩,
        targetInMappedMember⟩
    rcases mappedSubset targetInMappedMember with
      ⟨sourceValue, sourceInMember, targetLe⟩
    exact
      ⟨sourceValue,
        ⟨member, memberInFamily, sourceInMember⟩,
        targetLe⟩
  · rintro
      ⟨sourceValue,
        ⟨member, memberInFamily, sourceInMember⟩,
        targetLe⟩
    exact
      ⟨mapRaw function monotone member,
        ⟨member, memberInFamily, le_rfl⟩,
        ⟨sourceValue, sourceInMember, targetLe⟩⟩

/-- Hoare multiplication is associative before any categorical packaging. -/
theorem flattenRaw_assoc
    {α : Type u} [PartialOrder α]
    (family : HoarePower (HoarePower (HoarePower α))) :
    flattenRaw
        (mapRaw flattenRaw flattenRaw_monotone family) =
      flattenRaw (flattenRaw family) := by
  apply Subtype.ext
  ext value
  constructor
  · rintro
      ⟨flattenedSubfamily,
        ⟨subfamily, subfamilyInFamily, flattenedSubset⟩,
        valueInFlattenedSubfamily⟩
    rcases flattenedSubset valueInFlattenedSubfamily with
      ⟨member, memberInSubfamily, valueInMember⟩
    exact
      ⟨member,
        ⟨subfamily, subfamilyInFamily, memberInSubfamily⟩,
        valueInMember⟩
  · rintro
      ⟨member,
        ⟨subfamily, subfamilyInFamily, memberInSubfamily⟩,
        valueInMember⟩
    exact
      ⟨flattenRaw subfamily,
        ⟨subfamily, subfamilyInFamily, le_rfl⟩,
        ⟨member, memberInSubfamily, valueInMember⟩⟩

/-! ## A genuine continuous monad on finite omega-CPOs -/

/-- The full subcategory of mathlib omega-CPOs with finite carriers. -/
def finiteCpoProperty : ObjectProperty ωCPO.{u} :=
  fun object => Finite object

/-- Finite omega-CPOs and genuine continuous maps. -/
abbrev FiniteCPO :=
  finiteCpoProperty.FullSubcategory

instance finiteCpoFinite (object : FiniteCPO.{u}) :
    Finite object.obj :=
  object.property

/-- The nonempty lower-set omega-CPO of a finite omega-CPO. -/
def hoareObject (object : FiniteCPO.{u}) : FiniteCPO.{u} :=
  ⟨hoareCpo object.obj,
    show Finite (HoarePower object.obj) from inferInstance⟩

/-- Continuous lower direct image inside the finite omega-CPO subcategory. -/
def hoareMap
    {source target : FiniteCPO.{u}}
    (morphism : source ⟶ target) :
    hoareObject source ⟶ hoareObject target :=
  ObjectProperty.homMk
    (map morphism.hom morphism.hom.monotone)

/-- Nonempty lower sets form a continuous endofunctor on finite omega-CPOs. -/
def finiteHoareFunctor : FiniteCPO.{u} ⥤ FiniteCPO.{u} where
  obj := hoareObject
  map := hoareMap
  map_id object := by
    apply ObjectProperty.hom_ext
    apply ContinuousHom.ext
    intro values
    apply Subtype.ext
    ext target
    constructor
    · rintro ⟨source, sourceMember, targetLe⟩
      exact values.property.2 sourceMember targetLe
    · intro targetMember
      exact ⟨target, targetMember, le_rfl⟩
  map_comp first second := by
    apply ObjectProperty.hom_ext
    apply ContinuousHom.ext
    intro values
    apply Subtype.ext
    ext target
    constructor
    · rintro ⟨source, sourceMember, targetLe⟩
      exact
        ⟨first.hom source,
          ⟨source, sourceMember, le_rfl⟩,
          targetLe⟩
    · rintro
        ⟨middle, ⟨source, sourceMember, middleLe⟩, targetLe⟩
      exact
        ⟨source, sourceMember,
          le_trans targetLe (second.hom.monotone middleLe)⟩

/-- The actual continuous principal embedding is the unit transformation. -/
def finiteHoareUnit : 𝟭 FiniteCPO.{u} ⟶ finiteHoareFunctor where
  app object :=
    ObjectProperty.homMk principal
  naturality := by
    intro source target morphism
    apply ObjectProperty.hom_ext
    apply ContinuousHom.ext
    intro value
    exact
      (mapRaw_principal
        morphism.hom morphism.hom.monotone value).symm

/-- The actual continuous flattening map is the multiplication transformation. -/
def finiteHoareMultiplication :
    finiteHoareFunctor ⋙ finiteHoareFunctor ⟶ finiteHoareFunctor where
  app object :=
    ObjectProperty.homMk flatten
  naturality := by
    intro source target morphism
    apply ObjectProperty.hom_ext
    apply ContinuousHom.ext
    intro family
    exact
      flattenRaw_mapRaw_natural
        morphism.hom morphism.hom.monotone family

/--
The genuine nonempty Hoare monad on the full subcategory of finite
omega-CPOs.  All components and all morphisms are actual continuous maps.
-/
def finiteHoareMonad : CategoryTheory.Monad FiniteCPO.{u} where
  toFunctor := finiteHoareFunctor
  η := finiteHoareUnit
  μ := finiteHoareMultiplication
  assoc object := by
    apply ObjectProperty.hom_ext
    apply ContinuousHom.ext
    intro family
    exact flattenRaw_assoc family
  left_unit object := by
    apply ObjectProperty.hom_ext
    apply ContinuousHom.ext
    intro values
    exact flatten_principal values
  right_unit object := by
    apply ObjectProperty.hom_ext
    apply ContinuousHom.ext
    intro values
    exact flatten_mapRaw_principal values

/-- Categorical Kleisli extension for the finite continuous Hoare monad. -/
def kleisliExtension
    {source target : FiniteCPO.{u}}
    (function : source ⟶ hoareObject target) :
    hoareObject source ⟶ hoareObject target :=
  finiteHoareFunctor.map function ≫
    finiteHoareMultiplication.app target

/--
The categorical extension computes exactly the witness-level `bindRaw`;
there is no additional closure or observational quotient.
-/
theorem kleisliExtension_apply
    {source target : FiniteCPO.{u}}
    (function : source ⟶ hoareObject target)
    (values : HoarePower source.obj) :
    kleisliExtension function values =
      bindRaw function.hom function.hom.monotone values := by
  exact
    (bindRaw_eq_flatten_mapRaw
      function.hom function.hom.monotone values).symm

@[simp]
theorem finiteHoareMonad_unit_apply
    (object : FiniteCPO.{u}) (value : object.obj) :
    finiteHoareMonad.η.app object value = principalRaw value :=
  rfl

@[simp]
theorem finiteHoareMonad_multiplication_apply
    (object : FiniteCPO.{u})
    (family : HoarePower (HoarePower object.obj)) :
    finiteHoareMonad.μ.app object family = flattenRaw family :=
  rfl

end Cantilune.Pi.FMSCpoFiniteHoareMonad
