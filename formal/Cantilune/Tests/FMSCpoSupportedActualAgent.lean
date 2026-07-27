import Cantilune.Pi.FMSCpoSupportedActualAgent

/-! Kernel smoke tests for the direct supported-syntax/actual-Agent bridge. -/

namespace Cantilune.Tests.FMSCpoSupportedActualAgent

open CategoryTheory
open Cantilune.Pi
open Cantilune.Pi.FMSContext
open Cantilune.Pi.FMSCpoContext
open Cantilune.Pi.FMSCpoSupportedActualAgent
open Cantilune.Pi.FMSCpoAgentOperationalBridge

example :
    supportedCoalgebra.str = supportedOneStep :=
  rfl

example :
    supportedCoalgebra.V = processCpoModel :=
  rfl

example :
    supportedOneStep ≫
        Cantilune.Pi.FMSCpoActualDomainEquationBoundary.ActualAgentFunctor.map
          supportedDenote =
      supportedDenote ≫
        Cantilune.Pi.FMSCpoAgentRestriction.agentUnfold :=
  supportedDenote_unroll

example (world : Nat) (next : SupportedProc world 0) :
    Late.NativeStep
      (FMSOperationalSyntaxBridge.SupportedProc.reifyAtWorld (.tau next))
      .tau
      (FMSOperationalSyntaxBridge.SupportedProc.reifyAtWorld next) :=
  tau_reification_native world next

example (world : Nat) (next : SupportedProc world 0) :
    supportedDenote.app world (.tau next) =
      fixedTauAgent world
        (supportedDenote.app world next) :=
  supportedDenote_tau world next

example (world : Nat) (channel : Fin world)
    (next : SupportedProc world 1) :
    Late.NativeStep
      (FMSOperationalSyntaxBridge.SupportedProc.reifyAtWorld
        (.restrict
          (.output
            (.free channel)
            (.bound (Fin.last 0))
            next)))
      (.boundOutput channel.val world)
      (inputReificationTarget world next) :=
  boundOutput_reification_native world channel next

example (world : Nat)
    (left right : SupportedProc world 0) :
    supportedHeadLayer world (.parallel left right) = ⊥ :=
  parallel_head_is_bottom world left right

#print axioms supportedHeadLayer_natural
#print axioms supportedDenote_unroll
#print axioms supportedDenote_unique
#print axioms supportedDenote_input
#print axioms supportedDenote_choice
#print axioms boundOutput_reification_native

end Cantilune.Tests.FMSCpoSupportedActualAgent
