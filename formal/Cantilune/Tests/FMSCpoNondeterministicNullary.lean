import Cantilune.Pi.FMSCpoNondeterministicNullary

namespace Cantilune.Tests.FMSCpoNondeterministicNullary

open CategoryTheory.Limits
open Cantilune.Pi.FMSCpoNondeterministicCategory
open Cantilune.Pi.FMSCpoNondeterministicNullary

#check NDωCPO.nullaryObject
#check NDωCPO.nullary_divergence_ne_deadlock
#check NDωCPO.nullaryTo
#check NDωCPO.nullaryTo_unique
#check NDωCPO.nullaryIsInitial

#print axioms NDωCPO.nullary_divergence_ne_deadlock
#print axioms NDωCPO.nullaryTo_unique
#print axioms NDωCPO.nullaryIsInitial

end Cantilune.Tests.FMSCpoNondeterministicNullary
