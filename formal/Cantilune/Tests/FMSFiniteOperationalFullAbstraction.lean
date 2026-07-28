import Cantilune.Pi.FMSFiniteOperationalFullAbstraction

namespace Cantilune.Tests.FMSFiniteOperationalFullAbstraction

open Cantilune.Pi
open Cantilune.Pi.FMSFiniteOperationalFullAbstraction
open Cantilune.Pi.FMSCpoUnseparatedSourceCore

def tauWord : Word :=
  ⟨[.tau], by simp⟩

def outputWord : Word :=
  ⟨[.output 3 5], by simp⟩

def inputThenTauWord : Word :=
  ⟨[.input 7 11, .tau], by simp⟩

def inputWord : Word :=
  ⟨[.input 7 11], by simp⟩

def boundOutputWord : Word :=
  ⟨[.boundOutput 2 9 (by decide)], by simp⟩

def reference : FiniteProcess :=
  [tauWord, outputWord, inputThenTauWord, boundOutputWord]

example :
    NativeTrace (compile reference) outputWord.actions :=
  (nativeTrace_compile_iff reference outputWord).2 (by simp [reference])

example :
    EffectObserves (denote reference) inputThenTauWord :=
  (effectObserves_denote_iff reference inputThenTauWord).2
    (by simp [reference])

example :
    EffectObserves (denote reference) boundOutputWord ↔
      NativeTrace (compile reference) boundOutputWord.actions :=
  finite_adequacy reference boundOutputWord

example :
    denote [tauWord, outputWord, tauWord] =
      denote [outputWord, tauWord] := by
  rw [denote_eq_iff_toFinset_eq]
  simp

example :
    OperationallyEquivalent
      [tauWord, outputWord, tauWord]
      [outputWord, tauWord] := by
  rw [← finite_complete_trace_full_abstraction]
  rw [denote_eq_iff_toFinset_eq]
  simp

example :
    ∃ process : FiniteProcess,
      denote process =
        compactDenotation
          ({tauWord, outputWord, boundOutputWord} : Finset Word) :=
  finite_definability _

example :
    OperationalMayPrefix
      [inputThenTauWord] inputWord := by
  rw [operationalMayPrefix_iff]
  refine ⟨inputThenTauWord, by simp, ?_⟩
  simp [inputWord, inputThenTauWord]

example :
    EffectObserves
        (hoareDenote [inputThenTauWord])
        inputThenTauWord ↔
      OperationalMayPrefix
        [inputThenTauWord] inputThenTauWord :=
  finite_hoare_adequacy _ _

example :
    HoareOperationallyEquivalent
      [inputWord, inputThenTauWord]
      [inputThenTauWord] := by
  rw [← finite_hoare_full_abstraction]
  rw [hoareDenote, hoareDenote,
    denote_eq_iff_toFinset_eq]
  native_decide

example (body : RecursiveProc)
    (reflects :
      denote ([] : FiniteProcess) =
          effectDivergence WordCPO →
        (RecursiveLate.OperationalDeadlocked
            (.zero : RecursiveProc) ↔
          RecursiveLate.OperationalDeadlocked (.repTau body))) :
    False :=
  no_nullary_reflection_of_native_separation
    body reflects

#print axioms finite_hoare_adequacy
#print axioms finite_hoare_full_abstraction
#print axioms finite_hoare_definability
#print axioms concreteRecursiveInactive_unfold
#print axioms d1a_cannot_be_strong_bisimulation_fully_abstract
#print axioms all_domain_definability_is_impossible

end Cantilune.Tests.FMSFiniteOperationalFullAbstraction
