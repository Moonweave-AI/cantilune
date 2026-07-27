import Cantilune.Pi.P1cMultiState.Protocol

/-!
# P1c Admitted Operations

This file defines the 60 admitted operations for P1c protocol, organized into
operation families. Per RFC-0002 §4.3, each operation has a well-defined
state machine and operational semantics.

## Operation Families

1. **Communication** (12 ops): send, receive, τ communication
2. **Channel Management** (8 ops): new, reconnect, delete
3. **Parallelism** (6 ops): parallel composition, fork
4. **Choice** (4 ops): internal choice, external choice
5. **Matching** (6 ops): equality match, inequality match (mismatch)
6. **Structural** (12 ops): associativity, commutativity, scope extrusion
7. **Special** (12 ops): quiescent-delete, delegation, handoff

Total: 60 operations in the P1c reference matrix.
-/

namespace Cantilune.Pi.P1cMultiState

/--
Operation family classification for the 60 P1c operations.
-/
inductive OperationFamily where
  | communication : OperationFamily
  | channelManagement : OperationFamily
  | parallelism : OperationFamily
  | choice : OperationFamily
  | matching : OperationFamily
  | structural : OperationFamily
  | special : OperationFamily
  deriving DecidableEq, Repr

/--
Complete enumeration of 60 P1c admitted operations.
Each operation has a unique identifier and belongs to a family.
-/
inductive P1cOperation where
  -- Communication family (12 operations)
  | send : Name → Name → P1cOperation                    -- send value on channel
  | receive : Name → Name → P1cOperation                 -- receive value on channel
  | comm : Name → P1cOperation                           -- τ communication
  | sendPrefix : Name → Name → P1cOperation              -- send with continuation
  | receivePrefix : Name → Name → P1cOperation           -- receive with continuation
  | boundOutput : Name → Name → P1cOperation             -- bound name output
  | boundInput : Name → Name → P1cOperation              -- bound name input
  | commData : Name → P1cOperation                       -- data communication
  | commChannel : Name → P1cOperation                    -- channel communication
  | asyncSend : Name → Name → P1cOperation               -- asynchronous send
  | syncSend : Name → Name → P1cOperation                -- synchronous send
  | syncReceive : Name → Name → P1cOperation             -- synchronous receive
  
  -- Channel Management family (8 operations)
  | newChannel : Name → P1cOperation                     -- create new channel
  | reconnect : Name → Name → P1cOperation               -- reconnect channel
  | delete : Name → P1cOperation                         -- delete channel
  | quiescentDelete : Name → P1cOperation                -- quiescent shutdown
  | delegation : Name → Name → P1cOperation              -- delegate channel
  | handoff : Name → Name → P1cOperation                 -- handoff channel
  | scopeOpen : Name → P1cOperation                      -- open scope
  | scopeClose : Name → P1cOperation                     -- close scope
  
  -- Parallelism family (6 operations)
  | parLeft : P1cOperation                               -- parallel left
  | parRight : P1cOperation                              -- parallel right
  | parComm : P1cOperation                               -- parallel commute
  | fork : P1cOperation                                  -- fork process
  | join : P1cOperation                                  -- join processes
  | parZero : P1cOperation                               -- parallel with zero
  
  -- Choice family (4 operations)
  | choiceLeft : P1cOperation                            -- left choice
  | choiceRight : P1cOperation                           -- right choice
  | choiceComm : P1cOperation                            -- choice commute
  | choiceZero : P1cOperation                            -- choice with zero
  
  -- Matching family (6 operations)
  | matchEqTrue : Name → Name → P1cOperation             -- equality match (equal)
  | matchEqFalse : Name → Name → P1cOperation            -- equality match (not equal)
  | matchNeTrue : Name → Name → P1cOperation             -- inequality match (not equal)
  | matchNeFalse : Name → Name → P1cOperation            -- inequality match (equal)
  | mismatch : Name → Name → P1cOperation                -- type mismatch
  | guardedMismatch : Name → Name → P1cOperation         -- guarded mismatch
  
  -- Structural family (12 operations)
  | parAssocLeft : P1cOperation                          -- (P|Q)|R → P|(Q|R)
  | parAssocRight : P1cOperation                         -- P|(Q|R) → (P|Q)|R
  | choiceAssocLeft : P1cOperation                       -- (P+Q)+R → P+(Q+R)
  | choiceAssocRight : P1cOperation                      -- P+(Q+R) → (P+Q)+R
  | scopeExtrusion : Name → P1cOperation                 -- scope extrusion
  | scopeIntrusion : Name → P1cOperation                 -- scope intrusion
  | parSymmetry : P1cOperation                           -- P|Q ≡ Q|P
  | choiceSymmetry : P1cOperation                        -- P+Q ≡ Q+P
  | scopeReordering : Name → Name → P1cOperation         -- (νa)(νb)P ≡ (νb)(νa)P
  | scopeUnused : Name → P1cOperation                    -- (νa)P ≡ P if a ∉ fn(P)
  | tauPrefix : P1cOperation                             -- τ.P step
  | zeroElim : P1cOperation                              -- 0 elimination
  
  -- Special family (12 operations)
  | quiescentComm : Name → P1cOperation                  -- quiescent communication
  | quiescentSend : Name → Name → P1cOperation           -- quiescent send
  | quiescentReceive : Name → Name → P1cOperation        -- quiescent receive
  | reconnectDelegation : Name → Name → P1cOperation     -- reconnect via delegation
  | reconnectHandoff : Name → Name → P1cOperation        -- reconnect via handoff
  | deleteWithCleanup : Name → P1cOperation              -- delete with resource cleanup
  | deleteImmediate : Name → P1cOperation                -- immediate delete
  | mismatchGuarded : Name → Name → P1cOperation         -- mismatch with guard
  | mismatchReport : Name → Name → P1cOperation          -- mismatch with error report
  | contextSwitch : P1cOperation                         -- context switch
  | stateSnapshot : P1cOperation                         -- state snapshot
  | eventLog : P1cOperation                              -- event logging
  deriving DecidableEq, Repr

namespace P1cOperation

/-- Get the operation family for a given operation -/
def family : P1cOperation → OperationFamily
  | send _ _ | receive _ _ | comm _ | sendPrefix _ _ | receivePrefix _ _
  | boundOutput _ _ | boundInput _ _ | commData _ | commChannel _
  | asyncSend _ _ | syncSend _ _ | syncReceive _ _ => .communication
  
  | newChannel _ | reconnect _ _ | delete _ | quiescentDelete _
  | delegation _ _ | handoff _ _ | scopeOpen _ | scopeClose _ => .channelManagement
  
  | parLeft | parRight | parComm | fork | join | parZero => .parallelism
  
  | choiceLeft | choiceRight | choiceComm | choiceZero => .choice
  
  | matchEqTrue _ _ | matchEqFalse _ _ | matchNeTrue _ _ | matchNeFalse _ _
  | mismatch _ _ | guardedMismatch _ _ => .matching
  
  | parAssocLeft | parAssocRight | choiceAssocLeft | choiceAssocRight
  | scopeExtrusion _ | scopeIntrusion _ | parSymmetry | choiceSymmetry
  | scopeReordering _ _ | scopeUnused _ | tauPrefix | zeroElim => .structural
  
  | quiescentComm _ | quiescentSend _ _ | quiescentReceive _ _
  | reconnectDelegation _ _ | reconnectHandoff _ _
  | deleteWithCleanup _ | deleteImmediate _
  | mismatchGuarded _ _ | mismatchReport _ _
  | contextSwitch | stateSnapshot | eventLog => .special

/-- Convert operation to observable label -/
def toObservableLabel : P1cOperation → P1cObservableLabel
  | send ch val => .output ch val
  | receive ch val => .input ch val
  | comm ch => .comm ch
  | sendPrefix ch val => .output ch val
  | receivePrefix ch val => .input ch val
  | boundOutput ch val => .output ch val
  | boundInput ch val => .input ch val
  | commData ch => .comm ch
  | commChannel ch => .comm ch
  | asyncSend ch val => .output ch val
  | syncSend ch val => .output ch val
  | syncReceive ch val => .input ch val
  | newChannel _ => .comm 0  -- internal action
  | reconnect old new => .reconnect old new
  | delete ch => .delete ch
  | quiescentDelete ch => .quiescentDelete ch
  | delegation old new => .reconnect old new
  | handoff old new => .reconnect old new
  | scopeOpen _ => .comm 0
  | scopeClose _ => .comm 0
  | parLeft | parRight | parComm | fork | join | parZero => .comm 0
  | choiceLeft | choiceRight | choiceComm | choiceZero => .comm 0
  | matchEqTrue _ _ | matchEqFalse _ _ => .comm 0
  | matchNeTrue a b => .mismatch a b
  | matchNeFalse _ _ => .comm 0
  | mismatch a b => .mismatch a b
  | guardedMismatch a b => .mismatch a b
  | parAssocLeft | parAssocRight | choiceAssocLeft | choiceAssocRight => .comm 0
  | scopeExtrusion _ | scopeIntrusion _ => .comm 0
  | parSymmetry | choiceSymmetry => .comm 0
  | scopeReordering _ _ | scopeUnused _ | tauPrefix | zeroElim => .comm 0
  | quiescentComm ch => .comm ch
  | quiescentSend ch val => .output ch val
  | quiescentReceive ch val => .input ch val
  | reconnectDelegation old new => .reconnect old new
  | reconnectHandoff old new => .reconnect old new
  | deleteWithCleanup ch => .delete ch
  | deleteImmediate ch => .delete ch
  | mismatchGuarded a b => .mismatch a b
  | mismatchReport a b => .mismatch a b
  | contextSwitch | stateSnapshot | eventLog => .comm 0

/-- Check if operation is a special operation requiring extended protocol -/
def isSpecialOperation : P1cOperation → Bool
  | reconnect _ _ | delete _ | mismatch _ _ | quiescentDelete _
  | reconnectDelegation _ _ | reconnectHandoff _ _
  | deleteWithCleanup _ | deleteImmediate _
  | mismatchGuarded _ _ | mismatchReport _ _ => true
  | _ => false

/-- Check if operation requires acknowledgment phase -/
def requiresAcknowledgment : P1cOperation → Bool
  | reconnect _ _ | delete _ | quiescentDelete _
  | delegation _ _ | handoff _ _ => true
  | _ => false

/-- Initialize operation state machine -/
def initStateMachine (op : P1cOperation) : OperationStateMachine :=
  OperationStateMachine.init (toObservableLabel op)

end P1cOperation

/--
60 operations enumeration as a list for matrix construction.
-/
def allP1cOperations : List P1cOperation := [
  -- Communication (12)
  .send 1 10, .receive 1 10, .comm 1, .sendPrefix 1 10, .receivePrefix 1 10,
  .boundOutput 1 10, .boundInput 1 10, .commData 1, .commChannel 1,
  .asyncSend 1 10, .syncSend 1 10, .syncReceive 1 10,
  -- Channel Management (8)
  .newChannel 1, .reconnect 1 2, .delete 1, .quiescentDelete 1,
  .delegation 1 2, .handoff 1 2, .scopeOpen 1, .scopeClose 1,
  -- Parallelism (6)
  .parLeft, .parRight, .parComm, .fork, .join, .parZero,
  -- Choice (4)
  .choiceLeft, .choiceRight, .choiceComm, .choiceZero,
  -- Matching (6)
  .matchEqTrue 1 1, .matchEqFalse 1 2, .matchNeTrue 1 2, .matchNeFalse 1 1,
  .mismatch 1 2, .guardedMismatch 1 2,
  -- Structural (12)
  .parAssocLeft, .parAssocRight, .choiceAssocLeft, .choiceAssocRight,
  .scopeExtrusion 1, .scopeIntrusion 1, .parSymmetry, .choiceSymmetry,
  .scopeReordering 1 2, .scopeUnused 1, .tauPrefix, .zeroElim,
  -- Special (12)
  .quiescentComm 1, .quiescentSend 1 10, .quiescentReceive 1 10,
  .reconnectDelegation 1 2, .reconnectHandoff 1 2,
  .deleteWithCleanup 1, .deleteImmediate 1,
  .mismatchGuarded 1 2, .mismatchReport 1 2,
  .contextSwitch, .stateSnapshot, .eventLog
]

/-- Verify that we have exactly 60 operations -/
theorem allP1cOperations_count : allP1cOperations.length = 60 := by rfl

end Cantilune.Pi.P1cMultiState
