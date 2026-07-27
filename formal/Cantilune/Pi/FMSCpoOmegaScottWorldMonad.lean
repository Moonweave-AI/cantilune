import Cantilune.Pi.FMSPointwiseCpoMonad
import Cantilune.Pi.FMSCpoOmegaScottStrength

/-!
# The unseparated omega-Scott monad on finite-world models

This file instantiates the generic pointwise-monad construction with the
actual unseparated `omegaScottPowerMonad`.  The result is a genuine
`CategoryTheory.Monad` on `World ⥤ ωCPO`, and it is exercised on the existing
nonconstant finite-support model.

The pointwise Fubini transformation below packages the already-proved
object-level cartesian closed-set product across finite worlds.  None of these
constructions separates divergence from deadlock or supplies the complete FMS
powerdomain, recursive agent domain, hiding, adequacy, or full abstraction.
-/

noncomputable section

namespace Cantilune.Pi.FMSCpoOmegaScottWorldMonad

open CategoryTheory
open OmegaCompletePartialOrder
open Cantilune.Pi.FMSModel
open Cantilune.Pi.FMSExternalPackage
open Cantilune.Pi.FMSPointwiseCpoMonad
open Cantilune.Pi.FMSCpoOmegaScottPower
open Cantilune.Pi.FMSCpoOmegaScottStrength

/-- The category of actual omega-CPO-valued finite-world models. -/
abbrev WorldModel :=
  World ⥤ ωCPO

/--
The genuine pointwise lower/Hoare monad obtained from
`omegaScottPowerMonad`.
-/
def omegaScottWorldMonad :
    CategoryTheory.Monad WorldModel :=
  pointwiseCpoMonad
    (I := World)
    omegaScottPowerMonad

/-- Its underlying pointwise endofunctor. -/
def omegaScottWorldPower :
    WorldModel ⥤ WorldModel :=
  omegaScottWorldMonad.toFunctor

/--
The instantiated monad functor has the same pointwise action as the generic
world-model postcomposition construction.
-/
@[simp]
theorem omegaScottWorldPower_obj
    (model : WorldModel) :
    omegaScottWorldPower.obj model =
      (pointwiseCpoEndofunctor
        omegaScottPowerFunctor).obj model :=
  rfl

@[simp]
theorem omegaScottWorldPower_map
    {source target : WorldModel}
    (transformation : source ⟶ target) :
    omegaScottWorldPower.map transformation =
      (pointwiseCpoEndofunctor
        omegaScottPowerFunctor).map transformation :=
  rfl

/-- Every world component of the pointwise unit is `principal`. -/
@[simp]
theorem omegaScottWorldUnit_app
    (model : WorldModel) (world : World) :
    (omegaScottWorldMonad.η.app model).app world =
      (principal :
        model.obj world →𝒄
          OmegaScottPower (model.obj world)) :=
  rfl

/-- Every world component of pointwise multiplication is `flatten`. -/
@[simp]
theorem omegaScottWorldMultiplication_app
    (model : WorldModel) (world : World) :
    (omegaScottWorldMonad.μ.app model).app world =
      (flatten :
        OmegaScottPower
            (OmegaScottPower (model.obj world)) →𝒄
          OmegaScottPower (model.obj world)) :=
  rfl

/-- The instantiated unit commutes with every finite-world injection. -/
theorem omegaScottWorldUnit_world_naturality
    (model : WorldModel)
    {source target : World}
    (injection : source ⟶ target) :
    model.map injection ≫
        (omegaScottWorldMonad.η.app model).app target =
      (omegaScottWorldMonad.η.app model).app source ≫
        (omegaScottWorldPower.obj model).map injection :=
  (omegaScottWorldMonad.η.app model).naturality injection

/-- The instantiated multiplication commutes with every world injection. -/
theorem omegaScottWorldMultiplication_world_naturality
    (model : WorldModel)
    {source target : World}
    (injection : source ⟶ target) :
    (omegaScottWorldPower.obj
          (omegaScottWorldPower.obj model)).map injection ≫
        (omegaScottWorldMonad.μ.app model).app target =
      (omegaScottWorldMonad.μ.app model).app source ≫
        (omegaScottWorldPower.obj model).map injection :=
  (omegaScottWorldMonad.μ.app model).naturality injection

/-! ## A genuine nonconstant finite-world model -/

/-- Reuse the actual support model whose carrier at world `n` is `Set (Fin n)`. -/
def supportModel :
    WorldModel :=
  cpoAgent

/--
The standard injection `0 ⟶ 1` is not surjective on support carriers:
the singleton name support at world one has no preimage at the empty world.
This gives a concrete witness that `supportModel` is not a constant model.
-/
theorem supportModel_up_zero_not_surjective :
    ¬ Function.Surjective
      (fun support : supportModel.obj 0 =>
        supportModel.map (up 0) support) := by
  intro surjective
  obtain ⟨support, equality⟩ :=
    surjective (Set.univ : Set (Fin 1))
  change
    homToFun (up 0) '' support =
      Set.univ at equality
  have member :
      (0 : Fin 1) ∈ homToFun (up 0) '' support := by
    rw [equality]
    exact Set.mem_univ _
  obtain ⟨source, _sourceMember, _endpoint⟩ := member
  exact Fin.elim0 source

/-- The pointwise omega-Scott power of the nonconstant support model. -/
def poweredSupportModel :
    WorldModel :=
  omegaScottWorldPower.obj supportModel

/-- World transport in the powered support model is omega-Scott direct image. -/
@[simp]
theorem poweredSupportModel_map_apply
    {source target : World}
    (injection : source ⟶ target)
    (values : OmegaScottPower (supportModel.obj source)) :
    poweredSupportModel.map injection values =
      mapRaw (supportModel.map injection) values :=
  rfl

/-- Unit and the concrete finite-world injection action commute pointwise. -/
theorem support_unit_world_injection
    {source target : World}
    (injection : source ⟶ target)
    (support : supportModel.obj source) :
    poweredSupportModel.map injection
        (principalRaw support) =
      principalRaw
        (supportModel.map injection support) :=
  mapRaw_principal (supportModel.map injection) support

/-- Two applications of the actual pointwise omega-Scott power. -/
def twicePoweredSupportModel :
    WorldModel :=
  omegaScottWorldPower.obj poweredSupportModel

/--
Multiplication and the concrete finite-world injection action commute
pointwise on the nonconstant support model.
-/
theorem support_multiplication_world_injection
    {source target : World}
    (injection : source ⟶ target)
    (family :
      OmegaScottPower
        (OmegaScottPower (supportModel.obj source))) :
    poweredSupportModel.map injection
        (flattenRaw family) =
      flattenRaw
        (twicePoweredSupportModel.map injection family) := by
  change
    mapRaw (supportModel.map injection)
        (flattenRaw family) =
      flattenRaw
        (mapRaw
          (map (supportModel.map injection))
          family)
  exact
    (flattenRaw_mapRaw_natural
      (supportModel.map injection) family).symm

/-! ## Pointwise cartesian Fubini components -/

/-- Pointwise cartesian product of two finite-world models. -/
def pointwiseProduct
    (left right : WorldModel) :
    WorldModel where
  obj world :=
    ωCPO.of (left.obj world × right.obj world)
  map injection :=
    productMap
      (left.map injection)
      (right.map injection)
  map_id world := by
    apply ContinuousHom.ext
    rintro ⟨leftValue, rightValue⟩
    change
      ((left.map (𝟙 world)) leftValue,
        (right.map (𝟙 world)) rightValue) =
        (leftValue, rightValue)
    rw [left.map_id, right.map_id]
    rfl
  map_comp first second := by
    apply ContinuousHom.ext
    rintro ⟨leftValue, rightValue⟩
    change
      ((left.map (first ≫ second)) leftValue,
        (right.map (first ≫ second)) rightValue) =
        ((left.map first ≫ left.map second) leftValue,
          (right.map first ≫ right.map second) rightValue)
    rw [left.map_comp, right.map_comp]

/--
The object-level Fubini maps assemble into a natural transformation across
finite-world injections.
-/
def pointwiseFubini
    (left right : WorldModel) :
    pointwiseProduct
        (omegaScottWorldPower.obj left)
        (omegaScottWorldPower.obj right) ⟶
      omegaScottWorldPower.obj
        (pointwiseProduct left right) where
  app _world := fubini
  naturality := by
    intro source target injection
    apply ContinuousHom.ext
    intro values
    change
      fubiniRaw
          (mapRaw (left.map injection) values.1)
          (mapRaw (right.map injection) values.2) =
        mapRaw
          (productMap
            (left.map injection)
            (right.map injection))
          (fubiniRaw values.1 values.2)
    exact
      (fubiniRaw_natural
        (left.map injection)
        (right.map injection)
        values.1 values.2).symm

@[simp]
theorem pointwiseFubini_app
    (left right : WorldModel)
    (world : World) :
    (pointwiseFubini left right).app world =
      (fubini :
        OmegaScottPower (left.obj world) ×
            OmegaScottPower (right.obj world) →𝒄
          OmegaScottPower
            (left.obj world × right.obj world)) :=
  rfl

theorem pointwiseFubini_world_injection
    (left right : WorldModel)
    {source target : World}
    (injection : source ⟶ target)
    (leftValues : OmegaScottPower (left.obj source))
    (rightValues : OmegaScottPower (right.obj source)) :
    mapRaw
        (productMap
          (left.map injection)
          (right.map injection))
        (fubiniRaw leftValues rightValues) =
      fubiniRaw
        (mapRaw (left.map injection) leftValues)
        (mapRaw (right.map injection) rightValues) :=
  fubiniRaw_natural
    (left.map injection)
    (right.map injection)
    leftValues rightValues

end Cantilune.Pi.FMSCpoOmegaScottWorldMonad
