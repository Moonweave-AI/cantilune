import Cantilune.Pi.FMSCpoSupportedTotalOperationalCoalgebra

/-! Kernel regressions for the total finite-control supported coalgebra. -/

noncomputable section

namespace Cantilune.Tests.FMSCpoSupportedTotalOperationalCoalgebra

open CategoryTheory
open OmegaCompletePartialOrder
open Cantilune.Pi
open Cantilune.Pi.FMSContext
open Cantilune.Pi.FMSCpoContext
open Cantilune.Pi.FMSCpoActionFunctor
open Cantilune.Pi.FMSCpoOmegaScottPower
open Cantilune.Pi.FMSCpoActualDomainEquationBoundary
open Cantilune.Pi.FMSCpoAgentRestriction
open Cantilune.Pi.FMSCpoSupportedActualAgent
open Cantilune.Pi.FMSCpoSupportedParallelRestriction
open Cantilune.Pi.FMSCpoSupportedTotalOperationalCoalgebra

example :
    totalSupportedCoalgebra.V = processCpoModel :=
  rfl

example :
    totalSupportedCoalgebra.str =
      totalSupportedOneStep :=
  rfl

example :
    totalSupportedOneStep ≫
        ActualAgentFunctor.map totalSupportedDenote =
      totalSupportedDenote ≫ agentUnfold :=
  totalSupportedDenote_unroll

example (world : Nat)
    (left right : SupportedProc world 0) :
    totalSupportedLayer world (.parallel left right) =
      totalParallelLayerFrom world left right
        (totalSupportedLayerFuel
          (max (processHeight left) (processHeight right))
          world left)
        (totalSupportedLayerFuel
          (max (processHeight left) (processHeight right))
          world right) :=
  totalSupportedLayer_parallel world left right

example (world : Nat) (channel value : Fin world) :
    totalSupportedLayer world
        (.choice
          (.tau .zero)
          (.output (.free channel) (.free value) .zero)) =
      principalRaw (syntaxTauAction world .zero) ⊔
        principalRaw
          (syntaxFreeOutputAction world channel value .zero) := by
  rfl

example (world : Nat) (channel : Fin world)
    (next : SupportedProc world 0) :
    totalSupportedLayer world
        (.matchEq (.free channel) (.free channel) next) =
      totalSupportedLayer world next := by
  simp [totalSupportedLayer, processHeight,
    totalSupportedLayerFuel, closedName]

example (world : Nat)
    (channel : NameTag world)
    (known : Fin world → processCpoModel.obj world)
    (fresh next : processCpoModel.obj (world + 1)) :
    closeSynchronizationLayer world
        (principalRaw
          (Sum.inl (channel, (known, fresh))))
        (principalRaw
          (Sum.inr (Sum.inr
            (Sum.inl (channel, next))))) =
      principalRaw
        (syntaxTauAction world
          (FMSCanonicalHidingSyntax.SupportedProc.restrictLast
            (.parallel fresh next))) :=
  closeSynchronization_principal_input_boundOutput
    world channel known fresh next

example (world : Nat) (channel : Fin world)
    (next : SupportedProc world 1) :
    totalSupportedLayer world
        (.restrict
          (.output
            (.free channel)
            (.bound (Fin.last 0))
            next)) =
      principalRaw
        (syntaxBoundOutputAction world channel
          (FMSBinderInstantiation.SupportedProc.freshenOuter next)) :=
  totalSupportedLayer_restriction_extrusion
    world channel next

example (world : Nat) (next : SupportedProc world 0) :
    agentUnfold.app world
        (totalSupportedDenote.app world (.tau next)) =
      principalRaw
        (FMSCpoAgentOperationalBridge.tauAction world
          (totalSupportedDenote.app world next)) :=
  totalSupportedDenote_tau_unfold world next

#check totalSupportedLayer_natural
#check totalSupportedDenote_unroll_at
#check totalSupportedDenote_unique
#check total_restriction_extrusion_native

#print axioms totalSupportedLayer_natural
#print axioms totalSupportedDenote_unroll
#print axioms totalSupportedDenote_unique
#print axioms closeSynchronization_principal_input_boundOutput
#print axioms totalSupportedLayer_restriction_extrusion
#print axioms total_restriction_extrusion_native

end Cantilune.Tests.FMSCpoSupportedTotalOperationalCoalgebra
