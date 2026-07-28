# Success Predicates Interface — Package-Level Terminal Classification

| Field | Value |
|---|---|
| Status | **Draft** |
| Type | Normative specification (interface definition) |
| Risk | S2 |
| Owner | Joker-of-Gotham (DRI) |
| Reviewers | TBD (architecture reviewer) |
| Created | 2026-07-27 |
| Updated | 2026-07-27 |
| Related | `docs/spec/formal-semantics.md` §4.2, RFC-0002 clause (4), ADR-0001 |

---

## 1. Purpose and scope

This specification defines the **generic success predicate interface** that allows each execution package to distinguish "good stuck" (successful termination) from "bad stuck" (deadlock). It formalizes the separately supplied success predicate $\mathcal{T}_{\mathrm{ok}}$ referenced in `formal-semantics.md` §4.2 and ensures that the Four-Projection Consistency Theorem's clause (4) can be instantiated per package.

**What this spec provides:**

- A generic `SuccessPredicateInterface<Package>` that each package implements
- Per-package customization points for defining success terminal states
- Relationship to stuck states in the $(C,R)$ rewriting system
- Decidability requirements and proof obligations

**Non-goals:**

- Runtime policies (those belong in package definitions)
- Specific success criteria for individual packages (each package defines its own)
- Dynamic policy updates (success criteria are static per package version)

## 2. Core definition

### 2.1 Terminal state classification

Given a rewriting system $(C,R)$ with state congruence $\equiv_R$, every equivalence class $[g]_{\equiv_R}$ falls into exactly one of three categories:

| Classification | Definition | Formal Expression |
|---|---|---|
| **Non-terminal** | Can take at least one rewrite step | $\exists e, h.\ g \xrightarrow{e} h$ |
| **Successful termination** | Stuck and satisfies success predicate | $\text{Stuck}([g]) \land \mathcal{T}_{\mathrm{ok}}([g])$ |
| **Deadlock** | Stuck and fails success predicate | $\text{Stuck}([g]) \land \neg\mathcal{T}_{\mathrm{ok}}([g])$ |

where $\text{Stuck}([g]) := \nexists e, h.\ g \xrightarrow{e} h$ (no outgoing concrete event from the equivalence class).

### 2.2 The separately supplied success predicate

From `formal-semantics.md` §4.2:

> Let $\equiv_R$ be the selected state equality/congruence for rewriting and let $\mathcal{T}_{\mathrm{ok}}$ be a **separately supplied success predicate**, saturated under $\equiv_R$.

**Key properties required:**

1. **Saturation under congruence:** If $g \equiv_R g'$, then $\mathcal{T}_{\mathrm{ok}}([g]) \iff \mathcal{T}_{\mathrm{ok}}([g'])$
2. **Decidability:** For any representative $g$, checking $\mathcal{T}_{\mathrm{ok}}([g])$ terminates
3. **Stability:** The predicate does not change during execution (static per package version)

## 3. Generic interface definition

### 3.1 Type signature

```lean
structure SuccessPredicateInterface (Package : Type) where
  -- The package's state type (typically Config or a refinement)
  State : Type
  
  -- State congruence for the package's rewriting system
  stateCongruence : State → State → Prop
  stateCongruence_equiv : Equivalence stateCongruence
  
  -- The success predicate on equivalence classes
  isSuccessTerminal : State → Prop
  
  -- Proof obligations:
  congruence_saturated : 
    ∀ g g', stateCongruence g g' → 
    (isSuccessTerminal g ↔ isSuccessTerminal g')
  
  decidable_success : 
    ∀ g, Decidable (isSuccessTerminal g)
  
  -- The predicate is only meaningful for stuck states
  stuck_only : 
    ∀ g, isSuccessTerminal g → ¬∃ e h, g ⟶[e] h
```

### 3.2 Package instantiation template

Each package must provide:

```lean
def MyPackage.successPredicateInterface : 
  SuccessPredicateInterface MyPackage where
  State := MyPackage.Config
  stateCongruence := MyPackage.configEquiv
  stateCongruence_equiv := MyPackage.configEquiv_is_equivalence
  isSuccessTerminal := MyPackage.isSuccess
  congruence_saturated := MyPackage.success_respects_equiv
  decidable_success := MyPackage.success_decidable
  stuck_only := MyPackage.success_implies_stuck
```

## 4. Per-package customization: defining $T_{\mathrm{ok}}$

### 4.1 Success criteria design space

Each package defines what counts as "successful termination" based on its domain:

| Package Type | Example Success Criteria | Rationale |
|---|---|---|
| **Workflow orchestration** | All tasks completed, no pending edges | Work is done |
| **Agent conversation** | Explicit goal achieved or graceful exit | Intentional conclusion |
| **Resource management** | All resources released, no leaks | Clean shutdown |
| **Request/response** | Response delivered, connection closed | Protocol complete |
| **Event processing** | Event queue empty, handlers idle | Quiescent state |

### 4.2 Common patterns

**Pattern 1: Explicit success markers**

```lean
def isSuccess (g : Config) : Prop :=
  g.controlState = ControlState.SUCCESS ∧
  g.pendingWork.isEmpty
```

**Pattern 2: Structural completion**

```lean
def isSuccess (g : Config) : Prop :=
  (∀ node ∈ g.nodes, node.status = NodeStatus.COMPLETED) ∧
  (∀ edge ∈ g.edges, edge.satisfied)
```

**Pattern 3: Resource exhaustion (positive sense)**

```lean
def isSuccess (g : Config) : Prop :=
  g.activeAgents.isEmpty ∧
  g.pendingMessages.isEmpty ∧
  g.allocatedResources.isEmpty
```

**Pattern 4: Goal satisfaction**

```lean
def isSuccess (g : Config) : Prop :=
  ∃ goal ∈ g.declaredGoals, 
    goal.satisfied ∧ goal.priority = Priority.PRIMARY
```

### 4.3 Anti-patterns (what NOT to use)

❌ **Non-deterministic criteria:**

```lean
-- BAD: depends on current time
def isSuccess (g : Config) : Prop :=
  getCurrentTime() > g.deadline
```

❌ **Non-congruence-saturated:**

```lean
-- BAD: depends on specific representative, not equivalence class
def isSuccess (g : Config) : Prop :=
  g.internalNodeId = 42  -- sensitive to graph isomorphism
```

❌ **Non-terminating checks:**

```lean
-- BAD: may not terminate
def isSuccess (g : Config) : Prop :=
  ∃ n : ℕ, iterateN g n = someFixedState
```

## 5. Relationship to stuck states

### 5.1 Taxonomy of stuck states

```text
                     All States
                         |
          ┌──────────────┴──────────────┐
          |                             |
    Non-terminal                    Terminal
   (can step)                        (stuck)
                                        |
                         ┌──────────────┴──────────────┐
                         |                             |
              Successful Termination               Deadlock
              T_ok([g]) = true               T_ok([g]) = false
```

### 5.2 Examples by package type

**Request/Accept coordination:**

```lean
def RAPackage.isSuccess (g : Config) : Prop :=
  match g.protocolState with
  | ProtocolState.COMPLETE => true        -- handshake done
  | ProtocolState.ESTABLISHED => false    -- stuck waiting
  | ProtocolState.REQUESTING => false     -- stuck waiting
  | _ => false                            -- other deadlock
```

**Resource-bound workflow:**

```lean
def WorkflowPackage.isSuccess (g : Config) : Prop :=
  g.workQueue.isEmpty ∧
  (∀ r ∈ g.resources, r.released) ∧
  g.rank = 0  -- DAG projection has no more dependencies
```

**Agent task execution:**

```lean
def AgentPackage.isSuccess (g : Config) : Prop :=
  g.taskStatus = TaskStatus.DELIVERED ∧
  g.agentState = AgentState.IDLE ∧
  g.pendingFeedback.isEmpty
```

### 5.3 External wait vs deadlock

A critical distinction:

| State | Stuck? | Success? | Classification | Explanation |
|---|---|---|---|---|
| Waiting for human approval | Yes | No | **External wait** (deadlock) | Cannot proceed without external input |
| Waiting for network response | Yes | No | **External wait** (deadlock) | Cannot proceed without external event |
| Work complete, idle | Yes | Yes | **Success** | Intentionally quiescent |
| Work incomplete, no rules apply | Yes | No | **Genuine deadlock** | Cannot proceed, work unfinished |

**Design guidance:** If a stuck state requires external intervention to proceed, classify it as deadlock (not success), even if the wait is "expected." Success means the package has achieved its goal, not just reached a stable state.

## 6. Consistency with Four-Projection Theorem clause (4)

### 6.1 Clause (4) requirement

From RFC-0002 §3:

> **(4) Terminal-observation consistency:** $\mathcal{T}_{\mathrm{ok}}([g])$ iff $\mathcal{T}_{i,\mathrm{ok}}([P_i(g)])$. Together with clauses (2)–(3), this preserves normal form, successful termination, and deadlock in the selected observable quotient LTSs.

### 6.2 Per-projection success predicates

Each projection must define its own success predicate that agrees with the source:

| Projection | Success Predicate $\mathcal{T}_{i,\mathrm{ok}}$ | Typical Definition |
|---|---|---|
| **DAG** | $\mathcal{T}_{\mathrm{DAG},\mathrm{ok}}$ | No pending edges, sink nodes satisfied |
| **Petri** | $\mathcal{T}_{\mathrm{Petri},\mathrm{ok}}$ | Marking is in a designated success place |
| **π** | $\mathcal{T}_{\pi,\mathrm{ok}}$ | Process is structurally equivalent to success marker |
| **Morphism** | $\mathcal{T}_{\mathrm{Mor},\mathrm{ok}}$ | Identity with source (by construction) |

### 6.3 Consistency proof obligation

For each package implementing `SuccessPredicateInterface`, the projection certificates must prove:

```lean
theorem terminal_consistency 
  (pkg : SuccessPredicateInterface Package)
  (cert : ProjectionCertificate pkg) :
  ∀ g : pkg.State,
    pkg.isSuccessTerminal g ↔ 
    cert.target.isSuccessTerminal (cert.project g) := by
  -- Package must prove this for each projection
```

**Status per projection:**

- **Morphism:** by construction (identity view)
- **DAG:** reference fixture complete; production packages supply per-rule proofs
- **Petri:** reference fixture complete; production packages supply per-rule proofs  
- **π:** reference fixture complete for restricted relations; full reflection open

## 7. Decidability requirements

### 7.1 Computational content

The success predicate must be **executable**, not just a logical specification:

```lean
-- Good: computable
def isSuccess (g : Config) : Bool :=
  g.nodes.all (·.status == NodeStatus.COMPLETED)

instance : Decidable (isSuccess g) :=
  decidable_of_bool (isSuccess g) (by simp [isSuccess])

-- Bad: non-computable
noncomputable def isSuccess (g : Config) : Prop :=
  ∃ n : ℕ, Classical.choice ⟨iterateN g n, sorry⟩ = fixedPoint
```

### 7.2 Complexity bounds

While not formally required, success predicates should be **efficiently decidable**:

- **Recommended:** $O(|g|)$ where $|g|$ is the configuration size
- **Acceptable:** $O(|g|^2)$ for complex structural checks
- **Avoid:** Exponential or unbounded complexity

### 7.3 Proof strategy

To prove decidability, show that the success predicate decomposes into decidable primitives:

```lean
theorem success_decidable (g : Config) : 
  Decidable (isSuccessTerminal g) := by
  -- Decompose into decidable components
  have h1 : Decidable (g.workQueue.isEmpty) := inferInstance
  have h2 : Decidable (∀ r ∈ g.resources, r.released) := by
    apply Finset.decidableForallOfDecidableMemAndDecidablePred
  -- Combine via boolean operations
  exact And.decidable
```

## 8. Proof obligations summary

Each package implementing `SuccessPredicateInterface` must prove:

| Obligation | Formal Statement | Difficulty |
|---|---|---|
| **Congruence saturation** | $g \equiv_R g' \to (\mathcal{T}_{\mathrm{ok}}([g]) \iff \mathcal{T}_{\mathrm{ok}}([g']))$ | Low–Medium |
| **Decidability** | `Decidable (isSuccessTerminal g)` | Low |
| **Stuck-only** | $\mathcal{T}_{\mathrm{ok}}([g]) \to \neg\exists e,h.\ g \xrightarrow{e} h$ | Medium |
| **Projection consistency (×4)** | $\mathcal{T}_{\mathrm{ok}}([g]) \iff \mathcal{T}_{i,\mathrm{ok}}([P_i(g)])$ per projection | Medium–High |
| **Stability** | Success predicate does not change during execution | Low (by construction) |

## 9. Reference implementation: P1c admitted operations

From `docs/research/0006-theory-closure-iteration.md`:

> For every concrete admitted mismatch, reconnect, or quiescent-delete occurrence, one replayable business transition reaches a control state classified as exactly one of success, external wait, genuine deadlock, or an explicit productive infinite trace of observable external holds.

### 9.1 P1c terminal classification

```lean
inductive P1cTerminalClass
  | success         -- Clean completion
  | externalWait    -- Blocked on external input (classified as deadlock)
  | genuineDeadlock -- Cannot proceed, work incomplete
  | productive      -- Infinite external hold trace (not stuck)

def P1cPackage.classifyTerminal (g : Config) : P1cTerminalClass :=
  match g.controlState with
  | ControlState.COMPLETE => 
      if g.pendingWork.isEmpty then
        P1cTerminalClass.success
      else
        P1cTerminalClass.genuineDeadlock
  | ControlState.WAITING_EXTERNAL =>
      P1cTerminalClass.externalWait
  | ControlState.HOLD_EXTERNAL =>
      P1cTerminalClass.productive  -- not stuck
  | _ => P1cTerminalClass.genuineDeadlock

def P1cPackage.isSuccess (g : Config) : Prop :=
  P1cPackage.classifyTerminal g = P1cTerminalClass.success
```

### 9.2 Properties proven

From the research log:

- **Pairwise disjoint:** The four classes partition the terminal state space
- **Same endpoint:** All classifications refer to the same computed `Config`, replay record, and four-view derivation
- **External disposition:** Classification is decided after the graph rewrite, not during

## 10. Integration with execution packages

### 10.1 ExecutionPackage integration

```lean
structure ExecutionPackage (σ : Signature) where
  State : Type
  Event : Type
  
  -- ... native steps, replay, etc.
  
  -- Success predicate integration
  successPredicate : SuccessPredicateInterface Package
  
  -- Terminal states must respect the predicate
  terminal_classification :
    ∀ s : State, Stuck s →
      Xor (successPredicate.isSuccessTerminal s) 
          (¬successPredicate.isSuccessTerminal s)
```

### 10.2 Stochastic feedback integration

From `docs/research/0006-theory-closure-iteration.md`:

> Almost-sure stable hitting holds on this same event-path probability space.

The success predicate defines the **target set** for hitting-time analysis:

```lean
def hitSuccessTime (ω : SamplePath) : ℕ⊤ :=
  inf { n | pkg.isSuccessTerminal (ω n) }

theorem almost_sure_success_or_deadlock 
  (fairScheduler : ExecutionPackage pkg) :
  ℙ[∃ n, Stuck (ω n)] = 1 →
  ℙ[∃ n, pkg.isSuccessTerminal (ω n) ∨ 
         ¬pkg.isSuccessTerminal (ω n)] = 1 := by
  -- Every stuck state is classified
```

## 11. Relationship to operational semantics

### 11.1 Normal form vs success

**Normal form** (stuck state) is a property of the rewriting system $(C,R)$:

- Defined by: $\nexists e, h.\ g \xrightarrow{e} h$
- Source: The rewrite rules $R$
- Universal: Same definition across all packages

**Success** is a package-specific interpretation:

- Defined by: $\mathcal{T}_{\mathrm{ok}}([g])$ where $g$ is stuck
- Source: Package domain knowledge
- Package-specific: Each package defines its own

### 11.2 Observability and trace semantics

Success predicates enable **trace property verification**:

```lean
-- Safety: "nothing bad happens"
def safetyProperty (trace : List Event) : Prop :=
  ∀ i, let g := executeTrace trace.take i in
    Stuck g → pkg.isSuccessTerminal g

-- Liveness: "something good eventually happens"  
def livenessProperty (trace : List Event) : Prop :=
  ∃ i, let g := executeTrace trace.take i in
    pkg.isSuccessTerminal g
```

## 12. Design guidelines for package authors

### 12.1 Checklist for defining success predicates

- [ ] Success is **intentional termination**, not accidental quiescence
- [ ] Success implies **goal achievement**, not just stability
- [ ] External waits are classified as **deadlock**, not success
- [ ] The predicate is **congruence-saturated** (representative-independent)
- [ ] The predicate is **decidable** with reasonable complexity
- [ ] The predicate is **testable** (can be checked in unit tests)
- [ ] Success states are **stuck** (no further rewrites possible)

### 12.2 Testing strategy

```lean
-- Unit test template
example : pkg.isSuccessTerminal successState := by
  unfold pkg.isSuccessTerminal
  -- Prove success criteria satisfied
  constructor <;> simp [successState]

example : ¬pkg.isSuccessTerminal deadlockState := by
  unfold pkg.isSuccessTerminal
  -- Prove success criteria not satisfied
  intro h; cases h <;> contradiction

example : Stuck successState := by
  intro ⟨e, h, step⟩
  -- Prove no step possible from success state
  cases step <;> contradiction
```

## 13. Open questions and future work

1. **Dynamic success criteria:** How to handle packages where success criteria evolve with package version? (Likely: version predicate per signature epoch)
2. **Compositional success:** How do success predicates compose when combining packages? (Likely: conjunction or package-specific composition rules)
3. **Partial success:** Can a package be "partially successful"? (Current answer: no, success is boolean; use multiple packages or goal tracking)
4. **Success witnesses:** Should success predicates carry evidence (e.g., which goal was satisfied)? (Current answer: no, success is unary; witnesses belong in observability layer)

## 14. References

- `docs/spec/formal-semantics.md` §4.2 (Derived properties, normal form, termination, deadlock)
- RFC-0002 §3 (Four-Projection Consistency Theorem, clause 4)
- `docs/research/0006-theory-closure-iteration.md` (P1c terminal classification)
- ADR-0001 (Unified formal structure, success predicates as separate concern)

## 15. Revision history

| Date | Change | Author |
|---|---|---|
| 2026-07-27 | Initial draft | Joker-of-Gotham |

---

**Governance note:** This spec defines the interface; individual packages supply the instances. Success predicate definitions are **package conformance work** (post-FCP), not Core Theory FCP gates. The generic interface and reference witnesses (P1c) demonstrate satisfiability.
