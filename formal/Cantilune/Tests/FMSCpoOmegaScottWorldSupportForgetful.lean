import Cantilune.Pi.FMSCpoOmegaScottWorldSupportForgetful

/-!
# Regression tests for the supported-world forgetful bridge

The checks exercise faithfulness, the natural power comparison, and the
pointwise unit/multiplication equations on the concrete nonconstant finite
support model.
-/

noncomputable section

namespace Cantilune.Tests.FMSCpoOmegaScottWorldSupportForgetful

open CategoryTheory
open Cantilune.Pi.FMSModel
open Cantilune.Pi.FMSCpoOmegaScottPower
open Cantilune.Pi.FMSCpoOmegaScottWorldMonad
open Cantilune.Pi.FMSCpoOmegaScottWorldSupportTransport
open Cantilune.Pi.FMSCpoOmegaScottWorldSupportTransport.SupportedWorldModel
open Cantilune.Pi.FMSCpoOmegaScottWorldSupportForgetful.Bridge

#check forgetObject
#check forgetHom
#check forgetFunctor
#check forget_powerModel
#check forgetPowerComponentIso
#check forgetPowerIso
#check forget_power_obj_map_apply
#check forget_power_map_app_apply
#check forget_powerUnit_app_apply
#check forget_powerMultiplication_app_apply

example
    {source target : SupportedWorldModel}
    (left right : source ⟶ target)
    (equal :
      forgetFunctor.map left =
        forgetFunctor.map right) :
    left = right :=
  forgetFunctor.map_injective equal

example
    {source target : World}
    (injection : source ⟶ target)
    (values :
      OmegaScottPower
        (finiteSupportWorldModel.obj source).Carrier) :
    (forgetFunctor.obj poweredFiniteSupportWorldModel).map
        injection values =
      (omegaScottWorldPower.obj
        (forgetFunctor.obj finiteSupportWorldModel)).map
          injection values :=
  forget_power_obj_map_apply
    finiteSupportWorldModel injection values

example
    (world : World)
    (value : (finiteSupportWorldModel.obj world).Carrier) :
    (forgetFunctor.map
        (powerUnit.app finiteSupportWorldModel)).app
          world value =
      (omegaScottWorldMonad.η.app
        (forgetFunctor.obj finiteSupportWorldModel)).app
          world value :=
  forget_powerUnit_app_apply
    finiteSupportWorldModel world value

example
    (world : World)
    (family :
      OmegaScottPower
        (OmegaScottPower
          (finiteSupportWorldModel.obj world).Carrier)) :
    (forgetFunctor.map
        (powerMultiplication.app finiteSupportWorldModel)).app
          world family =
      (omegaScottWorldMonad.μ.app
        (forgetFunctor.obj finiteSupportWorldModel)).app
          world family :=
  forget_powerMultiplication_app_apply
    finiteSupportWorldModel world family

#print axioms
  Cantilune.Pi.FMSCpoOmegaScottWorldSupportForgetful.Bridge.forgetFunctor
#print axioms
  Cantilune.Pi.FMSCpoOmegaScottWorldSupportForgetful.Bridge.forget_powerModel
#print axioms
  Cantilune.Pi.FMSCpoOmegaScottWorldSupportForgetful.Bridge.forgetPowerIso
#print axioms
  Cantilune.Pi.FMSCpoOmegaScottWorldSupportForgetful.Bridge.forget_power_map_app_apply
#print axioms
  Cantilune.Pi.FMSCpoOmegaScottWorldSupportForgetful.Bridge.forget_powerUnit_app_apply
#print axioms
  Cantilune.Pi.FMSCpoOmegaScottWorldSupportForgetful.Bridge.forget_powerMultiplication_app_apply

end Cantilune.Tests.FMSCpoOmegaScottWorldSupportForgetful
