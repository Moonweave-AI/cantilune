import Cantilune.Core.ExecutionEpochTrace
import Cantilune.Feedback.EventTrajectoryMeasure

/-!
# Runtime execution epochs on event-labelled stochastic trajectories

`EventTrajectoryMeasure` couples the Ionescu--Tulcea state law to native
package events and to the external observation-opportunity schedule.
`ExecutionEpochTrace` separately defines runtime execution epochs from the
signature version stored in replayed configurations.

This module joins those two layers.  Every finite prefix of a sampled native
trajectory is an exact `ObservableLTS.Path`, its list of event identities is
replayed by the package's endpoint-free `DPOEvent` kernel, and every event
record carries the runtime signature version of the initial configuration.

The runtime execution epoch proved here is deliberately constant: one
`NativeMarkovKernel` has one fixed signature.  Heterogeneous signature
admissions are represented by `ExecutionEpochTrace.EpochChain`, outside a
single probability space.  No observation-opportunity index is identified
with a runtime signature epoch.
-/

namespace Cantilune.Feedback.EventTrajectory.FiniteDiscrete

open MeasureTheory
open Cantilune.Core
open Cantilune.Core.ExecutionEpochTrace
open Cantilune.Feedback.StochasticExecution
open Cantilune.Feedback.StochasticExecution.FiniteDiscrete

variable {signature : FinSignature}
variable {package : ExecutionPackage signature}

namespace InfiniteEventTrajectory

/-- Events in a finite segment beginning at `start`. -/
def eventList
    (trajectory : InfiniteEventTrajectory package)
    (start : Nat) : Nat → List package.lts.Event
  | 0 => []
  | steps + 1 =>
      trajectory.event start :: eventList trajectory (start + 1) steps

/--
Every finite segment of an infinite native trajectory is an exact path in the
package LTS.  Event identities are retained in order.
-/
theorem pathSegment
    (trajectory : InfiniteEventTrajectory package)
    (start : Nat) :
    (steps : Nat) →
      package.lts.Path
        (trajectory.state start)
        (eventList trajectory start steps)
        (trajectory.state (start + steps))
  | 0 => by
      change
        package.lts.Path
          (trajectory.state start) [] (trajectory.state start)
      exact
        (ObservableLTS.Path.nil
          (L := package.lts) (trajectory.state start))
  | steps + 1 => by
      refine ObservableLTS.Path.cons (trajectory.native start) ?_
      simpa [Nat.add_assoc, Nat.add_comm, Nat.add_left_comm] using
        pathSegment trajectory (start + 1) steps

/-- The event at offset `offset` occurs in the corresponding prefix. -/
theorem event_mem_eventList
    (trajectory : InfiniteEventTrajectory package)
    (start offset : Nat) :
    trajectory.event (start + offset) ∈
      eventList trajectory start (offset + 1) := by
  induction offset generalizing start with
  | zero =>
      simp [eventList]
  | succ offset induction =>
      change
        trajectory.event (start + Nat.succ offset) ∈
          trajectory.event start ::
            eventList trajectory (start + 1) (offset + 1)
      apply List.mem_cons_of_mem
      simpa [Nat.add_assoc, Nat.add_comm, Nat.add_left_comm] using
        induction (start := start + 1)

/-- A finite prefix packaged as one genuine runtime replay epoch. -/
def replayEpochPrefix
    (trajectory : InfiniteEventTrajectory package)
    (steps : Nat) :
    ReplayEpoch package where
  executionEpoch :=
    (package.configOf (trajectory.state 0)).signatureVersion
  source := trajectory.state 0
  target := trajectory.state steps
  events := eventList trajectory 0 steps
  path := by
    simpa using pathSegment trajectory 0 steps
  source_epoch := rfl

/-- The prefix event list deterministically replays to its trajectory state. -/
theorem replay_prefix_agreement
    (trajectory : InfiniteEventTrajectory package)
    (steps : Nat) :
    replayEvents package (eventList trajectory 0 steps)
        (package.configOf (trajectory.state 0)) =
      some (package.configOf (trajectory.state steps)) := by
  simpa [replayEpochPrefix] using
    (replayEpochPrefix trajectory steps).replay_agreement

/--
Every event record in the infinite trajectory carries the runtime execution
epoch determined by the initial configuration.
-/
theorem event_record_execution_epoch
    (trajectory : InfiniteEventTrajectory package)
    (n : Nat) :
    (package.eventRecord (trajectory.event n)).event.signatureVersion =
      (package.configOf (trajectory.state 0)).signatureVersion := by
  have member :
      trajectory.event n ∈ eventList trajectory 0 (n + 1) := by
    simpa using event_mem_eventList trajectory 0 n
  simpa [replayEpochPrefix] using
    (replayEpochPrefix trajectory (n + 1)).event_signature_epoch member

/--
The stored endpoints of each sampled `DPOEvent` are exactly the adjacent
runtime configurations of the native trajectory.

This is stronger than endpoint-free replay alone: it also rules out a trace
whose selected verified record replays correctly but stores endpoints from a
different occurrence.
-/
theorem event_record_exact_endpoints
    (trajectory : InfiniteEventTrajectory package)
    (n : Nat) :
    package.configOf (trajectory.state n) =
        (package.eventRecord (trajectory.event n)).event.source ∧
      package.configOf (trajectory.state (n + 1)) =
        (package.eventRecord (trajectory.event n)).event.target := by
  have replay :=
    package.eventEndpoints (trajectory.native n)
  refine ⟨replay.1, ?_⟩
  have replayFromRecorded :
      (package.eventRecord (trajectory.event n)).Replays
        (package.eventRecord (trajectory.event n)).event.source
        (package.configOf (trajectory.state (n + 1))) := by
    rw [← replay.1]
    exact replay
  exact
    DPOEvent.replay_recovers_recorded_target replayFromRecorded

/--
Every finite segment has one joint, event-indexed replay/epoch agreement:

* replaying the complete ordered event list reaches the sampled endpoint;
* every event record stores the actual adjacent configurations; and
* every event record carries the trajectory's runtime signature epoch.

The statement applies to arbitrary subsegments, not only prefixes beginning
at time zero.
-/
theorem segment_dpo_replay_epoch_alignment
    (trajectory : InfiniteEventTrajectory package)
    (start steps : Nat) :
    replayEvents package (eventList trajectory start steps)
        (package.configOf (trajectory.state start)) =
      some (package.configOf (trajectory.state (start + steps))) ∧
    ∀ offset, offset < steps →
      package.configOf (trajectory.state (start + offset)) =
          (package.eventRecord
            (trajectory.event (start + offset))).event.source ∧
        package.configOf (trajectory.state (start + offset + 1)) =
          (package.eventRecord
            (trajectory.event (start + offset))).event.target ∧
        (package.eventRecord
            (trajectory.event (start + offset))).event.signatureVersion =
          (package.configOf (trajectory.state 0)).signatureVersion := by
  constructor
  · exact
      path_replay_agreement package
        (pathSegment trajectory start steps)
  · intro offset _offsetInSegment
    have endpoints :=
      event_record_exact_endpoints trajectory (start + offset)
    exact
      ⟨endpoints.1, endpoints.2,
        event_record_execution_epoch trajectory (start + offset)⟩

end InfiniteEventTrajectory

/--
The runtime-epoch part of a common trajectory.

It records exact finite paths, endpoint-free replay for every finite prefix,
and the `DPOEvent` signature version of every sampled event.  These are
derived data, not caller-supplied trajectory-agreement assumptions.
-/
structure RuntimeEpochAgreement
    (trajectory : InfiniteEventTrajectory package) where
  executionEpoch : Nat
  executionEpoch_eq :
    executionEpoch =
      (package.configOf (trajectory.state 0)).signatureVersion
  prefixPath :
    ∀ steps,
      package.lts.Path
        (trajectory.state 0)
        (InfiniteEventTrajectory.eventList trajectory 0 steps)
        (trajectory.state steps)
  prefixReplay :
    ∀ steps,
      replayEvents package
          (InfiniteEventTrajectory.eventList trajectory 0 steps)
          (package.configOf (trajectory.state 0)) =
        some (package.configOf (trajectory.state steps))
  eventRecordEpoch :
    ∀ n,
      (package.eventRecord (trajectory.event n)).event.signatureVersion =
        executionEpoch
  eventRecordEndpoints :
    ∀ n,
      package.configOf (trajectory.state n) =
          (package.eventRecord (trajectory.event n)).event.source ∧
        package.configOf (trajectory.state (n + 1)) =
          (package.eventRecord (trajectory.event n)).event.target
  segmentReplay :
    ∀ start steps,
      replayEvents package
          (InfiniteEventTrajectory.eventList trajectory start steps)
          (package.configOf (trajectory.state start)) =
        some (package.configOf (trajectory.state (start + steps)))

/-- Construct runtime-epoch agreement for every native event trajectory. -/
def runtimeEpochAgreement
    (trajectory : InfiniteEventTrajectory package) :
    RuntimeEpochAgreement trajectory where
  executionEpoch :=
    (package.configOf (trajectory.state 0)).signatureVersion
  executionEpoch_eq := rfl
  prefixPath := by
    intro steps
    simpa using
      InfiniteEventTrajectory.pathSegment trajectory 0 steps
  prefixReplay :=
    InfiniteEventTrajectory.replay_prefix_agreement trajectory
  eventRecordEpoch :=
    InfiniteEventTrajectory.event_record_execution_epoch trajectory
  eventRecordEndpoints :=
    InfiniteEventTrajectory.event_record_exact_endpoints trajectory
  segmentReplay := by
    intro start steps
    exact
      (InfiniteEventTrajectory.segment_dpo_replay_epoch_alignment
        trajectory start steps).1

variable {State : Type*} [Fintype State] [DecidableEq State]

/--
Complete probabilistic/common-trajectory evidence with both kinds of epoch:

* `common.epoch_aligned` refers to the fair external opportunity schedule;
* `runtime` refers to the signature version of replayed `DPOEvent` records.
-/
structure CompleteExecutionEpochTrajectory
    {kernel : NativeMarkovKernel signature package State}
    {initial : InitialDistribution State}
    {epsilon : Real}
    (bridge : EventProgressBridge kernel initial epsilon)
    (path : ReplayableEventPath bridge.labelling) where
  common : CompleteCommonTrajectory bridge path
  runtime : RuntimeEpochAgreement common.trajectory

/-- Construct the complete two-epoch agreement for every event path. -/
def completeExecutionEpochTrajectory
    {kernel : NativeMarkovKernel signature package State}
    {initial : InitialDistribution State}
    {epsilon : Real}
    (bridge : EventProgressBridge kernel initial epsilon)
    (path : ReplayableEventPath bridge.labelling) :
    CompleteExecutionEpochTrajectory bridge path where
  common := completeCommonTrajectory bridge path
  runtime :=
    runtimeEpochAgreement
      (completeCommonTrajectory bridge path).trajectory

variable [MeasurableSpace State]
variable [MeasurableSingletonClass State]

/--
Almost every event-path sample reaches the stable region and carries one
joint theorem containing state projection, exact event labels, native steps,
per-step `DPOEvent` replay, opportunity alignment, finite-prefix replay, and
runtime execution-epoch agreement.
-/
theorem complete_execution_epoch_trajectory_almost_sure
    {kernel : NativeMarkovKernel signature package State}
    {initial : InitialDistribution State}
    {epsilon : Real}
    (bridge : EventProgressBridge kernel initial epsilon) :
    ∀ᵐ path ∂ replayableEventTrajectoryMeasure bridge.labelling initial,
      Nonempty (CompleteExecutionEpochTrajectory bridge path) ∧
        bridge.progress.toKernelProgressAssumption.hittingBridge.EventuallyHits
          path.stateCode := by
  filter_upwards
    [replayable_event_measure_almost_sure_hitting bridge] with path hits
  exact ⟨⟨completeExecutionEpochTrajectory bridge path⟩, hits⟩

end Cantilune.Feedback.EventTrajectory.FiniteDiscrete
