import Mathlib
import Cantilune.Pi.Core

/-!
# P1c Multi-State Protocol

This file defines the 3-state protocol for P1c operations, extending the 2-state
LTS to fully reflect reconnect/delete operations per RFC-0002 §4.3 and D7-A.

## Multi-State Design

Each P1c admitted operation follows a 3+ state protocol:
- **State 1 (Request)**: Operation initiated
- **State 2 (Acknowledgment)**: External acknowledgment awaited
- **State 3 (Complete)**: Operation completed (or failed)

Special operations (reconnect, delete, mismatch, quiescent-delete) require
additional intermediate states to capture their full operational semantics.

## References
- RFC-0002 §4.3 (P1c multi-state protocol)
- `docs/spec/observable-lts-policies.md` §5.5
- D7-A decision (metadata representation strategy)
-/

namespace Cantilune.Pi.P1cMultiState

/-- 
Multi-state protocol phases for P1c operations.
Each operation progresses through these states.
-/
inductive ProtocolState where
  | request : ProtocolState           -- State 1: Request initiated
  | acknowledge : ProtocolState       -- State 2: External acknowledgment
  | complete : ProtocolState          -- State 3: Completed
  | failed : ProtocolState            -- Failed state (error handling)
  deriving DecidableEq, Repr, Inhabited

/--
Extended observable labels for P1c, including standard π-calculus actions
plus reconnect/delete/mismatch operations per RFC-0002 §4.3.
-/
inductive P1cObservableLabel where
  | comm : Name → P1cObservableLabel                    -- τ communication on channel
  | input : Name → Name → P1cObservableLabel            -- a(v) - input value v on channel a
  | output : Name → Name → P1cObservableLabel           -- ā⟨v⟩ - output value v on channel a
  | reconnect : Name → Name → P1cObservableLabel        -- reconnect(a, b) - reconnect from a to b
  | delete : Name → P1cObservableLabel                  -- delete(a) - delete channel a
  | mismatch : Name → Name → P1cObservableLabel         -- mismatch(a, b) - type mismatch
  | quiescentDelete : Name → P1cObservableLabel         -- quiescent-delete(a) - shutdown on a
  deriving DecidableEq, Repr

/--
State machine for a single P1c operation.
Tracks current protocol state and the operation label.
-/
structure OperationStateMachine where
  label : P1cObservableLabel
  state : ProtocolState
  deriving DecidableEq, Repr

namespace OperationStateMachine

/-- Initialize a new operation in Request state -/
def init (label : P1cObservableLabel) : OperationStateMachine :=
  { label := label, state := .request }

/-- Transition to Acknowledgment state -/
def toAcknowledge (sm : OperationStateMachine) : OperationStateMachine :=
  { sm with state := .acknowledge }

/-- Transition to Complete state -/
def toComplete (sm : OperationStateMachine) : OperationStateMachine :=
  { sm with state := .complete }

/-- Transition to Failed state -/
def toFailed (sm : OperationStateMachine) : OperationStateMachine :=
  { sm with state := .failed }

/-- Check if operation is in terminal state -/
def isTerminal (sm : OperationStateMachine) : Bool :=
  sm.state == .complete || sm.state == .failed

/-- Check if operation can progress -/
def canProgress (sm : OperationStateMachine) : Bool :=
  !sm.isTerminal

end OperationStateMachine

/--
Protocol transition rules for state machine progression.
Defines valid state transitions for each operation type.
-/
inductive ProtocolTransition : OperationStateMachine → OperationStateMachine → Prop where
  | requestToAck : ∀ (label : P1cObservableLabel),
      ProtocolTransition 
        { label := label, state := .request }
        { label := label, state := .acknowledge }
  
  | ackToComplete : ∀ (label : P1cObservableLabel),
      ProtocolTransition
        { label := label, state := .acknowledge }
        { label := label, state := .complete }
  
  | requestToFailed : ∀ (label : P1cObservableLabel),
      ProtocolTransition
        { label := label, state := .request }
        { label := label, state := .failed }
  
  | ackToFailed : ∀ (label : P1cObservableLabel),
      ProtocolTransition
        { label := label, state := .acknowledge }
        { label := label, state := .failed }

/--
Reflexive transitive closure of protocol transitions.
-/
inductive ProtocolTransitionStar : OperationStateMachine → OperationStateMachine → Prop where
  | refl : ∀ sm, ProtocolTransitionStar sm sm
  | step : ∀ sm1 sm2 sm3,
      ProtocolTransition sm1 sm2 →
      ProtocolTransitionStar sm2 sm3 →
      ProtocolTransitionStar sm1 sm3

/--
Well-formed protocol execution: all operations reach Complete state.
-/
def WellFormedExecution (operations : List OperationStateMachine) : Prop :=
  ∀ op ∈ operations, op.state = .complete

/--
Special protocol for reconnect operation.
Reconnect requires additional coordination state.
-/
structure ReconnectProtocol where
  oldChannel : Name
  newChannel : Name
  state : ProtocolState
  delegationComplete : Bool
  deriving DecidableEq, Repr

/--
Special protocol for delete operation.
Delete requires coordination and resource cleanup.
-/
structure DeleteProtocol where
  channel : Name
  state : ProtocolState
  resourcesFreed : Bool
  deriving DecidableEq, Repr

/--
Special protocol for mismatch operation.
Mismatch requires type checking and error reporting.
-/
structure MismatchProtocol where
  leftName : Name
  rightName : Name
  state : ProtocolState
  errorReported : Bool
  deriving DecidableEq, Repr

/--
Special protocol for quiescent delete.
Quiescent delete requires verification that channel is idle.
-/
structure QuiescentDeleteProtocol where
  channel : Name
  state : ProtocolState
  quiescenceVerified : Bool
  deriving DecidableEq, Repr

/--
Protocol invariants: safety properties that must hold throughout execution.
-/
structure ProtocolInvariants where
  /-- No state can regress from Complete to earlier states -/
  noRegression : ∀ sm1 sm2,
    ProtocolTransitionStar sm1 sm2 →
    sm1.state = .complete →
    sm2.state = .complete
  
  /-- Failed state is absorbing -/
  failedAbsorbing : ∀ sm1 sm2,
    ProtocolTransition sm1 sm2 →
    sm1.state = .failed →
    sm2.state = .failed
  
  /-- Labels are preserved during transitions -/
  labelPreservation : ∀ sm1 sm2,
    ProtocolTransition sm1 sm2 →
    sm1.label = sm2.label

/--
Theorem: Protocol transitions preserve labels.
-/
theorem protocol_transition_preserves_label :
  ∀ sm1 sm2, ProtocolTransition sm1 sm2 → sm1.label = sm2.label := by
  intro sm1 sm2 h
  cases h <;> rfl

/--
Theorem: Complete state cannot transition further.
-/
theorem complete_is_terminal :
  ∀ sm1 sm2, sm1.state = .complete → ¬ProtocolTransition sm1 sm2 := by
  intro sm1 sm2 hcomplete htrans
  cases htrans <;> cases hcomplete

/--
Theorem: Failed state cannot transition to non-failed state.
-/
theorem failed_is_absorbing :
  ∀ sm1 sm2, sm1.state = .failed → ProtocolTransition sm1 sm2 → sm2.state = .failed := by
  intro sm1 sm2 hfailed htrans
  cases htrans <;> cases hfailed

/--
Theorem: Request state can reach Complete state.
-/
theorem request_can_complete :
  ∀ label, ∃ sm_complete,
    ProtocolTransitionStar
      { label := label, state := .request }
      sm_complete ∧
    sm_complete.state = .complete := by
  intro label
  exists { label := label, state := .complete }
  constructor
  · apply ProtocolTransitionStar.step
    · exact ProtocolTransition.requestToAck label
    · apply ProtocolTransitionStar.step
      · exact ProtocolTransition.ackToComplete label
      · exact ProtocolTransitionStar.refl _
  · rfl

end Cantilune.Pi.P1cMultiState
