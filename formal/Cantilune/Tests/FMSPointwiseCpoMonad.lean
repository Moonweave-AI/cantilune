import Cantilune.Pi.FMSPointwiseCpoMonad

/-!
# Pointwise CPO monad regressions
-/

namespace Cantilune.Tests.FMSPointwiseCpoMonad

open CategoryTheory
open Cantilune.Pi
open Cantilune.Pi.FMSModel
open Cantilune.Pi.FMSPointwiseCpoMonad

#check pointwiseCpoMonad
#check pointwise_unit_app
#check pointwise_multiplication_app

example
    (base : CategoryTheory.Monad ωCPO) :
    CategoryTheory.Monad (World ⥤ ωCPO) :=
  pointwiseCpoMonad base

end Cantilune.Tests.FMSPointwiseCpoMonad
