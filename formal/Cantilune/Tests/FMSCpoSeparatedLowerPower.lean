import Cantilune.Pi.FMSCpoSeparatedLowerPower

/-!
# Separated lower-set lifting regression

These checks expose the exact positive fragment and both no-go boundaries.
The construction separates divergence from empty deadlock and is a continuous
endofunctor with natural principal unit on finite omega-CPOs.  It is not an
Abramsky powerdomain and is not a monad.
-/

noncomputable section

namespace Cantilune.Tests.FMSCpoSeparatedLowerPower

open CategoryTheory
open Cantilune.Pi.FMSCpoFiniteHoareMonad
open Cantilune.Pi.FMSCpoSeparatedLowerPower

#check SeparatedLowerPower
#check finiteSeparatedComputation
#check finiteSeparatedFunctor
#check finiteSeparatedUnit
#check finiteSeparatedFunctor_map_divergence
#check finiteSeparatedFunctor_map_deadlock
#check nonempty_lowerSet_contains_bottom

-- Exact no-go 1: strict-on-contained-divergence flattening is incompatible
-- with the principal unit equation, already at returned deadlock.
#check no_strict_flatten_with_principal_unit

-- Exact no-go 2: principal lower-set return is not omega-continuous on the
-- extended-natural chain `0 ≤ 1 ≤ ... ≤ ⊤`.
#check no_continuous_principal_on_natLimit

example :
    divergence Bool ≠ deadlock Bool :=
  divergence_ne_deadlock Bool

example :
    finiteSeparatedFunctor.map (𝟙 (⟨ωCPO.of Bool,
      show Finite Bool from inferInstance⟩ : FiniteCPO))
        (divergence Bool) =
      divergence Bool := by
  simp

end Cantilune.Tests.FMSCpoSeparatedLowerPower
