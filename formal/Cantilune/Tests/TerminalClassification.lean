import Mathlib
import Cantilune.Core.Execution

/-!
# Terminal-classification regressions

This closed three-state LTS witnesses success, external waiting, and deadlock
as distinct native classifications.  It also checks that the generic
classification theorem is exhaustive on normal states.
-/

namespace Cantilune.Tests.TerminalClassification

open Cantilune.Core

inductive State
  | successful
  | waiting
  | deadlocked
  deriving DecidableEq, Repr, Fintype

inductive Event
  | tick
  deriving DecidableEq, Repr, Fintype

def success : State → Prop
  | .successful => True
  | .waiting
  | .deadlocked => False

def waiting : State → Prop
  | .waiting => True
  | .successful
  | .deadlocked => False

def lts : ObservableLTS where
  State := State
  Event := Event
  stateSetoid := ObservableLTS.equalitySetoid State
  step := fun _ _ _ => False
  observable := fun _ => True
  success := success
  waiting := waiting
  signatureVersion := fun _ => 0
  step_congr := by
    intro source source' event target target' hSource hTarget
    subst source'
    subst target'
    rfl
  success_congr := by
    intro source target h
    subst target
    rfl
  waiting_congr := by
    intro source target h
    subst target
    rfl
  signatureVersion_congr := by
    intro source target h
    subst target
    rfl

theorem all_normal (state : State) : lts.Normal state := by
  rintro ⟨event, target, step, _⟩
  exact step

example : lts.SuccessfulTermination .successful :=
  ⟨all_normal .successful, trivial⟩

example : lts.ExternalWait .waiting :=
  ⟨all_normal .waiting, by simp [lts, success],
    by simp [lts, waiting]⟩

example : lts.Deadlocked .deadlocked :=
  ⟨all_normal .deadlocked, by simp [lts, success],
    by simp [lts, waiting]⟩

example (state : State) :
    lts.SuccessfulTermination state ∨
      lts.ExternalWait state ∨
      lts.Deadlocked state :=
  (lts.terminal_classification_iff state).mp (all_normal state)

example (state : State) :
    ¬(lts.SuccessfulTermination state ∧
      lts.ExternalWait state) :=
  lts.successful_not_externalWait state

example (state : State) :
    ¬(lts.SuccessfulTermination state ∧
      lts.Deadlocked state) :=
  lts.successful_not_deadlocked state

example (state : State) :
    ¬(lts.ExternalWait state ∧ lts.Deadlocked state) :=
  lts.externalWait_not_deadlocked state

example : ¬lts.Deadlocked .waiting := by
  intro deadlock
  exact deadlock.2.2 trivial

example : ¬lts.ExternalWait .deadlocked := by
  intro externalWait
  simpa [lts, waiting] using externalWait.2.2

example :
    lts.signatureVersion .successful =
      lts.signatureVersion .waiting ∧
      lts.signatureVersion .waiting =
        lts.signatureVersion .deadlocked := by
  native_decide

end Cantilune.Tests.TerminalClassification
