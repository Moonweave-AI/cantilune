import Cantilune.Pi.FMSCpoActualDomainEquationBoundary

/-!
Kernel checks for the actual FMS domain-equation boundary.
-/

noncomputable section

namespace Cantilune.Tests.FMSCpoActualDomainEquationBoundary

open CategoryTheory
open CategoryTheory.Limits
open Cantilune.Pi.FMSModel
open Cantilune.Pi.FMSExternalPackage
open Cantilune.Pi.FMSCpoFiniteApproximationTower
open Cantilune.Pi.FMSCpoActualDomainEquationBoundary

#check ActualAgentFunctor
#check ActualFixedPointWitness
#check ActualAlgebraicCompactnessWitness
#check ActualAgentDomainBridge
#check CompleteAcceptanceExtension

example :
    EndofunctorLocallyContinuous ActualAgentFunctor :=
  actualAgentFunctor_locallyContinuous

example (witness : ActualFixedPointWitness) :
    ActualAgentFunctor.obj witness.agent ≅ witness.agent :=
  witness.foldIso

example (witness : ActualFixedPointWitness)
    {source target : World} (injection : source ⟶ target) :
    witness.agent.map injection ≫
        (witness.unfoldAt target).hom =
      (witness.unfoldAt source).hom ≫
        (ActualAgentFunctor.obj witness.agent).map injection :=
  witness.unfold_world_natural injection

example (witness : ActualAlgebraicCompactnessWitness) :
    IsIso witness.fixed.algebra.str :=
  witness.initial_fold_isIso

example {power : CpoPowerdomainPackage}
    {witness : ActualAlgebraicCompactnessWitness}
    (bridge : ActualAgentDomainBridge power witness) :
    AgentDomainSolution power :=
  bridge.toAgentDomainSolution

example :
    ¬ ∃ backward : Approximation 1 ⟶ Approximation 0,
        approximationConnection 0 ≫ backward =
          𝟙 (Approximation 0) :=
  finiteTowerSeed_hasNoRetraction

example :
    IsEmpty
      (Approximation 0 ≅
        ActualAgentFunctor.obj (Approximation 0)) :=
  initialStage_not_fixedPoint

example (witness : ActualFixedPointWitness) :
    witness.agent ≠ Approximation 0 :=
  fixedPoint_agent_ne_initialStage witness

end Cantilune.Tests.FMSCpoActualDomainEquationBoundary
