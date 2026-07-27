import Cantilune.Pi.P1bNominalIncidenceClosure
import Cantilune.Pi.P1cEnrichedStructuralCertificate
import Cantilune.Theorems.ProductCommonTrajectoryCertificate

/-!
# Global P1b plus candidate-indexed P1c/common-trajectory bridge

`CoreConformancePackage` deliberately keeps P1b and P1c as reusable
projection certificates.  That generality permits a caller to choose native
occurrences independently of the product candidate.  This module closes that
last composition seam for the canonical Cantilune protocol calculi.

The P1b request/accept occurrence is *not* identified with a reconnect DPO
event: the current P1b source LTS has no product session or correlation
metadata.  The record therefore retains P1b only as the globally reusable
request/accept sublanguage certificate and canonical establishment witness;
it does not claim a P1b-to-product causal seam.  The P1c occurrence is indexed by
the exact normative family decoded from the package candidate's 60-operation
registry row.  The same record also retains the product candidate's raw
strong late-pi step, joint derivative alpha cell, heterogeneous admission
seam, actual-Agent endpoints, and selected stochastic row.

Thus no theorem in this file equates distinct phase events, and no product can
close the final theorem by pairing an unrelated P1c witness with its common
trajectory.
-/

noncomputable section

namespace Cantilune.Theorems.ProductProtocolTrajectoryBridge

open CategoryTheory
open Cantilune.Core
open Cantilune.Feedback.EventTrajectory.FiniteDiscrete
open Cantilune.Feedback.ProductCommonFMSTrajectory
open Cantilune.Feedback.StochasticExecution
open Cantilune.Feedback.StochasticExecution.FiniteDiscrete
open Cantilune.Pi
open Cantilune.Pi.FMSActualAgentNormativeOperationalBridge
open Cantilune.Theorems.CoreConformance
open Cantilune.Theorems.HeterogeneousProductRuleAdmission
open Cantilune.Theorems.ProductCommonTrajectoryCertificate
open Cantilune.Theorems.ProductRuleProofBundle

universe u v w

abbrev CanonicalP1bSource :=
  Cantilune.Pi.Certificates.RequestAccept.sourceLTS

abbrev CanonicalP1bTarget :=
  Cantilune.Pi.Late.structuralLateLTS

abbrev CanonicalP1cSource :=
  Cantilune.Pi.P1cFullNativeRefinement.sourceLTS

abbrev CanonicalP1cTarget :=
  Cantilune.Pi.P1cFullNativeRefinement.targetLTS

/-- The fixed, genuine session-establishment occurrence of P1b. -/
def canonicalP1bOccurrence : NativeOccurrence CanonicalP1bSource where
  source := .requesting
  event := .establishSession
  target := .established
  native :=
    ⟨Cantilune.Pi.Certificates.RequestAccept.Step.establishSession, trivial⟩

/--
The canonical first strong P1c occurrence for a normative family.  The family
argument is later definitionally the one decoded from the exact product
candidate.
-/
def canonicalP1cOccurrence
    (family : Cantilune.Pi.P1cMatrix.SourceEvent) :
    NativeOccurrence CanonicalP1cSource where
  source := .ready family
  event := .execute family
  target := Cantilune.Pi.P1cFullNativeRefinement.afterFirst family
  native :=
    ⟨Cantilune.Pi.P1cFullNativeRefinement.Step.execute family, trivial⟩

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

/--
The canonical protocol occurrences carried by a product package.

P1b is an explicit session-establishment phase.  P1c is the first strong
transition of the *same family* decoded from the package candidate's registry
operation.  Requiring equality of the proof-carrying occurrences prevents a
caller from selecting a convenient but unrelated native P1c transition.
-/
structure CandidateIndexedProtocolBridge
    (package :
      CoreConformancePackage
        SourceCategory DagCategory PetriCategory PiCategory MorphismCategory
        source dagFamily petriFamily piFamily morphismFamily
        admission sourceSemantics sourceOccurrence signatureCertificate
        kernel initial epsilon RuleQualified RuleAuthorized candidate
        CanonicalP1bSource CanonicalP1bTarget
        CanonicalP1cSource CanonicalP1cTarget) : Prop where
  p1bGlobalCertificate :
    package.p1b =
      Cantilune.Pi.P1bNominalIncidenceClosure.pi_ra_certificate
  p1bGlobalOccurrence :
    package.p1bOccurrence = canonicalP1bOccurrence
  p1cCertificate :
    package.p1c =
      Cantilune.Pi.P1cFullNativeRefinement.certificate
  p1cOccurrence :
    package.p1cOccurrence =
      canonicalP1cOccurrence package.piFMSAlignment.family
  candidatePhaseEdge :
    Cantilune.Pi.P1cEnrichedStructuralCertificate.PhaseEdge
      package.piFMSAlignment.family
      (package.piFMSAlignment.operational.fromPhase
        ((piFamily.operational newSignature).mapEvent candidate.event))
      (package.piFMSAlignment.operational.toPhase
        ((piFamily.operational newSignature).mapEvent candidate.event))
  admissionPhaseEdge :
    Cantilune.Pi.P1cEnrichedStructuralCertificate.PhaseEdge
      (package.admissionPiFMSAlignment.operational.family
        (signatureCertificate.piSemantics.eventOf admission))
      (package.admissionPiFMSAlignment.operational.fromPhase
        (signatureCertificate.piSemantics.eventOf admission))
      (package.admissionPiFMSAlignment.operational.toPhase
        (signatureCertificate.piSemantics.eventOf admission))

namespace CandidateIndexedProtocolBridge

variable
    {package :
      CoreConformancePackage
        SourceCategory DagCategory PetriCategory PiCategory MorphismCategory
        source dagFamily petriFamily piFamily morphismFamily
        admission sourceSemantics sourceOccurrence signatureCertificate
        kernel initial epsilon RuleQualified RuleAuthorized candidate
        CanonicalP1bSource CanonicalP1bTarget
        CanonicalP1cSource CanonicalP1cTarget}
    (bridge : CandidateIndexedProtocolBridge package)

include bridge in
/-- P1b globally contains the canonical genuine establishment source step. -/
theorem p1b_global_reference_step :
    CanonicalP1bSource.ObservableStep
      .requesting .establishSession .established := by
  exact
    ⟨Cantilune.Pi.Certificates.RequestAccept.Step.establishSession, trivial⟩

include bridge in
/--
The P1c source occurrence is indexed by the product candidate's exact
registry/FMS family.
-/
theorem p1c_candidate_source :
    package.p1cOccurrence.source =
      .ready package.piFMSAlignment.family := by
  rw [bridge.p1cOccurrence]
  rfl

include bridge in
theorem p1c_candidate_event :
    package.p1cOccurrence.event =
      .execute package.piFMSAlignment.family := by
  rw [bridge.p1cOccurrence]
  rfl

include bridge in
theorem p1c_candidate_target :
    package.p1cOccurrence.target =
      Cantilune.Pi.P1cFullNativeRefinement.afterFirst
        package.piFMSAlignment.family := by
  rw [bridge.p1cOccurrence]
  rfl

include bridge in
/-- The exact family-indexed P1c occurrence is genuinely native. -/
theorem p1c_candidate_native :
    CanonicalP1cSource.ObservableStep
      (.ready package.piFMSAlignment.family)
      (.execute package.piFMSAlignment.family)
      (Cantilune.Pi.P1cFullNativeRefinement.afterFirst
        package.piFMSAlignment.family) := by
  exact
    ⟨Cantilune.Pi.P1cFullNativeRefinement.Step.execute
        package.piFMSAlignment.family,
      trivial⟩

include bridge in
/--
The product candidate's raw source is structurally related to the same P1c
family; this is not an equality of unrelated phase states.
-/
theorem product_raw_source_same_family :
    Cantilune.Pi.Late.Struct
      (package.piFMSAlignment.operational.statePayload
        ((piFamily.operational newSignature).mapState candidate.before))
      (Cantilune.Pi.P1cFullNativeRefinement.readyProcess
        package.piFMSAlignment.family) :=
  package.piFMSAlignment.source_to_family

include bridge in
/--
The product action and derivative jointly inhabit the exact candidate-indexed
P1c family, including bound-label alpha.
-/
theorem product_raw_derivative_same_family :
    Cantilune.Pi.OpenSMCActionAlpha.DerivativeAlpha
      ⟨package.piFMSAlignment.operational.actionPayload
          ((piFamily.operational newSignature).mapEvent candidate.event),
        package.piFMSAlignment.operational.statePayload
          ((piFamily.operational newSignature).mapState candidate.after)⟩
      ⟨Cantilune.Pi.P1cFullNativeRefinement.firstAction
          package.piFMSAlignment.family,
        Cantilune.Pi.P1cFullNativeRefinement.firstTarget
          package.piFMSAlignment.family⟩ :=
  package.piFMSAlignment.derivative_to_family

/--
The exact product candidate is an occurrence of the enriched structural P1c
target.  In contrast with `RegistryNativeStep` alone, construction of this
value requires the normative `PhaseEdge`; arbitrary phase labels therefore
cannot enter the final certificate.
-/
def enrichedProductOccurrence :
    Cantilune.Pi.P1cEnrichedStructuralCertificate.ProductOccurrenceAlignment
      (piFamily.target.package newSignature).lts
      ((piFamily.operational newSignature).mapState candidate.before)
      ((piFamily.operational newSignature).mapEvent candidate.event)
      ((piFamily.operational newSignature).mapState candidate.after) where
  productStep := package.piFMSAlignment.projectedNative
  operation :=
    package.piFMSAlignment.operational.operation
      ((piFamily.operational newSignature).mapEvent candidate.event)
  metadata := package.piFMSAlignment.metadata
  fromPhase :=
    package.piFMSAlignment.operational.fromPhase
      ((piFamily.operational newSignature).mapEvent candidate.event)
  toPhase :=
    package.piFMSAlignment.operational.toPhase
      ((piFamily.operational newSignature).mapEvent candidate.event)
  sourceProcess :=
    package.piFMSAlignment.operational.statePayload
      ((piFamily.operational newSignature).mapState candidate.before)
  nativeAction :=
    package.piFMSAlignment.operational.actionPayload
      ((piFamily.operational newSignature).mapEvent candidate.event)
  targetProcess :=
    package.piFMSAlignment.operational.statePayload
      ((piFamily.operational newSignature).mapState candidate.after)
  phaseEdge := bridge.candidatePhaseEdge
  native := package.piFMSAlignment.nativeRealization

include bridge in
/-- The candidate-indexed enriched quotient has one genuine strong step. -/
theorem enriched_product_target_step :
    Cantilune.Pi.P1cEnrichedStructuralCertificate.targetLTS.ObservableStep
      (Cantilune.Pi.P1cEnrichedStructuralCertificate.mapState
        bridge.enrichedProductOccurrence.rawSource)
      (Cantilune.Pi.P1cEnrichedStructuralCertificate.mapAction
        bridge.enrichedProductOccurrence.rawEvent)
      (Cantilune.Pi.P1cEnrichedStructuralCertificate.mapState
        bridge.enrichedProductOccurrence.rawTarget) :=
  bridge.enrichedProductOccurrence.enrichedTargetStep

end CandidateIndexedProtocolBridge

/--
One dependent input certificate for the final product theorem.  The common
trajectory and the protocol bridge are both indexed by the same package and
therefore by the same DPO candidate.
-/
structure CompleteProductProtocolTrajectoryCertificate
    (package :
      CoreConformancePackage
        SourceCategory DagCategory PetriCategory PiCategory MorphismCategory
        source dagFamily petriFamily piFamily morphismFamily
        admission sourceSemantics sourceOccurrence signatureCertificate
        kernel initial epsilon RuleQualified RuleAuthorized candidate
        CanonicalP1bSource CanonicalP1bTarget
        CanonicalP1cSource CanonicalP1cTarget)
    (labelling : PositiveEventLabelling kernel)
    (fmsLabelling : ProductFMSLabelling labelling)
    (path : PositiveStatePath kernel)
    (agreement : labelling.TrajectoryAgreement path)
    (selected : Nat) where
  protocol : CandidateIndexedProtocolBridge package
  trajectory :
    CompleteProductCommonTrajectoryCertificate
      package labelling fmsLabelling path agreement selected

namespace CompleteProductProtocolTrajectoryCertificate

variable
    {package :
      CoreConformancePackage
        SourceCategory DagCategory PetriCategory PiCategory MorphismCategory
        source dagFamily petriFamily piFamily morphismFamily
        admission sourceSemantics sourceOccurrence signatureCertificate
        kernel initial epsilon RuleQualified RuleAuthorized candidate
        CanonicalP1bSource CanonicalP1bTarget
        CanonicalP1cSource CanonicalP1cTarget}
    {labelling : PositiveEventLabelling kernel}
    {fmsLabelling : ProductFMSLabelling labelling}
    {path : PositiveStatePath kernel}
    {agreement : labelling.TrajectoryAgreement path}
    {selected : Nat}
    (certificate :
      CompleteProductProtocolTrajectoryCertificate
        package labelling fmsLabelling path agreement selected)

/--
Precise final protocol/trajectory evidence.

The P1b field is intentionally a theorem about the global request/accept
reference sublanguage.  It is not asserted to be the same business
transaction as an arbitrary product candidate, because the current P1b
source LTS carries no product session or correlation metadata.  All remaining
fields are candidate-indexed and retain the explicit selected-row equalities.
-/
structure CompleteProtocolCandidateEvidence : Prop where
  p1bReferenceSublanguage :
    CanonicalP1bSource.ObservableStep
      .requesting .establishSession .established
  selectedCandidate :
    Cantilune.Theorems.ProductCommonTrajectoryCertificate.CompleteProductCommonTrajectoryCertificate.SelectedCandidateFMSEvidence
      certificate.trajectory
  selectedFamilyExact :
    certificate.trajectory.selectedRow.family =
      package.piFMSAlignment.family
  p1cCandidateNative :
    CanonicalP1cSource.ObservableStep
      (.ready package.piFMSAlignment.family)
      (.execute package.piFMSAlignment.family)
      (Cantilune.Pi.P1cFullNativeRefinement.afterFirst
        package.piFMSAlignment.family)
  enrichedCandidateNative :
    Cantilune.Pi.P1cEnrichedStructuralCertificate.targetLTS.ObservableStep
      (Cantilune.Pi.P1cEnrichedStructuralCertificate.mapState
        certificate.protocol.enrichedProductOccurrence.rawSource)
      (Cantilune.Pi.P1cEnrichedStructuralCertificate.mapAction
        certificate.protocol.enrichedProductOccurrence.rawEvent)
      (Cantilune.Pi.P1cEnrichedStructuralCertificate.mapState
        certificate.protocol.enrichedProductOccurrence.rawTarget)
  admissionCandidateSeam :
    sourceOccurrence.afterState = candidate.before ∧
      Cantilune.Pi.FMSActualAgentNormativeCommutation.normativeTargetAgent
          (package.admissionPiFMSAlignment.operational.family
            (signatureCertificate.piSemantics.eventOf admission)) =
        Cantilune.Pi.FMSActualAgentNormativeCommutation.normativeSourceAgent
          package.piFMSAlignment.family

include certificate in
/-- The selected stochastic row is literally the package candidate event. -/
theorem selected_event_is_candidate :
    agreement.trajectory.event selected = candidate.event :=
  certificate.trajectory.selectedEvent

include certificate in
/-- The selected row and the exact P1c occurrence decode the same family. -/
theorem selected_row_is_p1c_family :
    certificate.trajectory.selectedRow.family =
      Cantilune.Pi.P1cFullNativeRefinement.stateFamily
        package.p1cOccurrence.source := by
  rw [certificate.trajectory.familyExact]
  rw [certificate.protocol.p1c_candidate_source]
  rfl

include certificate in
/--
The selected stochastic row preserves the exact replayable DPO event while
the candidate-indexed P1c occurrence preserves its genuine strong native
step.
-/
theorem selected_replay_and_p1c_native :
    ((source.package newSignature).eventRecord candidate.event).Replays
        ((source.package newSignature).configOf candidate.before)
        ((source.package newSignature).configOf candidate.after) ∧
      CanonicalP1cSource.ObservableStep
        (.ready package.piFMSAlignment.family)
        (.execute package.piFMSAlignment.family)
        (Cantilune.Pi.P1cFullNativeRefinement.afterFirst
          package.piFMSAlignment.family) :=
  ⟨certificate.trajectory.selectedReplay,
    certificate.protocol.p1c_candidate_native⟩

include certificate in
/--
The heterogeneous admission ends at the selected fixed-epoch candidate, and
its actual-Agent target is the candidate family's actual-Agent source.
-/
theorem admission_to_selected_candidate :
    sourceOccurrence.afterState = candidate.before ∧
      Cantilune.Pi.FMSActualAgentNormativeCommutation.normativeTargetAgent
          (package.admissionPiFMSAlignment.operational.family
            (signatureCertificate.piSemantics.eventOf admission)) =
        Cantilune.Pi.FMSActualAgentNormativeCommutation.normativeSourceAgent
          package.piFMSAlignment.family :=
  ⟨package.crossEpoch.connects,
    package.admissionPiFMSAlignment.actualEndpointSeam⟩

include certificate in
/--
Compatibility view containing the global P1b establishment step beside the
candidate-indexed selected-row and P1c steps.  This conjunction does not
assert that P1b is a predecessor of the product candidate.
-/
theorem global_p1b_and_candidate_p1c_steps :
    CanonicalP1bSource.ObservableStep
        .requesting .establishSession .established ∧
      agreement.trajectory.event selected = candidate.event ∧
      certificate.trajectory.selectedRow.family =
        package.piFMSAlignment.family ∧
      CanonicalP1cSource.ObservableStep
        (.ready package.piFMSAlignment.family)
        (.execute package.piFMSAlignment.family)
        (Cantilune.Pi.P1cFullNativeRefinement.afterFirst
          package.piFMSAlignment.family) ∧
      Cantilune.Pi.P1cEnrichedStructuralCertificate.targetLTS.ObservableStep
        (Cantilune.Pi.P1cEnrichedStructuralCertificate.mapState
          certificate.protocol.enrichedProductOccurrence.rawSource)
        (Cantilune.Pi.P1cEnrichedStructuralCertificate.mapAction
          certificate.protocol.enrichedProductOccurrence.rawEvent)
        (Cantilune.Pi.P1cEnrichedStructuralCertificate.mapState
          certificate.protocol.enrichedProductOccurrence.rawTarget) :=
  ⟨certificate.protocol.p1b_global_reference_step,
    certificate.trajectory.selectedEvent,
    certificate.trajectory.familyExact,
    certificate.protocol.p1c_candidate_native,
    certificate.protocol.enriched_product_target_step⟩

include certificate in
/--
The non-overclaiming final evidence: P1b is the independently verified global
request/accept sublanguage, whereas the trajectory, replay, P1c, enriched
target and actual-Agent seam are all explicitly the selected product
candidate.
-/
theorem complete_protocol_candidate_evidence :
    CompleteProtocolCandidateEvidence certificate where
  p1bReferenceSublanguage :=
    certificate.protocol.p1b_global_reference_step
  selectedCandidate :=
    certificate.trajectory.selectedCandidateFMSEvidence
  selectedFamilyExact :=
    certificate.trajectory.familyExact
  p1cCandidateNative :=
    certificate.protocol.p1c_candidate_native
  enrichedCandidateNative :=
    certificate.protocol.enriched_product_target_step
  admissionCandidateSeam :=
    certificate.admission_to_selected_candidate

end CompleteProductProtocolTrajectoryCertificate

end Cantilune.Theorems.ProductProtocolTrajectoryBridge
