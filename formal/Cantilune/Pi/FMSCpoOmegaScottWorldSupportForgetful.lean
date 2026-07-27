import Cantilune.Pi.FMSCpoOmegaScottWorldSupportTransport
import Cantilune.Pi.FMSCpoOmegaScottWorldMonad

/-!
# Forgetting exact support into the actual world functor category

An exact-support world model already contains all of the data of a genuine
functor `World ⥤ ωCPO`; its additional fields record finite support and exact
direct-image transport.  This module bundles the carrier-forgetting operation
as a faithful functor.

The supported lower omega-Scott power is then compared with the actual
pointwise lower omega-Scott monad.  On carriers and continuous maps the two
constructions agree definitionally.  The comparison records that agreement
without claiming that every `World ⥤ ωCPO` model admits exact finite support,
or that the supported and unsupported categories are equivalent.
-/

noncomputable section

namespace Cantilune.Pi.FMSCpoOmegaScottWorldSupportForgetful

open CategoryTheory
open OmegaCompletePartialOrder
open Cantilune.Pi.FMSModel
open Cantilune.Pi.FMSCpoOmegaScottPower
open Cantilune.Pi.FMSCpoOmegaScottWorldMonad
open Cantilune.Pi.FMSCpoOmegaScottWorldSupportTransport
open Cantilune.Pi.FMSCpoOmegaScottWorldSupportTransport.SupportedWorldModel

namespace Bridge

universe u

/-- Forget finite support while retaining the actual world-indexed omega-CPO. -/
def forgetObject
    (model : SupportedWorldModel.{u}) :
    WorldModel where
  obj world := ωCPO.of (model.obj world).Carrier
  map injection :=
    (model.reindex injection).toContinuousHom
  map_id world := by
    apply ContinuousHom.ext
    intro value
    exact model.reindex_id world value
  map_comp left right := by
    apply ContinuousHom.ext
    intro value
    exact model.reindex_comp left right value

/-- Forget support equations from a natural exact-support map. -/
def forgetHom
    {source target : SupportedWorldModel.{u}}
    (morphism : source ⟶ target) :
    forgetObject source ⟶ forgetObject target where
  app world :=
    (morphism.app world).toContinuousHom
  naturality := by
    intro first second injection
    apply ContinuousHom.ext
    intro value
    exact (morphism.natural injection value).symm

@[simp]
theorem forgetObject_obj
    (model : SupportedWorldModel.{u})
    (world : World) :
    (forgetObject model).obj world =
      ωCPO.of (model.obj world).Carrier :=
  rfl

@[simp]
theorem forgetObject_map_apply
    (model : SupportedWorldModel.{u})
    {source target : World}
    (injection : source ⟶ target)
    (value : (model.obj source).Carrier) :
    (forgetObject model).map injection value =
      model.reindex injection value :=
  rfl

@[simp]
theorem forgetHom_app_apply
    {source target : SupportedWorldModel.{u}}
    (morphism : source ⟶ target)
    (world : World)
    (value : (source.obj world).Carrier) :
    (forgetHom morphism).app world value =
      morphism.app world value :=
  rfl

/-- Exact-support world models forget faithfully into `World ⥤ ωCPO`. -/
def forgetFunctor :
    SupportedWorldModel.{u} ⥤ WorldModel where
  obj := forgetObject
  map := forgetHom
  map_id model := by
    ext world value
    rfl
  map_comp first second := by
    ext world value
    rfl

instance forgetFunctor_faithful :
    forgetFunctor.{u}.Faithful where
  map_injective := by
    intro source target left right equality
    apply
      Cantilune.Pi.FMSCpoOmegaScottWorldSupportTransport.SupportedWorldModel.Hom.ext_apply
    intro world value
    have componentEquality :
        (forgetHom left).app world =
          (forgetHom right).app world :=
      congrArg (fun transformation => transformation.app world) equality
    exact congrArg (fun component => component value) componentEquality

/-! ## Compatibility with the actual pointwise omega-Scott power -/

/--
After support is forgotten, the supported power model is the pointwise
omega-Scott power model, up to proof-irrelevant functor fields.
-/
theorem forget_powerModel
    (model : SupportedWorldModel.{u}) :
    forgetFunctor.{u}.obj (powerFunctor.obj model) =
      omegaScottWorldPower.obj (forgetFunctor.{u}.obj model) := by
  refine CategoryTheory.Functor.ext (fun world => rfl) ?_
  intro source target injection
  rfl

/--
The objectwise equality above is promoted to an explicit natural isomorphism
of world models whose components are identity continuous maps.
-/
def forgetPowerComponentIso
    (model : SupportedWorldModel.{u}) :
    forgetFunctor.{u}.obj (powerFunctor.obj model) ≅
      omegaScottWorldPower.obj (forgetFunctor.{u}.obj model) :=
  NatIso.ofComponents
    (fun _world => Iso.refl _)
    (by
      intro source target injection
      rfl)

/--
Forgetting support commutes naturally with the lower omega-Scott power
endofunctor.
-/
def forgetPowerIso :
    powerFunctor ⋙ forgetFunctor.{u} ≅
      forgetFunctor.{u} ⋙ omegaScottWorldPower :=
  NatIso.ofComponents
    forgetPowerComponentIso
    (by
      intro source target morphism
      ext world value
      rfl)

/--
Forgetting after applying supported power and applying the actual pointwise
power after forgetting have the same world carrier.
-/
@[simp]
theorem forget_power_obj_obj
    (model : SupportedWorldModel.{u})
    (world : World) :
    (forgetFunctor.{u}.obj
        (powerFunctor.obj model)).obj world =
      (omegaScottWorldPower.obj
        (forgetFunctor.{u}.obj model)).obj world :=
  rfl

/-- Their finite-world transport maps agree pointwise. -/
@[simp]
theorem forget_power_obj_map_apply
    (model : SupportedWorldModel.{u})
    {source target : World}
    (injection : source ⟶ target)
    (values :
      OmegaScottPower (model.obj source).Carrier) :
    (forgetFunctor.{u}.obj
        (powerFunctor.obj model)).map injection values =
      (omegaScottWorldPower.obj
        (forgetFunctor.{u}.obj model)).map injection values :=
  rfl

/-- Their action on supported natural transformations agrees pointwise. -/
@[simp]
theorem forget_power_map_app_apply
    {source target : SupportedWorldModel.{u}}
    (morphism : source ⟶ target)
    (world : World)
    (values :
      OmegaScottPower (source.obj world).Carrier) :
    (forgetFunctor.{u}.map
        (powerFunctor.map morphism)).app world values =
      (omegaScottWorldPower.map
        (forgetFunctor.{u}.map morphism)).app world values :=
  rfl

/-- The supported return is exactly the pointwise omega-Scott unit. -/
@[simp]
theorem forget_powerUnit_app_apply
    (model : SupportedWorldModel.{u})
    (world : World)
    (value : (model.obj world).Carrier) :
    (forgetFunctor.{u}.map
        (powerUnit.app model)).app world value =
      (omegaScottWorldMonad.η.app
        (forgetFunctor.{u}.obj model)).app world value :=
  rfl

/-- The supported flattening is exactly the pointwise multiplication. -/
@[simp]
theorem forget_powerMultiplication_app_apply
    (model : SupportedWorldModel.{u})
    (world : World)
    (family :
      OmegaScottPower
        (OmegaScottPower (model.obj world).Carrier)) :
    (forgetFunctor.{u}.map
        (powerMultiplication.app model)).app world family =
      (omegaScottWorldMonad.μ.app
        (forgetFunctor.{u}.obj model)).app world family :=
  rfl

end Bridge

end Cantilune.Pi.FMSCpoOmegaScottWorldSupportForgetful
