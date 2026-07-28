import Cantilune.Theorems.FiniteCrossEpochProductChain
import Cantilune.Feedback.FiniteHeterogeneousFourProjection
import Cantilune.Feedback.FiniteHeterogeneousRandomKernel

/-!
# Event-level probability bridge for finite certified product chains

This module connects `FiniteCrossEpochProductChain` to the existing
heterogeneous trajectory and probability layers.

There are two honest probability interfaces:

* `suppliedKernel_common_trajectory_almost_sure` accepts a caller-supplied
  source phase kernel with the existing probability-one successor contract;
* `marked_common_trajectory_almost_sure` uses the existing canonical marked
  replay kernel, so every sampled nonterminal edge retains its actual
  dependent source mark and four native projected derivations.

The target-view phase paths are the canonical paths of their already
certified replay chains.  This is a coupling on the source probability space,
not a claim that arbitrary product kernels have been coupled.  Positive
epsilon, fairness, authorization, and stable-window assumptions are neither
constructed nor inferred here; production packages must continue to supply
them separately.
-/

noncomputable section

namespace Cantilune.Feedback.FiniteCrossEpochProductTrajectory

open MeasureTheory
open Cantilune.Core
open Cantilune.Core.ExecutionEpochTrace
open Cantilune.Theorems
open Cantilune.Feedback.FiniteHeterogeneousTrajectory
open Cantilune.Feedback.FiniteHeterogeneousProbability
open Cantilune.Feedback.FiniteHeterogeneousMarkedKernel
open Cantilune.Feedback.FiniteHeterogeneousFourProjection
open Cantilune.Feedback.FiniteHeterogeneousRandomKernel

variable {universes : ProjectionUniverses}
variable {first last : FourProjectionReplayEpoch}

/-- The exact operational four-projection certificate stored by one row. -/
def fourCertificate (epoch : FourProjectionReplayEpoch) :
    FourProjectionCertificate epoch.source.package.lts where
  dagLTS := epoch.dag.package.lts
  petriLTS := epoch.petri.package.lts
  piLTS := epoch.pi.package.lts
  morphismLTS := epoch.morphism.package.lts
  dag := epoch.dagProjection
  petri := epoch.petriProjection
  pi := epoch.piProjection
  morphism := epoch.morphismProjection

namespace FiniteCrossEpochProductChain

/--
The per-epoch four-projection assignment computed from the synchronized
product rows.
-/
def projectionAssignment :
    {first last : FourProjectionReplayEpoch} →
      (chain : FiniteCrossEpochProductChain universes first last) →
        ChainFourProjectionAssignment chain.sourceChain
  | _, _, .single epoch =>
      .single (fourCertificate epoch)
  | _, _, @Cantilune.Theorems.FiniteCrossEpochProductChain.cons
      _ first _middle _last _boundary tail =>
      .cons (fourCertificate first) (projectionAssignment tail)

/-- Complete deterministic trace/replay agreement in all five views. -/
structure FiveTraceAgreement
    (chain : FiniteCrossEpochProductChain universes first last) : Prop where
  source : ChainTraceAgreement chain.sourceChain
  dag : ChainTraceAgreement chain.dagChain
  petri : ChainTraceAgreement chain.petriChain
  pi : ChainTraceAgreement chain.piChain
  morphism : ChainTraceAgreement chain.morphismChain

theorem fiveTraceAgreement
    (chain : FiniteCrossEpochProductChain universes first last) :
    FiveTraceAgreement chain where
  source := complete_chain_trace_agreement chain.sourceChain
  dag := complete_chain_trace_agreement chain.dagChain
  petri := complete_chain_trace_agreement chain.petriChain
  pi := complete_chain_trace_agreement chain.piChain
  morphism := complete_chain_trace_agreement chain.morphismChain

/-- All five synchronized traces contain the same number of genuine labels. -/
theorem eventCountsAligned
    (chain : FiniteCrossEpochProductChain universes first last) :
    eventCount chain.sourceChain = eventCount chain.dagChain ∧
      eventCount chain.sourceChain = eventCount chain.petriChain ∧
      eventCount chain.sourceChain = eventCount chain.piChain ∧
      eventCount chain.sourceChain = eventCount chain.morphismChain := by
  induction chain with
  | single epoch =>
      simp [Cantilune.Theorems.FiniteCrossEpochProductChain.sourceChain,
        Cantilune.Theorems.FiniteCrossEpochProductChain.dagChain,
        Cantilune.Theorems.FiniteCrossEpochProductChain.petriChain,
        Cantilune.Theorems.FiniteCrossEpochProductChain.piChain,
        Cantilune.Theorems.FiniteCrossEpochProductChain.morphismChain,
        eventCount, traceEvents, epoch.dagEvents, epoch.petriEvents,
        epoch.piEvents, epoch.morphismEvents]
  | @cons first middle last boundary tail ih =>
      simpa [Cantilune.Theorems.FiniteCrossEpochProductChain.sourceChain,
        Cantilune.Theorems.FiniteCrossEpochProductChain.dagChain,
        Cantilune.Theorems.FiniteCrossEpochProductChain.petriChain,
        Cantilune.Theorems.FiniteCrossEpochProductChain.piChain,
        Cantilune.Theorems.FiniteCrossEpochProductChain.morphismChain,
        eventCount, traceEvents, first.dagEvents, first.petriEvents,
        first.piEvents, first.morphismEvents] using ih

/-- Pointwise execution-epoch numbers agree in all five synchronized rows. -/
inductive AllExecutionEpochsAligned :
    {first last : FourProjectionReplayEpoch} →
      FiniteCrossEpochProductChain universes first last → Prop
  | single (epoch : FourProjectionReplayEpoch)
      (dag :
        epoch.dag.epoch.executionEpoch =
          epoch.source.epoch.executionEpoch)
      (petri :
        epoch.petri.epoch.executionEpoch =
          epoch.source.epoch.executionEpoch)
      (pi :
        epoch.pi.epoch.executionEpoch =
          epoch.source.epoch.executionEpoch)
      (morphism :
        epoch.morphism.epoch.executionEpoch =
          epoch.source.epoch.executionEpoch) :
      AllExecutionEpochsAligned (.single epoch)
  | cons {first middle last : FourProjectionReplayEpoch}
      (boundary : FiveViewBoundary universes first middle)
      (tail : FiniteCrossEpochProductChain universes middle last)
      (dag :
        first.dag.epoch.executionEpoch =
          first.source.epoch.executionEpoch)
      (petri :
        first.petri.epoch.executionEpoch =
          first.source.epoch.executionEpoch)
      (pi :
        first.pi.epoch.executionEpoch =
          first.source.epoch.executionEpoch)
      (morphism :
        first.morphism.epoch.executionEpoch =
          first.source.epoch.executionEpoch)
      (tailAligned : AllExecutionEpochsAligned tail) :
      AllExecutionEpochsAligned (.cons boundary tail)

theorem allExecutionEpochsAligned
    (chain : FiniteCrossEpochProductChain universes first last) :
    AllExecutionEpochsAligned chain := by
  induction chain with
  | single epoch =>
      exact
        .single epoch epoch.dagExecutionEpoch epoch.petriExecutionEpoch
          epoch.piExecutionEpoch epoch.morphismExecutionEpoch
  | @cons first middle last boundary tail ih =>
      exact
        .cons boundary tail first.dagExecutionEpoch
          first.petriExecutionEpoch first.piExecutionEpoch
          first.morphismExecutionEpoch ih

/-- Canonical target phase path used in the source-space coupling. -/
def canonicalPhasePath
    {first last : SomeReplayEpoch}
    (chain : EpochChain universes first last) :
    Nat → Phase chain :=
  phaseAt chain

theorem canonicalPhaseTrajectory
    {first last : SomeReplayEpoch}
    (chain : EpochChain universes first last) :
    CompleteFiniteChainTrajectory chain (canonicalPhasePath chain) :=
  completeFiniteChainTrajectory chain (canonicalPhasePath chain) (fun _ => rfl)

/--
Five event-labelled trajectories coupled on a caller-supplied source phase
path.  Target paths are canonical because only the source kernel is supplied.
-/
structure FivePhaseCommonTrajectory
    (chain : FiniteCrossEpochProductChain universes first last)
    (sourcePath : Nat → Phase chain.sourceChain) : Prop where
  source :
    CompleteFiniteChainTrajectory chain.sourceChain sourcePath
  dag :
    CompleteFiniteChainTrajectory chain.dagChain
      (canonicalPhasePath chain.dagChain)
  petri :
    CompleteFiniteChainTrajectory chain.petriChain
      (canonicalPhasePath chain.petriChain)
  pi :
    CompleteFiniteChainTrajectory chain.piChain
      (canonicalPhasePath chain.piChain)
  morphism :
    CompleteFiniteChainTrajectory chain.morphismChain
      (canonicalPhasePath chain.morphismChain)
  counts :
    eventCount chain.sourceChain = eventCount chain.dagChain ∧
      eventCount chain.sourceChain = eventCount chain.petriChain ∧
      eventCount chain.sourceChain = eventCount chain.piChain ∧
      eventCount chain.sourceChain = eventCount chain.morphismChain
  epochs : AllExecutionEpochsAligned chain
  composition : chain.CompleteAgreement

/-- Construct the common phase package from one complete source path. -/
theorem fivePhaseCommonTrajectory
    (chain : FiniteCrossEpochProductChain universes first last)
    (sourcePath : Nat → Phase chain.sourceChain)
    (sourceComplete :
      CompleteFiniteChainTrajectory chain.sourceChain sourcePath) :
    FivePhaseCommonTrajectory chain sourcePath where
  source := sourceComplete
  dag := canonicalPhaseTrajectory chain.dagChain
  petri := canonicalPhaseTrajectory chain.petriChain
  pi := canonicalPhaseTrajectory chain.piChain
  morphism := canonicalPhaseTrajectory chain.morphismChain
  counts := eventCountsAligned chain
  epochs := allExecutionEpochsAligned chain
  composition := chain.composeComplete

/--
Any supplied source phase kernel satisfying the existing probability-one
successor contract yields the five-view common trajectory almost surely.
-/
theorem suppliedKernel_common_trajectory_almost_sure
    (chain : FiniteCrossEpochProductChain universes first last)
    (kernel :
      AlmostSureSuccessorPhaseKernel chain.sourceChain) :
    ∀ᵐ path ∂
        kernel.semantics.trajectoryMeasure
          (FiniteHeterogeneousProbability.initial chain.sourceChain),
      FivePhaseCommonTrajectory chain path := by
  filter_upwards [kernel.common_trajectory_almost_sure] with path sourceComplete
  exact fivePhaseCommonTrajectory chain path sourceComplete

/--
Common evidence on one sampled path of the canonical source marked kernel.
Every nonterminal source mark has its four native target derivations, while
all five full traces retain replay and epoch evidence.
-/
structure FiveMarkedCommonTrajectory
    (chain : FiniteCrossEpochProductChain universes first last)
    (path : Nat → MarkedState chain.sourceChain) : Prop where
  phases :
    FivePhaseCommonTrajectory chain (fun n => (path n).phase)
  sampled :
    ∀ (n : Nat) (before : n < eventCount chain.sourceChain),
      Nonempty
        (CompleteProjectedSampledEdge
          chain.sourceChain (projectionAssignment chain)
          n before (path n) (path (n + 1)))

/--
Almost every canonical marked source path is a replay-preserving,
epoch-aligned, event-labelled common trajectory for the five synchronized
chains.
-/
theorem marked_common_trajectory_almost_sure
    (chain : FiniteCrossEpochProductChain universes first last) :
    ∀ᵐ path ∂
        (markedKernel chain.sourceChain).toMarkovExecutionKernel
          |>.trajectoryMeasure
            (FiniteHeterogeneousMarkedKernel.initial chain.sourceChain),
      FiveMarkedCommonTrajectory chain path := by
  filter_upwards
    [trajectory_ae_eq_marked_atPhase chain.sourceChain,
      four_projection_common_trajectory_almost_sure
        chain.sourceChain (projectionAssignment chain)] with path schedule sampled
  have phaseSchedule :
      ∀ n, (path n).phase = phaseAt chain.sourceChain n := by
    intro n
    rw [schedule n]
    rfl
  exact
    { phases :=
        fivePhaseCommonTrajectory chain
          (fun n => (path n).phase)
          (completeFiniteChainTrajectory chain.sourceChain
            (fun n => (path n).phase) phaseSchedule)
      sampled := sampled }

end FiniteCrossEpochProductChain

/-! ## Direct adapter for one existing certified product-family row -/

namespace CrossEpochProductFamily

open CategoryTheory
open Cantilune.Feedback.StochasticExecution.FiniteDiscrete
open Cantilune.Theorems.ProductRuleProofBundle
open Cantilune.Theorems.HeterogeneousProductRuleAdmission

universe u v w

variable
    {SourceCategory DagCategory PetriCategory PiCategory MorphismCategory :
      Type u}
    [Category.{v} SourceCategory]
    [MonoidalCategory SourceCategory] [SymmetricCategory SourceCategory]
    [Category.{v} DagCategory]
    [MonoidalCategory DagCategory] [SymmetricCategory DagCategory]
    [Category.{v} PetriCategory]
    [MonoidalCategory PetriCategory] [SymmetricCategory PetriCategory]
    [Category.{v} PiCategory]
    [MonoidalCategory PiCategory] [SymmetricCategory PiCategory]
    [Category.{v} MorphismCategory]
    [MonoidalCategory MorphismCategory] [SymmetricCategory MorphismCategory]
    {source : ReindexableExecutionFamily}
    {dagFamily :
      ProjectionFamilyOver SourceCategory DagCategory source}
    {petriFamily :
      ProjectionFamilyOver SourceCategory PetriCategory source}
    {piFamily :
      ProjectionFamilyOver SourceCategory PiCategory source}
    {morphismFamily :
      ProjectionFamilyOver SourceCategory MorphismCategory source}
    {universes : ProjectionUniverses}
    {oldSignature newSignature : FinSignature}
    {admission :
      SignatureAdmissionEvent universes
        (source := oldSignature) (target := newSignature)}
    {sourceSemantics :
      HeterogeneousAdmissionLTS
        (source.package oldSignature)
        (source.package newSignature)}
    {sourceOccurrence :
      HeterogeneousPackageAdmission
        (source.package oldSignature)
        (source.package newSignature)
        sourceSemantics admission}
    {signatureCertificate :
      FourCoherentFamilyAdmission
        SourceCategory DagCategory PetriCategory PiCategory MorphismCategory
        source dagFamily petriFamily piFamily morphismFamily
        admission sourceSemantics sourceOccurrence}
    {KernelState : Type w} [Fintype KernelState] [DecidableEq KernelState]
    {kernel :
      NativeMarkovKernel newSignature
        (source.package newSignature) KernelState}
    {initial : InitialDistribution KernelState}
    {epsilon : Real}
    {RuleQualified RuleAuthorized :
      (source.package newSignature).lts.State →
        (source.package newSignature).lts.Event →
        (source.package newSignature).lts.State → Prop}
    {candidate : Candidate (source.package newSignature)}

variable
    (family :
      Cantilune.Theorems.CrossEpochProductFamily
        SourceCategory DagCategory PetriCategory PiCategory MorphismCategory
        source dagFamily petriFamily piFamily morphismFamily
        admission sourceSemantics sourceOccurrence signatureCertificate
        kernel initial epsilon RuleQualified RuleAuthorized candidate)

include family

/--
The existing concrete row adapter feeds directly into the marked common
trajectory theorem; admission labels come from its actual
`HeterogeneousAdmissionProjection`.
-/
theorem marked_common_trajectory_almost_sure :
    ∀ᵐ path ∂
        (markedKernel family.toFiniteChain.sourceChain).toMarkovExecutionKernel
          |>.trajectoryMeasure
            (FiniteHeterogeneousMarkedKernel.initial
              family.toFiniteChain.sourceChain),
      FiniteCrossEpochProductChain.FiveMarkedCommonTrajectory
        family.toFiniteChain path :=
  FiniteCrossEpochProductChain.marked_common_trajectory_almost_sure
    family.toFiniteChain

/-- Direct adapter for a caller-supplied probability-one source phase kernel. -/
theorem suppliedKernel_common_trajectory_almost_sure
    (phaseKernel :
      AlmostSureSuccessorPhaseKernel family.toFiniteChain.sourceChain) :
    ∀ᵐ path ∂
        phaseKernel.semantics.trajectoryMeasure
          (FiniteHeterogeneousProbability.initial
            family.toFiniteChain.sourceChain),
      FiniteCrossEpochProductChain.FivePhaseCommonTrajectory
        family.toFiniteChain path :=
  FiniteCrossEpochProductChain.suppliedKernel_common_trajectory_almost_sure
    family.toFiniteChain phaseKernel

end CrossEpochProductFamily

end Cantilune.Feedback.FiniteCrossEpochProductTrajectory
