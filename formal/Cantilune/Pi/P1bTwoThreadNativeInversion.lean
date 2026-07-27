import Cantilune.Pi.P1bTwoThreadExtraction
import Cantilune.Pi.P1bLinkedEndpointNormalization

/-!
# Native inversion for the two-thread P1b requesting shape

This module is an exact strong-late inversion layer.  It does not transport a
native step across arbitrary structural congruence and it does not replace one
native `tau` by a weak closure.

The first part establishes semantic facts about the syntax evidence extracted
from the augmented requesting fingerprint:

* one-communication evidence has one enabled communication prefix;
* two-communication evidence has one enabled thread and two sequential
  communication prefixes;
* a unary-free native `tau` needs at least two enabled heads.

Consequently a single `TwoCommThread` cannot silently reduce.  This is the
constructor-exclusion fact needed to localize a two-thread `tau` at the unique
parallel split rather than in one of its sequential branches.
-/

namespace Cantilune.Pi.P1bTwoThreadNativeInversion

open Cantilune.Pi.P1bTwoThreadExtraction
open Cantilune.Pi.P1bRequestingFingerprint
open Cantilune.Pi.P1bRequestingNormalForm

/-- Zero total prefix count forces both communication polarities to be zero. -/
theorem polarityCounts_eq_zero_of_prefixCount_eq_zero
    (process : Raw.Proc)
    (prefixFree : process.prefixCount = 0) :
    process.sendPrefixCount = 0 ∧ process.recvPrefixCount = 0 := by
  have communicationBound :=
    Raw.Proc.communicationPrefixCount_le_prefixCount process
  have polarityPartition :=
    Raw.Proc.communicationPrefixCount_eq_send_add_recv process
  omega

/-- A prefix-free process has no unary prefix. -/
theorem unaryPrefixCount_eq_zero_of_prefixCount_eq_zero
    (process : Raw.Proc)
    (prefixFree : process.prefixCount = 0) :
    process.unaryPrefixCount = 0 := by
  have partition :=
    Raw.Proc.prefixCount_eq_communication_add_unary process
  omega

namespace OneCommThread

/-- The syntax evidence contains exactly one executable prefix. -/
theorem prefixCount_eq_one
    {process : Raw.Proc}
    (thread : OneCommThread process) :
    process.prefixCount = 1 := by
  induction thread with
  | send tailPrefixFree =>
      simp [Raw.Proc.prefixCount, tailPrefixFree]
  | recv tailPrefixFree =>
      simp [Raw.Proc.prefixCount, tailPrefixFree]
  | new inner inductionHypothesis =>
      simpa [Raw.Proc.prefixCount] using inductionHypothesis
  | parLeft inner rightPrefixFree inductionHypothesis =>
      simp [Raw.Proc.prefixCount, inductionHypothesis, rightPrefixFree]
  | parRight leftPrefixFree inner inductionHypothesis =>
      simp [Raw.Proc.prefixCount, inductionHypothesis, leftPrefixFree]
  | choiceLeft inner rightPrefixFree inductionHypothesis =>
      simp [Raw.Proc.prefixCount, inductionHypothesis, rightPrefixFree]
  | choiceRight leftPrefixFree inner inductionHypothesis =>
      simp [Raw.Proc.prefixCount, inductionHypothesis, leftPrefixFree]

/-- The sole prefix is an input or output, never a unary guard or `tau`. -/
theorem unaryPrefixCount_eq_zero
    {process : Raw.Proc}
    (thread : OneCommThread process) :
    process.unaryPrefixCount = 0 := by
  induction thread with
  | send tailPrefixFree =>
      simpa [Raw.Proc.unaryPrefixCount] using
        unaryPrefixCount_eq_zero_of_prefixCount_eq_zero _ tailPrefixFree
  | recv tailPrefixFree =>
      simpa [Raw.Proc.unaryPrefixCount] using
        unaryPrefixCount_eq_zero_of_prefixCount_eq_zero _ tailPrefixFree
  | new inner inductionHypothesis =>
      simpa [Raw.Proc.unaryPrefixCount] using inductionHypothesis
  | parLeft inner rightPrefixFree inductionHypothesis =>
      have inactive :=
        unaryPrefixCount_eq_zero_of_prefixCount_eq_zero _ rightPrefixFree
      simp [Raw.Proc.unaryPrefixCount, inductionHypothesis, inactive]
  | parRight leftPrefixFree inner inductionHypothesis =>
      have inactive :=
        unaryPrefixCount_eq_zero_of_prefixCount_eq_zero _ leftPrefixFree
      simp [Raw.Proc.unaryPrefixCount, inductionHypothesis, inactive]
  | choiceLeft inner rightPrefixFree inductionHypothesis =>
      have inactive :=
        unaryPrefixCount_eq_zero_of_prefixCount_eq_zero _ rightPrefixFree
      simp [Raw.Proc.unaryPrefixCount, inductionHypothesis, inactive]
  | choiceRight leftPrefixFree inner inductionHypothesis =>
      have inactive :=
        unaryPrefixCount_eq_zero_of_prefixCount_eq_zero _ leftPrefixFree
      simp [Raw.Proc.unaryPrefixCount, inductionHypothesis, inactive]

/-- Exactly one input/output polarity occurs in a one-communication thread. -/
theorem sendPrefixCount_add_recvPrefixCount_eq_one
    {process : Raw.Proc}
    (thread : OneCommThread process) :
    process.sendPrefixCount + process.recvPrefixCount = 1 := by
  induction thread with
  | send tailPrefixFree =>
      rcases polarityCounts_eq_zero_of_prefixCount_eq_zero _ tailPrefixFree with
        ⟨tailSend, tailRecv⟩
      simp [Raw.Proc.sendPrefixCount, Raw.Proc.recvPrefixCount,
        tailSend, tailRecv]
  | recv tailPrefixFree =>
      rcases polarityCounts_eq_zero_of_prefixCount_eq_zero _ tailPrefixFree with
        ⟨tailSend, tailRecv⟩
      simp [Raw.Proc.sendPrefixCount, Raw.Proc.recvPrefixCount,
        tailSend, tailRecv]
  | new inner inductionHypothesis =>
      simpa [Raw.Proc.sendPrefixCount, Raw.Proc.recvPrefixCount] using
        inductionHypothesis
  | parLeft inner rightPrefixFree inductionHypothesis =>
      rcases polarityCounts_eq_zero_of_prefixCount_eq_zero _ rightPrefixFree with
        ⟨inactiveSend, inactiveRecv⟩
      simp [Raw.Proc.sendPrefixCount, Raw.Proc.recvPrefixCount,
        inductionHypothesis, inactiveSend, inactiveRecv]
  | parRight leftPrefixFree inner inductionHypothesis =>
      rcases polarityCounts_eq_zero_of_prefixCount_eq_zero _ leftPrefixFree with
        ⟨inactiveSend, inactiveRecv⟩
      simp [Raw.Proc.sendPrefixCount, Raw.Proc.recvPrefixCount,
        inductionHypothesis, inactiveSend, inactiveRecv]
  | choiceLeft inner rightPrefixFree inductionHypothesis =>
      rcases polarityCounts_eq_zero_of_prefixCount_eq_zero _ rightPrefixFree with
        ⟨inactiveSend, inactiveRecv⟩
      simp [Raw.Proc.sendPrefixCount, Raw.Proc.recvPrefixCount,
        inductionHypothesis, inactiveSend, inactiveRecv]
  | choiceRight leftPrefixFree inner inductionHypothesis =>
      rcases polarityCounts_eq_zero_of_prefixCount_eq_zero _ leftPrefixFree with
        ⟨inactiveSend, inactiveRecv⟩
      simp [Raw.Proc.sendPrefixCount, Raw.Proc.recvPrefixCount,
        inductionHypothesis, inactiveSend, inactiveRecv]

/-- A one-communication thread has exactly one currently enabled head. -/
theorem headPrefixCount_eq_one
    {process : Raw.Proc}
    (thread : OneCommThread process) :
    process.headPrefixCount = 1 := by
  induction thread with
  | send tailPrefixFree =>
      rfl
  | recv tailPrefixFree =>
      rfl
  | new inner inductionHypothesis =>
      simpa [Raw.Proc.headPrefixCount] using inductionHypothesis
  | @parLeft left right inner rightPrefixFree inductionHypothesis =>
      have inactiveHead : right.headPrefixCount = 0 := by
        have bound := headPrefixCount_le_prefixCount right
        omega
      simp [Raw.Proc.headPrefixCount, inductionHypothesis, inactiveHead]
  | @parRight right left leftPrefixFree inner inductionHypothesis =>
      have inactiveHead : left.headPrefixCount = 0 := by
        have bound := headPrefixCount_le_prefixCount left
        omega
      simp [Raw.Proc.headPrefixCount, inductionHypothesis, inactiveHead]
  | @choiceLeft left right inner rightPrefixFree inductionHypothesis =>
      have inactiveHead : right.headPrefixCount = 0 := by
        have bound := headPrefixCount_le_prefixCount right
        omega
      simp [Raw.Proc.headPrefixCount, inductionHypothesis, inactiveHead]
  | @choiceRight right left leftPrefixFree inner inductionHypothesis =>
      have inactiveHead : left.headPrefixCount = 0 := by
        have bound := headPrefixCount_le_prefixCount left
        omega
      simp [Raw.Proc.headPrefixCount, inductionHypothesis, inactiveHead]

/--
Capture-avoiding substitution preserves the one-communication syntax class.
The proof uses the already kernel-checked prefix and polarity invariants rather
than unfolding the fresh-name algorithm.
-/
theorem substituteCaptureAvoiding
    {process : Raw.Proc}
    (thread : OneCommThread process)
    (needle replacement : Name) :
    OneCommThread
      (process.substituteCaptureAvoiding needle replacement) := by
  apply oneCommThread_of_prefixCount_eq_one
  · rw [Raw.Proc.prefixCount_substituteCaptureAvoiding]
    exact OneCommThread.prefixCount_eq_one thread
  · have targetPartition :=
      Raw.Proc.prefixCount_eq_communication_add_unary
        (process.substituteCaptureAvoiding needle replacement)
    have targetPolarity :=
      Raw.Proc.communicationPrefixCount_eq_send_add_recv
        (process.substituteCaptureAvoiding needle replacement)
    have sendInvariant :=
      Raw.Proc.sendPrefixCount_substituteCaptureAvoiding
        process needle replacement
    have recvInvariant :=
      Raw.Proc.recvPrefixCount_substituteCaptureAvoiding
        process needle replacement
    have sourcePolarity :=
      OneCommThread.sendPrefixCount_add_recvPrefixCount_eq_one thread
    rw [Raw.Proc.prefixCount_substituteCaptureAvoiding,
      OneCommThread.prefixCount_eq_one thread, targetPolarity,
      sendInvariant, recvInvariant, sourcePolarity] at targetPartition
    omega

end OneCommThread

/--
The one-prefix input continuation needed by P1b normalizes after
capture-avoiding substitution even in the slow freshening branch.

Unlike `inputContinuation_substitution`, this theorem does not assume
`captureRisk = false`.  If the residual binder is the offered replacement,
the executable algorithm chooses its deterministic fresh name; the result is
returned existentially together with the exact inequality needed by
`LinkedIncidence`.
-/
theorem inputContinuation_substitution_struct
    (outerBinder replacement residualBinder : Name)
    (outer_ne_replacement : outerBinder ≠ replacement) :
    ∃ normalizedBinder : Name,
      normalizedBinder ≠ replacement ∧
      Late.Struct
        (Raw.Proc.substituteCaptureAvoiding
          (.recv outerBinder residualBinder .zero)
          outerBinder replacement)
        (.recv replacement normalizedBinder .zero) := by
  by_cases residualOuter : residualBinder = outerBinder
  · subst residualBinder
    refine ⟨outerBinder, outer_ne_replacement, ?_⟩
    simpa [Raw.Proc.substituteCaptureAvoiding, Raw.Proc.captureRisk,
      Raw.Proc.substRaw] using
      (Late.Struct.refl
        (.recv replacement outerBinder .zero : Raw.Proc))
  · by_cases residualReplacement : residualBinder = replacement
    · subst residualBinder
      let fresh :=
        (Raw.Proc.zero).freshName outerBinder replacement
      refine ⟨fresh,
        Raw.Proc.freshName_ne_replacement _ _ _, ?_⟩
      simpa [fresh, Raw.Proc.substituteCaptureAvoiding,
        Raw.Proc.captureRisk, Raw.Proc.syntaxDepth,
        Raw.Proc.substituteCaptureAvoidingAux,
        Raw.Proc.renameBound, Raw.Proc.substRaw, residualOuter] using
        (Late.Struct.refl
          (.recv replacement fresh .zero : Raw.Proc))
    · refine ⟨residualBinder, residualReplacement, ?_⟩
      simpa [Raw.Proc.substituteCaptureAvoiding,
        Raw.Proc.captureRisk, Raw.Proc.substRaw,
        residualOuter, residualReplacement] using
        (Late.Struct.refl
          (.recv replacement residualBinder .zero : Raw.Proc))

namespace TwoCommThread

/-- The syntax evidence contains exactly two sequential communication prefixes. -/
theorem prefixCount_eq_two
    {process : Raw.Proc}
    (thread : TwoCommThread process) :
    process.prefixCount = 2 := by
  induction thread with
  | send tail =>
      simp [Raw.Proc.prefixCount, OneCommThread.prefixCount_eq_one tail]
  | recv tail =>
      simp [Raw.Proc.prefixCount, OneCommThread.prefixCount_eq_one tail]
  | new inner inductionHypothesis =>
      simpa [Raw.Proc.prefixCount] using inductionHypothesis
  | parLeft inner rightPrefixFree inductionHypothesis =>
      simp [Raw.Proc.prefixCount, inductionHypothesis, rightPrefixFree]
  | parRight leftPrefixFree inner inductionHypothesis =>
      simp [Raw.Proc.prefixCount, inductionHypothesis, leftPrefixFree]
  | choiceLeft inner rightPrefixFree inductionHypothesis =>
      simp [Raw.Proc.prefixCount, inductionHypothesis, rightPrefixFree]
  | choiceRight leftPrefixFree inner inductionHypothesis =>
      simp [Raw.Proc.prefixCount, inductionHypothesis, leftPrefixFree]

/-- Both prefixes are communication prefixes. -/
theorem unaryPrefixCount_eq_zero
    {process : Raw.Proc}
    (thread : TwoCommThread process) :
    process.unaryPrefixCount = 0 := by
  induction thread with
  | send tail =>
      simpa [Raw.Proc.unaryPrefixCount] using
        OneCommThread.unaryPrefixCount_eq_zero tail
  | recv tail =>
      simpa [Raw.Proc.unaryPrefixCount] using
        OneCommThread.unaryPrefixCount_eq_zero tail
  | new inner inductionHypothesis =>
      simpa [Raw.Proc.unaryPrefixCount] using inductionHypothesis
  | parLeft inner rightPrefixFree inductionHypothesis =>
      have inactive :=
        unaryPrefixCount_eq_zero_of_prefixCount_eq_zero _ rightPrefixFree
      simp [Raw.Proc.unaryPrefixCount, inductionHypothesis, inactive]
  | parRight leftPrefixFree inner inductionHypothesis =>
      have inactive :=
        unaryPrefixCount_eq_zero_of_prefixCount_eq_zero _ leftPrefixFree
      simp [Raw.Proc.unaryPrefixCount, inductionHypothesis, inactive]
  | choiceLeft inner rightPrefixFree inductionHypothesis =>
      have inactive :=
        unaryPrefixCount_eq_zero_of_prefixCount_eq_zero _ rightPrefixFree
      simp [Raw.Proc.unaryPrefixCount, inductionHypothesis, inactive]
  | choiceRight leftPrefixFree inner inductionHypothesis =>
      have inactive :=
        unaryPrefixCount_eq_zero_of_prefixCount_eq_zero _ leftPrefixFree
      simp [Raw.Proc.unaryPrefixCount, inductionHypothesis, inactive]

/-- A two-prefix sequential thread still has only one enabled head. -/
theorem headPrefixCount_eq_one
    {process : Raw.Proc}
    (thread : TwoCommThread process) :
    process.headPrefixCount = 1 := by
  induction thread with
  | send tail =>
      rfl
  | recv tail =>
      rfl
  | new inner inductionHypothesis =>
      simpa [Raw.Proc.headPrefixCount] using inductionHypothesis
  | @parLeft left right inner rightPrefixFree inductionHypothesis =>
      have inactiveHead : right.headPrefixCount = 0 := by
        have bound := headPrefixCount_le_prefixCount right
        omega
      simp [Raw.Proc.headPrefixCount, inductionHypothesis, inactiveHead]
  | @parRight right left leftPrefixFree inner inductionHypothesis =>
      have inactiveHead : left.headPrefixCount = 0 := by
        have bound := headPrefixCount_le_prefixCount left
        omega
      simp [Raw.Proc.headPrefixCount, inductionHypothesis, inactiveHead]
  | @choiceLeft left right inner rightPrefixFree inductionHypothesis =>
      have inactiveHead : right.headPrefixCount = 0 := by
        have bound := headPrefixCount_le_prefixCount right
        omega
      simp [Raw.Proc.headPrefixCount, inductionHypothesis, inactiveHead]
  | @choiceRight right left leftPrefixFree inner inductionHypothesis =>
      have inactiveHead : left.headPrefixCount = 0 := by
        have bound := headPrefixCount_le_prefixCount left
        omega
      simp [Raw.Proc.headPrefixCount, inductionHypothesis, inactiveHead]

end TwoCommThread

namespace Late.NativeStep

/-- Every genuine native transition has at least one enabled source head. -/
theorem source_headPrefixCount_pos
    (step : Late.NativeStep source action target) :
    0 < source.headPrefixCount := by
  have prefixPositive := step.source_prefixCount_pos
  by_contra notPositive
  have headZero : source.headPrefixCount = 0 :=
    Nat.eq_zero_of_not_pos notPositive
  have prefixZero :=
    Raw.Proc.prefixCount_eq_zero_of_headPrefixCount_eq_zero source headZero
  omega

/--
A native silent step with no unary prefix needs two enabled source heads.
Thus the silent action is genuinely binary communication, including the
`open`/`close` variants, rather than a hidden unary rule.
-/
private theorem two_le_source_headPrefixCount_of_action_eq_tau
    (step : Late.NativeStep source action target) :
    action = .tau →
      source.unaryPrefixCount = 0 →
        2 ≤ source.headPrefixCount := by
  induction step with
  | prefixTau =>
      intro _ noUnary
      simp [Raw.Proc.unaryPrefixCount] at noUnary
  | prefixOutput =>
      intro actionEq _
      cases actionEq
  | prefixInput =>
      intro actionEq _
      cases actionEq
  | matchGuard inner inductionHypothesis =>
      intro _ noUnary
      simp [Raw.Proc.unaryPrefixCount] at noUnary
  | mismatchGuard distinct inner inductionHypothesis =>
      intro _ noUnary
      simp [Raw.Proc.unaryPrefixCount] at noUnary
  | choiceLeft inner inductionHypothesis =>
      intro actionEq noUnary
      simp only [Raw.Proc.unaryPrefixCount,
        Nat.add_eq_zero_iff] at noUnary
      have active := inductionHypothesis actionEq noUnary.1
      simp only [Raw.Proc.headPrefixCount]
      omega
  | choiceRight inner inductionHypothesis =>
      intro actionEq noUnary
      simp only [Raw.Proc.unaryPrefixCount,
        Nat.add_eq_zero_iff] at noUnary
      have active := inductionHypothesis actionEq noUnary.2
      simp only [Raw.Proc.headPrefixCount]
      omega
  | parLeft fresh inner inductionHypothesis =>
      intro actionEq noUnary
      simp only [Raw.Proc.unaryPrefixCount,
        Nat.add_eq_zero_iff] at noUnary
      have active := inductionHypothesis actionEq noUnary.1
      simp only [Raw.Proc.headPrefixCount]
      omega
  | parRight fresh inner inductionHypothesis =>
      intro actionEq noUnary
      simp only [Raw.Proc.unaryPrefixCount,
        Nat.add_eq_zero_iff] at noUnary
      have active := inductionHypothesis actionEq noUnary.2
      simp only [Raw.Proc.headPrefixCount]
      omega
  | syncLeft outputStep inputStep binderFresh outputIH inputIH =>
      intro _ _
      have outputPositive :=
        Late.NativeStep.source_headPrefixCount_pos outputStep
      have inputPositive :=
        Late.NativeStep.source_headPrefixCount_pos inputStep
      simp only [Raw.Proc.headPrefixCount]
      omega
  | syncRight inputStep outputStep binderFresh inputIH outputIH =>
      intro _ _
      have inputPositive :=
        Late.NativeStep.source_headPrefixCount_pos inputStep
      have outputPositive :=
        Late.NativeStep.source_headPrefixCount_pos outputStep
      simp only [Raw.Proc.headPrefixCount]
      omega
  | restrict fresh inner inductionHypothesis =>
      intro actionEq noUnary
      simp only [Raw.Proc.unaryPrefixCount] at noUnary
      simpa [Raw.Proc.headPrefixCount] using
        inductionHypothesis actionEq noUnary
  | «open» distinct inner inductionHypothesis =>
      intro actionEq _
      cases actionEq
  | closeLeft outputStep inputStep freshForReceiver binderFresh outputIH inputIH =>
      intro _ _
      have outputPositive :=
        Late.NativeStep.source_headPrefixCount_pos outputStep
      have inputPositive :=
        Late.NativeStep.source_headPrefixCount_pos inputStep
      simp only [Raw.Proc.headPrefixCount]
      omega
  | closeRight inputStep outputStep freshForReceiver binderFresh inputIH outputIH =>
      intro _ _
      have inputPositive :=
        Late.NativeStep.source_headPrefixCount_pos inputStep
      have outputPositive :=
        Late.NativeStep.source_headPrefixCount_pos outputStep
      simp only [Raw.Proc.headPrefixCount]
      omega

theorem two_le_source_headPrefixCount_of_tau_noUnary
    (step : Late.NativeStep source .tau target)
    (noUnary : source.unaryPrefixCount = 0) :
    2 ≤ source.headPrefixCount :=
  two_le_source_headPrefixCount_of_action_eq_tau step rfl noUnary

/-- A prefix-free raw process cannot be the source of a native transition. -/
theorem false_of_source_prefixCount_eq_zero
    (step : Late.NativeStep source action target)
    (prefixFree : source.prefixCount = 0) :
    False := by
  have positive := step.source_prefixCount_pos
  omega

end Late.NativeStep

/-- A sequential two-communication thread cannot perform a native `tau`. -/
theorem TwoCommThread.no_native_tau
    {source target : Raw.Proc}
    (thread : TwoCommThread source) :
    ¬ Late.NativeStep source .tau target := by
  intro step
  have twoHeads :=
    Late.NativeStep.two_le_source_headPrefixCount_of_tau_noUnary step
      (TwoCommThread.unaryPrefixCount_eq_zero thread)
  have oneHead := TwoCommThread.headPrefixCount_eq_one thread
  omega

namespace TwoCommThread

/--
Every native head action of a two-communication thread exposes exactly its
remaining one-communication continuation.  The theorem includes ordinary
input/output and bound output (`open`); a silent step is excluded separately
by `TwoCommThread.no_native_tau`.
-/
theorem target_oneCommThread
    {source target : Raw.Proc}
    (thread : TwoCommThread source)
    (step : Late.NativeStep source action target) :
    OneCommThread target := by
  induction thread generalizing action target with
  | send tail =>
      cases step
      exact tail
  | recv tail =>
      cases step
      exact tail
  | @new body binder inner inductionHypothesis =>
      cases step with
      | restrict fresh innerStep =>
          exact OneCommThread.new
            (inductionHypothesis innerStep)
      | «open» distinct innerStep =>
          exact inductionHypothesis innerStep
  | @parLeft left right inner rightPrefixFree inductionHypothesis =>
      cases step with
      | parLeft fresh innerStep =>
          exact OneCommThread.parLeft
            (inductionHypothesis innerStep) rightPrefixFree
      | parRight fresh inactiveStep =>
          exact (Late.NativeStep.false_of_source_prefixCount_eq_zero
            inactiveStep rightPrefixFree).elim
      | syncLeft outputStep inputStep binderFresh =>
          exact (Late.NativeStep.false_of_source_prefixCount_eq_zero
            inputStep rightPrefixFree).elim
      | syncRight inputStep outputStep binderFresh =>
          exact (Late.NativeStep.false_of_source_prefixCount_eq_zero
            outputStep rightPrefixFree).elim
      | closeLeft outputStep inputStep freshForReceiver binderFresh =>
          exact (Late.NativeStep.false_of_source_prefixCount_eq_zero
            inputStep rightPrefixFree).elim
      | closeRight inputStep outputStep freshForReceiver binderFresh =>
          exact (Late.NativeStep.false_of_source_prefixCount_eq_zero
            outputStep rightPrefixFree).elim
  | @parRight right left leftPrefixFree inner inductionHypothesis =>
      cases step with
      | parLeft fresh inactiveStep =>
          exact (Late.NativeStep.false_of_source_prefixCount_eq_zero
            inactiveStep leftPrefixFree).elim
      | parRight fresh innerStep =>
          exact OneCommThread.parRight leftPrefixFree
            (inductionHypothesis innerStep)
      | syncLeft outputStep inputStep binderFresh =>
          exact (Late.NativeStep.false_of_source_prefixCount_eq_zero
            outputStep leftPrefixFree).elim
      | syncRight inputStep outputStep binderFresh =>
          exact (Late.NativeStep.false_of_source_prefixCount_eq_zero
            inputStep leftPrefixFree).elim
      | closeLeft outputStep inputStep freshForReceiver binderFresh =>
          exact (Late.NativeStep.false_of_source_prefixCount_eq_zero
            outputStep leftPrefixFree).elim
      | closeRight inputStep outputStep freshForReceiver binderFresh =>
          exact (Late.NativeStep.false_of_source_prefixCount_eq_zero
            inputStep leftPrefixFree).elim
  | @choiceLeft left right inner rightPrefixFree inductionHypothesis =>
      cases step with
      | choiceLeft innerStep =>
          exact inductionHypothesis innerStep
      | choiceRight inactiveStep =>
          exact (Late.NativeStep.false_of_source_prefixCount_eq_zero
            inactiveStep rightPrefixFree).elim
  | @choiceRight right left leftPrefixFree inner inductionHypothesis =>
      cases step with
      | choiceLeft inactiveStep =>
          exact (Late.NativeStep.false_of_source_prefixCount_eq_zero
            inactiveStep leftPrefixFree).elim
      | choiceRight innerStep =>
          exact inductionHypothesis innerStep

end TwoCommThread

/--
The exact syntactic context left after the first communication.  There are
two one-communication residual threads; restrictions and parallel
prefix-free garbage from the source remain explicit.  Choice wrappers do not
remain because a native choice transition selects one branch.
-/
inductive TwoResidualContext : Raw.Proc → Prop
  | split
      (leftThread : OneCommThread left)
      (rightThread : OneCommThread right) :
      TwoResidualContext (.par left right)
  | new
      (inner : TwoResidualContext body) :
      TwoResidualContext (.new binder body)
  | parLeft
      (inner : TwoResidualContext left)
      (rightPrefixFree : right.prefixCount = 0) :
      TwoResidualContext (.par left right)
  | parRight
      (leftPrefixFree : left.prefixCount = 0)
      (inner : TwoResidualContext right) :
      TwoResidualContext (.par left right)

/--
Inversion of one actual native `tau` from the extracted two-thread source.
The proof follows the derivation at its real source representative.  It never
transports the transition across structural congruence.
-/
theorem TwoThreadContext.native_tau_target
    {source target : Raw.Proc}
    (context : TwoThreadContext source)
    (step : Late.NativeStep source .tau target) :
    TwoResidualContext target := by
  induction context generalizing target with
  | split leftThread rightThread =>
      cases step with
      | parLeft fresh leftStep =>
          exact (TwoCommThread.no_native_tau leftThread leftStep).elim
      | parRight fresh rightStep =>
          exact (TwoCommThread.no_native_tau rightThread rightStep).elim
      | syncLeft outputStep inputStep binderFresh =>
          exact TwoResidualContext.split
            (TwoCommThread.target_oneCommThread leftThread outputStep)
            (OneCommThread.substituteCaptureAvoiding
              (TwoCommThread.target_oneCommThread rightThread inputStep)
              _ _)
      | syncRight inputStep outputStep binderFresh =>
          exact TwoResidualContext.split
            (OneCommThread.substituteCaptureAvoiding
              (TwoCommThread.target_oneCommThread leftThread inputStep)
              _ _)
            (TwoCommThread.target_oneCommThread rightThread outputStep)
      | closeLeft outputStep inputStep freshForReceiver binderFresh =>
          exact TwoResidualContext.new
            (TwoResidualContext.split
              (TwoCommThread.target_oneCommThread leftThread outputStep)
              (OneCommThread.substituteCaptureAvoiding
                (TwoCommThread.target_oneCommThread rightThread inputStep)
                _ _))
      | closeRight inputStep outputStep freshForReceiver binderFresh =>
          exact TwoResidualContext.new
            (TwoResidualContext.split
              (OneCommThread.substituteCaptureAvoiding
                (TwoCommThread.target_oneCommThread leftThread inputStep)
                _ _)
              (TwoCommThread.target_oneCommThread rightThread outputStep))
  | @new binder body inner inductionHypothesis =>
      cases step with
      | restrict fresh innerStep =>
          exact TwoResidualContext.new
            (inductionHypothesis innerStep)
  | @parLeft left right inner rightPrefixFree inductionHypothesis =>
      cases step with
      | parLeft fresh innerStep =>
          exact TwoResidualContext.parLeft
            (inductionHypothesis innerStep) rightPrefixFree
      | parRight fresh inactiveStep =>
          exact (Late.NativeStep.false_of_source_prefixCount_eq_zero
            inactiveStep rightPrefixFree).elim
      | syncLeft outputStep inputStep binderFresh =>
          exact (Late.NativeStep.false_of_source_prefixCount_eq_zero
            inputStep rightPrefixFree).elim
      | syncRight inputStep outputStep binderFresh =>
          exact (Late.NativeStep.false_of_source_prefixCount_eq_zero
            outputStep rightPrefixFree).elim
      | closeLeft outputStep inputStep freshForReceiver binderFresh =>
          exact (Late.NativeStep.false_of_source_prefixCount_eq_zero
            inputStep rightPrefixFree).elim
      | closeRight inputStep outputStep freshForReceiver binderFresh =>
          exact (Late.NativeStep.false_of_source_prefixCount_eq_zero
            outputStep rightPrefixFree).elim
  | @parRight right left leftPrefixFree inner inductionHypothesis =>
      cases step with
      | parLeft fresh inactiveStep =>
          exact (Late.NativeStep.false_of_source_prefixCount_eq_zero
            inactiveStep leftPrefixFree).elim
      | parRight fresh innerStep =>
          exact TwoResidualContext.parRight leftPrefixFree
            (inductionHypothesis innerStep)
      | syncLeft outputStep inputStep binderFresh =>
          exact (Late.NativeStep.false_of_source_prefixCount_eq_zero
            outputStep leftPrefixFree).elim
      | syncRight inputStep outputStep binderFresh =>
          exact (Late.NativeStep.false_of_source_prefixCount_eq_zero
            inputStep leftPrefixFree).elim
      | closeLeft outputStep inputStep freshForReceiver binderFresh =>
          exact (Late.NativeStep.false_of_source_prefixCount_eq_zero
            outputStep leftPrefixFree).elim
      | closeRight inputStep outputStep freshForReceiver binderFresh =>
          exact (Late.NativeStep.false_of_source_prefixCount_eq_zero
            inputStep leftPrefixFree).elim
  | @choiceLeft left right inner rightPrefixFree inductionHypothesis =>
      cases step with
      | choiceLeft innerStep =>
          exact inductionHypothesis innerStep
      | choiceRight inactiveStep =>
          exact (Late.NativeStep.false_of_source_prefixCount_eq_zero
            inactiveStep rightPrefixFree).elim
  | @choiceRight right left leftPrefixFree inner inductionHypothesis =>
      cases step with
      | choiceLeft inactiveStep =>
          exact (Late.NativeStep.false_of_source_prefixCount_eq_zero
            inactiveStep leftPrefixFree).elim
      | choiceRight innerStep =>
          exact inductionHypothesis innerStep

/--
Every residual context is structurally a restriction list around the two
one-communication threads.  Prefix-free parallel garbage is removed using
the already verified `StructurallyZero` characterization.
-/
theorem TwoResidualContext.structural_normal_form
    {process : Raw.Proc}
    (context : TwoResidualContext process) :
    ∃ binders left right,
      OneCommThread left ∧
      OneCommThread right ∧
      Late.Struct process (wrapNews binders (.par left right)) := by
  induction context with
  | split leftThread rightThread =>
      exact ⟨[], _, _, leftThread, rightThread, Late.Struct.refl _⟩
  | @new body binder inner inductionHypothesis =>
      rcases inductionHypothesis with
        ⟨binders, left, right, leftThread, rightThread, normalized⟩
      exact ⟨binder :: binders, left, right, leftThread, rightThread,
        by simpa [wrapNews] using Late.Struct.new normalized⟩
  | parLeft inner rightPrefixFree inductionHypothesis =>
      rcases inductionHypothesis with
        ⟨binders, left, right, leftThread, rightThread, normalized⟩
      refine ⟨binders, left, right, leftThread, rightThread, ?_⟩
      apply Late.Struct.trans
        (Late.Struct.par normalized
          ((Late.Struct.structurallyZero_iff_prefixCount_zero _).mpr
            rightPrefixFree))
      exact Late.Struct.parZero
  | parRight leftPrefixFree inner inductionHypothesis =>
      rcases inductionHypothesis with
        ⟨binders, left, right, leftThread, rightThread, normalized⟩
      refine ⟨binders, left, right, leftThread, rightThread, ?_⟩
      apply Late.Struct.trans
        (Late.Struct.par
          ((Late.Struct.structurallyZero_iff_prefixCount_zero _).mpr
            leftPrefixFree)
          normalized)
      exact Late.Struct.par_zero_left _

/--
Kernel-built non-nominal residual theorem for every augmented requesting
candidate.  The remaining endpoint obligation is precisely to identify the
subjects, offered value, and binders of these two one-prefix threads.
-/
theorem AugmentedRequestingFingerprint.native_tau_two_residual_threads
    {source target : Raw.Proc}
    (fingerprint : AugmentedRequestingFingerprint source)
    (step : Late.NativeStep source .tau target) :
    ∃ binders left right,
      OneCommThread left ∧
      OneCommThread right ∧
      Late.Struct target (wrapNews binders (.par left right)) := by
  exact
    (TwoThreadContext.native_tau_target
      (AugmentedRequestingFingerprint.twoThreadContext fingerprint)
      step).structural_normal_form

/--
Strong native inversion for every representative in the canonical requesting
structural orbit.  It fixes the action to `tau`, gives the exact residual
polarity/counts, and exposes the two residual communication threads up to
structural congruence.

This theorem is deliberately stated at the actual native source.  It does not
transport a derivation across `relation`.
-/
theorem requesting_representative_native_residual_shape
    {source target : Raw.Proc} {action : Raw.Action}
    (relation : Late.Struct canonicalRequesting source)
    (step : Late.NativeStep source action target) :
    action = .tau ∧
      target.prefixCount = 2 ∧
      target.sendPrefixCount = 1 ∧
      target.recvPrefixCount = 1 ∧
      ∃ binders left right,
        OneCommThread left ∧
        OneCommThread right ∧
        Late.Struct target
          (wrapNews binders (.par left right)) := by
  have fingerprint :
      AugmentedRequestingFingerprint source :=
    augmentedFingerprint_of_struct_canonicalRequesting relation
  have actionEq : action = .tau :=
    (Late.Step.native step).action_eq_tau_of_source_freeSubjects_empty
      fingerprint.freeSubjects_eq
  subst action
  exact ⟨rfl,
    fingerprint.native_tau_target_prefixCount_eq step,
    fingerprint.native_tau_target_sendPrefixCount_eq step,
    fingerprint.native_tau_target_recvPrefixCount_eq step,
    AugmentedRequestingFingerprint.native_tau_two_residual_threads
      fingerprint step⟩

end Cantilune.Pi.P1bTwoThreadNativeInversion
