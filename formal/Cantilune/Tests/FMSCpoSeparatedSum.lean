import Cantilune.Pi.FMSCpoSeparatedSum

/-!
Kernel regression checks for separated omega-CPO coproducts.
-/

noncomputable section

namespace Cantilune.Tests.FMSCpoSeparatedSum

open OmegaCompletePartialOrder
open Cantilune.Pi.FMSCpoSeparatedSum

example :
    OmegaCompletePartialOrder
      (Set (Fin 1) ⊕ Set (Fin 2)) :=
  inferInstance

example
    (left : Set (Fin 1) →𝒄 Set (Fin 2))
    (right : Set (Fin 3) →𝒄 Set (Fin 4)) :
    (Set (Fin 1) ⊕ Set (Fin 3)) →𝒄
      (Set (Fin 2) ⊕ Set (Fin 4)) :=
  map left right

end Cantilune.Tests.FMSCpoSeparatedSum
