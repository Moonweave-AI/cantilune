import Cantilune.Pi.FMSCpoOmegaScottChosenCoherence

/-!
# Chosen-product omega-Scott coherence regression

This regression checks the categorical chosen-product layer of the
unseparated omega-Scott closed-lower-set monad.  It does not assert
divergence/deadlock separation, a free powerdomain universal property, an
Abramsky domain equation, adequacy, definability, or full abstraction.
-/

noncomputable section

namespace Cantilune.Tests.FMSCpoOmegaScottChosenCoherence

open Cantilune.Pi.FMSCpoOmegaScottChosenCoherence

#check ChosenProducts.prodIsoProd_hom_natural
#check ChosenProducts.prodIsoProd_inv_natural
#check ChosenProducts.prodIsoProd_hom_braiding
#check ChosenProducts.prodIsoProd_inv_braiding
#check ChosenProducts.prodIsoProd_hom_associator
#check ChosenProducts.prodIsoProd_inv_associator
#check fubini_natural_hom
#check fubini_braiding_hom
#check chosenFubini_natural
#check chosenFubini_principal
#check chosenFubini_multiplication
#check chosenFubini_braiding
#check chosenFubini_associative
#check chosenFubini_leftUnitor
#check chosenFubini_rightUnitor
#check chosenLeftStrength_eq
#check chosenRightStrength_eq
#check UnseparatedStrongCommutativeMonad
#check omegaScottUnseparatedStrongCommutativeMonad

example :
    UnseparatedStrongCommutativeMonad :=
  omegaScottUnseparatedStrongCommutativeMonad

end Cantilune.Tests.FMSCpoOmegaScottChosenCoherence
