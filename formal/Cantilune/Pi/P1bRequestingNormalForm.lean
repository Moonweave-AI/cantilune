import Cantilune.Pi.LateAlphaSupport
import Cantilune.Pi.Protocols

/-!
# Source-specific request/accept normal forms

This module develops only the finite two-party normal forms needed by P1b.
It deliberately does not state the false global claim that every native
`tau` transports across structural congruence.
-/

namespace Cantilune.Pi.P1bRequestingNormalForm

open Cantilune.Pi.Protocols

namespace Late.Struct

/-- A restriction whose binder is not free is structural garbage. -/
theorem new_fresh
    (fresh : binder ∉ Raw.Proc.freeNames process) :
    Late.Struct (.new binder process) process := by
  apply Late.Struct.trans
    (Late.Struct.new (Late.Struct.symm Late.Struct.parZero))
  apply Late.Struct.trans (Late.Struct.scopeExtrude fresh)
  apply Late.Struct.trans
    (Late.Struct.par (Late.Struct.refl _) Late.Struct.newZero)
  exact Late.Struct.parZero

end Late.Struct

/-- Wrap a finite list of nominal restrictions around a process. -/
def wrapNews : List Name → Raw.Proc → Raw.Proc
  | [], process => process
  | binder :: rest, process => .new binder (wrapNews rest process)

@[simp]
theorem wrapNews_nil (process : Raw.Proc) :
    wrapNews [] process = process :=
  rfl

@[simp]
theorem wrapNews_cons (binder : Name) (rest : List Name)
    (process : Raw.Proc) :
    wrapNews (binder :: rest) process =
      .new binder (wrapNews rest process) :=
  rfl

@[simp]
theorem prefixCount_wrapNews (binders : List Name)
    (process : Raw.Proc) :
    (wrapNews binders process).prefixCount = process.prefixCount := by
  induction binders <;>
    simp_all [wrapNews, Raw.Proc.prefixCount]

/-- Canonical raw communication pair before choosing binder names. -/
def pairProcess
    (channel value inputBinder : Name) : Raw.Proc :=
  .par
    (.send channel value .zero)
    (.recv channel inputBinder .zero)

@[simp]
theorem pairProcess_prefixCount
    (channel value inputBinder : Name) :
    (pairProcess channel value inputBinder).prefixCount = 2 := by
  simp [pairProcess, Raw.Proc.prefixCount]

@[simp]
theorem pairProcess_freeNames
    (channel value inputBinder : Name) :
    (pairProcess channel value inputBinder).freeNames =
      {channel, value} := by
  simp [pairProcess, Raw.Proc.freeNames, Finset.pair_comm]

@[simp]
theorem pairProcess_freeSubjects
    (channel value inputBinder : Name) :
    (pairProcess channel value inputBinder).freeSubjects =
      {channel} := by
  simp [pairProcess, Raw.Proc.freeSubjects]

/--
Normal form of a two-prefix communication redex.  The list records exactly
the restrictions accumulated while descending to the binary communication
rule; no claim about which restrictions are semantically essential is made
at this layer.
-/
def CommunicationPairForm (source : Raw.Proc) : Prop :=
  ∃ restrictions channel value inputBinder,
    Late.Struct source
      (wrapNews restrictions
        (pairProcess channel value inputBinder))

namespace Late.NativeStep

private theorem output_one_prefix_normal_aux
    (step : Cantilune.Pi.Late.NativeStep source action target)
    (actionEq : action = Raw.Action.output channel value)
    (sourceOne : source.prefixCount = 1)
    (targetZero : target.prefixCount = 0) :
    Late.Struct source (.send channel value .zero) := by
  induction step with
  | prefixTau =>
      cases actionEq
  | prefixOutput =>
      injection actionEq with channelEq valueEq
      subst channelEq
      subst valueEq
      exact Late.Struct.send
        ((Late.Struct.structurallyZero_iff_prefixCount_zero _).mpr
          targetZero)
  | prefixInput =>
      cases actionEq
  | matchGuard inner inductionHypothesis =>
      have positive := inner.source_prefixCount_pos
      simp only [Raw.Proc.prefixCount] at sourceOne
      omega
  | mismatchGuard distinct inner inductionHypothesis =>
      have positive := inner.source_prefixCount_pos
      simp only [Raw.Proc.prefixCount] at sourceOne
      omega
  | choiceLeft inner inductionHypothesis =>
      have positive := inner.source_prefixCount_pos
      simp only [Raw.Proc.prefixCount] at sourceOne
      have normalized :=
        inductionHypothesis actionEq (by omega) targetZero
      apply Late.Struct.trans
        (Late.Struct.choice normalized
          ((Late.Struct.structurallyZero_iff_prefixCount_zero _).mpr
            (by omega)))
      exact Late.Struct.choiceZero
  | choiceRight inner inductionHypothesis =>
      have positive := inner.source_prefixCount_pos
      simp only [Raw.Proc.prefixCount] at sourceOne
      have normalized :=
        inductionHypothesis actionEq (by omega) targetZero
      apply Late.Struct.trans
        (Late.Struct.choice
          ((Late.Struct.structurallyZero_iff_prefixCount_zero _).mpr
            (by omega))
          normalized)
      exact Late.Struct.choice_zero_left _
  | parLeft fresh inner inductionHypothesis =>
      have positive := inner.source_prefixCount_pos
      simp only [Raw.Proc.prefixCount] at sourceOne targetZero
      have normalized :=
        inductionHypothesis actionEq (by omega) (by omega)
      apply Late.Struct.trans
        (Late.Struct.par normalized
          ((Late.Struct.structurallyZero_iff_prefixCount_zero _).mpr
            (by omega)))
      exact Late.Struct.parZero
  | parRight fresh inner inductionHypothesis =>
      have positive := inner.source_prefixCount_pos
      simp only [Raw.Proc.prefixCount] at sourceOne targetZero
      have normalized :=
        inductionHypothesis actionEq (by omega) (by omega)
      apply Late.Struct.trans
        (Late.Struct.par
          ((Late.Struct.structurallyZero_iff_prefixCount_zero _).mpr
            (by omega))
          normalized)
      exact Late.Struct.par_zero_left _
  | syncLeft =>
      cases actionEq
  | syncRight =>
      cases actionEq
  | restrict fresh inner inductionHypothesis =>
      simp only [Raw.Proc.prefixCount] at sourceOne targetZero
      have normalized :=
        inductionHypothesis actionEq sourceOne targetZero
      apply Late.Struct.trans (Late.Struct.new normalized)
      apply Late.Struct.new_fresh
      cases actionEq
      simpa [Raw.Proc.freeNames, Raw.Action.names] using fresh
  | «open» =>
      cases actionEq
  | closeLeft =>
      cases actionEq
  | closeRight =>
      cases actionEq

/-- A one-prefix free-output derivation has exactly the expected prefix form. -/
theorem output_one_prefix_normal
    (step : Cantilune.Pi.Late.NativeStep source
      (Raw.Action.output channel value) target)
    (sourceOne : source.prefixCount = 1)
    (targetZero : target.prefixCount = 0) :
    Late.Struct source (.send channel value .zero) :=
  output_one_prefix_normal_aux step rfl sourceOne targetZero

private theorem input_one_prefix_normal_aux
    (step : Cantilune.Pi.Late.NativeStep source action target)
    (actionEq : action = Raw.Action.input channel binder)
    (sourceOne : source.prefixCount = 1)
    (targetZero : target.prefixCount = 0) :
    Late.Struct source (.recv channel binder .zero) := by
  induction step with
  | prefixTau =>
      cases actionEq
  | prefixOutput =>
      cases actionEq
  | prefixInput =>
      injection actionEq with channelEq binderEq
      subst channelEq
      subst binderEq
      exact Late.Struct.recv
        ((Late.Struct.structurallyZero_iff_prefixCount_zero _).mpr
          targetZero)
  | matchGuard inner inductionHypothesis =>
      have positive := inner.source_prefixCount_pos
      simp only [Raw.Proc.prefixCount] at sourceOne
      omega
  | mismatchGuard distinct inner inductionHypothesis =>
      have positive := inner.source_prefixCount_pos
      simp only [Raw.Proc.prefixCount] at sourceOne
      omega
  | choiceLeft inner inductionHypothesis =>
      have positive := inner.source_prefixCount_pos
      simp only [Raw.Proc.prefixCount] at sourceOne
      have normalized :=
        inductionHypothesis actionEq (by omega) targetZero
      apply Late.Struct.trans
        (Late.Struct.choice normalized
          ((Late.Struct.structurallyZero_iff_prefixCount_zero _).mpr
            (by omega)))
      exact Late.Struct.choiceZero
  | choiceRight inner inductionHypothesis =>
      have positive := inner.source_prefixCount_pos
      simp only [Raw.Proc.prefixCount] at sourceOne
      have normalized :=
        inductionHypothesis actionEq (by omega) targetZero
      apply Late.Struct.trans
        (Late.Struct.choice
          ((Late.Struct.structurallyZero_iff_prefixCount_zero _).mpr
            (by omega))
          normalized)
      exact Late.Struct.choice_zero_left _
  | parLeft fresh inner inductionHypothesis =>
      have positive := inner.source_prefixCount_pos
      simp only [Raw.Proc.prefixCount] at sourceOne targetZero
      have normalized :=
        inductionHypothesis actionEq (by omega) (by omega)
      apply Late.Struct.trans
        (Late.Struct.par normalized
          ((Late.Struct.structurallyZero_iff_prefixCount_zero _).mpr
            (by omega)))
      exact Late.Struct.parZero
  | parRight fresh inner inductionHypothesis =>
      have positive := inner.source_prefixCount_pos
      simp only [Raw.Proc.prefixCount] at sourceOne targetZero
      have normalized :=
        inductionHypothesis actionEq (by omega) (by omega)
      apply Late.Struct.trans
        (Late.Struct.par
          ((Late.Struct.structurallyZero_iff_prefixCount_zero _).mpr
            (by omega))
          normalized)
      exact Late.Struct.par_zero_left _
  | syncLeft =>
      cases actionEq
  | syncRight =>
      cases actionEq
  | restrict fresh inner inductionHypothesis =>
      simp only [Raw.Proc.prefixCount] at sourceOne targetZero
      have normalized :=
        inductionHypothesis actionEq sourceOne targetZero
      apply Late.Struct.trans (Late.Struct.new normalized)
      apply Late.Struct.new_fresh
      cases actionEq
      simp only [Raw.Proc.freeNames, Finset.erase_empty,
        Finset.mem_insert, Finset.notMem_empty, or_false]
      simp only [Raw.Action.names, Finset.mem_insert,
        Finset.mem_singleton] at fresh
      intro binderChannel
      exact fresh (Or.inl binderChannel)
  | «open» =>
      cases actionEq
  | closeLeft =>
      cases actionEq
  | closeRight =>
      cases actionEq

/-- A one-prefix late-input derivation has exactly the expected prefix form. -/
theorem input_one_prefix_normal
    (step : Cantilune.Pi.Late.NativeStep source
      (Raw.Action.input channel binder) target)
    (sourceOne : source.prefixCount = 1)
    (targetZero : target.prefixCount = 0) :
    Late.Struct source (.recv channel binder .zero) :=
  input_one_prefix_normal_aux step rfl sourceOne targetZero

private theorem boundOutput_one_prefix_normal_aux
    (step : Cantilune.Pi.Late.NativeStep source action target)
    (actionEq : action = Raw.Action.boundOutput channel freshName)
    (sourceOne : source.prefixCount = 1)
    (targetZero : target.prefixCount = 0) :
    Late.Struct source
      (.new freshName (.send channel freshName .zero)) := by
  induction step with
  | prefixTau =>
      cases actionEq
  | prefixOutput =>
      cases actionEq
  | prefixInput =>
      cases actionEq
  | matchGuard inner inductionHypothesis =>
      have positive := inner.source_prefixCount_pos
      simp only [Raw.Proc.prefixCount] at sourceOne
      omega
  | mismatchGuard distinct inner inductionHypothesis =>
      have positive := inner.source_prefixCount_pos
      simp only [Raw.Proc.prefixCount] at sourceOne
      omega
  | choiceLeft inner inductionHypothesis =>
      have positive := inner.source_prefixCount_pos
      simp only [Raw.Proc.prefixCount] at sourceOne
      have normalized :=
        inductionHypothesis actionEq (by omega) targetZero
      apply Late.Struct.trans
        (Late.Struct.choice normalized
          ((Late.Struct.structurallyZero_iff_prefixCount_zero _).mpr
            (by omega)))
      exact Late.Struct.choiceZero
  | choiceRight inner inductionHypothesis =>
      have positive := inner.source_prefixCount_pos
      simp only [Raw.Proc.prefixCount] at sourceOne
      have normalized :=
        inductionHypothesis actionEq (by omega) targetZero
      apply Late.Struct.trans
        (Late.Struct.choice
          ((Late.Struct.structurallyZero_iff_prefixCount_zero _).mpr
            (by omega))
          normalized)
      exact Late.Struct.choice_zero_left _
  | parLeft actionFresh inner inductionHypothesis =>
      have positive := inner.source_prefixCount_pos
      simp only [Raw.Proc.prefixCount] at sourceOne targetZero
      have normalized :=
        inductionHypothesis actionEq (by omega) (by omega)
      apply Late.Struct.trans
        (Late.Struct.par normalized
          ((Late.Struct.structurallyZero_iff_prefixCount_zero _).mpr
            (by omega)))
      exact Late.Struct.parZero
  | parRight actionFresh inner inductionHypothesis =>
      have positive := inner.source_prefixCount_pos
      simp only [Raw.Proc.prefixCount] at sourceOne targetZero
      have normalized :=
        inductionHypothesis actionEq (by omega) (by omega)
      apply Late.Struct.trans
        (Late.Struct.par
          ((Late.Struct.structurallyZero_iff_prefixCount_zero _).mpr
            (by omega))
          normalized)
      exact Late.Struct.par_zero_left _
  | syncLeft =>
      cases actionEq
  | syncRight =>
      cases actionEq
  | restrict actionFresh inner inductionHypothesis =>
      simp only [Raw.Proc.prefixCount] at sourceOne targetZero
      have normalized :=
        inductionHypothesis actionEq sourceOne targetZero
      apply Late.Struct.trans (Late.Struct.new normalized)
      apply Late.Struct.new_fresh
      cases actionEq
      simp [Raw.Proc.freeNames, Raw.Action.names] at actionFresh ⊢
      aesop
  | «open» distinct inner inductionHypothesis =>
      injection actionEq with channelEq freshEq
      subst channelEq
      subst freshEq
      simp only [Raw.Proc.prefixCount] at sourceOne
      exact Late.Struct.new
        (Late.NativeStep.output_one_prefix_normal
          inner sourceOne targetZero)
  | closeLeft =>
      cases actionEq
  | closeRight =>
      cases actionEq

/--
A one-prefix bound-output derivation is precisely an `open` transition from
one restricted free-output prefix, modulo structural congruence.
-/
theorem boundOutput_one_prefix_normal
    (step : Cantilune.Pi.Late.NativeStep source
      (Raw.Action.boundOutput channel freshName) target)
    (sourceOne : source.prefixCount = 1)
    (targetZero : target.prefixCount = 0) :
    Late.Struct source
      (.new freshName (.send channel freshName .zero)) :=
  boundOutput_one_prefix_normal_aux step rfl sourceOne targetZero

/-- A native source with no unary prefix consists only of communication prefixes. -/
theorem source_all_communication_of_unary_zero
    (step : Cantilune.Pi.Late.NativeStep source action target)
    (noUnary : source.unaryPrefixCount = 0) :
    source.prefixCount = source.communicationPrefixCount := by
  rw [Raw.Proc.prefixCount_eq_communication_add_unary]
  simp [noUnary]

/-- Enclosing a communication pair form in one more restriction preserves it. -/
theorem communicationPairForm_new
    (form : CommunicationPairForm process) :
    CommunicationPairForm (.new binder process) := by
  rcases form with
    ⟨restrictions, channel, value, inputBinder, normalized⟩
  exact
    ⟨binder :: restrictions, channel, value, inputBinder,
      Late.Struct.new normalized⟩

private theorem syncLeft_two_prefix_pair_form
    (outputStep :
      Cantilune.Pi.Late.NativeStep left
        (.output channel value) leftTarget)
    (inputStep :
      Cantilune.Pi.Late.NativeStep right
        (.input channel inputBinder) rightTarget)
    (sourceTwo : (Raw.Proc.par left right).prefixCount = 2)
    (targetZero :
      (Raw.Proc.par leftTarget
        (rightTarget.substituteCaptureAvoiding
          inputBinder value)).prefixCount = 0) :
    CommunicationPairForm (Raw.Proc.par left right) := by
  have outputPositive := outputStep.source_prefixCount_pos
  have inputPositive := inputStep.source_prefixCount_pos
  simp only [Raw.Proc.prefixCount] at sourceTwo targetZero
  rw [Raw.Proc.prefixCount_substituteCaptureAvoiding] at targetZero
  refine ⟨[], channel, value, inputBinder, ?_⟩
  simpa [wrapNews, pairProcess] using
    Late.Struct.par
      (output_one_prefix_normal outputStep (by omega) (by omega))
      (input_one_prefix_normal inputStep (by omega) (by omega))

private theorem syncRight_two_prefix_pair_form
    (inputStep :
      Cantilune.Pi.Late.NativeStep left
        (.input channel inputBinder) leftTarget)
    (outputStep :
      Cantilune.Pi.Late.NativeStep right
        (.output channel value) rightTarget)
    (sourceTwo : (Raw.Proc.par left right).prefixCount = 2)
    (targetZero :
      (Raw.Proc.par
        (leftTarget.substituteCaptureAvoiding inputBinder value)
        rightTarget).prefixCount = 0) :
    CommunicationPairForm (Raw.Proc.par left right) := by
  have inputPositive := inputStep.source_prefixCount_pos
  have outputPositive := outputStep.source_prefixCount_pos
  simp only [Raw.Proc.prefixCount] at sourceTwo targetZero
  rw [Raw.Proc.prefixCount_substituteCaptureAvoiding] at targetZero
  refine ⟨[], channel, value, inputBinder, ?_⟩
  apply Late.Struct.trans
    (Late.Struct.par
      (input_one_prefix_normal inputStep (by omega) (by omega))
      (output_one_prefix_normal outputStep (by omega) (by omega)))
  simpa [wrapNews, pairProcess] using
    (Late.Struct.parComm :
      Late.Struct
        (.par
          (.recv channel inputBinder .zero)
          (.send channel value .zero))
        (.par
          (.send channel value .zero)
          (.recv channel inputBinder .zero)))

private theorem closeLeft_two_prefix_pair_form
    (outputStep :
      Cantilune.Pi.Late.NativeStep left
        (.boundOutput channel freshName) leftTarget)
    (inputStep :
      Cantilune.Pi.Late.NativeStep right
        (.input channel inputBinder) rightTarget)
    (freshForReceiver : freshName ∉ right.freeNames)
    (sourceTwo : (Raw.Proc.par left right).prefixCount = 2)
    (targetZero :
      (Raw.Proc.new freshName
        (Raw.Proc.par leftTarget
          (rightTarget.substituteCaptureAvoiding
            inputBinder freshName))).prefixCount = 0) :
    CommunicationPairForm (Raw.Proc.par left right) := by
  have outputPositive := outputStep.source_prefixCount_pos
  have inputPositive := inputStep.source_prefixCount_pos
  simp only [Raw.Proc.prefixCount] at sourceTwo targetZero
  rw [Raw.Proc.prefixCount_substituteCaptureAvoiding] at targetZero
  have outputNormal :=
    boundOutput_one_prefix_normal outputStep (by omega) (by omega)
  have inputNormal :=
    input_one_prefix_normal inputStep (by omega) (by omega)
  have canonicalFresh :
      freshName ∉
        (.recv channel inputBinder .zero : Raw.Proc).freeNames := by
    rw [← Late.Struct.freeNames_eq inputNormal]
    exact freshForReceiver
  refine ⟨[freshName], channel, freshName, inputBinder, ?_⟩
  apply Late.Struct.trans
    (Late.Struct.par outputNormal inputNormal)
  apply Late.Struct.trans Late.Struct.parComm
  apply Late.Struct.trans
    (Late.Struct.symm (Late.Struct.scopeExtrude canonicalFresh))
  simpa [wrapNews, pairProcess] using
    Late.Struct.new
      (Late.Struct.parComm :
        Late.Struct
          (.par
            (.recv channel inputBinder .zero)
            (.send channel freshName .zero))
          (.par
            (.send channel freshName .zero)
            (.recv channel inputBinder .zero)))

private theorem closeRight_two_prefix_pair_form
    (inputStep :
      Cantilune.Pi.Late.NativeStep left
        (.input channel inputBinder) leftTarget)
    (outputStep :
      Cantilune.Pi.Late.NativeStep right
        (.boundOutput channel freshName) rightTarget)
    (freshForReceiver : freshName ∉ left.freeNames)
    (sourceTwo : (Raw.Proc.par left right).prefixCount = 2)
    (targetZero :
      (Raw.Proc.new freshName
        (Raw.Proc.par
          (leftTarget.substituteCaptureAvoiding
            inputBinder freshName)
          rightTarget)).prefixCount = 0) :
    CommunicationPairForm (Raw.Proc.par left right) := by
  have inputPositive := inputStep.source_prefixCount_pos
  have outputPositive := outputStep.source_prefixCount_pos
  simp only [Raw.Proc.prefixCount] at sourceTwo targetZero
  rw [Raw.Proc.prefixCount_substituteCaptureAvoiding] at targetZero
  have inputNormal :=
    input_one_prefix_normal inputStep (by omega) (by omega)
  have outputNormal :=
    boundOutput_one_prefix_normal outputStep (by omega) (by omega)
  have canonicalFresh :
      freshName ∉
        (.recv channel inputBinder .zero : Raw.Proc).freeNames := by
    rw [← Late.Struct.freeNames_eq inputNormal]
    exact freshForReceiver
  refine ⟨[freshName], channel, freshName, inputBinder, ?_⟩
  apply Late.Struct.trans
    (Late.Struct.par inputNormal outputNormal)
  apply Late.Struct.trans
    (Late.Struct.symm (Late.Struct.scopeExtrude canonicalFresh))
  simpa [wrapNews, pairProcess] using
    Late.Struct.new
      (Late.Struct.parComm :
        Late.Struct
          (.par
            (.recv channel inputBinder .zero)
            (.send channel freshName .zero))
          (.par
            (.send channel freshName .zero)
            (.recv channel inputBinder .zero)))

private theorem two_communication_prefix_tau_pair_form_aux
    (step : Cantilune.Pi.Late.NativeStep source action target)
    (actionEq : action = .tau)
    (sourceTwo : source.prefixCount = 2)
    (sourceCommunicationTwo :
      source.communicationPrefixCount = 2)
    (targetZero : target.prefixCount = 0) :
    CommunicationPairForm source := by
  have sourceNoUnary : source.unaryPrefixCount = 0 := by
    have partition :=
      Raw.Proc.prefixCount_eq_communication_add_unary source
    omega
  induction step with
  | prefixTau =>
      simp [Raw.Proc.unaryPrefixCount] at sourceNoUnary
  | prefixOutput =>
      cases actionEq
  | prefixInput =>
      cases actionEq
  | matchGuard inner inductionHypothesis =>
      simp [Raw.Proc.unaryPrefixCount] at sourceNoUnary
  | mismatchGuard distinct inner inductionHypothesis =>
      simp [Raw.Proc.unaryPrefixCount] at sourceNoUnary
  | choiceLeft inner inductionHypothesis =>
      simp only [Raw.Proc.unaryPrefixCount,
        Nat.add_eq_zero_iff] at sourceNoUnary
      have activeAll :=
        source_all_communication_of_unary_zero
          inner sourceNoUnary.1
      cases actionEq
      have activeConsumesTwo :=
        inner.target_prefixCount_add_two_le_of_tau_all_communication
          activeAll
      simp only [Raw.Proc.prefixCount] at sourceTwo
      rcases inductionHypothesis rfl (by omega)
          (by omega) targetZero sourceNoUnary.1 with
        ⟨restrictions, channel, value, binder, normalized⟩
      refine ⟨restrictions, channel, value, binder, ?_⟩
      apply Late.Struct.trans
        (Late.Struct.choice normalized
          ((Late.Struct.structurallyZero_iff_prefixCount_zero _).mpr
            (by omega)))
      exact Late.Struct.choiceZero
  | choiceRight inner inductionHypothesis =>
      simp only [Raw.Proc.unaryPrefixCount,
        Nat.add_eq_zero_iff] at sourceNoUnary
      have activeAll :=
        source_all_communication_of_unary_zero
          inner sourceNoUnary.2
      cases actionEq
      have activeConsumesTwo :=
        inner.target_prefixCount_add_two_le_of_tau_all_communication
          activeAll
      simp only [Raw.Proc.prefixCount] at sourceTwo
      rcases inductionHypothesis rfl (by omega)
          (by omega) targetZero sourceNoUnary.2 with
        ⟨restrictions, channel, value, binder, normalized⟩
      refine ⟨restrictions, channel, value, binder, ?_⟩
      apply Late.Struct.trans
        (Late.Struct.choice
          ((Late.Struct.structurallyZero_iff_prefixCount_zero _).mpr
            (by omega))
          normalized)
      exact Late.Struct.choice_zero_left _
  | parLeft actionFresh inner inductionHypothesis =>
      simp only [Raw.Proc.prefixCount] at sourceTwo targetZero
      simp only [Raw.Proc.unaryPrefixCount,
        Nat.add_eq_zero_iff] at sourceNoUnary
      have activeAll :=
        source_all_communication_of_unary_zero
          inner sourceNoUnary.1
      rcases inductionHypothesis actionEq (by omega)
          (by omega) (by omega) sourceNoUnary.1 with
        ⟨restrictions, channel, value, binder, normalized⟩
      refine ⟨restrictions, channel, value, binder, ?_⟩
      apply Late.Struct.trans
        (Late.Struct.par normalized
          ((Late.Struct.structurallyZero_iff_prefixCount_zero _).mpr
            (by omega)))
      exact Late.Struct.parZero
  | parRight actionFresh inner inductionHypothesis =>
      simp only [Raw.Proc.prefixCount] at sourceTwo targetZero
      simp only [Raw.Proc.unaryPrefixCount,
        Nat.add_eq_zero_iff] at sourceNoUnary
      have activeAll :=
        source_all_communication_of_unary_zero
          inner sourceNoUnary.2
      rcases inductionHypothesis actionEq (by omega)
          (by omega) (by omega) sourceNoUnary.2 with
        ⟨restrictions, channel, value, binder, normalized⟩
      refine ⟨restrictions, channel, value, binder, ?_⟩
      apply Late.Struct.trans
        (Late.Struct.par
          ((Late.Struct.structurallyZero_iff_prefixCount_zero _).mpr
            (by omega))
          normalized)
      exact Late.Struct.par_zero_left _
  | syncLeft outputStep inputStep binderFresh =>
      exact syncLeft_two_prefix_pair_form
        outputStep inputStep sourceTwo targetZero
  | syncRight inputStep outputStep binderFresh =>
      exact syncRight_two_prefix_pair_form
        inputStep outputStep sourceTwo targetZero
  | restrict actionFresh inner inductionHypothesis =>
      simp only [Raw.Proc.prefixCount] at sourceTwo targetZero
      simp only [Raw.Proc.communicationPrefixCount] at sourceCommunicationTwo
      exact communicationPairForm_new
        (inductionHypothesis actionEq sourceTwo
          sourceCommunicationTwo targetZero sourceNoUnary)
  | «open» =>
      cases actionEq
  | closeLeft outputStep inputStep freshForReceiver binderFresh =>
      exact closeLeft_two_prefix_pair_form
        outputStep inputStep freshForReceiver sourceTwo targetZero
  | closeRight inputStep outputStep freshForReceiver binderFresh =>
      exact closeRight_two_prefix_pair_form
        inputStep outputStep freshForReceiver sourceTwo targetZero

/--
Every native silent transition which consumes exactly two communication
prefixes down to a prefix-free target exposes one send/receive redex, with
the `open`/`close` case represented by an enclosing restriction.
-/
theorem two_communication_prefix_tau_pair_form
    (step : Cantilune.Pi.Late.NativeStep source .tau target)
    (sourceTwo : source.prefixCount = 2)
    (sourceCommunicationTwo :
      source.communicationPrefixCount = 2)
    (targetZero : target.prefixCount = 0) :
    CommunicationPairForm source :=
  two_communication_prefix_tau_pair_form_aux
    step rfl sourceTwo sourceCommunicationTwo targetZero

end Late.NativeStep

end Cantilune.Pi.P1bRequestingNormalForm
