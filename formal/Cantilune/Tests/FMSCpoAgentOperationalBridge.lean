import Cantilune.Pi.FMSCpoAgentOperationalBridge

/-! Kernel regression checks for the concrete D1-A operational bridge. -/

noncomputable section

namespace Cantilune.Tests.FMSCpoAgentOperationalBridge

open Cantilune.Pi
open Cantilune.Pi.FMSModel
open Cantilune.Pi.FMSCpoAgentRestriction
open Cantilune.Pi.FMSCpoAgentOperationalBridge

example (world : World) :
    agentUnfold.app world (fixedInactive world) =
      fixedBottomLayer world :=
  fixedInactive_unfold world

example (world : World) (continuation : Agent.obj world) :
    agentUnfold.app world (fixedTauAgent world continuation) =
      fixedTauLayer world continuation :=
  fixedTauAgent_unfold world continuation

example (world : World) :
    Late.NativeStep
      reconnectSourceProcess reconnectAction reconnectTargetProcess ∧
      reconnectAction = .tau ∧
      agentUnfold.app world (reconnectSourceAgent world) =
        FMSCpoOmegaScottPower.principalRaw
          (tauAction world (reconnectTargetAgent world)) ∧
      agentUnfold.app world (reconnectTargetAgent world) =
        fixedBottomLayer world :=
  reconnect_fixed_point_action_commutes world

example (world : World) :
    agentRestrictionAt world (reconnectSourceAgent (world + 1)) =
        reconnectSourceAgent world ∧
      agentRestrictionAt world (reconnectTargetAgent (world + 1)) =
        reconnectTargetAgent world :=
  reconnect_restriction_commutes world

#print axioms fixedInactive_unfold
#print axioms fixedTauAgent_unfold
#print axioms fixedTauAgent_world_natural
#print axioms reconnect_native
#print axioms reconnect_fixed_point_action_commutes
#print axioms agentRestriction_fixedTau
#print axioms agentRestriction_fixedInactive
#print axioms reconnect_restriction_commutes

end Cantilune.Tests.FMSCpoAgentOperationalBridge
