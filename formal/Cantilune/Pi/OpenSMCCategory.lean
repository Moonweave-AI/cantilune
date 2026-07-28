import Cantilune.Pi.OpenSMC
import Mathlib.CategoryTheory.Monoidal.Braided.Basic

/-!
# Mathlib category instance for typed open pi presentations

`OpenSMC.Laws` is exposed here through the actual mathlib `Category`,
`MonoidalCategory`, and `SymmetricCategory` interfaces.  The object wrapper
retains the type environment as an index, preventing instances for different
environments from collapsing onto the same list type.
-/

namespace Cantilune.Pi.OpenSMCCategory

open CategoryTheory
open CategoryTheory.Category
open CategoryTheory.MonoidalCategory
open CategoryTheory.BraidedCategory
open Cantilune.Pi.OpenSMC

/-- An ordered typed boundary in one fixed type environment. -/
structure Object (Γ : TypeEnv) where
  boundary : Interface
  deriving DecidableEq, Repr

instance category (Γ : TypeEnv) : Category (Object Γ) where
  Hom X Y := Hom Γ X.boundary Y.boundary
  id X := Hom.identity Γ X.boundary
  comp := Hom.plugHide
  id_comp := Hom.plug_id_left
  comp_id := Hom.plug_id_right
  assoc := Hom.plug_assoc

@[simp]
theorem category_id_eq (Γ : TypeEnv) (X : Object Γ) :
    (𝟙 X : X ⟶ X) = Hom.identity Γ X.boundary :=
  rfl

@[simp]
theorem category_comp_eq {Γ : TypeEnv} {X Y Z : Object Γ}
    (first : X ⟶ Y) (second : Y ⟶ Z) :
    first ≫ second = Hom.plugHide first second :=
  rfl

instance monoidalStruct (Γ : TypeEnv) :
    MonoidalCategoryStruct (Object Γ) where
  tensorObj X Y := ⟨X.boundary ++ Y.boundary⟩
  whiskerLeft := fun X {_ _} f =>
    Hom.parallel (Hom.identity Γ X.boundary) f
  whiskerRight := fun {_ _} f Y =>
    Hom.parallel f (Hom.identity Γ Y.boundary)
  tensorHom := Hom.parallel
  tensorUnit := ⟨[]⟩
  associator X Y Z :=
    { hom := Hom.associator Γ X.boundary Y.boundary Z.boundary
      inv := Hom.associatorInv Γ X.boundary Y.boundary Z.boundary
      hom_inv_id :=
        Hom.associator_hom_inv Γ X.boundary Y.boundary Z.boundary
      inv_hom_id :=
        Hom.associator_inv_hom Γ X.boundary Y.boundary Z.boundary }
  leftUnitor X :=
    { hom := Hom.leftUnitor Γ X.boundary
      inv := Hom.leftUnitorInv Γ X.boundary
      hom_inv_id := Hom.leftUnitor_hom_inv Γ X.boundary
      inv_hom_id := Hom.leftUnitor_inv_hom Γ X.boundary }
  rightUnitor X :=
    { hom := Hom.rightUnitor Γ X.boundary
      inv := Hom.rightUnitorInv Γ X.boundary
      hom_inv_id := Hom.rightUnitor_hom_inv Γ X.boundary
      inv_hom_id := Hom.rightUnitor_inv_hom Γ X.boundary }

/-- The presented quotient is a genuine mathlib monoidal category. -/
instance monoidalCategory (Γ : TypeEnv) :
    MonoidalCategory (Object Γ) :=
  MonoidalCategory.ofTensorHom
    (C := Object Γ)
    (by
      intro X Y
      change
        Hom.parallel
            (Hom.identity Γ X.boundary)
            (Hom.identity Γ Y.boundary) =
          Hom.identity Γ (X.boundary ++ Y.boundary)
      exact Hom.tensor_id Γ X.boundary Y.boundary)
    (by
      intro X Y₁ Y₂ f
      rfl)
    (by
      intro X₁ X₂ f Y
      rfl)
    (by
      intro X₁ Y₁ Z₁ X₂ Y₂ Z₂ f₁ f₂ g₁ g₂
      change
        Hom.plugHide
            (Hom.parallel f₁ f₂)
            (Hom.parallel g₁ g₂) =
          Hom.parallel
            (Hom.plugHide f₁ g₁)
            (Hom.plugHide f₂ g₂)
      exact Hom.tensor_comp f₁ g₁ f₂ g₂)
    (by
      intro X₁ X₂ X₃ Y₁ Y₂ Y₃ f₁ f₂ f₃
      change
        Hom.plugHide
            (Hom.parallel (Hom.parallel f₁ f₂) f₃)
            (Hom.associator Γ Y₁.boundary Y₂.boundary Y₃.boundary) =
          Hom.plugHide
            (Hom.associator Γ X₁.boundary X₂.boundary X₃.boundary)
            (Hom.parallel f₁ (Hom.parallel f₂ f₃))
      exact Hom.associator_natural f₁ f₂ f₃)
    (by
      intro X Y f
      change
        Hom.plugHide
            (Hom.parallel (Hom.identity Γ []) f)
            (Hom.leftUnitor Γ Y.boundary) =
          Hom.plugHide (Hom.leftUnitor Γ X.boundary) f
      exact Hom.leftUnitor_natural f)
    (by
      intro X Y f
      change
        Hom.plugHide
            (Hom.parallel f (Hom.identity Γ []))
            (Hom.rightUnitor Γ Y.boundary) =
          Hom.plugHide (Hom.rightUnitor Γ X.boundary) f
      exact Hom.rightUnitor_natural f)
    (by
      intro W X Y Z
      change
        Hom.plugHide
            (Hom.parallel
              (Hom.associator Γ W.boundary X.boundary Y.boundary)
              (Hom.identity Γ Z.boundary))
            (Hom.plugHide
              (Hom.associator Γ W.boundary
                (X.boundary ++ Y.boundary) Z.boundary)
              (Hom.parallel
                (Hom.identity Γ W.boundary)
                (Hom.associator Γ X.boundary Y.boundary Z.boundary))) =
          Hom.plugHide
            (Hom.associator Γ
              (W.boundary ++ X.boundary) Y.boundary Z.boundary)
            (Hom.associator Γ W.boundary X.boundary
              (Y.boundary ++ Z.boundary))
      rw [← Hom.plug_assoc]
      exact
        (Hom.pentagon Γ W.boundary X.boundary Y.boundary Z.boundary).symm)
    (by
      intro X Y
      change
        Hom.plugHide
            (Hom.associator Γ X.boundary [] Y.boundary)
            (Hom.parallel
              (Hom.identity Γ X.boundary)
              (Hom.leftUnitor Γ Y.boundary)) =
          Hom.parallel
            (Hom.rightUnitor Γ X.boundary)
            (Hom.identity Γ Y.boundary)
      exact (Hom.triangle Γ X.boundary Y.boundary).symm)

def braidingIso (Γ : TypeEnv) (X Y : Object Γ) :
    X ⊗ Y ≅ Y ⊗ X where
  hom := Hom.braid Γ X.boundary Y.boundary
  inv := Hom.braid Γ Y.boundary X.boundary
  hom_inv_id := Hom.symmetry Γ X.boundary Y.boundary
  inv_hom_id := Hom.symmetry Γ Y.boundary X.boundary

/-- The open-process presentation is a genuine symmetric monoidal category. -/
instance symmetricCategory (Γ : TypeEnv) :
    SymmetricCategory (Object Γ) where
  braiding := braidingIso Γ
  braiding_naturality_right := by
    intro X Y Z f
    change
      Hom.plugHide
          (Hom.parallel (Hom.identity Γ X.boundary) f)
          (Hom.braid Γ X.boundary Z.boundary) =
        Hom.plugHide
          (Hom.braid Γ X.boundary Y.boundary)
          (Hom.parallel f (Hom.identity Γ X.boundary))
    exact Hom.braid_natural (Hom.identity Γ X.boundary) f
  braiding_naturality_left := by
    intro X Y f Z
    change
      Hom.plugHide
          (Hom.parallel f (Hom.identity Γ Z.boundary))
          (Hom.braid Γ Y.boundary Z.boundary) =
        Hom.plugHide
          (Hom.braid Γ X.boundary Z.boundary)
          (Hom.parallel (Hom.identity Γ Z.boundary) f)
    exact Hom.braid_natural f (Hom.identity Γ Z.boundary)
  hexagon_forward := by
    intro X Y Z
    change
      Hom.plugHide
          (Hom.associator Γ X.boundary Y.boundary Z.boundary)
          (Hom.plugHide
            (Hom.braid Γ X.boundary (Y.boundary ++ Z.boundary))
            (Hom.associator Γ Y.boundary Z.boundary X.boundary)) =
        Hom.plugHide
          (Hom.parallel
            (Hom.braid Γ X.boundary Y.boundary)
            (Hom.identity Γ Z.boundary))
          (Hom.plugHide
            (Hom.associator Γ Y.boundary X.boundary Z.boundary)
            (Hom.parallel
              (Hom.identity Γ Y.boundary)
              (Hom.braid Γ X.boundary Z.boundary)))
    simpa only [Hom.plug_assoc] using
      Hom.hexagon Γ X.boundary Y.boundary Z.boundary
  hexagon_reverse := by
    intro X Y Z
    let leftIso :
        (Z ⊗ X) ⊗ Y ≅ X ⊗ (Y ⊗ Z) :=
      (α_ Z X Y) ≪≫
        braidingIso Γ Z (X ⊗ Y) ≪≫
          (α_ X Y Z)
    let rightIso :
        (Z ⊗ X) ⊗ Y ≅ X ⊗ (Y ⊗ Z) :=
      (braidingIso Γ Z X ⊗ᵢ Iso.refl Y) ≪≫
        (α_ X Z Y) ≪≫
          (Iso.refl X ⊗ᵢ braidingIso Γ Z Y)
    have homEquality : leftIso.hom = rightIso.hom := by
      dsimp [leftIso, rightIso]
      change
        Hom.plugHide
            (Hom.associator Γ Z.boundary X.boundary Y.boundary)
            (Hom.plugHide
              (Hom.braid Γ Z.boundary
                (X.boundary ++ Y.boundary))
              (Hom.associator Γ X.boundary Y.boundary Z.boundary)) =
          Hom.plugHide
            (Hom.parallel
              (Hom.braid Γ Z.boundary X.boundary)
              (Hom.identity Γ Y.boundary))
            (Hom.plugHide
              (Hom.associator Γ X.boundary Z.boundary Y.boundary)
              (Hom.parallel
                (Hom.identity Γ X.boundary)
                (Hom.braid Γ Z.boundary Y.boundary)))
      simpa only [Hom.plug_assoc] using
        Hom.hexagon Γ Z.boundary X.boundary Y.boundary
    have inverseEquality : leftIso.inv = rightIso.inv :=
      (Iso.inv_eq_inv leftIso rightIso).2 homEquality
    dsimp [leftIso, rightIso, braidingIso] at inverseEquality
    simp only [Iso.trans_inv, tensorIso_inv, Iso.refl_inv] at inverseEquality
    rw [id_tensorHom, tensorHom_id] at inverseEquality
    rw [Category.assoc, Category.assoc] at inverseEquality
    simpa [braidingIso] using inverseEquality
  symmetry := by
    intro X Y
    change
      Hom.plugHide
          (Hom.braid Γ X.boundary Y.boundary)
          (Hom.braid Γ Y.boundary X.boundary) =
        Hom.identity Γ (X.boundary ++ Y.boundary)
    exact Hom.symmetry Γ X.boundary Y.boundary

/-- Stable theorem exposing the actual typeclass instances. -/
theorem open_pi_mathlib_smc (Γ : TypeEnv) :
    Nonempty (MonoidalCategory (Object Γ)) ∧
      Nonempty (SymmetricCategory (Object Γ)) :=
  ⟨⟨inferInstance⟩, ⟨inferInstance⟩⟩

end Cantilune.Pi.OpenSMCCategory
