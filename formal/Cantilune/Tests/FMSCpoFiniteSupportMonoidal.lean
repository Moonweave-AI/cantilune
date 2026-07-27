import Cantilune.Pi.FMSCpoFiniteSupportMonoidal

/-!
# Regression tests for the bundled finite-support omega-CPO SMC

These checks ensure that the separated tensor is available through the
actual mathlib monoidal interfaces and that membership in a tensor carrier
still exposes the load-bearing support-disjointness witness.
-/

noncomputable section

namespace Cantilune.Tests.FMSCpoFiniteSupportMonoidal

open CategoryTheory
open CategoryTheory.MonoidalCategory
open CategoryTheory.BraidedCategory
open Cantilune.Pi.FMSCpoFiniteSupportTensor
open Cantilune.Pi.FMSCpoFiniteSupportMonoidal

universe u v

variable
    {Resource : Type u}
    [DecidableEq Resource]

example :
    Nonempty
        (MonoidalCategory
          (SupportedOmegaCpo.{u, v} Resource)) ∧
      Nonempty
        (SymmetricCategory
          (SupportedOmegaCpo.{u, v} Resource)) :=
  finite_support_omegaCpo_smc Resource

/--
The bundled tensor has not forgotten the separation proof: every tensor
value still consists of two disjointly supported components.
-/
theorem tensor_value_separated
    (left right : SupportedOmegaCpo.{u, v} Resource)
    (value : (left ⊗ right).Carrier) :
    Disjoint
      (left.support value.fst)
      (right.support value.snd) :=
  value.separated

/-- The bundled braiding is involutive at the morphism level. -/
theorem bundled_braiding_involutive
  (left right : SupportedOmegaCpo.{u, v} Resource) :
    (β_ left right).hom ≫ (β_ right left).hom =
      𝟙 (left ⊗ right) := by
  exact
    Cantilune.Pi.FMSCpoFiniteSupportTensor.Separated.braiding_involutive
      left right

/-- The bundled associator satisfies mathlib's pentagon theorem. -/
theorem bundled_pentagon
    (first second third fourth :
      SupportedOmegaCpo.{u, v} Resource) :
    ((α_ first second third).hom ▷ fourth) ≫
        (α_ first (second ⊗ third) fourth).hom ≫
          (first ◁ (α_ second third fourth).hom) =
      (α_ (first ⊗ second) third fourth).hom ≫
        (α_ first second (third ⊗ fourth)).hom :=
  MonoidalCategory.pentagon first second third fourth

#print axioms
  Cantilune.Pi.FMSCpoFiniteSupportMonoidal.finite_support_omegaCpo_smc
#print axioms
  Cantilune.Tests.FMSCpoFiniteSupportMonoidal.bundled_braiding_involutive
#print axioms
  Cantilune.Tests.FMSCpoFiniteSupportMonoidal.bundled_pentagon

end Cantilune.Tests.FMSCpoFiniteSupportMonoidal
