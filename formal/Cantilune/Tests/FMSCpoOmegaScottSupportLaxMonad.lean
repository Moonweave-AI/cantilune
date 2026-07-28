import Cantilune.Pi.FMSCpoOmegaScottSupportLaxMonad

/-!
Kernel-facing checks for the support-lax lower omega-Scott monad and its total
cartesian Fubini map.
-/

noncomputable section

namespace Cantilune.Tests.FMSCpoOmegaScottSupportLaxMonad

open CategoryTheory
open Cantilune.Pi.FMSCpoFiniteSupportTensor
open Cantilune.Pi.FMSCpoOmegaScottPower
open Cantilune.Pi.FMSCpoOmegaScottStrength
open Cantilune.Pi.FMSCpoOmegaScottSupportLaxMonad

universe u v

variable
    {Resource : Type u}
    [Fintype Resource]
    [DecidableEq Resource]

#check supportLaxPowerFunctor
#check supportLaxPowerUnit
#check supportLaxPowerMultiplication
#check supportLaxPowerMonad
#check fubiniLax

example :
    Category
      (SupportLaxOmegaCpo.{u, v} Resource) :=
  inferInstance

example :
    CategoryTheory.Monad
      (SupportLaxOmegaCpo.{u, v} Resource) :=
  supportLaxPowerMonad (Resource := Resource)

example
    (left right :
      SupportLaxOmegaCpo.{u, v} Resource) :
    cartesianObject (powerObject left) (powerObject right) ⟶
      powerObject (cartesianObject left right) :=
  fubiniLax left right

example
    {leftSource leftTarget rightSource rightTarget :
      SupportLaxOmegaCpo.{u, v} Resource}
    (leftMap : leftSource ⟶ leftTarget)
    (rightMap : rightSource ⟶ rightTarget) :
    (fubiniLax leftSource rightSource).comp
        (mapLax (cartesianMap leftMap rightMap)) =
      (cartesianMap (mapLax leftMap) (mapLax rightMap)).comp
        (fubiniLax leftTarget rightTarget) :=
  fubiniLax_natural leftMap rightMap

example
    (left : SupportLaxOmegaCpo.{u, v} Resource)
    (right : SupportLaxOmegaCpo.{u, v} Resource)
    (leftValue : left.Carrier)
    (rightValue : right.Carrier) :
    (fubiniLax left right).toContinuousHom
        (principalRaw leftValue, principalRaw rightValue) =
      principalRaw (leftValue, rightValue) :=
  fubiniLax_principal left right leftValue rightValue

example
    (left : SupportLaxOmegaCpo.{u, v} Resource)
    (right : SupportLaxOmegaCpo.{u, v} Resource)
    (leftFamily :
      OmegaScottPower (OmegaScottPower left.Carrier))
    (rightFamily :
      OmegaScottPower (OmegaScottPower right.Carrier)) :
    fubiniRaw
        (flattenRaw leftFamily)
        (flattenRaw rightFamily) =
      flattenRaw
        (mapRaw
          (fubini :
            OmegaScottPower left.Carrier ×
                OmegaScottPower right.Carrier →𝒄
              OmegaScottPower
                (left.Carrier × right.Carrier))
          (fubiniRaw leftFamily rightFamily)) :=
  fubiniLax_multiplication
    left right leftFamily rightFamily

#print axioms supportLaxPowerFunctor
#print axioms supportLaxPowerUnit
#print axioms supportLaxPowerMultiplication
#print axioms supportLaxPowerMonad
#print axioms fubiniLax
#print axioms fubiniLax_natural
#print axioms fubiniLax_principal
#print axioms fubiniLax_swap
#print axioms fubiniLax_associative
#print axioms fubiniLax_multiplication

end Cantilune.Tests.FMSCpoOmegaScottSupportLaxMonad
