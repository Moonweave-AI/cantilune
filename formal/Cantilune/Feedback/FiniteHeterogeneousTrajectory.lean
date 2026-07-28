import Cantilune.Feedback.HeterogeneousAdmissionTrajectory

/-!
# Arbitrary finite heterogeneous epoch trajectories

An `EpochChain` ranges over packages whose signatures, state types, and event
types may all change at an admission boundary.  Its index therefore lives
above the universe accepted by `ObservableLTS`.  This module does not erase
that dependency or pretend that an admission is a same-signature DPO event.

Instead it defines a universe-polymorphic ordered `ChainPath` and proves one
complete agreement theorem for every finite heterogeneous chain:

* every fixed-signature label is an actual observable package step;
* its verified `DPOEvent` replays between the exact adjacent configurations;
* every admission separately carries `AdmissionReplays`;
* every label is aligned with its runtime execution epoch; and
* the concatenated replay equations agree with the recursively packaged
  `EpochChain.ReplayAgreement`.

Probability over a finite, type-zero phase schedule is constructed in
`FiniteHeterogeneousProbability`; terminal administrative stutter is kept
outside the native event list.
-/

noncomputable section

namespace Cantilune.Feedback.FiniteHeterogeneousTrajectory

open Cantilune.Core
open Cantilune.Core.ExecutionEpochTrace

/-- A state tagged by the exact epoch of a heterogeneous execution chain. -/
inductive ChainState (universes : ProjectionUniverses) :
    {first last : SomeReplayEpoch} →
      EpochChain universes first last → Type 2
  | single {epoch : SomeReplayEpoch}
      (state : epoch.package.lts.State) :
      ChainState universes (.single epoch)
  | head {first middle last : SomeReplayEpoch}
      {boundary : AdjacentAdmission universes first middle}
      {tail : EpochChain universes middle last}
      (state : first.package.lts.State) :
      ChainState universes (.cons boundary tail)
  | tail {first middle last : SomeReplayEpoch}
      {boundary : AdjacentAdmission universes first middle}
      {rest : EpochChain universes middle last}
      (state : ChainState universes rest) :
      ChainState universes (.cons boundary rest)

/-- A native DPO label or an admission label at its exact chain position. -/
inductive ChainEvent (universes : ProjectionUniverses) :
    {first last : SomeReplayEpoch} →
      EpochChain universes first last → Type 2
  | single {epoch : SomeReplayEpoch}
      (event : epoch.package.lts.Event) :
      ChainEvent universes (.single epoch)
  | head {first middle last : SomeReplayEpoch}
      {boundary : AdjacentAdmission universes first middle}
      {tail : EpochChain universes middle last}
      (event : first.package.lts.Event) :
      ChainEvent universes (.cons boundary tail)
  | admission {first middle last : SomeReplayEpoch}
      {boundary : AdjacentAdmission universes first middle}
      {tail : EpochChain universes middle last} :
      ChainEvent universes (.cons boundary tail)
  | tail {first middle last : SomeReplayEpoch}
      {boundary : AdjacentAdmission universes first middle}
      {rest : EpochChain universes middle last}
      (event : ChainEvent universes rest) :
      ChainEvent universes (.cons boundary rest)

namespace ChainState

variable {universes : ProjectionUniverses}
/-- Initial state of the first epoch. -/
def start :
    {first last : SomeReplayEpoch} →
      (chain : EpochChain universes first last) →
        ChainState universes chain
  | _, _, .single epoch => .single epoch.epoch.source
  | first, _, .cons _boundary _tail => .head first.epoch.source

/-- Final state of the last epoch. -/
def finish :
    {first last : SomeReplayEpoch} →
      (chain : EpochChain universes first last) →
        ChainState universes chain
  | _, _, .single epoch => .single epoch.epoch.target
  | _, _, .cons _boundary restChain => .tail (finish restChain)

end ChainState

/-- One native step in a heterogeneous chain. -/
inductive ChainStep (universes : ProjectionUniverses) :
    {first last : SomeReplayEpoch} →
      (chain : EpochChain universes first last) →
      ChainState universes chain →
      ChainEvent universes chain →
      ChainState universes chain → Prop
  | single {epoch : SomeReplayEpoch}
      {source target : epoch.package.lts.State}
      {event : epoch.package.lts.Event}
      (step : epoch.package.lts.ObservableStep source event target) :
      ChainStep universes (.single epoch)
        (.single source) (.single event) (.single target)
  | head {first middle last : SomeReplayEpoch}
      {boundary : AdjacentAdmission universes first middle}
      {tail : EpochChain universes middle last}
      {source target : first.package.lts.State}
      {event : first.package.lts.Event}
      (step : first.package.lts.ObservableStep source event target) :
      ChainStep universes (.cons boundary tail)
        (.head source) (.head event) (.head target)
  | admission {first middle last : SomeReplayEpoch}
      {boundary : AdjacentAdmission universes first middle}
      {tail : EpochChain universes middle last} :
      ChainStep universes (.cons boundary tail)
        (.head first.epoch.target) .admission
        (.tail (ChainState.start tail))
  | tail {first middle last : SomeReplayEpoch}
      {boundary : AdjacentAdmission universes first middle}
      {rest : EpochChain universes middle last}
      {source target : ChainState universes rest}
      {event : ChainEvent universes rest}
      (step : ChainStep universes rest source event target) :
      ChainStep universes (.cons boundary rest)
        (.tail source) (.tail event) (.tail target)

/--
An ordered native path independent of the universe-zero `ObservableLTS`
container.  Every fixed-signature edge still stores an actual
`ObservableStep`; only the heterogeneous concatenation is new.
-/
inductive ChainPath (universes : ProjectionUniverses) :
    {first last : SomeReplayEpoch} →
      (chain : EpochChain universes first last) →
      ChainState universes chain →
      List (ChainEvent universes chain) →
      ChainState universes chain → Prop
  | nil {first last : SomeReplayEpoch}
      {chain : EpochChain universes first last}
      (state : ChainState universes chain) :
      ChainPath universes chain state [] state
  | cons {first last : SomeReplayEpoch}
      {chain : EpochChain universes first last}
      {source middle target : ChainState universes chain}
      {event : ChainEvent universes chain}
      {events : List (ChainEvent universes chain)}
      (step : ChainStep universes chain source event middle)
      (path : ChainPath universes chain middle events target) :
      ChainPath universes chain source (event :: events) target

namespace ChainPath

variable {universes : ProjectionUniverses}
variable {first last : SomeReplayEpoch}

/-- Concatenation of two ordered heterogeneous paths. -/
theorem append
    {chain : EpochChain universes first last}
    {source middle target : ChainState universes chain}
    {headEvents tailEvents : List (ChainEvent universes chain)}
    (head : ChainPath universes chain source headEvents middle)
    (tail : ChainPath universes chain middle tailEvents target) :
    ChainPath universes chain source (headEvents ++ tailEvents) target := by
  induction head with
  | nil state =>
      exact tail
  | cons step path ih =>
      exact .cons step (ih tail)

end ChainPath

private theorem liftSingle
    {universes : ProjectionUniverses}
    (epoch : SomeReplayEpoch) :
    ChainPath universes (.single epoch)
      (.single epoch.epoch.source)
      (epoch.epoch.events.map ChainEvent.single)
      (.single epoch.epoch.target) := by
  have lift :
      ∀ {source target : epoch.package.lts.State}
        {events : List epoch.package.lts.Event},
        epoch.package.lts.Path source events target →
          ChainPath universes (.single epoch)
            (.single source)
            (events.map ChainEvent.single)
            (.single target) := by
    intro source target events path
    induction path with
    | nil state =>
        exact .nil _
    | cons step path ih =>
        exact .cons (.single step) ih
  exact lift epoch.epoch.path

private theorem liftHead
    {universes : ProjectionUniverses}
    {first middle last : SomeReplayEpoch}
    {boundary : AdjacentAdmission universes first middle}
    {tail : EpochChain universes middle last} :
    ChainPath universes (.cons boundary tail)
      (.head first.epoch.source)
      (first.epoch.events.map ChainEvent.head)
      (.head first.epoch.target) := by
  have lift :
      ∀ {source target : first.package.lts.State}
        {events : List first.package.lts.Event},
        first.package.lts.Path source events target →
          ChainPath universes (.cons boundary tail)
            (.head source)
            (events.map ChainEvent.head)
            (.head target) := by
    intro source target events path
    induction path with
    | nil state =>
        exact .nil _
    | cons step path ih =>
        exact .cons (.head step) ih
  exact lift first.epoch.path

private theorem liftTail
    {universes : ProjectionUniverses}
    {first middle last : SomeReplayEpoch}
    {boundary : AdjacentAdmission universes first middle}
    {tail : EpochChain universes middle last}
    {source target : ChainState universes tail}
    {events : List (ChainEvent universes tail)}
    (path : ChainPath universes tail source events target) :
    ChainPath universes (.cons boundary tail)
      (.tail source) (events.map ChainEvent.tail) (.tail target) := by
  induction path with
  | nil state =>
      exact .nil _
  | cons step path ih =>
      exact .cons (.tail step) ih

/-- Complete ordered label list: epoch events followed by admissions. -/
def traceEvents
    {universes : ProjectionUniverses}
    {first last : SomeReplayEpoch} :
    (chain : EpochChain universes first last) →
      List (ChainEvent universes chain)
  | .single epoch =>
      epoch.epoch.events.map ChainEvent.single
  | .cons boundary tail =>
      first.epoch.events.map ChainEvent.head ++
        ChainEvent.admission :: (traceEvents tail).map ChainEvent.tail

/-- Every finite heterogeneous chain is one ordered native chain path. -/
theorem trace_path
    {universes : ProjectionUniverses}
    {first last : SomeReplayEpoch}
    (chain : EpochChain universes first last) :
    ChainPath universes chain
      (ChainState.start chain)
      (traceEvents chain)
      (ChainState.finish chain) := by
  induction chain with
  | single epoch =>
      simpa [ChainState.start, ChainState.finish, traceEvents] using
        (liftSingle (universes := universes) epoch)
  | @cons first middle last boundary tail ih =>
      have tailPath :
          ChainPath universes (.cons boundary tail)
            (.tail (ChainState.start tail))
            ((traceEvents tail).map ChainEvent.tail)
            (.tail (ChainState.finish tail)) :=
        liftTail (boundary := boundary) ih
      have boundaryAndTail :
          ChainPath universes (.cons boundary tail)
            (.head first.epoch.target)
            (ChainEvent.admission ::
              (traceEvents tail).map ChainEvent.tail)
            (.tail (ChainState.finish tail)) :=
        .cons (.admission (boundary := boundary) (tail := tail)) tailPath
      simpa [ChainState.start, ChainState.finish, traceEvents] using
        (ChainPath.append
          (liftHead (boundary := boundary) (tail := tail))
          boundaryAndTail)

/--
A fixed-signature occurrence with its actual native endpoints, independently
verified replay, exact recorded endpoints, and runtime execution epoch.
-/
def DPOOccurrence
    (epoch : SomeReplayEpoch)
    (event : epoch.package.lts.Event) : Prop :=
  ∃ source target,
    epoch.package.lts.ObservableStep source event target ∧
      (epoch.package.eventRecord event).Replays
        (epoch.package.configOf source)
        (epoch.package.configOf target) ∧
      epoch.package.configOf source =
        (epoch.package.eventRecord event).event.source ∧
      epoch.package.configOf target =
        (epoch.package.eventRecord event).event.target ∧
      (epoch.package.eventRecord event).event.signatureVersion =
        epoch.epoch.executionEpoch

namespace DPOOccurrence

/-- Every event appearing in a replay epoch is an exact DPO occurrence. -/
theorem of_mem
    (epoch : SomeReplayEpoch)
    {event : epoch.package.lts.Event}
    (member : event ∈ epoch.epoch.events) :
    DPOOccurrence epoch event := by
  obtain ⟨source, target, step, replay⟩ :=
    epoch.epoch.event_has_verified_replay member
  have recordedReplay :
      (epoch.package.eventRecord event).Replays
        (epoch.package.eventRecord event).event.source
        (epoch.package.configOf target) := by
    refine ⟨rfl, ?_⟩
    rw [← replay.1]
    exact replay.2
  exact
    ⟨source, target, step, replay, replay.1,
      DPOEvent.replay_recovers_recorded_target recordedReplay,
      epoch.epoch.event_signature_epoch member⟩

end DPOOccurrence

/-- Exact replay and epoch evidence for one admission boundary. -/
def AdmissionOccurrence
    {universes : ProjectionUniverses}
    {before after : SomeReplayEpoch}
    (boundary : AdjacentAdmission universes before after) : Prop :=
  AdmissionReplays boundary.admission
      (before.package.configOf before.epoch.target)
      (after.package.configOf after.epoch.source) ∧
    before.epoch.executionEpoch = boundary.admission.fromVersion ∧
    after.epoch.executionEpoch = boundary.admission.toVersion ∧
    before.epoch.executionEpoch < after.epoch.executionEpoch

/-- Replay evidence for a chain label, preserving its heterogeneous type. -/
inductive EventReplay (universes : ProjectionUniverses) :
    {first last : SomeReplayEpoch} →
      {chain : EpochChain universes first last} →
      ChainEvent universes chain → Prop
  | single {epoch : SomeReplayEpoch}
      {event : epoch.package.lts.Event}
      (occurrence : DPOOccurrence epoch event) :
      EventReplay universes (.single event)
  | head {first middle last : SomeReplayEpoch}
      {boundary : AdjacentAdmission universes first middle}
      {tail : EpochChain universes middle last}
      {event : first.package.lts.Event}
      (occurrence : DPOOccurrence first event) :
      EventReplay universes
        (.head (boundary := boundary) (tail := tail) event)
  | admission {first middle last : SomeReplayEpoch}
      {boundary : AdjacentAdmission universes first middle}
      {tail : EpochChain universes middle last}
      (occurrence : AdmissionOccurrence boundary) :
      EventReplay universes
        (.admission (boundary := boundary) (tail := tail))
  | tail {first middle last : SomeReplayEpoch}
      {boundary : AdjacentAdmission universes first middle}
      {rest : EpochChain universes middle last}
      {event : ChainEvent universes rest}
      (replay : EventReplay universes event) :
      EventReplay universes
        (.tail (boundary := boundary) event)

/-- Runtime execution-epoch alignment for one chain label. -/
inductive ExecutionEpochAligned (universes : ProjectionUniverses) :
    {first last : SomeReplayEpoch} →
      {chain : EpochChain universes first last} →
      ChainEvent universes chain → Prop
  | single {epoch : SomeReplayEpoch}
      {event : epoch.package.lts.Event}
      (aligned :
        (epoch.package.eventRecord event).event.signatureVersion =
          epoch.epoch.executionEpoch) :
      ExecutionEpochAligned universes (.single event)
  | head {first middle last : SomeReplayEpoch}
      {boundary : AdjacentAdmission universes first middle}
      {tail : EpochChain universes middle last}
      {event : first.package.lts.Event}
      (aligned :
        (first.package.eventRecord event).event.signatureVersion =
          first.epoch.executionEpoch) :
      ExecutionEpochAligned universes
        (.head (boundary := boundary) (tail := tail) event)
  | admission {first middle last : SomeReplayEpoch}
      {boundary : AdjacentAdmission universes first middle}
      {tail : EpochChain universes middle last}
      (fromVersion :
        first.epoch.executionEpoch = boundary.admission.fromVersion)
      (toVersion :
        middle.epoch.executionEpoch = boundary.admission.toVersion)
      (strict :
        first.epoch.executionEpoch < middle.epoch.executionEpoch) :
      ExecutionEpochAligned universes
        (.admission (boundary := boundary) (tail := tail))
  | tail {first middle last : SomeReplayEpoch}
      {boundary : AdjacentAdmission universes first middle}
      {rest : EpochChain universes middle last}
      {event : ChainEvent universes rest}
      (aligned : ExecutionEpochAligned universes event) :
      ExecutionEpochAligned universes
        (.tail (boundary := boundary) event)

/-- Every label in the ordered chain trace carries exact replay evidence. -/
theorem trace_event_replay
    {universes : ProjectionUniverses}
    {first last : SomeReplayEpoch}
    (chain : EpochChain universes first last)
    (event : ChainEvent universes chain)
    (member : event ∈ traceEvents chain) :
    EventReplay universes event := by
  induction chain with
  | single epoch =>
      cases event with
      | single event =>
          apply EventReplay.single
          apply DPOOccurrence.of_mem epoch
          simpa [traceEvents] using member
  | @cons first middle last boundary tail ih =>
      cases event with
      | head event =>
          apply EventReplay.head
          apply DPOOccurrence.of_mem first
          simpa [traceEvents] using member
      | admission =>
          apply EventReplay.admission
          exact
            ⟨boundary.replays,
              first.epoch.target_epoch.symm.trans boundary.replays.1,
              middle.epoch.source_epoch.symm.trans
                boundary.replays.target_version,
              boundary.execution_epoch_strict⟩
      | tail event =>
          apply EventReplay.tail
          apply ih event
          simpa [traceEvents] using member

/-- Every label in the ordered trace names its exact execution epoch(s). -/
theorem trace_event_execution_epoch_aligned
    {universes : ProjectionUniverses}
    {first last : SomeReplayEpoch}
    (chain : EpochChain universes first last)
    (event : ChainEvent universes chain)
    (member : event ∈ traceEvents chain) :
    ExecutionEpochAligned universes event := by
  induction chain with
  | single epoch =>
      cases event with
      | single event =>
          apply ExecutionEpochAligned.single
          apply epoch.epoch.event_signature_epoch
          simpa [traceEvents] using member
  | @cons first middle last boundary tail ih =>
      cases event with
      | head event =>
          apply ExecutionEpochAligned.head
          apply first.epoch.event_signature_epoch
          simpa [traceEvents] using member
      | admission =>
          exact
            .admission
              (first.epoch.target_epoch.symm.trans boundary.replays.1)
              (middle.epoch.source_epoch.symm.trans
                boundary.replays.target_version)
              boundary.execution_epoch_strict
      | tail event =>
          apply ExecutionEpochAligned.tail
          apply ih event
          simpa [traceEvents] using member

/--
The complete native/replay/execution-epoch agreement for an arbitrary finite
heterogeneous chain.
-/
structure ChainTraceAgreement
    {universes : ProjectionUniverses}
    {first last : SomeReplayEpoch}
    (chain : EpochChain universes first last) : Prop where
  nativePath :
    ChainPath universes chain
      (ChainState.start chain) (traceEvents chain) (ChainState.finish chain)
  replay :
    ∀ event, event ∈ traceEvents chain → EventReplay universes event
  executionEpochAligned :
    ∀ event, event ∈ traceEvents chain →
      ExecutionEpochAligned universes event
  heterogeneousReplay :
    EpochChain.ReplayAgreement chain

/-- Construct the complete agreement; callers supply no trajectory premise. -/
theorem complete_chain_trace_agreement
    {universes : ProjectionUniverses}
    {first last : SomeReplayEpoch}
    (chain : EpochChain universes first last) :
    ChainTraceAgreement chain where
  nativePath := trace_path chain
  replay := trace_event_replay chain
  executionEpochAligned := trace_event_execution_epoch_aligned chain
  heterogeneousReplay := EpochChain.complete_replay_agreement chain

end Cantilune.Feedback.FiniteHeterogeneousTrajectory
