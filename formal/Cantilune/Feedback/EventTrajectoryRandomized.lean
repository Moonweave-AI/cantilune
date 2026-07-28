import Cantilune.Feedback.EventTrajectoryMeasure
import Mathlib.MeasureTheory.Measure.Prod

/-!
# Randomized event-labelled trajectory coupling

`EventTrajectoryMeasure` deterministically chooses one native event for each
ordered pair of states.  This file removes that uniqueness restriction without
changing the state law.  An auxiliary probability space supplies a seed at
each step; the chosen event may depend on the source, target, and seed.

The joint law is the product of the genuine Ionescu--Tulcea state law and an
arbitrary probability law on seed streams.  Consequently its state marginal
is proved equal to the original state law.  Every point of the joint sample
space carries native labels, verified replay records, and epoch alignment.

This is a coupling theorem.  It does not manufacture a concrete DPO replay
kernel: replay remains the independently executable obligation of the supplied
`ExecutionPackage`.
-/

namespace Cantilune.Feedback.EventTrajectory.FiniteDiscrete

open MeasureTheory
open Cantilune.Core
open Cantilune.Feedback.Probability
open Cantilune.Feedback.StochasticExecution
open Cantilune.Feedback.StochasticExecution.FiniteDiscrete

variable {signature : FinSignature}
variable {package : ExecutionPackage signature}
variable {State : Type*} [Fintype State] [DecidableEq State]
variable {Seed : Type*}

private theorem signature_at_random_eventEpoch
    (window : StableFairWindow) (n : Nat) :
    window.signatureVersion (eventEpoch window n) =
      window.signatureVersion window.startEpoch := by
  obtain ⟨offset, equality⟩ :=
    Nat.exists_eq_add_of_le (window.opportunity_after_start n)
  unfold eventEpoch
  rw [equality]
  exact window.signature_stable offset

/--
A seed-indexed native event selector.  Different seeds may select different
events with the same source and target, so event labels need not be a
deterministic function of endpoint states.
-/
structure RandomTotalNativeLabelling
    (kernel : NativeMarkovKernel signature package State)
    (Seed : Type*) where
  event : State → State → Seed → package.lts.Event
  native :
    ∀ source target seed,
      package.lts.ObservableStep
        (kernel.stateEquiv source)
        (event source target seed)
        (kernel.stateEquiv target)

namespace RandomTotalNativeLabelling

variable {kernel : NativeMarkovKernel signature package State}

/--
Every deterministic native labelling induces a seed-indexed labelling by
ignoring the seed.  This is the canonical coupling when the execution kernel
has no additional event-identity randomness.
-/
def ofDeterministic
    (labelling : TotalNativeLabelling kernel)
    (Seed : Type*) :
    RandomTotalNativeLabelling kernel Seed where
  event source target _seed := labelling.event source target
  native source target _seed := labelling.native source target

/-- Decorate a state path using one explicit random seed per transition. -/
def decorate
    (labelling : RandomTotalNativeLabelling kernel Seed)
    (statePath : Nat → State)
    (seedPath : Nat → Seed) :
    InfiniteEventTrajectory package where
  state n := kernel.stateEquiv (statePath n)
  event n :=
    labelling.event (statePath n) (statePath (n + 1)) (seedPath n)
  native n :=
    labelling.native (statePath n) (statePath (n + 1)) (seedPath n)

@[simp]
theorem projectState_decorate
    (labelling : RandomTotalNativeLabelling kernel Seed)
    (statePath : Nat → State)
    (seedPath : Nat → Seed) :
    TotalNativeLabelling.projectState
        (kernel := kernel) (labelling.decorate statePath seedPath) =
      statePath := by
  funext n
  simp [TotalNativeLabelling.projectState, decorate]

/-- Every seed-selected event replays from the corresponding configuration. -/
theorem decorate_replays
    (labelling : RandomTotalNativeLabelling kernel Seed)
    (statePath : Nat → State)
    (seedPath : Nat → Seed)
    (n : Nat) :
    (package.eventRecord
        ((labelling.decorate statePath seedPath).event n)).Replays
      (package.configOf
        ((labelling.decorate statePath seedPath).state n))
      (package.configOf
        ((labelling.decorate statePath seedPath).state (n + 1))) :=
  InfiniteEventTrajectory.event_replays
    (labelling.decorate statePath seedPath) n

end RandomTotalNativeLabelling

/-- Epoch compatibility for every seed-selectable event. -/
structure RandomEpochKernelAlignment
    {kernel : NativeMarkovKernel signature package State}
    (labelling : RandomTotalNativeLabelling kernel Seed)
    (window : StableFairWindow) where
  stable_state_version :
    ∀ state,
      package.lts.signatureVersion (kernel.stateEquiv state) =
        window.signatureVersion window.startEpoch
  opportunity_noninternal :
    ∀ source target seed,
      ¬package.ranking.internal (labelling.event source target seed)

namespace RandomEpochKernelAlignment

variable {kernel : NativeMarkovKernel signature package State}
variable {labelling : RandomTotalNativeLabelling kernel Seed}
variable {window : StableFairWindow}

/--
Deterministic epoch alignment remains valid after adjoining an arbitrary
ignored seed space.
-/
theorem ofDeterministic
    {deterministic : TotalNativeLabelling kernel}
    (alignment : EpochKernelAlignment deterministic window)
    (Seed : Type*) :
    RandomEpochKernelAlignment
      (RandomTotalNativeLabelling.ofDeterministic deterministic Seed)
      window where
  stable_state_version := alignment.stable_state_version
  opportunity_noninternal source target _seed :=
    alignment.opportunity_noninternal source target

/-- Every state/seed sample is aligned with the same stable opportunity window. -/
theorem decorate_aligned
    (alignment : RandomEpochKernelAlignment labelling window)
    (statePath : Nat → State)
    (seedPath : Nat → Seed) :
    EpochAlignedTrajectory window (labelling.decorate statePath seedPath) where
  event_noninternal n :=
    alignment.opportunity_noninternal
      (statePath n) (statePath (n + 1)) (seedPath n)
  source_signature n := by
    calc
      package.lts.signatureVersion
          ((labelling.decorate statePath seedPath).state n) =
          window.signatureVersion window.startEpoch :=
        alignment.stable_state_version (statePath n)
      _ = window.signatureVersion (eventEpoch window n) := by
        symm
        exact signature_at_random_eventEpoch window n
  target_signature n := by
    calc
      package.lts.signatureVersion
          ((labelling.decorate statePath seedPath).state (n + 1)) =
          window.signatureVersion window.startEpoch :=
        alignment.stable_state_version (statePath (n + 1))
      _ = window.signatureVersion (eventEpoch window n) := by
        symm
        exact signature_at_random_eventEpoch window n

end RandomEpochKernelAlignment

/--
The progress bridge and randomized event coupling share one kernel and one
stable/fair epoch window.
-/
structure RandomEventProgressBridge
    (kernel : NativeMarkovKernel signature package State)
    (initial : InitialDistribution State)
    (epsilon : Real)
    (Seed : Type*) where
  progress : ProgressBridge kernel initial epsilon
  labelling : RandomTotalNativeLabelling kernel Seed
  alignment :
    RandomEpochKernelAlignment labelling progress.window

namespace RandomEventProgressBridge

/--
Construct a randomized bridge from an already proved deterministic bridge.
The resulting state law is unchanged and the seed law may be arbitrary; only
event identity is degenerate.  Non-degenerate event randomness still requires
an explicit `RandomTotalNativeLabelling`, because a state kernel alone does
not contain event labels.
-/
def ofDeterministic
    {kernel : NativeMarkovKernel signature package State}
    {initial : InitialDistribution State}
    {epsilon : Real}
    (bridge : EventProgressBridge kernel initial epsilon)
    (Seed : Type*) :
    RandomEventProgressBridge kernel initial epsilon Seed where
  progress := bridge.progress
  labelling :=
    RandomTotalNativeLabelling.ofDeterministic bridge.labelling Seed
  alignment :=
    RandomEpochKernelAlignment.ofDeterministic bridge.alignment Seed

end RandomEventProgressBridge

/-- One sample consists of a state trajectory and an auxiliary seed stream. -/
abbrev RandomizedEventPath (State Seed : Type*) :=
  (Nat → State) × (Nat → Seed)

namespace RandomizedEventPath

variable {kernel : NativeMarkovKernel signature package State}
variable {initial : InitialDistribution State}
variable {epsilon : Real}

/-- The fully witnessed package trajectory selected by a randomized sample. -/
def trajectory
    (bridge : RandomEventProgressBridge kernel initial epsilon Seed)
    (path : RandomizedEventPath State Seed) :
    InfiniteEventTrajectory package :=
  bridge.labelling.decorate path.1 path.2

/-- State projection forgets only event randomness, not execution states. -/
@[simp]
theorem trajectory_state_projection
    (bridge : RandomEventProgressBridge kernel initial epsilon Seed)
    (path : RandomizedEventPath State Seed) :
    TotalNativeLabelling.projectState
        (kernel := kernel) (trajectory bridge path) =
      path.1 :=
  bridge.labelling.projectState_decorate path.1 path.2

/-- Every sampled event is a native observable target transition. -/
theorem native
    (bridge : RandomEventProgressBridge kernel initial epsilon Seed)
    (path : RandomizedEventPath State Seed)
    (n : Nat) :
    package.lts.ObservableStep
      ((trajectory bridge path).state n)
      ((trajectory bridge path).event n)
      ((trajectory bridge path).state (n + 1)) :=
  (trajectory bridge path).native n

/-- Every sampled event independently replays its exact endpoint pair. -/
theorem replays
    (bridge : RandomEventProgressBridge kernel initial epsilon Seed)
    (path : RandomizedEventPath State Seed)
    (n : Nat) :
    (package.eventRecord ((trajectory bridge path).event n)).Replays
      (package.configOf ((trajectory bridge path).state n))
      (package.configOf ((trajectory bridge path).state (n + 1))) :=
  InfiniteEventTrajectory.event_replays (trajectory bridge path) n

end RandomizedEventPath

variable [MeasurableSpace State]
variable [MeasurableSingletonClass State]
variable [MeasurableSpace Seed]

/--
Joint state/event-randomness law.  Event randomness may be correlated across
time by `seedMeasure`; independence is not assumed.
-/
noncomputable def randomizedEventTrajectoryMeasure
    {kernel : NativeMarkovKernel signature package State}
    {initial : InitialDistribution State}
    {epsilon : Real}
    (_bridge : RandomEventProgressBridge kernel initial epsilon Seed)
    (seedMeasure : Measure (Nat → Seed)) :
    Measure (RandomizedEventPath State Seed) :=
  (kernel.toMarkovExecutionKernel.trajectoryMeasure initial.toMeasure).prod
    seedMeasure

noncomputable instance randomizedEventTrajectoryMeasure_isProbability
    {kernel : NativeMarkovKernel signature package State}
    {initial : InitialDistribution State}
    {epsilon : Real}
    (bridge : RandomEventProgressBridge kernel initial epsilon Seed)
    (seedMeasure : Measure (Nat → Seed))
    [IsProbabilityMeasure seedMeasure] :
    IsProbabilityMeasure
      (randomizedEventTrajectoryMeasure bridge seedMeasure) := by
  unfold randomizedEventTrajectoryMeasure
  infer_instance

/--
Forgetting event seeds recovers exactly the original Ionescu--Tulcea state
trajectory law.
-/
theorem map_fst_randomizedEventTrajectoryMeasure
    {kernel : NativeMarkovKernel signature package State}
    {initial : InitialDistribution State}
    {epsilon : Real}
    (bridge : RandomEventProgressBridge kernel initial epsilon Seed)
    (seedMeasure : Measure (Nat → Seed))
    [IsProbabilityMeasure seedMeasure] :
    (randomizedEventTrajectoryMeasure bridge seedMeasure).map Prod.fst =
      kernel.toMarkovExecutionKernel.trajectoryMeasure initial.toMeasure := by
  unfold randomizedEventTrajectoryMeasure
  rw [Measure.map_fst_prod, measure_univ, one_smul]

/--
All event-label, replay, state-projection, and epoch data carried by one
randomized sample.
-/
structure CompleteRandomCommonTrajectory
    {kernel : NativeMarkovKernel signature package State}
    {initial : InitialDistribution State}
    {epsilon : Real}
    (bridge : RandomEventProgressBridge kernel initial epsilon Seed)
    (path : RandomizedEventPath State Seed) where
  trajectory : InfiniteEventTrajectory package
  trajectory_eq :
    trajectory = RandomizedEventPath.trajectory bridge path
  state_projection :
    TotalNativeLabelling.projectState
        (kernel := kernel) trajectory =
      path.1
  selected_event :
    ∀ n,
      trajectory.event n =
        bridge.labelling.event
          (path.1 n) (path.1 (n + 1)) (path.2 n)
  replayable :
    ∀ n,
      (package.eventRecord (trajectory.event n)).Replays
        (package.configOf (trajectory.state n))
        (package.configOf (trajectory.state (n + 1)))
  epoch_aligned :
    EpochAlignedTrajectory bridge.progress.window trajectory

/-- Construct complete agreement for every point of the randomized space. -/
def completeRandomCommonTrajectory
    {kernel : NativeMarkovKernel signature package State}
    {initial : InitialDistribution State}
    {epsilon : Real}
    (bridge : RandomEventProgressBridge kernel initial epsilon Seed)
    (path : RandomizedEventPath State Seed) :
    CompleteRandomCommonTrajectory bridge path where
  trajectory := RandomizedEventPath.trajectory bridge path
  trajectory_eq := rfl
  state_projection :=
    RandomizedEventPath.trajectory_state_projection bridge path
  selected_event := by
    intro n
    rfl
  replayable := RandomizedEventPath.replays bridge path
  epoch_aligned :=
    bridge.alignment.decorate_aligned path.1 path.2

/-- Stable hitting lifts to the randomized event-labelled joint law. -/
theorem randomized_event_measure_almost_sure_hitting
    {kernel : NativeMarkovKernel signature package State}
    {initial : InitialDistribution State}
    {epsilon : Real}
    (bridge : RandomEventProgressBridge kernel initial epsilon Seed)
    (seedMeasure : Measure (Nat → Seed))
    [IsProbabilityMeasure seedMeasure] :
    ∀ᵐ path ∂randomizedEventTrajectoryMeasure bridge seedMeasure,
      bridge.progress.toKernelProgressAssumption.hittingBridge.EventuallyHits
        path.1 := by
  have stateAE :
      ∀ᵐ path
        ∂kernel.toMarkovExecutionKernel.trajectoryMeasure initial.toMeasure,
        bridge.progress.toKernelProgressAssumption.hittingBridge.EventuallyHits
          path :=
    bridge.progress.finite_kernel_feedback_almost_sure_hitting
  have measurableEventuallyHits :
      MeasurableSet
        {path : Nat → State |
          bridge.progress.toKernelProgressAssumption.hittingBridge.EventuallyHits
            path} := by
    have measurableNeverHit :
        MeasurableSet
          bridge.progress.toKernelProgressAssumption.hittingBridge.neverHit :=
      MeasurableSet.iInter
        bridge.progress.toKernelProgressAssumption.hittingBridge.measurable_notHit
    have setEquality :
        {path : Nat → State |
          bridge.progress.toKernelProgressAssumption.hittingBridge.EventuallyHits
            path} =
          bridge.progress.toKernelProgressAssumption.hittingBridge.neverHitᶜ := by
      ext path
      exact
        bridge.progress.toKernelProgressAssumption.hittingBridge
          |>.eventuallyHits_iff_not_mem_neverHit path
    rw [setEquality]
    exact measurableNeverHit.compl
  have mapped :
      ∀ᵐ path
        ∂(randomizedEventTrajectoryMeasure bridge seedMeasure).map Prod.fst,
        bridge.progress.toKernelProgressAssumption.hittingBridge.EventuallyHits
          path := by
    rw [map_fst_randomizedEventTrajectoryMeasure bridge seedMeasure]
    exact stateAE
  exact
    (ae_map_iff measurable_fst.aemeasurable measurableEventuallyHits).1 mapped

/--
Almost every randomized sample both reaches stability and carries a complete
native/replay/epoch common trajectory.  Unlike the deterministic bridge,
different seeds can retain distinct event identities for the same endpoints.
-/
theorem complete_random_common_trajectory_almost_sure
    {kernel : NativeMarkovKernel signature package State}
    {initial : InitialDistribution State}
    {epsilon : Real}
    (bridge : RandomEventProgressBridge kernel initial epsilon Seed)
    (seedMeasure : Measure (Nat → Seed))
    [IsProbabilityMeasure seedMeasure] :
    ∀ᵐ path ∂randomizedEventTrajectoryMeasure bridge seedMeasure,
      Nonempty (CompleteRandomCommonTrajectory bridge path) ∧
        bridge.progress.toKernelProgressAssumption.hittingBridge.EventuallyHits
          path.1 := by
  filter_upwards
    [randomized_event_measure_almost_sure_hitting bridge seedMeasure]
      with path hits
  exact ⟨⟨completeRandomCommonTrajectory bridge path⟩, hits⟩

end Cantilune.Feedback.EventTrajectory.FiniteDiscrete
