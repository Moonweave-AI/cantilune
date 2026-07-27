import Cantilune.Pi.LateGuardedReplicationAlphaOperational

namespace Cantilune.Tests.LateGuardedReplicationAlphaOperational

open Cantilune.Pi
open Cantilune.Pi.RecursiveActionAlpha
open Cantilune.Pi.RecursiveAlphaOperational

#check RecursivePermutation.process_substRaw
#check RecursivePermutation.process_substituteCaptureAvoiding_of_no_capture
#check RecursivePermutation.mem_freeNames_substituteCaptureAvoiding_process
#check RecursiveAlpha.permute
#check AlphaNativeStep
#check alphaNativeStep_mk
#check alphaNativeStep_permute_stable
#check RecursiveLate.embedded_native_permute
#check RecursiveLate.native_permute_exact
#print axioms RecursiveLate.native_permute_exact
#print axioms alphaNativeStep_permute_exact

theorem replicated_input_is_strong_quotient_step :
    AlphaNativeStep
      (Quotient.mk RecursiveAlpha.setoid
        (.repRecv 0 1 .zero))
      (Quotient.mk DerivativeAlpha.setoid
        ({ action := .input 0 1,
           target := .par .zero (.repRecv 0 1 .zero) } :
          LabelledDerivative)) := by
  exact alphaNativeStep_mk RecursiveLate.NativeStep.replicatedInput

theorem embedded_is_strong_quotient_step :
    AlphaNativeStep
      (Quotient.mk RecursiveAlpha.setoid
        (RecursiveProc.ofRaw (.tau .zero)))
      (Quotient.mk DerivativeAlpha.setoid
        ({ action := .tau,
           target := RecursiveProc.ofRaw .zero } :
          LabelledDerivative)) := by
  exact alphaNativeStep_mk
    (RecursiveLate.NativeStep.embedded Late.NativeStep.prefixTau)

theorem syncLeft_is_strong_quotient_step :
    AlphaNativeStep
      (Quotient.mk RecursiveAlpha.setoid
        (.par (.send 0 5 .zero) (.recv 0 1 .zero)))
      (Quotient.mk DerivativeAlpha.setoid
        ({ action := .tau,
           target := .par .zero .zero } :
          LabelledDerivative)) := by
  apply alphaNativeStep_mk
  exact RecursiveLate.NativeStep.syncLeft
    RecursiveLate.NativeStep.prefixOutput
    RecursiveLate.NativeStep.prefixInput
    (by simp [RecursiveProc.freeNames])

theorem syncRight_is_strong_quotient_step :
    AlphaNativeStep
      (Quotient.mk RecursiveAlpha.setoid
        (.par (.recv 0 1 .zero) (.send 0 5 .zero)))
      (Quotient.mk DerivativeAlpha.setoid
        ({ action := .tau,
           target := .par .zero .zero } :
          LabelledDerivative)) := by
  apply alphaNativeStep_mk
  exact RecursiveLate.NativeStep.syncRight
    RecursiveLate.NativeStep.prefixInput
    RecursiveLate.NativeStep.prefixOutput
    (by simp [RecursiveProc.freeNames])

theorem closeLeft_is_strong_quotient_step :
    AlphaNativeStep
      (Quotient.mk RecursiveAlpha.setoid
        (.par
          (.new 5 (.send 0 5 .zero))
          (.recv 0 1 .zero)))
      (Quotient.mk DerivativeAlpha.setoid
        ({ action := .tau,
           target := .new 5 (.par .zero .zero) } :
          LabelledDerivative)) := by
  apply alphaNativeStep_mk
  exact RecursiveLate.NativeStep.closeLeft
    (RecursiveLate.NativeStep.open (by decide)
      RecursiveLate.NativeStep.prefixOutput)
    RecursiveLate.NativeStep.prefixInput
    (by simp [RecursiveProc.freeNames])
    (by simp [RecursiveProc.freeNames])

theorem closeRight_is_strong_quotient_step :
    AlphaNativeStep
      (Quotient.mk RecursiveAlpha.setoid
        (.par
          (.recv 0 1 .zero)
          (.new 5 (.send 0 5 .zero))))
      (Quotient.mk DerivativeAlpha.setoid
        ({ action := .tau,
           target := .new 5 (.par .zero .zero) } :
          LabelledDerivative)) := by
  apply alphaNativeStep_mk
  exact RecursiveLate.NativeStep.closeRight
    RecursiveLate.NativeStep.prefixInput
    (RecursiveLate.NativeStep.open (by decide)
      RecursiveLate.NativeStep.prefixOutput)
    (by simp [RecursiveProc.freeNames])
    (by simp [RecursiveProc.freeNames])

theorem open_permutation_is_strong_quotient_step :
    AlphaNativeStep
      (permuteProcess (Equiv.swap 0 10)
        (Quotient.mk RecursiveAlpha.setoid
          (.new 5 (.send 0 5 .zero))))
      (permuteDerivative (Equiv.swap 0 10)
        (Quotient.mk DerivativeAlpha.setoid
          ({ action := .boundOutput 0 5,
             target := .zero } : LabelledDerivative))) := by
  let step :
      RecursiveLate.NativeStep
        (.new 5 (.send 0 5 .zero))
        (.boundOutput 0 5)
        .zero :=
    RecursiveLate.NativeStep.open (by decide)
      RecursiveLate.NativeStep.prefixOutput
  exact alphaNativeStep_permute_stable
    (Equiv.swap 0 10) step
    (RecursiveLate.PermutationStable.open
      (distinct := by decide)
      RecursiveLate.PermutationStable.prefixOutput)

/--
Changing an input binder changes the literal strong-late label.  This is the
minimal reason actions and derivatives must be alpha-quotiented together.
-/
theorem input_binder_sources_alpha :
    RecursiveAlpha
      (.recv 0 1 .zero)
      (.recv 0 2 .zero) := by
  simpa [RecursiveProc.renameBound, RecursiveProc.substRaw] using
    (RecursiveAlpha.recvBinder
      (channel := 0) (binder := 1) (replacement := 2)
      (body := RecursiveProc.zero)
      (by simp [RecursiveProc.allNames]))

theorem input_binder_literal_label_not_invariant :
    ¬ ∃ target,
      RecursiveLate.NativeStep
        (.recv 0 2 .zero) (.input 0 1) target := by
  rintro ⟨target, step⟩
  rcases
      RecursiveLate.native_source_conservative step
        (.recv 0 2 .zero) rfl with
    ⟨oldTarget, _, oldStep⟩
  cases oldStep

theorem syncLeft_exact_permutation :
    RecursiveLate.NativeStep
      (RecursivePermutation.process (Equiv.swap 0 10)
        (.par (.send 0 5 .zero) (.recv 0 1 .zero)))
      (RecursivePermutation.action (Equiv.swap 0 10) .tau)
      (RecursivePermutation.process (Equiv.swap 0 10)
        (.par .zero .zero)) := by
  let step :
      RecursiveLate.NativeStep
        (.par (.send 0 5 .zero) (.recv 0 1 .zero))
        .tau
        (.par .zero .zero) :=
    RecursiveLate.NativeStep.syncLeft
      RecursiveLate.NativeStep.prefixOutput
      RecursiveLate.NativeStep.prefixInput
      (by simp [RecursiveProc.freeNames])
  apply RecursiveLate.native_permute_exact
    (Equiv.swap 0 10) step
  exact RecursiveLate.ExactPermutationStable.syncLeft
    (outputStep := RecursiveLate.NativeStep.prefixOutput)
    (inputStep := RecursiveLate.NativeStep.prefixInput)
    (fresh := by decide)
    RecursiveLate.ExactPermutationStable.prefixOutput
    RecursiveLate.ExactPermutationStable.prefixInput
    (by decide)

theorem closeLeft_exact_permutation :
    RecursiveLate.NativeStep
      (RecursivePermutation.process (Equiv.swap 0 10)
        (.par
          (.new 5 (.send 0 5 .zero))
          (.recv 0 1 .zero)))
      (RecursivePermutation.action (Equiv.swap 0 10) .tau)
      (RecursivePermutation.process (Equiv.swap 0 10)
        (.new 5 (.par .zero .zero))) := by
  let outputStep :
      RecursiveLate.NativeStep
        (.new 5 (.send 0 5 .zero))
        (.boundOutput 0 5)
        .zero :=
    RecursiveLate.NativeStep.open (by decide)
      RecursiveLate.NativeStep.prefixOutput
  let inputStep :
      RecursiveLate.NativeStep
        (.recv 0 1 .zero)
        (.input 0 1)
        .zero :=
    RecursiveLate.NativeStep.prefixInput
  let step :
      RecursiveLate.NativeStep
        (.par
          (.new 5 (.send 0 5 .zero))
          (.recv 0 1 .zero))
        .tau
        (.new 5 (.par .zero .zero)) :=
    RecursiveLate.NativeStep.closeLeft outputStep inputStep
      (by simp [RecursiveProc.freeNames])
      (by simp [RecursiveProc.freeNames])
  apply RecursiveLate.native_permute_exact
    (Equiv.swap 0 10) step
  exact RecursiveLate.ExactPermutationStable.closeLeft
    (outputStep := outputStep)
    (inputStep := inputStep)
    (freshForReceiver := by decide)
    (binderFresh := by decide)
    (RecursiveLate.ExactPermutationStable.open
      (step := RecursiveLate.NativeStep.prefixOutput)
      (distinct := by decide)
      RecursiveLate.ExactPermutationStable.prefixOutput)
    RecursiveLate.ExactPermutationStable.prefixInput
    (by decide)

private def captureBody : RecursiveProc :=
  .new 1 (.send 0 1 .zero)

private def capturePermutation : Equiv.Perm Name :=
  Equiv.swap 0 10

private theorem capture_left_evaluates :
    RecursivePermutation.process capturePermutation
        (captureBody.substituteCaptureAvoiding 0 1) =
      .new 2 (.send 1 2 .zero) := by
  native_decide

private theorem capture_right_evaluates :
    RecursiveProc.substituteCaptureAvoiding
        (RecursivePermutation.process capturePermutation captureBody)
        (capturePermutation 0) (capturePermutation 1) =
      .new 11 (.send 1 11 .zero) := by
  native_decide

/--
The repository's literal counterexample has exactly the expected residual:
its two deterministic fresh choices differ syntactically but are related by
the generated `RecursiveAlpha` binder rule.
-/
theorem deterministic_freshening_counterexample_is_alpha :
    RecursiveAlpha
      (RecursivePermutation.process capturePermutation
        (captureBody.substituteCaptureAvoiding 0 1))
      (RecursiveProc.substituteCaptureAvoiding
        (RecursivePermutation.process capturePermutation captureBody)
        (capturePermutation 0) (capturePermutation 1)) := by
  rw [capture_left_evaluates, capture_right_evaluates]
  simpa [RecursiveProc.renameBound, RecursiveProc.substRaw] using
    (RecursiveAlpha.newBinder
      (binder := 2) (replacement := 11)
      (body := RecursiveProc.send 1 2 .zero)
      (by decide))

end Cantilune.Tests.LateGuardedReplicationAlphaOperational
