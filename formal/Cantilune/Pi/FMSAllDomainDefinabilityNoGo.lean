import Cantilune.Pi.FMSUnseparatedFiniteStrongNoGo

/-!
# Cardinal obstruction to all-domain definability

The optional strengthening asks one fixed process language to denote every
element of every omega-CPO.  Cantor diagonalization rules this out before any
domain-specific semantics is chosen: the complete lattice of sets of programs
is itself an omega-CPO, but no denotation from programs onto all sets of
programs is surjective.

This result does not obstruct the source theorem that compact or finite
approximants are definable.  It fixes the exact boundary between that theorem
and the strictly stronger all-element request.
-/

namespace Cantilune.Pi.FMSAllDomainDefinabilityNoGo

open Cantilune.Pi
open OmegaCompletePartialOrder

/-- The diagonal observation omitted by any proposed powerset denotation. -/
def diagonal
    (denote : Raw.Proc → Set Raw.Proc) :
    Set Raw.Proc :=
  { process | process ∉ denote process }

/-- No process denotation can enumerate all subsets of its own syntax. -/
theorem no_surjective_powerset_denotation
    (denote : Raw.Proc → Set Raw.Proc) :
    ¬ Function.Surjective denote := by
  intro surjective
  obtain ⟨process, equality⟩ :=
    surjective (diagonal denote)
  by_cases member : process ∈ denote process
  · have diagonalMember :
        process ∈ diagonal denote := by
      rw [← equality]
      exact member
    have notMember :
        process ∉ denote process := by
      simpa [diagonal] using diagonalMember
    exact notMember member
  · have diagonalMember :
        process ∈ diagonal denote := by
      simp [diagonal, member]
    have denotationMember :
        process ∈ denote process := by
      rw [equality]
      exact diagonalMember
    exact member denotationMember

/-- Sets of raw processes form a genuine omega-CPO target. -/
abbrev processPowersetOmegaCpo :
    OmegaCompletePartialOrder (Set Raw.Proc) :=
  inferInstance

/--
The optional all-domain strengthening, stated independently of a particular
denotation construction.
-/
def AllOmegaCpoElementsDefinable : Prop :=
  ∀ (Domain : Type)
    (_omega : OmegaCompletePartialOrder Domain),
    ∃ denote : Raw.Proc → Domain,
      Function.Surjective denote

/--
Kernel no-go: one process language cannot define every element of every
omega-CPO.
-/
theorem not_allOmegaCpoElementsDefinable :
    ¬ AllOmegaCpoElementsDefinable := by
  intro allDefinable
  obtain ⟨denote, surjective⟩ :=
    allDefinable
      (Set Raw.Proc)
      processPowersetOmegaCpo
  exact no_surjective_powerset_denotation denote surjective

end Cantilune.Pi.FMSAllDomainDefinabilityNoGo
