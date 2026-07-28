import Cantilune.Feedback.ProductionKernelTrajectoryAgreement

/-!
Kernel-level regression checks for the supplied two-kernel coupling theorem.

These checks intentionally leave all production facts quantified.  They do
not create a fictional product package or replace either supplied kernel by
the deterministic replay scheduler.
-/

namespace Cantilune.Tests.ProductionKernelTrajectoryAgreement

open MeasureTheory
open Cantilune.Core
open Cantilune.Feedback.StochasticExecution.FiniteDiscrete
open Cantilune.Feedback.EventTrajectory.FiniteDiscrete
open Cantilune.Feedback.ProductionKernelTrajectoryAgreement

#check ProductionTrajectoryCoupling.independent
#check ProductionTrajectoryCoupling.left_ae_of_marginal
#check ProductionTrajectoryCoupling.right_ae_of_marginal
#check measurable_randomized_eventuallyHits
#check CompleteProductionTrajectoryAgreement
#check complete_production_trajectory_agreement_almost_sure

#print axioms ProductionTrajectoryCoupling.independent
#print axioms ProductionTrajectoryCoupling.left_ae_of_marginal
#print axioms ProductionTrajectoryCoupling.right_ae_of_marginal
#print axioms measurable_randomized_eventuallyHits
#print axioms complete_production_trajectory_agreement_almost_sure

universe uLeft uRight uLeftSeed uRightSeed uMark uAction

variable
    {leftSignature rightSignature : FinSignature}
    {leftPackage : ExecutionPackage leftSignature}
    {rightPackage : ExecutionPackage rightSignature}
    {LeftState : Type uLeft} [Fintype LeftState] [DecidableEq LeftState]
    [MeasurableSpace LeftState] [MeasurableSingletonClass LeftState]
    {RightState : Type uRight} [Fintype RightState] [DecidableEq RightState]
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
    {Action : Type uAction}
    {StateRelation : LeftState → RightState → Prop}
    (seam :
      ReplayMarkActionEpochSeam
        leftBridge leftSeedMeasure rightBridge rightSeedMeasure coupling
        Mark Action StateRelation)

example :
    ∀ᵐ sample ∂coupling.joint,
      CompleteProductionTrajectoryAgreement
        leftBridge leftSeedMeasure rightBridge rightSeedMeasure
        coupling seam sample :=
  complete_production_trajectory_agreement_almost_sure
    leftBridge leftSeedMeasure rightBridge rightSeedMeasure coupling seam

end Cantilune.Tests.ProductionKernelTrajectoryAgreement
