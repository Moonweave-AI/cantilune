import Cantilune.Pi.FMSCpoFiniteHoareMonad

/-!
# Finite continuous Hoare monad regression

The checks below keep the actual monad on finite omega-CPOs and its exact
Kleisli extension visible.  They do not promote the construction to the
all-omega-CPO FMS powerdomain.
-/

noncomputable section

namespace Cantilune.Tests.FMSCpoFiniteHoareMonad

open CategoryTheory
open Cantilune.Pi.FMSCpoFiniteHoarePower
open Cantilune.Pi.FMSCpoFiniteHoareMonad

#check Cantilune.Pi.FMSCpoFiniteHoareMonad.bind
#check bindRaw_eq_flatten_mapRaw
#check bindRaw_principal
#check bindRaw_principal_right
#check bindRaw_assoc
#check bindRaw_choice
#check bindRaw_pointwise_choice
#check flattenRaw_mapRaw_natural
#check flattenRaw_assoc
#check finiteHoareFunctor
#check finiteHoareMonad
#check kleisliExtension
#check kleisliExtension_apply

/-- A concrete ordered finite omega-CPO object accepted by the monad. -/
def orderedBool : FiniteCPO :=
  ⟨ωCPO.of Bool, show Finite Bool from inferInstance⟩

example (values : HoarePower Bool) :
    bindRaw principalRaw principalRaw_monotone values = values :=
  bindRaw_principal_right values

example (value : orderedBool.obj) :
    finiteHoareMonad.η.app orderedBool value =
      principalRaw value :=
  finiteHoareMonad_unit_apply orderedBool value

end Cantilune.Tests.FMSCpoFiniteHoareMonad
