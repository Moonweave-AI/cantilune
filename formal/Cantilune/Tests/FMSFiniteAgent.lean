import Cantilune.Pi.FMSFiniteAgent

namespace Cantilune.Tests.FMSFiniteAgent

open Cantilune.Pi.FMSFiniteAgent

def smallAgent : Agent 1 :=
  .choice .zero (.prefix (.tau .zero))

example :
    Agent.refold smallAgent.unfold = smallAgent :=
  Agent.refold_unfold smallAgent

example (agent : ChoiceQuotient 3) :
    quotientChoice agent agent = agent :=
  quotientChoice_idem agent

example (left right : ChoiceQuotient 2) :
    quotientChoice left right = quotientChoice right left :=
  quotientChoice_comm left right

example (depth world : Nat) :
    Approximation.unfold
        (Approximation.zero depth world) =
      (∅ :
        Finset
          (ActionShape (Approximation depth) world)) :=
  rfl

end Cantilune.Tests.FMSFiniteAgent
