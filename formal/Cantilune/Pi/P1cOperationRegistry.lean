import Cantilune.Pi.P1cFullNativeRefinement
import Cantilune.Pi.P1cMultiState.Matrix

/-!
# Exact P1c API registry and enriched strong-step metadata

The operational core of P1c has fifteen source-event families.  The older
reference API enumerates sixty concrete operation names.  This module makes
their relationship explicit:

* `OperationId = Fin 60` is the closed registry index;
* every index selects exactly one of the existing sixty reference operations;
* `refinesTo` is a total, auditable registration map into the fifteen
  normative families;
* the registry codes and entries are unique, all sixty indices occur, and all
  fifteen normative families are represented;
* version, rule, session, correlation, and occurrence identifiers are stable
  metadata, while each phase change is carried explicitly on the target
  label; and
* every registered operation inherits the genuine one-step
  `Late.NativeStep` of its normative family.

The last item is deliberately one-way.  The reference operation vocabulary
has no independent native transition relation, so this file does not invent
a reflection theorem for it.  In particular, a structural or administrative
API name is an audited alias for a normative family, not a claim that a
structural congruence law is itself a late-pi reduction.
-/

namespace Cantilune.Pi.P1cOperationRegistry

open Cantilune.Pi
open Cantilune.Pi.P1cMatrix
open Cantilune.Pi.P1cFullNativeRefinement
open Cantilune.Pi.P1cMultiState

/-- The closed index of the API/reference registry. -/
abbrev OperationId := Fin 60

/--
The total registration policy from API constructors to the fifteen normative
P1c event families.

The mapping is intentionally constructor based: name parameters affect the
product-level occurrence metadata, not the normative family.  Structural and
administrative API aliases are assigned to an existing internal family and
do not thereby acquire a converse operational-reflection theorem.
-/
def refinesTo : P1cOperation → SourceEvent
  | .send _ _
  | .sendPrefix _ _
  | .asyncSend _ _
  | .syncSend _ _
  | .quiescentSend _ _ => .freeOutput
  | .boundOutput _ _ => .boundOutput
  | .receive _ _
  | .receivePrefix _ _
  | .boundInput _ _
  | .syncReceive _ _
  | .quiescentReceive _ _ => .lateInput
  | .comm _
  | .commData _
  | .commChannel _
  | .parLeft
  | .parRight
  | .parComm
  | .fork
  | .join
  | .parZero
  | .quiescentComm _ => .communication
  | .scopeOpen _ => .openClose
  | .scopeClose _ => .restriction
  | .scopeExtrusion _
  | .scopeIntrusion _
  | .scopeReordering _ _
  | .scopeUnused _ => .scopeExtrusion
  | .delegation _ _
  | .handoff _ _
  | .reconnectDelegation _ _
  | .reconnectHandoff _ _ => .delegation
  | .choiceLeft
  | .choiceComm
  | .choiceZero
  | .choiceAssocLeft
  | .choiceAssocRight
  | .choiceSymmetry
  | .tauPrefix
  | .zeroElim
  | .contextSwitch
  | .stateSnapshot
  | .eventLog => .choiceLeft
  | .choiceRight => .choiceRight
  | .matchEqTrue _ _
  | .matchNeFalse _ _ => .matchSuccess
  | .matchEqFalse _ _
  | .matchNeTrue _ _
  | .mismatch _ _
  | .guardedMismatch _ _
  | .mismatchGuarded _ _
  | .mismatchReport _ _ => .mismatchGuard
  | .newChannel _ => .dynamicPartnerAdmission
  | .reconnect _ _ => .instanceReconnect
  | .delete _
  | .quiescentDelete _
  | .deleteWithCleanup _
  | .deleteImmediate _ => .instanceDeleteQuiescent
  | .parAssocLeft
  | .parAssocRight
  | .parSymmetry => .communication

/-- The existing checked enumeration, indexed without a fallback case. -/
def operationAt (index : OperationId) : P1cOperation :=
  allP1cOperations.get
    ⟨index.val, by
      rw [allP1cOperations_count]
      exact index.isLt⟩

/-- One closed registry entry.  `code` is stable and unique in this version. -/
structure RegistryEntry where
  index : OperationId
  code : Nat
  operation : P1cOperation
  refinesTo : SourceEvent
  deriving DecidableEq, Repr

/-- The entry at an exact registry position. -/
def entry (index : OperationId) : RegistryEntry where
  index := index
  code := index.val
  operation := operationAt index
  refinesTo := P1cOperationRegistry.refinesTo (operationAt index)

/-- The complete materialized registry, in code order. -/
def entries : List RegistryEntry :=
  List.ofFn entry

/-- Normative family selected by a registry index. -/
def familyAt (index : OperationId) : SourceEvent :=
  (entry index).refinesTo

/-- Closed registry position of the signature-admission API operation. -/
def dynamicPartnerAdmissionOperation : OperationId :=
  ⟨12, by decide⟩

/-- Closed registry position of the substantive reconnect API operation. -/
def instanceReconnectOperation : OperationId :=
  ⟨13, by decide⟩

@[simp]
theorem familyAt_dynamicPartnerAdmissionOperation :
    familyAt dynamicPartnerAdmissionOperation =
      .dynamicPartnerAdmission := by
  decide

@[simp]
theorem familyAt_instanceReconnectOperation :
    familyAt instanceReconnectOperation =
      .instanceReconnect := by
  decide

theorem entry_code (index : OperationId) :
    (entry index).code = index.val := rfl

theorem entry_operation (index : OperationId) :
    (entry index).operation = operationAt index := rfl

theorem entry_refinesTo (index : OperationId) :
    (entry index).refinesTo = refinesTo (operationAt index) := rfl

/-- Registry codes identify their indices. -/
theorem code_injective :
    Function.Injective (fun index : OperationId => (entry index).code) := by
  intro left right equality
  apply Fin.ext
  simpa [entry] using equality

/-- Entire entries identify their indices. -/
theorem entry_injective :
    Function.Injective entry := by
  intro left right equality
  apply code_injective
  exact congrArg RegistryEntry.code equality

/-- The materialized registry contains exactly sixty positions. -/
theorem entries_length :
    entries.length = 60 := by
  native_decide

/-- No registry code is reused. -/
theorem entry_codes_nodup :
    (entries.map RegistryEntry.code).Nodup := by
  native_decide

/-- Consequently, no complete registry entry is duplicated. -/
theorem entries_nodup :
    entries.Nodup := by
  native_decide

/-- Every closed registry index is represented in the materialized registry. -/
theorem entry_mem (index : OperationId) :
    entry index ∈ entries := by
  rw [entries, List.mem_ofFn', Set.mem_range]
  exact ⟨index, rfl⟩

/-- Membership has no hidden or out-of-range cases. -/
theorem entries_complete (candidate : RegistryEntry) :
    candidate ∈ entries ↔ ∃ index : OperationId, entry index = candidate := by
  rw [entries, List.mem_ofFn', Set.mem_range]

/-- The sixty-entry reference registry covers all fifteen normative families. -/
theorem familyAt_surjective :
    Function.Surjective familyAt := by
  native_decide

/-! ## Stable identifiers and explicit phases -/

/--
Identifiers which must be replay-stable across the native step.  They are
kept separate from the phase because the phase is expected to change.
-/
structure StableMetadata where
  version : Nat
  rule : Nat
  session : Nat
  correlation : Nat
  occurrence : Nat
  deriving DecidableEq, Repr

/-- Explicit protocol phases carried by enriched states and labels. -/
inductive Phase where
  | requested
  | sessionEstablished
  | admitted
  | reconnected
  | quiescentDeleted
  | completed
  deriving DecidableEq, Repr

/-- The result phase of the first normative strong step. -/
def firstTargetPhase : SourceEvent → Phase
  | .openClose
  | .restriction => .sessionEstablished
  | .dynamicPartnerAdmission => .admitted
  | .instanceReconnect => .reconnected
  | .instanceDeleteQuiescent => .quiescentDeleted
  | _ => .completed

/--
An enriched operational state.  Its normative family is derived from
`operation`, so inconsistent operation/family pairs are unrepresentable.
-/
structure EnrichedState where
  operation : OperationId
  metadata : StableMetadata
  phase : Phase
  process : Raw.Proc
  deriving DecidableEq, Repr

namespace EnrichedState

def family (state : EnrichedState) : SourceEvent :=
  familyAt state.operation

end EnrichedState

/--
A label names both endpoints of the phase transition.  Thus a tau action is
still a visible registry occurrence with explicit phase, rule, session, and
correlation identity; it is never a tau-star summary.
-/
structure EnrichedAction where
  operation : OperationId
  metadata : StableMetadata
  fromPhase : Phase
  toPhase : Phase
  nativeAction : Raw.Action
  deriving DecidableEq, Repr

/--
The enriched relation is exactly one underlying standard late-pi native
step.  Stable metadata and the operation code are copied unchanged, while
the phase transition is recorded on the label.
-/
inductive RegistryNativeStep :
    EnrichedState → EnrichedAction → EnrichedState → Prop where
  | native
      (operation : OperationId)
      (metadata : StableMetadata)
      (fromPhase toPhase : Phase)
      {source target : Raw.Proc}
      {action : Raw.Action}
      (step : Late.NativeStep source action target) :
      RegistryNativeStep
        ⟨operation, metadata, fromPhase, source⟩
        ⟨operation, metadata, fromPhase, toPhase, action⟩
        ⟨operation, metadata, toPhase, target⟩

/-- Canonical pre-state of a registered operation occurrence. -/
def initialState (index : OperationId) (metadata : StableMetadata) :
    EnrichedState :=
  ⟨index, metadata, .requested, readyProcess (familyAt index)⟩

/-- Explicit first phase event of a registered operation occurrence. -/
def firstEvent (index : OperationId) (metadata : StableMetadata) :
    EnrichedAction :=
  ⟨index, metadata, .requested, firstTargetPhase (familyAt index),
    firstAction (familyAt index)⟩

/-- Canonical endpoint of the registered operation's first native step. -/
def firstState (index : OperationId) (metadata : StableMetadata) :
    EnrichedState :=
  ⟨index, metadata, firstTargetPhase (familyAt index),
    firstTarget (familyAt index)⟩

/--
Every one of the sixty registry positions maps to one genuine strong
standard late-pi step through its selected normative family.
-/
theorem registry_first_native
    (index : OperationId) (metadata : StableMetadata) :
    RegistryNativeStep
      (initialState index metadata)
      (firstEvent index metadata)
      (firstState index metadata) := by
  exact RegistryNativeStep.native _ _ _ _
    (P1cFullNativeRefinement.first_native (familyAt index))

/--
The raw witness underlying `registry_first_native`; this theorem makes the
absence of weak closure or an observation filter explicit at the API
boundary.
-/
theorem registry_has_genuine_strong_step (index : OperationId) :
    Late.NativeStep
      (readyProcess (familyAt index))
      (firstAction (familyAt index))
      (firstTarget (familyAt index)) :=
  P1cFullNativeRefinement.first_native (familyAt index)

/-- Version, rule, session, correlation, and occurrence data are unchanged. -/
theorem stable_metadata_preserved
    {source : EnrichedState}
    {event : EnrichedAction}
    {target : EnrichedState}
    (step : RegistryNativeStep source event target) :
    source.metadata = event.metadata ∧
      event.metadata = target.metadata := by
  cases step
  exact ⟨rfl, rfl⟩

/-- The stable identifiers are available as a fieldwise replay invariant. -/
theorem stable_identifiers_preserved
    {source : EnrichedState}
    {event : EnrichedAction}
    {target : EnrichedState}
    (step : RegistryNativeStep source event target) :
    source.metadata.version = target.metadata.version ∧
      source.metadata.rule = target.metadata.rule ∧
      source.metadata.session = target.metadata.session ∧
      source.metadata.correlation = target.metadata.correlation ∧
      source.metadata.occurrence = target.metadata.occurrence := by
  cases step
  exact ⟨rfl, rfl, rfl, rfl, rfl⟩

/-- The closed operation code, and hence its normative family, is preserved. -/
theorem operation_and_family_preserved
    {source : EnrichedState}
    {event : EnrichedAction}
    {target : EnrichedState}
    (step : RegistryNativeStep source event target) :
    source.operation = event.operation ∧
      event.operation = target.operation ∧
      source.family = target.family := by
  cases step
  exact ⟨rfl, rfl, rfl⟩

/-- Every phase change is explicitly named by the one-step event. -/
theorem phase_is_explicit
    {source : EnrichedState}
    {event : EnrichedAction}
    {target : EnrichedState}
    (step : RegistryNativeStep source event target) :
    source.phase = event.fromPhase ∧
      target.phase = event.toPhase := by
  cases step
  exact ⟨rfl, rfl⟩

/-- The enriched action is the action of the genuine underlying native step. -/
theorem native_action_exposed
    {source : EnrichedState}
    {event : EnrichedAction}
    {target : EnrichedState}
    (step : RegistryNativeStep source event target) :
    Late.NativeStep source.process event.nativeAction target.process := by
  cases step with
  | native _ _ _ _ nativeStep => exact nativeStep

end Cantilune.Pi.P1cOperationRegistry
