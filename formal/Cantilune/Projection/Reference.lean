import Mathlib
import Cantilune.Core.Projection

/-!
# Finite P1a reference execution

This two-transition execution is intentionally small.  `install` is a finite
reference reconfiguration event at an epoch boundary; `execute` is one internal
work step.  The downstream DAG and pre-net transition systems are independently
defined and certified against this source.
-/

namespace Cantilune.Projection.Reference

open Cantilune.Core

inductive State where
  | empty
  | installed
  | finished
  deriving DecidableEq, Repr, Fintype

inductive Event where
  | install
  | execute
  deriving DecidableEq, Repr, Fintype

/-- The complete native transition relation of the finite reference system. -/
inductive Step : State → Event → State → Prop where
  | install : Step .empty .install .installed
  | execute : Step .installed .execute .finished

def success : State → Prop
  | .finished => True
  | .empty
  | .installed => False

def waiting (_ : State) : Prop := False

def signatureVersion : State → Nat
  | .empty => 0
  | .installed
  | .finished => 1

/-- Independently specified observable source LTS. -/
def lts : ObservableLTS where
  State := State
  Event := Event
  stateSetoid := ObservableLTS.equalitySetoid State
  step := Step
  observable := fun _ => True
  success := success
  waiting := waiting
  signatureVersion := signatureVersion
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

theorem install_observable :
    lts.ObservableStep .empty .install .installed :=
  ⟨Step.install, trivial⟩

theorem execute_observable :
    lts.ObservableStep .installed .execute .finished :=
  ⟨Step.execute, trivial⟩

theorem finished_normal : lts.Normal .finished := by
  rintro ⟨event, target, step, _⟩
  cases step

theorem finished_successful :
    lts.SuccessfulTermination .finished :=
  ⟨finished_normal, trivial⟩

theorem empty_not_normal : ¬lts.Normal .empty := by
  intro normal
  exact normal ⟨.install, .installed, install_observable⟩

theorem installed_not_normal : ¬lts.Normal .installed := by
  intro normal
  exact normal ⟨.execute, .finished, execute_observable⟩

end Cantilune.Projection.Reference
