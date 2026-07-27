import Cantilune.Theorems.ProductRuleProofBundle

/-!
# Product-rule composition across one signature epoch

`FourCoherentFamilyAdmission` already certifies one genuine heterogeneous
signature boundary, including four extension-indexed static/operational
families, native target admissions, and `AdmissionReplays`.  A
`ProductRuleProofBundle` certifies one fixed-signature rule in the new epoch.

This module composes those independently supplied certificates.  The only
additional datum is the endpoint equation saying that the admitted source
state is the rule's pre-state.  The result retains the heterogeneous
admission as such and appends a native one-event target path in the new
epoch, with both the admission replay and the rule's verified `DPOEvent`
replay.

No production package inhabitant is constructed here.  In particular, an
uninstantiated package certificate cannot be passed as a boolean flag or
recovered from the theorem.
-/

noncomputable section

namespace Cantilune.Theorems

open CategoryTheory
open Cantilune.Core
open Cantilune.Core.ExecutionEpochTrace
open Cantilune.Feedback.StochasticExecution.FiniteDiscrete
open Cantilune.Theorems.ProductRuleProofBundle
open Cantilune.Theorems.HeterogeneousProductRuleAdmission

universe u v w

/--
One target view of an admission followed by one fixed-epoch product rule.
The first edge is heterogeneous and therefore is not coerced into an
`ObservableLTS.Path`; the second component is an ordinary native target path
in the new signature.
-/
structure ViewCrossEpochTrace
    {universes : ProjectionUniverses}
    {oldSignature newSignature : FinSignature}
    (admission :
      SignatureAdmissionEvent universes
        (source := oldSignature) (target := newSignature))
    (sourceBefore : ExecutionPackage oldSignature)
    (sourceAfter : ExecutionPackage newSignature)
    (targetBefore : ExecutionPackage oldSignature)
    (targetAfter : ExecutionPackage newSignature)
    (sourceSemantics :
      HeterogeneousAdmissionLTS sourceBefore sourceAfter)
    (targetSemantics :
      HeterogeneousAdmissionLTS targetBefore targetAfter)
    (sourceOccurrence :
      HeterogeneousPackageAdmission
        sourceBefore sourceAfter sourceSemantics admission)
    (beforeProjection :
      ProjectionCertificate sourceBefore.lts targetBefore.lts)
    (afterProjection :
      ProjectionCertificate sourceAfter.lts targetAfter.lts)
    (admissionProjection :
      HeterogeneousAdmissionProjection
        sourceBefore sourceAfter targetBefore targetAfter
        sourceSemantics targetSemantics admission sourceOccurrence
        beforeProjection afterProjection)
    (candidate : Candidate sourceAfter)
    (viewEvidence :
      ProjectionOccurrenceEvidence
        sourceAfter targetAfter afterProjection candidate)
    (connects : sourceOccurrence.afterState = candidate.before) : Prop where
  admissionNative :
    targetSemantics.step
      (beforeProjection.mapState sourceOccurrence.beforeState)
      (admissionProjection.mapAdmissionEvent
        (sourceSemantics.eventOf admission))
      (afterProjection.mapState candidate.before)
  rulePath :
    targetAfter.lts.Path
      (afterProjection.mapState candidate.before)
      [afterProjection.mapEvent candidate.event]
      (afterProjection.mapState candidate.after)
  admissionReplay :
    AdmissionReplays admission
      (targetBefore.configOf
        (beforeProjection.mapState sourceOccurrence.beforeState))
      (targetAfter.configOf
        (afterProjection.mapState candidate.before))
  ruleReplay :
    (targetAfter.eventRecord
      (afterProjection.mapEvent candidate.event)).Replays
      (targetAfter.configOf
        (afterProjection.mapState candidate.before))
      (targetAfter.configOf
        (afterProjection.mapState candidate.after))

namespace ViewCrossEpochTrace

/--
The cross-epoch target trace is derived from a real admission projection and
a real rule cell.  Neither native edge is manufactured by this constructor.
-/
theorem ofCertificates
    {universes : ProjectionUniverses}
    {oldSignature newSignature : FinSignature}
    {admission :
      SignatureAdmissionEvent universes
        (source := oldSignature) (target := newSignature)}
    {sourceBefore : ExecutionPackage oldSignature}
    {sourceAfter : ExecutionPackage newSignature}
    {targetBefore : ExecutionPackage oldSignature}
    {targetAfter : ExecutionPackage newSignature}
    {sourceSemantics :
      HeterogeneousAdmissionLTS sourceBefore sourceAfter}
    {targetSemantics :
      HeterogeneousAdmissionLTS targetBefore targetAfter}
    {sourceOccurrence :
      HeterogeneousPackageAdmission
        sourceBefore sourceAfter sourceSemantics admission}
    {beforeProjection :
      ProjectionCertificate sourceBefore.lts targetBefore.lts}
    {afterProjection :
      ProjectionCertificate sourceAfter.lts targetAfter.lts}
    {admissionProjection :
      HeterogeneousAdmissionProjection
        sourceBefore sourceAfter targetBefore targetAfter
        sourceSemantics targetSemantics admission sourceOccurrence
        beforeProjection afterProjection}
    {candidate : Candidate sourceAfter}
    (viewEvidence :
      ProjectionOccurrenceEvidence
        sourceAfter targetAfter afterProjection candidate)
    (connects : sourceOccurrence.afterState = candidate.before) :
    ViewCrossEpochTrace
      admission sourceBefore sourceAfter targetBefore targetAfter
      sourceSemantics targetSemantics sourceOccurrence
      beforeProjection afterProjection admissionProjection
      candidate viewEvidence connects where
  admissionNative := by
    have native :=
      admissionProjection.target_native_at_mapped_endpoints
    simpa only [connects] using native
  rulePath :=
    .cons viewEvidence.native
      (.nil (afterProjection.mapState candidate.after))
  admissionReplay := by
    have replay :=
      admissionProjection.target_replays_at_mapped_endpoints
    simpa only [connects] using replay
  ruleReplay := viewEvidence.replay

variable
    {universes : ProjectionUniverses}
    {oldSignature newSignature : FinSignature}
    {admission :
      SignatureAdmissionEvent universes
        (source := oldSignature) (target := newSignature)}
    {sourceBefore : ExecutionPackage oldSignature}
    {sourceAfter : ExecutionPackage newSignature}
    {targetBefore : ExecutionPackage oldSignature}
    {targetAfter : ExecutionPackage newSignature}
    {sourceSemantics :
      HeterogeneousAdmissionLTS sourceBefore sourceAfter}
    {targetSemantics :
      HeterogeneousAdmissionLTS targetBefore targetAfter}
    {sourceOccurrence :
      HeterogeneousPackageAdmission
        sourceBefore sourceAfter sourceSemantics admission}
    {beforeProjection :
      ProjectionCertificate sourceBefore.lts targetBefore.lts}
    {afterProjection :
      ProjectionCertificate sourceAfter.lts targetAfter.lts}
    {admissionProjection :
      HeterogeneousAdmissionProjection
        sourceBefore sourceAfter targetBefore targetAfter
        sourceSemantics targetSemantics admission sourceOccurrence
        beforeProjection afterProjection}
    {candidate : Candidate sourceAfter}
    {viewEvidence :
      ProjectionOccurrenceEvidence
        sourceAfter targetAfter afterProjection candidate}
    {connects : sourceOccurrence.afterState = candidate.before}

/-- The target state immediately before the admission, as a replay epoch. -/
def beforeEpoch
    (trace :
      ViewCrossEpochTrace
        admission sourceBefore sourceAfter targetBefore targetAfter
        sourceSemantics targetSemantics sourceOccurrence
        beforeProjection afterProjection admissionProjection
        candidate viewEvidence connects) :
    ReplayEpoch targetBefore where
  executionEpoch := admission.fromVersion
  source := beforeProjection.mapState sourceOccurrence.beforeState
  target := beforeProjection.mapState sourceOccurrence.beforeState
  events := []
  path := .nil _
  source_epoch := trace.admissionReplay.1

/-- The fixed-signature target rule is a one-event replay epoch. -/
def afterEpoch
    (trace :
      ViewCrossEpochTrace
        admission sourceBefore sourceAfter targetBefore targetAfter
        sourceSemantics targetSemantics sourceOccurrence
        beforeProjection afterProjection admissionProjection
        candidate viewEvidence connects) :
    ReplayEpoch targetAfter where
  executionEpoch := admission.toVersion
  source := afterProjection.mapState candidate.before
  target := afterProjection.mapState candidate.after
  events := [afterProjection.mapEvent candidate.event]
  path := trace.rulePath
  source_epoch := trace.admissionReplay.target_version

/-- Existentially package the pre-admission replay epoch. -/
def beforeSomeEpoch
    (trace :
      ViewCrossEpochTrace
        admission sourceBefore sourceAfter targetBefore targetAfter
        sourceSemantics targetSemantics sourceOccurrence
        beforeProjection afterProjection admissionProjection
        candidate viewEvidence connects) :
    SomeReplayEpoch where
  signature := oldSignature
  package := targetBefore
  epoch := trace.beforeEpoch

/-- Existentially package the post-admission one-rule replay epoch. -/
def afterSomeEpoch
    (trace :
      ViewCrossEpochTrace
        admission sourceBefore sourceAfter targetBefore targetAfter
        sourceSemantics targetSemantics sourceOccurrence
        beforeProjection afterProjection admissionProjection
        candidate viewEvidence connects) :
    SomeReplayEpoch where
  signature := newSignature
  package := targetAfter
  epoch := trace.afterEpoch

/--
The target admission is an actual dependent boundary between differently
typed replay epochs.
-/
def adjacentAdmission
    (trace :
      ViewCrossEpochTrace
        admission sourceBefore sourceAfter targetBefore targetAfter
        sourceSemantics targetSemantics sourceOccurrence
        beforeProjection afterProjection admissionProjection
        candidate viewEvidence connects) :
    AdjacentAdmission universes trace.beforeSomeEpoch trace.afterSomeEpoch where
  admission := admission
  replays := trace.admissionReplay

/--
The heterogeneous boundary followed by the fixed rule inhabits the general
dependent `EpochChain`, rather than merely an erased list of booleans.
-/
def epochChain
    (trace :
      ViewCrossEpochTrace
        admission sourceBefore sourceAfter targetBefore targetAfter
        sourceSemantics targetSemantics sourceOccurrence
        beforeProjection afterProjection admissionProjection
        candidate viewEvidence connects) :
    EpochChain universes trace.beforeSomeEpoch trace.afterSomeEpoch :=
  .cons trace.adjacentAdmission (.single trace.afterSomeEpoch)

/-- Every cell and boundary of the dependent target chain replays exactly. -/
theorem epochChain_replay_agreement
    (trace :
      ViewCrossEpochTrace
        admission sourceBefore sourceAfter targetBefore targetAfter
        sourceSemantics targetSemantics sourceOccurrence
        beforeProjection afterProjection admissionProjection
        candidate viewEvidence connects) :
    EpochChain.ReplayAgreement trace.epochChain :=
  trace.epochChain.complete_replay_agreement

/-- The dependent target chain crosses a genuinely strict epoch boundary. -/
theorem epochChain_execution_epoch_strict
    (trace :
      ViewCrossEpochTrace
        admission sourceBefore sourceAfter targetBefore targetAfter
        sourceSemantics targetSemantics sourceOccurrence
        beforeProjection afterProjection admissionProjection
        candidate viewEvidence connects) :
    trace.beforeSomeEpoch.epoch.executionEpoch <
      trace.afterSomeEpoch.epoch.executionEpoch :=
  EpochChain.cons_execution_epoch_strict
    trace.adjacentAdmission (.single trace.afterSomeEpoch)

end ViewCrossEpochTrace

/--
A complete coherent signature-family admission connected to one complete
fixed-epoch product-rule bundle in the admitted signature.

The target packages and projections in `ruleBundle` are definitionally the
new-signature members of the four supplied coherent projection families.
-/
structure CrossEpochProductFamily
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
    (candidate : Candidate (source.package newSignature)) where
  connects : sourceOccurrence.afterState = candidate.before
  ruleBundle :
    ProductRuleProofBundle
      (source.package newSignature)
      (dagFamily.target.package newSignature)
      (petriFamily.target.package newSignature)
      (piFamily.target.package newSignature)
      (morphismFamily.target.package newSignature)
      (dagFamily.operational newSignature)
      (petriFamily.operational newSignature)
      (piFamily.operational newSignature)
      (morphismFamily.operational newSignature)
      kernel initial epsilon RuleQualified RuleAuthorized candidate

namespace CrossEpochProductFamily

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
      CrossEpochProductFamily
        SourceCategory DagCategory PetriCategory PiCategory MorphismCategory
        source dagFamily petriFamily piFamily morphismFamily
        admission sourceSemantics sourceOccurrence signatureCertificate
        kernel initial epsilon RuleQualified RuleAuthorized candidate)

include family

/-- The shared source admission and source rule both remain native. -/
theorem source_native_chain :
    sourceSemantics.step
        sourceOccurrence.beforeState
        (sourceSemantics.eventOf admission)
        candidate.before ∧
      (source.package newSignature).lts.ObservableStep
        candidate.before candidate.event candidate.after := by
  constructor
  · simpa only [CrossEpochProductFamily.connects family] using
      sourceOccurrence.native
  · exact
      (CrossEpochProductFamily.ruleBundle family).sourceOccurrence.native

/--
Source replay is retained on both sides of the epoch boundary.  Admission
replay and fixed-signature `DPOEvent` replay remain different relations.
-/
theorem source_replay_chain :
    AdmissionReplays admission
        ((source.package oldSignature).configOf
          sourceOccurrence.beforeState)
        ((source.package newSignature).configOf candidate.before) ∧
      (((source.package newSignature).eventRecord candidate.event).Replays
        ((source.package newSignature).configOf candidate.before)
        ((source.package newSignature).configOf candidate.after)) := by
  constructor
  · simpa only [CrossEpochProductFamily.connects family] using
      sourceOccurrence.replays
  · exact
      (CrossEpochProductFamily.ruleBundle family).sourceOccurrence.replay

theorem dagTrace :
    ViewCrossEpochTrace
      admission
      (source.package oldSignature)
      (source.package newSignature)
      (dagFamily.target.package oldSignature)
      (dagFamily.target.package newSignature)
      sourceSemantics signatureCertificate.dagSemantics sourceOccurrence
      (dagFamily.operational oldSignature)
      (dagFamily.operational newSignature)
      signatureCertificate.dag.admissionProjection
      candidate
      (CrossEpochProductFamily.ruleBundle family).dag
      (CrossEpochProductFamily.connects family) :=
  ViewCrossEpochTrace.ofCertificates
    (CrossEpochProductFamily.ruleBundle family).dag
    (CrossEpochProductFamily.connects family)

theorem petriTrace :
    ViewCrossEpochTrace
      admission
      (source.package oldSignature)
      (source.package newSignature)
      (petriFamily.target.package oldSignature)
      (petriFamily.target.package newSignature)
      sourceSemantics signatureCertificate.petriSemantics sourceOccurrence
      (petriFamily.operational oldSignature)
      (petriFamily.operational newSignature)
      signatureCertificate.petri.admissionProjection
      candidate
      (CrossEpochProductFamily.ruleBundle family).petri
      (CrossEpochProductFamily.connects family) :=
  ViewCrossEpochTrace.ofCertificates
    (CrossEpochProductFamily.ruleBundle family).petri
    (CrossEpochProductFamily.connects family)

theorem piTrace :
    ViewCrossEpochTrace
      admission
      (source.package oldSignature)
      (source.package newSignature)
      (piFamily.target.package oldSignature)
      (piFamily.target.package newSignature)
      sourceSemantics signatureCertificate.piSemantics sourceOccurrence
      (piFamily.operational oldSignature)
      (piFamily.operational newSignature)
      signatureCertificate.pi.admissionProjection
      candidate
      (CrossEpochProductFamily.ruleBundle family).pi
      (CrossEpochProductFamily.connects family) :=
  ViewCrossEpochTrace.ofCertificates
    (CrossEpochProductFamily.ruleBundle family).pi
    (CrossEpochProductFamily.connects family)

theorem morphismTrace :
    ViewCrossEpochTrace
      admission
      (source.package oldSignature)
      (source.package newSignature)
      (morphismFamily.target.package oldSignature)
      (morphismFamily.target.package newSignature)
      sourceSemantics signatureCertificate.morphismSemantics sourceOccurrence
      (morphismFamily.operational oldSignature)
      (morphismFamily.operational newSignature)
      signatureCertificate.morphism.admissionProjection
      candidate
      (CrossEpochProductFamily.ruleBundle family).morphism
      (CrossEpochProductFamily.connects family) :=
  ViewCrossEpochTrace.ofCertificates
    (CrossEpochProductFamily.ruleBundle family).morphism
    (CrossEpochProductFamily.connects family)

/-- The four target views carry one complete cross-epoch trace each. -/
structure FourViewTrace : Prop where
  dag :
    ViewCrossEpochTrace
      admission
      (source.package oldSignature)
      (source.package newSignature)
      (dagFamily.target.package oldSignature)
      (dagFamily.target.package newSignature)
      sourceSemantics signatureCertificate.dagSemantics sourceOccurrence
      (dagFamily.operational oldSignature)
      (dagFamily.operational newSignature)
      signatureCertificate.dag.admissionProjection
      candidate
      (CrossEpochProductFamily.ruleBundle family).dag
      (CrossEpochProductFamily.connects family)
  petri :
    ViewCrossEpochTrace
      admission
      (source.package oldSignature)
      (source.package newSignature)
      (petriFamily.target.package oldSignature)
      (petriFamily.target.package newSignature)
      sourceSemantics signatureCertificate.petriSemantics sourceOccurrence
      (petriFamily.operational oldSignature)
      (petriFamily.operational newSignature)
      signatureCertificate.petri.admissionProjection
      candidate
      (CrossEpochProductFamily.ruleBundle family).petri
      (CrossEpochProductFamily.connects family)
  pi :
    ViewCrossEpochTrace
      admission
      (source.package oldSignature)
      (source.package newSignature)
      (piFamily.target.package oldSignature)
      (piFamily.target.package newSignature)
      sourceSemantics signatureCertificate.piSemantics sourceOccurrence
      (piFamily.operational oldSignature)
      (piFamily.operational newSignature)
      signatureCertificate.pi.admissionProjection
      candidate
      (CrossEpochProductFamily.ruleBundle family).pi
      (CrossEpochProductFamily.connects family)
  morphism :
    ViewCrossEpochTrace
      admission
      (source.package oldSignature)
      (source.package newSignature)
      (morphismFamily.target.package oldSignature)
      (morphismFamily.target.package newSignature)
      sourceSemantics signatureCertificate.morphismSemantics sourceOccurrence
      (morphismFamily.operational oldSignature)
      (morphismFamily.operational newSignature)
      signatureCertificate.morphism.admissionProjection
      candidate
      (CrossEpochProductFamily.ruleBundle family).morphism
      (CrossEpochProductFamily.connects family)

/--
Main combination theorem: a coherent extension certificate plus a complete
rule bundle and their endpoint equation produce four native/replay-preserving
cross-epoch paths.
-/
theorem four_projection_paths_and_replay :
    FourViewTrace family where
  dag := dagTrace family
  petri := petriTrace family
  pi := piTrace family
  morphism := morphismTrace family

/--
All four view traces inhabit the shared dependent `EpochChain` construction.
The replay proofs cover every fixed-signature cell and every heterogeneous
boundary; the strict fields rule out an erased or same-version admission.
-/
structure FourEpochChainAgreement : Prop where
  dagReplay :
    EpochChain.ReplayAgreement (dagTrace family).epochChain
  petriReplay :
    EpochChain.ReplayAgreement (petriTrace family).epochChain
  piReplay :
    EpochChain.ReplayAgreement (piTrace family).epochChain
  morphismReplay :
    EpochChain.ReplayAgreement (morphismTrace family).epochChain
  dagStrict :
    (dagTrace family).beforeSomeEpoch.epoch.executionEpoch <
      (dagTrace family).afterSomeEpoch.epoch.executionEpoch
  petriStrict :
    (petriTrace family).beforeSomeEpoch.epoch.executionEpoch <
      (petriTrace family).afterSomeEpoch.epoch.executionEpoch
  piStrict :
    (piTrace family).beforeSomeEpoch.epoch.executionEpoch <
      (piTrace family).afterSomeEpoch.epoch.executionEpoch
  morphismStrict :
    (morphismTrace family).beforeSomeEpoch.epoch.executionEpoch <
      (morphismTrace family).afterSomeEpoch.epoch.executionEpoch

/--
Every one-boundary product-family composition yields four complete dependent
epoch chains.  Longer finite chains use `EpochChain.cons`; its generic
`complete_replay_agreement` theorem then composes these same cell and boundary
proofs without erasing their dependent package types.
-/
theorem four_dependent_epoch_chains_complete :
    FourEpochChainAgreement family where
  dagReplay := (dagTrace family).epochChain_replay_agreement
  petriReplay := (petriTrace family).epochChain_replay_agreement
  piReplay := (piTrace family).epochChain_replay_agreement
  morphismReplay := (morphismTrace family).epochChain_replay_agreement
  dagStrict := (dagTrace family).epochChain_execution_epoch_strict
  petriStrict := (petriTrace family).epochChain_execution_epoch_strict
  piStrict := (piTrace family).epochChain_execution_epoch_strict
  morphismStrict := (morphismTrace family).epochChain_execution_epoch_strict

omit [Fintype KernelState] [DecidableEq KernelState] family in
/-- Every target admission in the composed trace strictly advances epoch. -/
theorem target_versions_strict :
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
          signatureCertificate.morphism.admissionProjection.targetOccurrence.afterState :=
  ⟨signatureCertificate.dag.admissionProjection.targetOccurrence.lts_version_strict,
    signatureCertificate.petri.admissionProjection.targetOccurrence.lts_version_strict,
    signatureCertificate.pi.admissionProjection.targetOccurrence.lts_version_strict,
    signatureCertificate.morphism.admissionProjection.targetOccurrence.lts_version_strict⟩

end CrossEpochProductFamily

end Cantilune.Theorems
