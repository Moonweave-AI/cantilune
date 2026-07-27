import Cantilune.Feedback.EventTrajectorySupport
import Mathlib.MeasureTheory.Measure.Prod

/-!
# Sparse native-event Markov kernels

This module places event identity in the one-step Markov payload.  Unlike
`RandomTotalNativeLabelling`, a sparse event kernel has no obligation to
invent an event for a zero-mass edge.  A positive payload is either:

* `none`, in which case it is an unlabelled diagonal hold; or
* `some event`, in which case the supplied probability proof must carry a
  native `ObservableStep`.  The corresponding verified `DPOEvent` replay is
  then derived from the `ExecutionPackage`.

The Ionescu--Tulcea law is constructed directly on event nodes
`State × Option Event`.  Thus the event used by transition `n` is stored in
node `n + 1`; it is not reconstructed from a total endpoint labelling.

The two-kernel theorem below remains conditional on caller-supplied kernels,
initial laws, an exact coupling, and a semantic seam.  It constructs no
production-package inhabitant.
-/

noncomputable section

namespace Cantilune.Feedback.SparseEventKernelTrajectoryAgreement

open MeasureTheory
open ProbabilityTheory
open Finset Function Preorder
open Cantilune.Core
open Cantilune.Feedback.StochasticExecution

universe uLeftState uRightState uMark uAction

/--
One Markov node records the current execution state and the optional native
event which was used to enter it.  `none` denotes an unlabelled hold.
-/
abbrev EventNode
    {signature : FinSignature}
    (package : ExecutionPackage signature)
    (State : Type uLeftState) :=
  State × Option package.lts.Event

/-!
`Option` deliberately has no global measurable-space instance in mathlib.
Event payloads are finite throughout this module, so we equip the optional
event component with the discrete measurable space.  The event node then uses
the ordinary product measurable space, making both projections measurable.
-/

instance eventPayloadMeasurableSpace
    {signature : FinSignature}
    (package : ExecutionPackage signature)
    : MeasurableSpace (Option package.lts.Event) :=
  ⊤

instance eventPayloadMeasurableSingletonClass
    {signature : FinSignature}
    (package : ExecutionPackage signature)
    : MeasurableSingletonClass (Option package.lts.Event) :=
  ⟨fun _ => trivial⟩

/--
A finite stochastic kernel whose transition target carries its event payload.

Only positive `some event` entries need a native event proof.  Positive
`none` entries must be diagonal holds.  In particular there is no total
labelling premise and no native self-event premise for holding mass.
-/
structure SparseNativeEventKernel
    {signature : FinSignature}
    (package : ExecutionPackage signature)
    (State : Type uLeftState)
    [Fintype State] [DecidableEq State]
    [Fintype package.lts.Event] [DecidableEq package.lts.Event] where
  stateEquiv : State ≃ package.lts.State
  probability :
    EventNode package State → EventNode package State → Real
  probability_nonnegative :
    ∀ source target, 0 ≤ probability source target
  row_sum :
    ∀ source, ∑ target, probability source target = 1
  positive_hold_stays :
    ∀ {source : EventNode package State} {targetState : State},
      0 < probability source (targetState, none) →
        targetState = source.1
  positive_event_native :
    ∀ {source : EventNode package State}
      {targetState : State} {event : package.lts.Event},
      0 < probability source (targetState, some event) →
        package.lts.ObservableStep
          (stateEquiv source.1) event (stateEquiv targetState)

namespace SparseNativeEventKernel

variable
    {signature : FinSignature}
    {package : ExecutionPackage signature}
    {State : Type uLeftState}
    [Fintype State] [DecidableEq State]
    [Fintype package.lts.Event] [DecidableEq package.lts.Event]
    [MeasurableSpace State] [MeasurableSingletonClass State]

/-- The finite measure represented by one event-kernel row. -/
noncomputable def nodeMeasure
    (kernel : SparseNativeEventKernel package State)
    (source : EventNode package State) :
    Measure (EventNode package State) :=
  ∑ target,
    ENNReal.ofReal (kernel.probability source target) •
      Measure.dirac target

theorem nodeMeasure_univ
    (kernel : SparseNativeEventKernel package State)
    (source : EventNode package State) :
    kernel.nodeMeasure source Set.univ = 1 := by
  simp only [nodeMeasure, Measure.finsetSum_apply,
    Measure.smul_apply, Measure.dirac_apply_of_mem, Set.mem_univ,
    smul_eq_mul, mul_one]
  rw [← ENNReal.ofReal_sum_of_nonneg]
  · rw [kernel.row_sum]
    norm_num
  · intro target _member
    exact kernel.probability_nonnegative source target

/-- The sparse event matrix as a genuine mathlib Markov kernel. -/
noncomputable def toKernel
    (kernel : SparseNativeEventKernel package State) :
    ProbabilityTheory.Kernel
      (EventNode package State) (EventNode package State) :=
  ProbabilityTheory.Kernel.ofFunOfCountable kernel.nodeMeasure

@[simp]
theorem toKernel_apply
    (kernel : SparseNativeEventKernel package State)
    (source : EventNode package State) :
    kernel.toKernel source = kernel.nodeMeasure source :=
  rfl

/-- The event matrix induces a homogeneous Markov execution kernel. -/
noncomputable def toMarkovExecutionKernel
    (kernel : SparseNativeEventKernel package State) :
    MarkovExecutionKernel (EventNode package State) where
  stepKernel := kernel.toKernel
  isMarkov := by
    constructor
    intro source
    rw [isProbabilityMeasure_iff]
    exact kernel.nodeMeasure_univ source

/-- Genuine Ionescu--Tulcea law on infinite event-node paths. -/
noncomputable def trajectoryMeasure
    (kernel : SparseNativeEventKernel package State)
    (initial : Measure (EventNode package State))
    [IsProbabilityMeasure initial] :
    Measure (Nat → EventNode package State) :=
  kernel.toMarkovExecutionKernel.trajectoryMeasure initial

noncomputable instance trajectoryMeasure_isProbability
    (kernel : SparseNativeEventKernel package State)
    (initial : Measure (EventNode package State))
    [IsProbabilityMeasure initial] :
    IsProbabilityMeasure (kernel.trajectoryMeasure initial) := by
  unfold trajectoryMeasure
  infer_instance

/-- Forget the event payload while retaining the exact sampled state path. -/
def projectStatePath
    (path : Nat → EventNode package State) :
    Nat → State :=
  fun n => (path n).1

theorem measurable_projectStatePath :
    Measurable
      (projectStatePath (package := package) (State := State)) := by
  apply measurable_pi_lambda
  intro n
  exact measurable_fst.comp (measurable_pi_apply n)

/--
The exact state-path marginal of the event-node Ionescu--Tulcea law.

This definition is intentionally a pushforward, not a claim that the projected
state process is itself homogeneous Markov after forgetting the previous event.
-/
noncomputable def stateTrajectoryMarginal
    (kernel : SparseNativeEventKernel package State)
    (initial : Measure (EventNode package State))
    [IsProbabilityMeasure initial] :
    Measure (Nat → State) :=
  (kernel.trajectoryMeasure initial).map
    (projectStatePath (package := package) (State := State))

/-- One row is almost surely supported on positive event-payload entries. -/
theorem ae_positive_probability
    (kernel : SparseNativeEventKernel package State)
    (source : EventNode package State) :
    ∀ᵐ target ∂kernel.toKernel source,
      0 < kernel.probability source target := by
  rw [toKernel_apply]
  unfold nodeMeasure
  rw [ae_finsetSum_measure_iff]
  intro target _member
  by_cases zero : kernel.probability source target = 0
  · simp [zero]
  · have positive :
        0 < kernel.probability source target :=
      lt_of_le_of_ne
        (kernel.probability_nonnegative source target) (Ne.symm zero)
    apply Measure.ae_smul_measure
    rw [MeasureTheory.ae_dirac_iff]
    · exact positive
    · exact
        (Set.toFinite
          {target : EventNode package State |
            0 < kernel.probability source target}).measurableSet

set_option maxHeartbeats 400000 in
/-- At every fixed time, an Ionescu--Tulcea sample uses a positive payload. -/
theorem trajectory_ae_positive_probability_at
    (kernel : SparseNativeEventKernel package State)
    (initial : Measure (EventNode package State))
    [IsProbabilityMeasure initial]
    (n : Nat) :
    ∀ᵐ path ∂kernel.trajectoryMeasure initial,
      0 < kernel.probability (path n) (path (n + 1)) := by
  have joint :
      ∀ᵐ pair ∂
          (kernel.trajectoryMeasure initial).map (frestrictLe n) ⊗ₘ
            kernel.toMarkovExecutionKernel.historyKernel n,
        0 <
          kernel.probability
            ((pair.1) ⟨n, Finset.mem_Iic.mpr le_rfl⟩) pair.2 := by
    apply Measure.ae_compProd_of_ae_ae
    · exact
        measurableSet_lt measurable_const
          (measurable_of_finite
            (fun pair :
                ((i : Finset.Iic n) → EventNode package State) ×
                  EventNode package State =>
              kernel.probability
                ((pair.1) ⟨n, Finset.mem_Iic.mpr le_rfl⟩) pair.2))
    · exact Filter.Eventually.of_forall fun history => by
        have row :=
          ae_positive_probability kernel
            (history ⟨n, Finset.mem_Iic.mpr le_rfl⟩)
        simpa [MarkovExecutionKernel.historyKernel,
          toMarkovExecutionKernel, toKernel_apply] using row
  unfold trajectoryMeasure MarkovExecutionKernel.trajectoryMeasure at joint ⊢
  have jointMeasureEq :=
    ProbabilityTheory.Kernel.map_frestrictLe_trajMeasure_compProd_eq_map_trajMeasure
      (X := fun _ => EventNode package State)
      (μ₀ := initial)
      (κ := kernel.toMarkovExecutionKernel.historyKernel)
      (a := n)
  rw [jointMeasureEq] at joint
  have pulled :=
    (ae_map_iff
      (measurable_frestrictLe n |>.prod
        (measurable_pi_apply (n + 1))).aemeasurable
      (measurableSet_lt measurable_const
        (measurable_of_finite
          (fun pair :
              ((i : Finset.Iic n) → EventNode package State) ×
                EventNode package State =>
            kernel.probability
              ((pair.1) ⟨n, Finset.mem_Iic.mpr le_rfl⟩) pair.2)))).1 joint
  simpa [frestrictLe_apply] using pulled

/-- Every sampled event-node edge has positive matrix mass almost surely. -/
theorem trajectory_ae_positive_probability
    (kernel : SparseNativeEventKernel package State)
    (initial : Measure (EventNode package State))
    [IsProbabilityMeasure initial] :
    ∀ᵐ path ∂kernel.trajectoryMeasure initial,
      ∀ n, 0 < kernel.probability (path n) (path (n + 1)) := by
  rw [ae_all_iff]
  exact kernel.trajectory_ae_positive_probability_at initial

/--
Semantic meaning of one positive event payload.  Holds carry no event and
must preserve the state.  Emissions carry a native event and its independently
verified exact DPO replay.
-/
def NativePayloadStep
    (kernel : SparseNativeEventKernel package State)
    (source target : EventNode package State) : Prop :=
  match target.2 with
  | none => target.1 = source.1
  | some event =>
      package.lts.ObservableStep
          (kernel.stateEquiv source.1) event
          (kernel.stateEquiv target.1) ∧
        (package.eventRecord event).Replays
          (package.configOf (kernel.stateEquiv source.1))
          (package.configOf (kernel.stateEquiv target.1))

/-- Positive mass is sufficient for native/replay payload validity. -/
theorem nativePayloadStep_of_positive
    (kernel : SparseNativeEventKernel package State)
    {source target : EventNode package State}
    (positive : 0 < kernel.probability source target) :
    kernel.NativePayloadStep source target := by
  rcases target with ⟨targetState, payload⟩
  cases payload with
  | none =>
      simpa [NativePayloadStep] using
        kernel.positive_hold_stays
          (source := source) (targetState := targetState)
          positive
  | some event =>
      have native :=
        kernel.positive_event_native
          (source := source) (targetState := targetState) (event := event)
          positive
      simp only [NativePayloadStep]
      exact ⟨native, package.eventEndpoints native⟩

/-- Every step of one event-node path has its payload semantics. -/
def TrajectoryAgreement
    (kernel : SparseNativeEventKernel package State)
    (path : Nat → EventNode package State) : Prop :=
  ∀ n, kernel.NativePayloadStep (path n) (path (n + 1))

/-- Genuine event-node trajectories satisfy native/replay agreement almost surely. -/
theorem trajectory_agreement_almost_sure
    (kernel : SparseNativeEventKernel package State)
    (initial : Measure (EventNode package State))
    [IsProbabilityMeasure initial] :
    ∀ᵐ path ∂kernel.trajectoryMeasure initial,
      kernel.TrajectoryAgreement path := by
  filter_upwards
    [kernel.trajectory_ae_positive_probability initial] with path positive
  intro n
  exact kernel.nativePayloadStep_of_positive (positive n)

end SparseNativeEventKernel

section Coupling

variable
    {leftSignature rightSignature : FinSignature}
    {leftPackage : ExecutionPackage leftSignature}
    {rightPackage : ExecutionPackage rightSignature}
    {LeftState : Type uLeftState}
    [Fintype LeftState] [DecidableEq LeftState]
    [Fintype leftPackage.lts.Event] [DecidableEq leftPackage.lts.Event]
    [MeasurableSpace LeftState] [MeasurableSingletonClass LeftState]
    {RightState : Type uRightState}
    [Fintype RightState] [DecidableEq RightState]
    [Fintype rightPackage.lts.Event] [DecidableEq rightPackage.lts.Event]
    [MeasurableSpace RightState] [MeasurableSingletonClass RightState]
    {leftKernel : SparseNativeEventKernel leftPackage LeftState}
    {rightKernel : SparseNativeEventKernel rightPackage RightState}
    {leftInitial : Measure (EventNode leftPackage LeftState)}
    [IsProbabilityMeasure leftInitial]
    {rightInitial : Measure (EventNode rightPackage RightState)}
    [IsProbabilityMeasure rightInitial]

/-- An exact coupling of two caller-supplied event-node trajectory laws. -/
structure SparseEventTrajectoryCoupling where
  joint :
    Measure
      ((Nat → EventNode leftPackage LeftState) ×
        (Nat → EventNode rightPackage RightState))
  joint_probability : IsProbabilityMeasure joint
  left_marginal :
    joint.map Prod.fst = leftKernel.trajectoryMeasure leftInitial
  right_marginal :
    joint.map Prod.snd = rightKernel.trajectoryMeasure rightInitial

namespace SparseEventTrajectoryCoupling

instance (coupling : SparseEventTrajectoryCoupling
    (leftKernel := leftKernel) (rightKernel := rightKernel)
    (leftInitial := leftInitial) (rightInitial := rightInitial)) :
    IsProbabilityMeasure coupling.joint :=
  coupling.joint_probability

/-- Independent genuine event-kernel trajectories always provide a coupling. -/
def independent :
    SparseEventTrajectoryCoupling
      (leftKernel := leftKernel) (rightKernel := rightKernel)
      (leftInitial := leftInitial) (rightInitial := rightInitial) where
  joint :=
    (leftKernel.trajectoryMeasure leftInitial).prod
      (rightKernel.trajectoryMeasure rightInitial)
  joint_probability := inferInstance
  left_marginal := by
    rw [Measure.map_fst_prod, measure_univ, one_smul]
  right_marginal := by
    rw [Measure.map_snd_prod, measure_univ, one_smul]

variable
    (coupling : SparseEventTrajectoryCoupling
      (leftKernel := leftKernel) (rightKernel := rightKernel)
      (leftInitial := leftInitial) (rightInitial := rightInitial))

theorem left_ae_of_marginal
    {predicate : (Nat → EventNode leftPackage LeftState) → Prop}
    (measurablePredicate : MeasurableSet {path | predicate path})
    (almostSure :
      ∀ᵐ path ∂leftKernel.trajectoryMeasure leftInitial, predicate path) :
    ∀ᵐ sample ∂coupling.joint, predicate sample.1 := by
  have mapped :
      ∀ᵐ path ∂coupling.joint.map Prod.fst, predicate path := by
    rw [coupling.left_marginal]
    exact almostSure
  exact
    (ae_map_iff measurable_fst.aemeasurable measurablePredicate).1 mapped

theorem right_ae_of_marginal
    {predicate : (Nat → EventNode rightPackage RightState) → Prop}
    (measurablePredicate : MeasurableSet {path | predicate path})
    (almostSure :
      ∀ᵐ path ∂rightKernel.trajectoryMeasure rightInitial, predicate path) :
    ∀ᵐ sample ∂coupling.joint, predicate sample.2 := by
  have mapped :
      ∀ᵐ path ∂coupling.joint.map Prod.snd, predicate path := by
    rw [coupling.right_marginal]
    exact almostSure
  exact
    (ae_map_iff measurable_snd.aemeasurable measurablePredicate).1 mapped

/-- The joint law has the left kernel's exact projected state-path marginal. -/
theorem left_state_marginal :
    coupling.joint.map
        (fun sample =>
          SparseNativeEventKernel.projectStatePath
            (package := leftPackage) (State := LeftState) sample.1) =
      leftKernel.stateTrajectoryMarginal leftInitial := by
  change
    coupling.joint.map
        (SparseNativeEventKernel.projectStatePath
          (package := leftPackage) (State := LeftState) ∘ Prod.fst) =
      leftKernel.stateTrajectoryMarginal leftInitial
  rw [← Measure.map_map
    (SparseNativeEventKernel.measurable_projectStatePath
      (package := leftPackage) (State := LeftState))
    measurable_fst]
  rw [coupling.left_marginal]
  rfl

/-- The joint law has the right kernel's exact projected state-path marginal. -/
theorem right_state_marginal :
    coupling.joint.map
        (fun sample =>
          SparseNativeEventKernel.projectStatePath
            (package := rightPackage) (State := RightState) sample.2) =
      rightKernel.stateTrajectoryMarginal rightInitial := by
  change
    coupling.joint.map
        (SparseNativeEventKernel.projectStatePath
          (package := rightPackage) (State := RightState) ∘ Prod.snd) =
      rightKernel.stateTrajectoryMarginal rightInitial
  rw [← Measure.map_map
    (SparseNativeEventKernel.measurable_projectStatePath
      (package := rightPackage) (State := RightState))
    measurable_snd]
  rw [coupling.right_marginal]
  rfl

end SparseEventTrajectoryCoupling

/-- Measurability of the all-step positive-support path predicate. -/
theorem measurable_positive_path
    {signature : FinSignature}
    {package : ExecutionPackage signature}
    {State : Type uLeftState}
    [Fintype State] [DecidableEq State]
    [Fintype package.lts.Event] [DecidableEq package.lts.Event]
    [MeasurableSpace State] [MeasurableSingletonClass State]
    (kernel : SparseNativeEventKernel package State) :
    MeasurableSet
      {path : Nat → EventNode package State |
        ∀ n, 0 < kernel.probability (path n) (path (n + 1))} := by
  rw [show
    {path : Nat → EventNode package State |
      ∀ n, 0 < kernel.probability (path n) (path (n + 1))} =
      ⋂ n,
        {path : Nat → EventNode package State |
          0 < kernel.probability (path n) (path (n + 1))} by
    ext path
    simp]
  apply MeasurableSet.iInter
  intro n
  have coordinates :
      Measurable
        (fun path : Nat → EventNode package State =>
          (path n, path (n + 1))) :=
    (measurable_pi_apply n).prod (measurable_pi_apply (n + 1))
  exact
    measurableSet_lt measurable_const
      ((measurable_of_finite
        (fun pair :
            EventNode package State × EventNode package State =>
          kernel.probability pair.1 pair.2)).comp coordinates)

variable
    (coupling : SparseEventTrajectoryCoupling
      (leftKernel := leftKernel) (rightKernel := rightKernel)
      (leftInitial := leftInitial) (rightInitial := rightInitial))

/--
Cross-row information not implied by the two stochastic kernels.

Payload-kind and mark agreement are explicit almost-sure premises.  Factoring
actions through marks makes action equality follow from mark equality, but
does not assert that the chosen action interpretation is faithful.
-/
structure SparseEventSemanticSeam
    (Mark : Type uMark) (Action : Type uAction)
    (StateRelation : LeftState → RightState → Prop) where
  leftMark : leftPackage.lts.Event → Mark
  rightMark : rightPackage.lts.Event → Mark
  markAction : Mark → Action
  leftAction : leftPackage.lts.Event → Action
  rightAction : rightPackage.lts.Event → Action
  leftAction_factors :
    ∀ event, leftAction event = markAction (leftMark event)
  rightAction_factors :
    ∀ event, rightAction event = markAction (rightMark event)
  states_related :
    ∀ᵐ sample ∂coupling.joint,
      ∀ n, StateRelation (sample.1 n).1 (sample.2 n).1
  payload_kinds_agree :
    ∀ᵐ sample ∂coupling.joint,
      ∀ n, (sample.1 (n + 1)).2.isSome = (sample.2 (n + 1)).2.isSome
  emitted_marks_agree :
    ∀ᵐ sample ∂coupling.joint,
      ∀ n leftEvent rightEvent,
        (sample.1 (n + 1)).2 = some leftEvent →
        (sample.2 (n + 1)).2 = some rightEvent →
        leftMark leftEvent = rightMark rightEvent

variable
    {Mark : Type uMark} {Action : Type uAction}
    {StateRelation : LeftState → RightState → Prop}
    (seam :
      SparseEventSemanticSeam coupling Mark Action StateRelation)

/-- Complete sparse-event agreement for one joint sample. -/
structure CompleteSparseEventTrajectoryAgreement
    (sample :
      (Nat → EventNode leftPackage LeftState) ×
        (Nat → EventNode rightPackage RightState)) : Prop where
  left_native_payloads :
    leftKernel.TrajectoryAgreement sample.1
  right_native_payloads :
    rightKernel.TrajectoryAgreement sample.2
  states_related :
    ∀ n, StateRelation (sample.1 n).1 (sample.2 n).1
  payload_kinds_agree :
    ∀ n, (sample.1 (n + 1)).2.isSome = (sample.2 (n + 1)).2.isSome
  emitted_marks_agree :
    ∀ n leftEvent rightEvent,
      (sample.1 (n + 1)).2 = some leftEvent →
      (sample.2 (n + 1)).2 = some rightEvent →
      seam.leftMark leftEvent = seam.rightMark rightEvent
  emitted_actions_agree :
    ∀ n leftEvent rightEvent,
      (sample.1 (n + 1)).2 = some leftEvent →
      (sample.2 (n + 1)).2 = some rightEvent →
      seam.leftAction leftEvent = seam.rightAction rightEvent

/--
Two supplied sparse event kernels have complete native/replay agreement under
any exact trajectory coupling and explicit semantic seam.
-/
theorem complete_sparse_event_trajectory_agreement_almost_sure :
    ∀ᵐ sample ∂coupling.joint,
      CompleteSparseEventTrajectoryAgreement coupling seam sample := by
  have leftPositive :
      ∀ᵐ sample ∂coupling.joint,
        ∀ n,
          0 <
            leftKernel.probability
              (sample.1 n) (sample.1 (n + 1)) :=
    coupling.left_ae_of_marginal
      (measurable_positive_path leftKernel)
      (leftKernel.trajectory_ae_positive_probability leftInitial)
  have rightPositive :
      ∀ᵐ sample ∂coupling.joint,
        ∀ n,
          0 <
            rightKernel.probability
              (sample.2 n) (sample.2 (n + 1)) :=
    coupling.right_ae_of_marginal
      (measurable_positive_path rightKernel)
      (rightKernel.trajectory_ae_positive_probability rightInitial)
  filter_upwards
    [leftPositive, rightPositive, seam.states_related,
      seam.payload_kinds_agree, seam.emitted_marks_agree]
      with sample leftPos rightPos related kinds marks
  refine
    { left_native_payloads := ?_
      right_native_payloads := ?_
      states_related := related
      payload_kinds_agree := kinds
      emitted_marks_agree := marks
      emitted_actions_agree := ?_ }
  · intro n
    exact leftKernel.nativePayloadStep_of_positive (leftPos n)
  · intro n
    exact rightKernel.nativePayloadStep_of_positive (rightPos n)
  · intro n leftEvent rightEvent leftPayload rightPayload
    calc
      seam.leftAction leftEvent =
          seam.markAction (seam.leftMark leftEvent) :=
        seam.leftAction_factors leftEvent
      _ = seam.markAction (seam.rightMark rightEvent) :=
        congrArg seam.markAction
          (marks n leftEvent rightEvent leftPayload rightPayload)
      _ = seam.rightAction rightEvent :=
        (seam.rightAction_factors rightEvent).symm

end Coupling

end Cantilune.Feedback.SparseEventKernelTrajectoryAgreement
