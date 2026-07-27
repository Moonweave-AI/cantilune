import Cantilune.Pi.FMSCpoFiniteSupportTensor
import Mathlib.CategoryTheory.Monoidal.Braided.Basic

/-!
# The finite-support omega-CPO tensor as a bundled symmetric monoidal category

`FMSCpoFiniteSupportTensor` constructs the category of supported omega-CPOs,
its partial-support tensor, all structural isomorphisms, and their coherence
equations.  This file packages those constructions through mathlib's actual
`MonoidalCategory` and `SymmetricCategory` interfaces.

The tensor carrier contains exactly the disjoint pairs.  Consequently the
bundled tensor is not the cartesian product: a value of `X ⊗ Y` carries a
proof that the two finite supports are disjoint.  Morphisms are continuous
and preserve support exactly, so tensoring morphisms cannot manufacture or
discard support.

This packages the separated omega-CPO layer only.  It does not claim that
the omega-Scott powerdomain lifts to this category, that its Fubini map
preserves finite support, or that a recursive FMS agent/full-abstraction
package has been constructed.
-/

noncomputable section

namespace Cantilune.Pi.FMSCpoFiniteSupportMonoidal

open CategoryTheory
open CategoryTheory.Category
open CategoryTheory.MonoidalCategory
open CategoryTheory.BraidedCategory
open Cantilune.Pi.FMSCpoFiniteSupportTensor

universe u v

variable
    (Resource : Type u)
    [DecidableEq Resource]

/--
The disjoint-support tensor packaged as mathlib's monoidal structure.
-/
instance monoidalStruct :
    MonoidalCategoryStruct
      (SupportedOmegaCpo.{u, v} Resource) where
  tensorObj := Separated.tensor
  whiskerLeft := fun object {_ _} morphism =>
    Separated.map
      (SupportedOmegaCpo.Hom.id object)
      morphism
  whiskerRight := fun {_ _} morphism object =>
    Separated.map
      morphism
      (SupportedOmegaCpo.Hom.id object)
  tensorHom := Separated.map
  tensorUnit := Separated.unit
  associator := Separated.associator
  leftUnitor := Separated.leftUnitor
  rightUnitor := Separated.rightUnitor

/--
The support-separated omega-CPO category satisfies the complete bundled
monoidal coherence laws.
-/
instance monoidalCategory :
    MonoidalCategory
      (SupportedOmegaCpo.{u, v} Resource) :=
  MonoidalCategory.ofTensorHom
    (C := SupportedOmegaCpo.{u, v} Resource)
    (by
      intro left right
      exact Separated.map_id left right)
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
      apply SupportedOmegaCpo.Hom.ext
      apply DFunLike.ext _ _
      intro value
      apply Separated.Carrier.ext <;> rfl)
    (by
      intro first₁ second₁ third₁
        first₂ second₂ third₂
        firstMap secondMap thirdMap
      exact
        Separated.associator_naturality
          firstMap secondMap thirdMap)
    (by
      intro first second morphism
      exact Separated.leftUnitor_naturality morphism)
    (by
      intro first second morphism
      exact Separated.rightUnitor_naturality morphism)
    (by
      intro first second third fourth
      change
        ((Separated.map
            (Separated.associatorHom first second third)
            (SupportedOmegaCpo.Hom.id fourth)).comp
          (Separated.associatorHom
            first (Separated.tensor second third) fourth)).comp
            (Separated.map
              (SupportedOmegaCpo.Hom.id first)
              (Separated.associatorHom second third fourth)) =
          (Separated.associatorHom
              (Separated.tensor first second) third fourth).comp
            (Separated.associatorHom
              first second (Separated.tensor third fourth))
      exact
        (Separated.associator_pentagon
          first second third fourth).symm)
    (by
      intro first second
      exact Separated.unitor_triangle first second)

/-- The continuous support-separated braiding. -/
def braidingIso
    (left right : SupportedOmegaCpo.{u, v} Resource) :
    left ⊗ right ≅ right ⊗ left :=
  Separated.braiding left right

/--
The support-separated omega-CPO tensor is a genuine bundled symmetric
monoidal structure.
-/
instance symmetricCategory :
    SymmetricCategory
      (SupportedOmegaCpo.{u, v} Resource) where
  braiding := braidingIso Resource
  braiding_naturality_right := by
    intro left source target morphism
    exact
      Separated.braiding_naturality
        (SupportedOmegaCpo.Hom.id left)
        morphism
  braiding_naturality_left := by
    intro source target morphism right
    exact
      Separated.braiding_naturality
        morphism
        (SupportedOmegaCpo.Hom.id right)
  hexagon_forward := by
    intro first second third
    apply SupportedOmegaCpo.Hom.ext
    apply DFunLike.ext _ _
    intro value
    apply Separated.Carrier.ext
    · rfl
    · apply Separated.Carrier.ext <;> rfl
  hexagon_reverse := by
    intro first second third
    apply SupportedOmegaCpo.Hom.ext
    apply DFunLike.ext _ _
    intro value
    apply Separated.Carrier.ext
    · apply Separated.Carrier.ext <;> rfl
    · rfl
  symmetry := by
    intro left right
    apply SupportedOmegaCpo.Hom.ext
    apply DFunLike.ext _ _
    intro value
    apply Separated.Carrier.ext <;> rfl

/--
Stable theorem exposing the two actual typeclass instances used by later FMS
constructions.
-/
theorem finite_support_omegaCpo_smc :
    Nonempty
        (MonoidalCategory
          (SupportedOmegaCpo.{u, v} Resource)) ∧
      Nonempty
        (SymmetricCategory
          (SupportedOmegaCpo.{u, v} Resource)) :=
  ⟨⟨inferInstance⟩, ⟨inferInstance⟩⟩

end Cantilune.Pi.FMSCpoFiniteSupportMonoidal
