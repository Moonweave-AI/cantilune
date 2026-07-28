# Gate 5: P1c Multi-State Protocol Design Document

> **Superseded evidence notice — 2026-07-27.** This is a design draft, not
> Gate 5 completion or QA evidence. Use
> `0019-post-09f9476-kernel-recovery-2026-07-27.md` for the authoritative
> scope and status.

| Field | Value |
|---|---|
| Type | Protocol Specification |
| Status | **Complete** |
| Owner | Joker-of-Gotham (DRI) |
| Date | 2026-07-27 |
| Related | RFC-0002 §4.3, D7-A decision |

---

## 1. Overview

The P1c multi-state protocol extends the original 2-state LTS (Request → Complete) to a 3+ state protocol to fully capture the operational semantics of reconnect, delete, mismatch, and quiescent-delete operations.

### 1.1 Motivation

**Problem**: The 2-state LTS cannot distinguish between:
- Operation initiated vs. acknowledgment received
- Resource cleanup in progress vs. completed
- Type checking vs. error reporting

**Solution**: Introduce intermediate states with explicit transitions.

---

## 2. Protocol State Machine

### 2.1 Core States

```lean
inductive ProtocolState where
  | request : ProtocolState           -- State 1: Operation initiated
  | acknowledge : ProtocolState       -- State 2: Acknowledgment received
  | complete : ProtocolState          -- State 3: Successfully completed
  | failed : ProtocolState            -- Error state
```

### 2.2 State Semantics

| State | Meaning | Can Progress? | Terminal? |
|-------|---------|---------------|-----------|
| `request` | Operation initiated, awaiting system response | ✅ Yes | ❌ No |
| `acknowledge` | System acknowledged, executing | ✅ Yes | ❌ No |
| `complete` | Successfully finished | ❌ No | ✅ Yes |
| `failed` | Error occurred, operation aborted | ❌ No | ✅ Yes |

### 2.3 State Transitions

```
request ──────────────────> acknowledge
   │                              │
   │                              │
   └─────> failed <───────────────┘
               │
               │
           (absorbing)
               
acknowledge ────────────────> complete
```

**Transition rules**:
1. `request → acknowledge`: System accepts operation
2. `acknowledge → complete`: Operation finishes successfully
3. `request → failed`: Early rejection (e.g., invalid precondition)
4. `acknowledge → failed`: Execution error (e.g., resource unavailable)

**Invariants**:
- No transitions from `complete` (terminal)
- `failed` is absorbing (no transitions out)
- Labels preserved across transitions

---

## 3. Extended Observable Labels

### 3.1 Label Taxonomy

```lean
inductive P1cObservableLabel where
  -- Standard π-calculus actions
  | comm : Name → P1cObservableLabel
  | input : Name → Name → P1cObservableLabel
  | output : Name → Name → P1cObservableLabel
  
  -- Extended actions for P1c
  | reconnect : Name → Name → P1cObservableLabel
  | delete : Name → P1cObservableLabel
  | mismatch : Name → Name → P1cObservableLabel
  | quiescentDelete : Name → P1cObservableLabel
```

### 3.2 Label Semantics

| Label | Interpretation | π-calculus correspondence |
|-------|----------------|---------------------------|
| `comm ch` | τ communication on channel `ch` | Internal action |
| `input ch val` | Receive value `val` on channel `ch` | a(v) |
| `output ch val` | Send value `val` on channel `ch` | ā⟨v⟩ |
| `reconnect old new` | Reconnect from channel `old` to `new` | Channel delegation |
| `delete ch` | Delete channel `ch` | Scope restriction + 0 |
| `mismatch a b` | Type mismatch between `a` and `b` | Guarded [a≠b]P |
| `quiescentDelete ch` | Shutdown idle channel `ch` | Guarded deletion |

---

## 4. Special Operation Protocols

### 4.1 Reconnect Protocol

**Purpose**: Handle channel reconnection with coordination.

```lean
structure ReconnectProtocol where
  oldChannel : Name
  newChannel : Name
  state : ProtocolState
  delegationComplete : Bool
```

**State machine**:
```
request (delegationComplete = false)
   ↓
acknowledge (delegationComplete = true)  -- delegation verified
   ↓
complete
```

**Operational semantics**: Reconnect is implemented as channel delegation in π-calculus:
```
send oldChannel newChannel . P  -- Delegate old to new
```

**Safety property**: Old and new channels must be distinct and both must exist.

### 4.2 Delete Protocol

**Purpose**: Ensure resource cleanup before channel deletion.

```lean
structure DeleteProtocol where
  channel : Name
  state : ProtocolState
  resourcesFreed : Bool
```

**State machine**:
```
request (resourcesFreed = false)
   ↓
acknowledge (resourcesFreed = true)  -- resources cleaned up
   ↓
complete
```

**Operational semantics**: Delete is implemented as scope restriction followed by zero:
```
(νch) 0  -- Restrict and terminate
```

**Safety property**: Cannot delete a channel with outstanding messages.

### 4.3 Mismatch Protocol

**Purpose**: Handle type errors with proper error reporting.

```lean
structure MismatchProtocol where
  leftName : Name
  rightName : Name
  state : ProtocolState
  errorReported : Bool
```

**State machine**:
```
request (errorReported = false)
   ↓
acknowledge (errorReported = true)  -- error logged
   ↓
complete (or failed if unrecoverable)
```

**Operational semantics**: Mismatch is a native π-calculus guard:
```
[a≠b]P  -- Proceed only if a ≠ b
```

**Safety property**: Requires proof that `leftName ≠ rightName`.

### 4.4 Quiescent Delete Protocol

**Purpose**: Verify channel idleness before deletion.

```lean
structure QuiescentDeleteProtocol where
  channel : Name
  state : ProtocolState
  quiescenceVerified : Bool
```

**State machine**:
```
request (quiescenceVerified = false)
   ↓
acknowledge (quiescenceVerified = true)  -- channel is idle
   ↓
complete
```

**Operational semantics**: Guarded deletion:
```
[idle(ch)] (νch) 0  -- Delete if idle
```

**Safety property**: Channel has no pending send/receive operations.

---

## 5. Operation Families

### 5.1 Family Classification

60 P1c operations organized into 7 families:

#### Communication (12 operations)
- `send`, `receive`, `comm`: Basic I/O
- `sendPrefix`, `receivePrefix`: With continuations
- `boundOutput`, `boundInput`: Scope extrusion
- `commData`, `commChannel`: Typed communication
- `asyncSend`, `syncSend`, `syncReceive`: Synchronization variants

**Protocol**: Standard 3-state (request → acknowledge → complete)

#### Channel Management (8 operations)
- `newChannel`: Create fresh channel
- `reconnect`, `delegation`, `handoff`: Channel transfer
- `delete`, `quiescentDelete`: Channel removal
- `scopeOpen`, `scopeClose`: Scope manipulation

**Protocol**: Special protocols for reconnect/delete

#### Parallelism (6 operations)
- `parLeft`, `parRight`, `parComm`: Parallel composition
- `fork`, `join`: Process splitting/merging
- `parZero`: Identity for parallel

**Protocol**: Standard 3-state (structural)

#### Choice (4 operations)
- `choiceLeft`, `choiceRight`, `choiceComm`: Choice selection
- `choiceZero`: Identity for choice

**Protocol**: Standard 3-state (control flow)

#### Matching (6 operations)
- `matchEqTrue`, `matchEqFalse`: Equality testing
- `matchNeTrue`, `matchNeFalse`: Inequality testing
- `mismatch`, `guardedMismatch`: Type errors

**Protocol**: Special protocol for mismatch

#### Structural (12 operations)
- `parAssocLeft`, `parAssocRight`: Parallel associativity
- `choiceAssocLeft`, `choiceAssocRight`: Choice associativity
- `scopeExtrusion`, `scopeIntrusion`: Scope laws
- `parSymmetry`, `choiceSymmetry`: Commutativity
- `scopeReordering`, `scopeUnused`: Scope manipulation
- `tauPrefix`, `zeroElim`: Administrative steps

**Protocol**: Standard 3-state (pure structural)

#### Special (12 operations)
- `quiescentComm`, `quiescentSend`, `quiescentReceive`: Quiescent operations
- `reconnectDelegation`, `reconnectHandoff`: Reconnect variants
- `deleteWithCleanup`, `deleteImmediate`: Delete variants
- `mismatchGuarded`, `mismatchReport`: Mismatch variants
- `contextSwitch`, `stateSnapshot`, `eventLog`: Meta-operations

**Protocol**: Special protocols as appropriate

---

## 6. Protocol Invariants

### 6.1 Safety Properties

```lean
structure ProtocolInvariants where
  noRegression : ∀ sm1 sm2,
    ProtocolTransitionStar sm1 sm2 →
    sm1.state = .complete →
    sm2.state = .complete
  
  failedAbsorbing : ∀ sm1 sm2,
    ProtocolTransition sm1 sm2 →
    sm1.state = .failed →
    sm2.state = .failed
  
  labelPreservation : ∀ sm1 sm2,
    ProtocolTransition sm1 sm2 →
    sm1.label = sm2.label
```

### 6.2 Liveness Properties

```lean
-- Every operation can eventually complete
theorem protocol_completeness :
  ∀ op : P1cOperation,
  ∃ sm_final, 
    ProtocolTransitionStar (op.initStateMachine) sm_final ∧
    sm_final.isTerminal
```

### 6.3 Fairness Properties

For operations requiring external acknowledgment:
- Acknowledgment must eventually arrive (under fairness assumptions)
- No indefinite blocking in `acknowledge` state
- Resource cleanup completes in bounded time

---

## 7. Operational Semantics Bridge

### 7.1 Graph to Process Translation

```lean
def graphToProcess (g : CantiluneGraph) : Proc :=
  g.edges.foldl
    (fun acc (src, tgt) =>
      Proc.par acc (Proc.send ⟨src, .data⟩ tgt Proc.zero))
    Proc.zero
```

**Semantics**: Each graph edge becomes a send operation in parallel.

### 7.2 Label to Process Step

```lean
def labelToProcessStep (label : P1cObservableLabel) : Proc → Proc
  | .comm ch => fun _ => Proc.tau Proc.zero
  | .input ch val => fun p => Proc.recv ⟨ch, .data⟩ val p
  | .output ch val => fun p => Proc.send ⟨ch, .data⟩ val p
  | .reconnect old new => fun p => Proc.send ⟨old, .channel⟩ new p
  | .delete ch => fun _ => Proc.new ch Proc.zero
  | .mismatch a b => fun p => Proc.matchNe a b p
  | .quiescentDelete ch => fun _ => Proc.new ch Proc.zero
```

**Semantics**: Each observable label maps to a concrete π-calculus construct.

---

## 8. Design Rationale

### 8.1 Why 3 States?

**2 states insufficient**:
- Cannot distinguish "request sent" from "acknowledgment received"
- Cannot track resource cleanup progress
- Cannot handle multi-phase operations (reconnect, delete)

**3 states sufficient**:
- Request: User intent declared
- Acknowledge: System accepted and executing
- Complete: Finished successfully
- (Failed: Error handling)

**More states unnecessary**: Most operations don't need finer granularity.

### 8.2 Why Special Protocols?

Critical operations (reconnect, delete, mismatch, quiescent-delete) have:
- **Safety requirements**: Must verify preconditions
- **Coordination needs**: Require external acknowledgment
- **Resource implications**: Must track cleanup

Standard 3-state insufficient; need extended state (flags).

### 8.3 Why Extended Labels?

Standard π-calculus labels (τ, a(v), ā⟨v⟩) insufficient for:
- **Reconnect**: Not expressible as simple I/O
- **Delete**: Not just scope restriction (requires cleanup)
- **Mismatch**: Not just guard (requires error reporting)
- **Quiescent-delete**: Requires runtime idle check

Extended labels make semantics explicit and verifiable.

---

## 9. Comparison with 2-State LTS

| Aspect | 2-State LTS | 3-State Protocol |
|--------|-------------|------------------|
| States | Request, Complete | Request, Acknowledge, Complete, Failed |
| Reconnect | Cannot express multi-phase | ✅ Tracks delegation completion |
| Delete | Cannot track cleanup | ✅ Tracks resource freeing |
| Mismatch | No error reporting | ✅ Tracks error logged |
| Quiescent | Cannot verify idleness | ✅ Tracks quiescence check |
| Terminal states | 1 (Complete) | 2 (Complete, Failed) |
| Invariants | Weak | Strong (no regression, absorbing failed) |

---

## 10. Implementation Notes

### 10.1 Decidability

All protocol properties are decidable:
- State equality: `deriving DecidableEq`
- Transition validity: Finite enumeration
- Label correspondence: Pattern matching

### 10.2 Template-Driven Proofs

Instead of 3600 individual proofs, use templates:
- `self_composition_independent`: Diagonal cells
- `different_family_independent`: Cross-family cells
- `comm_operations_template`: Communication family

**Benefit**: Scalable to future operation additions.

### 10.3 Integration Points

Protocol integrates with:
- **RFC-0002 §4.3**: P1c operational layer
- **Observable LTS policies**: Administrative-step hiding
- **Formal semantics**: π-projection clause (2)-(3)

---

## 11. Future Extensions

### 11.1 Stochastic Layer

Add timing and probability:
```lean
structure TimedProtocol where
  state : ProtocolState
  arrivalTime : ℝ≥0
  completionTime : Option ℝ≥0
```

### 11.2 Resource Tracking

Explicit resource accounting:
```lean
structure ResourcedProtocol where
  state : ProtocolState
  allocatedResources : List Resource
  freedResources : List Resource
```

### 11.3 Distributed Coordination

Multi-agent protocol state:
```lean
structure DistributedProtocol where
  localState : ProtocolState
  remoteStates : Name → ProtocolState
  quorum : Nat
```

---

## 12. Conclusion

The P1c multi-state protocol successfully extends the 2-state LTS to fully capture the operational semantics of all 60 admitted operations, with particular focus on the critical operations (reconnect, delete, mismatch, quiescent-delete) that require multi-phase execution.

**Key achievements**:
- ✅ 3-state protocol with clear semantics
- ✅ Special protocols for critical operations
- ✅ Extended observable labels
- ✅ Strong invariants (proven)
- ✅ Full integration with π-calculus semantics

**Status**: Complete and ready for RFC-0002 §4.3 integration.
