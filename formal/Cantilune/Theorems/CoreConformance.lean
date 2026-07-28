import Cantilune.Feedback.AuthorizedFeedbackClosure
import Cantilune.Theorems.FiniteCrossEpochProductChain
import Cantilune.Theorems.P1cProductRuleProofBundle
import Cantilune.Pi.P1bNominalIncidenceClosure
import Cantilune.Pi.P1cFullNativeRefinement
import Cantilune.Pi.P1cOperationRegistry
import Cantilune.Pi.FMSActualAgentNormativeOperationalBridge
import Cantilune.Projection.P1aSemanticCertificate

/-!
# Certificate-parametric four-projection core conformance

This module is the composition facade for the ratified “generic core plus
nonempty reference” boundary.  It deliberately separates two claims.

* `CoreConformancePackage` is generic.  A product can inhabit it only by
  supplying a coherent four-view family admission, a complete fixed-epoch
  rule bundle (including replay, resources, authorization, fairness, and a
  positive epsilon), and the exact P1b/P1c operational certificates.
* `Reference.Package` is one nonempty anti-vacuity witness.  Its cross-epoch
  admission fixture is the small coherent reference family, while its
  substantive rule is the independently defined reconnect occurrence whose
  DAG, individual-token Petri, standard late-pi, and morphism payloads are
  all native and whose graph endpoint really changes.

No inhabitant for any of the eight production packages is defined here.
Those packages remain separate product-conformance obligations.  In
particular, the generic theorem below cannot manufacture a package from a
name, a boolean, or an incomplete submission.
-/

noncomputable section

namespace Cantilune.Theorems.CoreConformance

open CategoryTheory
open Cantilune.Core
open Cantilune.Feedback.Probability
open Cantilune.Feedback.StochasticExecution.FiniteDiscrete
open Cantilune.Theorems
open Cantilune.Theorems.ProductRuleProofBundle
open Cantilune.Projection.P1aSemanticCertificate
open Cantilune.Theorems.HeterogeneousProductRuleAdmission

universe u v w

/-- A chosen genuine observable source step, used to make a certificate
operationally non-vacuous without constraining its event vocabulary. -/
structure NativeOccurrence (lts : ObservableLTS) where
  source : lts.State
  event : lts.Event
  target : lts.State
  native : lts.ObservableStep source event target

/--
The raw/enriched operational meaning of a product π package.

The normative family is deliberately absent: it is decoded later from
`operation` through the closed 60-operation registry.  Version, rule,
session, correlation, and occurrence identifiers are part of the same
payload, so a target event cannot be paired with freely chosen metadata after
the fact.
-/
structure ProductPiOperationalSemantics
    {signature : FinSignature}
    (pi : ExecutionPackage signature) where
  operation :
    pi.lts.Event → Cantilune.Pi.P1cOperationRegistry.OperationId
  fromPhase :
    pi.lts.Event → Cantilune.Pi.P1cOperationRegistry.Phase
  toPhase :
    pi.lts.Event → Cantilune.Pi.P1cOperationRegistry.Phase
  statePayload : pi.lts.State → Cantilune.Pi.Raw.Proc
  actionPayload : pi.lts.Event → Cantilune.Pi.Raw.Action

namespace ProductPiOperationalSemantics

variable
    {signature : FinSignature}
    {pi : ExecutionPackage signature}

/-- The registry family is a function of the enriched target event. -/
def family
    (semantics : ProductPiOperationalSemantics pi)
    (event : pi.lts.Event) :
    Cantilune.Pi.P1cMatrix.SourceEvent :=
  Cantilune.Pi.P1cOperationRegistry.familyAt
    (semantics.operation event)

/--
Canonical replay-stable identifiers decoded from the complete source
`DPOEvent`.  Missing optional list entries fall back to the complement tag;
there is therefore one deterministic decoding function and no product-owned
free metadata field.
-/
def stableMetadataOfDPOEvent
    {signature : FinSignature}
    (event : DPOEvent signature) :
    Cantilune.Pi.P1cOperationRegistry.StableMetadata where
  version := event.signatureVersion
  rule := event.ruleId
  session := event.externalEvidence.head?.getD event.complementTag
  correlation := event.policyEvidence.head?.getD event.complementTag
  occurrence := event.complementTag

/--
One projected edge is realized by one enriched registry edge with exactly
the raw source/action/target selected by the π package semantics.
-/
def Realizes
    (semantics : ProductPiOperationalSemantics pi)
    (metadata : Cantilune.Pi.P1cOperationRegistry.StableMetadata)
    {source : pi.lts.State}
    {event : pi.lts.Event}
    {target : pi.lts.State}
    (_step : pi.lts.ObservableStep source event target) : Prop :=
  Cantilune.Pi.P1cOperationRegistry.RegistryNativeStep
    ⟨semantics.operation event, metadata,
      semantics.fromPhase event, semantics.statePayload source⟩
    ⟨semantics.operation event, metadata,
      semantics.fromPhase event, semantics.toPhase event,
      semantics.actionPayload event⟩
    ⟨semantics.operation event, metadata,
      semantics.toPhase event, semantics.statePayload target⟩

end ProductPiOperationalSemantics

/--
Product-owned commuting square between one projected π occurrence, the
enriched operation registry, the canonical fifteen-family late-π semantics,
and the actual recursive FMS `Agent`.

Unlike the former record, this does not store a free `family` field or a
second unrelated native step.  `realizesProjected` is indexed by the actual
projected edge.  Its source is structurally related to the family source and
its labelled derivative is related jointly by `DerivativeAlpha`; hence the
real product payload, including bound labels, reaches the same family before
the compiled/FMS correspondence is used.
-/
structure ProductPiFMSAlignment
    {signature : FinSignature}
    (source pi : ExecutionPackage signature)
    (projection : ProjectionCertificate source.lts pi.lts)
    (candidate :
      Cantilune.Theorems.ProductRuleProofBundle.Candidate source) where
  operational : ProductPiOperationalSemantics pi
  projectedNative :
    pi.lts.ObservableStep
      (projection.mapState candidate.before)
      (projection.mapEvent candidate.event)
      (projection.mapState candidate.after)
  realizesProjected :
    operational.Realizes
      (ProductPiOperationalSemantics.stableMetadataOfDPOEvent
        (source.eventRecord candidate.event).event)
      projectedNative
  source_to_family :
    Cantilune.Pi.Late.Struct
      (operational.statePayload
        (projection.mapState candidate.before))
      (Cantilune.Pi.P1cFullNativeRefinement.readyProcess
        (operational.family
          (projection.mapEvent candidate.event)))
  derivative_to_family :
    Cantilune.Pi.OpenSMCActionAlpha.DerivativeAlpha
      ⟨operational.actionPayload
          (projection.mapEvent candidate.event),
        operational.statePayload
          (projection.mapState candidate.after)⟩
      ⟨Cantilune.Pi.P1cFullNativeRefinement.firstAction
          (operational.family
            (projection.mapEvent candidate.event)),
        Cantilune.Pi.P1cFullNativeRefinement.firstTarget
          (operational.family
            (projection.mapEvent candidate.event))⟩
  compiled :
    Cantilune.Pi.FMSActualAgentNormativeOperationalBridge.PointedStrongCorrespondence
      (operational.family
        (projection.mapEvent candidate.event))
  actual :
    Cantilune.Pi.FMSActualAgentNormativeOperationalBridge.TotalCompiledNormativeCommutation
      (operational.family
        (projection.mapEvent candidate.event))

namespace ProductPiFMSAlignment

variable
    {signature : FinSignature}
    {source pi : ExecutionPackage signature}
    {projection : ProjectionCertificate source.lts pi.lts}
    {candidate :
      Cantilune.Theorems.ProductRuleProofBundle.Candidate source}

/-- Registry-decoded normative family of the actual projected event. -/
def family
    (alignment :
      ProductPiFMSAlignment source pi projection candidate) :
    Cantilune.Pi.P1cMatrix.SourceEvent :=
  alignment.operational.family
    (projection.mapEvent candidate.event)

/-- Stable replay metadata of the actual projected event. -/
def metadata
    (alignment :
      ProductPiFMSAlignment source pi projection candidate) :
    Cantilune.Pi.P1cOperationRegistry.StableMetadata :=
  ProductPiOperationalSemantics.stableMetadataOfDPOEvent
    (source.eventRecord candidate.event).event

/-- The raw late-π step extracted from the exact enriched projected edge. -/
theorem nativeRealization
    (alignment :
      ProductPiFMSAlignment source pi projection candidate) :
    Cantilune.Pi.Late.NativeStep
      (alignment.operational.statePayload
        (projection.mapState candidate.before))
      (alignment.operational.actionPayload
        (projection.mapEvent candidate.event))
      (alignment.operational.statePayload
        (projection.mapState candidate.after)) :=
  Cantilune.Pi.P1cOperationRegistry.native_action_exposed
    alignment.realizesProjected

end ProductPiFMSAlignment

/-! ## Exact heterogeneous admission-to-business π/FMS seam -/

/--
Raw/enriched operational meaning of a heterogeneous π admission.

The event and endpoint types are those of the independently supplied
heterogeneous target semantics.  In particular, this record cannot replace a
missing target admission with a fixed-signature business event.
-/
structure ProductAdmissionPiOperationalSemantics
    {universes : ProjectionUniverses}
    {oldSignature newSignature : FinSignature}
    {piBefore : ExecutionPackage oldSignature}
    {piAfter : ExecutionPackage newSignature}
    (semantics :
      HeterogeneousAdmissionLTS
        (universes := universes) piBefore piAfter) where
  operation : semantics.Event →
    Cantilune.Pi.P1cOperationRegistry.OperationId
  fromPhase : semantics.Event →
    Cantilune.Pi.P1cOperationRegistry.Phase
  toPhase : semantics.Event →
    Cantilune.Pi.P1cOperationRegistry.Phase
  beforePayload : piBefore.lts.State → Cantilune.Pi.Raw.Proc
  afterPayload : piAfter.lts.State → Cantilune.Pi.Raw.Proc
  actionPayload : semantics.Event → Cantilune.Pi.Raw.Action

namespace ProductAdmissionPiOperationalSemantics

variable
    {universes : ProjectionUniverses}
    {oldSignature newSignature : FinSignature}
    {piBefore : ExecutionPackage oldSignature}
    {piAfter : ExecutionPackage newSignature}
    {semantics :
      HeterogeneousAdmissionLTS
        (universes := universes) piBefore piAfter}

/-- The normative family is decoded from the exact heterogeneous event. -/
def family
    (operational : ProductAdmissionPiOperationalSemantics semantics)
    (event : semantics.Event) :
    Cantilune.Pi.P1cMatrix.SourceEvent :=
  Cantilune.Pi.P1cOperationRegistry.familyAt
    (operational.operation event)

/--
One exact heterogeneous target occurrence realizes one enriched registry
step.  The native proof is an index of the proposition, so the witness cannot
be detached from the target admission endpoints or label.
-/
def Realizes
    (operational : ProductAdmissionPiOperationalSemantics semantics)
    (metadata : Cantilune.Pi.P1cOperationRegistry.StableMetadata)
    {before : piBefore.lts.State}
    {event : semantics.Event}
    {after : piAfter.lts.State}
    (_native : semantics.step before event after) : Prop :=
  Cantilune.Pi.P1cOperationRegistry.RegistryNativeStep
    ⟨operational.operation event, metadata,
      operational.fromPhase event, operational.beforePayload before⟩
    ⟨operational.operation event, metadata,
      operational.fromPhase event, operational.toPhase event,
      operational.actionPayload event⟩
    ⟨operational.operation event, metadata,
      operational.toPhase event, operational.afterPayload after⟩

end ProductAdmissionPiOperationalSemantics

/--
Replay-stable admission metadata.

The registry component is required below to equal the metadata decoded from
the selected post-admission `DPOEvent`.  The admission tombstone is retained
as a separate field because a tombstone identifies the signature boundary,
whereas `StableMetadata.occurrence` identifies the following fixed-epoch
business occurrence.
-/
structure AdmissionTransactionMetadata
    {universes : ProjectionUniverses}
    {oldSignature newSignature : FinSignature}
    (admission :
      SignatureAdmissionEvent universes
        (source := oldSignature) (target := newSignature)) where
  registry : Cantilune.Pi.P1cOperationRegistry.StableMetadata
  tombstone : Nat
  registryVersion : registry.version = admission.toVersion
  tombstoneExact : tombstone = admission.tombstoneId

/--
The complete heterogeneous admission-to-business π/FMS alignment.

Every dependency is explicit:

* `piProjection.targetOccurrence.native` is the independently supplied
  target-view admission step;
* the registry witness is indexed by that exact event and endpoints;
* its metadata is the metadata of the selected post-admission source
  `DPOEvent`, while the signature tombstone is retained separately;
* the admission derivative is jointly alpha-related to the selected
  business source payload; and
* the actual recursive-Agent target of admission is literally the selected
  business source Agent.
-/
structure ProductAdmissionPiFMSAlignment
    {universes : ProjectionUniverses}
    {oldSignature newSignature : FinSignature}
    {sourceBefore : ExecutionPackage oldSignature}
    {sourceAfter : ExecutionPackage newSignature}
    {piBefore : ExecutionPackage oldSignature}
    {piAfter : ExecutionPackage newSignature}
    (admission :
      SignatureAdmissionEvent universes
        (source := oldSignature) (target := newSignature))
    (sourceSemantics :
      HeterogeneousAdmissionLTS sourceBefore sourceAfter)
    (sourceOccurrence :
      HeterogeneousPackageAdmission
        sourceBefore sourceAfter sourceSemantics admission)
    (piSemantics :
      HeterogeneousAdmissionLTS piBefore piAfter)
    (beforeProjection :
      ProjectionCertificate sourceBefore.lts piBefore.lts)
    (afterProjection :
      ProjectionCertificate sourceAfter.lts piAfter.lts)
    (piProjection :
      HeterogeneousAdmissionProjection
        sourceBefore sourceAfter piBefore piAfter
        sourceSemantics piSemantics admission sourceOccurrence
        beforeProjection afterProjection)
    (candidate :
      Cantilune.Theorems.ProductRuleProofBundle.Candidate sourceAfter)
    (connects : sourceOccurrence.afterState = candidate.before)
    (business :
      ProductPiFMSAlignment
        sourceAfter piAfter afterProjection candidate) where
  operational : ProductAdmissionPiOperationalSemantics piSemantics
  metadata : AdmissionTransactionMetadata admission
  metadataRegistryExact :
    metadata.registry =
      ProductPiOperationalSemantics.stableMetadataOfDPOEvent
        (sourceAfter.eventRecord candidate.event).event
  admissionFamilyExact :
    operational.family (piSemantics.eventOf admission) =
      .dynamicPartnerAdmission
  realizesTargetAdmission :
    operational.Realizes metadata.registry
      piProjection.targetOccurrence.native
  source_to_family :
    Cantilune.Pi.Late.Struct
      (operational.beforePayload
        piProjection.targetOccurrence.beforeState)
      (Cantilune.Pi.P1cFullNativeRefinement.readyProcess
        (operational.family
          (piSemantics.eventOf admission)))
  derivative_to_business :
    Cantilune.Pi.OpenSMCActionAlpha.DerivativeAlpha
      ⟨operational.actionPayload
          (piSemantics.eventOf admission),
        operational.afterPayload
          piProjection.targetOccurrence.afterState⟩
      ⟨Cantilune.Pi.P1cFullNativeRefinement.firstAction
          (operational.family
            (piSemantics.eventOf admission)),
        business.operational.statePayload
          (afterProjection.mapState candidate.before)⟩
  actual :
    Cantilune.Pi.FMSActualAgentNormativeOperationalBridge.TotalCompiledNormativeCommutation
      (operational.family
        (piSemantics.eventOf admission))
  actualEndpointSeam :
    Cantilune.Pi.FMSActualAgentNormativeCommutation.normativeTargetAgent
        (operational.family
          (piSemantics.eventOf admission)) =
      Cantilune.Pi.FMSActualAgentNormativeCommutation.normativeSourceAgent
        business.family

namespace ProductAdmissionPiFMSAlignment

variable
    {universes : ProjectionUniverses}
    {oldSignature newSignature : FinSignature}
    {sourceBefore : ExecutionPackage oldSignature}
    {sourceAfter : ExecutionPackage newSignature}
    {piBefore : ExecutionPackage oldSignature}
    {piAfter : ExecutionPackage newSignature}
    {admission :
      SignatureAdmissionEvent universes
        (source := oldSignature) (target := newSignature)}
    {sourceSemantics :
      HeterogeneousAdmissionLTS sourceBefore sourceAfter}
    {sourceOccurrence :
      HeterogeneousPackageAdmission
        sourceBefore sourceAfter sourceSemantics admission}
    {piSemantics :
      HeterogeneousAdmissionLTS piBefore piAfter}
    {beforeProjection :
      ProjectionCertificate sourceBefore.lts piBefore.lts}
    {afterProjection :
      ProjectionCertificate sourceAfter.lts piAfter.lts}
    {piProjection :
      HeterogeneousAdmissionProjection
        sourceBefore sourceAfter piBefore piAfter
        sourceSemantics piSemantics admission sourceOccurrence
        beforeProjection afterProjection}
    {candidate :
      Cantilune.Theorems.ProductRuleProofBundle.Candidate sourceAfter}
    {connects : sourceOccurrence.afterState = candidate.before}
    {business :
      ProductPiFMSAlignment
        sourceAfter piAfter afterProjection candidate}
    (alignment :
      ProductAdmissionPiFMSAlignment
        admission sourceSemantics sourceOccurrence piSemantics
        beforeProjection afterProjection piProjection
        candidate connects business)

include alignment in
/-- The independently supplied target admission has one genuine raw step. -/
theorem nativeRealization :
    Cantilune.Pi.Late.NativeStep
      (alignment.operational.beforePayload
        piProjection.targetOccurrence.beforeState)
      (alignment.operational.actionPayload
        (piSemantics.eventOf admission))
      (alignment.operational.afterPayload
        piProjection.targetOccurrence.afterState) :=
  Cantilune.Pi.P1cOperationRegistry.native_action_exposed
    alignment.realizesTargetAdmission

include alignment in
/-- The target occurrence ends at the selected business source state. -/
theorem targetStateIsSelectedBusinessSource :
    piProjection.targetOccurrence.afterState =
      afterProjection.mapState candidate.before := by
  calc
    piProjection.targetOccurrence.afterState =
        afterProjection.mapState sourceOccurrence.afterState :=
      piProjection.after_commutes.symm
    _ = afterProjection.mapState candidate.before := by
      rw [connects]

include alignment in
/-- The registry metadata is exactly the selected source DPO metadata. -/
theorem registryMetadataExact :
    alignment.metadata.registry =
      ProductPiOperationalSemantics.stableMetadataOfDPOEvent
        (sourceAfter.eventRecord candidate.event).event :=
  alignment.metadataRegistryExact

include alignment in
/-- Signature admission is the designated visible registration family. -/
theorem familyIsDynamicPartnerAdmission :
    alignment.operational.family (piSemantics.eventOf admission) =
      .dynamicPartnerAdmission :=
  alignment.admissionFamilyExact

include alignment in
/-- The admission version and tombstone are retained without overloading. -/
theorem admissionBoundaryMetadataExact :
    alignment.metadata.registry.version = admission.toVersion ∧
      alignment.metadata.tombstone = admission.tombstoneId :=
  ⟨alignment.metadata.registryVersion,
    alignment.metadata.tombstoneExact⟩

include alignment in
/-- Literal actual-Agent seam from admission to selected business. -/
theorem actualTargetIsSelectedBusinessSource :
    Cantilune.Pi.FMSActualAgentNormativeCommutation.normativeTargetAgent
        (alignment.operational.family
          (piSemantics.eventOf admission)) =
      Cantilune.Pi.FMSActualAgentNormativeCommutation.normativeSourceAgent
        business.family :=
  alignment.actualEndpointSeam

end ProductAdmissionPiFMSAlignment

/--
The reusable conformance input.

The `crossEpoch` field already contains the four static SMC families, their
static/operational coherence, the heterogeneous admission projections, the
fixed-epoch `ProductRuleProofBundle`, and the model-specific probability
scheduling obligations.  P1b and P1c are retained as separate complete
projections because neither is derivable from the generic four-view family.
-/
structure CoreConformancePackage
    (SourceCategory DagCategory PetriCategory PiCategory MorphismCategory :
      Type u)
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
    (source : ReindexableExecutionFamily)
    (dagFamily :
      ProjectionFamilyOver SourceCategory DagCategory source)
    (petriFamily :
      ProjectionFamilyOver SourceCategory PetriCategory source)
    (piFamily :
      ProjectionFamilyOver SourceCategory PiCategory source)
    (morphismFamily :
      ProjectionFamilyOver SourceCategory MorphismCategory source)
    {universes : ProjectionUniverses}
    {oldSignature newSignature : FinSignature}
    (admission :
      SignatureAdmissionEvent universes
        (source := oldSignature) (target := newSignature))
    (sourceSemantics :
      HeterogeneousAdmissionLTS
        (source.package oldSignature)
        (source.package newSignature))
    (sourceOccurrence :
      HeterogeneousPackageAdmission
        (source.package oldSignature)
        (source.package newSignature)
        sourceSemantics admission)
    (signatureCertificate :
      FourCoherentFamilyAdmission
        SourceCategory DagCategory PetriCategory PiCategory MorphismCategory
        source dagFamily petriFamily piFamily morphismFamily
        admission sourceSemantics sourceOccurrence)
    {KernelState : Type w} [Fintype KernelState] [DecidableEq KernelState]
    (kernel :
      NativeMarkovKernel newSignature
        (source.package newSignature) KernelState)
    (initial : InitialDistribution KernelState)
    (epsilon : Real)
    (RuleQualified RuleAuthorized :
      (source.package newSignature).lts.State →
        (source.package newSignature).lts.Event →
        (source.package newSignature).lts.State → Prop)
    (candidate : Candidate (source.package newSignature))
    (P1bSource P1bTarget P1cSource P1cTarget : ObservableLTS) where
  crossEpoch :
    CrossEpochProductFamily
      SourceCategory DagCategory PetriCategory PiCategory MorphismCategory
      source dagFamily petriFamily piFamily morphismFamily
      admission sourceSemantics sourceOccurrence signatureCertificate
      kernel initial epsilon RuleQualified RuleAuthorized candidate
  dagSemantic :
    DAGSemanticCertificate
      (source.package newSignature)
      (dagFamily.target.package newSignature)
      (dagFamily.operational newSignature)
      candidate
  petriSemantic :
    PetriSemanticCertificate
      (source.package newSignature)
      (petriFamily.target.package newSignature)
      (petriFamily.operational newSignature)
      candidate
  reconfigurablePetri :
    ReconfigurablePetriCertificate
      admission
      (source.package oldSignature)
      (source.package newSignature)
      (petriFamily.target.package oldSignature)
      (petriFamily.target.package newSignature)
      sourceSemantics signatureCertificate.petriSemantics sourceOccurrence
      (petriFamily.operational oldSignature)
      (petriFamily.operational newSignature)
      signatureCertificate.petri.admissionProjection
      candidate crossEpoch.connects petriSemantic
  p1b : ProjectionCertificate P1bSource P1bTarget
  p1c : ProjectionCertificate P1cSource P1cTarget
  p1bOccurrence : NativeOccurrence P1bSource
  p1cOccurrence : NativeOccurrence P1cSource
  piFMSAlignment :
    ProductPiFMSAlignment
      (source.package newSignature)
      (piFamily.target.package newSignature)
      (piFamily.operational newSignature)
      candidate
  admissionPiFMSAlignment :
    ProductAdmissionPiFMSAlignment
      admission sourceSemantics sourceOccurrence
      signatureCertificate.piSemantics
      (piFamily.operational oldSignature)
      (piFamily.operational newSignature)
      signatureCertificate.pi.admissionProjection
      candidate crossEpoch.connects piFMSAlignment

namespace CoreConformancePackage

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

variable
    (package :
      CoreConformancePackage
        SourceCategory DagCategory PetriCategory PiCategory MorphismCategory
        source dagFamily petriFamily piFamily morphismFamily
        admission sourceSemantics sourceOccurrence signatureCertificate
        kernel initial epsilon RuleQualified RuleAuthorized candidate
        P1bSource P1bTarget P1cSource P1cTarget)

/--
The assembled core conclusion.  Every field is derived from the supplied
kernel-checked certificates; no field is a restatement of an unchecked flag.
-/
structure Consistency where
  coherentAdmission :
    FourCoherentFamilyAdmission
      SourceCategory DagCategory PetriCategory PiCategory MorphismCategory
      source dagFamily petriFamily piFamily morphismFamily
      admission sourceSemantics sourceOccurrence
  crossEpochPaths :
    CrossEpochProductFamily.FourViewTrace package.crossEpoch
  crossEpochChains :
    CrossEpochProductFamily.FourEpochChainAgreement package.crossEpoch
  finiteAgreement :
    FiniteCrossEpochProductChain.CompleteAgreement
      (CrossEpochProductFamily.toFiniteChain package.crossEpoch)
  dagSemantic :
    DAGSemanticCertificate
      (source.package newSignature)
      (dagFamily.target.package newSignature)
      (dagFamily.operational newSignature)
      candidate
  petriSemantic :
    PetriSemanticCertificate
      (source.package newSignature)
      (petriFamily.target.package newSignature)
      (petriFamily.operational newSignature)
      candidate
  reconfigurablePetri :
    ReconfigurablePetriCertificate
      admission
      (source.package oldSignature)
      (source.package newSignature)
      (petriFamily.target.package oldSignature)
      (petriFamily.target.package newSignature)
      sourceSemantics signatureCertificate.petriSemantics sourceOccurrence
      (petriFamily.operational oldSignature)
      (petriFamily.operational newSignature)
      signatureCertificate.petri.admissionProjection
      candidate package.crossEpoch.connects package.petriSemantic
  p1bStrong :
    P1bTarget.ObservableStep
      (package.p1b.mapState package.p1bOccurrence.source)
      (package.p1b.mapEvent package.p1bOccurrence.event)
      (package.p1b.mapState package.p1bOccurrence.target)
  p1cStrong :
    P1cTarget.ObservableStep
      (package.p1c.mapState package.p1cOccurrence.source)
      (package.p1c.mapEvent package.p1cOccurrence.event)
      (package.p1c.mapState package.p1cOccurrence.target)
  p1bReflects :
    ∀ {targetEvent targetState},
      P1bTarget.ObservableStep
          (package.p1b.mapState package.p1bOccurrence.source)
          targetEvent targetState →
        ∃ sourceEvent sourceState,
          P1bSource.ObservableStep
              package.p1bOccurrence.source sourceEvent sourceState ∧
            package.p1b.Lift sourceEvent targetEvent ∧
            P1bTarget.stateSetoid.r
              targetState (package.p1b.mapState sourceState)
  p1cReflects :
    ∀ {targetEvent targetState},
      P1cTarget.ObservableStep
          (package.p1c.mapState package.p1cOccurrence.source)
          targetEvent targetState →
        ∃ sourceEvent sourceState,
          P1cSource.ObservableStep
              package.p1cOccurrence.source sourceEvent sourceState ∧
            package.p1c.Lift sourceEvent targetEvent ∧
            P1cTarget.stateSetoid.r
              targetState (package.p1c.mapState sourceState)
  p1bTerminals :
    ∀ state,
      (P1bTarget.SuccessfulTermination (package.p1b.mapState state) ↔
          P1bSource.SuccessfulTermination state) ∧
        (P1bTarget.ExternalWait (package.p1b.mapState state) ↔
          P1bSource.ExternalWait state) ∧
        (P1bTarget.Deadlocked (package.p1b.mapState state) ↔
          P1bSource.Deadlocked state)
  p1cTerminals :
    ∀ state,
      (P1cTarget.SuccessfulTermination (package.p1c.mapState state) ↔
          P1cSource.SuccessfulTermination state) ∧
        (P1cTarget.ExternalWait (package.p1c.mapState state) ↔
          P1cSource.ExternalWait state) ∧
      (P1cTarget.Deadlocked (package.p1c.mapState state) ↔
        P1cSource.Deadlocked state)
  piFMSAlignment :
    ProductPiFMSAlignment
      (source.package newSignature)
      (piFamily.target.package newSignature)
      (piFamily.operational newSignature)
      candidate
  admissionPiFMSAlignment :
    ProductAdmissionPiFMSAlignment
      admission sourceSemantics sourceOccurrence
      signatureCertificate.piSemantics
      (piFamily.operational oldSignature)
      (piFamily.operational newSignature)
      signatureCertificate.pi.admissionProjection
      candidate package.crossEpoch.connects package.piFMSAlignment
  epsilonPositive : 0 < epsilon
  epsilonAtMostOne : epsilon ≤ 1

/--
Main generic theorem: complete supplied certificates compose into one
cross-epoch four-projection result, while preserving genuine strong P1b/P1c
steps, full outgoing-step reflection, terminal classification, replay, exact
event marks, strict admission epochs, and the positive progress bound.
-/
def consistency : Consistency package where
  coherentAdmission := signatureCertificate
  crossEpochPaths :=
    CrossEpochProductFamily.four_projection_paths_and_replay
      package.crossEpoch
  crossEpochChains :=
    CrossEpochProductFamily.four_dependent_epoch_chains_complete
      package.crossEpoch
  finiteAgreement :=
    CrossEpochProductFamily.finiteChain_complete package.crossEpoch
  dagSemantic := package.dagSemantic
  petriSemantic := package.petriSemantic
  reconfigurablePetri := package.reconfigurablePetri
  p1bStrong := package.p1b.sound package.p1bOccurrence.native
  p1cStrong := package.p1c.sound package.p1cOccurrence.native
  p1bReflects := by
    intro targetEvent targetState step
    exact package.p1b.reflect step
  p1cReflects := by
    intro targetEvent targetState step
    exact package.p1c.reflect step
  p1bTerminals := package.p1b.terminal_classification_preserved
  p1cTerminals := package.p1c.terminal_classification_preserved
  piFMSAlignment := package.piFMSAlignment
  admissionPiFMSAlignment := package.admissionPiFMSAlignment
  epsilonPositive :=
    package.crossEpoch.ruleBundle.probability.positiveEpsilon
  epsilonAtMostOne :=
    package.crossEpoch.ruleBundle.probability.epsilonAtMostOne

/-- Public existential form used by downstream product-conformance gates. -/
theorem four_projection_core_consistency :
    Nonempty (Consistency package) :=
  ⟨package.consistency⟩

end CoreConformancePackage

/-! ## Nonempty, non-identity reference package -/

namespace Reference

namespace Admission

open
  Cantilune.Theorems.HeterogeneousProductRuleAdmissionReference.Reference

abbrev executionFamily :=
  Cantilune.Theorems.HeterogeneousProductRuleAdmissionReference.Reference.executionFamily
abbrev identityFamily :=
  Cantilune.Theorems.HeterogeneousProductRuleAdmissionReference.Reference.identityFamily
abbrev admission :=
  Cantilune.Theorems.HeterogeneousProductRuleAdmissionReference.Reference.admission
abbrev admissionSemantics :=
  Cantilune.Theorems.HeterogeneousProductRuleAdmissionReference.Reference.admissionSemantics
abbrev admissionOccurrence :=
  Cantilune.Theorems.HeterogeneousProductRuleAdmissionReference.Reference.admissionOccurrence
abbrev fourCoherent :=
  Cantilune.Theorems.HeterogeneousProductRuleAdmissionReference.Reference.fourCoherent
abbrev kernel :=
  Cantilune.Theorems.HeterogeneousProductRuleAdmissionReference.Reference.kernel
abbrev initial :=
  Cantilune.Theorems.HeterogeneousProductRuleAdmissionReference.Reference.initial
abbrev qualified :=
  Cantilune.Theorems.HeterogeneousProductRuleAdmissionReference.Reference.qualified
abbrev authorized :=
  Cantilune.Theorems.HeterogeneousProductRuleAdmissionReference.Reference.authorized

end Admission

namespace Rule

abbrev occurrence :=
  Cantilune.Theorems.P1cProductRuleProofBundle.Reference.occurrence
abbrev signature :=
  Cantilune.Theorems.P1cProductRuleProofBundle.Reference.signature
abbrev proofBundle :=
  Cantilune.Theorems.P1cProductRuleProofBundle.Reference.proofBundle

theorem reconnect_changes_graph :
    occurrence.target.edges = {(0, 1)} ∧
      occurrence.target.edges ≠ occurrence.source.edges :=
  Cantilune.Theorems.P1cProductRuleProofBundle.Reference.reconnect_changes_graph

theorem four_business_steps_native :
    Cantilune.Pi.P1cAdmittedOperations.DAG.Step
        occurrence.source occurrence.request occurrence.target ∧
      Cantilune.Pi.P1cAdmittedOperations.Petri.Step
        occurrence.source occurrence.request occurrence.target ∧
      Cantilune.Pi.Late.NativeStep
        (Cantilune.Pi.P1cAdmittedOperations.PiView.source occurrence.request)
        .tau
        (Cantilune.Pi.P1cAdmittedOperations.PiView.target occurrence.request) ∧
      Cantilune.Pi.P1cAdmittedOperations.Morphism.Step
        occurrence.source occurrence.request occurrence.target :=
  Cantilune.Theorems.P1cProductRuleProofBundle.Reference.four_business_steps_native

end Rule

namespace P1b

abbrev pi_ra_certificate :=
  Cantilune.Pi.P1bNominalIncidenceClosure.pi_ra_certificate

end P1b

namespace P1c

abbrev sourceLTS := Cantilune.Pi.P1cFullNativeRefinement.sourceLTS
abbrev targetLTS := Cantilune.Pi.P1cFullNativeRefinement.targetLTS
abbrev afterFirst := Cantilune.Pi.P1cFullNativeRefinement.afterFirst
abbrev certificate := Cantilune.Pi.P1cFullNativeRefinement.certificate

end P1c

namespace RA

abbrev sourceLTS := Cantilune.Pi.Certificates.RequestAccept.sourceLTS

end RA

/-- The coherent reference boundary followed by its admitted business rule. -/
def crossEpoch :
    CrossEpochProductFamily
      (Type 0) (Type 0) (Type 0) (Type 0) (Type 0)
      Admission.executionFamily
      Admission.identityFamily Admission.identityFamily
      Admission.identityFamily Admission.identityFamily
      Admission.admission Admission.admissionSemantics
      Admission.admissionOccurrence Admission.fourCoherent
      Admission.kernel Admission.initial (1 : Real)
      Admission.qualified Admission.authorized
      ProductRuleProofBundle.GateReference.candidate where
  connects := rfl
  ruleBundle := ProductRuleProofBundle.GateReference.bundle

/--
The small identity-family fixture still carries the canonical DAG semantics:
its mapped endpoint configurations are definitionally the source endpoints,
so SCC condensation and strict ranking are computed from the actual selected
DPO record rather than from a freely supplied graph.
-/
def dagSemantic :
    DAGSemanticCertificate
      ProductRuleProofBundle.GateReference.sourcePackage
      ProductRuleProofBundle.GateReference.targetPackage
      ProductRuleProofBundle.GateReference.identityProjection
      ProductRuleProofBundle.GateReference.candidate where
  sourceOccurrence :=
    ProductRuleProofBundle.GateReference.bundle.sourceOccurrence
  occurrence :=
    ProductRuleProofBundle.GateReference.bundle.dag
  eventRecordExact := rfl
  beforeConfig := rfl
  afterConfig := rfl

/-- The exact fixed-epoch event selected immediately after admission. -/
abbrev selectedPetriEvent :=
  (ProductRuleProofBundle.GateReference.sourcePackage.eventRecord
    ProductRuleProofBundle.GateReference.candidate.event).event

/-- A nonempty legacy declaration retained across the signature boundary. -/
def legacyPetriDeclaration : PetriRuleDeclaration where
  signatureVersion := Admission.admission.fromVersion
  ruleId := 7000
  ordinal := 0

/-- The newly admitted rule is appended after every legacy declaration. -/
def admittedPetriDeclaration : PetriRuleDeclaration :=
  declarationOfEvent selectedPetriEvent 1

theorem admittedPetriDeclaration_ne_legacy :
    admittedPetriDeclaration ≠ legacyPetriDeclaration := by
  decide

def legacyPetriBeforeConfig :
    Config
      Cantilune.Theorems.HeterogeneousProductRuleAdmissionReference.Reference.oldSignature where
  signatureVersion := Admission.admission.fromVersion
  nodes := ∅
  edges := ∅
  nodeLabel := fun _ => none
  dataTokens := ∅
  resourceTokens := ∅
  names := ∅
  dataOwner := fun _ => none
  resourceOwner := fun _ => none
  sessionOwner := fun _ => none
  externalObservations := []
  policyState := 0
  tombstones := ∅

def legacyPetriAfterConfig :
    Config
      Cantilune.Theorems.HeterogeneousProductRuleAdmissionReference.Reference.oldSignature :=
  { legacyPetriBeforeConfig with policyState := 1 }

def legacyPetriTransition :
    Cantilune.Core.DPO.FiniteSupportEvent
      (ProvenanceToken
        Cantilune.Theorems.HeterogeneousProductRuleAdmissionReference.Reference.oldSignature) :=
  endpointDelta legacyPetriBeforeConfig legacyPetriAfterConfig

theorem legacyPetriTransition_nonempty :
    ProvenanceToken.policy 1 ∈ legacyPetriTransition.insert := by
  simp [legacyPetriTransition, endpointDelta,
    legacyPetriBeforeConfig, legacyPetriAfterConfig,
    provenanceMarking, optionalAtom]

def legacyPetriNet :
    OrderedPreNet
      (Cantilune.Core.DPO.FiniteSupportEvent
        (ProvenanceToken
          Cantilune.Theorems.HeterogeneousProductRuleAdmissionReference.Reference.oldSignature)) :=
  singletonDeclarationNet legacyPetriDeclaration legacyPetriTransition

def admittedPetriNet :
    OrderedPreNet
      (Cantilune.Core.DPO.FiniteSupportEvent
        (ProvenanceToken
          Cantilune.Theorems.HeterogeneousProductRuleAdmissionReference.Reference.newSignature)) :=
  appendReindexedPreNet
    (reindexFiniteSupportEvent Admission.admission.extension)
    legacyPetriNet
    admittedPetriDeclaration
    (endpointDelta selectedPetriEvent.source selectedPetriEvent.target)
    (by decide)
    (by decide)

/-- Canonical appended declaration and individual-token semantics. -/
def petriSemantic :
    PetriSemanticCertificate
      ProductRuleProofBundle.GateReference.sourcePackage
      ProductRuleProofBundle.GateReference.targetPackage
      ProductRuleProofBundle.GateReference.identityProjection
      ProductRuleProofBundle.GateReference.candidate where
  sourceOccurrence :=
    ProductRuleProofBundle.GateReference.bundle.sourceOccurrence
  occurrence :=
    ProductRuleProofBundle.GateReference.bundle.petri
  eventRecordExact := rfl
  beforeConfig := rfl
  afterConfig := rfl
  net := admittedPetriNet
  selectedDeclaration := admittedPetriDeclaration
  selectedDeclared := by
    simp [admittedPetriNet, appendReindexedPreNet]
  selectedVersion := rfl
  selectedRule := rfl
  selectedIncidenceExact := by
    simp [admittedPetriNet, appendReindexedPreNet,
      legacyPetriNet, singletonDeclarationNet,
      admittedPetriDeclaration_ne_legacy]

/-- The old nonempty pre-net is retained and the admitted rule is appended. -/
def petriNetExtension :
    PreNetExtension Admission.admission legacyPetriNet
      admittedPetriNet admittedPetriDeclaration where
  appendedDeclarations := [admittedPetriDeclaration]
  declarationsAppend := rfl
  oldDeclaredInNew := by
    intro declaration declared
    simp only [admittedPetriNet, appendReindexedPreNet,
      List.mem_append, List.mem_singleton]
    exact Or.inl declared
  oldIncidencePreserved := by
    intro declaration declared
    simp [admittedPetriNet, appendReindexedPreNet, declared]
  selectedInAppend := by simp
  selectedNotOld := by
    simp [legacyPetriNet, singletonDeclarationNet,
      admittedPetriDeclaration_ne_legacy]
  extensionAddsGenerator := by
    intro surjective
    obtain ⟨generator, equality⟩ :=
      surjective
        Cantilune.Pi.AdmissionCertificate.ReferenceSignature.TargetGenerator.admitted
    cases generator
    cases equality
  traceTombstone := Admission.admission.tombstoneId
  traceTombstoneExact := rfl
  selectedAdmissionVersion := rfl

def reconfigurablePetri :
    ReconfigurablePetriCertificate
      Admission.admission
      (Admission.executionFamily.package
        Cantilune.Theorems.HeterogeneousProductRuleAdmissionReference.Reference.oldSignature)
      (Admission.executionFamily.package
        Cantilune.Theorems.HeterogeneousProductRuleAdmissionReference.Reference.newSignature)
      (Admission.identityFamily.target.package
        Cantilune.Theorems.HeterogeneousProductRuleAdmissionReference.Reference.oldSignature)
      (Admission.identityFamily.target.package
        Cantilune.Theorems.HeterogeneousProductRuleAdmissionReference.Reference.newSignature)
      Admission.admissionSemantics Admission.fourCoherent.petriSemantics
      Admission.admissionOccurrence
      (Admission.identityFamily.operational
        Cantilune.Theorems.HeterogeneousProductRuleAdmissionReference.Reference.oldSignature)
      (Admission.identityFamily.operational
        Cantilune.Theorems.HeterogeneousProductRuleAdmissionReference.Reference.newSignature)
      Admission.fourCoherent.petri.admissionProjection
      ProductRuleProofBundle.GateReference.candidate crossEpoch.connects
      petriSemantic :=
  ReconfigurablePetriCertificate.ofPreNetExtension
    legacyPetriNet petriNetExtension

def p1bOccurrence : NativeOccurrence RA.sourceLTS where
  source := .requesting
  event := .establishSession
  target := .established
  native :=
    ⟨Cantilune.Pi.Certificates.RequestAccept.Step.establishSession, trivial⟩

def p1cOccurrence : NativeOccurrence P1c.sourceLTS where
  source := .ready .instanceReconnect
  event := .execute .instanceReconnect
  target := P1c.afterFirst .instanceReconnect
  native :=
    ⟨Cantilune.Pi.P1cFullNativeRefinement.Step.execute
        .instanceReconnect,
      trivial⟩

/-- Raw realization of the small generic reference pi state. -/
def referencePiStateRealization :
    Cantilune.Theorems.HeterogeneousProductRuleAdmissionReference.Reference.State →
      Cantilune.Pi.Raw.Proc
  | .legacy =>
      Cantilune.Pi.P1cFullNativeRefinement.terminalProcess
        .instanceReconnect
  | .ready =>
      Cantilune.Pi.P1cFullNativeRefinement.readyProcess
        .instanceReconnect
  | .done =>
      Cantilune.Pi.P1cFullNativeRefinement.firstTarget
        .instanceReconnect

/-- Raw realization of the small generic reference pi event. -/
def referencePiEventRealization :
    Cantilune.Theorems.HeterogeneousProductRuleAdmissionReference.Reference.Event →
      Cantilune.Pi.Raw.Action
  | .business =>
      Cantilune.Pi.P1cFullNativeRefinement.firstAction
        .instanceReconnect

/--
The small reference π event is enriched by the exact registry position and
stable identifiers; its family is therefore decoded as
`.instanceReconnect`.
-/
def referencePiOperational :
    ProductPiOperationalSemantics
      (Admission.identityFamily.target.package
        Cantilune.Theorems.HeterogeneousProductRuleAdmissionReference.Reference.newSignature) where
  operation := fun _ =>
    Cantilune.Pi.P1cOperationRegistry.instanceReconnectOperation
  fromPhase := fun _ => .requested
  toPhase := fun _ => .reconnected
  statePayload := referencePiStateRealization
  actionPayload := referencePiEventRealization

/-- The selected fixed-epoch business π/FMS alignment. -/
def referencePiFMSAlignment :
    ProductPiFMSAlignment
      (Admission.executionFamily.package
        Cantilune.Theorems.HeterogeneousProductRuleAdmissionReference.Reference.newSignature)
      (Admission.identityFamily.target.package
        Cantilune.Theorems.HeterogeneousProductRuleAdmissionReference.Reference.newSignature)
      (Admission.identityFamily.operational
        Cantilune.Theorems.HeterogeneousProductRuleAdmissionReference.Reference.newSignature)
      ProductRuleProofBundle.GateReference.candidate where
  operational := referencePiOperational
  projectedNative :=
    ProductRuleProofBundle.GateReference.bundle.pi.native
  realizesProjected := by
    apply
      Cantilune.Pi.P1cOperationRegistry.RegistryNativeStep.native
    exact
      Cantilune.Pi.P1cFullNativeRefinement.first_native
        .instanceReconnect
  source_to_family := by
    exact Cantilune.Pi.Late.Struct.refl _
  derivative_to_family := by
    exact
      Cantilune.Pi.OpenSMCActionAlpha.DerivativeAlpha.refl _
  compiled :=
    Cantilune.Pi.FMSActualAgentNormativeOperationalBridge.compiledCanonicalPointed
      .instanceReconnect
  actual :=
    Cantilune.Pi.FMSActualAgentNormativeOperationalBridge.totalCompiledNormativeCommutation
      .instanceReconnect

/-- Raw realization of the exact heterogeneous target admission. -/
def referenceAdmissionPiOperational :
    ProductAdmissionPiOperationalSemantics
      Admission.fourCoherent.piSemantics where
  operation := fun _ =>
    Cantilune.Pi.P1cOperationRegistry.dynamicPartnerAdmissionOperation
  fromPhase := fun _ => .requested
  toPhase := fun _ => .admitted
  beforePayload := fun _ =>
    Cantilune.Pi.P1cFullNativeRefinement.readyProcess
      .dynamicPartnerAdmission
  afterPayload := fun _ =>
    Cantilune.Pi.P1cFullNativeRefinement.firstTarget
      .dynamicPartnerAdmission
  actionPayload := fun _ =>
    Cantilune.Pi.P1cFullNativeRefinement.firstAction
      .dynamicPartnerAdmission

/--
The generic reference's exact target admission is connected to its selected
business candidate in raw late-pi, replay metadata, and the actual Agent.
-/
def referenceAdmissionPiFMSAlignment :
    ProductAdmissionPiFMSAlignment
      Admission.admission Admission.admissionSemantics
      Admission.admissionOccurrence Admission.fourCoherent.piSemantics
      (Admission.identityFamily.operational
        Cantilune.Theorems.HeterogeneousProductRuleAdmissionReference.Reference.oldSignature)
      (Admission.identityFamily.operational
        Cantilune.Theorems.HeterogeneousProductRuleAdmissionReference.Reference.newSignature)
      Admission.fourCoherent.pi.admissionProjection
      ProductRuleProofBundle.GateReference.candidate crossEpoch.connects
      referencePiFMSAlignment where
  operational := referenceAdmissionPiOperational
  metadata :=
    { registry :=
        ProductPiOperationalSemantics.stableMetadataOfDPOEvent
          (ProductRuleProofBundle.GateReference.sourcePackage.eventRecord
            ProductRuleProofBundle.GateReference.candidate.event).event
      tombstone := Admission.admission.tombstoneId
      registryVersion := rfl
      tombstoneExact := rfl }
  metadataRegistryExact := rfl
  admissionFamilyExact := by decide
  realizesTargetAdmission := by
    apply Cantilune.Pi.P1cOperationRegistry.RegistryNativeStep.native
    exact
      Cantilune.Pi.P1cFullNativeRefinement.first_native
        .dynamicPartnerAdmission
  source_to_family := Cantilune.Pi.Late.Struct.refl _
  derivative_to_business :=
    Cantilune.Pi.OpenSMCActionAlpha.DerivativeAlpha.refl _
  actual :=
    Cantilune.Pi.FMSActualAgentNormativeOperationalBridge.totalCompiledNormativeCommutation
      .dynamicPartnerAdmission
  actualEndpointSeam :=
    Cantilune.Pi.FMSActualAgentNormativeCommutation.dynamic_admission_target_eq_reconnect_source

def core :
    CoreConformancePackage
      (Type 0) (Type 0) (Type 0) (Type 0) (Type 0)
      Admission.executionFamily
      Admission.identityFamily Admission.identityFamily
      Admission.identityFamily Admission.identityFamily
      Admission.admission Admission.admissionSemantics
      Admission.admissionOccurrence Admission.fourCoherent
      Admission.kernel Admission.initial (1 : Real)
      Admission.qualified Admission.authorized
      ProductRuleProofBundle.GateReference.candidate
      RA.sourceLTS Cantilune.Pi.Late.structuralLateLTS
      P1c.sourceLTS P1c.targetLTS where
  crossEpoch := crossEpoch
  dagSemantic := dagSemantic
  petriSemantic := petriSemantic
  reconfigurablePetri := reconfigurablePetri
  p1b := P1b.pi_ra_certificate
  p1c := P1c.certificate
  p1bOccurrence := p1bOccurrence
  p1cOccurrence := p1cOccurrence
  piFMSAlignment := referencePiFMSAlignment
  admissionPiFMSAlignment := referenceAdmissionPiFMSAlignment

/--
The anti-vacuity package also includes the substantive reconnect rule and the
closed authorized-feedback execution.  These are actual inhabitants, not
fields of an assumed product interface.
-/
structure Package where
  generic :
    CoreConformancePackage
      (Type 0) (Type 0) (Type 0) (Type 0) (Type 0)
      Admission.executionFamily
      Admission.identityFamily Admission.identityFamily
      Admission.identityFamily Admission.identityFamily
      Admission.admission Admission.admissionSemantics
      Admission.admissionOccurrence Admission.fourCoherent
      Admission.kernel Admission.initial (1 : Real)
      Admission.qualified Admission.authorized
      ProductRuleProofBundle.GateReference.candidate
      RA.sourceLTS Cantilune.Pi.Late.structuralLateLTS
      P1c.sourceLTS P1c.targetLTS
  reconnectRule :
    ProductRuleProofBundle
      (Cantilune.Theorems.P1cProductRuleProofBundle.sourcePackage
        Rule.occurrence)
      (Cantilune.Theorems.P1cProductRuleProofBundle.targetPackage
        .dag Rule.occurrence)
      (Cantilune.Theorems.P1cProductRuleProofBundle.targetPackage
        .petri Rule.occurrence)
      (Cantilune.Theorems.P1cProductRuleProofBundle.targetPackage
        .pi Rule.occurrence)
      (Cantilune.Theorems.P1cProductRuleProofBundle.targetPackage
        .morphism Rule.occurrence)
      (Cantilune.Theorems.P1cProductRuleProofBundle.projection
        .dag Rule.occurrence)
      (Cantilune.Theorems.P1cProductRuleProofBundle.projection
        .petri Rule.occurrence)
      (Cantilune.Theorems.P1cProductRuleProofBundle.projection
        .pi Rule.occurrence)
      (Cantilune.Theorems.P1cProductRuleProofBundle.projection
        .morphism Rule.occurrence)
      (Cantilune.Pi.P1cAdmittedTrajectory.stateKernel Rule.occurrence)
      Cantilune.Pi.P1cAdmittedTrajectory.initial
      (1 : Real)
      (Cantilune.Theorems.P1cProductRuleProofBundle.RuleQualified
        Rule.occurrence)
      (Cantilune.Theorems.P1cProductRuleProofBundle.RuleAuthorized
        Rule.occurrence)
      (Cantilune.Theorems.P1cProductRuleProofBundle.candidate
        Rule.occurrence)
  feedback :
    Cantilune.Feedback.AuthorizedFeedbackClosure.ReferenceClosure
      Rule.signature
  reconnectChangesGraph :
    Rule.occurrence.target.edges = {(0, 1)} ∧
      Rule.occurrence.target.edges ≠ Rule.occurrence.source.edges
  reconnectNativeInAllViews :
    Cantilune.Pi.P1cAdmittedOperations.DAG.Step
        Rule.occurrence.source Rule.occurrence.request Rule.occurrence.target ∧
      Cantilune.Pi.P1cAdmittedOperations.Petri.Step
        Rule.occurrence.source Rule.occurrence.request Rule.occurrence.target ∧
      Cantilune.Pi.Late.NativeStep
        (Cantilune.Pi.P1cAdmittedOperations.PiView.source
          Rule.occurrence.request)
        .tau
        (Cantilune.Pi.P1cAdmittedOperations.PiView.target
          Rule.occurrence.request) ∧
      Cantilune.Pi.P1cAdmittedOperations.Morphism.Step
        Rule.occurrence.source Rule.occurrence.request Rule.occurrence.target

def package : Package where
  generic := core
  reconnectRule := Rule.proofBundle
  feedback :=
    Cantilune.Feedback.AuthorizedFeedbackClosure.referenceClosure
      Rule.signature
  reconnectChangesGraph := Rule.reconnect_changes_graph
  reconnectNativeInAllViews := Rule.four_business_steps_native

/-- The reference inhabits the full facade and includes a genuine graph update. -/
theorem package_nonempty : Nonempty Package :=
  ⟨package⟩

/-- The generic conclusion is kernel-derived for the concrete reference. -/
theorem reference_consistency :
    Nonempty (CoreConformancePackage.Consistency core) :=
  CoreConformancePackage.four_projection_core_consistency core

/--
Kernel-level anti-vacuity: the reference is not merely four identity views;
its separately gated reconnect rule changes the graph and exposes all four
independent native payloads.
-/
theorem reference_is_substantive :
    Rule.occurrence.target.edges ≠ Rule.occurrence.source.edges ∧
      Cantilune.Pi.P1cAdmittedOperations.DAG.Step
        Rule.occurrence.source Rule.occurrence.request Rule.occurrence.target ∧
      Cantilune.Pi.P1cAdmittedOperations.Petri.Step
        Rule.occurrence.source Rule.occurrence.request Rule.occurrence.target ∧
      Cantilune.Pi.Late.NativeStep
        (Cantilune.Pi.P1cAdmittedOperations.PiView.source
          Rule.occurrence.request)
        .tau
        (Cantilune.Pi.P1cAdmittedOperations.PiView.target
          Rule.occurrence.request) ∧
      Cantilune.Pi.P1cAdmittedOperations.Morphism.Step
        Rule.occurrence.source Rule.occurrence.request Rule.occurrence.target :=
  ⟨package.reconnectChangesGraph.2, package.reconnectNativeInAllViews⟩

end Reference

end Cantilune.Theorems.CoreConformance
