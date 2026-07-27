import Cantilune.Theorems.CrossEpochProductFamily
import Cantilune.Theorems.FMSGatedFourProjection

/-!
# FMS-gated product consistency across a signature epoch

`CrossEpochProductFamily` composes a heterogeneous four-view signature
admission with one fixed-signature product rule in the admitted epoch.
`FMSGatedFourProjection` separately prevents an operational pi certificate
from being paired with an unrelated denotational model.

This module closes the composition interface between those two results.  A
caller must provide:

* one actual strict `ExactFMSAcceptancePackage`;
* operational/FMS coherence for the new-epoch pi projection;
* a denotation for the old-epoch mapped pi state; and
* an exact operational/FMS transition equivalence for every mapped
  heterogeneous registration/admission edge.

The resulting theorem retains all four dependent replay chains, strict epoch
advance, the fixed-epoch product rule as a native FMS transition, and the
heterogeneous admission as a separate native FMS transition.  No local
inhabitant is manufactured: in particular this theorem does not construct
the missing FMS powerdomain/domain solution or any production package.
-/

noncomputable section

namespace Cantilune.Theorems

open CategoryTheory
open Cantilune.Core
open Cantilune.Core.ExecutionEpochTrace
open Cantilune.Pi
open Cantilune.Pi.FMSExternalPackage
open Cantilune.Pi.FMSExactAcceptance
open Cantilune.Feedback.StochasticExecution.FiniteDiscrete
open Cantilune.Theorems.CrossEpochProductFamily
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
    {family :
      CrossEpochProductFamily
        SourceCategory DagCategory PetriCategory PiCategory MorphismCategory
        source dagFamily petriFamily piFamily morphismFamily
        admission sourceSemantics sourceOccurrence signatureCertificate
        kernel initial epsilon RuleQualified RuleAuthorized candidate}

/--
The extra denotational evidence required for one cross-epoch product family.

The admission action is typed by the heterogeneous pi target semantics, not
by either fixed-signature target LTS.  Consequently it cannot be silently
coerced into the new-epoch business-event relation.
-/
structure FMSGatedCrossEpochEvidence
    (family :
      CrossEpochProductFamily
        SourceCategory DagCategory PetriCategory PiCategory MorphismCategory
        source dagFamily petriFamily piFamily morphismFamily
        admission sourceSemantics sourceOccurrence signatureCertificate
        kernel initial epsilon RuleQualified RuleAuthorized candidate) where
  fms : ExactFMSAcceptancePackage
  newPi :
    OperationalFMSPiCoherence fms
      (source.package newSignature).lts
      (piFamily.target.package newSignature).lts
      (piFamily.operational newSignature)
  oldSourceProcess :
    (source.package oldSignature).lts.State → ClosedRaw
  oldTargetDenotation :
    (piFamily.target.package oldSignature).lts.State →
      fms.base.domain.agent.obj 0
  admissionAction :
    signatureCertificate.piSemantics.Event → Raw.Action
  old_mapped_state_denotation :
    ∀ state,
      oldTargetDenotation
          ((piFamily.toProjectionFamily.operational oldSignature).mapState
            state) =
        fms.base.lateFullAbstraction.denote
          (oldSourceProcess state)
  mapped_admission_iff :
    ∀ {before event after},
      signatureCertificate.piSemantics.step
          ((piFamily.toProjectionFamily.operational oldSignature).mapState
            before)
          event
          ((piFamily.toProjectionFamily.operational newSignature).mapState
            after) ↔
        fms.base.lateFullAbstraction.transition
          (fms.base.lateFullAbstraction.denote
            (oldSourceProcess before))
          (admissionAction event)
          (newPi.targetDenotation
            ((piFamily.toProjectionFamily.operational newSignature).mapState
              after))

namespace FMSGatedCrossEpochEvidence

variable
    (evidence :
      FMSGatedCrossEpochEvidence
        (SourceCategory := SourceCategory)
        (DagCategory := DagCategory)
        (PetriCategory := PetriCategory)
        (PiCategory := PiCategory)
        (MorphismCategory := MorphismCategory)
        family)

include evidence

/--
The fixed-signature product rule in the admitted epoch is exactly one native
transition of the supplied FMS model.
-/
theorem rule_pi_native_fms :
    evidence.fms.base.lateFullAbstraction.transition
      (evidence.fms.base.lateFullAbstraction.denote
        (evidence.newPi.sourceProcess candidate.before))
      (evidence.newPi.targetAction
        ((piFamily.operational newSignature).mapEvent candidate.event))
      (evidence.newPi.targetDenotation
        ((piFamily.operational newSignature).mapState candidate.after)) := by
  exact
    evidence.newPi.mapped_step_iff.mp
      (CrossEpochProductFamily.ruleBundle family).pi.native

/--
The old mapped state denotation can be used directly as the source of the
heterogeneous FMS admission transition.
-/
theorem admission_native_fms_from_mapped_state :
    evidence.fms.base.lateFullAbstraction.transition
      (evidence.oldTargetDenotation
        ((piFamily.toProjectionFamily.operational oldSignature).mapState
          sourceOccurrence.beforeState))
      (evidence.admissionAction
        (signatureCertificate.pi.admissionProjection.mapAdmissionEvent
          (sourceSemantics.eventOf admission)))
      (evidence.newPi.targetDenotation
        ((piFamily.toProjectionFamily.operational newSignature).mapState
          candidate.before)) := by
  rw [evidence.old_mapped_state_denotation]
  apply evidence.mapped_admission_iff.mp
  have native :=
    signatureCertificate.pi.admissionProjection
      |>.target_native_at_mapped_endpoints
  simpa only [CrossEpochProductFamily.connects family] using native

end FMSGatedCrossEpochEvidence

/--
The strongest current conditional cross-epoch conclusion.

The conclusion keeps the FMS package as data and contains both kinds of pi
transition.  The four target traces remain dependent on their actual old and
new package types, so signature admission is not erased to a same-LTS step.
-/
structure FMSGatedCrossEpochConclusion
    (family :
      CrossEpochProductFamily
        SourceCategory DagCategory PetriCategory PiCategory MorphismCategory
        source dagFamily petriFamily piFamily morphismFamily
        admission sourceSemantics sourceOccurrence signatureCertificate
        kernel initial epsilon RuleQualified RuleAuthorized candidate)
    (evidence :
      FMSGatedCrossEpochEvidence
        (SourceCategory := SourceCategory)
        (DagCategory := DagCategory)
        (PetriCategory := PetriCategory)
        (PiCategory := PiCategory)
        (MorphismCategory := MorphismCategory)
        family) : Prop where
  fourViews : CrossEpochProductFamily.FourViewTrace family
  fourChains : CrossEpochProductFamily.FourEpochChainAgreement family
  sourceNative :
    sourceSemantics.step
        sourceOccurrence.beforeState
        (sourceSemantics.eventOf admission)
        candidate.before ∧
      (source.package newSignature).lts.ObservableStep
        candidate.before candidate.event candidate.after
  sourceReplay :
    AdmissionReplays admission
        ((source.package oldSignature).configOf
          sourceOccurrence.beforeState)
        ((source.package newSignature).configOf candidate.before) ∧
      (((source.package newSignature).eventRecord candidate.event).Replays
        ((source.package newSignature).configOf candidate.before)
        ((source.package newSignature).configOf candidate.after))
  strictTargetVersions :
    (dagFamily.target.package oldSignature).lts.signatureVersion
          signatureCertificate.dag.admissionProjection.targetOccurrence.beforeState <
        (dagFamily.target.package newSignature).lts.signatureVersion
          signatureCertificate.dag.admissionProjection.targetOccurrence.afterState ∧
      (petriFamily.target.package oldSignature).lts.signatureVersion
          signatureCertificate.petri.admissionProjection.targetOccurrence.beforeState <
        (petriFamily.target.package newSignature).lts.signatureVersion
          signatureCertificate.petri.admissionProjection.targetOccurrence.afterState ∧
      (piFamily.target.package oldSignature).lts.signatureVersion
          signatureCertificate.pi.admissionProjection.targetOccurrence.beforeState <
        (piFamily.target.package newSignature).lts.signatureVersion
          signatureCertificate.pi.admissionProjection.targetOccurrence.afterState ∧
      (morphismFamily.target.package oldSignature).lts.signatureVersion
          signatureCertificate.morphism.admissionProjection.targetOccurrence.beforeState <
        (morphismFamily.target.package newSignature).lts.signatureVersion
          signatureCertificate.morphism.admissionProjection.targetOccurrence.afterState
  rulePiFms :
    evidence.fms.base.lateFullAbstraction.transition
      (evidence.fms.base.lateFullAbstraction.denote
        (evidence.newPi.sourceProcess candidate.before))
      (evidence.newPi.targetAction
        ((piFamily.operational newSignature).mapEvent candidate.event))
      (evidence.newPi.targetDenotation
        ((piFamily.operational newSignature).mapState candidate.after))
  admissionPiFms :
    evidence.fms.base.lateFullAbstraction.transition
      (evidence.oldTargetDenotation
        ((piFamily.toProjectionFamily.operational oldSignature).mapState
          sourceOccurrence.beforeState))
      (evidence.admissionAction
        (signatureCertificate.pi.admissionProjection.mapAdmissionEvent
          (sourceSemantics.eventOf admission)))
      (evidence.newPi.targetDenotation
        ((piFamily.toProjectionFamily.operational newSignature).mapState
          candidate.before))

/--
General composition theorem for a supplied production rule family and a
supplied exact FMS model.  It performs no semantic choice.
-/
theorem fms_gated_cross_epoch_product_consistency
    (evidence :
      FMSGatedCrossEpochEvidence
        (SourceCategory := SourceCategory)
        (DagCategory := DagCategory)
        (PetriCategory := PetriCategory)
        (PiCategory := PiCategory)
        (MorphismCategory := MorphismCategory)
        family) :
    FMSGatedCrossEpochConclusion family evidence where
  fourViews :=
    CrossEpochProductFamily.four_projection_paths_and_replay family
  fourChains :=
    CrossEpochProductFamily.four_dependent_epoch_chains_complete family
  sourceNative :=
    CrossEpochProductFamily.source_native_chain family
  sourceReplay :=
    CrossEpochProductFamily.source_replay_chain family
  strictTargetVersions :=
    CrossEpochProductFamily.target_versions_strict
  rulePiFms := evidence.rule_pi_native_fms
  admissionPiFms :=
    evidence.admission_native_fms_from_mapped_state

end Cantilune.Theorems
