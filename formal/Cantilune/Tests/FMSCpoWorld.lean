import Cantilune.Pi.FMSCpoWorld

namespace Cantilune.Tests.FMSCpoWorld

open Cantilune.Pi.FMSModel
open Cantilune.Pi.FMSCpoWorld

example :
    dropFresh 2 ({0, 2} : Set (Fin 3)) =
      ({0} : Set (Fin 2)) := by
  ext value
  fin_cases value <;> simp [dropFresh]

example (support : Set (Fin 3)) :
    supportHiding.app 2 support =
      Set.preimage Fin.castSucc support :=
  supportHiding_app 2 support

example (support : Set (Fin 2)) :
    (Cantilune.Pi.FMSCpoWorld.allocate cpoAgent).app 2 support =
      Fin.castSucc '' support :=
  rfl

end Cantilune.Tests.FMSCpoWorld
