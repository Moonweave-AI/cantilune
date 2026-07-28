import Cantilune.Pi.FMSCpoOmegaScottPowerSupport

/-!
# Regression tests for the finite-support omega-Scott power lift

The checks cover the supported object and exact-support lifts of return,
mapping, finite choice, and multiplication.  They also retain the exact
empty-branch criterion for cartesian Fubini.
-/

noncomputable section

namespace Cantilune.Tests.FMSCpoOmegaScottPowerSupport

open OmegaCompletePartialOrder
open Cantilune.Pi.FMSCpoFiniteSupportTensor
open Cantilune.Pi.FMSCpoOmegaScottPower
open Cantilune.Pi.FMSCpoOmegaScottStrength
open Cantilune.Pi.FMSCpoOmegaScottPowerSupport

universe u v

variable
    {Resource : Type u}
    [Fintype Resource]
    [DecidableEq Resource]

#check Cantilune.Pi.FMSCpoOmegaScottPowerSupport.powerObject
#check principalSupported
#check mapSupported
#check choiceSupported
#check flattenSupported
#check powerSupport_fubiniRaw
#check powerSupport_fubiniRaw_exact_iff

example
    (object : SupportedOmegaCpo.{u, v} Resource)
    (value : object.Carrier) :
    (powerObject object).support (principalRaw value) =
      object.support value :=
  powerSupport_principalRaw object value

example
    (left right : SupportedOmegaCpo.{u, v} Resource)
    (leftValues : OmegaScottPower left.Carrier)
    (rightValues : OmegaScottPower right.Carrier)
    (leftNonempty : HasOutcome leftValues)
    (rightNonempty : HasOutcome rightValues) :
    powerSupport (cartesianProduct left right)
        (fubiniRaw leftValues rightValues) =
      powerSupport left leftValues ∪
        powerSupport right rightValues :=
  powerSupport_fubiniRaw_of_hasOutcome
    left right leftValues rightValues
    leftNonempty rightNonempty

#print axioms
  Cantilune.Pi.FMSCpoOmegaScottPowerSupport.powerObject
#print axioms
  Cantilune.Pi.FMSCpoOmegaScottPowerSupport.powerSupport_principalRaw
#print axioms
  Cantilune.Pi.FMSCpoOmegaScottPowerSupport.powerSupport_mapRaw
#print axioms
  Cantilune.Pi.FMSCpoOmegaScottPowerSupport.powerSupport_choice
#print axioms
  Cantilune.Pi.FMSCpoOmegaScottPowerSupport.powerSupport_flattenRaw
#print axioms
  Cantilune.Pi.FMSCpoOmegaScottPowerSupport.powerSupport_fubiniRaw
#print axioms
  Cantilune.Pi.FMSCpoOmegaScottPowerSupport.powerSupport_fubiniRaw_exact_iff

end Cantilune.Tests.FMSCpoOmegaScottPowerSupport
