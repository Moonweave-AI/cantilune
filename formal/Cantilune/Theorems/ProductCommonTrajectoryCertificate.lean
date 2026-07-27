import Cantilune.Feedback.ProductCommonFMSTrajectory
import Cantilune.Theorems.CoreConformance

/-!
# Complete product/common-FMS trajectory certificates

This module is the generic composition boundary between a complete
`CoreConformancePackage` and one caller-supplied positive stochastic path.
It does not manufacture a product kernel, event labelling, path, registry
row, or FMS interpretation.

The selected path row is required to be the very same `candidate.event`
carried by the core package.  Its registry operation is the operation decoded
from the projected pi event by `piFMSAlignment.operational`; its metadata is
the canonical metadata decoded from the candidate's verified source
`DPOEvent`; and its two denotational endpoints are the actual normative
source and target Agents selected by that same alignment.
-/

noncomputable section

namespace Cantilune.Theorems.ProductCommonTrajectoryCertificate

open CategoryTheory
open Cantilune.Core
open Cantilune.Feedback.EventTrajectory.FiniteDiscrete
open Cantilune.Feedback.ProductCommonFMSTrajectory
open Cantilune.Feedback.StochasticExecution
open Cantilune.Feedback.StochasticExecution.FiniteDiscrete
open Cantilune.Pi
open Cantilune.Pi.FMSActualAgentNormativeOperationalBridge
open Cantilune.Pi.FMSActualAgentNormativeCommutation
open Cantilune.Theorems.CoreConformance
open Cantilune.Theorems.HeterogeneousProductRuleAdmission
open Cantilune.Theorems.ProductRuleProofBundle

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
    {P1bSource P1bTarget P1cSource P1cTarget : ObservableLTS}

/--
All data proving that one selected positive row is the core package's exact
candidate and exact actual-FMS row.
-/
structure CompleteProductCommonTrajectoryCertificate
    (certifiedPackage :
      CoreConformancePackage
        SourceCategory DagCategory PetriCategory PiCategory MorphismCategory
        source dagFamily petriFamily piFamily morphismFamily
        admission sourceSemantics sourceOccurrence signatureCertificate
        kernel initial epsilon RuleQualified RuleAuthorized candidate
        P1bSource P1bTarget P1cSource P1cTarget)
    (labelling : PositiveEventLabelling kernel)
    (fmsLabelling : ProductFMSLabelling labelling)
    (path : PositiveStatePath kernel)
    (agreement : labelling.TrajectoryAgreement path)
    (selected : Nat) where
  common :
    CommonFMSTrajectory
      labelling fmsLabelling path agreement
  selectedRow : NormativeRegistryRow
  selectedEvent :
    agreement.trajectory.event selected = candidate.event
  selectedSource :
    agreement.trajectory.state selected = candidate.before
  selectedTarget :
    agreement.trajectory.state (selected + 1) = candidate.after
  selectedMark :
    (common.row selected).mark = .normative selectedRow
  operationExact :
    selectedRow.operation =
      certifiedPackage.piFMSAlignment.operational.operation
        ((piFamily.operational newSignature).mapEvent candidate.event)
  metadataExact :
    selectedRow.metadata =
      certifiedPackage.piFMSAlignment.metadata
  sourceDenotation :
    (common.row selected).sourceDenotation =
      normativeSourceAgent certifiedPackage.piFMSAlignment.family
  targetDenotation :
    (common.row selected).targetDenotation =
      normativeTargetAgent certifiedPackage.piFMSAlignment.family

namespace CompleteProductCommonTrajectoryCertificate

variable
    {certifiedPackage :
      CoreConformancePackage
        SourceCategory DagCategory PetriCategory PiCategory MorphismCategory
        source dagFamily petriFamily piFamily morphismFamily
        admission sourceSemantics sourceOccurrence signatureCertificate
        kernel initial epsilon RuleQualified RuleAuthorized candidate
        P1bSource P1bTarget P1cSource P1cTarget}
    {labelling : PositiveEventLabelling kernel}
    {fmsLabelling : ProductFMSLabelling labelling}
    {path : PositiveStatePath kernel}
    {agreement : labelling.TrajectoryAgreement path}
    {selected : Nat}
    (certificate :
      CompleteProductCommonTrajectoryCertificate
        certifiedPackage labelling fmsLabelling path agreement selected)

/--
All candidate/FMS facts for the selected stochastic row, bundled with the
equalities that make the word "selected" load-bearing.

The individual projection and FMS facts below are properties of the package
candidate.  This record prevents a downstream theorem from citing one of
those facts while dropping the equalities that identify the selected path
row with that candidate.
-/
structure SelectedCandidateFMSEvidence : Prop where
  selectedCoordinates :
    agreement.trajectory.event selected = candidate.event ∧
      agreement.trajectory.state selected = candidate.before ∧
      agreement.trajectory.state (selected + 1) = candidate.after
  selectedRegistryMark :
    (certificate.common.row selected).mark =
      .normative certificate.selectedRow
  registryExact :
    certificate.selectedRow.operation =
        certifiedPackage.piFMSAlignment.operational.operation
          ((piFamily.operational newSignature).mapEvent candidate.event) ∧
      certificate.selectedRow.metadata =
        certifiedPackage.piFMSAlignment.metadata
  denotationsExact :
    (certificate.common.row selected).sourceDenotation =
        normativeSourceAgent certifiedPackage.piFMSAlignment.family ∧
      (certificate.common.row selected).targetDenotation =
        normativeTargetAgent certifiedPackage.piFMSAlignment.family
  candidateNative :
    (source.package newSignature).lts.ObservableStep
      candidate.before candidate.event candidate.after
  candidateReplay :
    ((source.package newSignature).eventRecord candidate.event).Replays
      ((source.package newSignature).configOf candidate.before)
      ((source.package newSignature).configOf candidate.after)
  projectedNative :
    (piFamily.target.package newSignature).lts.ObservableStep
      ((piFamily.operational newSignature).mapState candidate.before)
      ((piFamily.operational newSignature).mapEvent candidate.event)
      ((piFamily.operational newSignature).mapState candidate.after)
  registryRealizes :
    certifiedPackage.piFMSAlignment.operational.Realizes
      (ProductPiOperationalSemantics.stableMetadataOfDPOEvent
        ((source.package newSignature).eventRecord candidate.event).event)
      certifiedPackage.piFMSAlignment.projectedNative
  rawNative :
    Late.NativeStep
      (certifiedPackage.piFMSAlignment.operational.statePayload
        ((piFamily.operational newSignature).mapState candidate.before))
      (certifiedPackage.piFMSAlignment.operational.actionPayload
        ((piFamily.operational newSignature).mapEvent candidate.event))
      (certifiedPackage.piFMSAlignment.operational.statePayload
        ((piFamily.operational newSignature).mapState candidate.after))
  rawSource :
    Late.Struct
      (certifiedPackage.piFMSAlignment.operational.statePayload
        ((piFamily.operational newSignature).mapState candidate.before))
      (Cantilune.Pi.P1cFullNativeRefinement.readyProcess
        certifiedPackage.piFMSAlignment.family)
  rawDerivative :
    Cantilune.Pi.OpenSMCActionAlpha.DerivativeAlpha
      { action :=
          certifiedPackage.piFMSAlignment.operational.actionPayload
            ((piFamily.operational newSignature).mapEvent candidate.event)
        target :=
          certifiedPackage.piFMSAlignment.operational.statePayload
            ((piFamily.operational newSignature).mapState candidate.after) }
      { action :=
          Cantilune.Pi.P1cFullNativeRefinement.firstAction
            certifiedPackage.piFMSAlignment.family
        target :=
          Cantilune.Pi.P1cFullNativeRefinement.firstTarget
            certifiedPackage.piFMSAlignment.family }
  actualFMS :
    TotalCompiledNormativeCommutation
      certifiedPackage.piFMSAlignment.family

include certificate in
/-- The selected row's computed family is the core FMS family. -/
theorem familyExact :
    certificate.selectedRow.family =
      certifiedPackage.piFMSAlignment.family := by
  unfold
    Cantilune.Feedback.ProductCommonFMSTrajectory.NormativeRegistryRow.family
    ProductPiFMSAlignment.family
    ProductPiOperationalSemantics.family
  rw [certificate.operationExact]

include certificate in
/-- The common trajectory retains the core candidate's genuine native step. -/
theorem selectedNative :
    (source.package newSignature).lts.ObservableStep
      candidate.before candidate.event candidate.after := by
  simpa only [
    certificate.selectedSource,
    certificate.selectedEvent,
    certificate.selectedTarget] using
      (certificate.common.row selected).native

include certificate in
/-- The same selected row replays the core candidate's exact DPO endpoints. -/
theorem selectedReplay :
    ((source.package newSignature).eventRecord candidate.event).Replays
      ((source.package newSignature).configOf candidate.before)
      ((source.package newSignature).configOf candidate.after) := by
  simpa only [
    certificate.selectedSource,
    certificate.selectedEvent,
    certificate.selectedTarget] using
      (certificate.common.row selected).replay

include certificate in
/-- The selected source event also retains the core's projected pi step. -/
theorem selectedProjectedNative :
    (piFamily.target.package newSignature).lts.ObservableStep
      ((piFamily.operational newSignature).mapState candidate.before)
      ((piFamily.operational newSignature).mapEvent candidate.event)
      ((piFamily.operational newSignature).mapState candidate.after) := by
  have _selectedRowUsesCandidate := certificate.selectedEvent
  exact certifiedPackage.piFMSAlignment.projectedNative

include certificate in
/-- Canonical row metadata is inherited from the selected replay record. -/
theorem metadataFromSelectedReplay :
    certificate.selectedRow.metadata =
      canonicalStableMetadata
        ((source.package newSignature).eventRecord candidate.event).event := by
  have metadata := (certificate.common.row selected).metadataExact
  unfold EventMetadataAlignment at metadata
  rw [certificate.selectedMark] at metadata
  simpa only [certificate.selectedEvent] using metadata

include certificate in
/--
The selected row reuses the core alignment's genuine strong raw late-pi
transition; no second operational witness is introduced.
-/
theorem selectedRawNative :
    Late.NativeStep
      (certifiedPackage.piFMSAlignment.operational.statePayload
        ((piFamily.operational newSignature).mapState candidate.before))
      (certifiedPackage.piFMSAlignment.operational.actionPayload
        ((piFamily.operational newSignature).mapEvent candidate.event))
      (certifiedPackage.piFMSAlignment.operational.statePayload
        ((piFamily.operational newSignature).mapState candidate.after)) := by
  have _selectedRowUsesCandidate := certificate.selectedEvent
  exact certifiedPackage.piFMSAlignment.nativeRealization

include certificate in
/--
The enriched registry payload for the selected event is the exact payload
realizing the projected core step and canonical candidate metadata.
-/
theorem selectedRegistryRealizes :
    certifiedPackage.piFMSAlignment.operational.Realizes
      (ProductPiOperationalSemantics.stableMetadataOfDPOEvent
        ((source.package newSignature).eventRecord candidate.event).event)
      certifiedPackage.piFMSAlignment.projectedNative := by
  have _selectedRowUsesCandidate := certificate.selectedEvent
  exact certifiedPackage.piFMSAlignment.realizesProjected

include certificate in
/-- The raw source payload is the core family's canonical source up to Struct. -/
theorem selectedRawSource :
    Late.Struct
      (certifiedPackage.piFMSAlignment.operational.statePayload
        ((piFamily.operational newSignature).mapState candidate.before))
      (Cantilune.Pi.P1cFullNativeRefinement.readyProcess
        certifiedPackage.piFMSAlignment.family) := by
  have _selectedRowUsesCandidate := certificate.selectedEvent
  exact certifiedPackage.piFMSAlignment.source_to_family

include certificate in
/--
The raw action and derivative are jointly alpha-related to the same selected
family used by the actual-Agent endpoint equations.
-/
theorem selectedRawDerivative :
    Cantilune.Pi.OpenSMCActionAlpha.DerivativeAlpha
      ⟨certifiedPackage.piFMSAlignment.operational.actionPayload
          ((piFamily.operational newSignature).mapEvent candidate.event),
        certifiedPackage.piFMSAlignment.operational.statePayload
          ((piFamily.operational newSignature).mapState candidate.after)⟩
      ⟨Cantilune.Pi.P1cFullNativeRefinement.firstAction
          certifiedPackage.piFMSAlignment.family,
        Cantilune.Pi.P1cFullNativeRefinement.firstTarget
          certifiedPackage.piFMSAlignment.family⟩ := by
  have _selectedRowUsesCandidate := certificate.selectedEvent
  exact certifiedPackage.piFMSAlignment.derivative_to_family

include certificate in
/-- The selected family carries the core package's actual-Agent commutation. -/
theorem selectedActualFMS :
    TotalCompiledNormativeCommutation
      certifiedPackage.piFMSAlignment.family := by
  have _selectedRowUsesCandidate := certificate.selectedEvent
  exact certifiedPackage.piFMSAlignment.actual

include certificate in
/--
The complete selected-row evidence.  Unlike the compatibility accessors
above, this conclusion retains the coordinate, mark and registry equalities
beside every native/replay/FMS fact.
-/
theorem selectedCandidateFMSEvidence :
    SelectedCandidateFMSEvidence certificate where
  selectedCoordinates :=
    ⟨certificate.selectedEvent,
      certificate.selectedSource,
      certificate.selectedTarget⟩
  selectedRegistryMark := certificate.selectedMark
  registryExact := ⟨certificate.operationExact, certificate.metadataExact⟩
  denotationsExact :=
    ⟨certificate.sourceDenotation, certificate.targetDenotation⟩
  candidateNative := certificate.selectedNative
  candidateReplay := certificate.selectedReplay
  projectedNative := certifiedPackage.piFMSAlignment.projectedNative
  registryRealizes := certifiedPackage.piFMSAlignment.realizesProjected
  rawNative := certifiedPackage.piFMSAlignment.nativeRealization
  rawSource := certifiedPackage.piFMSAlignment.source_to_family
  rawDerivative := certifiedPackage.piFMSAlignment.derivative_to_family
  actualFMS := certifiedPackage.piFMSAlignment.actual

end CompleteProductCommonTrajectoryCertificate

end Cantilune.Theorems.ProductCommonTrajectoryCertificate
