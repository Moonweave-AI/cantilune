import Cantilune.Pi.FMSCpoNondeterministicUnary

noncomputable section

namespace Cantilune.Tests.FMSCpoNondeterministicUnary

open CategoryTheory
open CategoryTheory.Limits
open Cantilune.Pi.FMSCpoNondeterministicUnary

#check Unary.Carrier
#check Unary.object
#check Unary.divergence_ne_deadlock
#check Unary.universalArrow
#check Unary.universalIsInitial
#check Unary.source_solutionSet

#print axioms Unary.universalIsInitial
#print axioms Unary.source_solutionSet

example :
    IsInitial Unary.universalArrow :=
  Unary.universalIsInitial

end Cantilune.Tests.FMSCpoNondeterministicUnary
