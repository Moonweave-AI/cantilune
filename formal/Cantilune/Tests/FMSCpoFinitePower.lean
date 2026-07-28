import Cantilune.Pi.FMSCpoFinitePower

namespace Cantilune.Tests.FMSCpoFinitePower

open Cantilune.Pi.FMSCpoFinitePower
open Cantilune.Pi.FMSFinitePower

noncomputable section

open scoped Classical

def naturals : DiscreteCPO := ⟨Nat⟩

example (value : Nat) :
    Cantilune.Pi.FMSCpoFinitePower.finitePowerMonad.η.app naturals value =
      ({value} : Finset Nat) :=
  unit_apply naturals value

example :
    fubini ({1, 2} : Finset Nat) ({3, 4} : Finset Nat) =
      ({(1, 3), (1, 4), (2, 3), (2, 4)} :
        Finset (Nat × Nat)) := by
  ext pair
  simp [fubini]
  aesop

example (left : Finset (Finset Nat))
    (right : Finset (Finset Bool)) :=
  fubini_multiplication left right

end

end Cantilune.Tests.FMSCpoFinitePower
