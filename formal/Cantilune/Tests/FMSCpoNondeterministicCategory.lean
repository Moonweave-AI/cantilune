import Cantilune.Pi.FMSCpoNondeterministicCategory

namespace Cantilune.Tests.FMSCpoNondeterministicCategory

open CategoryTheory
open Cantilune.Pi.FMSExternalPackage
open Cantilune.Pi.FMSCpoNondeterministicCategory

#check NDωCPO
#check NDωCPO.Hom
#check NDωCPO.forget
#check NDωCPO.freeFunctor
#check NDωCPO.freeForgetHomEquiv
#check NDωCPO.freeForgetAdjunction
#check NDωCPO.lift_restrict
#check NDωCPO.restrict_lift
#check NDωCPO.lift_precomp
#check NDωCPO.restrict_postcomp
#check NDωCPO.freeForgetAdjunction_homEquiv_apply

#print axioms NDωCPO.freeForgetHomEquiv
#print axioms NDωCPO.lift_precomp
#print axioms NDωCPO.freeForgetAdjunction

example (power : CpoPowerdomainPackage) :
    NDωCPO.freeFunctor power ⊣ NDωCPO.forget :=
  NDωCPO.freeForgetAdjunction power

end Cantilune.Tests.FMSCpoNondeterministicCategory
