import Cantilune.Core.Admission
import Cantilune.Core.Package

/-!
# Replay-verified execution epochs

This module separates two notions which must not be conflated:

* a finite sequence of `DPOEvent.Verified` records over one fixed signature
  version; and
* a heterogeneous, four-view-certified signature admission between two such
  sequences.

In particular, the execution-epoch identifier below is read from runtime
configurations.  It is unrelated to the observation-opportunity indices used
by the probabilistic fairness layer.
-/

namespace Cantilune.Core

namespace ExecutionEpochTrace

/--
Replay a list of package events from endpoint-free recipes.

The stored targets in the corresponding `DPOEvent` records are not consulted:
each next configuration is recomputed by the package replay kernel.
-/
def replayEvents {σ : FinSignature} (package : ExecutionPackage σ) :
    List package.lts.Event → Config σ → Option (Config σ)
  | [], source => some source
  | event :: events, source => do
      let target ←
        package.replayKernel.run
          (package.eventRecord event).event.replayRecipe source
      replayEvents package events target

/--
Every native package step preserves the runtime signature version.

This follows from the version fields of the replay-verified `DPOEvent`, rather
than from an observation schedule or a separately asserted epoch equation.
-/
theorem observable_step_config_version_preserved
    {σ : FinSignature} (package : ExecutionPackage σ)
    {source target : package.lts.State} {event : package.lts.Event}
    (step : package.lts.ObservableStep source event target) :
    (package.configOf target).signatureVersion =
      (package.configOf source).signatureVersion := by
  let record := package.eventRecord event
  have replay :
      record.Replays (package.configOf source) (package.configOf target) :=
    package.eventEndpoints step
  have sourceEq :
      package.configOf source = record.event.source :=
    replay.1
  have targetEq :
      package.configOf target = record.event.target := by
    have replayFromRecorded :
        record.Replays record.event.source (package.configOf target) := by
      rw [← sourceEq]
      exact replay
    exact DPOEvent.replay_recovers_recorded_target replayFromRecorded
  calc
    (package.configOf target).signatureVersion =
        record.event.target.signatureVersion := by
          rw [targetEq]
    _ = record.event.signatureVersion :=
      record.event.targetVersion
    _ = record.event.source.signatureVersion :=
      record.event.sourceVersion.symm
    _ = (package.configOf source).signatureVersion := by
      rw [sourceEq]

/-- The observable LTS version is consequently preserved by every package step. -/
theorem observable_step_lts_version_preserved
    {σ : FinSignature} (package : ExecutionPackage σ)
    {source target : package.lts.State} {event : package.lts.Event}
    (step : package.lts.ObservableStep source event target) :
    package.lts.signatureVersion target =
      package.lts.signatureVersion source := by
  rw [← package.stateVersion target, ← package.stateVersion source]
  exact observable_step_config_version_preserved package step

/--
An event occurring in a finite native path has concrete endpoints and its
verified DPO record replays exactly between their mapped configurations.
-/
theorem path_event_has_verified_replay
    {σ : FinSignature} (package : ExecutionPackage σ)
    {source target : package.lts.State}
    {events : List package.lts.Event}
    (path : package.lts.Path source events target)
    {event : package.lts.Event}
    (member : event ∈ events) :
    ∃ eventSource eventTarget,
      package.lts.ObservableStep eventSource event eventTarget ∧
      (package.eventRecord event).Replays
        (package.configOf eventSource) (package.configOf eventTarget) := by
  induction path with
  | nil state =>
      simp at member
  | @cons first middle last head tail headStep tailPath ih =>
      simp only [List.mem_cons] at member
      rcases member with rfl | member
      · exact
          ⟨first, middle, headStep, package.eventEndpoints headStep⟩
      · exact ih member

/--
Every event record in a finite path carries the same runtime signature version
as the path's initial configuration.
-/
theorem path_event_signature_version
    {σ : FinSignature} (package : ExecutionPackage σ)
    {source target : package.lts.State}
    {events : List package.lts.Event}
    (path : package.lts.Path source events target)
    {event : package.lts.Event}
    (member : event ∈ events) :
    (package.eventRecord event).event.signatureVersion =
      (package.configOf source).signatureVersion := by
  induction path with
  | nil state =>
      simp at member
  | @cons first middle last head tail headStep tailPath ih =>
      simp only [List.mem_cons] at member
      rcases member with rfl | member
      · have replay :=
          package.eventEndpoints headStep
        calc
          (package.eventRecord event).event.signatureVersion =
              (package.eventRecord event).event.source.signatureVersion :=
            (package.eventRecord event).event.sourceVersion.symm
          _ = (package.configOf first).signatureVersion := by
            rw [replay.1]
      · calc
          (package.eventRecord event).event.signatureVersion =
              (package.configOf middle).signatureVersion :=
            ih member
          _ = (package.configOf first).signatureVersion :=
            observable_step_config_version_preserved package headStep

/-- A finite path preserves its runtime signature version end to end. -/
theorem path_config_version_preserved
    {σ : FinSignature} (package : ExecutionPackage σ)
    {source target : package.lts.State}
    {events : List package.lts.Event}
    (path : package.lts.Path source events target) :
    (package.configOf target).signatureVersion =
      (package.configOf source).signatureVersion := by
  induction path with
  | nil state =>
      rfl
  | @cons first middle last event events step path ih =>
      exact
        ih.trans
          (observable_step_config_version_preserved package step)

/--
The endpoint-free replay interpreter agrees with every finite native package
path, event for event.
-/
theorem path_replay_agreement
    {σ : FinSignature} (package : ExecutionPackage σ)
    {source target : package.lts.State}
    {events : List package.lts.Event}
    (path : package.lts.Path source events target) :
    replayEvents package events (package.configOf source) =
      some (package.configOf target) := by
  induction path with
  | nil state =>
      rfl
  | @cons first middle last event events step path ih =>
      have replay := package.eventEndpoints step
      simp only [replayEvents]
      rw [replay.2]
      exact ih

/--
One execution epoch is a finite, event-labelled package path whose runtime
signature version is explicitly named by `executionEpoch`.

There is no requirement that one stochastic observation opportunity correspond
to one event.  `events` may contain any finite number of verified DPO steps.
-/
structure ReplayEpoch {σ : FinSignature} (package : ExecutionPackage σ) where
  executionEpoch : Nat
  source : package.lts.State
  target : package.lts.State
  events : List package.lts.Event
  path : package.lts.Path source events target
  source_epoch :
    (package.configOf source).signatureVersion = executionEpoch

namespace ReplayEpoch

variable {σ : FinSignature} {package : ExecutionPackage σ}

/-- Every endpoint of the epoch remains at its declared execution epoch. -/
theorem target_epoch (epoch : ReplayEpoch package) :
    (package.configOf epoch.target).signatureVersion =
      epoch.executionEpoch := by
  exact
    (path_config_version_preserved package epoch.path).trans
      epoch.source_epoch

/-- Every event label in the epoch is a replay-verified DPO record. -/
theorem event_has_verified_replay
    (epoch : ReplayEpoch package)
    {event : package.lts.Event} (member : event ∈ epoch.events) :
    ∃ eventSource eventTarget,
      package.lts.ObservableStep eventSource event eventTarget ∧
      (package.eventRecord event).Replays
        (package.configOf eventSource) (package.configOf eventTarget) :=
  path_event_has_verified_replay package epoch.path member

/-- Every record in the epoch carries the declared execution-epoch version. -/
theorem event_signature_epoch
    (epoch : ReplayEpoch package)
    {event : package.lts.Event} (member : event ∈ epoch.events) :
    (package.eventRecord event).event.signatureVersion =
      epoch.executionEpoch :=
  (path_event_signature_version package epoch.path member).trans
    epoch.source_epoch

/-- The complete event sequence deterministically replays to the recorded end. -/
theorem replay_agreement (epoch : ReplayEpoch package) :
    replayEvents package epoch.events (package.configOf epoch.source) =
      some (package.configOf epoch.target) :=
  path_replay_agreement package epoch.path

/-- The optional stronger condition that every event is internally ranked. -/
def InternallyRanked (epoch : ReplayEpoch package) : Prop :=
  epoch.events.Forall package.ranking.internal

/--
An internally ranked replay epoch has at most the source rank's many events.
This is the finite-epoch termination bound; external holds are deliberately
outside this premise.
-/
theorem internal_event_count_le_rank
    (epoch : ReplayEpoch package) (internal : epoch.InternallyRanked) :
    epoch.events.length ≤ package.ranking.rank epoch.source :=
  package.ranking.internal_path_length_le epoch.path internal

/-- The ranking layer's own epoch observation is preserved on internal paths. -/
theorem internal_ranking_epoch_preserved
    (epoch : ReplayEpoch package) (internal : epoch.InternallyRanked) :
    package.ranking.epoch epoch.target =
      package.ranking.epoch epoch.source :=
  package.ranking.internal_path_epoch_preserved epoch.path internal

end ReplayEpoch

/-- Change only the runtime signature-version field of a configuration. -/
def withSignatureVersion {σ : FinSignature}
    (version : Nat) (config : Config σ) : Config σ :=
  { config with signatureVersion := version }

@[simp] theorem withSignatureVersion_version
    {σ : FinSignature} (version : Nat) (config : Config σ) :
    (withSignatureVersion version config).signatureVersion = version :=
  rfl

/-- Updating only the version cannot invalidate the underlying graph. -/
theorem wellFormed_withSignatureVersion
    {σ : FinSignature} {config : Config σ}
    (version : Nat) (wellFormed : config.WellFormed) :
    (withSignatureVersion version config).WellFormed := by
  exact wellFormed

/-- Updating only the version preserves token/session ownership. -/
theorem ownershipWellFormed_withSignatureVersion
    {σ : FinSignature} {config : Config σ}
    (version : Nat) (wellFormed : config.OwnershipWellFormed) :
    (withSignatureVersion version config).OwnershipWellFormed := by
  exact wellFormed

/--
The deterministic target of a pure signature-admission boundary.

All runtime data is reindexed along the append-only signature extension; the
only additional change is the explicitly certified target version.
-/
def admissionTarget
    {universes : ProjectionUniverses}
    {σ τ : FinSignature}
    (admission :
      SignatureAdmissionEvent universes (source := σ) (target := τ))
    (source : Config σ) : Config τ :=
  withSignatureVersion admission.toVersion
    (Config.reindex admission.extension source)

/-- Pure admission reindexing preserves graph well-formedness. -/
theorem admissionTarget_wellFormed
    {universes : ProjectionUniverses}
    {σ τ : FinSignature}
    (admission :
      SignatureAdmissionEvent universes (source := σ) (target := τ))
    {source : Config σ} (wellFormed : source.WellFormed) :
    (admissionTarget admission source).WellFormed := by
  exact
    wellFormed_withSignatureVersion admission.toVersion
      (Config.wellFormed_reindex admission.extension wellFormed)

/-- Pure admission reindexing preserves runtime ownership evidence. -/
theorem admissionTarget_ownershipWellFormed
    {universes : ProjectionUniverses}
    {σ τ : FinSignature}
    (admission :
      SignatureAdmissionEvent universes (source := σ) (target := τ))
    {source : Config σ}
    (wellFormed : source.OwnershipWellFormed) :
    (admissionTarget admission source).OwnershipWellFormed := by
  exact
    ownershipWellFormed_withSignatureVersion admission.toVersion
      (Config.ownershipWellFormed_reindex admission.extension wellFormed)

/--
Endpoint-free replay relation for a heterogeneous signature admission.

This is deliberately separate from `DPOEvent.Replays`, whose source and target
must have the same fixed signature.
-/
def AdmissionReplays
    {universes : ProjectionUniverses}
    {σ τ : FinSignature}
    (admission :
      SignatureAdmissionEvent universes (source := σ) (target := τ))
    (source : Config σ) (target : Config τ) : Prop :=
  source.signatureVersion = admission.fromVersion ∧
    admissionTarget admission source = target

namespace AdmissionReplays

variable {universes : ProjectionUniverses}
variable {σ τ : FinSignature}
variable
  {admission :
    SignatureAdmissionEvent universes (source := σ) (target := τ)}
variable {source : Config σ} {target : Config τ}

/-- A replayed admission target has exactly the certified target version. -/
theorem target_version
    (replay : AdmissionReplays admission source target) :
    target.signatureVersion = admission.toVersion := by
  rw [← replay.2]
  rfl

/-- A replayed admission strictly advances the runtime execution epoch. -/
theorem version_strict
    (replay : AdmissionReplays admission source target) :
    source.signatureVersion < target.signatureVersion := by
  rw [replay.1, replay.target_version]
  exact admission.advancesEpoch

/-- Heterogeneous admission replay is deterministic. -/
theorem target_unique
    {left right : Config τ}
    (leftReplay : AdmissionReplays admission source left)
    (rightReplay : AdmissionReplays admission source right) :
    left = right :=
  leftReplay.2.symm.trans rightReplay.2

end AdmissionReplays

/--
Package a replay epoch while hiding its fixed signature and execution package.
This existential packaging permits a finite chain to cross signature types.
-/
structure SomeReplayEpoch where
  signature : FinSignature
  package : ExecutionPackage signature
  epoch : ReplayEpoch package

/--
One certified boundary between two replay epochs of possibly different
signature types.
-/
structure AdjacentAdmission
    (universes : ProjectionUniverses)
    (before after : SomeReplayEpoch) where
  admission :
    SignatureAdmissionEvent universes
      (source := before.signature) (target := after.signature)
  replays :
    AdmissionReplays admission
      (before.package.configOf before.epoch.target)
      (after.package.configOf after.epoch.source)

namespace AdjacentAdmission

variable {universes : ProjectionUniverses}
variable {before after : SomeReplayEpoch}

/--
An admission boundary strictly advances the declared execution-epoch number.
-/
theorem execution_epoch_strict
    (boundary : AdjacentAdmission universes before after) :
    before.epoch.executionEpoch < after.epoch.executionEpoch := by
  rw [← before.epoch.target_epoch, ← after.epoch.source_epoch]
  exact boundary.replays.version_strict

/-- The boundary's reindex-and-version update is exactly replayed. -/
theorem replay_agreement
    (boundary : AdjacentAdmission universes before after) :
    admissionTarget boundary.admission
        (before.package.configOf before.epoch.target) =
      after.package.configOf after.epoch.source :=
  boundary.replays.2

end AdjacentAdmission

/--
A finite heterogeneous execution is a nonempty chain of replay epochs joined
only by certified signature-admission boundaries.
-/
inductive EpochChain (universes : ProjectionUniverses) :
    SomeReplayEpoch → SomeReplayEpoch → Type 2
  | single (epoch : SomeReplayEpoch) : EpochChain universes epoch epoch
  | cons {first middle last : SomeReplayEpoch} :
      AdjacentAdmission universes first middle →
      EpochChain universes middle last →
      EpochChain universes first last

namespace EpochChain

variable {universes : ProjectionUniverses}
variable {first last : SomeReplayEpoch}

/-- Every nontrivial chain has strictly ordered endpoint execution epochs. -/
theorem execution_epoch_le
    (chain : EpochChain universes first last) :
    first.epoch.executionEpoch ≤ last.epoch.executionEpoch := by
  induction chain with
  | single epoch =>
      exact le_rfl
  | @cons first middle last boundary tail ih =>
      exact (Nat.le_of_lt boundary.execution_epoch_strict).trans ih

/-- A chain containing at least one admission has strictly ordered endpoints. -/
theorem cons_execution_epoch_strict
    {middle : SomeReplayEpoch}
    (boundary : AdjacentAdmission universes first middle)
    (tail : EpochChain universes middle last) :
    first.epoch.executionEpoch < last.epoch.executionEpoch :=
  boundary.execution_epoch_strict.trans_le tail.execution_epoch_le

/--
All within-epoch event lists and all heterogeneous boundaries in the chain
carry their exact replay equations.
-/
inductive ReplayAgreement :
    {first last : SomeReplayEpoch} →
      EpochChain universes first last → Prop
  | single (epoch : SomeReplayEpoch) :
      replayEvents epoch.package epoch.epoch.events
          (epoch.package.configOf epoch.epoch.source) =
        some (epoch.package.configOf epoch.epoch.target) →
      ReplayAgreement (.single epoch)
  | cons {first middle last : SomeReplayEpoch}
      (boundary : AdjacentAdmission universes first middle)
      (tail : EpochChain universes middle last) :
      replayEvents first.package first.epoch.events
          (first.package.configOf first.epoch.source) =
        some (first.package.configOf first.epoch.target) →
      admissionTarget boundary.admission
          (first.package.configOf first.epoch.target) =
        middle.package.configOf middle.epoch.source →
      ReplayAgreement tail →
      ReplayAgreement (.cons boundary tail)

/--
Construct the complete replay agreement for an arbitrary finite epoch chain.

No endpoint or stored target is supplied as an extra assumption: the equations
are discharged from the verified DPO paths and the certified admission replay.
-/
theorem complete_replay_agreement
    (chain : EpochChain universes first last) :
    ReplayAgreement chain := by
  induction chain with
  | single epoch =>
      exact ReplayAgreement.single epoch epoch.epoch.replay_agreement
  | @cons first middle last boundary tail ih =>
      exact
        ReplayAgreement.cons boundary tail
          first.epoch.replay_agreement boundary.replay_agreement ih

end EpochChain

end ExecutionEpochTrace

end Cantilune.Core
