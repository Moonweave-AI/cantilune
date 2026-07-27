import Cantilune.Feedback.ProductionKernelTrajectoryAgreement
import Cantilune.Pi.FMSExactAcceptance

/-!
# A common exact-FMS seam for two genuine production kernels

`ProductionKernelTrajectoryAgreement` already couples two caller-supplied
Ionescu--Tulcea trajectory laws.  This module adds one further, deliberately
strict seam: both operational rows must be interpreted by the *same*
`ExactFMSAcceptancePackage`, and each native event must be equivalent to the
corresponding one-step denotational transition.

The conclusion is an almost-sure common trajectory whose:

* state paths come from the two supplied Markov kernels;
* event labels are the seed-selected native labels;
* every event independently replays its exact `DPOEvent` endpoints;
* every event is one transition in one common exact FMS package;
* consecutive denotational transitions share their endpoint literally; and
* related states in the coupling have equal denotations at every position.

No FMS package, production kernel, product rule, or coupling is manufactured
here.  They remain explicit inputs.
-/

noncomputable section

namespace Cantilune.Feedback.FMSProductionKernelTrajectoryAgreement

open MeasureTheory
open Cantilune.Core
open Cantilune.Pi
open Cantilune.Pi.FMSExternalPackage
open Cantilune.Pi.FMSExactAcceptance
open Cantilune.Feedback.Probability
open Cantilune.Feedback.StochasticExecution
open Cantilune.Feedback.StochasticExecution.FiniteDiscrete
open Cantilune.Feedback.EventTrajectory
open Cantilune.Feedback.EventTrajectory.FiniteDiscrete
open Cantilune.Feedback.ProductionKernelTrajectoryAgreement

universe uLeftState uRightState uLeftSeed uRightSeed uMark

variable
    {leftSignature rightSignature : FinSignature}
    {leftPackage : ExecutionPackage leftSignature}
    {rightPackage : ExecutionPackage rightSignature}
    {LeftState : Type uLeftState}
    [Fintype LeftState] [DecidableEq LeftState]
    [MeasurableSpace LeftState] [MeasurableSingletonClass LeftState]
    {RightState : Type uRightState}
    [Fintype RightState] [DecidableEq RightState]
    [MeasurableSpace RightState] [MeasurableSingletonClass RightState]
    {LeftSeed : Type uLeftSeed} [MeasurableSpace LeftSeed]
    {RightSeed : Type uRightSeed} [MeasurableSpace RightSeed]
    {leftKernel :
      NativeMarkovKernel leftSignature leftPackage LeftState}
    {rightKernel :
      NativeMarkovKernel rightSignature rightPackage RightState}
    {leftInitial : InitialDistribution LeftState}
    {rightInitial : InitialDistribution RightState}
    {leftEpsilon rightEpsilon : Real}

section CommonFMS

variable
    (leftBridge :
      RandomEventProgressBridge
        leftKernel leftInitial leftEpsilon LeftSeed)
    (leftSeedMeasure : Measure (Nat → LeftSeed))
    [IsProbabilityMeasure leftSeedMeasure]
    (rightBridge :
      RandomEventProgressBridge
        rightKernel rightInitial rightEpsilon RightSeed)
    (rightSeedMeasure : Measure (Nat → RightSeed))
    [IsProbabilityMeasure rightSeedMeasure]
    (coupling :
      ProductionTrajectoryCoupling
        leftBridge leftSeedMeasure rightBridge rightSeedMeasure)
    {Mark : Type uMark}
    {StateRelation : LeftState → RightState → Prop}
    (operationalSeam :
      ReplayMarkActionEpochSeam
        leftBridge leftSeedMeasure rightBridge rightSeedMeasure coupling
        Mark Raw.Action StateRelation)

/--
The exact semantic evidence needed to use a single FMS package for both
production rows.

The two `native_iff` fields are intentionally equivalences, not merely
soundness implications.  They prevent either operational row from acquiring
extra target events that are absent from the common FMS transition system.
-/
structure CommonExactFMSSemanticSeam where
  fms : ExactFMSAcceptancePackage
  leftProcess : leftPackage.lts.State → ClosedRaw
  rightProcess : rightPackage.lts.State → ClosedRaw
  left_native_iff :
    ∀ {source event target},
      leftPackage.lts.ObservableStep source event target ↔
        fms.base.lateFullAbstraction.transition
          (fms.base.lateFullAbstraction.denote (leftProcess source))
          (operationalSeam.leftAction event)
          (fms.base.lateFullAbstraction.denote (leftProcess target))
  right_native_iff :
    ∀ {source event target},
      rightPackage.lts.ObservableStep source event target ↔
        fms.base.lateFullAbstraction.transition
          (fms.base.lateFullAbstraction.denote (rightProcess source))
          (operationalSeam.rightAction event)
          (fms.base.lateFullAbstraction.denote (rightProcess target))
  related_denotation :
    ∀ {leftState rightState},
      StateRelation leftState rightState →
        fms.base.lateFullAbstraction.denote
            (leftProcess (leftKernel.stateEquiv leftState)) =
          fms.base.lateFullAbstraction.denote
            (rightProcess (rightKernel.stateEquiv rightState))

variable
    (semanticSeam :
      CommonExactFMSSemanticSeam
        leftBridge leftSeedMeasure rightBridge rightSeedMeasure
        coupling operationalSeam)

/-- The left sampled state path interpreted in the common agent domain. -/
def leftDenotationPath
    (sample :
      CoupledTrajectorySample
        LeftState LeftSeed RightState RightSeed) :
    Nat → semanticSeam.fms.base.domain.agent.obj 0 :=
  fun n =>
    semanticSeam.fms.base.lateFullAbstraction.denote
      (semanticSeam.leftProcess
        ((RandomizedEventPath.trajectory leftBridge sample.1).state n))

/-- The right sampled state path interpreted in the same agent domain. -/
def rightDenotationPath
    (sample :
      CoupledTrajectorySample
        LeftState LeftSeed RightState RightSeed) :
    Nat → semanticSeam.fms.base.domain.agent.obj 0 :=
  fun n =>
    semanticSeam.fms.base.lateFullAbstraction.denote
      (semanticSeam.rightProcess
        ((RandomizedEventPath.trajectory rightBridge sample.2).state n))

/-- The exact FMS action selected by the left event stream. -/
def leftActionPath
    (sample :
      CoupledTrajectorySample
        LeftState LeftSeed RightState RightSeed) :
    Nat → Raw.Action :=
  fun n =>
    operationalSeam.leftAction
      ((RandomizedEventPath.trajectory leftBridge sample.1).event n)

/-- The exact FMS action selected by the right event stream. -/
def rightActionPath
    (sample :
      CoupledTrajectorySample
        LeftState LeftSeed RightState RightSeed) :
    Nat → Raw.Action :=
  fun n =>
    operationalSeam.rightAction
      ((RandomizedEventPath.trajectory rightBridge sample.2).event n)

/--
The common-FMS strengthening of the event-level production agreement.

The transition endpoints are expressed through `leftDenotationPath` and
`rightDenotationPath`.  Consequently the target at position `n` is
definitionally the source at position `n+1`; no separate endpoint gluing
assumption is present.
-/
structure CompleteCommonFMSProductionAgreement
    (sample :
      CoupledTrajectorySample
        LeftState LeftSeed RightState RightSeed) : Prop where
  operational :
    CompleteProductionTrajectoryAgreement
      leftBridge leftSeedMeasure rightBridge rightSeedMeasure
      coupling operationalSeam sample
  left_fms :
    ∀ n,
      semanticSeam.fms.base.lateFullAbstraction.transition
        (leftDenotationPath
          (leftBridge := leftBridge)
          (leftSeedMeasure := leftSeedMeasure)
          (rightBridge := rightBridge)
          (rightSeedMeasure := rightSeedMeasure)
          (coupling := coupling)
          (operationalSeam := operationalSeam)
          (semanticSeam := semanticSeam) sample n)
        (leftActionPath
          (leftBridge := leftBridge)
          (leftSeedMeasure := leftSeedMeasure)
          (rightBridge := rightBridge)
          (rightSeedMeasure := rightSeedMeasure)
          (coupling := coupling)
          (operationalSeam := operationalSeam) sample n)
        (leftDenotationPath
          (leftBridge := leftBridge)
          (leftSeedMeasure := leftSeedMeasure)
          (rightBridge := rightBridge)
          (rightSeedMeasure := rightSeedMeasure)
          (coupling := coupling)
          (operationalSeam := operationalSeam)
          (semanticSeam := semanticSeam) sample (n + 1))
  right_fms :
    ∀ n,
      semanticSeam.fms.base.lateFullAbstraction.transition
        (rightDenotationPath
          (leftBridge := leftBridge)
          (leftSeedMeasure := leftSeedMeasure)
          (rightBridge := rightBridge)
          (rightSeedMeasure := rightSeedMeasure)
          (coupling := coupling)
          (operationalSeam := operationalSeam)
          (semanticSeam := semanticSeam) sample n)
        (rightActionPath
          (leftBridge := leftBridge)
          (leftSeedMeasure := leftSeedMeasure)
          (rightBridge := rightBridge)
          (rightSeedMeasure := rightSeedMeasure)
          (coupling := coupling)
          (operationalSeam := operationalSeam) sample n)
        (rightDenotationPath
          (leftBridge := leftBridge)
          (leftSeedMeasure := leftSeedMeasure)
          (rightBridge := rightBridge)
          (rightSeedMeasure := rightSeedMeasure)
          (coupling := coupling)
          (operationalSeam := operationalSeam)
          (semanticSeam := semanticSeam) sample (n + 1))
  common_action :
    ∀ n,
      leftActionPath
          (leftBridge := leftBridge)
          (leftSeedMeasure := leftSeedMeasure)
          (rightBridge := rightBridge)
          (rightSeedMeasure := rightSeedMeasure)
          (coupling := coupling)
          (operationalSeam := operationalSeam) sample n =
        rightActionPath
          (leftBridge := leftBridge)
          (leftSeedMeasure := leftSeedMeasure)
          (rightBridge := rightBridge)
          (rightSeedMeasure := rightSeedMeasure)
          (coupling := coupling)
          (operationalSeam := operationalSeam) sample n
  common_denotation :
    ∀ n,
      leftDenotationPath
          (leftBridge := leftBridge)
          (leftSeedMeasure := leftSeedMeasure)
          (rightBridge := rightBridge)
          (rightSeedMeasure := rightSeedMeasure)
          (coupling := coupling)
          (operationalSeam := operationalSeam)
          (semanticSeam := semanticSeam) sample n =
        rightDenotationPath
          (leftBridge := leftBridge)
          (leftSeedMeasure := leftSeedMeasure)
          (rightBridge := rightBridge)
          (rightSeedMeasure := rightSeedMeasure)
          (coupling := coupling)
          (operationalSeam := operationalSeam)
          (semanticSeam := semanticSeam) sample n

/--
Two consecutive left transitions use the same path member as the first
target and second source.  The sharing is enforced by the statement's type,
not by a caller-supplied equality.
-/
theorem left_consecutive_fms
    (agreement :
      CompleteCommonFMSProductionAgreement
        leftBridge leftSeedMeasure rightBridge rightSeedMeasure
        coupling operationalSeam semanticSeam sample)
    (n : Nat) :
    semanticSeam.fms.base.lateFullAbstraction.transition
        (leftDenotationPath
          (leftBridge := leftBridge)
          (leftSeedMeasure := leftSeedMeasure)
          (rightBridge := rightBridge)
          (rightSeedMeasure := rightSeedMeasure)
          (coupling := coupling)
          (operationalSeam := operationalSeam)
          (semanticSeam := semanticSeam) sample n)
        (leftActionPath
          (leftBridge := leftBridge)
          (leftSeedMeasure := leftSeedMeasure)
          (rightBridge := rightBridge)
          (rightSeedMeasure := rightSeedMeasure)
          (coupling := coupling)
          (operationalSeam := operationalSeam) sample n)
        (leftDenotationPath
          (leftBridge := leftBridge)
          (leftSeedMeasure := leftSeedMeasure)
          (rightBridge := rightBridge)
          (rightSeedMeasure := rightSeedMeasure)
          (coupling := coupling)
          (operationalSeam := operationalSeam)
          (semanticSeam := semanticSeam) sample (n + 1)) ∧
      semanticSeam.fms.base.lateFullAbstraction.transition
        (leftDenotationPath
          (leftBridge := leftBridge)
          (leftSeedMeasure := leftSeedMeasure)
          (rightBridge := rightBridge)
          (rightSeedMeasure := rightSeedMeasure)
          (coupling := coupling)
          (operationalSeam := operationalSeam)
          (semanticSeam := semanticSeam) sample (n + 1))
        (leftActionPath
          (leftBridge := leftBridge)
          (leftSeedMeasure := leftSeedMeasure)
          (rightBridge := rightBridge)
          (rightSeedMeasure := rightSeedMeasure)
          (coupling := coupling)
          (operationalSeam := operationalSeam) sample (n + 1))
        (leftDenotationPath
          (leftBridge := leftBridge)
          (leftSeedMeasure := leftSeedMeasure)
          (rightBridge := rightBridge)
          (rightSeedMeasure := rightSeedMeasure)
          (coupling := coupling)
          (operationalSeam := operationalSeam)
          (semanticSeam := semanticSeam) sample (n + 2)) :=
  ⟨agreement.left_fms n, by
    simpa [Nat.add_assoc] using (agreement.left_fms (n + 1))⟩

/-- The analogous pair of consecutive transitions on the right FMS path. -/
theorem right_consecutive_fms
    (agreement :
      CompleteCommonFMSProductionAgreement
        leftBridge leftSeedMeasure rightBridge rightSeedMeasure
        coupling operationalSeam semanticSeam sample)
    (n : Nat) :
    semanticSeam.fms.base.lateFullAbstraction.transition
        (rightDenotationPath
          (leftBridge := leftBridge)
          (leftSeedMeasure := leftSeedMeasure)
          (rightBridge := rightBridge)
          (rightSeedMeasure := rightSeedMeasure)
          (coupling := coupling)
          (operationalSeam := operationalSeam)
          (semanticSeam := semanticSeam) sample n)
        (rightActionPath
          (leftBridge := leftBridge)
          (leftSeedMeasure := leftSeedMeasure)
          (rightBridge := rightBridge)
          (rightSeedMeasure := rightSeedMeasure)
          (coupling := coupling)
          (operationalSeam := operationalSeam) sample n)
        (rightDenotationPath
          (leftBridge := leftBridge)
          (leftSeedMeasure := leftSeedMeasure)
          (rightBridge := rightBridge)
          (rightSeedMeasure := rightSeedMeasure)
          (coupling := coupling)
          (operationalSeam := operationalSeam)
          (semanticSeam := semanticSeam) sample (n + 1)) ∧
      semanticSeam.fms.base.lateFullAbstraction.transition
        (rightDenotationPath
          (leftBridge := leftBridge)
          (leftSeedMeasure := leftSeedMeasure)
          (rightBridge := rightBridge)
          (rightSeedMeasure := rightSeedMeasure)
          (coupling := coupling)
          (operationalSeam := operationalSeam)
          (semanticSeam := semanticSeam) sample (n + 1))
        (rightActionPath
          (leftBridge := leftBridge)
          (leftSeedMeasure := leftSeedMeasure)
          (rightBridge := rightBridge)
          (rightSeedMeasure := rightSeedMeasure)
          (coupling := coupling)
          (operationalSeam := operationalSeam) sample (n + 1))
        (rightDenotationPath
          (leftBridge := leftBridge)
          (leftSeedMeasure := leftSeedMeasure)
          (rightBridge := rightBridge)
          (rightSeedMeasure := rightSeedMeasure)
          (coupling := coupling)
          (operationalSeam := operationalSeam)
          (semanticSeam := semanticSeam) sample (n + 2)) :=
  ⟨agreement.right_fms n, by
    simpa [Nat.add_assoc] using (agreement.right_fms (n + 1))⟩

/--
Almost-sure common-FMS agreement for two genuine caller-supplied production
kernels.

The probability law is exactly `coupling.joint`; neither marginal is replaced
by deterministic replay.  All product-specific semantic facts occur in
`operationalSeam` and `semanticSeam`.
-/
theorem complete_common_fms_production_agreement_almost_sure :
    ∀ᵐ sample ∂coupling.joint,
      CompleteCommonFMSProductionAgreement
        leftBridge leftSeedMeasure rightBridge rightSeedMeasure
        coupling operationalSeam semanticSeam sample := by
  filter_upwards
    [complete_production_trajectory_agreement_almost_sure
      leftBridge leftSeedMeasure rightBridge rightSeedMeasure
      coupling operationalSeam] with sample agreement
  refine
    { operational := agreement
      left_fms := ?_
      right_fms := ?_
      common_action := agreement.actions_agree
      common_denotation := ?_ }
  · intro n
    exact
      semanticSeam.left_native_iff.mp
        (agreement.left_native n)
  · intro n
    exact
      semanticSeam.right_native_iff.mp
        (agreement.right_native n)
  · intro n
    change
      semanticSeam.fms.base.lateFullAbstraction.denote
          (semanticSeam.leftProcess
            (leftKernel.stateEquiv (sample.1.1 n))) =
        semanticSeam.fms.base.lateFullAbstraction.denote
          (semanticSeam.rightProcess
            (rightKernel.stateEquiv (sample.2.1 n)))
    exact semanticSeam.related_denotation (agreement.states_related n)

end CommonFMS

end Cantilune.Feedback.FMSProductionKernelTrajectoryAgreement
