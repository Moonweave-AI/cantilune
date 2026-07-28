import Cantilune.Pi.FMSCpoFiniteAgent

namespace Cantilune.Tests.FMSCpoFiniteAgent

open Cantilune.Pi.FMSFiniteAgent
open Cantilune.Pi.FMSCpoFiniteAgent

def sample : Agent 1 :=
  .choice .zero (.prefix (.tau .zero))

example :
    (agentLayerIso 1).inv ((agentLayerIso 1).hom sample) = sample := by
  rfl

example : agentHeight sample = 2 := by
  rfl

def heightCocone : HeightCocone 1 Nat where
  leg _ agent := agentHeight agent.1
  compatible := by
    intro first second bound agent
    rfl

example :
    heightCocone.lift sample = agentHeight sample :=
  rfl

example (depth : Nat) (agent : BoundedAgent depth 1) :
    heightCocone.lift agent.1 = heightCocone.leg depth agent :=
  HeightCocone.lift_stage heightCocone depth agent

end Cantilune.Tests.FMSCpoFiniteAgent
