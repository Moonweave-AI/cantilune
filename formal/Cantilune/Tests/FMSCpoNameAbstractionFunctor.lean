import Cantilune.Pi.FMSCpoNameAbstractionFunctor

/-!
Kernel regression checks for the genuine name-abstraction endofunctor.
-/

noncomputable section

namespace Cantilune.Tests.FMSCpoNameAbstractionFunctor

open CategoryTheory
open Cantilune.Pi.FMSModel
open Cantilune.Pi.FMSCpoNameAbstractionFunctor

example :
    (World ⥤ ωCPO) ⥤ (World ⥤ ωCPO) :=
  nameAbstractionFunctor

example
    (model : World ⥤ ωCPO)
    {first second third : World}
    (left : first ⟶ second)
    (right : second ⟶ third) :
    (nameAbstractionFunctor.obj model).map
        (left ≫ right) =
      (nameAbstractionFunctor.obj model).map left ≫
        (nameAbstractionFunctor.obj model).map right :=
  (nameAbstractionFunctor.obj model).map_comp
    left right

example
    {source target : World ⥤ ωCPO}
    (transformation : source ⟶ target)
    {first second : World}
    (injection : first ⟶ second) :
    (nameAbstractionFunctor.obj source).map injection ≫
        (nameAbstractionFunctor.map transformation).app second =
      (nameAbstractionFunctor.map transformation).app first ≫
        (nameAbstractionFunctor.obj target).map injection :=
  (nameAbstractionFunctor.map transformation).naturality
    injection

end Cantilune.Tests.FMSCpoNameAbstractionFunctor
