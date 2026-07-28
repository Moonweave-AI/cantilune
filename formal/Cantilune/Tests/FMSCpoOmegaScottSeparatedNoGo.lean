import Cantilune.Pi.FMSCpoOmegaScottSeparatedNoGo

/-!
# Naive separated omega-Scott multiplication regression

These checks expose the exact `WithBot` order obstruction.  They do not claim
that every separated powerdomain construction is impossible.
-/

noncomputable section

namespace Cantilune.Tests.FMSCpoOmegaScottSeparatedNoGo

open OmegaCompletePartialOrder
open Cantilune.Pi.FMSCpoOmegaScottSeparatedNoGo

#check divergence_lt_deadlock
#check omegaMapRaw_bot
#check naiveMapRaw_monotone
#check naiveMapUnit_deadlock
#check unitAtDivergence_eq_embeddedPrincipalDivergence
#check embeddedEmptyFamily_le_embeddedPrincipalDivergence
#check no_monotone_multiplication_with_unit_equations

example :
    embeddedEmptyFamily Bool ≤
      embeddedPrincipalDivergence Bool :=
  embeddedEmptyFamily_le_embeddedPrincipalDivergence Bool

example :
    ¬ ∃ multiplication :
        NaiveSeparatedPower (NaiveSeparatedPower Bool) →
          NaiveSeparatedPower Bool,
      Monotone multiplication ∧
      LeftUnitAtDivergence multiplication ∧
      RightUnitAtDeadlock multiplication :=
  no_monotone_multiplication_with_unit_equations Bool

end Cantilune.Tests.FMSCpoOmegaScottSeparatedNoGo
