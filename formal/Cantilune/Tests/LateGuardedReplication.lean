import Cantilune.Pi.LateGuardedReplication

/-!
# Regression checks for the guarded-replication late kernel
-/

namespace Cantilune.Tests.LateGuardedReplication

open Cantilune.Pi
open Cantilune.Pi.RecursiveProc
open Cantilune.Pi.RecursiveLate

#check RecursiveProc.repTau
#check RecursiveProc.repSend
#check RecursiveProc.repRecv
#check RecursiveProc.freeNames
#check RecursiveProc.substituteCaptureAvoiding
#check RecursiveProc.unfold
#check RecursiveLate.NativeStep.replicatedInput
#check RecursiveLate.ofRaw_native
#check RecursiveLate.replicatedTau_hasArbitrarilyLongNativeRuns

def replicatedReceiver : RecursiveProc :=
  .repRecv 8 12 (.send 9 12 .zero)

@[simp]
theorem replicatedReceiver_support :
    replicatedReceiver.freeNames = {8, 9} := by
  native_decide

/-- The replicated input exposes one copy and preserves the guarded server. -/
theorem replicatedReceiver_native :
    RecursiveLate.NativeStep
      replicatedReceiver
      (.input 8 12)
      (.par (.send 9 12 .zero) replicatedReceiver) := by
  exact RecursiveLate.NativeStep.replicatedInput

/-- One old finite-control prefix remains exactly one extended native step. -/
theorem finite_output_embeds :
    RecursiveLate.NativeStep
      (RecursiveProc.ofRaw (.send 3 5 .zero))
      (.output 3 5)
      (RecursiveProc.ofRaw .zero) := by
  exact
    RecursiveLate.ofRaw_native
      Late.NativeStep.prefixOutput

/-- Capture-free substitution retains its direct executable form. -/
theorem direct_substitution :
    (RecursiveProc.recv 0 2
      (.send 1 3 .zero)).substituteCaptureAvoiding 1 4 =
        .recv 0 2 (.send 4 3 .zero) := by
  native_decide

/--
Substitution across a conflicting replicated-input binder deterministically
alpha-freshens that binder instead of capturing the replacement.
-/
theorem replicated_input_alpha_freshening :
    (RecursiveProc.repRecv 0 2
      (.send 1 2 .zero)).substituteCaptureAvoiding 1 2 =
        .repRecv 0 3 (.send 2 3 .zero) := by
  native_decide

/-- Guarded replication supplies an actual two-step native trace. -/
theorem replicatedTau_two_steps :
    RecursiveLate.NativeTrace 2
      (.repTau .zero)
      (RecursiveLate.replicatedTauState .zero 2) :=
  RecursiveLate.replicatedTau_trace .zero 2

end Cantilune.Tests.LateGuardedReplication
