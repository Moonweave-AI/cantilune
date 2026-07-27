import Cantilune.Feedback.FourProjectionSampledTrajectory
import Cantilune.Feedback.HeterogeneousAdmissionTrajectory

namespace Cantilune.Tests.FourProjectionSampledTrajectory

open Cantilune.Core
open Cantilune.Feedback.Probability
open Cantilune.Feedback.FiniteBranchingReplayKernel
open Cantilune.Feedback.FiniteBranchingReplayKernel.BranchingReplayModel
open Cantilune.Feedback.FourProjectionSampledTrajectory
open Cantilune.Feedback.HeterogeneousAdmissionTrajectory.Reference
open Cantilune.Theorems

abbrev State := NewState
abbrev Choice := Unit

noncomputable local instance : Fintype newPackage.lts.State := by
  change Fintype NewState
  infer_instance

noncomputable local instance : DecidableEq newPackage.lts.State := by
  change DecidableEq NewState
  infer_instance

def replay :
    PackageReplay newPackage NewState.live NewState.live where
  event := NewEvent.hold
  native := ⟨NewStep.hold, trivial⟩

def model :
    BranchingReplayModel
      State Choice (PackageReplay newPackage) where
  source := fun _ => .live
  target := fun _ => .live
  replay := fun _ => replay
  weight := fun _ => 1
  weight_nonnegative := by simp
  row_sum := by
    intro state
    cases state
    simp

def window : StableFairWindow where
  signatureVersion := fun _ => 1
  observed := fun _ => True
  startEpoch := 0
  opportunityEpoch := id
  signature_stable := by simp
  opportunity_after_start := by simp
  opportunity_strictMono := strictMono_id
  opportunity_observed := by simp
  cofinal := by
    intro epoch _after
    exact ⟨epoch, le_rfl⟩

def projections : FourProjectionCertificate newLTS where
  dagLTS := newLTS
  petriLTS := newLTS
  piLTS := newLTS
  morphismLTS := newLTS
  dag := ProjectionCertificate.identity newLTS
  petri := ProjectionCertificate.identity newLTS
  pi := ProjectionCertificate.identity newLTS
  morphism := ProjectionCertificate.identity newLTS

def bridge : Bridge newPackage Choice where
  model := model
  window := window
  stableSourceVersion := by
    intro state
    cases state
    rfl
  projections := projections

def path :
    Nat →
      BranchingReplayModel.MarkedState
        (State := newPackage.lts.State) (Choice := Choice)
  | 0 => (.live, none)
  | _ + 1 => (.live, some ())

def sampled :
    CompleteBranchingTrajectory model path where
  positive := by
    intro n
    cases n <;>
      simp [path, model, BranchingReplayModel.markedProbability]
  edge := by
    intro n
    refine .business () ?_ ?_
    · cases n <;> rfl
    · rfl
  choice := fun _ => ()
  choice_eq := by simp
  source_eq := by
    intro n
    cases n <;> rfl
  target_eq := by simp [path, model]
  target_mark := by simp [path]

def common :
    Bridge.CompleteSampledTrajectory bridge path where
  sampled := sampled

example :
    Nonempty (Bridge.CompleteSampledTrajectory bridge path) :=
  ⟨common⟩

#check Bridge.completeSampledTrajectory_almostSure

example (n : Nat) : common.PointwiseAgreement n :=
  common.pointwiseAgreement n

example (n : Nat) :
    (common.dpoRecord n).Replays
      (newPackage.configOf (path n).1)
      (newPackage.configOf (path (n + 1)).1) :=
  common.dpoReplays n

example (n : Nat) :
    common.runtimeEpoch n =
      window.signatureVersion (common.opportunityEpoch n) :=
  common.runtimeEpoch_eq_opportunitySignature n

example (n : Nat) :
    Nonempty (Bridge.CompleteSampledTrajectory.FourProjectedStep common n) :=
  ⟨common.fourProjectedStep n⟩

example (n : Nat) :
    Nonempty (Bridge.CompleteSampledTrajectory.FourProjectedEpochs common n) :=
  ⟨common.fourProjectedEpochs n⟩

example (n : Nat) :
    ExecutionEpochTrace.replayEvents newPackage [common.sourceEvent n]
        (newPackage.configOf (path n).1) =
      some (newPackage.configOf (path (n + 1)).1) :=
  common.replayEpochAgreement n

end Cantilune.Tests.FourProjectionSampledTrajectory
