import Mathlib.Order.Category.OmegaCompletePartialOrder
import Cantilune.Pi.Worlds

/-!
# Concrete functor-category models over finite worlds

This module turns the finite-injection presentation from `Pi.Worlds` into an
actual mathlib category.  It then supplies:

* a nonconstant covariant object in `World ⥤ Type`;
* natural inactive and parallel operations on that object;
* dynamic allocation along the standard inclusion `n ⟶ n + 1`; and
* a nonconstant object of `World ⥤ ωCPO`.

The CPO object uses the same world-indexed support carriers as the set model.
Direct image along an injection is proved omega-continuous.  Consequently this
file establishes actual, nonconstant objects in the mathlib functor categories
`Set^I` and `Cpo^I`, but it does not claim to reconstruct the
Fiore--Moggi--Sangiorgi powerdomain, solve a domain equation, or prove full
abstraction.
-/

namespace Cantilune.Pi.FMSModel

open CategoryTheory
open OmegaCompletePartialOrder
open Cantilune.Pi.Worlds

/-- Objects of the finite-injection category are finite ordinal sizes. -/
abbrev World := Nat

/-- The finite-injection category used covariantly by the model. -/
instance worldCategory : Category World where
  Hom source target := Injection source target
  id world := Injection.identity world
  comp left right := left.comp right
  id_comp := by
    intro source target morphism
    exact Injection.identity_comp morphism
  comp_id := by
    intro source target morphism
    exact Injection.comp_identity morphism
  assoc := by
    intro first second third fourth left middle right
    exact Injection.comp_assoc left middle right

/-- Standard inclusion `n ⟶ n + 1`, representing one freshly allocated name. -/
def up (world : World) : world ⟶ world + 1 where
  toFun := fun value => Fin.castSucc value
  injective := Fin.castSucc_injective world

/-- Expose a categorical world arrow as the underlying finite injection. -/
def asInjection {source target : World}
    (injection : source ⟶ target) : Injection source target :=
  injection

/-- Expose a categorical world arrow as its underlying function. -/
def homToFun {source target : World}
    (injection : source ⟶ target) : Fin source → Fin target :=
  (asInjection injection).toFun

@[simp]
theorem homToFun_id (world : World) (value : Fin world) :
    homToFun (𝟙 world) value = value :=
  rfl

@[simp]
theorem homToFun_comp
    {first second third : World}
    (left : first ⟶ second) (right : second ⟶ third)
    (value : Fin first) :
    homToFun (left ≫ right) value =
      homToFun right (homToFun left value) :=
  rfl

/-- The actual covariant name object in the functor category `Set^I`. -/
abbrev name : World ⥤ Type where
  obj world := Fin world
  map injection := TypeCat.ofHom (homToFun injection)
  map_id _ := rfl
  map_comp _ _ := rfl

/-- A nonconstant support object in the actual functor category `Set^I`. -/
abbrev setAgent : World ⥤ Type where
  obj world := Set (Fin world)
  map injection := TypeCat.ofHom (fun support => homToFun injection '' support)
  map_id world := by
    ext support value
    simp
  map_comp left right := by
    ext support value
    constructor
    · rintro ⟨source, sourceMember, endpoint⟩
      exact ⟨homToFun left source, ⟨source, sourceMember, rfl⟩, endpoint⟩
    · rintro ⟨middle, ⟨source, sourceMember, middleEq⟩, endpoint⟩
      subst middle
      exact ⟨source, sourceMember, endpoint⟩

/-- Pointwise terminal object used by the inactive-process operation. -/
abbrev setTerminal : World ⥤ Type where
  obj _ := PUnit
  map _ := TypeCat.ofHom (fun _ => PUnit.unit)
  map_id _ := rfl
  map_comp _ _ := rfl

/-- Explicit pointwise product of the support object with itself. -/
abbrev setAgentProduct : World ⥤ Type where
  obj world := setAgent.obj world × setAgent.obj world
  map injection := TypeCat.ofHom (fun pair =>
    (setAgent.map injection pair.1, setAgent.map injection pair.2)
  )
  map_id world := by
    ext pair <;> simp
  map_comp left right := by
    ext pair <;> simp

/-- The empty support is a natural inactive agent. -/
abbrev inactive : setTerminal ⟶ setAgent where
  app world := TypeCat.ofHom (fun _ : PUnit => (∅ : Set (Fin world)))
  naturality := by
    intro source target injection
    ext input value
    simp

/--
Union is the internal natural parallel operation on the agent object.  It is
not the tensor bifunctor of the surrounding functor category.
-/
abbrev parallel : setAgentProduct ⟶ setAgent where
  app world := TypeCat.ofHom (fun pair :
      Set (Fin world) × Set (Fin world) => pair.1 ∪ pair.2)
  naturality := by
    intro source target injection
    ext pair value
    change
      value ∈
          homToFun injection '' pair.1 ∪
            homToFun injection '' pair.2 ↔
        value ∈ homToFun injection '' (pair.1 ∪ pair.2)
    rw [Set.image_union]

/-- Covariant allocation transports existing support into the extended world. -/
def allocate (world : World) :
    Set (Fin world) → Set (Fin (world + 1)) :=
  fun support => setAgent.map (up world) support

theorem allocate_preserves_membership
    (world : World) (support : Set (Fin world)) (value : Fin world)
    (member : value ∈ support) :
    Fin.castSucc value ∈ allocate world support := by
  exact ⟨value, member, rfl⟩

theorem parallel_natural
    {source target : World} (injection : source ⟶ target)
    (left right : Set (Fin source)) :
    setAgent.map injection (left ∪ right) =
      setAgent.map injection left ∪ setAgent.map injection right := by
  change homToFun injection '' (left ∪ right) =
    homToFun injection '' left ∪ homToFun injection '' right
  exact Set.image_union _ _ _

/-! ## A genuine nonconstant object of `ωCPO^I` -/

/-- Direct image of supports is monotone. -/
def imageOrderHom
    {source target : World} (injection : source ⟶ target) :
    Set (Fin source) →o Set (Fin target) where
  toFun support := homToFun injection '' support
  monotone' := by
    intro left right subset value member
    rcases member with ⟨sourceValue, sourceMember, rfl⟩
    exact ⟨sourceValue, subset sourceMember, rfl⟩

/-- Direct image commutes with suprema of increasing omega-chains. -/
theorem image_map_ωSup
    {source target : World} (injection : source ⟶ target)
    (chain :
      OmegaCompletePartialOrder.Chain (Set (Fin source))) :
    imageOrderHom injection
        (OmegaCompletePartialOrder.ωSup chain) =
      OmegaCompletePartialOrder.ωSup
        (chain.map (imageOrderHom injection)) := by
  change
    homToFun injection '' (⋃ n, chain n) =
      ⋃ n, homToFun injection '' chain n
  exact Set.image_iUnion

/-- Direct image bundled as an actual omega-continuous morphism. -/
def imageContinuous
    {source target : World} (injection : source ⟶ target) :
    Set (Fin source) →𝒄 Set (Fin target) where
  toOrderHom := imageOrderHom injection
  map_ωSup' := image_map_ωSup injection

/--
The nonconstant covariant CPO-valued support model.  World injections are
interpreted by omega-continuous direct image, not by unbundled functions.
-/
def cpoAgent : World ⥤ ωCPO where
  obj world := ωCPO.of (Set (Fin world))
  map injection := imageContinuous injection
  map_id world := by
    apply ContinuousHom.ext
    intro support
    change homToFun (𝟙 world) '' support = support
    ext value
    simp
  map_comp left right := by
    apply ContinuousHom.ext
    intro support
    ext value
    constructor
    · rintro ⟨sourceValue, sourceMember, endpoint⟩
      exact
        ⟨homToFun left sourceValue,
          ⟨sourceValue, sourceMember, rfl⟩, endpoint⟩
    · rintro ⟨middleValue, ⟨sourceValue, sourceMember, middleEq⟩,
        endpoint⟩
      subst middleValue
      exact ⟨sourceValue, sourceMember, endpoint⟩

theorem cpo_map_apply
    {source target : World} (injection : source ⟶ target)
    (support : Set (Fin source)) :
    cpoAgent.map injection support =
      homToFun injection '' support :=
  rfl

end Cantilune.Pi.FMSModel
