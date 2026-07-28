import Cantilune.Core.Admission
import Cantilune.Feedback.PositiveEventTrajectory
import Cantilune.Pi.FMSActualAgentNormativeOperationalBridge
import Cantilune.Pi.P1cOperationRegistry

/-!
# Event-level common-FMS trajectories for product kernels

This module connects one caller-supplied fixed-signature
`NativeMarkovKernel` to the actual recursive FMS `Agent`.  It does not
manufacture product semantics.  A product supplies:

* a `PositiveEventLabelling` for its genuine positive-probability edges;
* a total classification of selected events as either one closed registry
  row or an external hold;
* a state interpretation in `Agent.obj normativeBaseWorld`; and
* one semantic certificate for every positive edge.

A registry row has no independently stored event family.  Its family is
definitionally `familyAt row.operation`, so an inconsistent operation/family
pair is unrepresentable.  A normative edge carries the actual compiled FMS
commutation package and exact source/target denotational equations.  A hold
edge carries literal equality of its denotational endpoints.

From the already constructed
`PositiveEventLabelling.TrajectoryAgreement`, the main constructor builds an
infinite, event-labelled common-FMS path.  Every row retains its genuine
native target step and exact `DPOEvent` replay, and consecutive rows share
their denotational endpoint literally.

The final section records a separate heterogeneous signature-admission seam.
It is intentionally not a `NativeMarkovKernel` edge: the old and new
signatures are different indices.  The seam requires the registry admission
operation to refine to `dynamicPartnerAdmission`, connects its actual FMS
target to the next fixed-epoch business source, and retains all stable
metadata explicitly.
-/

noncomputable section

namespace Cantilune.Feedback.ProductCommonFMSTrajectory

open Cantilune.Core
open Cantilune.Feedback.EventTrajectory
open Cantilune.Feedback.EventTrajectory.FiniteDiscrete
open Cantilune.Feedback.StochasticExecution
open Cantilune.Feedback.StochasticExecution.FiniteDiscrete
open Cantilune.Pi
open Cantilune.Pi.FMSCpoAgentRestriction
open Cantilune.Pi.FMSActualAgentNormativeCommutation
open Cantilune.Pi.FMSActualAgentNormativeOperationalBridge
open Cantilune.Pi.P1cMatrix
open Cantilune.Pi.P1cOperationRegistry

universe uState

/-! ## Closed registry marks -/

/-- The actual recursive FMS endpoint used by every row in this module. -/
abbrev ActualFMSEndpoint : Type :=
  Agent.obj normativeBaseWorld

/--
One closed API/reference row.

There is deliberately no `family` field.  The only family associated with a
row is the total registry computation `familyAt operation`.
-/
structure NormativeRegistryRow where
  operation : OperationId
  metadata : StableMetadata
  deriving DecidableEq, Repr

namespace NormativeRegistryRow

/-- The row's normative family is definitionally selected by its operation. -/
def family (row : NormativeRegistryRow) : SourceEvent :=
  familyAt row.operation

@[simp]
theorem family_eq_familyAt (row : NormativeRegistryRow) :
    row.family = familyAt row.operation :=
  rfl

end NormativeRegistryRow

/--
Canonical registry metadata decoded from the complete replay record.

The decoder is deterministic and agrees with the product-conformance
boundary: version and rule are direct `DPOEvent` fields; session and
correlation use the first external/policy evidence item with the replay
complement tag as their total fallback; occurrence is the complement tag.
-/
def canonicalStableMetadata
    {eventSignature : FinSignature}
    (event : DPOEvent eventSignature) :
    StableMetadata where
  version := event.signatureVersion
  rule := event.ruleId
  session := event.externalEvidence.head?.getD event.complementTag
  correlation := event.policyEvidence.head?.getD event.complementTag
  occurrence := event.complementTag

/-- Every selected product event is a normative registry row or a hold. -/
inductive ProductEventMark where
  | normative (row : NormativeRegistryRow)
  | externalHold
  deriving DecidableEq, Repr

/--
Normative metadata must be the canonical decoding of the selected replay
record.  Holds have no registry metadata to validate.
-/
def EventMetadataAlignment
    {eventSignature : FinSignature}
    (mark : ProductEventMark)
    (event : DPOEvent eventSignature) : Prop :=
  match mark with
  | .normative row =>
      row.metadata = canonicalStableMetadata event
  | .externalHold => True

/-! ## One positive edge in the actual FMS Agent -/

/--
The denotational meaning of one classified edge.

The indexed mark prevents a normative witness from being used for a hold or
for a different registry row.
-/
inductive EventFMSMeaning
    (source target : ActualFMSEndpoint) :
    ProductEventMark → Type
  | normative
      (row : NormativeRegistryRow)
      (commutation :
        TotalCompiledNormativeCommutation row.family)
      (source_exact :
        source =
          normativeSourceAgent row.family)
      (target_exact :
        target =
          normativeTargetAgent row.family) :
      EventFMSMeaning source target (.normative row)
  | externalHold
      (endpoints_equal : source = target) :
      EventFMSMeaning source target .externalHold

variable
    {signature : FinSignature}
    {package : ExecutionPackage signature}
    {State : Type uState}
    [Fintype State] [DecidableEq State]
    {kernel : NativeMarkovKernel signature package State}

/--
All evidence attached to one positive-probability product edge.

`native` and `replay` are retained explicitly even though they can be
reconstructed from `labelling`; this makes the edge package independently
auditable at the common-FMS boundary.
-/
structure PositiveEdgeFMSAlignment
    (labelling : PositiveEventLabelling kernel)
    (classify : package.lts.Event → ProductEventMark)
    (denote : State → ActualFMSEndpoint)
    {source target : State}
    (positive : 0 < kernel.probability source target) where
  native :
    package.lts.ObservableStep
      (kernel.stateEquiv source)
      (labelling.event positive)
      (kernel.stateEquiv target)
  replay :
    (package.eventRecord (labelling.event positive)).Replays
      (package.configOf (kernel.stateEquiv source))
      (package.configOf (kernel.stateEquiv target))
  metadataExact :
    EventMetadataAlignment
      (classify (labelling.event positive))
      (package.eventRecord (labelling.event positive)).event
  meaning :
    EventFMSMeaning
      (denote source) (denote target)
      (classify (labelling.event positive))

/--
Product-supplied common-FMS interpretation of every positive kernel edge.
-/
structure ProductFMSLabelling
    (labelling : PositiveEventLabelling kernel) where
  classify : package.lts.Event → ProductEventMark
  denote : State → ActualFMSEndpoint
  positiveEdge :
    ∀ {source target}
      (positive : 0 < kernel.probability source target),
      PositiveEdgeFMSAlignment
        labelling classify denote positive

namespace ProductFMSLabelling

variable
    {labelling : PositiveEventLabelling kernel}

/--
Construct an edge package when the caller only has to supply its FMS meaning.
Native execution and replay come from the same positive event labelling.
-/
def edgeOfMeaning
    (classify : package.lts.Event → ProductEventMark)
    (denote : State → ActualFMSEndpoint)
    {source target : State}
    (positive : 0 < kernel.probability source target)
    (meaning :
      EventFMSMeaning
        (denote source) (denote target)
        (classify (labelling.event positive)))
    (metadataExact :
      EventMetadataAlignment
        (classify (labelling.event positive))
        (package.eventRecord (labelling.event positive)).event) :
    PositiveEdgeFMSAlignment
      labelling classify denote positive where
  native := labelling.native positive
  replay := labelling.selected_event_replays positive
  metadataExact := metadataExact
  meaning := meaning

end ProductFMSLabelling

namespace PositiveEdgeFMSAlignment

variable
    {labelling : PositiveEventLabelling kernel}
    {classify : package.lts.Event → ProductEventMark}
    {denote : State → ActualFMSEndpoint}
    {source target : State}
    {positive : 0 < kernel.probability source target}
    (edge :
      PositiveEdgeFMSAlignment
        labelling classify denote positive)

include edge in
/-- A normative row cannot attach metadata chosen after replay. -/
theorem normative_metadata_eq_canonical
    (row : NormativeRegistryRow)
    (classified :
      classify (labelling.event positive) = .normative row) :
    row.metadata =
      canonicalStableMetadata
        (package.eventRecord (labelling.event positive)).event := by
  have metadata := edge.metadataExact
  unfold EventMetadataAlignment at metadata
  rw [classified] at metadata
  exact metadata

include edge in
/-- Fieldwise form of canonical metadata alignment for audit consumers. -/
theorem normative_metadata_fields
    (row : NormativeRegistryRow)
    (classified :
      classify (labelling.event positive) = .normative row) :
    row.metadata.version =
        (package.eventRecord
          (labelling.event positive)).event.signatureVersion ∧
      row.metadata.rule =
        (package.eventRecord
          (labelling.event positive)).event.ruleId ∧
      row.metadata.session =
        (package.eventRecord
          (labelling.event positive)).event.externalEvidence.head?.getD
            (package.eventRecord
              (labelling.event positive)).event.complementTag ∧
      row.metadata.correlation =
        (package.eventRecord
          (labelling.event positive)).event.policyEvidence.head?.getD
            (package.eventRecord
              (labelling.event positive)).event.complementTag ∧
      row.metadata.occurrence =
        (package.eventRecord
          (labelling.event positive)).event.complementTag := by
  rw [edge.normative_metadata_eq_canonical row classified]
  exact ⟨rfl, rfl, rfl, rfl, rfl⟩

end PositiveEdgeFMSAlignment

/-! ## Multi-row common-FMS paths -/

/--
One row of the common path, indexed by the exact stochastic path and its
existing event-trajectory agreement.
-/
structure CommonFMSRow
    (labelling : PositiveEventLabelling kernel)
    (alignment : ProductFMSLabelling labelling)
    (path : PositiveStatePath kernel)
    (agreement : labelling.TrajectoryAgreement path)
    (n : Nat) where
  mark : ProductEventMark
  sourceDenotation : ActualFMSEndpoint
  targetDenotation : ActualFMSEndpoint
  mark_exact :
    mark = alignment.classify (agreement.trajectory.event n)
  source_exact :
    sourceDenotation = alignment.denote (path.state n)
  target_exact :
    targetDenotation = alignment.denote (path.state (n + 1))
  native :
    package.lts.ObservableStep
      (agreement.trajectory.state n)
      (agreement.trajectory.event n)
      (agreement.trajectory.state (n + 1))
  replay :
    (package.eventRecord (agreement.trajectory.event n)).Replays
      (package.configOf (agreement.trajectory.state n))
      (package.configOf (agreement.trajectory.state (n + 1)))
  metadataExact :
    EventMetadataAlignment mark
      (package.eventRecord (agreement.trajectory.event n)).event
  meaning :
    EventFMSMeaning sourceDenotation targetDenotation mark

/--
The complete multi-row common-FMS path.  The endpoint seam is an equality in
the actual recursive `Agent`, not an observation-equivalence placeholder.
-/
structure CommonFMSTrajectory
    (labelling : PositiveEventLabelling kernel)
    (alignment : ProductFMSLabelling labelling)
    (path : PositiveStatePath kernel)
    (agreement : labelling.TrajectoryAgreement path) where
  row : ∀ n, CommonFMSRow labelling alignment path agreement n
  adjacentDenotation :
    ∀ n,
      (row n).targetDenotation =
        (row (n + 1)).sourceDenotation

namespace CommonFMSTrajectory

variable
    {labelling : PositiveEventLabelling kernel}
    {alignment : ProductFMSLabelling labelling}
    {path : PositiveStatePath kernel}
    {agreement : labelling.TrajectoryAgreement path}

/--
Build one row by transporting the positive-edge certificate along the
selected-event equality already stored in `TrajectoryAgreement`.
-/
def rowOfAgreement (n : Nat) :
    CommonFMSRow labelling alignment path agreement n := by
  let edge := alignment.positiveEdge (path.positive n)
  refine
    { mark := alignment.classify (agreement.trajectory.event n)
      sourceDenotation := alignment.denote (path.state n)
      targetDenotation := alignment.denote (path.state (n + 1))
      mark_exact := rfl
      source_exact := rfl
      target_exact := rfl
      native := agreement.trajectory.native n
      replay := agreement.replay n
      metadataExact := ?_
      meaning := ?_ }
  · simpa only [agreement.selected_event n] using edge.metadataExact
  simpa only [agreement.selected_event n] using edge.meaning

/--
Construct the entire common-FMS path from the existing positive trajectory
agreement.  No additional path-level premise is required.
-/
def ofTrajectoryAgreement :
    CommonFMSTrajectory labelling alignment path agreement where
  row := rowOfAgreement
  adjacentDenotation := by
    intro n
    rfl

@[simp]
theorem ofTrajectoryAgreement_event_mark
    (n : Nat) :
    ((ofTrajectoryAgreement
      (alignment := alignment)
      (agreement := agreement)).row n).mark =
      alignment.classify (agreement.trajectory.event n) :=
  rfl

include alignment in
/-- Every row retains the exact `DPOEvent` replay of its selected event. -/
theorem ofTrajectoryAgreement_replay
    (n : Nat) :
    (package.eventRecord (agreement.trajectory.event n)).Replays
      (package.configOf (agreement.trajectory.state n))
      (package.configOf (agreement.trajectory.state (n + 1))) :=
  ((ofTrajectoryAgreement
    (alignment := alignment)
    (agreement := agreement)).row n).replay

include alignment in
/-- Registry metadata on every normative path row is replay-canonical. -/
theorem ofTrajectoryAgreement_normative_metadata
    (n : Nat)
    (registryRow : NormativeRegistryRow)
    (marked :
      ((ofTrajectoryAgreement
        (alignment := alignment)
        (agreement := agreement)).row n).mark =
        .normative registryRow) :
    registryRow.metadata =
      canonicalStableMetadata
        (package.eventRecord (agreement.trajectory.event n)).event := by
  let common :=
    ofTrajectoryAgreement
      (alignment := alignment)
      (agreement := agreement)
  have metadata := (common.row n).metadataExact
  unfold EventMetadataAlignment at metadata
  rw [marked] at metadata
  exact metadata

/-- Adjacent rows share one actual-Agent denotational endpoint. -/
theorem ofTrajectoryAgreement_adjacent_denotation
    (n : Nat) :
    ((ofTrajectoryAgreement
      (alignment := alignment)
      (agreement := agreement)).row n).targetDenotation =
      ((ofTrajectoryAgreement
        (alignment := alignment)
        (agreement := agreement)).row (n + 1)).sourceDenotation :=
  (ofTrajectoryAgreement
    (alignment := alignment)
    (agreement := agreement)).adjacentDenotation n

end CommonFMSTrajectory

/--
Existence form of the constructor, convenient for CENTRAL-18 composition.
-/
theorem common_fms_trajectory_of_positive_path
    (labelling : PositiveEventLabelling kernel)
    (alignment : ProductFMSLabelling labelling)
    (path : PositiveStatePath kernel)
    (agreement : labelling.TrajectoryAgreement path) :
    Nonempty
      (CommonFMSTrajectory
        labelling alignment path agreement) :=
  ⟨CommonFMSTrajectory.ofTrajectoryAgreement⟩

/-! ## Heterogeneous signature admission seam -/

/--
One signature-changing admission followed by one fixed-signature business
row in the actual FMS Agent.

The `SignatureAdmissionEvent` retains the old/new signatures, extension,
four-view certificate, strict versions, and tombstone identifier.  Registry
metadata is target-epoch metadata: both the admission realization and the
next business row are explicitly tied to `admission.toVersion`.  The other
stable identifiers remain equal across the seam.
-/
structure HeterogeneousAdmissionFMSAlignment
    {universes : ProjectionUniverses}
    {oldSignature newSignature : FinSignature}
    (admission :
      SignatureAdmissionEvent universes
        (source := oldSignature) (target := newSignature))
    (admissionRow nextBusinessRow : NormativeRegistryRow)
    (admissionTarget nextBusinessSource : ActualFMSEndpoint) where
  admissionOperationRefinesTo :
    P1cOperationRegistry.refinesTo
        (operationAt admissionRow.operation) =
      .dynamicPartnerAdmission
  admissionCommutation :
    TotalCompiledNormativeCommutation admissionRow.family
  nextBusinessCommutation :
    TotalCompiledNormativeCommutation nextBusinessRow.family
  admissionTarget_exact :
    admissionTarget =
      normativeTargetAgent admissionRow.family
  nextBusinessSource_exact :
    nextBusinessSource =
      normativeSourceAgent nextBusinessRow.family
  endpointSeam :
    admissionTarget = nextBusinessSource
  admissionVersion :
    admissionRow.metadata.version = admission.toVersion
  nextBusinessVersion :
    nextBusinessRow.metadata.version = admission.toVersion
  rule_preserved :
    admissionRow.metadata.rule = nextBusinessRow.metadata.rule
  session_preserved :
    admissionRow.metadata.session = nextBusinessRow.metadata.session
  correlation_preserved :
    admissionRow.metadata.correlation =
      nextBusinessRow.metadata.correlation
  occurrence_preserved :
    admissionRow.metadata.occurrence =
      nextBusinessRow.metadata.occurrence

namespace HeterogeneousAdmissionFMSAlignment

variable
    {universes : ProjectionUniverses}
    {oldSignature newSignature : FinSignature}
    {admission :
      SignatureAdmissionEvent universes
        (source := oldSignature) (target := newSignature)}
    {admissionRow nextBusinessRow : NormativeRegistryRow}
    {admissionTarget nextBusinessSource : ActualFMSEndpoint}
    (alignment :
      HeterogeneousAdmissionFMSAlignment
        admission admissionRow nextBusinessRow
        admissionTarget nextBusinessSource)

include alignment in
/-- The registry-derived family of the admission row is exactly admission. -/
theorem admission_family :
    admissionRow.family = .dynamicPartnerAdmission := by
  calc
    admissionRow.family =
        P1cOperationRegistry.refinesTo
          (operationAt admissionRow.operation) := by
      simpa [NormativeRegistryRow.family, familyAt] using
        entry_refinesTo admissionRow.operation
    _ = .dynamicPartnerAdmission :=
      alignment.admissionOperationRefinesTo

include alignment in
/-- The admission target is literally the next business source in `Agent`. -/
theorem target_is_next_business_source :
    admissionTarget = nextBusinessSource :=
  alignment.endpointSeam

include alignment in
/--
After eliminating the caller's endpoint names, the two independently
compiled normative rows share one literal actual-Agent endpoint.
-/
theorem normative_endpoint_seam :
    normativeTargetAgent admissionRow.family =
      normativeSourceAgent nextBusinessRow.family := by
  calc
    normativeTargetAgent admissionRow.family =
        admissionTarget :=
      alignment.admissionTarget_exact.symm
    _ = nextBusinessSource :=
      alignment.endpointSeam
    _ = normativeSourceAgent nextBusinessRow.family :=
      alignment.nextBusinessSource_exact

include alignment in
/-- Both registry rows are explicitly attached to the new signature epoch. -/
theorem target_epoch_versions :
    admissionRow.metadata.version = admission.toVersion ∧
      nextBusinessRow.metadata.version = admission.toVersion :=
  ⟨alignment.admissionVersion, alignment.nextBusinessVersion⟩

include alignment in
/-- All non-version stable identifiers survive the admission/business seam. -/
theorem stable_metadata_seam :
    admissionRow.metadata.rule = nextBusinessRow.metadata.rule ∧
      admissionRow.metadata.session = nextBusinessRow.metadata.session ∧
      admissionRow.metadata.correlation =
        nextBusinessRow.metadata.correlation ∧
      admissionRow.metadata.occurrence =
        nextBusinessRow.metadata.occurrence :=
  ⟨alignment.rule_preserved, alignment.session_preserved,
    alignment.correlation_preserved, alignment.occurrence_preserved⟩

end HeterogeneousAdmissionFMSAlignment

end Cantilune.Feedback.ProductCommonFMSTrajectory
