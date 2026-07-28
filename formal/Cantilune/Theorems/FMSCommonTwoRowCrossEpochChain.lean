import Cantilune.Theorems.FMSGatedFiniteCrossEpochProductChain
import Cantilune.Feedback.FiniteCrossEpochProductTrajectory

/-!
# A common-FMS, endpoint-carried two-row cross-epoch chain

The direct `CrossEpochProductFamily.toFiniteChain` adapter cannot be appended
to another direct adapter.  Its final epoch contains the row's singleton
business event, whereas the next adapter manufactures a fresh empty
pre-admission epoch.  Equality of those records would erase real event
history.

This module gives the minimal non-erasing repair for two adjacent product
families:

* the second admission starts at the first family's actual eventful
  `afterReplayEpoch`;
* a source-state seam identifies the first rule target with the second
  admission source;
* all four projected replay seams follow from that source seam and the fixed
  operational projection families;
* both rows are indexed by one definitionally shared
  `ExactFMSAcceptancePackage`; and
* a separate denotational seam identifies the first rule denotation with the
  second admission-source denotation.

The result is a genuine four-edge FMS path

`admission₁ ; rule₁ ; admission₂ ; rule₂`

and a two-boundary five-view operational chain.  No empty-event equality,
proof irrelevance, weak transition, or locally constructed FMS package is
used.  The theorem remains conditional on supplied product families and a
supplied exact FMS package.
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
open Cantilune.Feedback.FiniteHeterogeneousProbability
open Cantilune.Feedback.FiniteHeterogeneousTrajectory
open Cantilune.Feedback.FiniteHeterogeneousMarkedKernel
open Cantilune.Feedback.FiniteHeterogeneousFourProjection
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

/-! ## A row whose FMS package is an index, rather than an unconstrained field -/

variable
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
      (source.package newSignature).lts.State ->
      (source.package newSignature).lts.Event ->
      (source.package newSignature).lts.State -> Prop}
    {candidate : Candidate (source.package newSignature)}
    {family :
      CrossEpochProductFamily
        SourceCategory DagCategory PetriCategory PiCategory MorphismCategory
        source dagFamily petriFamily piFamily morphismFamily
        admission sourceSemantics sourceOccurrence signatureCertificate
        kernel initial epsilon RuleQualified RuleAuthorized candidate}

/--
The one-row evidence with the FMS package made an explicit index.

Unlike `FMSGatedCrossEpochEvidence`, two values of this type at different
rows cannot silently carry different packages when their `commonFMS`
parameter is the same.
-/
structure SharedFMSGatedCrossEpochEvidence
    (commonFMS : ExactFMSAcceptancePackage)
    (family :
      CrossEpochProductFamily
        SourceCategory DagCategory PetriCategory PiCategory MorphismCategory
        source dagFamily petriFamily piFamily morphismFamily
        admission sourceSemantics sourceOccurrence signatureCertificate
        kernel initial epsilon RuleQualified RuleAuthorized candidate) where
  newPi :
    OperationalFMSPiCoherence commonFMS
      (source.package newSignature).lts
      (piFamily.target.package newSignature).lts
      (piFamily.operational newSignature)
  oldSourceProcess :
    (source.package oldSignature).lts.State -> ClosedRaw
  oldTargetDenotation :
    (piFamily.target.package oldSignature).lts.State ->
      commonFMS.base.domain.agent.obj 0
  admissionAction :
    signatureCertificate.piSemantics.Event -> Raw.Action
  old_mapped_state_denotation :
    ∀ state,
      oldTargetDenotation
          ((piFamily.toProjectionFamily.operational oldSignature).mapState
            state) =
        commonFMS.base.lateFullAbstraction.denote
          (oldSourceProcess state)
  mapped_admission_iff :
    ∀ {before event after},
      signatureCertificate.piSemantics.step
          ((piFamily.toProjectionFamily.operational oldSignature).mapState
            before)
          event
          ((piFamily.toProjectionFamily.operational newSignature).mapState
            after) ↔
        commonFMS.base.lateFullAbstraction.transition
          (commonFMS.base.lateFullAbstraction.denote
            (oldSourceProcess before))
          (admissionAction event)
          (newPi.targetDenotation
            ((piFamily.toProjectionFamily.operational newSignature).mapState
              after))

namespace SharedFMSGatedCrossEpochEvidence

variable
    {commonFMS : ExactFMSAcceptancePackage}
    (evidence :
      SharedFMSGatedCrossEpochEvidence
        (SourceCategory := SourceCategory)
        (DagCategory := DagCategory)
        (PetriCategory := PetriCategory)
        (PiCategory := PiCategory)
        (MorphismCategory := MorphismCategory)
        commonFMS family)

include evidence

/-- Forget only the common-package index; no field is changed. -/
def toExisting :
    FMSGatedCrossEpochEvidence
      (SourceCategory := SourceCategory)
      (DagCategory := DagCategory)
      (PetriCategory := PetriCategory)
      (PiCategory := PiCategory)
      (MorphismCategory := MorphismCategory)
      family where
  fms := commonFMS
  newPi := evidence.newPi
  oldSourceProcess := evidence.oldSourceProcess
  oldTargetDenotation := evidence.oldTargetDenotation
  admissionAction := evidence.admissionAction
  old_mapped_state_denotation := evidence.old_mapped_state_denotation
  mapped_admission_iff := evidence.mapped_admission_iff

/-- The indexed package is definitionally retained by the old interface. -/
@[simp] theorem toExisting_fms :
    evidence.toExisting.fms = commonFMS :=
  rfl

/-- Native admission transition for this row in the common package. -/
theorem admission_native :
    commonFMS.base.lateFullAbstraction.transition
      (evidence.oldTargetDenotation
        ((piFamily.toProjectionFamily.operational oldSignature).mapState
          sourceOccurrence.beforeState))
      (evidence.admissionAction
        (signatureCertificate.pi.admissionProjection.mapAdmissionEvent
          (sourceSemantics.eventOf admission)))
      (evidence.newPi.targetDenotation
        ((piFamily.toProjectionFamily.operational newSignature).mapState
          candidate.before)) :=
  evidence.toExisting.admission_native_fms_from_mapped_state

/-- Native fixed-signature rule transition for this row in the common package. -/
theorem rule_native :
    commonFMS.base.lateFullAbstraction.transition
      (commonFMS.base.lateFullAbstraction.denote
        (evidence.newPi.sourceProcess candidate.before))
      (evidence.newPi.targetAction
        ((piFamily.operational newSignature).mapEvent candidate.event))
      (evidence.newPi.targetDenotation
        ((piFamily.operational newSignature).mapState candidate.after)) :=
  evidence.toExisting.rule_pi_native_fms

/-- The row also supplies the existing strongest one-row conclusion. -/
theorem row_conclusion :
    FMSGatedCrossEpochConclusion family evidence.toExisting :=
  fms_gated_cross_epoch_product_consistency evidence.toExisting

end SharedFMSGatedCrossEpochEvidence

/-! ## Native denotational paths -/

/--
A finite path of native transitions in one exact FMS package.

The intermediate state is a dependent index of `cons`, so consecutive
transitions must share their denotational endpoint exactly.
-/
inductive ExactFMSNativePath
    (fms : ExactFMSAcceptancePackage) :
    fms.base.domain.agent.obj 0 ->
    List Raw.Action ->
    fms.base.domain.agent.obj 0 -> Prop
  | nil (state : fms.base.domain.agent.obj 0) :
      ExactFMSNativePath fms state [] state
  | cons
      {source middle target : fms.base.domain.agent.obj 0}
      {action : Raw.Action} {actions : List Raw.Action}
      (head :
        fms.base.lateFullAbstraction.transition source action middle)
      (tail : ExactFMSNativePath fms middle actions target) :
      ExactFMSNativePath fms source (action :: actions) target

/--
The strongest package-independent finite-chain/FMS path interface supplied by
this module.

For an arbitrary already-certified finite five-view chain, a caller supplies:

* one interpretation of its exact dependent source labels as raw pi actions;
* an exact positional `List.Forall₂` relation between source labels and the
  FMS action list; and
* one native path in one common exact FMS package over precisely that list.

This record constructs neither the chain, the package, nor a product
probability kernel.
-/
structure FiniteCommonFMSPathAgreement
    (fms : ExactFMSAcceptancePackage)
    {first last : FourProjectionReplayEpoch}
    (chain : FiniteCrossEpochProductChain universes first last) where
  sourceAction :
    ChainEvent universes chain.sourceChain -> Raw.Action
  actions : List Raw.Action
  source : fms.base.domain.agent.obj 0
  target : fms.base.domain.agent.obj 0
  positions :
    List.Forall₂
      (fun sourceEvent action => sourceAction sourceEvent = action)
      (traceEvents chain.sourceChain) actions
  native :
    ExactFMSNativePath fms source actions target

/-! ## Two adjacent product families -/

section TwoRows

variable
    {signature₀ signature₁ signature₂ : FinSignature}
    {admission₁ :
      SignatureAdmissionEvent universes
        (source := signature₀) (target := signature₁)}
    {admission₂ :
      SignatureAdmissionEvent universes
        (source := signature₁) (target := signature₂)}
    {sourceSemantics₁ :
      HeterogeneousAdmissionLTS
        (source.package signature₀)
        (source.package signature₁)}
    {sourceSemantics₂ :
      HeterogeneousAdmissionLTS
        (source.package signature₁)
        (source.package signature₂)}
    {sourceOccurrence₁ :
      HeterogeneousPackageAdmission
        (source.package signature₀)
        (source.package signature₁)
        sourceSemantics₁ admission₁}
    {sourceOccurrence₂ :
      HeterogeneousPackageAdmission
        (source.package signature₁)
        (source.package signature₂)
        sourceSemantics₂ admission₂}
    {signatureCertificate₁ :
      FourCoherentFamilyAdmission
        SourceCategory DagCategory PetriCategory PiCategory MorphismCategory
        source dagFamily petriFamily piFamily morphismFamily
        admission₁ sourceSemantics₁ sourceOccurrence₁}
    {signatureCertificate₂ :
      FourCoherentFamilyAdmission
        SourceCategory DagCategory PetriCategory PiCategory MorphismCategory
        source dagFamily petriFamily piFamily morphismFamily
        admission₂ sourceSemantics₂ sourceOccurrence₂}
    {KernelState₁ KernelState₂ : Type w}
    [Fintype KernelState₁] [DecidableEq KernelState₁]
    [Fintype KernelState₂] [DecidableEq KernelState₂]
    {kernel₁ :
      NativeMarkovKernel signature₁
        (source.package signature₁) KernelState₁}
    {kernel₂ :
      NativeMarkovKernel signature₂
        (source.package signature₂) KernelState₂}
    {initial₁ : InitialDistribution KernelState₁}
    {initial₂ : InitialDistribution KernelState₂}
    {epsilon₁ epsilon₂ : Real}
    {RuleQualified₁ RuleAuthorized₁ :
      (source.package signature₁).lts.State ->
      (source.package signature₁).lts.Event ->
      (source.package signature₁).lts.State -> Prop}
    {RuleQualified₂ RuleAuthorized₂ :
      (source.package signature₂).lts.State ->
      (source.package signature₂).lts.Event ->
      (source.package signature₂).lts.State -> Prop}
    {candidate₁ : Candidate (source.package signature₁)}
    {candidate₂ : Candidate (source.package signature₂)}
    {family₁ :
      CrossEpochProductFamily
        SourceCategory DagCategory PetriCategory PiCategory MorphismCategory
        source dagFamily petriFamily piFamily morphismFamily
        admission₁ sourceSemantics₁ sourceOccurrence₁ signatureCertificate₁
        kernel₁ initial₁ epsilon₁ RuleQualified₁ RuleAuthorized₁ candidate₁}
    {family₂ :
      CrossEpochProductFamily
        SourceCategory DagCategory PetriCategory PiCategory MorphismCategory
        source dagFamily petriFamily piFamily morphismFamily
        admission₂ sourceSemantics₂ sourceOccurrence₂ signatureCertificate₂
        kernel₂ initial₂ epsilon₂ RuleQualified₂ RuleAuthorized₂ candidate₂}

/--
The direct adapters have incompatible middle event histories, independently
of their state endpoints.
-/
theorem directAdapterMiddle_ne :
    CrossEpochProductFamily.afterReplayEpoch family₁ ≠
      CrossEpochProductFamily.beforeReplayEpoch family₂ :=
  FMSGatedFiniteChain.singletonSourceEvents_ne_emptySourceEvents
    (CrossEpochProductFamily.afterReplayEpoch family₁)
    (CrossEpochProductFamily.beforeReplayEpoch family₂)
    rfl rfl

/--
Minimal operational seam: the first rule target is exactly the source state
at which the second heterogeneous admission is replayed.
-/
structure TwoRowOperationalSeam
    (family₁ :
      CrossEpochProductFamily
        SourceCategory DagCategory PetriCategory PiCategory MorphismCategory
        source dagFamily petriFamily piFamily morphismFamily
        admission₁ sourceSemantics₁ sourceOccurrence₁ signatureCertificate₁
        kernel₁ initial₁ epsilon₁ RuleQualified₁ RuleAuthorized₁ candidate₁)
    (family₂ :
      CrossEpochProductFamily
        SourceCategory DagCategory PetriCategory PiCategory MorphismCategory
        source dagFamily petriFamily piFamily morphismFamily
        admission₂ sourceSemantics₂ sourceOccurrence₂ signatureCertificate₂
        kernel₂ initial₂ epsilon₂ RuleQualified₂ RuleAuthorized₂ candidate₂) :
    Prop where
  sourceEndpoint :
    candidate₁.after = sourceOccurrence₂.beforeState

namespace TwoRowOperationalSeam

variable
    (seam : TwoRowOperationalSeam family₁ family₂)

include seam

/--
The second admission boundary starts at the first row's complete eventful
epoch.  No reset to an empty event list occurs.
-/
def carriedBoundary :
    FiveViewBoundary universes
      (CrossEpochProductFamily.afterReplayEpoch family₁)
      (CrossEpochProductFamily.afterReplayEpoch family₂) where
  source :=
    { admission := admission₂
      replays := by
        change
          AdmissionReplays admission₂
            ((source.package signature₁).configOf candidate₁.after)
            ((source.package signature₂).configOf candidate₂.before)
        have replay :=
          (CrossEpochProductFamily.source_replay_chain family₂).1
        simpa only [seam.sourceEndpoint] using replay }
  dag :=
    { admission := admission₂
      replays := by
        change
          AdmissionReplays admission₂
            ((dagFamily.target.package signature₁).configOf
              ((dagFamily.operational signature₁).mapState candidate₁.after))
            ((dagFamily.target.package signature₂).configOf
              ((dagFamily.operational signature₂).mapState candidate₂.before))
        have replay :=
          (CrossEpochProductFamily.dagTrace family₂).admissionReplay
        simpa only [seam.sourceEndpoint] using replay }
  petri :=
    { admission := admission₂
      replays := by
        change
          AdmissionReplays admission₂
            ((petriFamily.target.package signature₁).configOf
              ((petriFamily.operational signature₁).mapState candidate₁.after))
            ((petriFamily.target.package signature₂).configOf
              ((petriFamily.operational signature₂).mapState candidate₂.before))
        have replay :=
          (CrossEpochProductFamily.petriTrace family₂).admissionReplay
        simpa only [seam.sourceEndpoint] using replay }
  pi :=
    { admission := admission₂
      replays := by
        change
          AdmissionReplays admission₂
            ((piFamily.target.package signature₁).configOf
              ((piFamily.operational signature₁).mapState candidate₁.after))
            ((piFamily.target.package signature₂).configOf
              ((piFamily.operational signature₂).mapState candidate₂.before))
        have replay :=
          (CrossEpochProductFamily.piTrace family₂).admissionReplay
        simpa only [seam.sourceEndpoint] using replay }
  morphism :=
    { admission := admission₂
      replays := by
        change
          AdmissionReplays admission₂
            ((morphismFamily.target.package signature₁).configOf
              ((morphismFamily.operational signature₁).mapState
                candidate₁.after))
            ((morphismFamily.target.package signature₂).configOf
              ((morphismFamily.operational signature₂).mapState
                candidate₂.before))
        have replay :=
          (CrossEpochProductFamily.morphismTrace family₂).admissionReplay
        simpa only [seam.sourceEndpoint] using replay }
  admissionEvents :=
    (CrossEpochProductFamily.toFiveViewBoundary family₂).admissionEvents

/-- The endpoint-carried two-row five-view operational chain. -/
def finiteChain :
    FiniteCrossEpochProductChain universes
      (CrossEpochProductFamily.beforeReplayEpoch family₁)
      (CrossEpochProductFamily.afterReplayEpoch family₂) :=
  .cons
    (CrossEpochProductFamily.toFiveViewBoundary family₁)
    (.cons (carriedBoundary seam)
      (.single (CrossEpochProductFamily.afterReplayEpoch family₂)))

/-- Both boundaries retain replay, strictness, and exact event mappings. -/
theorem finiteChain_complete :
    FiniteCrossEpochProductChain.CompleteAgreement (finiteChain seam) :=
  (finiteChain seam).composeComplete

/--
The source chain contains exactly two admission labels and two native rule
labels.  In particular the carried middle epoch did not lose its event.
-/
theorem source_eventCount :
    eventCount (finiteChain seam).sourceChain = 4 := by
  simp [finiteChain,
    FiniteCrossEpochProductChain.sourceChain, eventCount,
    Cantilune.Feedback.FiniteHeterogeneousTrajectory.traceEvents,
    CrossEpochProductFamily.toFiveViewBoundary,
    CrossEpochProductFamily.beforeReplayEpoch,
    CrossEpochProductFamily.afterReplayEpoch,
    CrossEpochProductFamily.sourceBeforeSomeEpoch,
    CrossEpochProductFamily.sourceAfterSomeEpoch,
    CrossEpochProductFamily.sourceBeforeEpoch,
    CrossEpochProductFamily.sourceAfterEpoch]

end TwoRowOperationalSeam

variable {commonFMS : ExactFMSAcceptancePackage}
variable
    (evidence₁ :
      SharedFMSGatedCrossEpochEvidence
        (SourceCategory := SourceCategory)
        (DagCategory := DagCategory)
        (PetriCategory := PetriCategory)
        (PiCategory := PiCategory)
        (MorphismCategory := MorphismCategory)
        commonFMS family₁)
    (evidence₂ :
      SharedFMSGatedCrossEpochEvidence
        (SourceCategory := SourceCategory)
        (DagCategory := DagCategory)
        (PetriCategory := PetriCategory)
        (PiCategory := PiCategory)
        (MorphismCategory := MorphismCategory)
        commonFMS family₂)

/--
The additional denotational seam that cannot be inferred merely from equality
of source states: the two row-specific denotation functions must agree at the
shared operational endpoint.
-/
structure TwoRowCommonFMSSeam
    (evidence₁ :
      SharedFMSGatedCrossEpochEvidence
        (SourceCategory := SourceCategory)
        (DagCategory := DagCategory)
        (PetriCategory := PetriCategory)
        (PiCategory := PiCategory)
        (MorphismCategory := MorphismCategory)
        commonFMS family₁)
    (evidence₂ :
      SharedFMSGatedCrossEpochEvidence
        (SourceCategory := SourceCategory)
        (DagCategory := DagCategory)
        (PetriCategory := PetriCategory)
        (PiCategory := PiCategory)
        (MorphismCategory := MorphismCategory)
        commonFMS family₂) : Prop where
  operational : TwoRowOperationalSeam family₁ family₂
  denotationalEndpoint :
    evidence₁.newPi.targetDenotation
        ((piFamily.operational signature₁).mapState candidate₁.after) =
      evidence₂.oldTargetDenotation
        ((piFamily.operational signature₁).mapState
          sourceOccurrence₂.beforeState)

namespace TwoRowCommonFMSSeam

variable
    (seam : TwoRowCommonFMSSeam evidence₁ evidence₂)

include seam

/-- Exact FMS actions corresponding to the two admissions and two rules. -/
def fmsActionList : List Raw.Action :=
  [ evidence₁.admissionAction
      (signatureCertificate₁.pi.admissionProjection.mapAdmissionEvent
        (sourceSemantics₁.eventOf admission₁)),
    evidence₁.newPi.targetAction
      ((piFamily.operational signature₁).mapEvent candidate₁.event),
    evidence₂.admissionAction
      (signatureCertificate₂.pi.admissionProjection.mapAdmissionEvent
        (sourceSemantics₂.eventOf admission₂)),
    evidence₂.newPi.targetAction
      ((piFamily.operational signature₂).mapEvent candidate₂.event) ]

omit seam in
@[simp] theorem fmsActionList_length :
    (fmsActionList evidence₁ evidence₂).length = 4 :=
  rfl

/--
The four native FMS edges concatenate using the explicitly supplied
denotational endpoint seam.
-/
theorem nativePath_of_denotational_seam :
    ExactFMSNativePath commonFMS
      (evidence₁.oldTargetDenotation
        ((piFamily.operational signature₀).mapState
          sourceOccurrence₁.beforeState))
      (fmsActionList evidence₁ evidence₂)
      (evidence₂.newPi.targetDenotation
        ((piFamily.operational signature₂).mapState candidate₂.after)) := by
  have admissionStep₁ := evidence₁.admission_native
  have ruleStep₁ := evidence₁.rule_native
  have admissionStep₂ := evidence₂.admission_native
  have ruleStep₂ := evidence₂.rule_native
  have ruleStep₁' :
      commonFMS.base.lateFullAbstraction.transition
        (evidence₁.newPi.targetDenotation
          ((piFamily.operational signature₁).mapState candidate₁.before))
        (evidence₁.newPi.targetAction
          ((piFamily.operational signature₁).mapEvent candidate₁.event))
        (evidence₁.newPi.targetDenotation
          ((piFamily.operational signature₁).mapState candidate₁.after)) := by
    rw [evidence₁.newPi.mapped_state_denotation]
    exact ruleStep₁
  have admissionStep₂' :
      commonFMS.base.lateFullAbstraction.transition
        (evidence₁.newPi.targetDenotation
          ((piFamily.operational signature₁).mapState candidate₁.after))
        (evidence₂.admissionAction
          (signatureCertificate₂.pi.admissionProjection.mapAdmissionEvent
            (sourceSemantics₂.eventOf admission₂)))
        (evidence₂.newPi.targetDenotation
          ((piFamily.operational signature₂).mapState candidate₂.before)) := by
    rw [seam.denotationalEndpoint]
    exact admissionStep₂
  have ruleStep₂' :
      commonFMS.base.lateFullAbstraction.transition
        (evidence₂.newPi.targetDenotation
          ((piFamily.operational signature₂).mapState candidate₂.before))
        (evidence₂.newPi.targetAction
          ((piFamily.operational signature₂).mapEvent candidate₂.event))
        (evidence₂.newPi.targetDenotation
          ((piFamily.operational signature₂).mapState candidate₂.after)) := by
    rw [evidence₂.newPi.mapped_state_denotation]
    exact ruleStep₂
  exact
    .cons admissionStep₁
      (.cons ruleStep₁'
        (.cons admissionStep₂'
          (.cons ruleStep₂' (.nil _))))

/-- Common operational, row-wise, and denotational conclusion for two rows. -/
structure CompleteAgreement : Prop where
  operational :
    FiniteCrossEpochProductChain.CompleteAgreement
      (TwoRowOperationalSeam.finiteChain seam.operational)
  firstRow :
    FMSGatedCrossEpochConclusion family₁ evidence₁.toExisting
  secondRow :
    FMSGatedCrossEpochConclusion family₂ evidence₂.toExisting
  denotational :
    ExactFMSNativePath commonFMS
      (evidence₁.oldTargetDenotation
        ((piFamily.operational signature₀).mapState
          sourceOccurrence₁.beforeState))
      (fmsActionList evidence₁ evidence₂)
      (evidence₂.newPi.targetDenotation
        ((piFamily.operational signature₂).mapState candidate₂.after))
  exactSourceEventCount :
    eventCount
      (TwoRowOperationalSeam.finiteChain seam.operational).sourceChain = 4

/--
Two supplied adjacent product families sharing one exact FMS package and the
explicit operational and denotational seams form a complete two-row common
chain.
-/
theorem complete_with_denotational_seam :
    TwoRowCommonFMSSeam.CompleteAgreement evidence₁ evidence₂ seam where
  operational := TwoRowOperationalSeam.finiteChain_complete seam.operational
  firstRow := evidence₁.row_conclusion
  secondRow := evidence₂.row_conclusion
  denotational :=
    TwoRowCommonFMSSeam.nativePath_of_denotational_seam
      evidence₁ evidence₂ seam
  exactSourceEventCount :=
    TwoRowOperationalSeam.source_eventCount seam.operational

/--
Caller-supplied identity between the four exact dependent source marks and
the four FMS action labels, in trace order.

This evidence is not derived from replay or from `ExactFMSAcceptancePackage`:
the source package must expose the intended action interpretation.
-/
structure FourPositionFMSActionAgreement where
  sourceAction :
    ChainEvent universes
      (TwoRowOperationalSeam.finiteChain seam.operational).sourceChain ->
      Raw.Action
  positions :
    List.Forall₂
      (fun sourceEvent action => sourceAction sourceEvent = action)
      (traceEvents
        (TwoRowOperationalSeam.finiteChain seam.operational).sourceChain)
      (fmsActionList evidence₁ evidence₂)

/--
Optional production-strength label requirements.

No inhabitant is constructed here.  A production package that requires
distinguishable positions, visible actions, or a domain-specific payload
projection must supply these premises explicitly.  The basic positional
agreement above deliberately permits repeated and `tau` labels.
-/
structure ProductionActionFaithfulness
    (agreement :
      FourPositionFMSActionAgreement evidence₁ evidence₂ seam)
    (Payload : Type) where
  positionInjective :
    ∀ {left right : Nat}
      (leftBound :
        left <
          (traceEvents
            (TwoRowOperationalSeam.finiteChain
              seam.operational).sourceChain).length)
      (rightBound :
        right <
          (traceEvents
            (TwoRowOperationalSeam.finiteChain
              seam.operational).sourceChain).length),
      agreement.sourceAction
          ((traceEvents
            (TwoRowOperationalSeam.finiteChain
              seam.operational).sourceChain).get
            ⟨left, leftBound⟩) =
        agreement.sourceAction
          ((traceEvents
            (TwoRowOperationalSeam.finiteChain
              seam.operational).sourceChain).get
            ⟨right, rightBound⟩) ->
        left = right
  nonTau :
    ∀ action,
      action ∈ fmsActionList evidence₁ evidence₂ ->
      action ≠ Raw.Action.tau
  sourcePayload :
    ChainEvent universes
      (TwoRowOperationalSeam.finiteChain seam.operational).sourceChain ->
      Option Payload
  fmsPayload : Raw.Action -> Option Payload
  payloadPreserved :
    ∀ sourceEvent,
      sourceEvent ∈
          traceEvents
            (TwoRowOperationalSeam.finiteChain
              seam.operational).sourceChain ->
        sourcePayload sourceEvent =
          fmsPayload (agreement.sourceAction sourceEvent)

/--
The two-row instance of the arbitrary-finite common-package path interface.
Its positional relation remains caller-supplied.
-/
def finiteCommonFMSPathAgreement
    (actions :
      FourPositionFMSActionAgreement evidence₁ evidence₂ seam) :
    FiniteCommonFMSPathAgreement commonFMS
      (TwoRowOperationalSeam.finiteChain seam.operational) where
  sourceAction := actions.sourceAction
  actions := fmsActionList evidence₁ evidence₂
  source :=
    evidence₁.oldTargetDenotation
      ((piFamily.operational signature₀).mapState
        sourceOccurrence₁.beforeState)
  target :=
    evidence₂.newPi.targetDenotation
      ((piFamily.operational signature₂).mapState candidate₂.after)
  positions := actions.positions
  native :=
    nativePath_of_denotational_seam evidence₁ evidence₂ seam

/-- Index of the FMS action corresponding to a nonterminal source phase. -/
def fmsActionIndex
    (n : Nat)
    (before :
      n <
        eventCount
          (TwoRowOperationalSeam.finiteChain
            seam.operational).sourceChain) :
    Fin (fmsActionList evidence₁ evidence₂).length :=
  ⟨n, by
    have beforeFour : n < 4 := by
      rw [TwoRowOperationalSeam.source_eventCount seam.operational] at before
      exact before
    simpa [fmsActionList] using beforeFour⟩

/-- FMS action at the same numeric position as one canonical source mark. -/
def fmsActionAt
    (n : Nat)
    (before :
      n <
        eventCount
          (TwoRowOperationalSeam.finiteChain
            seam.operational).sourceChain) :
    Raw.Action :=
  (fmsActionList evidence₁ evidence₂).get
    (fmsActionIndex evidence₁ evidence₂ seam n before)

/--
The caller-supplied positional agreement identifies an actual sampled source
mark with the FMS action at exactly the same index.
-/
theorem sampled_mark_action_at_position
    (actions :
      FourPositionFMSActionAgreement evidence₁ evidence₂ seam)
    {n : Nat}
    {before :
      n <
        eventCount
          (TwoRowOperationalSeam.finiteChain
            seam.operational).sourceChain}
    {sourceState targetState :
      MarkedState
        (TwoRowOperationalSeam.finiteChain
          seam.operational).sourceChain}
    (sampled :
      CompleteProjectedSampledEdge
        (TwoRowOperationalSeam.finiteChain
          seam.operational).sourceChain
        (Cantilune.Feedback.FiniteCrossEpochProductTrajectory.FiniteCrossEpochProductChain.projectionAssignment
            (TwoRowOperationalSeam.finiteChain seam.operational))
        n before sourceState targetState) :
    actions.sourceAction sampled.sampled.mark.event =
      fmsActionAt evidence₁ evidence₂ seam n before := by
  rw [sampled.sampled.markEvent]
  exact
    actions.positions.get (i := n)
      (by simpa [eventCount] using before)
      (fmsActionIndex evidence₁ evidence₂ seam n before).isLt

/--
The canonical deterministic marked replay scheduler applies to this
endpoint-carried chain.

This is not `kernel₁`/`kernel₂` trajectory agreement and does not couple a
production Markov kernel.  It only samples the already certified finite trace
in order.
-/
theorem canonical_marked_replay_trajectory_almost_sure :
    ∀ᵐ path ∂
        (markedKernel
            (TwoRowOperationalSeam.finiteChain
              seam.operational).sourceChain).toMarkovExecutionKernel
          |>.trajectoryMeasure
            (Cantilune.Feedback.FiniteHeterogeneousMarkedKernel.initial
              (TwoRowOperationalSeam.finiteChain
                seam.operational).sourceChain),
      Cantilune.Feedback.FiniteCrossEpochProductTrajectory.FiniteCrossEpochProductChain.FiveMarkedCommonTrajectory
          (TwoRowOperationalSeam.finiteChain seam.operational) path :=
  Cantilune.Feedback.FiniteCrossEpochProductTrajectory.FiniteCrossEpochProductChain.marked_common_trajectory_almost_sure
      (TwoRowOperationalSeam.finiteChain seam.operational)

/--
Canonical marked replay plus an explicit per-position identity between each
sampled source mark and its FMS action.
-/
structure PositionMatchedCanonicalMarkedAgreement
    (actions :
      FourPositionFMSActionAgreement evidence₁ evidence₂ seam)
    (path :
      Nat ->
        MarkedState
          (TwoRowOperationalSeam.finiteChain
            seam.operational).sourceChain) : Prop where
  deterministic :
    TwoRowCommonFMSSeam.CompleteAgreement evidence₁ evidence₂ seam
  sampled :
    Cantilune.Feedback.FiniteCrossEpochProductTrajectory.FiniteCrossEpochProductChain.FiveMarkedCommonTrajectory
      (TwoRowOperationalSeam.finiteChain seam.operational) path
  actionAt :
    ∀ (n : Nat)
      (before :
        n <
          eventCount
            (TwoRowOperationalSeam.finiteChain
              seam.operational).sourceChain),
      ∃ edge :
        CompleteProjectedSampledEdge
          (TwoRowOperationalSeam.finiteChain
            seam.operational).sourceChain
          (Cantilune.Feedback.FiniteCrossEpochProductTrajectory.FiniteCrossEpochProductChain.projectionAssignment
              (TwoRowOperationalSeam.finiteChain seam.operational))
          n before (path n) (path (n + 1)),
        actions.sourceAction edge.sampled.mark.event =
          fmsActionAt evidence₁ evidence₂ seam n before

/--
Almost every path of the canonical marked replay scheduler has exact
source-mark/FMS-action identity at all four positions.

This theorem still makes no claim about the supplied product kernels
`kernel₁` and `kernel₂`; such a claim requires a separate trajectory coupling.
-/
theorem canonical_marked_replay_positioned_fms_actions_almost_sure
    (actions :
      FourPositionFMSActionAgreement evidence₁ evidence₂ seam) :
    ∀ᵐ path ∂
        (markedKernel
            (TwoRowOperationalSeam.finiteChain
              seam.operational).sourceChain).toMarkovExecutionKernel
          |>.trajectoryMeasure
            (Cantilune.Feedback.FiniteHeterogeneousMarkedKernel.initial
              (TwoRowOperationalSeam.finiteChain
                seam.operational).sourceChain),
      PositionMatchedCanonicalMarkedAgreement
        evidence₁ evidence₂ seam actions path := by
  filter_upwards
    [canonical_marked_replay_trajectory_almost_sure
      evidence₁ evidence₂ seam] with path sampled
  refine
    { deterministic :=
        complete_with_denotational_seam evidence₁ evidence₂ seam
      sampled := sampled
      actionAt := ?_ }
  intro n before
  rcases sampled.sampled n before with ⟨edge⟩
  exact
    ⟨edge,
      sampled_mark_action_at_position
        evidence₁ evidence₂ seam actions edge⟩

end TwoRowCommonFMSSeam

end TwoRows

end Cantilune.Theorems
