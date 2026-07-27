import Cantilune.Pi.FMSExternalPackage

/-!
# The order-theoretic boundary of the FMS powerdomain package

The FMS construction uses Abramsky's category of nondeterministic
computations.  Its objects carry two different constants: the order-theoretic
least element `⊥` and the semilattice identity `0`.  This file gives a small
kernel-checked counterexample showing why a continuous semilattice record
alone cannot recover the missing least element.
-/

noncomputable section

namespace Cantilune.Pi.FMSPowerdomainBoundary

open Cantilune.Pi.FMSExternalPackage
open OmegaCompletePartialOrder

/--
Conjunction on ordered booleans is a continuous semilattice operation with
identity `true`.
-/
def meetSemilattice : ContinuousJoinSemilattice where
  carrier := ωCPO.of Bool
  bottom := true
  choice :=
    ContinuousHom.ofFun
      (fun pair : Bool × Bool => pair.1 ⊓ pair.2)
      (CompleteLattice.ωScottContinuous.inf
        (Prod.ωScottContinuous_fst :
          ωScottContinuous (Prod.fst : Bool × Bool → Bool))
        (Prod.ωScottContinuous_snd :
          ωScottContinuous (Prod.snd : Bool × Bool → Bool)))
  choice_assoc := by decide
  choice_comm := by decide
  choice_idem := by decide
  bottom_choice := by decide

/--
The semilattice identity need not be the order-theoretic least element:
`true` is not below `false`.  Consequently the older one-constant interface
cannot by itself express an object `(D, ⊥, 0, ∪)` of `ND(Cpo)`.
-/
theorem continuous_semilattice_identity_need_not_be_least :
    ¬ ∀ value : meetSemilattice.carrier,
        meetSemilattice.bottom ≤ value := by
  intro least
  have impossible := least false
  have notOrdered : ¬ true ≤ false := by decide
  exact notOrdered impossible

end Cantilune.Pi.FMSPowerdomainBoundary
