import Cantilune.Pi.FMSFinitePower

namespace Cantilune.Tests.FMSFinitePower

open Cantilune.Pi.FMSFinitePower

noncomputable section

open scoped Classical

example (value : Nat) :
    finitePowerMonad.η.app Nat value = ({value} : Finset Nat) :=
  finitePower_unit_apply value

example (sets : Finset (Finset Nat)) :
    finitePowerMonad.μ.app Nat sets = flatten sets :=
  finitePower_mu_apply sets

example :
    (({1, 2} : Finset Nat) >>= fun value => {value, value + 10}) =
      {1, 2, 11, 12} := by
  ext value
  simp [Finset.bind_def]
  omega

def maxCandidate (values : Finset Nat) : Nat :=
  values.sup id

example :
    maxCandidate = lift id :=
  rfl

example [SemilatticeSup β] [OrderBot β]
    (generator : α → β) (candidate : Finset α → β)
    (emptyLaw : candidate ∅ = ⊥)
    (unionLaw :
      ∀ left right,
        candidate (left ∪ right) = candidate left ⊔ candidate right)
    (singletonLaw : ∀ value, candidate {value} = generator value) :
    candidate = lift generator :=
  lift_unique generator candidate emptyLaw unionLaw singletonLaw

end

end Cantilune.Tests.FMSFinitePower
