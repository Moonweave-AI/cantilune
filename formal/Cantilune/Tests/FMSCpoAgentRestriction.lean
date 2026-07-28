import Cantilune.Pi.FMSCpoAgentRestriction

/-!
Regression checks for the concrete recursive FMS restriction.

The implementation is in `Cantilune.Pi.FMSCpoAgentRestriction`; this file
only instantiates its public construction and equations.
-/

noncomputable section

namespace Cantilune.Tests.FMSCpoAgentRestriction

open CategoryTheory
open CategoryTheory.Endofunctor
open Cantilune.Pi.FMSModel
open Cantilune.Pi.FMSCpoActionFunctor
open Cantilune.Pi.FMSCpoActualDomainEquationBoundary
open Cantilune.Pi.FMSCpoAgentRestriction
open Cantilune.Pi.FMSCpoOmegaScottPower
open Cantilune.Pi.FMSCpoWorld

example
    {source target : World}
    (injection : source ⟶ target)
    (action : ActionRepresentation Agent (source + 1)) :
    actionRestrictionStep target
        (actionWorldMap Agent (successorMap injection) action) =
      mapRaw (actionWorldMap ShiftAgent injection)
        (actionRestrictionStep source action) :=
  actionRestrictionStep_natural injection action

example
    {source target : World}
    (injection : source ⟶ target)
    (values :
      OmegaScottPower
        (ActionRepresentation Agent (source + 1))) :
    actionRestrictionKleisli target
        (mapRaw
          (actionWorldMap Agent
            (successorMap injection))
          values) =
      mapRaw (actionWorldMap ShiftAgent injection)
        (actionRestrictionKleisli source values) :=
  actionRestrictionKleisli_natural injection values

example : ShiftAgent ⟶ Agent :=
  agentRestriction

example
    {source target : World}
    (injection : source ⟶ target) :
    ShiftAgent.map injection ≫
        agentRestrictionAt target =
      agentRestrictionAt source ≫
        Agent.map injection :=
  agentRestriction_world_natural injection

example :
    restrictionCoalgebra.str ≫
        ActualAgentFunctor.map agentRestriction =
      agentRestriction ≫ agentUnfold :=
  agentRestriction_unroll

example
    (candidate : ShiftAgent ⟶ Agent)
    (unroll :
      restrictionCoalgebra.str ≫
          ActualAgentFunctor.map candidate =
        candidate ≫ agentUnfold) :
    candidate = agentRestriction :=
  agentRestriction_unique candidate unroll

#print axioms actionRestrictionStep_natural
#print axioms actionRestrictionKleisli_natural
#print axioms agentRestriction_world_natural
#print axioms agentRestriction_unroll
#print axioms agentRestriction_unique

end Cantilune.Tests.FMSCpoAgentRestriction
