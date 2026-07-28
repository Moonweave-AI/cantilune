import Cantilune.Pi.FMSCpoOmegaScottStrength

/-!
# Omega-Scott cartesian strength regression

These checks cover the continuous object-level cartesian product, its two
strengths, naturality, unit, symmetry, associativity, and equality with the
right-oriented Fubini construction.  They do not assert the missing
divergence/deadlock separation, free pointed-semilattice property, bundled
categorical strength/multiplication coherence, or FMS full abstraction.
-/

noncomputable section

namespace Cantilune.Tests.FMSCpoOmegaScottStrength

open OmegaCompletePartialOrder
open Cantilune.Pi.FMSCpoOmegaScottPower
open Cantilune.Pi.FMSCpoOmegaScottStrength

#check fubiniRaw
#check fubiniRaw_map_omegaSup
#check fubini
#check fubiniRaw_natural
#check fubiniRaw_principal
#check fubiniRaw_swap
#check fubiniRaw_associative
#check rightFubini
#check rightFubiniRaw_eq_fubiniRaw
#check rightFubini_eq_fubini
#check leftStrength
#check rightStrength
#check leftStrengthRaw_principal
#check rightStrengthRaw_principal

example
    (left right : OmegaScottPower Bool) :
    rightFubiniRaw left right =
      fubiniRaw left right :=
  rightFubiniRaw_eq_fubiniRaw left right

example (left right : Bool) :
    fubiniRaw (principalRaw left) (principalRaw right) =
      principalRaw (left, right) :=
  fubiniRaw_principal left right

end Cantilune.Tests.FMSCpoOmegaScottStrength
