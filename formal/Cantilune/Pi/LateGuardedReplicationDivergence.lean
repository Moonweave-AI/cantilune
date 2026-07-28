import Cantilune.Pi.LateGuardedReplication

/-!
# Infinite native execution for guarded replication

The finite-prefix theorem in `LateGuardedReplication` is useful for bounded
testing, but it is not itself an infinite execution object.  This module
packages an execution as a state stream together with one strong native
transition at every successor index.

Deadlock is defined operationally as the absence of every
`RecursiveLate.NativeStep`.  Consequently, the separation theorem below does
not appeal to weak transitions, structural closure, a fuel bound, or a
denotational distinction.
-/

namespace Cantilune.Pi
namespace RecursiveLate

open RecursiveProc

/--
An infinite strong execution beginning at `source`.

The carrier is an actual function on all natural numbers.  `native` supplies
one `RecursiveLate.NativeStep` for every adjacent pair, retaining the exact
native action label at that position.
-/
structure InfiniteNativeRun (source : RecursiveProc) where
  state : Nat → RecursiveProc
  action : Nat → Raw.Action
  initial : state 0 = source
  native :
    ∀ index,
      NativeStep
        (state index)
        (action index)
        (state (index + 1))

/-- Existence of an actual infinite stream of strong native transitions. -/
def NativeDiverges (process : RecursiveProc) : Prop :=
  Nonempty (InfiniteNativeRun process)

/-- Operational deadlock: no strong native transition is enabled. -/
def OperationalDeadlocked (process : RecursiveProc) : Prop :=
  ∀ action target, ¬NativeStep process action target

/--
The persistent replicated-tau server generates an infinite native run.

At index `n`, the run is exactly `replicatedTauState body n`; the successor
proof is the kernel-checked strong transition `replicatedTauState_step`.
-/
def replicatedTauInfiniteRun
    (body : RecursiveProc) :
    InfiniteNativeRun (.repTau body) where
  state := replicatedTauState body
  action := fun _ => .tau
  initial := rfl
  native := replicatedTauState_step body

theorem replicatedTau_nativeDiverges
    (body : RecursiveProc) :
    NativeDiverges (.repTau body) :=
  ⟨replicatedTauInfiniteRun body⟩

/-- Every infinite native run has a first native step, hence is not deadlocked. -/
theorem InfiniteNativeRun.not_operationalDeadlocked
    (run : InfiniteNativeRun process) :
    ¬OperationalDeadlocked process := by
  intro deadlocked
  have first := run.native 0
  rw [run.initial] at first
  exact deadlocked _ _ first

theorem nativeDiverges_not_operationalDeadlocked
    (diverges : NativeDiverges process) :
    ¬OperationalDeadlocked process := by
  rcases diverges with ⟨run⟩
  exact run.not_operationalDeadlocked

/-- A finite-control native transition cannot start at the inactive process. -/
private theorem lateNativeStep_source_ne_zero
    (step : Late.NativeStep source action target) :
    source ≠ .zero := by
  intro sourceZero
  subst source
  cases step

@[simp]
private theorem ofRaw_eq_zero_iff
    (process : Raw.Proc) :
    RecursiveProc.ofRaw process = .zero ↔ process = .zero := by
  cases process <;> simp [RecursiveProc.ofRaw]

/-- The same source inversion property holds for the recursive extension. -/
theorem NativeStep.source_ne_zero
    (step : NativeStep source action target) :
    source ≠ .zero := by
  induction step
  case embedded oldStep =>
    simpa using lateNativeStep_source_ne_zero oldStep
  all_goals simp

/-- The inactive process has no strong native transition. -/
theorem zero_operationalDeadlocked :
    OperationalDeadlocked .zero := by
  intro action target step
  exact step.source_ne_zero rfl

/-- Deadlock excludes an infinite native execution. -/
theorem operationalDeadlocked_not_nativeDiverges
    (deadlocked : OperationalDeadlocked process) :
    ¬NativeDiverges process := by
  intro diverges
  exact nativeDiverges_not_operationalDeadlocked diverges deadlocked

theorem replicatedTau_not_operationalDeadlocked
    (body : RecursiveProc) :
    ¬OperationalDeadlocked (.repTau body) :=
  nativeDiverges_not_operationalDeadlocked
    (replicatedTau_nativeDiverges body)

theorem zero_not_nativeDiverges :
    ¬NativeDiverges (.zero : RecursiveProc) :=
  operationalDeadlocked_not_nativeDiverges
    zero_operationalDeadlocked

/--
Kernel-level operational separation of deadlock and replicated divergence.

The first conjunct classifies `0` by absence of all native steps.  The second
contains the actual infinite replicated-tau run.  The remaining conjuncts
show that neither classification leaks into the other.
-/
theorem zero_deadlock_replicatedTau_divergence_separation
    (body : RecursiveProc) :
    OperationalDeadlocked .zero ∧
      NativeDiverges (.repTau body) ∧
      ¬OperationalDeadlocked (.repTau body) ∧
      ¬NativeDiverges (.zero : RecursiveProc) := by
  exact
    ⟨zero_operationalDeadlocked,
      replicatedTau_nativeDiverges body,
      replicatedTau_not_operationalDeadlocked body,
      zero_not_nativeDiverges⟩

end RecursiveLate
end Cantilune.Pi
