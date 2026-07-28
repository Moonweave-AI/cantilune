import Cantilune.Pi.FMSModel
import Mathlib.Data.Fin.Tuple.Basic

/-!
# The finite-injection shift in `ωCPO^I`

This file constructs the FMS allocation shift on the actual mathlib category
of omega-complete partial orders and continuous maps.  It also gives a
concrete hiding map for the support model.  The latter is a theorem about the
support object; it is not the restriction operation of the FMS agent domain.
-/

noncomputable section

namespace Cantilune.Pi.FMSCpoWorld

open CategoryTheory
open OmegaCompletePartialOrder
open Cantilune.Pi.Worlds
open Cantilune.Pi.FMSModel

namespace Injection

/--
Extend a finite injection by one fresh point.  Existing points remain in the
initial segment and the new last point maps to the new last point.
-/
def succ {source target : Nat} (injection : Injection source target) :
    Injection (source + 1) (target + 1) where
  toFun :=
    Fin.snoc
      (fun value => Fin.castSucc (injection value))
      (Fin.last target)
  injective := by
    apply (Fin.snoc_injective_iff).2
    constructor
    · exact (Fin.castSucc_injective target).comp injection.injective
    · intro member
      rcases member with ⟨value, equality⟩
      have valueEquality := congrArg Fin.val equality
      exact
        (Nat.ne_of_lt (injection value).isLt)
          (by simpa using valueEquality)

@[simp]
theorem succ_castSucc
    (injection : Injection source target) (value : Fin source) :
    succ injection (Fin.castSucc value) =
      Fin.castSucc (injection value) := by
  simp [succ]

@[simp]
theorem succ_last (injection : Injection source target) :
    succ injection (Fin.last source) = Fin.last target := by
  simp [succ]

@[simp]
theorem succ_identity (world : Nat) :
    succ (Injection.identity world) =
      Injection.identity (world + 1) := by
  ext value
  cases value using Fin.lastCases <;> simp [succ]

@[simp]
theorem succ_comp
    (left : Injection first second)
    (right : Injection second third) :
    succ (left.comp right) = (succ left).comp (succ right) := by
  ext value
  cases value using Fin.lastCases <;> simp [succ]

end Injection

/-- Add one fresh name to every finite-injection world. -/
def successorWorld : World ⥤ World where
  obj world := world + 1
  map injection := Injection.succ injection
  map_id world := Injection.succ_identity world
  map_comp left right := Injection.succ_comp left right

/-- The standard inclusion of an old world into its one-name extension. -/
def worldUp : 𝟭 World ⟶ successorWorld where
  app world := up world
  naturality := by
    intro source target injection
    apply Cantilune.Pi.Worlds.Injection.ext
    intro value
    change
      Fin.castSucc (homToFun injection value) =
        Injection.succ (asInjection injection) (Fin.castSucc value)
    exact
      (Injection.succ_castSucc (asInjection injection) value).symm

/--
Precomposition by `n ↦ n+1`.  At an object `X : ωCPO^I`,
`shift.obj X` has value `X(n+1)` at world `n`.
-/
def shift : (World ⥤ ωCPO) ⥤ (World ⥤ ωCPO) where
  obj model := successorWorld ⋙ model
  map transformation := Functor.whiskerLeft successorWorld transformation
  map_id model := by
    ext world value
    rfl
  map_comp first second := by
    ext world value
    rfl

/-- Allocation along `up : n ↪ n+1`, natural in the world. -/
def allocate (model : World ⥤ ωCPO) : model ⟶ shift.obj model where
  app world := model.map (worldUp.app world)
  naturality := by
    intro source target injection
    change
      model.map injection ≫ model.map (worldUp.app target) =
        model.map (worldUp.app source) ≫
          model.map (successorWorld.map injection)
    rw [← model.map_comp, ← model.map_comp]
    exact congrArg model.map (worldUp.naturality injection)

@[simp]
theorem allocate_app (model : World ⥤ ωCPO) (world : World)
    (value : model.obj world) :
    (allocate model).app world value = model.map (up world) value :=
  rfl

/-- Forget the last fresh coordinate of a support. -/
def dropFresh (world : World) :
    Set (Fin (world + 1)) → Set (Fin world) :=
  Set.preimage Fin.castSucc

/-- `dropFresh` is monotone for subset order. -/
def dropFreshOrderHom (world : World) :
    Set (Fin (world + 1)) →o Set (Fin world) where
  toFun := dropFresh world
  monotone' := by
    intro left right subset value member
    exact subset member

/-- `dropFresh` preserves suprema of omega chains. -/
theorem dropFresh_map_ωSup (world : World)
    (chain : OmegaCompletePartialOrder.Chain (Set (Fin (world + 1)))) :
    dropFreshOrderHom world (ωSup chain) =
      ωSup (chain.map (dropFreshOrderHom world)) := by
  change
    Set.preimage Fin.castSucc (⋃ index, chain index) =
      ⋃ index, Set.preimage Fin.castSucc (chain index)
  exact Set.preimage_iUnion

/-- Forgetting the fresh coordinate is an actual continuous map. -/
def dropFreshContinuous (world : World) :
    Set (Fin (world + 1)) →𝒄 Set (Fin world) where
  toOrderHom := dropFreshOrderHom world
  map_ωSup' := dropFresh_map_ωSup world

theorem dropFresh_image_succ
    (injection : Injection source target)
    (support : Set (Fin (source + 1))) :
    dropFresh target
        (Injection.succ injection '' support) =
      injection '' dropFresh source support := by
  ext value
  constructor
  · intro member
    rcases member with ⟨preimage, sourceMember, endpoint⟩
    cases preimage using Fin.lastCases with
    | cast old =>
        have oldEndpoint : injection old = value :=
          (Fin.castSucc_injective target) (by simpa using endpoint)
        exact ⟨old, sourceMember, oldEndpoint⟩
    | last =>
        have impossible : Fin.castSucc value = Fin.last target := by
          simpa using endpoint.symm
        exact (Fin.castSucc_ne_last value impossible).elim
  · intro member
    rcases member with ⟨old, sourceMember, endpoint⟩
    exact
      ⟨Fin.castSucc old, sourceMember, by
        simp [endpoint]⟩

/--
A genuine natural transformation `δ support ⟶ support` in `ωCPO^I`.
It removes the distinguished fresh coordinate and commutes with every finite
injection.
-/
def supportHiding : shift.obj cpoAgent ⟶ cpoAgent where
  app world := dropFreshContinuous world
  naturality := by
    intro source target injection
    apply ContinuousHom.ext
    intro support
    exact dropFresh_image_succ injection support

@[simp]
theorem supportHiding_app (world : World)
    (support : Set (Fin (world + 1))) :
    supportHiding.app world support =
      Set.preimage Fin.castSucc support :=
  rfl

end Cantilune.Pi.FMSCpoWorld
