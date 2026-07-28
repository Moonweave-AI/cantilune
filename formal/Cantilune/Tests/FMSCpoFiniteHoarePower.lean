import Cantilune.Pi.FMSCpoFiniteHoarePower

/-!
# Finite Hoare powerdomain regression

These checks keep the genuine finite, order-sensitive omega-CPO fragment
visible without promoting it to the all-omega-CPO FMS powerdomain.
-/

namespace Cantilune.Tests.FMSCpoFiniteHoarePower

open Cantilune.Pi.FMSCpoFiniteHoarePower

#check hoareOmegaCompletePartialOrder
#check principal
#check choice
#check map
#check flatten
#check choice_assoc
#check map_id
#check map_comp
#check flatten_principal
#check flatten_mapRaw_principal
#check principal_strict

end Cantilune.Tests.FMSCpoFiniteHoarePower
