import Mathlib.Probability.Kernel.IonescuTulcea.Traj
import Cantilune.Core.Package
import Cantilune.Feedback.Probability

/-!
# Stochastic execution kernels and the hitting-event bridge

`Probability.HittingEventBridge` is intentionally independent of an execution
semantics.  This module supplies the missing construction:

1. start from a genuine mathlib Markov kernel;
2. turn the homogeneous kernel into history-dependent kernels;
3. use Ionescu--Tulcea to construct a probability measure on infinite paths;
4. define the measurable decreasing events that the stable set has not yet
   been hit; and
5. construct both `TailProbabilityContract` and `HittingEventBridge`.

For a general measurable state space, the local geometric recurrence remains
an explicit proof obligation on the particular kernel.  `kernel_progress`
records the pointwise lower bound, while `tail_step_from_kernel` is the
model-specific integration argument connecting that lower bound to the
Ionescu--Tulcea path measure.

The final section closes the arithmetic gap for a finite discrete
`ExecutionPackage`: a native-supported stochastic matrix induces a genuine
mathlib Markov kernel, and the killed-chain miss recurrence is derived from
the pointwise bound.  A finite-cylinder induction over the actual
Ionescu--Tulcea `trajMeasure` then proves that killed-chain mass is exactly the
probability of its `notHit` event.  No trajectory-agreement hypothesis is
stored or supplied by callers.
-/

namespace Cantilune.Feedback.StochasticExecution

open Filter MeasureTheory
open scoped ProbabilityTheory
open ProbabilityTheory
open Cantilune.Core
open Cantilune.Feedback.Probability

/-- A genuine homogeneous Markov transition kernel. -/
structure MarkovExecutionKernel (State : Type*) [MeasurableSpace State] where
  stepKernel : ProbabilityTheory.Kernel State State
  isMarkov : IsMarkovKernel stepKernel

namespace MarkovExecutionKernel

variable {State : Type*} [MeasurableSpace State]

/--
At time `n`, read the last state of the finite history and apply the
homogeneous one-step kernel.
-/
noncomputable def historyKernel
    (semantics : MarkovExecutionKernel State) (n : Nat) :
    ProbabilityTheory.Kernel
      ((i : Finset.Iic n) → State) State := by
  letI : IsMarkovKernel semantics.stepKernel := semantics.isMarkov
  exact ProbabilityTheory.Kernel.comap semantics.stepKernel
    (fun history => history ⟨n, Finset.mem_Iic.mpr le_rfl⟩)
    (measurable_pi_apply _)

noncomputable instance historyKernel_isMarkov
    (semantics : MarkovExecutionKernel State) (n : Nat) :
    IsMarkovKernel (semantics.historyKernel n) := by
  letI : IsMarkovKernel semantics.stepKernel := semantics.isMarkov
  unfold historyKernel
  infer_instance

/--
The probability law on infinite executions generated from an initial
probability measure and the one-step kernel.
-/
noncomputable def trajectoryMeasure
    (semantics : MarkovExecutionKernel State)
    (initial : Measure State) [IsProbabilityMeasure initial] :
    Measure (Nat → State) :=
  ProbabilityTheory.Kernel.trajMeasure initial semantics.historyKernel

noncomputable instance trajectoryMeasure_isProbability
    (semantics : MarkovExecutionKernel State)
    (initial : Measure State) [IsProbabilityMeasure initial] :
    IsProbabilityMeasure (semantics.trajectoryMeasure initial) := by
  unfold trajectoryMeasure
  infer_instance

/--
The execution has not hit `stable` by time `n`, including both the initial
state at time zero and the state at time `n`.
-/
def notHit (stable : State → Prop) (n : Nat) : Set (Nat → State) :=
  {path | ∀ k, k ≤ n → ¬ stable (path k)}

omit [MeasurableSpace State] in
theorem notHit_antitone (stable : State → Prop) :
    Antitone (notHit stable) := by
  intro first second firstLeSecond path missesSecond k kLeFirst
  exact missesSecond k (kLeFirst.trans firstLeSecond)

omit [MeasurableSpace State] in
theorem notHit_succ (stable : State → Prop) (n : Nat) :
    notHit stable (n + 1) =
      notHit stable n ∩ {path | ¬ stable (path (n + 1))} := by
  ext path
  constructor
  · intro misses
    exact ⟨
      fun k kLe => misses k (kLe.trans (Nat.le_succ n)),
      misses (n + 1) le_rfl
    ⟩
  · rintro ⟨missesBefore, missesNext⟩ k kLe
    by_cases kLeBefore : k ≤ n
    · exact missesBefore k kLeBefore
    · have kEq : k = n + 1 := by omega
      simpa [kEq] using missesNext

theorem measurable_notHit
    (stable : State → Prop)
    (measurableStable : MeasurableSet {state | stable state}) :
    ∀ n, MeasurableSet (notHit stable n) := by
  intro n
  induction n with
  | zero =>
      have coordinate :
          MeasurableSet {path : Nat → State | ¬ stable (path 0)} :=
        (measurableStable.preimage (measurable_pi_apply 0)).compl
      simpa [notHit] using coordinate
  | succ n ih =>
      rw [notHit_succ]
      exact ih.inter
        ((measurableStable.preimage
          (measurable_pi_apply (n + 1))).compl)

/-- Real-valued miss probability extracted from the generated path law. -/
noncomputable def missProbability
    (semantics : MarkovExecutionKernel State)
    (initial : Measure State) [IsProbabilityMeasure initial]
    (stable : State → Prop) (n : Nat) : Real :=
  (semantics.trajectoryMeasure initial (notHit stable n)).toReal

theorem missProbability_nonnegative
    (semantics : MarkovExecutionKernel State)
    (initial : Measure State) [IsProbabilityMeasure initial]
    (stable : State → Prop) (n : Nat) :
    0 ≤ semantics.missProbability initial stable n :=
  ENNReal.toReal_nonneg

theorem missProbability_initial_le_one
    (semantics : MarkovExecutionKernel State)
    (initial : Measure State) [IsProbabilityMeasure initial]
    (stable : State → Prop) :
    semantics.missProbability initial stable 0 ≤ 1 := by
  unfold missProbability
  exact ENNReal.toReal_mono ENNReal.one_ne_top prob_le_one

end MarkovExecutionKernel

/--
Relate a Markov kernel to the native observable steps of one execution
package.  The support equality prevents the stochastic semantics from
introducing target states that have no native source event.
-/
structure NativeKernelSemantics
    (signature : FinSignature)
    (package : ExecutionPackage signature)
    [MeasurableSpace package.lts.State]
    : Type
    extends MarkovExecutionKernel package.lts.State where
  nativeSuccessorsMeasurable :
    ∀ source, MeasurableSet
      {target | ∃ event, package.lts.ObservableStep source event target}
  step_supported :
    ∀ source,
      stepKernel source
        {target | ∃ event, package.lts.ObservableStep source event target} = 1

/--
All assumptions needed to derive the arithmetic tail contract from a concrete
kernel-generated trajectory law.

`tail_step_from_kernel` is intentionally a proof and not data duplicating the
miss sequence: both sides are definitionally the probabilities of `notHit`
under the Ionescu--Tulcea measure generated by `semantics`.
-/
structure KernelProgressAssumption
    {State : Type*} [MeasurableSpace State]
    (semantics : MarkovExecutionKernel State)
    (initial : Measure State) [IsProbabilityMeasure initial]
    (epsilon : Real) where
  window : StableFairWindow
  stable : State → Prop
  measurable_stable : MeasurableSet {state | stable state}
  epsilon_pos : 0 < epsilon
  epsilon_le_one : epsilon ≤ 1
  kernel_progress :
    ∀ state, ¬ stable state →
      ENNReal.ofReal epsilon ≤
        semantics.stepKernel state {target | stable target}
  tail_step_from_kernel :
    ∀ n,
      semantics.missProbability initial stable (n + 1) ≤
        (1 - epsilon) *
          semantics.missProbability initial stable n

namespace KernelProgressAssumption

variable {State : Type*} [MeasurableSpace State]
  {semantics : MarkovExecutionKernel State}
  {initial : Measure State} [IsProbabilityMeasure initial]
  {epsilon : Real}

/-- The arithmetic contract obtained from the kernel-generated path measure. -/
noncomputable def tailContract
    (assumption :
      KernelProgressAssumption semantics initial epsilon) :
    TailProbabilityContract epsilon where
  window := assumption.window
  missProbability :=
    semantics.missProbability initial assumption.stable
  epsilon_pos := assumption.epsilon_pos
  epsilon_le_one := assumption.epsilon_le_one
  miss_nonnegative :=
    semantics.missProbability_nonnegative initial assumption.stable
  miss_initial :=
    semantics.missProbability_initial_le_one initial assumption.stable
  miss_step := assumption.tail_step_from_kernel

/--
The requested probability bridge, constructed from the same stochastic
kernel and initial distribution as `tailContract`.
-/
noncomputable def hittingBridge
    (assumption :
      KernelProgressAssumption semantics initial epsilon) :
    HittingEventBridge
      (semantics.trajectoryMeasure initial)
      assumption.tailContract where
  notHit := MarkovExecutionKernel.notHit assumption.stable
  measurable_notHit :=
    MarkovExecutionKernel.measurable_notHit
      assumption.stable assumption.measurable_stable
  antitone_notHit :=
    MarkovExecutionKernel.notHit_antitone assumption.stable
  measure_notHit := by
    intro n
    apply Eq.symm
    exact ENNReal.ofReal_toReal
      (measure_ne_top
        (semantics.trajectoryMeasure initial)
        (MarkovExecutionKernel.notHit assumption.stable n))

/--
Almost-sure stable-set hitting for an execution law generated by an actual
Markov kernel, under the declared local progress/integration proof.
-/
theorem kernel_feedback_almost_sure_hitting
    (assumption :
      KernelProgressAssumption semantics initial epsilon) :
    ∀ᵐ path ∂semantics.trajectoryMeasure initial,
      assumption.hittingBridge.EventuallyHits path :=
  assumption.tailContract.feedback_almost_sure_hitting
    (semantics.trajectoryMeasure initial)
    assumption.hittingBridge

end KernelProgressAssumption

/-! ## Finite discrete kernel bridge -/

namespace FiniteDiscrete

/--
A finite-state stochastic matrix whose positive state changes are supported
by native observable steps of one `ExecutionPackage`.  Diagonal mass is the
Markov-chain holding probability at an observed opportunity; it does not
assert an additional execution event.

This is the discrete representation of a Markov kernel.  The row-sum and
nonnegativity fields are the probability axioms; `native_support_of_change`
prevents positive off-diagonal mass from introducing a non-native transition.
-/
structure NativeMarkovKernel
    (signature : FinSignature)
    (package : ExecutionPackage signature)
    (State : Type*) [Fintype State] [DecidableEq State] where
  stateEquiv : State ≃ package.lts.State
  probability : State → State → Real
  probability_nonnegative :
    ∀ source target, 0 ≤ probability source target
  row_sum :
    ∀ source, ∑ target, probability source target = 1
  native_support_of_change :
    ∀ {source target}, 0 < probability source target →
      source ≠ target →
      ∃ event,
        package.lts.ObservableStep
          (stateEquiv source) event (stateEquiv target)

namespace NativeMarkovKernel

variable {signature : FinSignature}
variable {package : ExecutionPackage signature}
variable {State : Type*} [Fintype State] [DecidableEq State]
variable [MeasurableSpace State]
variable [MeasurableSingletonClass State]

/-- The probability measure represented by one row of the stochastic matrix. -/
noncomputable def stateMeasure
    (kernel : NativeMarkovKernel signature package State)
    (source : State) :
    Measure State :=
  ∑ target,
    ENNReal.ofReal (kernel.probability source target) •
      Measure.dirac target

omit [MeasurableSingletonClass State] in
theorem stateMeasure_univ
    (kernel : NativeMarkovKernel signature package State)
    (source : State) :
    kernel.stateMeasure source Set.univ = 1 := by
  simp only [stateMeasure, Measure.finsetSum_apply,
    Measure.smul_apply, Measure.dirac_apply_of_mem, Set.mem_univ,
    smul_eq_mul, mul_one]
  rw [← ENNReal.ofReal_sum_of_nonneg]
  · rw [kernel.row_sum]
    norm_num
  · intro target _member
    exact kernel.probability_nonnegative source target

noncomputable def toKernel
    (kernel : NativeMarkovKernel signature package State) :
    ProbabilityTheory.Kernel State State :=
  ProbabilityTheory.Kernel.ofFunOfCountable kernel.stateMeasure

@[simp]
theorem toKernel_apply
    (kernel : NativeMarkovKernel signature package State)
    (source : State) :
    kernel.toKernel source = kernel.stateMeasure source :=
  rfl

@[simp]
theorem toKernel_apply_singleton
    (kernel : NativeMarkovKernel signature package State)
    (source target : State) :
    kernel.toKernel source {target} =
      ENNReal.ofReal (kernel.probability source target) := by
  rw [toKernel_apply]
  simp only [stateMeasure, Measure.finsetSum_apply,
    Measure.smul_apply, Measure.dirac_apply,
    smul_eq_mul]
  rw [Finset.sum_eq_single target]
  · simp
  · intro other _otherMember otherNe
    simp [otherNe]
  · simp

/-- The stochastic matrix induces a genuine mathlib Markov kernel. -/
noncomputable def toMarkovExecutionKernel
    (kernel : NativeMarkovKernel signature package State) :
    MarkovExecutionKernel State where
  stepKernel := kernel.toKernel
  isMarkov := by
    constructor
    intro source
    rw [isProbabilityMeasure_iff]
    exact kernel.stateMeasure_univ source

end NativeMarkovKernel

/-- A finite initial probability distribution. -/
structure InitialDistribution
    (State : Type*) [Fintype State] where
  probability : State → Real
  probability_nonnegative :
    ∀ state, 0 ≤ probability state
  total : ∑ state, probability state = 1

namespace InitialDistribution

variable {State : Type*} [Fintype State]
variable [MeasurableSpace State]

/-- The genuine finite measure represented by the initial mass function. -/
noncomputable def toMeasure
    (initial : InitialDistribution State) : Measure State :=
  ∑ state,
    ENNReal.ofReal (initial.probability state) • Measure.dirac state

theorem toMeasure_univ
    (initial : InitialDistribution State) :
    initial.toMeasure Set.univ = 1 := by
  simp only [toMeasure, Measure.finsetSum_apply,
    Measure.smul_apply, Measure.dirac_apply_of_mem, Set.mem_univ,
    smul_eq_mul, mul_one]
  rw [← ENNReal.ofReal_sum_of_nonneg]
  · rw [initial.total]
    norm_num
  · intro state _member
    exact initial.probability_nonnegative state

noncomputable instance toMeasure_isProbability
    (initial : InitialDistribution State) :
    IsProbabilityMeasure initial.toMeasure := by
  rw [isProbabilityMeasure_iff]
  exact initial.toMeasure_univ

@[simp]
theorem toMeasure_singleton
    [MeasurableSingletonClass State]
    [DecidableEq State]
    (initial : InitialDistribution State)
    (state : State) :
    initial.toMeasure {state} =
      ENNReal.ofReal (initial.probability state) := by
  simp only [toMeasure, Measure.finsetSum_apply,
    Measure.smul_apply, Measure.dirac_apply,
    smul_eq_mul]
  rw [Finset.sum_eq_single state]
  · simp
  · intro other _otherMember otherNe
    simp [otherNe]
  · simp

end InitialDistribution

variable {signature : FinSignature}
variable {package : ExecutionPackage signature}
variable {State : Type*} [Fintype State] [DecidableEq State]

def stableStates (stable : State → Bool) :
    Finset State :=
  Finset.univ.filter fun state => stable state = true

def unstableStates (stable : State → Bool) :
    Finset State :=
  Finset.univ.filter fun state => stable state ≠ true

omit [DecidableEq State] in
@[simp]
theorem mem_stableStates
    (stable : State → Bool)
    (state : State) :
    state ∈ stableStates stable ↔ stable state = true := by
  simp [stableStates]

omit [DecidableEq State] in
@[simp]
theorem mem_unstableStates
    (stable : State → Bool)
    (state : State) :
    state ∈ unstableStates stable ↔ stable state ≠ true := by
  simp [unstableStates]

theorem NativeMarkovKernel.toKernel_stable_apply
    [MeasurableSpace State]
    [MeasurableSingletonClass State]
    (kernel : NativeMarkovKernel signature package State)
    (stable : State → Bool)
    (source : State) :
    kernel.toKernel source {target | stable target = true} =
      ENNReal.ofReal
        (∑ target ∈ stableStates stable,
          kernel.probability source target) := by
  have measurableStable :
      MeasurableSet {target : State | stable target = true} :=
    Set.toFinite _ |>.measurableSet
  rw [NativeMarkovKernel.toKernel_apply]
  rw [ENNReal.ofReal_sum_of_nonneg]
  · simp only [NativeMarkovKernel.stateMeasure,
      Measure.finsetSum_apply, Measure.smul_apply,
      Measure.dirac_apply' _ measurableStable, smul_eq_mul]
    rw [stableStates, Finset.sum_filter]
    apply Finset.sum_congr rfl
    intro target _member
    by_cases targetStable : stable target = true <;>
      simp [Set.indicator, targetStable]
  · intro target _member
    exact kernel.probability_nonnegative source target

/--
The killed-chain distribution: mass is retained only along histories that
have not entered the stable set.
-/
def survivorMass
    (kernel : NativeMarkovKernel signature package State)
    (initial : InitialDistribution State)
    (stable : State → Bool) :
    Nat → State → Real
  | 0, state =>
      if stable state ≠ true then initial.probability state else 0
  | n + 1, target =>
      if stable target ≠ true then
        ∑ source ∈ unstableStates stable,
          survivorMass kernel initial stable n source *
            kernel.probability source target
      else 0

/-- Total probability mass of histories that have not yet hit stability. -/
def missProbability
    (kernel : NativeMarkovKernel signature package State)
    (initial : InitialDistribution State)
    (stable : State → Bool) (n : Nat) : Real :=
  ∑ state ∈ unstableStates stable,
    survivorMass kernel initial stable n state

theorem survivorMass_nonnegative
    (kernel : NativeMarkovKernel signature package State)
    (initial : InitialDistribution State)
    (stable : State → Bool) :
    ∀ n state, 0 ≤ survivorMass kernel initial stable n state := by
  intro n
  induction n with
  | zero =>
      intro state
      simp only [survivorMass]
      split
      · exact initial.probability_nonnegative state
      · exact le_rfl
  | succ n ih =>
      intro state
      simp only [survivorMass]
      split
      · apply Finset.sum_nonneg
        intro source _sourceMember
        exact mul_nonneg (ih source)
          (kernel.probability_nonnegative source state)
      · exact le_rfl

theorem unstable_transition_le
    (kernel : NativeMarkovKernel signature package State)
    (stable : State → Bool)
    {epsilon : Real}
    (progress :
      ∀ state, stable state ≠ true →
        epsilon ≤
          ∑ target ∈ stableStates stable,
            kernel.probability state target)
    (source : State)
    (sourceUnstable : stable source ≠ true) :
    (∑ target ∈ unstableStates stable,
        kernel.probability source target) ≤
      1 - epsilon := by
  have partition :
      (∑ target ∈ stableStates stable,
          kernel.probability source target) +
        (∑ target ∈ unstableStates stable,
          kernel.probability source target) = 1 := by
    calc
      _ = ∑ target, kernel.probability source target := by
        simpa [stableStates, unstableStates] using
          (Finset.sum_filter_add_sum_filter_not
            Finset.univ (fun state => stable state = true)
            (kernel.probability source))
      _ = 1 := kernel.row_sum source
  linarith [progress source sourceUnstable]

theorem missProbability_nonnegative
    (kernel : NativeMarkovKernel signature package State)
    (initial : InitialDistribution State)
    (stable : State → Bool) (n : Nat) :
    0 ≤ missProbability kernel initial stable n := by
  exact Finset.sum_nonneg fun state _member =>
    survivorMass_nonnegative kernel initial stable n state

theorem missProbability_initial_le_one
    (kernel : NativeMarkovKernel signature package State)
    (initial : InitialDistribution State)
    (stable : State → Bool) :
    missProbability kernel initial stable 0 ≤ 1 := by
  have partition :
      (∑ state ∈ stableStates stable, initial.probability state) +
        (∑ state ∈ unstableStates stable, initial.probability state) = 1 := by
    calc
      _ = ∑ state, initial.probability state := by
        simpa [stableStates, unstableStates] using
          (Finset.sum_filter_add_sum_filter_not
            Finset.univ (fun state => stable state = true)
            initial.probability)
      _ = 1 := initial.total
  have stableNonnegative :
      0 ≤ ∑ state ∈ stableStates stable, initial.probability state :=
    Finset.sum_nonneg fun state _member =>
      initial.probability_nonnegative state
  calc
    missProbability kernel initial stable 0 =
        ∑ state ∈ unstableStates stable,
          initial.probability state := by
      apply Finset.sum_congr rfl
      intro state stateMember
      simp [survivorMass,
        (mem_unstableStates stable state).mp stateMember]
    _ ≤ 1 := by
      linarith

theorem missProbability_step
    (kernel : NativeMarkovKernel signature package State)
    (initial : InitialDistribution State)
    (stable : State → Bool)
    {epsilon : Real}
    (progress :
      ∀ state, stable state ≠ true →
        epsilon ≤
          ∑ target ∈ stableStates stable,
            kernel.probability state target)
    (n : Nat) :
    missProbability kernel initial stable (n + 1) ≤
      (1 - epsilon) * missProbability kernel initial stable n := by
  calc
    missProbability kernel initial stable (n + 1) =
        ∑ target ∈ unstableStates stable,
          ∑ source ∈ unstableStates stable,
            survivorMass kernel initial stable n source *
              kernel.probability source target := by
      apply Finset.sum_congr rfl
      intro target targetMember
      simp [survivorMass,
        (mem_unstableStates stable target).mp targetMember]
    _ = ∑ source ∈ unstableStates stable,
          survivorMass kernel initial stable n source *
            (∑ target ∈ unstableStates stable,
              kernel.probability source target) := by
      rw [Finset.sum_comm]
      apply Finset.sum_congr rfl
      intro source _sourceMember
      rw [Finset.mul_sum]
    _ ≤ ∑ source ∈ unstableStates stable,
          survivorMass kernel initial stable n source *
            (1 - epsilon) := by
      apply Finset.sum_le_sum
      intro source sourceMember
      exact mul_le_mul_of_nonneg_left
        (unstable_transition_le kernel stable progress source
          (Finset.mem_filter.mp sourceMember).2)
        (survivorMass_nonnegative kernel initial stable n source)
    _ = (1 - epsilon) *
          missProbability kernel initial stable n := by
      simp only [missProbability]
      rw [Finset.mul_sum]
      apply Finset.sum_congr rfl
      intro source _sourceMember
      ring

/-! ### Finite Ionescu--Tulcea marginals -/

/--
The finite history through time `n` has avoided the stable set at every
coordinate.  This is the finite-dimensional cylinder underlying `notHit`.
-/
def historyMisses
    (stable : State → Bool) (n : Nat) :
    Set ((i : Finset.Iic n) → State) :=
  {history | ∀ i, stable (history i) ≠ true}

/-- The last state of a history indexed by `Iic n`. -/
def historyLast
    (n : Nat) (history : (i : Finset.Iic n) → State) : State :=
  history ⟨n, Finset.mem_Iic.mpr le_rfl⟩

/--
The finite not-hit cylinder whose endpoint at time `n` is the given state.
-/
def endpointFiber
    (stable : State → Bool) (n : Nat) (state : State) :
    Set ((i : Finset.Iic n) → State) :=
  historyMisses stable n ∩ {history | historyLast n history = state}

omit [DecidableEq State] in
theorem measurable_historyMisses
    [MeasurableSpace State]
    [MeasurableSingletonClass State]
    (stable : State → Bool) (n : Nat) :
    MeasurableSet (historyMisses stable n) :=
  Set.toFinite _ |>.measurableSet

omit [DecidableEq State] in
theorem measurable_endpointFiber
    [MeasurableSpace State]
    [MeasurableSingletonClass State]
    (stable : State → Bool) (n : Nat) (state : State) :
    MeasurableSet (endpointFiber stable n state) :=
  Set.toFinite _ |>.measurableSet

/-- The genuine trajectory law projected to its history through time `n`. -/
noncomputable def finiteMarginal
    [MeasurableSpace State]
    [MeasurableSingletonClass State]
    (kernel : NativeMarkovKernel signature package State)
    (initial : InitialDistribution State)
    (n : Nat) :
    Measure ((i : Finset.Iic n) → State) :=
  (kernel.toMarkovExecutionKernel.trajectoryMeasure initial.toMeasure).map
    (Preorder.frestrictLe n)

/--
At time zero the Ionescu--Tulcea finite marginal is exactly the supplied
initial distribution, transported across the unique-coordinate equivalence.
-/
theorem finiteMarginal_zero
    [MeasurableSpace State]
    [MeasurableSingletonClass State]
    (kernel : NativeMarkovKernel signature package State)
    (initial : InitialDistribution State) :
    finiteMarginal kernel initial 0 =
      initial.toMeasure.map (MeasurableEquiv.piUnique _).symm := by
  unfold finiteMarginal MarkovExecutionKernel.trajectoryMeasure
  rw [ProbabilityTheory.Kernel.trajMeasure,
    Measure.map_comp _ _ (Preorder.measurable_frestrictLe 0),
    ProbabilityTheory.Kernel.traj_map_frestrictLe,
    ProbabilityTheory.Kernel.partialTraj_self]
  simp

omit [Fintype State] [DecidableEq State] in
/-- Pulling a finite miss cylinder back to an infinite path gives `notHit`. -/
theorem preimage_historyMisses
    (stable : State → Bool) (n : Nat) :
    Preorder.frestrictLe n ⁻¹' historyMisses stable n =
      MarkovExecutionKernel.notHit
        (fun state => stable state = true) n := by
  ext path
  constructor
  · intro misses k hk
    exact misses ⟨k, Finset.mem_Iic.mpr hk⟩
  · intro misses i
    exact misses i (Finset.mem_Iic.mp i.property)

omit [Fintype State] [DecidableEq State] in
/--
For an unstable target, extending a miss history by that target is exactly
the endpoint fiber at the next time.
-/
theorem preimage_pair_historyMisses
    (stable : State → Bool) (n : Nat) (target : State)
    (targetUnstable : stable target ≠ true) :
    (fun path : Nat → State =>
        (Preorder.frestrictLe n path, path (n + 1))) ⁻¹'
        (historyMisses stable n ×ˢ {target}) =
      Preorder.frestrictLe (n + 1) ⁻¹'
        endpointFiber stable (n + 1) target := by
  ext path
  constructor
  · intro pairMember
    rcases pairMember with ⟨misses, targetEq⟩
    have pathTarget : path (n + 1) = target := targetEq
    refine ⟨?_, pathTarget⟩
    intro i
    by_cases hi : (i : Nat) ≤ n
    · exact misses ⟨i, Finset.mem_Iic.mpr hi⟩
    · have hiSucc : (i : Nat) ≤ n + 1 :=
        Finset.mem_Iic.mp i.property
      have hiEq : (i : Nat) = n + 1 := by omega
      simpa [hiEq, pathTarget] using targetUnstable
  · rintro ⟨misses, targetEq⟩
    constructor
    · intro i
      exact misses
        ⟨i, Finset.mem_Iic.mpr
          ((Finset.mem_Iic.mp i.property).trans (Nat.le_succ n))⟩
    · exact targetEq

omit [DecidableEq State] in
/--
Integrating a function of the last state over miss histories partitions into
the finitely many unstable endpoint fibers.
-/
theorem setLIntegral_historyLast
    [MeasurableSpace State]
    [MeasurableSingletonClass State]
    (measure : Measure ((i : Finset.Iic n) → State))
    (stable : State → Bool) (weight : State → ENNReal) :
    ∫⁻ history in historyMisses stable n,
        weight (historyLast n history) ∂measure =
      ∑ state ∈ unstableStates stable,
        weight state * measure (endpointFiber stable n state) := by
  have missesMeasurable :
      MeasurableSet (historyMisses stable n) :=
    measurable_historyMisses stable n
  have endpointMeasurable :
      ∀ state, MeasurableSet (endpointFiber stable n state) :=
    fun state => measurable_endpointFiber stable n state
  have decompose :
      (fun history =>
        (historyMisses stable n).indicator
          (fun history => weight (historyLast n history)) history) =
      (fun history =>
        ∑ state ∈ unstableStates stable,
          (endpointFiber stable n state).indicator
            (fun _ => weight state) history) := by
    funext history
    by_cases misses : history ∈ historyMisses stable n
    · have lastUnstable :
          stable (historyLast n history) ≠ true :=
        misses ⟨n, Finset.mem_Iic.mpr le_rfl⟩
      rw [Set.indicator_of_mem misses]
      rw [Finset.sum_eq_single (historyLast n history)]
      · simp [endpointFiber, misses]
      · intro other _otherMember otherNe
        have endpointNe :
            history ∉ endpointFiber stable n other := by
          intro endpoint
          exact otherNe endpoint.2.symm
        simp [Set.indicator_of_notMem endpointNe]
      · intro lastNotMember
        exact
          (lastNotMember
            ((mem_unstableStates stable _).mpr lastUnstable)).elim
    · rw [Set.indicator_of_notMem misses]
      symm
      apply Finset.sum_eq_zero
      intro state _stateMember
      have endpointNe :
          history ∉ endpointFiber stable n state := by
        intro endpoint
        exact misses endpoint.1
      simp [Set.indicator_of_notMem endpointNe]
  calc
    _ = ∫⁻ history,
        (historyMisses stable n).indicator
          (fun history => weight (historyLast n history)) history
          ∂measure := by
      rw [lintegral_indicator missesMeasurable]
    _ = ∫⁻ history,
        ∑ state ∈ unstableStates stable,
          (endpointFiber stable n state).indicator
            (fun _ => weight state) history ∂measure := by
      rw [decompose]
    _ = ∑ state ∈ unstableStates stable,
        ∫⁻ history,
          (endpointFiber stable n state).indicator
            (fun _ => weight state) history ∂measure := by
      rw [lintegral_finsetSum]
      intro state _stateMember
      exact measurable_const.indicator (endpointMeasurable state)
    _ = _ := by
      apply Finset.sum_congr rfl
      intro state _stateMember
      rw [lintegral_indicator (endpointMeasurable state),
        setLIntegral_const]

omit [Fintype State] [DecidableEq State] in
/--
The time-zero endpoint fiber, transported back along the unique-coordinate
equivalence, is either the corresponding initial singleton or empty.
-/
theorem preimage_endpointFiber_zero
    [MeasurableSpace State]
    (stable : State → Bool) (state : State) :
    (MeasurableEquiv.piUnique
      (fun _ : Finset.Iic 0 => State)).symm ⁻¹'
        endpointFiber stable 0 state =
      if stable state ≠ true then {state} else ∅ := by
  by_cases stateUnstable : stable state ≠ true
  · rw [if_pos stateUnstable]
    ext source
    constructor
    · intro endpoint
      exact endpoint.2
    · intro sourceEq
      subst source
      constructor
      · intro i
        have hi : i = default := Subsingleton.elim _ _
        subst i
        exact stateUnstable
      · rfl
  · rw [if_neg stateUnstable]
    ext source
    constructor
    · rintro ⟨misses, lastEq⟩
      have stateMisses : stable state ≠ true := by
        rw [← lastEq]
        exact misses ⟨0, Finset.mem_Iic.mpr le_rfl⟩
      exact (stateUnstable stateMisses).elim
    · intro impossible
      exact impossible.elim

/--
The endpoint fiber at time `n + 1` is computed by the genuine
Ionescu--Tulcea one-step `compProd`, not by a separately defined recurrence.
-/
theorem finiteMarginal_endpointFiber_succ
    [MeasurableSpace State]
    [MeasurableSingletonClass State]
    (kernel : NativeMarkovKernel signature package State)
    (initial : InitialDistribution State)
    (stable : State → Bool)
    (n : Nat) (target : State)
    (targetUnstable : stable target ≠ true) :
    finiteMarginal kernel initial (n + 1)
        (endpointFiber stable (n + 1) target) =
      ∫⁻ history in historyMisses stable n,
        (kernel.toMarkovExecutionKernel.historyKernel n history) {target}
          ∂finiteMarginal kernel initial n := by
  let trajectory :=
    kernel.toMarkovExecutionKernel.trajectoryMeasure initial.toMeasure
  have endpointMeasurable :
      MeasurableSet (endpointFiber stable (n + 1) target) :=
    measurable_endpointFiber stable (n + 1) target
  have targetMeasurable :
      MeasurableSet ({target} : Set State) :=
    measurableSet_singleton target
  have productMeasurable :
      MeasurableSet
        (historyMisses stable n ×ˢ ({target} : Set State)) :=
    (measurable_historyMisses stable n).prod targetMeasurable
  calc
    finiteMarginal kernel initial (n + 1)
        (endpointFiber stable (n + 1) target) =
      trajectory
        (Preorder.frestrictLe (n + 1) ⁻¹'
          endpointFiber stable (n + 1) target) := by
      rw [finiteMarginal, Measure.map_apply
        (Preorder.measurable_frestrictLe (n + 1))
        endpointMeasurable]
    _ = trajectory
        ((fun path : Nat → State =>
          (Preorder.frestrictLe n path, path (n + 1))) ⁻¹'
          (historyMisses stable n ×ˢ {target})) := by
      rw [preimage_pair_historyMisses
        stable n target targetUnstable]
    _ = trajectory.map
        (fun path : Nat → State =>
          (Preorder.frestrictLe n path, path (n + 1)))
        (historyMisses stable n ×ˢ {target}) := by
      rw [Measure.map_apply]
      · fun_prop
      · exact productMeasurable
    _ = (finiteMarginal kernel initial n ⊗ₘ
          kernel.toMarkovExecutionKernel.historyKernel n)
        (historyMisses stable n ×ˢ {target}) := by
      have marginalStep :=
        ProbabilityTheory.Kernel.map_frestrictLe_trajMeasure_compProd_eq_map_trajMeasure
          (X := fun _ => State)
          (κ := kernel.toMarkovExecutionKernel.historyKernel)
          (μ₀ := initial.toMeasure)
          (a := n)
      simpa only [finiteMarginal, trajectory,
        MarkovExecutionKernel.trajectoryMeasure] using
        congrArg
          (fun measure =>
            measure (historyMisses stable n ×ˢ {target}))
          marginalStep.symm
    _ = _ :=
      Measure.compProd_apply_prod
        (measurable_historyMisses stable n) targetMeasurable

/-- A history-kernel singleton is the corresponding stochastic-matrix entry. -/
theorem historyKernel_apply_singleton
    [MeasurableSpace State]
    [MeasurableSingletonClass State]
    (kernel : NativeMarkovKernel signature package State)
    (n : Nat)
    (history : (i : Finset.Iic n) → State)
    (target : State) :
    (kernel.toMarkovExecutionKernel.historyKernel n history) {target} =
      ENNReal.ofReal
        (kernel.probability (historyLast n history) target) := by
  change kernel.toKernel (historyLast n history) {target} = _
  exact kernel.toKernel_apply_singleton _ _

/--
Every endpoint cylinder probability of the genuine trajectory measure equals
the killed-chain survivor mass.  This is the finite-cylinder induction that
closes the trajectory/matrix identification internally.
-/
theorem finiteMarginal_endpointFiber
    [MeasurableSpace State]
    [MeasurableSingletonClass State]
    (kernel : NativeMarkovKernel signature package State)
    (initial : InitialDistribution State)
    (stable : State → Bool) :
    ∀ n state,
      finiteMarginal kernel initial n (endpointFiber stable n state) =
        ENNReal.ofReal
          (survivorMass kernel initial stable n state) := by
  intro n
  induction n with
  | zero =>
      intro state
      rw [finiteMarginal_zero]
      rw [Measure.map_apply
        (MeasurableEquiv.piUnique _).symm.measurable
        (measurable_endpointFiber stable 0 state)]
      rw [preimage_endpointFiber_zero]
      by_cases stateUnstable : stable state ≠ true
      · rw [if_pos stateUnstable,
          InitialDistribution.toMeasure_singleton]
        simp [survivorMass, stateUnstable]
      · rw [if_neg stateUnstable]
        simp [survivorMass, stateUnstable]
  | succ n ih =>
      intro target
      by_cases targetUnstable : stable target ≠ true
      · rw [finiteMarginal_endpointFiber_succ
          kernel initial stable n target targetUnstable]
        have integrand :
            (fun history =>
              (kernel.toMarkovExecutionKernel.historyKernel n history)
                {target}) =
              (fun history =>
                ENNReal.ofReal
                  (kernel.probability
                    (historyLast n history) target)) := by
          funext history
          exact historyKernel_apply_singleton
            kernel n history target
        rw [integrand]
        rw [setLIntegral_historyLast
          (finiteMarginal kernel initial n) stable
          (fun source =>
            ENNReal.ofReal (kernel.probability source target))]
        simp only [survivorMass, if_pos targetUnstable]
        rw [ENNReal.ofReal_sum_of_nonneg]
        · apply Finset.sum_congr rfl
          intro source _sourceMember
          rw [ih source,
            ENNReal.ofReal_mul
              (survivorMass_nonnegative
                kernel initial stable n source)]
          exact mul_comm _ _
        · intro source _sourceMember
          exact mul_nonneg
            (survivorMass_nonnegative
              kernel initial stable n source)
            (kernel.probability_nonnegative source target)
      · have endpointEmpty :
            endpointFiber stable (n + 1) target = ∅ := by
          ext history
          constructor
          · rintro ⟨misses, lastEq⟩
            have targetMisses : stable target ≠ true := by
              rw [← lastEq]
              exact misses
                ⟨n + 1, Finset.mem_Iic.mpr le_rfl⟩
            exact (targetUnstable targetMisses).elim
          · intro impossible
            exact impossible.elim
        rw [endpointEmpty]
        simp [survivorMass, targetUnstable]

omit [DecidableEq State] in
/-- The miss cylinder is the disjoint union of its unstable endpoint fibers. -/
theorem measure_historyMisses_eq_sum_endpointFiber
    [MeasurableSpace State]
    [MeasurableSingletonClass State]
    (measure : Measure ((i : Finset.Iic n) → State))
    (stable : State → Bool) :
    measure (historyMisses stable n) =
      ∑ state ∈ unstableStates stable,
        measure (endpointFiber stable n state) := by
  have partition :=
    setLIntegral_historyLast measure stable
      (fun _ => (1 : ENNReal))
  simpa only [setLIntegral_one, one_mul] using partition

/--
The infinite trajectory's `notHit n` probability is its finite-dimensional
miss-cylinder probability.
-/
theorem trajectory_notHit_eq_finiteMarginal
    [MeasurableSpace State]
    [MeasurableSingletonClass State]
    (kernel : NativeMarkovKernel signature package State)
    (initial : InitialDistribution State)
    (stable : State → Bool) (n : Nat) :
    (kernel.toMarkovExecutionKernel.trajectoryMeasure initial.toMeasure)
        (MarkovExecutionKernel.notHit
          (fun state => stable state = true) n) =
      finiteMarginal kernel initial n (historyMisses stable n) := by
  rw [finiteMarginal, Measure.map_apply
    (Preorder.measurable_frestrictLe n)
    (measurable_historyMisses stable n)]
  rw [preimage_historyMisses]

/--
The Ionescu--Tulcea not-hit cylinder probability is exactly the killed-chain
miss probability, for every finite native kernel and every time.
-/
theorem trajectory_notHit_eq_missProbability
    [MeasurableSpace State]
    [MeasurableSingletonClass State]
    (kernel : NativeMarkovKernel signature package State)
    (initial : InitialDistribution State)
    (stable : State → Bool) (n : Nat) :
    (kernel.toMarkovExecutionKernel.trajectoryMeasure initial.toMeasure)
        (MarkovExecutionKernel.notHit
          (fun state => stable state = true) n) =
      ENNReal.ofReal
        (FiniteDiscrete.missProbability kernel initial stable n) := by
  calc
    _ = finiteMarginal kernel initial n
        (historyMisses stable n) :=
      trajectory_notHit_eq_finiteMarginal
        kernel initial stable n
    _ = ∑ state ∈ unstableStates stable,
        finiteMarginal kernel initial n
          (endpointFiber stable n state) :=
      measure_historyMisses_eq_sum_endpointFiber
        (finiteMarginal kernel initial n) stable
    _ = ∑ state ∈ unstableStates stable,
        ENNReal.ofReal
          (survivorMass kernel initial stable n state) := by
      apply Finset.sum_congr rfl
      intro state _stateMember
      exact finiteMarginal_endpointFiber
        kernel initial stable n state
    _ = ENNReal.ofReal
        (∑ state ∈ unstableStates stable,
          survivorMass kernel initial stable n state) := by
      rw [ENNReal.ofReal_sum_of_nonneg]
      intro state _stateMember
      exact survivorMass_nonnegative
        kernel initial stable n state
    _ = _ := rfl

/--
Finite assumptions from which the tail recurrence is proved, rather than
supplied as an independent field.
-/
structure ProgressBridge
    (kernel : NativeMarkovKernel signature package State)
    (initial : InitialDistribution State)
    (epsilon : Real) where
  window : StableFairWindow
  stable : State → Bool
  epsilon_pos : 0 < epsilon
  epsilon_le_one : epsilon ≤ 1
  pointwise_progress :
    ∀ state, stable state ≠ true →
      epsilon ≤
        ∑ target ∈ stableStates stable,
          kernel.probability state target

namespace ProgressBridge

variable
    {kernel : NativeMarkovKernel signature package State}
    {initial : InitialDistribution State}
    {epsilon : Real}

/--
The finite pointwise assumption is exactly a lower bound on the stable set
under the genuine mathlib kernel induced by the same stochastic matrix.
-/
theorem pointwise_kernel_progress
    [MeasurableSpace State]
    [MeasurableSingletonClass State]
    (bridge : ProgressBridge kernel initial epsilon)
    (state : State)
    (unstable : bridge.stable state ≠ true) :
    ENNReal.ofReal epsilon ≤
      (kernel.toMarkovExecutionKernel.stepKernel state)
        {target | bridge.stable target = true} := by
  change ENNReal.ofReal epsilon ≤
    kernel.toKernel state {target | bridge.stable target = true}
  rw [NativeMarkovKernel.toKernel_stable_apply]
  exact ENNReal.ofReal_le_ofReal
    (bridge.pointwise_progress state unstable)

/-- Tail contract derived from the finite native Markov kernel. -/
def tailContract
    (bridge : ProgressBridge kernel initial epsilon) :
    TailProbabilityContract epsilon where
  window := bridge.window
  missProbability :=
    FiniteDiscrete.missProbability kernel initial bridge.stable
  epsilon_pos := bridge.epsilon_pos
  epsilon_le_one := bridge.epsilon_le_one
  miss_nonnegative :=
    FiniteDiscrete.missProbability_nonnegative
      kernel initial bridge.stable
  miss_initial :=
    FiniteDiscrete.missProbability_initial_le_one
      kernel initial bridge.stable
  miss_step :=
    FiniteDiscrete.missProbability_step
      kernel initial bridge.stable bridge.pointwise_progress

theorem trajectory_missProbability_eq
    [MeasurableSpace State]
    [MeasurableSingletonClass State]
    (bridge : ProgressBridge kernel initial epsilon)
    (n : Nat) :
    kernel.toMarkovExecutionKernel.missProbability
        initial.toMeasure
        (fun state => bridge.stable state = true) n =
      FiniteDiscrete.missProbability
        kernel initial bridge.stable n := by
  unfold MarkovExecutionKernel.missProbability
  rw [trajectory_notHit_eq_missProbability
    kernel initial bridge.stable n]
  exact ENNReal.toReal_ofReal
    (FiniteDiscrete.missProbability_nonnegative
      kernel initial bridge.stable n)

/--
The general `KernelProgressAssumption` is constructed with both its trajectory
identification and tail recurrence derived from the finite native kernel.
-/
noncomputable def toKernelProgressAssumption
    [MeasurableSpace State]
    [MeasurableSingletonClass State]
    (bridge : ProgressBridge kernel initial epsilon) :
    KernelProgressAssumption
      kernel.toMarkovExecutionKernel initial.toMeasure epsilon where
  window := bridge.window
  stable := fun state => bridge.stable state = true
  measurable_stable := Set.toFinite _ |>.measurableSet
  epsilon_pos := bridge.epsilon_pos
  epsilon_le_one := bridge.epsilon_le_one
  kernel_progress := by
    intro state unstable
    exact bridge.pointwise_kernel_progress state unstable
  tail_step_from_kernel := by
    intro n
    rw [bridge.trajectory_missProbability_eq (n + 1)]
    rw [bridge.trajectory_missProbability_eq n]
    exact bridge.tailContract.miss_step n

/--
Almost-sure hitting for the finite native execution kernel.

Unlike the generic theorem, both the geometric recurrence and its
identification with Ionescu--Tulcea not-hit cylinders are proved from the
finite stochastic matrix.
-/
theorem finite_kernel_feedback_almost_sure_hitting
    [MeasurableSpace State]
    [MeasurableSingletonClass State]
    (bridge : ProgressBridge kernel initial epsilon) :
    ∀ᵐ path ∂kernel.toMarkovExecutionKernel.trajectoryMeasure initial.toMeasure,
      bridge.toKernelProgressAssumption.hittingBridge.EventuallyHits
        path :=
  KernelProgressAssumption.kernel_feedback_almost_sure_hitting
    bridge.toKernelProgressAssumption

end ProgressBridge

end FiniteDiscrete

end Cantilune.Feedback.StochasticExecution
