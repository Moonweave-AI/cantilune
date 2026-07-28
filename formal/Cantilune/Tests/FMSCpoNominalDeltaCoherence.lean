import Cantilune.Pi.FMSCpoNominalDeltaCoherence

/-!
# Regression tests for nominal double-allocation coherence

These checks keep the two load-bearing levels visible:

* the last-two-name permutation is a natural involution of the double
  successor on finite-injection worlds; and
* the induced continuous natural isomorphism witnesses the exchange of two
  canonical allocations in `ωCPO^I`.
-/

noncomputable section

namespace Cantilune.Tests.FMSCpoNominalDeltaCoherence

open CategoryTheory
open Cantilune.Pi.FMSModel
open Cantilune.Pi.FMSCpoWorld
open Cantilune.Pi.FMSCpoNominalDeltaCoherence

#check lastTwoSwap_natural
#check lastTwoSwap_involutive
#check doubleSuccessorAlphaIso
#check doubleShiftAlphaIso
#check allocation_alpha_exchange
#check allocation_alpha_exchange_inverse

example (world : World) :
    lastTwoSwap world ≫ lastTwoSwap world =
      𝟙 ((world + 1) + 1 : World) :=
  lastTwoSwap_involutive world

example (model : World ⥤ ωCPO) :
    shift.map (allocate model) ≫
        doubleShiftAlphaIso.hom.app model =
      allocate (shift.obj model) :=
  allocation_alpha_exchange model

#print axioms
  Cantilune.Pi.FMSCpoNominalDeltaCoherence.lastTwoSwap_natural
#print axioms
  Cantilune.Pi.FMSCpoNominalDeltaCoherence.doubleSuccessorAlphaIso
#print axioms
  Cantilune.Pi.FMSCpoNominalDeltaCoherence.doubleShiftAlphaIso
#print axioms
  Cantilune.Pi.FMSCpoNominalDeltaCoherence.allocation_alpha_exchange
#print axioms
  Cantilune.Pi.FMSCpoNominalDeltaCoherence.allocation_alpha_exchange_inverse

end Cantilune.Tests.FMSCpoNominalDeltaCoherence
