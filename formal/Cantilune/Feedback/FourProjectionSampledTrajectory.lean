import Cantilune.Feedback.FiniteBranchingReplayKernel
import Cantilune.Feedback.Probability
import Cantilune.Theorems.FourProjection

/-!
# One sampled edge, one replay epoch, and four native projections

This module closes the fixed-signature part of the event-level stochastic
trajectory bridge.  A `CompleteSampledTrajectory` contains only the
`CompleteBranchingTrajectory` produced by the finite branching kernel.
Everything else is computed from its sampled dependent edge:

* the source event and native source derivation;
* the replay-verified `DPOEvent` and its exact configurations;
* the external opportunity epoch and runtime signature epoch;
* a singleton `ReplayEpoch`/`EpochChain`; and
* the four native target derivations.

There is deliberately no independently fillable replay, event label, epoch,
endpoint, or target-step field in `CompleteSampledTrajectory`.

An admission between different signatures is not a `DPOEvent`; it remains an
`AdmissionReplays` boundary in `EpochChain`.  Consequently this construction
is the exact per-epoch bridge and does not misrepresent an admission as a
fixed-signature replay.
-/

noncomputable section

namespace Cantilune.Feedback.FourProjectionSampledTrajectory

open MeasureTheory ProbabilityTheory
open Cantilune.Core
open Cantilune.Core.ExecutionEpochTrace
open Cantilune.Feedback.Probability
open Cantilune.Feedback.FiniteBranchingReplayKernel
open Cantilune.Feedback.FiniteBranchingReplayKernel.BranchingReplayModel
open Cantilune.Theorems

/--
The dependent replay payload attached to one stochastic business choice.
Its event label and native source derivation are fixed by the model's replay
function, rather than selected after a state path has been sampled.
-/
structure PackageReplay
    {signature : FinSignature}
    (package : ExecutionPackage signature)
    (source target : package.lts.State) where
  event : package.lts.Event
  native : package.lts.ObservableStep source event target

/--
Static data needed to interpret every sampled source edge simultaneously as a
replayable package event and as four native projected steps.

`stableSourceVersion` is the model-level certificate connecting the finite
state carrier to the stable external observation window.  Path-level epoch
equalities are theorems below, not trajectory inputs.
-/
structure Bridge
    {signature : FinSignature}
    (package : ExecutionPackage signature)
    (Choice : Type)
    [Fintype package.lts.State] [DecidableEq package.lts.State]
    [Fintype Choice] [DecidableEq Choice] where
  model :
    BranchingReplayModel
      package.lts.State Choice (PackageReplay package)
  window : StableFairWindow
  stableSourceVersion :
    ∀ state,
      package.lts.signatureVersion state =
        window.signatureVersion window.startEpoch
  projections : FourProjectionCertificate package.lts

namespace Bridge

variable {signature : FinSignature}
variable {package : ExecutionPackage signature}
variable {Choice : Type}
variable [Fintype package.lts.State] [DecidableEq package.lts.State]
variable [Fintype Choice] [DecidableEq Choice]

/-- Event-marked states of the bridge's genuine branching kernel. -/
abbrev State (_bridge : Bridge package Choice) :=
  MarkedState
    (State := package.lts.State) (Choice := Choice)

/--
The only stochastic-path field of the common trajectory.  Replay and all
cross-layer evidence are obtained from `sampled.edge`.
-/
structure CompleteSampledTrajectory
    (bridge : Bridge package Choice)
    (path : Nat → bridge.State) where
  sampled : CompleteBranchingTrajectory bridge.model path

/--
Almost every path of the genuine event-branching Markov kernel carries the
common trajectory.  The witness is obtained by wrapping the kernel-generated
`CompleteBranchingTrajectory`; no replay or projection evidence is chosen
here.
-/
theorem completeSampledTrajectory_almostSure
    (bridge : Bridge package Choice)
    [MeasurableSpace bridge.State]
    [MeasurableSingletonClass bridge.State]
    (initial : Measure bridge.State)
    [IsProbabilityMeasure initial] :
    ∀ᵐ path ∂
        bridge.model.markedKernel.toMarkovExecutionKernel.trajectoryMeasure
          initial,
      Nonempty (CompleteSampledTrajectory bridge path) := by
  filter_upwards
    [bridge.model.complete_branching_trajectory_almost_sure initial] with
      path sampled
  exact sampled.map fun trajectory => ⟨trajectory⟩

namespace CompleteSampledTrajectory

variable {bridge : Bridge package Choice}
variable {path : Nat → bridge.State}

/-- The actual dependent edge selected at opportunity `n`. -/
def sampledEdge
    (trajectory : CompleteSampledTrajectory bridge path)
    (n : Nat) :
    MarkedEvent bridge.model (path n) (path (n + 1)) :=
  trajectory.sampled.edge n

/--
The replay payload is definitionally read from the sampled edge.  There is no
second replay selector in this structure.
-/
def sourceReplay
    (trajectory : CompleteSampledTrajectory bridge path)
    (n : Nat) :
    PackageReplay package (path n).1 (path (n + 1)).1 :=
  trajectory.sampled.sampledReplay n

/-- Source event label carried by the sampled dependent replay. -/
def sourceEvent
    (trajectory : CompleteSampledTrajectory bridge path)
    (n : Nat) : package.lts.Event :=
  (trajectory.sourceReplay n).event

/-- Native source transition carried by the same sampled replay. -/
theorem sourceNative
    (trajectory : CompleteSampledTrajectory bridge path)
    (n : Nat) :
    package.lts.ObservableStep
      (path n).1 (trajectory.sourceEvent n) (path (n + 1)).1 :=
  (trajectory.sourceReplay n).native

/-- The sampled business-choice identity is the identity stored in the edge. -/
theorem choice_eq_edge
    (trajectory : CompleteSampledTrajectory bridge path)
    (n : Nat) :
    trajectory.sampled.choice n = (trajectory.sampledEdge n).choice :=
  trajectory.sampled.choice_eq n

/-- The stochastic successor records exactly the sampled business choice. -/
theorem target_mark
    (trajectory : CompleteSampledTrajectory bridge path)
    (n : Nat) :
    (path (n + 1)).2 = some (trajectory.sampled.choice n) :=
  trajectory.sampled.target_mark n

/-- The verified DPO record named by the sampled source label. -/
def dpoRecord
    (trajectory : CompleteSampledTrajectory bridge path)
    (n : Nat) :
    DPOEvent.Verified package.replayKernel :=
  package.eventRecord (trajectory.sourceEvent n)

/--
Endpoint-free replay of the sampled DPO recipe reaches the sampled next
configuration.  This is derived from the source native step.
-/
theorem dpoReplays
    (trajectory : CompleteSampledTrajectory bridge path)
    (n : Nat) :
    (trajectory.dpoRecord n).Replays
      (package.configOf (path n).1)
      (package.configOf (path (n + 1)).1) :=
  package.eventEndpoints (trajectory.sourceNative n)

/-- The DPO record's stored source is exactly the sampled source configuration. -/
theorem dpoSourceEndpoint
    (trajectory : CompleteSampledTrajectory bridge path)
    (n : Nat) :
    package.configOf (path n).1 =
      (trajectory.dpoRecord n).event.source :=
  (trajectory.dpoReplays n).1

/--
The stored DPO target is exactly the sampled target configuration, by
deterministic replay rather than by projecting the stored target.
-/
theorem dpoTargetEndpoint
    (trajectory : CompleteSampledTrajectory bridge path)
    (n : Nat) :
    package.configOf (path (n + 1)).1 =
      (trajectory.dpoRecord n).event.target := by
  let replay := trajectory.dpoReplays n
  have fromRecorded :
      (trajectory.dpoRecord n).Replays
        (trajectory.dpoRecord n).event.source
        (package.configOf (path (n + 1)).1) := by
    rw [← replay.1]
    exact replay
  exact DPOEvent.replay_recovers_recorded_target fromRecorded

/-- External opportunity epoch assigned to this sampled edge. -/
def opportunityEpoch
    (_trajectory : CompleteSampledTrajectory bridge path)
    (n : Nat) : Nat :=
  bridge.window.opportunityEpoch n

/-- Runtime signature epoch stored in this sampled DPO record. -/
def runtimeEpoch
    (trajectory : CompleteSampledTrajectory bridge path)
    (n : Nat) : Nat :=
  (trajectory.dpoRecord n).event.signatureVersion

private theorem opportunity_signature_stable
    (trajectory : CompleteSampledTrajectory bridge path)
    (n : Nat) :
    bridge.window.signatureVersion (trajectory.opportunityEpoch n) =
      bridge.window.signatureVersion bridge.window.startEpoch := by
  obtain ⟨offset, equality⟩ :=
    Nat.exists_eq_add_of_le (bridge.window.opportunity_after_start n)
  unfold opportunityEpoch
  rw [equality]
  exact bridge.window.signature_stable offset

/-- Runtime epoch equals the source LTS signature version of the sampled edge. -/
theorem runtimeEpoch_eq_sourceVersion
    (trajectory : CompleteSampledTrajectory bridge path)
    (n : Nat) :
    trajectory.runtimeEpoch n =
      package.lts.signatureVersion (path n).1 := by
  calc
    trajectory.runtimeEpoch n =
        (trajectory.dpoRecord n).event.source.signatureVersion :=
      (trajectory.dpoRecord n).event.sourceVersion.symm
    _ = (package.configOf (path n).1).signatureVersion := by
      rw [trajectory.dpoSourceEndpoint n]
    _ = package.lts.signatureVersion (path n).1 :=
      package.stateVersion (path n).1

/-- Runtime epoch also equals the target LTS signature version. -/
theorem runtimeEpoch_eq_targetVersion
    (trajectory : CompleteSampledTrajectory bridge path)
    (n : Nat) :
    trajectory.runtimeEpoch n =
      package.lts.signatureVersion (path (n + 1)).1 := by
  calc
    trajectory.runtimeEpoch n =
        (trajectory.dpoRecord n).event.target.signatureVersion :=
      (trajectory.dpoRecord n).event.targetVersion.symm
    _ = (package.configOf (path (n + 1)).1).signatureVersion := by
      rw [trajectory.dpoTargetEndpoint n]
    _ = package.lts.signatureVersion (path (n + 1)).1 :=
      package.stateVersion (path (n + 1)).1

/--
The sampled DPO runtime epoch is the signature observed at the corresponding
external opportunity epoch.
-/
theorem runtimeEpoch_eq_opportunitySignature
    (trajectory : CompleteSampledTrajectory bridge path)
    (n : Nat) :
    trajectory.runtimeEpoch n =
      bridge.window.signatureVersion (trajectory.opportunityEpoch n) := by
  calc
    trajectory.runtimeEpoch n =
        package.lts.signatureVersion (path n).1 :=
      trajectory.runtimeEpoch_eq_sourceVersion n
    _ = bridge.window.signatureVersion bridge.window.startEpoch :=
      bridge.stableSourceVersion (path n).1
    _ = bridge.window.signatureVersion (trajectory.opportunityEpoch n) :=
      (trajectory.opportunity_signature_stable n).symm

/-- The opportunity carrying this sampled edge is externally observed. -/
theorem opportunityObserved
    (trajectory : CompleteSampledTrajectory bridge path)
    (n : Nat) :
    bridge.window.observed (trajectory.opportunityEpoch n) :=
  bridge.window.opportunity_observed n

/-- Consecutive sampled edges occupy strictly ordered opportunity epochs. -/
theorem opportunityStrict
    (trajectory : CompleteSampledTrajectory bridge path)
    (n : Nat) :
    trajectory.opportunityEpoch n <
      trajectory.opportunityEpoch (n + 1) :=
  bridge.window.opportunity_strictMono (Nat.lt_succ_self n)

/--
The sampled edge as a one-event replay epoch.  Its execution epoch is not an
independent field: it is exactly the DPO record's runtime epoch.
-/
def replayEpoch
    (trajectory : CompleteSampledTrajectory bridge path)
    (n : Nat) :
    ReplayEpoch package where
  executionEpoch := trajectory.runtimeEpoch n
  source := (path n).1
  target := (path (n + 1)).1
  events := [trajectory.sourceEvent n]
  path :=
    ObservableLTS.Path.cons
      (trajectory.sourceNative n)
      (ObservableLTS.Path.nil _)
  source_epoch := by
    exact
      (package.stateVersion (path n).1).trans
        (trajectory.runtimeEpoch_eq_sourceVersion n).symm

/-- Existentially package the one-event runtime epoch without losing replay. -/
def someReplayEpoch
    (trajectory : CompleteSampledTrajectory bridge path)
    (n : Nat) :
    SomeReplayEpoch where
  signature := signature
  package := package
  epoch := trajectory.replayEpoch n

/--
Embed the sampled edge in the heterogeneous trace language.  This is a
singleton chain because a cross-signature admission is not a `DPOEvent`.
-/
def singletonEpochChain
    (trajectory : CompleteSampledTrajectory bridge path)
    (universes : ProjectionUniverses)
    (n : Nat) :
    EpochChain universes
      (trajectory.someReplayEpoch n)
      (trajectory.someReplayEpoch n) :=
  .single (trajectory.someReplayEpoch n)

/-- The singleton epoch deterministically replays its sampled DPO edge. -/
theorem replayEpochAgreement
    (trajectory : CompleteSampledTrajectory bridge path)
    (n : Nat) :
    replayEvents package [trajectory.sourceEvent n]
        (package.configOf (path n).1) =
      some (package.configOf (path (n + 1)).1) :=
  (trajectory.replayEpoch n).replay_agreement

/-- Four native target transitions obtained from one source transition. -/
structure FourProjectedStep
    (trajectory : CompleteSampledTrajectory bridge path)
    (n : Nat) where
  dag :
    bridge.projections.dagLTS.ObservableStep
      (bridge.projections.dag.mapState (path n).1)
      (bridge.projections.dag.mapEvent (trajectory.sourceEvent n))
      (bridge.projections.dag.mapState (path (n + 1)).1)
  petri :
    bridge.projections.petriLTS.ObservableStep
      (bridge.projections.petri.mapState (path n).1)
      (bridge.projections.petri.mapEvent (trajectory.sourceEvent n))
      (bridge.projections.petri.mapState (path (n + 1)).1)
  pi :
    bridge.projections.piLTS.ObservableStep
      (bridge.projections.pi.mapState (path n).1)
      (bridge.projections.pi.mapEvent (trajectory.sourceEvent n))
      (bridge.projections.pi.mapState (path (n + 1)).1)
  morphism :
    bridge.projections.morphismLTS.ObservableStep
      (bridge.projections.morphism.mapState (path n).1)
      (bridge.projections.morphism.mapEvent (trajectory.sourceEvent n))
      (bridge.projections.morphism.mapState (path (n + 1)).1)

/-- Construct all four target derivations from the sampled source derivation. -/
theorem fourProjectedStep
    (trajectory : CompleteSampledTrajectory bridge path)
    (n : Nat) :
    FourProjectedStep trajectory n where
  dag := bridge.projections.dag.sound (trajectory.sourceNative n)
  petri := bridge.projections.petri.sound (trajectory.sourceNative n)
  pi := bridge.projections.pi.sound (trajectory.sourceNative n)
  morphism := bridge.projections.morphism.sound (trajectory.sourceNative n)

/--
The two mapped endpoints in every target carry the very same runtime
signature epoch as the sampled source DPO edge.
-/
structure FourProjectedEpochs
    (trajectory : CompleteSampledTrajectory bridge path)
    (n : Nat) where
  dagSource :
    bridge.projections.dagLTS.signatureVersion
        (bridge.projections.dag.mapState (path n).1) =
      trajectory.runtimeEpoch n
  dagTarget :
    bridge.projections.dagLTS.signatureVersion
        (bridge.projections.dag.mapState (path (n + 1)).1) =
      trajectory.runtimeEpoch n
  petriSource :
    bridge.projections.petriLTS.signatureVersion
        (bridge.projections.petri.mapState (path n).1) =
      trajectory.runtimeEpoch n
  petriTarget :
    bridge.projections.petriLTS.signatureVersion
        (bridge.projections.petri.mapState (path (n + 1)).1) =
      trajectory.runtimeEpoch n
  piSource :
    bridge.projections.piLTS.signatureVersion
        (bridge.projections.pi.mapState (path n).1) =
      trajectory.runtimeEpoch n
  piTarget :
    bridge.projections.piLTS.signatureVersion
        (bridge.projections.pi.mapState (path (n + 1)).1) =
      trajectory.runtimeEpoch n
  morphismSource :
    bridge.projections.morphismLTS.signatureVersion
        (bridge.projections.morphism.mapState (path n).1) =
      trajectory.runtimeEpoch n
  morphismTarget :
    bridge.projections.morphismLTS.signatureVersion
        (bridge.projections.morphism.mapState (path (n + 1)).1) =
      trajectory.runtimeEpoch n

/-- Construct all eight target epoch equations from certificate preservation. -/
theorem fourProjectedEpochs
    (trajectory : CompleteSampledTrajectory bridge path)
    (n : Nat) :
    FourProjectedEpochs trajectory n where
  dagSource :=
    (bridge.projections.dag.signatureVersion_preserved _).trans
      (trajectory.runtimeEpoch_eq_sourceVersion n).symm
  dagTarget :=
    (bridge.projections.dag.signatureVersion_preserved _).trans
      (trajectory.runtimeEpoch_eq_targetVersion n).symm
  petriSource :=
    (bridge.projections.petri.signatureVersion_preserved _).trans
      (trajectory.runtimeEpoch_eq_sourceVersion n).symm
  petriTarget :=
    (bridge.projections.petri.signatureVersion_preserved _).trans
      (trajectory.runtimeEpoch_eq_targetVersion n).symm
  piSource :=
    (bridge.projections.pi.signatureVersion_preserved _).trans
      (trajectory.runtimeEpoch_eq_sourceVersion n).symm
  piTarget :=
    (bridge.projections.pi.signatureVersion_preserved _).trans
      (trajectory.runtimeEpoch_eq_targetVersion n).symm
  morphismSource :=
    (bridge.projections.morphism.signatureVersion_preserved _).trans
      (trajectory.runtimeEpoch_eq_sourceVersion n).symm
  morphismTarget :=
    (bridge.projections.morphism.signatureVersion_preserved _).trans
      (trajectory.runtimeEpoch_eq_targetVersion n).symm

/--
The nontrivial pointwise agreement proposition.  Every conjunct refers to the
same sampled edge; none can be filled independently in
`CompleteSampledTrajectory`.
-/
def PointwiseAgreement
    (trajectory : CompleteSampledTrajectory bridge path)
    (n : Nat) : Prop :=
  (path (n + 1)).2 = some (trajectory.sampled.choice n) ∧
  bridge.window.observed (trajectory.opportunityEpoch n) ∧
  trajectory.opportunityEpoch n <
    trajectory.opportunityEpoch (n + 1) ∧
  trajectory.runtimeEpoch n =
    bridge.window.signatureVersion (trajectory.opportunityEpoch n) ∧
  (trajectory.dpoRecord n).Replays
    (package.configOf (path n).1)
    (package.configOf (path (n + 1)).1) ∧
  package.configOf (path n).1 =
    (trajectory.dpoRecord n).event.source ∧
  package.configOf (path (n + 1)).1 =
    (trajectory.dpoRecord n).event.target ∧
  Nonempty (FourProjectedStep trajectory n) ∧
  Nonempty (FourProjectedEpochs trajectory n)

/-- Every sampled business edge satisfies the complete pointwise agreement. -/
theorem pointwiseAgreement
    (trajectory : CompleteSampledTrajectory bridge path)
    (n : Nat) :
    trajectory.PointwiseAgreement n := by
  exact
    ⟨trajectory.target_mark n,
      trajectory.opportunityObserved n,
      trajectory.opportunityStrict n,
      trajectory.runtimeEpoch_eq_opportunitySignature n,
      trajectory.dpoReplays n,
      trajectory.dpoSourceEndpoint n,
      trajectory.dpoTargetEndpoint n,
      ⟨trajectory.fourProjectedStep n⟩,
      ⟨trajectory.fourProjectedEpochs n⟩⟩

/-- The entire infinite sampled path has the common agreement pointwise. -/
theorem allPointwiseAgreement
    (trajectory : CompleteSampledTrajectory bridge path) :
    ∀ n, trajectory.PointwiseAgreement n :=
  trajectory.pointwiseAgreement

end CompleteSampledTrajectory

end Bridge

end Cantilune.Feedback.FourProjectionSampledTrajectory
