import Cantilune.Pi.P1cMultiState.Protocol
import Cantilune.Pi.P1cMultiState.Operations

/-!
# P1c 60×60 Operational Matrix

This file defines a total 60×60 table of reference operation pairs, proves
generic protocol completion for every table entry, and proves selected
channel-aware independence lemmas.

## Matrix Structure

The table `M[i,j]` records operations `op_i` and `op_j` together with the
decidable value of the stated independence predicate.  The proof that both
operations can complete the reference protocol is the separate theorem
`matrix_cell_protocol_completion`; a Boolean field is never treated as a
proof.

## Proof Strategy

We use template-driven proofs:
1. **Diagonal cells** (op with itself): Self-composition properties
2. **Special operations**: Explicit proofs for reconnect/delete/mismatch
3. **Standard operations**: Template instantiation

The matrix records a decision for every pair.  The kernel theorem below
certifies the protocol-completion property uniformly for all 3,600 pairs;
it does not claim that every pair is independent.
-/

namespace Cantilune.Pi.P1cMultiState

/--
Matrix cell result: composition of two operations.
-/
structure MatrixCell where
  op1 : P1cOperation
  op2 : P1cOperation
  /-- Can these operations execute in parallel? -/
  independent : Bool
  deriving DecidableEq, Repr

/--
The complete 60×60 operational matrix.
-/
def OperationalMatrix := Fin 60 → Fin 60 → MatrixCell

/-! ## Independence Relations -/

/--
Two operations are independent if they:
1. Operate on disjoint channels, or
2. Belong to different families that don't interfere
-/
def operationsIndependent (op1 op2 : P1cOperation) : Prop :=
  match op1, op2 with
  | .send ch1 _, .send ch2 _ => ch1 ≠ ch2
  | .receive ch1 _, .receive ch2 _ => ch1 ≠ ch2
  | .send ch1 _, .receive ch2 _ => ch1 ≠ ch2
  | .receive ch1 _, .send ch2 _ => ch1 ≠ ch2
  | .reconnect old1 new1, .reconnect old2 new2 => 
      old1 ≠ old2 ∧ new1 ≠ new2 ∧ old1 ≠ new2 ∧ old2 ≠ new1
  | .delete ch1, .delete ch2 => ch1 ≠ ch2
  | .delete ch, .send ch2 _ => ch ≠ ch2
  | .delete ch, .receive ch2 _ => ch ≠ ch2
  | .send ch2 _, .delete ch => ch ≠ ch2
  | .receive ch2 _, .delete ch => ch ≠ ch2
  | .quiescentDelete ch, .send ch2 _ => ch ≠ ch2
  | .quiescentDelete ch, .receive ch2 _ => ch ≠ ch2
  | .send ch2 _, .quiescentDelete ch => ch ≠ ch2
  | .receive ch2 _, .quiescentDelete ch => ch ≠ ch2
  | .mismatch a1 b1, .mismatch a2 b2 => a1 ≠ a2 ∨ b1 ≠ b2
  | _, _ => op1.family ≠ op2.family

/--
Matrix cell constructor. `independent` is a decidable reflection of the
actual channel-aware independence predicate. Protocol completion is carried
by a theorem, not by a status bit.
-/
noncomputable def mkCell
    (_i _j : Fin 60) (op1 op2 : P1cOperation) : MatrixCell :=
  { op1 := op1
  , op2 := op2
  , independent := by
      classical
      exact decide (operationsIndependent op1 op2)
  }

/--
Parallel independence: operations can execute in any order.
-/
def parallelIndependent (op1 op2 : P1cOperation) : Prop :=
  operationsIndependent op1 op2 ∧
  op1.family ≠ .structural ∧
  op2.family ≠ .structural

/-! ## Composition Properties -/

/--
Sequential composition: op1 followed by op2.
-/
def sequentialCompose (sm1 sm2 : OperationStateMachine) : Prop :=
  sm1.isTerminal ∧ sm2.state = .request

/--
Parallel composition: op1 and op2 execute concurrently.
-/
def parallelCompose (sm1 sm2 : OperationStateMachine) : Prop :=
  sm1.canProgress ∧ sm2.canProgress ∧
  operationsIndependent 
    (match sm1.label with
     | .comm ch => .comm ch
     | .input ch v => .receive ch v
     | .output ch v => .send ch v
     | .reconnect old new => .reconnect old new
     | .delete ch => .delete ch
     | .mismatch a b => .mismatch a b
     | .quiescentDelete ch => .quiescentDelete ch)
    (match sm2.label with
     | .comm ch => .comm ch
     | .input ch v => .receive ch v
     | .output ch v => .send ch v
     | .reconnect old new => .reconnect old new
     | .delete ch => .delete ch
     | .mismatch a b => .mismatch a b
     | .quiescentDelete ch => .quiescentDelete ch)

/-! ## Diagonal Cells (Self-Composition) -/

/--
Self-composition template: operation composed with itself.
For most operations, this requires they operate on different channels.
-/
theorem self_composition_independent (op : P1cOperation) :
  ∀ ch1 ch2 : Name, ch1 ≠ ch2 →
  match op with
  | .send _ _ => operationsIndependent (.send ch1 0) (.send ch2 0)
  | .receive _ _ => operationsIndependent (.receive ch1 0) (.receive ch2 0)
  | .delete _ => operationsIndependent (.delete ch1) (.delete ch2)
  | _ => True := by
  intro ch1 ch2 hne
  cases op <;> simp [operationsIndependent] <;> exact hne

/-! ## Standard Operation Templates -/

/--
Template for communication operations (send/receive).
-/
theorem comm_operations_template :
  ∀ ch1 ch2 v1 v2 : Name, ch1 ≠ ch2 →
  operationsIndependent (.send ch1 v1) (.receive ch2 v2) := by
  intro ch1 ch2 v1 v2 hne
  simp [operationsIndependent]
  exact hne

/--
Template for parallel operations with different families.
-/
theorem different_family_independent :
  ∀ op1 op2 : P1cOperation,
  operationsIndependent op1 op2 →
  op1.family ≠ op2.family →
  op1.family ≠ .structural →
  op2.family ≠ .structural →
  parallelIndependent op1 op2 := by
  intro op1 op2 hind _hfam hst1 hst2
  exact ⟨hind, hst1, hst2⟩

/-! ## Special Operations Proofs -/

/--
Reconnect operations are independent if they operate on disjoint channel pairs.
-/
theorem reconnect_independence :
  ∀ old1 new1 old2 new2 : Name,
  old1 ≠ old2 → new1 ≠ new2 → old1 ≠ new2 → old2 ≠ new1 →
  operationsIndependent (.reconnect old1 new1) (.reconnect old2 new2) := by
  intro old1 new1 old2 new2 h1 h2 h3 h4
  simp [operationsIndependent]
  exact ⟨h1, h2, h3, h4⟩

/--
Delete is independent of send/receive on different channels.
-/
theorem delete_comm_independence :
  ∀ ch1 ch2 v : Name, ch1 ≠ ch2 →
  operationsIndependent (.delete ch1) (.send ch2 v) ∧
  operationsIndependent (.delete ch1) (.receive ch2 v) := by
  intro ch1 ch2 v hne
  constructor <;> simp [operationsIndependent] <;> exact hne

/--
Mismatch operations are independent if operating on different name pairs.
-/
theorem mismatch_independence :
  ∀ a1 b1 a2 b2 : Name,
  (a1 ≠ a2 ∨ b1 ≠ b2) →
  operationsIndependent (.mismatch a1 b1) (.mismatch a2 b2) := by
  intro a1 b1 a2 b2 hdiff
  simpa [operationsIndependent] using hdiff

/--
Quiescent delete requires channel to be idle before deletion.
-/
theorem quiescent_delete_safety :
  ∀ ch : Name,
  operationsIndependent (.quiescentDelete ch) (.send ch 0) = False := by
  intro ch
  simp [operationsIndependent]

/-! ## Matrix Construction -/

/-- Total lookup justified by the checked 60-element enumeration. -/
def operationAt (index : Fin 60) : P1cOperation :=
  allP1cOperations.get
    ⟨index.val, by
      rw [allP1cOperations_count]
      exact index.isLt⟩

/--
Build the complete 60×60 matrix.
-/
noncomputable def buildMatrix : OperationalMatrix := fun i j =>
  mkCell i j (operationAt i) (operationAt j)

/--
Number of positions in the finite table.
-/
def matrixIndexCount : Nat := 60 * 60

/--
The table has exactly 3,600 positions. The proof attached uniformly to those
positions is `matrix_cell_protocol_completion` below.
-/
theorem matrix_completion_threshold :
  (List.product (List.finRange 60) (List.finRange 60)).length =
    matrixIndexCount := by
  native_decide

/--
Every matrix entry has the generic two-sided protocol-completion certificate.
This is the exact property shared by all 3,600 entries; interaction-specific
independence remains the Boolean decision stored in the cell.
-/
theorem matrix_cell_protocol_completion (i j : Fin 60) :
    (∃ final,
      ProtocolTransitionStar
          (operationAt i).initStateMachine final ∧
        final.state = .complete) ∧
    (∃ final,
      ProtocolTransitionStar
          (operationAt j).initStateMachine final ∧
        final.state = .complete) := by
  constructor
  · simpa [P1cOperation.initStateMachine, OperationStateMachine.init] using
      request_can_complete (operationAt i).toObservableLabel
  · simpa [P1cOperation.initStateMachine, OperationStateMachine.init] using
      request_can_complete (operationAt j).toObservableLabel

/-! ## Protocol completion -/

/--
Every reference operation reaches the complete protocol state.
This theorem is not a native late-pi reflection theorem.
-/
theorem p1c_protocol_completion :
  ∀ (op : P1cOperation),
  ∃ (sm_final : OperationStateMachine),
    ProtocolTransitionStar (op.initStateMachine) sm_final ∧
    sm_final.state = .complete := by
  intro op
  simpa [P1cOperation.initStateMachine, OperationStateMachine.init] using
    request_can_complete op.toObservableLabel

/--
Soundness: Protocol transitions preserve well-typedness.
-/
theorem protocol_soundness :
  ∀ sm1 sm2 : OperationStateMachine,
  ProtocolTransition sm1 sm2 →
  sm1.label = sm2.label := by
  intro sm1 sm2 htrans
  exact protocol_transition_preserves_label sm1 sm2 htrans

/--
Completeness: Every operation can reach a terminal state.
-/
theorem protocol_completeness :
  ∀ op : P1cOperation,
  ∃ sm_final, 
    ProtocolTransitionStar (op.initStateMachine) sm_final ∧
    sm_final.isTerminal := by
  intro op
  obtain ⟨sm_complete, htrans, hcomplete⟩ := p1c_protocol_completion op
  refine ⟨sm_complete, htrans, ?_⟩
  simp [OperationStateMachine.isTerminal, hcomplete]

end Cantilune.Pi.P1cMultiState
