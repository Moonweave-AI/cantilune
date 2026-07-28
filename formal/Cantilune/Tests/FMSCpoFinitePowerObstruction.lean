import Cantilune.Pi.FMSCpoFinitePowerObstruction

namespace Cantilune.Tests.FMSCpoFinitePowerObstruction

open CategoryTheory
open Cantilune.Pi.FMSCpoFinitePowerObstruction

example :
    ¬ ∃ unit :
        Bool →𝒄
          Cantilune.Pi.FMSCpoFinitePower.EqualityOrder (Finset Bool),
      ∀ value, unit value = ({value} : Finset Bool) :=
  no_continuous_bool_singleton

example :
    ¬ Nonempty NaiveSingletonUnit :=
  no_naive_singleton_unit

example :
    ¬ Nonempty NaivePointwiseSingletonUnit :=
  no_naive_pointwise_singleton_unit

example
    (candidate : NaivePointwiseSingletonUnit)
    (model :
      Cantilune.Pi.FMSModel.World ⥤ ωCPO.{0})
    (world : Cantilune.Pi.FMSModel.World)
    {left right : model.obj world}
    (ordered : left ≤ right) :
    left = right :=
  candidate.order_eq model world ordered

end Cantilune.Tests.FMSCpoFinitePowerObstruction
