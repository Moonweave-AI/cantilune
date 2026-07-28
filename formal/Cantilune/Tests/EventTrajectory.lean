import Cantilune.Feedback.EventTrajectory
import Cantilune.Tests.FeedbackExecution

/-!
# Replayable event-labelled stochastic trajectory regression

This fixture strengthens the earlier two-state state kernel with explicit
native events for holding and progress transitions.  The stochastic state law
is unchanged: instability holds with probability `1 / 2` and progresses with
probability `1 / 2`; the stable state is absorbing.
-/

namespace Cantilune.Tests.EventTrajectory

open MeasureTheory
open Cantilune.Core
open Cantilune.Feedback
open Cantilune.Feedback.Probability
open Cantilune.Feedback.StochasticExecution
open Cantilune.Feedback.StochasticExecution.FiniteDiscrete
open Cantilune.Feedback.EventTrajectory
open Cantilune.Feedback.EventTrajectory.FiniteDiscrete

noncomputable section

abbrev signature :=
  Cantilune.Tests.FeedbackExecution.emptySignature

abbrev config :=
  Cantilune.Tests.FeedbackExecution.config

abbrev config_wellFormed :=
  Cantilune.Tests.FeedbackExecution.config_wellFormed

/-- Replay chooses the target policy state encoded by the complete recipe. -/
def replayKernel : DPOEvent.ReplayKernel signature where
  run := fun recipe _source =>
    if recipe.ruleId = 0 then some (config 0) else some (config 1)

/-- A complete external record for one ordered Boolean state pair. -/
def eventRecord (source target : Bool) : DPOEvent signature where
  signatureVersion := 0
  ruleId := if target then 1 else 0
  source := config (if source then 1 else 0)
  target := config (if target then 1 else 0)
  matchDomainSize := 0
  matchCodomainSize := 0
  matchEmbedding := Function.Embedding.refl (Fin 0)
  complementTag := 23
  freshNames := ∅
  policyEvidence := [if target then 1 else 0]
  externalEvidence := [if source then 1 else 0, if target then 1 else 0]
  kind := .external
  sourceVersion := rfl
  targetVersion := rfl
  freshForSource := by simp [config]
  sourceWellFormed := config_wellFormed _
  targetWellFormed := config_wellFormed _

def verifiedEvent (event : Bool × Bool) :
    DPOEvent.Verified replayKernel where
  event := eventRecord event.1 event.2
  replay_correct := by
    cases event with
    | mk source target =>
        cases target <;> rfl

/-- Every ordered pair is a native external event in the fixture LTS. -/
def lts : ObservableLTS where
  State := Bool
  Event := Bool × Bool
  stateSetoid := ObservableLTS.equalitySetoid Bool
  step := fun source event target => event = (source, target)
  observable := fun _ => True
  success := fun state => state = true
  waiting := fun _ => False
  signatureVersion := fun _ => 0
  step_congr := by
    intro source source' event target target' sourceEq targetEq
    subst source'
    subst target'
    rfl
  success_congr := by
    intro source target equality
    subst target
    rfl
  waiting_congr := by
    intro source target equality
    subst target
    rfl
  signatureVersion_congr := by
    intro source target equality
    subst target
    rfl

theorem native_step (source target : Bool) :
    lts.ObservableStep source (source, target) target :=
  ⟨rfl, trivial⟩

/-- A finite execution package in which every selected event is replayable. -/
def package : ExecutionPackage signature where
  lts := lts
  configOf := fun
    | false => config 0
    | true => config 1
  replayKernel := replayKernel
  eventRecord := verifiedEvent
  eventEndpoints := by
    intro source event target step
    rcases step with ⟨eventEq, _observable⟩
    subst event
    cases source <;> cases target <;> exact ⟨rfl, rfl⟩
  stateVersion := by
    intro state
    cases state <;> rfl
  resourcesClear := fun _ => True
  sessionsQuiescent := fun _ => True
  deletionPermitted := fun _ => False
  deletion_requires_resources := by simp
  deletion_requires_quiescence := by simp
  ranking :=
    { internal := fun _ => False
      rank := fun _ => 0
      epoch := fun _ => 0
      decreases := by simp
      epoch_preserved := by simp }

noncomputable def transition : Bool → Bool → Real
  | false, false => 1 / 2
  | false, true => 1 / 2
  | true, false => 0
  | true, true => 1

/-- Forgetting event labels gives the same nontrivial two-state matrix. -/
noncomputable def stateKernel :
    NativeMarkovKernel signature package Bool where
  stateEquiv := Equiv.refl Bool
  probability := transition
  probability_nonnegative := by
    intro source target
    cases source <;> cases target <;> norm_num [transition]
  row_sum := by
    intro source
    cases source <;>
      rw [Fintype.sum_bool] <;>
      norm_num [transition]
  native_support_of_change := by
    intro source target _positive _different
    exact ⟨(source, target), native_step source target⟩

/-- The canonical event carried by a state pair is that ordered pair. -/
def totalLabelling :
    TotalNativeLabelling stateKernel where
  event := fun source target => (source, target)
  native := native_step

/-- Positive diagonal mass is now backed by actual holding events. -/
theorem fullySupported :
    FullyEventSupported stateKernel := by
  exact
    PositiveEventLabelling.nonempty_iff_fullyEventSupported.mp
      ⟨totalLabelling.toPositive⟩

noncomputable def initial : InitialDistribution Bool where
  probability
    | false => 1
    | true => 0
  probability_nonnegative := by
    intro state
    cases state <;> norm_num
  total := by
    rw [Fintype.sum_bool]
    norm_num

def window : StableFairWindow where
  signatureVersion := fun _ => 0
  observed := fun _ => True
  startEpoch := 0
  opportunityEpoch := id
  signature_stable := by simp
  opportunity_after_start := by simp
  opportunity_strictMono := strictMono_id
  opportunity_observed := by simp
  cofinal := by
    intro epoch _afterStart
    exact ⟨epoch, le_rfl⟩

def stable : Bool → Bool :=
  id

noncomputable def progress :
    ProgressBridge stateKernel initial (1 / 2 : Real) where
  window := window
  stable := stable
  epsilon_pos := by norm_num
  epsilon_le_one := by norm_num
  pointwise_progress := by
    intro state unstable
    cases state
    · change
        (1 / 2 : Real) ≤
          ∑ target ∈
            (Finset.univ.filter fun target : Bool => target = true),
            transition false target
      rw [Finset.sum_filter, Fintype.sum_bool]
      norm_num [transition]
    · exact False.elim (unstable rfl)

theorem alignment :
    EpochKernelAlignment totalLabelling progress.window where
  stable_state_version := by
    intro state
    cases state <;> rfl
  opportunity_noninternal := by
    intro source target
    change ¬False
    simp

noncomputable def eventProgress :
    EventProgressBridge stateKernel initial (1 / 2 : Real) where
  progress := progress
  labelling := totalLabelling
  alignment := alignment

/-- A representative path: unstable initially, then permanently stable. -/
def samplePath : Nat → Bool
  | 0 => false
  | _ + 1 => true

/-- The concrete package constructs trajectory agreement; no premise is given. -/
example :
    TotalNativeLabelling.TrajectoryAgreement
      totalLabelling samplePath :=
  totalLabelling.trajectoryAgreement samplePath

/-- The selected progress event independently replays to the stable config. -/
example :
    (package.eventRecord
      ((eventProgress.eventTrajectory samplePath).event 0)).Replays
      (package.configOf
        ((eventProgress.eventTrajectory samplePath).state 0))
      (package.configOf
        ((eventProgress.eventTrajectory samplePath).state 1)) :=
  (eventProgress.eventTrajectory samplePath).event_replays 0

/-- Finite prefixes retain the same replayable native steps. -/
example :
    ((eventProgress.eventTrajectory samplePath).finitePrefix 1).native
      ⟨0, by omega⟩ =
      native_step false true := by
  exact Subsingleton.elim _ _

/-- Event number `n` is assigned exactly epoch `n` in this fair schedule. -/
example (n : Nat) :
    eventEpoch window n = n :=
  rfl

/-- The same stable window aligns events, endpoint versions, and epoch times. -/
example :
    EpochAlignedTrajectory
      progress.window (eventProgress.eventTrajectory samplePath) :=
  eventProgress.eventTrajectory_epoch_aligned samplePath

private instance : MeasurableSpace Bool := ⊤

/--
The nontrivial finite execution package reaches stability almost surely on
the state projection of its replayable event trajectory.
-/
example :
    ∀ᵐ path
      ∂stateKernel.toMarkovExecutionKernel.trajectoryMeasure
        initial.toMeasure,
      progress.toKernelProgressAssumption.hittingBridge.EventuallyHits
        (TotalNativeLabelling.projectState
          (kernel := stateKernel) (eventProgress.eventTrajectory path)) :=
  eventProgress.replayable_event_trajectory_almost_sure_hitting

end

end Cantilune.Tests.EventTrajectory
