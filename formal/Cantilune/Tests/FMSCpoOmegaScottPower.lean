import Cantilune.Pi.FMSCpoOmegaScottPower

/-!
# Omega-Scott closed-set monad regression

These checks keep the all-omega-CPO endofunctor and monad visible.  The
construction is an unseparated lower/Hoare monad; this test does not identify
it with the Abramsky powerdomain or an FMS model.
-/

noncomputable section

namespace Cantilune.Tests.FMSCpoOmegaScottPower

open CategoryTheory
open OmegaCompletePartialOrder
open Cantilune.Pi.FMSCpoOmegaScottPower

#check omegaChainRanges
#check omegaScottLift_continuous
#check continuousHom_omegaScott_continuous
#check isClosed_iff_isLowerSet_and_chainSupClosed
#check omegaSup_eq_closure_iUnion
#check principalRaw_map_omegaSup
#check choice
#check flattenRaw_map_omegaSup
#check mapRaw_map_omegaSup
#check mapRaw_id
#check mapRaw_comp
#check omegaScottPowerFunctor
#check omegaScottPowerUnit
#check flattenRaw_mapRaw_natural
#check flattenRaw_mapRaw_principal
#check flattenRaw_assoc
#check omegaScottPowerMultiplication
#check omegaScottPowerMonad

example (chain : Chain Bool) :
    principalRaw (ωSup chain) =
      ωSup (chain.map principalOrderHom) :=
  principalRaw_map_omegaSup chain

example
    (values : OmegaScottPower Bool) :
    flattenRaw
        (mapRaw
          (principal : Bool →𝒄 OmegaScottPower Bool)
          values) =
      values :=
  flattenRaw_mapRaw_principal values

example
    (family :
      OmegaScottPower
        (OmegaScottPower (OmegaScottPower Bool))) :
    flattenRaw
        (mapRaw
          (flatten :
            OmegaScottPower (OmegaScottPower Bool) →𝒄
              OmegaScottPower Bool)
          family) =
      flattenRaw (flattenRaw family) :=
  flattenRaw_assoc family

end Cantilune.Tests.FMSCpoOmegaScottPower
