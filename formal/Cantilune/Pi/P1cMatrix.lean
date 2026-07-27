import Mathlib
import Cantilune.Core.Reconfiguration
import Cantilune.Pi.AdmissionCertificate
import Cantilune.Pi.Certificates

/-!
# Finite-epoch P1c rule-certificate matrix

This module is a mechanically enumerable audit surface, not a claim that P1c
is complete.  A completed matrix cell must contain one proof of the target's
declared native relation and a proof that the endpoints differ.  There is no
constructor for reflexive/transitive or weak closure.

Cells not yet connected to a native target semantics are represented by an
indexed `TypedObligation`.  `RuleMatrix.Complete` requires every cell to be a
`nativeStrong` cell, so the present partial matrix cannot be upgraded merely
by changing metadata.
-/

namespace Cantilune.Pi.P1cMatrix

open Cantilune.Core
open Cantilune.Pi
open Cantilune.Pi.Protocols

/-- Source-event vocabulary of the finite-epoch P1c audit calculus. -/
inductive SourceEvent where
  | freeOutput
  | boundOutput
  | lateInput
  | communication
  | openClose
  | restriction
  | scopeExtrusion
  | delegation
  | choiceLeft
  | choiceRight
  | matchSuccess
  | mismatchGuard
  | dynamicPartnerAdmission
  | instanceReconnect
  | instanceDeleteQuiescent
  deriving DecidableEq, Repr, Fintype

/--
Event-indexed before/after states for the finite audit calculus.  This skeleton
records rule coverage only; product execution semantics must be supplied by
the projection cells rather than inferred from these states.
-/
inductive SourceState where
  | ready (event : SourceEvent)
  | completed (event : SourceEvent)
  deriving DecidableEq, Repr, Fintype

/-- Every enumerated rule is a real, non-reflexive source transition. -/
inductive SourceStep : SourceState → SourceEvent → SourceState → Prop where
  | execute (event : SourceEvent) :
      SourceStep (.ready event) event (.completed event)

/-- Signature admission is the sole epoch-boundary event in this audit LTS. -/
def sourceVersion : SourceState → Nat
  | .completed .dynamicPartnerAdmission => 1
  | _ => 0

/-- Observable LTS of the finite P1c audit calculus. -/
def sourceLTS : ObservableLTS where
  State := SourceState
  Event := SourceEvent
  stateSetoid := ObservableLTS.equalitySetoid SourceState
  step := SourceStep
  observable := fun _ => True
  success
    | .ready _ => False
    | .completed _ => True
  waiting := fun _ => False
  signatureVersion := sourceVersion
  step_congr := by
    intro source source' event target target' hSource hTarget
    subst source'
    subst target'
    rfl
  success_congr := by
    intro source target h
    subst target
    rfl
  waiting_congr := by
    intro source target h
    subst target
    rfl
  signatureVersion_congr := by
    intro source target h
    subst target
    rfl

theorem source_event_observable (event : SourceEvent) :
    sourceLTS.ObservableStep (.ready event) event (.completed event) :=
  ⟨SourceStep.execute event, trivial⟩

/-- The four mandatory projection columns. -/
inductive Projection where
  | dag
  | petri
  | pi
  | morphism
  deriving DecidableEq, Repr, Fintype

abbrev CellKey := SourceEvent × Projection

/-- One independently declared native target transition relation. -/
structure NativeSemantics where
  State : Type
  Label : Type
  step : State → Label → State → Prop
  adequate : SourceEvent → State → Label → State → Prop

/-- Native semantics installed for all four projection columns. -/
structure ProjectionTargets where
  dag : NativeSemantics
  petri : NativeSemantics
  pi : NativeSemantics
  morphism : NativeSemantics

def ProjectionTargets.get
    (targets : ProjectionTargets) : Projection → NativeSemantics
  | .dag => targets.dag
  | .petri => targets.petri
  | .pi => targets.pi
  | .morphism => targets.morphism

/-- Auditable provenance for the currently installed native witnesses. -/
inductive Provenance where
  | dagRewrite
  | petriFiring
  | piKernel
  | requestAcceptCertificate
  | mobilityCertificate
  | admissionCertificate
  | morphismIdentity
  deriving DecidableEq, Repr

/--
A strong, non-silent target derivation for exactly one matrix key.

`nativeStep` is one application of the installed target relation.  Requiring
different endpoints rules out filling a cell with a reflexive no-op.
-/
structure NativeDerivation
    (targets : ProjectionTargets)
    (sourceEvent : SourceEvent) (projection : Projection) where
  sourceStep :
    sourceLTS.ObservableStep
      (.ready sourceEvent) sourceEvent (.completed sourceEvent)
  source : (targets.get projection).State
  label : (targets.get projection).Label
  target : (targets.get projection).State
  nativeStep :
    (targets.get projection).step source label target
  adequate :
    (targets.get projection).adequate sourceEvent source label target
  changesState : source ≠ target
  provenance : Provenance

/--
An indexed proof obligation.  Its mathematical discharge type is
`NativeDerivation targets sourceEvent projection`; metadata cannot inhabit
that type.
-/
structure TypedObligation
    (_targets : ProjectionTargets)
    (_sourceEvent : SourceEvent) (_projection : Projection) where
  obligationId : String
  requiredRelation : String
  blockingReason : String
  deriving Repr

/-- A cell is either backed by one native derivation or remains explicitly partial. -/
inductive Cell
    (targets : ProjectionTargets)
    (sourceEvent : SourceEvent) (projection : Projection) where
  | nativeStrong :
      NativeDerivation targets sourceEvent projection →
      Cell targets sourceEvent projection
  | pending :
      TypedObligation targets sourceEvent projection →
      Cell targets sourceEvent projection

namespace Cell

/-- Logical completion: partial cells reduce to `False`. -/
def Complete {targets : ProjectionTargets}
    {sourceEvent : SourceEvent} {projection : Projection} :
    Cell targets sourceEvent projection → Prop
  | .nativeStrong _ => True
  | .pending _ => False

/-- Executable status projection used only for finite coverage auditing. -/
def isNative {targets : ProjectionTargets}
    {sourceEvent : SourceEvent} {projection : Projection} :
    Cell targets sourceEvent projection → Bool
  | .nativeStrong _ => true
  | .pending _ => false

/-- Extract the derivation from a logically complete cell. -/
def nativeDerivation {targets : ProjectionTargets}
    {sourceEvent : SourceEvent} {projection : Projection}
    (cell : Cell targets sourceEvent projection)
    (complete : cell.Complete) :
    NativeDerivation targets sourceEvent projection := by
  cases cell with
  | nativeStrong derivation => exact derivation
  | pending _ => exact False.elim complete

end Cell

/-- A total four-column cell assignment for every finite source event. -/
structure RuleMatrix (targets : ProjectionTargets) where
  cell :
    (sourceEvent : SourceEvent) →
      (projection : Projection) →
      Cell targets sourceEvent projection

namespace RuleMatrix

/--
Full completion is a proof over every event/projection cell.  A matrix
containing even one `partial` constructor cannot inhabit this structure.
-/
structure Complete {targets : ProjectionTargets}
    (matrix : RuleMatrix targets) : Prop where
  everyCell :
    ∀ sourceEvent projection,
      (matrix.cell sourceEvent projection).Complete

end RuleMatrix

/-! ## Current installed semantics and concrete strong π witnesses -/

/--
No P1c-native semantics has yet been installed for this projection column.
Using `False` prevents an absent semantics from being mistaken for a trivial
one-step model.
-/
def uninstalledSemantics : NativeSemantics where
  State := Unit
  Label := Unit
  step := fun _ _ _ => False
  adequate := fun _ _ _ _ => False

/-- Exact event-to-endpoint specification for currently implemented π cells. -/
inductive PiAdequate : SourceEvent → Proc → Action → Proc → Prop where
  | freeOutput :
      PiAdequate .freeOutput
        messageSender (.output sessionChannel payload) .zero
  | boundOutput :
      PiAdequate .boundOutput
        (.new delegated (.send delegationChannel delegated .zero))
        (.boundOutput delegationChannel delegated) .zero
  | lateInput :
      PiAdequate .lateInput
        messageReceiver (.input sessionChannel payloadBinder) .zero
  | communication :
      PiAdequate .communication
        (.par messageSender messageReceiver) .tau
        (.par .zero .zero)
  | openClose :
      PiAdequate .openClose extrudedHandshake .tau handshakeResult
  | restriction :
      PiAdequate .restriction
        closedRestrictedHandshake .tau closedHandshakeResult
  | scopeExtrusion :
      PiAdequate .scopeExtrusion
        (.new session (.send publicChannel session .zero))
        (.boundOutput publicChannel session) .zero
  | delegation :
      PiAdequate .delegation
        closedDelegationOffering .tau closedDelegationResult
  | choiceLeft :
      PiAdequate .choiceLeft
        (.choice (.tau .zero) .zero) .tau .zero
  | choiceRight :
      PiAdequate .choiceRight
        (.choice .zero (.tau .zero)) .tau .zero
  | matchSuccess :
      PiAdequate .matchSuccess
        (.matchEq payload payload (.tau .zero)) .tau .zero
  | mismatchGuard :
      PiAdequate .mismatchGuard
        mismatchDecision .tau .zero
  | dynamicPartnerAdmission :
      PiAdequate .dynamicPartnerAdmission
        Cantilune.Pi.AdmissionCertificate.certifiedAdmissionWait
        Cantilune.Pi.AdmissionCertificate.admissionAction
        .zero
  | instanceReconnect :
      PiAdequate .instanceReconnect
        reconnectOffering .tau reconnectResult
  | instanceDeleteQuiescent :
      PiAdequate .instanceDeleteQuiescent
        quiescentDeleteOffering .tau quiescentDeleteResult

/--
The π column uses the actual finite-control kernel relation and the exact
event-indexed endpoint specification above.
-/
def piSemantics : NativeSemantics where
  State := Proc
  Label := Action
  step := Cantilune.Pi.Step
  adequate := PiAdequate

/-- Current targets: only the π native kernel is installed for P1c rules. -/
def referenceTargets : ProjectionTargets where
  dag := uninstalledSemantics
  petri := uninstalledSemantics
  pi := piSemantics
  morphism := uninstalledSemantics

theorem requestAccept_from_certificate :
    Cantilune.Pi.Step
      closedRestrictedHandshake .tau closedHandshakeResult := by
  exact
    (Cantilune.Pi.Certificates.RequestAccept.pi_ra_native_sound
      (show
        Cantilune.Pi.Certificates.RequestAccept.sourceLTS.ObservableStep
          .requesting .establishSession .established from
        ⟨Cantilune.Pi.Certificates.RequestAccept.Step.establishSession,
          trivial⟩)).1

theorem delegation_from_certificate :
    Cantilune.Pi.Step
      closedDelegationOffering .tau closedDelegationResult := by
  exact
    (Cantilune.Pi.Certificates.Mobility.pi_mobility_native_sound
      (show
        Cantilune.Pi.Certificates.Mobility.sourceLTS.ObservableStep
          .offering .delegateChannel .delegated from
        ⟨Cantilune.Pi.Certificates.Mobility.Step.delegateChannel,
          trivial⟩)).1

theorem admission_from_certificate :
    Cantilune.Pi.Step
      Cantilune.Pi.AdmissionCertificate.certifiedAdmissionWait
      Cantilune.Pi.AdmissionCertificate.admissionAction
      .zero :=
  Cantilune.Pi.AdmissionCertificate.target_admission_observable.1

private def strongPiCell
    (sourceEvent : SourceEvent)
    (source : Proc) (label : Action) (target : Proc)
    (step : Cantilune.Pi.Step source label target)
    (adequate : PiAdequate sourceEvent source label target)
    (changes : source ≠ target)
    (provenance : Provenance) :
    Cell referenceTargets sourceEvent .pi :=
  .nativeStrong
    { sourceStep := source_event_observable sourceEvent
      source := source
      label := label
      target := target
      nativeStep := step
      adequate := adequate
      changesState := changes
      provenance := provenance }

private def pendingCell
    {sourceEvent : SourceEvent} {projection : Projection}
    (id required reason : String) :
    Cell referenceTargets sourceEvent projection :=
  .pending
    { obligationId := id
      requiredRelation := required
      blockingReason := reason }

def piCell : (sourceEvent : SourceEvent) →
    Cell referenceTargets sourceEvent .pi
  | .freeOutput =>
      strongPiCell .freeOutput
        messageSender (.output sessionChannel payload) .zero
        Cantilune.Pi.Step.prefixOutput .freeOutput
        (by decide) .piKernel
  | .boundOutput =>
      strongPiCell .boundOutput
        (.new delegated (.send delegationChannel delegated .zero))
        (.boundOutput delegationChannel delegated) .zero
        (Cantilune.Pi.Step.scopeOpen (by decide))
        .boundOutput
        (by decide) .piKernel
  | .lateInput =>
      strongPiCell .lateInput
        messageReceiver (.input sessionChannel payloadBinder) .zero
        Cantilune.Pi.Step.prefixInput .lateInput
        (by decide) .piKernel
  | .communication =>
      strongPiCell .communication
        (.par messageSender messageReceiver) .tau
        (.par .zero .zero)
        message_one_step .communication (by decide) .piKernel
  | .openClose =>
      strongPiCell .openClose
        extrudedHandshake .tau handshakeResult
        request_accept_scope_extrusion .openClose
        (by decide) .piKernel
  | .restriction =>
      strongPiCell .restriction
        closedRestrictedHandshake .tau closedHandshakeResult
        requestAccept_from_certificate .restriction
        (by decide)
        .requestAcceptCertificate
  | .scopeExtrusion =>
      strongPiCell .scopeExtrusion
        (.new session (.send publicChannel session .zero))
        (.boundOutput publicChannel session) .zero
        (Cantilune.Pi.Step.scopeOpen (by decide))
        .scopeExtrusion
        (by decide) .piKernel
  | .delegation =>
      strongPiCell .delegation
        closedDelegationOffering .tau closedDelegationResult
        delegation_from_certificate .delegation
        (by decide)
        .mobilityCertificate
  | .choiceLeft =>
      strongPiCell .choiceLeft
        (.choice (.tau .zero) .zero) .tau .zero
        (Cantilune.Pi.Step.choiceLeft Cantilune.Pi.Step.prefixTau)
        .choiceLeft
        (by decide) .piKernel
  | .choiceRight =>
      strongPiCell .choiceRight
        (.choice .zero (.tau .zero)) .tau .zero
        (Cantilune.Pi.Step.choiceRight Cantilune.Pi.Step.prefixTau)
        .choiceRight
        (by decide) .piKernel
  | .matchSuccess =>
      strongPiCell .matchSuccess
        (.matchEq payload payload (.tau .zero)) .tau .zero
        (Cantilune.Pi.Step.matchGuard Cantilune.Pi.Step.prefixTau) .matchSuccess
        (by decide) .piKernel
  | .mismatchGuard =>
      strongPiCell .mismatchGuard
        mismatchDecision .tau .zero
        mismatch_decision_one_step .mismatchGuard
        (by decide) .piKernel
  | .dynamicPartnerAdmission =>
      strongPiCell .dynamicPartnerAdmission
        Cantilune.Pi.AdmissionCertificate.certifiedAdmissionWait
        Cantilune.Pi.AdmissionCertificate.admissionAction
        .zero admission_from_certificate .dynamicPartnerAdmission
        (by decide)
        .admissionCertificate
  | .instanceReconnect =>
      strongPiCell .instanceReconnect
        reconnectOffering .tau reconnectResult
        reconnect_one_step .instanceReconnect
        (by decide) .mobilityCertificate
  | .instanceDeleteQuiescent =>
      strongPiCell .instanceDeleteQuiescent
        quiescentDeleteOffering .tau quiescentDeleteResult
        quiescent_delete_one_step .instanceDeleteQuiescent
        (by decide) .piKernel

private def unavailableCell
    (sourceEvent : SourceEvent) (projection : Projection) :
    Cell referenceTargets sourceEvent projection :=
  pendingCell
    s!"P1C-{repr projection}-{repr sourceEvent}"
    s!"one native {repr projection} target derivation"
    s!"P1c {repr projection} target semantics is not installed"

/-- The total current audit matrix: 60 keys, with every gap explicitly typed. -/
def referenceMatrix : RuleMatrix referenceTargets where
  cell sourceEvent projection :=
    match projection with
    | .dag => unavailableCell sourceEvent .dag
    | .petri => unavailableCell sourceEvent .petri
    | .pi => piCell sourceEvent
    | .morphism => unavailableCell sourceEvent .morphism

/-! ## Finite coverage and completion audit -/

def allKeys : Finset CellKey :=
  Finset.univ

theorem all_keys_covered (sourceEvent : SourceEvent)
    (projection : Projection) :
    (sourceEvent, projection) ∈ allKeys := by
  simp [allKeys]

theorem all_keys_unique :
    allKeys.toList.Nodup :=
  Finset.nodup_toList allKeys

def nativeCellCount : Nat :=
  (allKeys.filter fun key =>
    (referenceMatrix.cell key.1 key.2).isNative).card

def partialCellCount : Nat :=
  allKeys.card - nativeCellCount

/-- Every currently uninstalled non-π column remains explicitly non-native. -/
theorem non_pi_cell_not_native
    (sourceEvent : SourceEvent) (projection : Projection)
    (notPi : projection ≠ .pi) :
    (referenceMatrix.cell sourceEvent projection).isNative = false := by
  cases projection <;>
    simp_all [referenceMatrix, unavailableCell, pendingCell, Cell.isNative]

/-- The present matrix has an explicit missing DAG cell, so it is not complete. -/
theorem referenceMatrix_not_complete :
    ¬RuleMatrix.Complete referenceMatrix := by
  intro complete
  have impossible :=
    complete.everyCell .freeOutput .dag
  exact impossible

/--
Every P1c source event now has one event-adequate, state-changing native π
derivation.  This closes only the π column; the three non-π columns remain
explicit obligations.
-/
theorem pi_column_complete (sourceEvent : SourceEvent) :
    (referenceMatrix.cell sourceEvent .pi).Complete := by
  cases sourceEvent <;>
    simp [referenceMatrix, piCell, Cell.Complete, strongPiCell]

/-- The concrete direct derivation underlying any completed pi cell. -/
def piReferenceDerivation (sourceEvent : SourceEvent) :
    NativeDerivation referenceTargets sourceEvent .pi :=
  (referenceMatrix.cell sourceEvent .pi).nativeDerivation
    (pi_column_complete sourceEvent)

theorem pi_native_cell_count :
    nativeCellCount = 15 := by
  decide

theorem partial_cell_count_after_pi_extension :
    partialCellCount = 45 := by
  decide

end Cantilune.Pi.P1cMatrix
