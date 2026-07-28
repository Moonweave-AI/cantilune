import Cantilune.Pi.FMSGuardedHoareTrace

namespace Cantilune.Tests.FMSGuardedHoareTrace

open Cantilune.Pi
open Cantilune.Pi.FMSGuardedHoareTrace
open Cantilune.Pi.FMSCpoOmegaScottPower

#check guarded_hoare_adequacy
#check guarded_hoare_full_abstraction
#check denote_zero
#check effectChoice_le_denote_choice
#check tauPrefixEffect_le_denote_tau
#check denote_repTau_ne_bottom
#check guarded_divergence_deadlock_separated_above_effect

def tauZero : RecursiveProc :=
  .tau .zero

example :
    Observes tauZero [.tau] :=
  ⟨.zero, NativeTrace.one
    RecursiveLate.NativeStep.prefixTau⟩

example :
    WithOmegaScott.toOmegaScott
          (show FMSCpoFinitePower.EqualityOrder
              (List Raw.Action) from [.tau]) ∈
        carrier (denote tauZero) := by
  rw [mem_denote_iff]
  exact
    ⟨.zero, NativeTrace.one
      RecursiveLate.NativeStep.prefixTau⟩

example :
    FMSCpoUnseparatedSourceCore.effectChoice
        TraceCPO
        (denote tauZero)
        (denote (.send 3 5 .zero)) ≤
      denote (.choice tauZero (.send 3 5 .zero)) :=
  effectChoice_le_denote_choice _ _

example :
    tauPrefixEffect (denote (.zero : RecursiveProc)) ≤
      denote tauZero :=
  tauPrefixEffect_le_denote_tau _

example (body : RecursiveProc) :
    denote (.zero : RecursiveProc) ≠
      denote (.repTau body) := by
  intro equal
  exact denote_repTau_ne_bottom body
    (equal ▸ denote_zero)

#print axioms guarded_hoare_adequacy
#print axioms guarded_hoare_full_abstraction
#print axioms guarded_divergence_deadlock_separated_above_effect

end Cantilune.Tests.FMSGuardedHoareTrace
