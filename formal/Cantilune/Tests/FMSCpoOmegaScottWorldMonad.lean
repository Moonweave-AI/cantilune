import Cantilune.Pi.FMSCpoOmegaScottWorldMonad

/-!
# Pointwise omega-Scott world-monad regression

The checks below keep the actual unseparated pointwise monad, its
nonconstant support-model instance, and its world-natural Fubini components
visible without claiming a complete FMS model.
-/

noncomputable section

namespace Cantilune.Tests.FMSCpoOmegaScottWorldMonad

open CategoryTheory
open Cantilune.Pi.FMSModel
open Cantilune.Pi.FMSCpoOmegaScottPower
open Cantilune.Pi.FMSCpoOmegaScottWorldMonad

#check omegaScottWorldMonad
#check omegaScottWorldPower_obj
#check omegaScottWorldUnit_world_naturality
#check omegaScottWorldMultiplication_world_naturality
#check supportModel_up_zero_not_surjective
#check poweredSupportModel_map_apply
#check support_unit_world_injection
#check support_multiplication_world_injection
#check pointwiseFubini
#check pointwiseFubini_world_injection

example :
    ¬ Function.Surjective
      (fun support : supportModel.obj 0 =>
        supportModel.map (up 0) support) :=
  supportModel_up_zero_not_surjective

example
    (support : supportModel.obj 0) :
    poweredSupportModel.map (up 0)
        (principalRaw support) =
      principalRaw
        (supportModel.map (up 0) support) :=
  support_unit_world_injection (up 0) support

end Cantilune.Tests.FMSCpoOmegaScottWorldMonad
