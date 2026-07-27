import Cantilune.Pi.LateGuardedReplicationDivergence

/-! Regression checks for genuine infinite guarded-replication execution. -/

namespace Cantilune.Tests.LateGuardedReplicationDivergence

open Cantilune.Pi

#check RecursiveLate.InfiniteNativeRun
#check RecursiveLate.InfiniteNativeRun.native
#check RecursiveLate.NativeDiverges
#check RecursiveLate.OperationalDeadlocked
#check RecursiveLate.replicatedTauInfiniteRun
#check RecursiveLate.replicatedTau_nativeDiverges
#check RecursiveLate.zero_operationalDeadlocked
#check RecursiveLate.nativeDiverges_not_operationalDeadlocked
#check RecursiveLate.zero_deadlock_replicatedTau_divergence_separation
#print axioms RecursiveLate.replicatedTau_nativeDiverges
#print axioms RecursiveLate.zero_deadlock_replicatedTau_divergence_separation

/-- A concrete replicated server carries a step at every natural index. -/
theorem concrete_run_has_every_successor
    (index : Nat) :
    RecursiveLate.NativeStep
      ((RecursiveLate.replicatedTauInfiniteRun
        (.send 3 5 .zero)).state index)
      ((RecursiveLate.replicatedTauInfiniteRun
        (.send 3 5 .zero)).action index)
      ((RecursiveLate.replicatedTauInfiniteRun
        (.send 3 5 .zero)).state (index + 1)) :=
  (RecursiveLate.replicatedTauInfiniteRun
    (.send 3 5 .zero)).native index

/-- The concrete replicated server is divergent and operationally live. -/
theorem concrete_divergence_is_not_deadlock :
    RecursiveLate.NativeDiverges
        (.repTau (.send 3 5 .zero)) ∧
      ¬RecursiveLate.OperationalDeadlocked
        (.repTau (.send 3 5 .zero)) := by
  exact
    ⟨RecursiveLate.replicatedTau_nativeDiverges _,
      RecursiveLate.replicatedTau_not_operationalDeadlocked _⟩

/-- The inactive process remains deadlocked and cannot carry an infinite run. -/
theorem concrete_zero_is_deadlock_not_divergence :
    RecursiveLate.OperationalDeadlocked
        (.zero : RecursiveProc) ∧
      ¬RecursiveLate.NativeDiverges
        (.zero : RecursiveProc) :=
  ⟨RecursiveLate.zero_operationalDeadlocked,
    RecursiveLate.zero_not_nativeDiverges⟩

end Cantilune.Tests.LateGuardedReplicationDivergence
