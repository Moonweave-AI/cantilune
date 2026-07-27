import Cantilune.Pi.FMSCpoFiniteStrictPower

namespace Cantilune.Tests.FMSCpoFiniteStrictPower

open CategoryTheory
open Cantilune.Pi.FMSCpoFiniteStrictPower

#check finite_chain_reaches_ωSup
#check continuousOfFiniteMonotone
#check strictFiniteComputation
#check strictFiniteComputation_separates_nullaries
#check map_id
#check map_comp
#check map_singleton
#check no_continuous_ordered_bool_singleton
#check punit_three_stage_chain

example :
    (strictFiniteComputation PUnit).divergence ≠
      (strictFiniteComputation PUnit).deadlock :=
  strictFiniteComputation_separates_nullaries PUnit

example :
    divergence PUnit < deadlock PUnit ∧
      deadlock PUnit <
        (↑({PUnit.unit} : Set PUnit) :
          StrictFinitePower PUnit) :=
  punit_three_stage_chain

example :
    ¬ ∃ unit : Bool →𝒄 StrictFinitePower Bool,
      ∀ value, unit value =
        (↑({value} : Set Bool) : StrictFinitePower Bool) :=
  no_continuous_ordered_bool_singleton

end Cantilune.Tests.FMSCpoFiniteStrictPower
