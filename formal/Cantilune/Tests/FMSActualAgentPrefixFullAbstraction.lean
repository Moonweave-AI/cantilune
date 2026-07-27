import Cantilune.Pi.FMSActualAgentPrefixFullAbstraction

namespace Cantilune.Tests.FMSActualAgentPrefixFullAbstraction

open Cantilune.Pi
open Cantilune.Pi.FMSActualAgentPrefixFullAbstraction
open Cantilune.Pi.FMSCpoOmegaScottPower

example : PrefixTrie 0 0 :=
  .dead

example {world leftDepth rightDepth : Nat}
    (left : PrefixTrie world leftDepth)
    (right : PrefixTrie world rightDepth) :
    left.denote = right.denote ↔
      PrefixOperationallyEquivalent left right :=
  actualAgent_prefix_full_abstraction left right

example {world : Nat}
    (point : CompactPrefixPoint world) :
    Cantilune.Pi.FMSCpoSupportedActualAgent.supportedDenote.app
        world point.compile =
      point.realize :=
  compactPrefix_compile_denote point

example :
    principalRaw
        (leftContinuation ⊔ rightContinuation) ≠
      principalRaw leftContinuation ⊔
        principalRaw rightContinuation :=
  concrete_same_head_branching_no_go

example (word : PrefixWord 0) :
    AgentObserves guardedTauLimit word ↔
      ∃ depth,
        (guardedTauApprox depth).NativeObserves word :=
  guardedTau_limit_finite_observation word

example :
    Cantilune.Pi.FMSCpoAgentOperationalBridge.fixedTauAgent
        0 guardedTauLimit =
      guardedTauLimit :=
  guardedTauLimit_fixed

example :
    guardedTauLimit ≠
      Cantilune.Pi.FMSCpoAgentOperationalBridge.fixedInactive 0 :=
  guardedTauLimit_ne_inactive

#print axioms nativePrefixPath_compile_iff
#print axioms actualAgent_native_prefix_adequacy
#print axioms actualAgent_prefix_full_abstraction
#print axioms compactPrefix_compile_denote
#print axioms concrete_same_head_branching_no_go
#print axioms concrete_same_head_may_equivalent
#print axioms guardedTauLimit_fixed
#print axioms guardedTau_limit_finite_observation
#print axioms guardedTauLimit_ne_inactive

end Cantilune.Tests.FMSActualAgentPrefixFullAbstraction
