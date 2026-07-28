import Cantilune.Pi.FMSCpoOmegaScottDeltaCoherence
import Cantilune.Pi.NominalFiniteSupport

/-!
# Nominal alpha-coherence for double dynamic allocation

Two successive allocations create two fresh coordinates.  Their exchange law
must not identify the coordinates literally: it is witnessed by the finite
permutation that swaps the two newest names and fixes the complete old world.

This file constructs that permutation as a natural involution of the double
successor functor, lifts it to a continuous natural automorphism of
`shift ⋙ shift` on `World ⥤ ωCPO`, and proves the allocation exchange square.

The result is a genuine alpha-isomorphism, not equality of generated names.
It is independent of the choice of FMS powerdomain and does not claim
agent-level restriction or full abstraction.
-/

noncomputable section

namespace Cantilune.Pi.FMSCpoNominalDeltaCoherence

open CategoryTheory
open OmegaCompletePartialOrder
open Cantilune.Pi.Worlds
open Cantilune.Pi.FMSModel
open Cantilune.Pi.FMSCpoWorld
open Cantilune.Pi.NominalFiniteSupport

/-- The first of the two newest coordinates in `world + 1 + 1`. -/
def penultimateFresh (world : World) :
    Fin ((world + 1) + 1) :=
  Fin.castSucc (Fin.last world)

/-- The second of the two newest coordinates in `world + 1 + 1`. -/
def ultimateFresh (world : World) :
    Fin ((world + 1) + 1) :=
  Fin.last (world + 1)

/--
The alpha permutation exchanging the two newest coordinates and fixing the
old initial segment.
-/
def lastTwoSwap (world : World) :
    ((world + 1) + 1 : World) ⟶ ((world + 1) + 1 : World) :=
  freshSwap (penultimateFresh world) (ultimateFresh world)

@[simp]
theorem lastTwoSwap_penultimate (world : World) :
    homToFun (lastTwoSwap world) (penultimateFresh world) =
      ultimateFresh world :=
  freshSwap_first _ _

@[simp]
theorem lastTwoSwap_ultimate (world : World) :
    homToFun (lastTwoSwap world) (ultimateFresh world) =
      penultimateFresh world :=
  freshSwap_second _ _

@[simp]
theorem lastTwoSwap_old
    (world : World) (name : Fin world) :
    homToFun (lastTwoSwap world)
        (Fin.castSucc (Fin.castSucc name)) =
      Fin.castSucc (Fin.castSucc name) := by
  apply Equiv.swap_apply_of_ne_of_ne
  · intro equality
    have equality' :
        Fin.castSucc name = Fin.last world :=
      Fin.castSucc_injective (world + 1) equality
    exact Fin.castSucc_ne_last name equality'
  · intro equality
    exact
      Fin.castSucc_ne_last (Fin.castSucc name) equality

/-- Double successor of a finite-world injection as a categorical arrow. -/
def doubleSucc
    {source target : World}
    (injection : source ⟶ target) :
    ((source + 1) + 1 : World) ⟶
      ((target + 1) + 1 : World) :=
  Injection.succ (Injection.succ (asInjection injection))

@[simp]
theorem doubleSucc_old
    {source target : World}
    (injection : source ⟶ target)
    (name : Fin source) :
    homToFun (doubleSucc injection)
        (Fin.castSucc (Fin.castSucc name)) =
      Fin.castSucc (Fin.castSucc (homToFun injection name)) := by
  change
    Injection.succ (Injection.succ (asInjection injection))
        (Fin.castSucc (Fin.castSucc name)) =
      Fin.castSucc (Fin.castSucc (asInjection injection name))
  rw [Injection.succ_castSucc, Injection.succ_castSucc]

@[simp]
theorem doubleSucc_penultimate
    {source target : World}
    (injection : source ⟶ target) :
    homToFun (doubleSucc injection) (penultimateFresh source) =
      penultimateFresh target := by
  change
    Injection.succ (Injection.succ (asInjection injection))
        (Fin.castSucc (Fin.last source)) =
      Fin.castSucc (Fin.last target)
  rw [Injection.succ_castSucc, Injection.succ_last]

@[simp]
theorem doubleSucc_ultimate
    {source target : World}
    (injection : source ⟶ target) :
    homToFun (doubleSucc injection) (ultimateFresh source) =
      ultimateFresh target := by
  change
    Injection.succ (Injection.succ (asInjection injection))
        (Fin.last (source + 1)) =
      Fin.last (target + 1)
  rw [Injection.succ_last]

/--
The last-two swap is natural with respect to every finite-world injection.
-/
theorem lastTwoSwap_natural
    {source target : World}
    (injection : source ⟶ target) :
    doubleSucc injection ≫ lastTwoSwap target =
      lastTwoSwap source ≫ doubleSucc injection := by
  apply Injection.ext
  intro name
  change
    homToFun (lastTwoSwap target)
        (homToFun (doubleSucc injection) name) =
      homToFun (doubleSucc injection)
        (homToFun (lastTwoSwap source) name)
  cases name using Fin.lastCases with
  | cast previous =>
      cases previous using Fin.lastCases with
      | cast old =>
          rw [doubleSucc_old, lastTwoSwap_old, lastTwoSwap_old,
            doubleSucc_old]
      | last =>
          change
            homToFun (lastTwoSwap target)
                (homToFun (doubleSucc injection)
                  (penultimateFresh source)) =
              homToFun (doubleSucc injection)
                (homToFun (lastTwoSwap source)
                  (penultimateFresh source))
          rw [doubleSucc_penultimate, lastTwoSwap_penultimate,
            lastTwoSwap_penultimate, doubleSucc_ultimate]
  | last =>
      change
        homToFun (lastTwoSwap target)
            (homToFun (doubleSucc injection) (ultimateFresh source)) =
          homToFun (doubleSucc injection)
            (homToFun (lastTwoSwap source) (ultimateFresh source))
      rw [doubleSucc_ultimate, lastTwoSwap_ultimate,
        lastTwoSwap_ultimate, doubleSucc_penultimate]

/-- Swapping the two newest names is involutive. -/
@[simp]
theorem lastTwoSwap_involutive (world : World) :
    lastTwoSwap world ≫ lastTwoSwap world =
      𝟙 ((world + 1) + 1 : World) := by
  change
    (asInjection (lastTwoSwap world)).comp
        (asInjection (lastTwoSwap world)) =
      Injection.identity ((world + 1) + 1)
  exact freshSwap_involutive _ _

@[simp]
theorem up_succ_old
    (world : World) (name : Fin world) :
    homToFun (up (world + 1)) (Fin.castSucc name) =
      Fin.castSucc (Fin.castSucc name) :=
  rfl

@[simp]
theorem up_succ_last (world : World) :
    homToFun (up (world + 1)) (Fin.last world) =
      penultimateFresh world :=
  rfl

@[simp]
theorem successor_up_old
    (world : World) (name : Fin world) :
    homToFun (successorWorld.map (up world))
        (Fin.castSucc name) =
      Fin.castSucc (Fin.castSucc name) := by
  change
    Injection.succ (asInjection (up world)) (Fin.castSucc name) =
      Fin.castSucc (Fin.castSucc name)
  rw [Injection.succ_castSucc]
  rfl

@[simp]
theorem successor_up_last (world : World) :
    homToFun (successorWorld.map (up world)) (Fin.last world) =
      ultimateFresh world := by
  change
    Injection.succ (asInjection (up world)) (Fin.last world) =
      Fin.last (world + 1)
  rw [Injection.succ_last]

/--
The canonical inclusion into `world + 2`, followed by the alpha swap, is the
successor of the first inclusion.  This is the combinatorial allocation
exchange square.
-/
theorem up_comp_lastTwoSwap (world : World) :
    up (world + 1) ≫ lastTwoSwap world =
      successorWorld.map (up world) := by
  apply Injection.ext
  intro name
  change
    homToFun (lastTwoSwap world)
        (homToFun (up (world + 1)) name) =
      homToFun (successorWorld.map (up world)) name
  cases name using Fin.lastCases with
  | cast old =>
      rw [up_succ_old, lastTwoSwap_old, successor_up_old]
  | last =>
      rw [up_succ_last, lastTwoSwap_penultimate, successor_up_last]

/-- The inverse orientation of the combinatorial allocation square. -/
theorem succ_up_comp_lastTwoSwap (world : World) :
    successorWorld.map (up world) ≫
        lastTwoSwap world =
      up (world + 1) := by
  change
    (Injection.succ (asInjection (up world))).comp
        (asInjection (lastTwoSwap world)) =
      asInjection (up (world + 1))
  apply Injection.ext
  intro name
  cases name using Fin.lastCases with
  | cast old =>
      change
        homToFun (lastTwoSwap world)
            (Injection.succ (asInjection (up world))
              (Fin.castSucc old)) =
          Fin.castSucc (Fin.castSucc old)
      rw [Injection.succ_castSucc]
      change
        homToFun (lastTwoSwap world)
            (Fin.castSucc (Fin.castSucc old)) =
          Fin.castSucc (Fin.castSucc old)
      exact lastTwoSwap_old world old
  | last =>
      change
        homToFun (lastTwoSwap world)
            (Injection.succ (asInjection (up world))
              (Fin.last world)) =
          penultimateFresh world
      rw [Injection.succ_last]
      change
        homToFun (lastTwoSwap world) (ultimateFresh world) =
          penultimateFresh world
      exact lastTwoSwap_ultimate world

/-- The last-two swap as a natural involution of the double successor. -/
def doubleSuccessorSwap :
    successorWorld ⋙ successorWorld ⟶
      successorWorld ⋙ successorWorld where
  app world := lastTwoSwap world
  naturality := by
    intro source target injection
    exact lastTwoSwap_natural injection

/-- The world-level double-allocation alpha isomorphism. -/
def doubleSuccessorAlphaIso :
    successorWorld ⋙ successorWorld ≅
      successorWorld ⋙ successorWorld where
  hom := doubleSuccessorSwap
  inv := doubleSuccessorSwap
  hom_inv_id := by
    apply NatTrans.ext
    funext world
    exact lastTwoSwap_involutive world
  inv_hom_id := by
    apply NatTrans.ext
    funext world
    exact lastTwoSwap_involutive world

/-! ## Lift to `ωCPO^I` -/

/-- The continuous alpha action on two shifted copies of one world model. -/
def doubleShiftAlpha
    (model : World ⥤ ωCPO) :
    (shift ⋙ shift).obj model ⟶
      (shift ⋙ shift).obj model where
  app world := model.map (lastTwoSwap world)
  naturality := by
    intro source target injection
    change
      model.map (doubleSucc injection) ≫
          model.map (lastTwoSwap target) =
        model.map (lastTwoSwap source) ≫
          model.map (doubleSucc injection)
    rw [← model.map_comp, ← model.map_comp]
    congr 1
    exact lastTwoSwap_natural injection

/--
Double-shift alpha is natural not only in the world but also in the complete
world-indexed omega-CPO model.
-/
def doubleShiftAlphaHom :
    shift ⋙ shift ⟶ shift ⋙ shift where
  app model := doubleShiftAlpha model
  naturality := by
    intro source target transformation
    ext world value
    exact
      (ContinuousHom.congr_fun
        (transformation.naturality (lastTwoSwap world))
        value).symm

/-- The continuous-natural alpha automorphism of double allocation. -/
def doubleShiftAlphaIso :
    shift ⋙ shift ≅ shift ⋙ shift where
  hom := doubleShiftAlphaHom
  inv := doubleShiftAlphaHom
  hom_inv_id := by
    apply NatTrans.ext
    funext model
    apply NatTrans.ext
    funext world
    change
      model.map (lastTwoSwap world) ≫
          model.map (lastTwoSwap world) =
        𝟙 _
    rw [← model.map_comp]
    have square :
        (lastTwoSwap world :
            ((world + 1) + 1) ⟶ ((world + 1) + 1)) ≫
            lastTwoSwap world =
          𝟙 ((world + 1) + 1) := by
      exact lastTwoSwap_involutive world
    rw [square]
    exact model.map_id _
  inv_hom_id := by
    apply NatTrans.ext
    funext model
    apply NatTrans.ext
    funext world
    change
      model.map (lastTwoSwap world) ≫
          model.map (lastTwoSwap world) =
        𝟙 _
    rw [← model.map_comp]
    have square :
        (lastTwoSwap world :
            ((world + 1) + 1) ⟶ ((world + 1) + 1)) ≫
            lastTwoSwap world =
          𝟙 ((world + 1) + 1) := by
      exact lastTwoSwap_involutive world
    rw [square]
    exact model.map_id _

/--
The two canonical allocations commute up to the last-two-name alpha
automorphism.  No literal equality of the fresh representatives is asserted.
-/
theorem allocation_alpha_exchange
    (model : World ⥤ ωCPO) :
    shift.map (allocate model) ≫
        doubleShiftAlphaIso.hom.app model =
      allocate (shift.obj model) := by
  apply NatTrans.ext
  funext world
  change
    model.map (up (world + 1)) ≫
        model.map (lastTwoSwap world) =
      model.map (successorWorld.map (up world))
  rw [← model.map_comp]
  congr 1
  exact up_comp_lastTwoSwap world

/-- The inverse orientation of the same alpha exchange square. -/
theorem allocation_alpha_exchange_inverse
    (model : World ⥤ ωCPO) :
    allocate (shift.obj model) ≫
        doubleShiftAlphaIso.hom.app model =
      shift.map (allocate model) := by
  apply NatTrans.ext
  funext world
  change
    model.map (successorWorld.map (up world)) ≫
        model.map (lastTwoSwap world) =
      model.map (up (world + 1))
  rw [← model.map_comp]
  congr 1
  exact succ_up_comp_lastTwoSwap world

end Cantilune.Pi.FMSCpoNominalDeltaCoherence
