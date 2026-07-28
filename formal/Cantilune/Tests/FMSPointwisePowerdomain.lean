import Cantilune.Pi.FMSPointwisePowerdomain

/-!
# Regression checks for the conditional pointwise CPO powerdomain lift
-/

namespace Cantilune.Tests.FMSPointwisePowerdomain

open CategoryTheory
open Cantilune.Pi.FMSModel
open Cantilune.Pi.FMSExternalPackage
open Cantilune.Pi.FMSPointwisePowerdomain

example (power : CpoPowerdomainPackage) :
    CategoryTheory.Monad (World ⥤ ωCPO) :=
  monad power

example (power : CpoPowerdomainPackage)
    (model : World ⥤ ωCPO) :
    PointwiseNondeterministicModel (I := World) :=
  computation power model

example (power : CpoPowerdomainPackage)
    (model : World ⥤ ωCPO) (world : World) :
    (computation power model).divergence world ≠
      (computation power model).deadlock world :=
  (computation power model).divergence_ne_deadlock world

example (power : CpoPowerdomainPackage)
    (left right : World ⥤ ωCPO) :
    PointwiseFubini power left right :=
  fubini power left right

end Cantilune.Tests.FMSPointwisePowerdomain
