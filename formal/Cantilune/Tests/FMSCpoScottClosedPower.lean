import Cantilune.Pi.FMSCpoScottClosedPower

/-!
# Scott-closed power candidate regression

The checks expose the exact positive carrier/continuity results, the stronger
hypothesis on direct-image functoriality, and the separated strict-flattening
no-go.  This is not an Abramsky-powerdomain acceptance test.
-/

noncomputable section

namespace Cantilune.Tests.FMSCpoScottClosedPower

open OmegaCompletePartialOrder
open Topology
open Cantilune.Pi.FMSCpoScottClosedPower

#check ScottPower
#check isLowerSet
#check dirSupClosed
#check omegaSup_mem
#check omegaSup_eq_closure_iUnion
#check principalRaw_map_omegaSup
#check principal
#check choice
#check flattenRaw_le_iff
#check flattenRaw_map_omegaSup
#check flattenRaw_principal

-- These direct-image laws explicitly require full Scott-topological
-- continuity, not only a generic omega-CPO `ContinuousHom`.
#check mapRaw_le_iff
#check mapRaw_map_omegaSup
#check mapRaw_comp

#check divergence_ne_deadlock
#check separatedPrincipal

-- Exact no-go: strictness on every embedded family containing divergence
-- conflicts with the principal unit equation at returned deadlock.
#check no_strict_separated_flatten_with_principal_unit

example (chain : Chain ℕ∞) :
    principalRaw (ωSup chain) =
      ωSup (chain.map principalOrderHom) :=
  principalRaw_map_omegaSup chain

example :
    divergence Bool ≠ deadlock Bool :=
  divergence_ne_deadlock Bool

end Cantilune.Tests.FMSCpoScottClosedPower
