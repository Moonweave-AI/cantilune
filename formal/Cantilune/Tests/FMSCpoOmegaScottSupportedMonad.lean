import Cantilune.Pi.FMSCpoOmegaScottSupportedMonad

/-!
# Regression tests for the exact-support omega-Scott monad
-/

noncomputable section

namespace Cantilune.Tests.FMSCpoOmegaScottSupportedMonad

open CategoryTheory
open OmegaCompletePartialOrder
open Cantilune.Pi.FMSCpoFiniteSupportTensor
open Cantilune.Pi.FMSCpoOmegaScottPower
open Cantilune.Pi.FMSCpoOmegaScottPowerSupport
open Cantilune.Pi.FMSCpoOmegaScottSupportedMonad

universe u v

variable
    {Resource : Type u}
    [Fintype Resource]
    [DecidableEq Resource]

#check supportedPowerFunctor
#check supportedPowerUnit
#check supportedPowerMultiplication
#check supportedPowerMonad

example
    (object : SupportedOmegaCpo.{u, v} Resource)
    (value : object.Carrier) :
    (supportedPowerMonad.η.app object).toContinuousHom value =
      principalRaw value :=
  rfl

example
    (object : SupportedOmegaCpo.{u, v} Resource)
    (values : OmegaScottPower object.Carrier) :
    (supportedPowerMonad.μ.app object).toContinuousHom
        (principalRaw values) =
      values :=
  flattenRaw_principal values

example
    (object : SupportedOmegaCpo.{u, v} Resource)
    (family :
      OmegaScottPower
        (OmegaScottPower (OmegaScottPower object.Carrier))) :
    flattenRaw
        (mapRaw
          (flatten :
            OmegaScottPower (OmegaScottPower object.Carrier) →𝒄
              OmegaScottPower object.Carrier)
          family) =
      flattenRaw (flattenRaw family) :=
  flattenRaw_assoc family

#print axioms supportedPowerFunctor
#print axioms supportedPowerUnit
#print axioms supportedPowerMultiplication
#print axioms supportedPowerMonad

end Cantilune.Tests.FMSCpoOmegaScottSupportedMonad
