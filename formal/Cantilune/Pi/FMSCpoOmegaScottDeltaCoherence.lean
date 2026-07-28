import Cantilune.Pi.FMSCpoOmegaScottChosenCoherence
import Cantilune.Pi.FMSCpoOmegaScottWorldMonad
import Cantilune.Pi.FMSCpoWorld

/-!
# Delta/monad coherence for the actual omega-Scott world monad

Precomposition by the finite-world successor (`delta`) commutes with the
pointwise omega-Scott monad.  This file packages the comparison as a genuine
natural isomorphism and proves unit, multiplication, allocation, and Fubini
coherence.

The construction is the actual nonconstant `ωCPO^I` model already present in
the repository.  Its powerdomain is the unseparated omega-Scott lower monad:
the results below must not be read as a separated Abramsky powerdomain,
recursive domain solution, hiding on the agent domain, adequacy, or full
abstraction.
-/

noncomputable section

namespace Cantilune.Pi.FMSCpoOmegaScottDeltaCoherence

open CategoryTheory
open OmegaCompletePartialOrder
open Cantilune.Pi.FMSModel
open Cantilune.Pi.FMSCpoWorld
open Cantilune.Pi.FMSCpoOmegaScottPower
open Cantilune.Pi.FMSCpoOmegaScottStrength
open Cantilune.Pi.FMSCpoOmegaScottWorldMonad

/--
Pointwise power and finite-world successor commute definitionally at every
world; the identity components expose that fact as a natural isomorphism.
-/
def shiftPowerIso :
    omegaScottWorldPower ⋙ shift ≅
      shift ⋙ omegaScottWorldPower :=
  NatIso.ofComponents
    (fun _model => Iso.refl _)
    (by
      intro source target transformation
      ext world values
      rfl)

@[simp]
theorem shiftPowerIso_hom_app
    (model : WorldModel) :
    shiftPowerIso.hom.app model = 𝟙 _ :=
  rfl

@[simp]
theorem shiftPowerIso_inv_app
    (model : WorldModel) :
    shiftPowerIso.inv.app model = 𝟙 _ :=
  rfl

/-- Delta transports the monad unit to the unit of the shifted model. -/
theorem shift_unit_coherence
    (model : WorldModel) :
    shift.map (omegaScottWorldMonad.η.app model) ≫
        shiftPowerIso.hom.app model =
      omegaScottWorldMonad.η.app (shift.obj model) := by
  ext world value
  rfl

/--
At every finite world, delta transports multiplication definitionally to
the multiplication of the shifted model.  The all-components statement is
kept explicit to avoid treating equality of differently associated functor
composites as definitional equality.
-/
theorem shift_multiplication_component
    (model : WorldModel)
    (world : World) :
    (shift.map
        (omegaScottWorldMonad.μ.app model)).app world =
      (omegaScottWorldMonad.μ.app
        (shift.obj model)).app world := by
  rfl

/--
Allocation of an effectful value is the pointwise power of allocation,
after the canonical delta/power comparison.
-/
theorem allocation_power_coherence
    (model : WorldModel) :
    allocate (omegaScottWorldPower.obj model) ≫
        shiftPowerIso.hom.app model =
      omegaScottWorldPower.map (allocate model) := by
  ext world values
  rfl

/--
Lift any continuous delta-algebra `δ X ⟶ X` through the actual pointwise
omega-Scott power.  The delta/power comparison is explicit, so this is a
natural transformation in `ωCPO^I`, not merely an objectwise function.
-/
def powerHiding
    {model : WorldModel}
    (hideMap : shift.obj model ⟶ model) :
    shift.obj (omegaScottWorldPower.obj model) ⟶
      omegaScottWorldPower.obj model :=
  shiftPowerIso.hom.app model ≫
    omegaScottWorldPower.map hideMap

@[simp]
theorem powerHiding_app
    {model : WorldModel}
    (hideMap : shift.obj model ⟶ model)
    (world : World)
    (values : OmegaScottPower (model.obj (world + 1))) :
    (powerHiding hideMap).app world values =
      mapRaw (hideMap.app world) values :=
  rfl

/--
Powering preserves an allocate/hide retraction.  Thus every genuine
delta-algebra retraction already available on a world model induces one on
its actual unseparated omega-Scott power.
-/
theorem powerHiding_after_allocate
    {model : WorldModel}
    (hideMap : shift.obj model ⟶ model)
    (retraction : allocate model ≫ hideMap = 𝟙 model) :
    allocate (omegaScottWorldPower.obj model) ≫
        powerHiding hideMap =
      𝟙 (omegaScottWorldPower.obj model) := by
  ext world values
  change
    mapRaw (hideMap.app world)
        (mapRaw ((allocate model).app world) values) =
      values
  rw [mapRaw_comp]
  have component :
      (hideMap.app world).comp
          ((allocate model).app world) =
        ContinuousHom.id := by
    exact NatTrans.congr_app retraction world
  rw [component]
  exact mapRaw_id values

/-- The lifted hiding commutes with the pointwise monad unit. -/
theorem powerHiding_unit_coherence
    {model : WorldModel}
    (hideMap : shift.obj model ⟶ model) :
    shift.map (omegaScottWorldMonad.η.app model) ≫
        powerHiding hideMap =
      hideMap ≫ omegaScottWorldMonad.η.app model := by
  ext world value
  change
    mapRaw (hideMap.app world) (principalRaw value) =
      principalRaw (hideMap.app world value)
  exact mapRaw_principal (hideMap.app world) value

/--
The lifted hiding commutes with pointwise monad multiplication.  This is the
continuous natural-transformation form of direct image commuting with
flattening.
-/
theorem powerHiding_multiplication_coherence
    {model : WorldModel}
    (hideMap : shift.obj model ⟶ model) :
    shift.map (omegaScottWorldMonad.μ.app model) ≫
        powerHiding hideMap =
      powerHiding (powerHiding hideMap) ≫
        omegaScottWorldMonad.μ.app model := by
  ext world family
  change
    mapRaw (hideMap.app world) (flattenRaw family) =
      flattenRaw
        (mapRaw (map (hideMap.app world)) family)
  exact
    (flattenRaw_mapRaw_natural
      (hideMap.app world) family).symm

/-- Pointwise product of two natural transformations. -/
def pointwiseProductMap
    {left left' right right' : WorldModel}
    (leftMap : left ⟶ left')
    (rightMap : right ⟶ right') :
    pointwiseProduct left right ⟶
      pointwiseProduct left' right' where
  app world :=
    productMap (leftMap.app world) (rightMap.app world)
  naturality := by
    intro source target injection
    apply ContinuousHom.ext
    rintro ⟨leftValue, rightValue⟩
    change
      (leftMap.app target (left.map injection leftValue),
        rightMap.app target (right.map injection rightValue)) =
      (left'.map injection (leftMap.app source leftValue),
        right'.map injection (rightMap.app source rightValue))
    apply Prod.ext
    · exact
        ContinuousHom.congr_fun
          (leftMap.naturality injection) leftValue
    · exact
        ContinuousHom.congr_fun
          (rightMap.naturality injection) rightValue

/--
Fubini at the shifted model is exactly Fubini one world later.  Thus delta
preserves the complete chosen-product Fubini operation of the unseparated
omega-Scott monad.
-/
theorem shift_fubini_component
    (left right : WorldModel)
    (world : World) :
    (pointwiseFubini (shift.obj left) (shift.obj right)).app world =
      (pointwiseFubini left right).app (world + 1) := by
  rfl

/--
Allocating both inputs before Fubini agrees with applying Fubini first and
allocating the paired computation.  This is the pointwise `up` instance of
Fubini naturality, with no hidden alpha or weak transition.
-/
theorem allocation_fubini_coherence
    (left right : WorldModel)
    (world : World)
    (leftValues :
      OmegaScottPower (left.obj world))
    (rightValues :
      OmegaScottPower (right.obj world)) :
    fubiniRaw
        (mapRaw (left.map (up world)) leftValues)
        (mapRaw (right.map (up world)) rightValues) =
      mapRaw
        (productMap
          (left.map (up world))
          (right.map (up world)))
        (fubiniRaw leftValues rightValues) := by
  exact
    (fubiniRaw_natural
      (left.map (up world))
      (right.map (up world))
      leftValues rightValues).symm

/-- The previous equation as equality of the actual pointwise morphisms. -/
theorem allocation_pointwiseFubini_coherence
    (left right : WorldModel) :
    pointwiseProductMap
        (omegaScottWorldPower.map (allocate left))
        (omegaScottWorldPower.map (allocate right)) ≫
        pointwiseFubini (shift.obj left) (shift.obj right) =
      pointwiseFubini left right ≫
        omegaScottWorldPower.map
      (pointwiseProductMap (allocate left) (allocate right)) := by
  ext world values
  exact allocation_fubini_coherence
    left right world values.1 values.2

/--
Lifted hiding is compatible with the actual pointwise Fubini map.  The two
identity-valued delta/power comparisons remain visible in the diagram, so
the theorem records all typing transports rather than relying on an
objectwise definitional identification.
-/
theorem powerHiding_pointwiseFubini_coherence
    {left right : WorldModel}
    (leftHiding : shift.obj left ⟶ left)
    (rightHiding : shift.obj right ⟶ right) :
    pointwiseProductMap
        (powerHiding leftHiding)
        (powerHiding rightHiding) ≫
        pointwiseFubini left right =
      pointwiseProductMap
          (shiftPowerIso.hom.app left)
          (shiftPowerIso.hom.app right) ≫
        pointwiseFubini (shift.obj left) (shift.obj right) ≫
        omegaScottWorldPower.map
          (pointwiseProductMap leftHiding rightHiding) := by
  ext world values
  exact
    (fubiniRaw_natural
      (leftHiding.app world)
      (rightHiding.app world)
      values.1 values.2).symm

end Cantilune.Pi.FMSCpoOmegaScottDeltaCoherence
