import Cantilune.Core.Execution

/-!
# Exact terminal-state partition

`terminal_classification_iff` proves exhaustiveness. This module adds the
missing uniqueness half: successful termination, external wait, and genuine
deadlock are pairwise incompatible, hence every normal state has exactly one
classification.
-/

namespace Cantilune.Core.ObservableLTS

/-- The three terminal observations are pairwise incompatible. -/
theorem terminal_classes_pairwise_disjoint
    (L : ObservableLTS) (state : L.State) :
    (¬(L.SuccessfulTermination state ∧ L.ExternalWait state)) ∧
      (¬(L.SuccessfulTermination state ∧ L.Deadlocked state)) ∧
      (¬(L.ExternalWait state ∧ L.Deadlocked state)) := by
  constructor
  · rintro ⟨⟨normal, success⟩, wait⟩
    exact wait.2.1 success
  constructor
  · rintro ⟨⟨normal, success⟩, deadlock⟩
    exact deadlock.2.1 success
  · rintro ⟨wait, deadlock⟩
    exact deadlock.2.2 wait.2.2

/--
Every normal state belongs to at least one terminal class and no two classes
at once. This is the exact partition theorem used by projection certificates.
-/
theorem terminal_exactly_one_iff_normal
    (L : ObservableLTS) (state : L.State) :
    L.Normal state ↔
      (L.SuccessfulTermination state ∨
        L.ExternalWait state ∨ L.Deadlocked state) ∧
      (¬(L.SuccessfulTermination state ∧ L.ExternalWait state)) ∧
      (¬(L.SuccessfulTermination state ∧ L.Deadlocked state)) ∧
      (¬(L.ExternalWait state ∧ L.Deadlocked state)) := by
  constructor
  · intro normal
    exact
      ⟨(L.terminal_classification_iff state).mp normal,
        L.terminal_classes_pairwise_disjoint state⟩
  · rintro ⟨classified, disjoint⟩
    exact (L.terminal_classification_iff state).mpr classified

end Cantilune.Core.ObservableLTS
