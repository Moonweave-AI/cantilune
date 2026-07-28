import Cantilune.Pi.FMSCpoOmegaScottStrongCoherence

/-!
# Omega-Scott strong-coherence regression

The central regression is the object-level multiplication/Fubini diagram.
Chosen-product Fubini and strength components are also present, but this test
does not claim a bundled natural transformation, the remaining cartesian
coherence diagrams, divergence/deadlock separation, a free semilattice, or
an FMS model.
-/

noncomputable section

namespace Cantilune.Tests.FMSCpoOmegaScottStrongCoherence

open OmegaCompletePartialOrder
open Cantilune.Pi.FMSCpoOmegaScottPower
open Cantilune.Pi.FMSCpoOmegaScottStrength
open Cantilune.Pi.FMSCpoOmegaScottStrongCoherence

#check flattenUnion
#check carrier_flattenRaw
#check mem_flattenUnion_iff
#check fubiniRaw_flattenRaw
#check fubini_multiplication
#check ChosenProducts.prodIsoProd
#check chosenFubini
#check chosenLeftStrength
#check chosenRightStrength

example
    (left :
      OmegaScottPower (OmegaScottPower Bool))
    (right :
      OmegaScottPower (OmegaScottPower Bool)) :
    fubiniRaw (flattenRaw left) (flattenRaw right) =
      flattenRaw
        (mapRaw
          (fubini :
            OmegaScottPower Bool ×
                OmegaScottPower Bool →𝒄
              OmegaScottPower (Bool × Bool))
          (fubiniRaw left right)) :=
  fubiniRaw_flattenRaw left right

end Cantilune.Tests.FMSCpoOmegaScottStrongCoherence
