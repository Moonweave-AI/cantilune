# Observable LTS Granularity Policies — Per-Projection Specifications

| Field | Value |
|---|---|
| Status | **Draft** (P1 FCP gate per D9) |
| Type | Normative specification (observable semantics) |
| Risk | S2 |
| Owner | Joker-of-Gotham (DRI) |
| Reviewers | TBD (process semantics reviewer required) |
| Created | 2026-07-27 |
| Updated | 2026-07-27 |
| Related | RFC-0002 (D9, §3 clauses 2-3), ADR-0001, `docs/spec/formal-semantics.md` |

> **Governance note:** This specification fulfills D9 decision requirements for RFC-0002 FCP entry. Each projection must define its observable quotient LTS independently to ensure non-circularity and enable consistency proof statements. This is a **mandatory P1 gate**, not optional.

---

## 1. Purpose and scope

RFC-0002 Four-Projection Consistency requires that each projection's **observable derivations** are independently defined before the consistency theorem can be meaningfully stated. This document specifies:

1. For each projection (DAG, Petri, π, Morphism): what constitutes "one observable step"
2. State congruence relations $\equiv_i$ that quotient fine-grained states
3. Administrative-step hiding policies that define granularity
4. Explicit lift relations $\operatorname{Lift}_i$ from $(C,R)$ derivations to observable LTS

**Non-circularity requirement**: Each projection's observable semantics must be grounded in its own theory (DAG execution semantics, Petri net firing, π-calculus reduction, morphism rewriting), NOT derived from the consistency theorem itself.

## 2. General framework

### 2.1 Observable LTS structure

For each projection $i \in \{\mathrm{DAG}, \mathrm{Petri}, \pi, \mathrm{Mor}\}$, we define:

$$\mathrm{ObsLTS}_i = (\mathcal{S}_i / {\equiv_i}, \mathcal{L}_i^{\mathrm{obs}}, \xrightarrow{}_i^{\mathrm{obs}})$$

where:
- $\mathcal{S}_i / {\equiv_i}$ — observable states (quotient of fine-grained states by congruence)
- $\mathcal{L}_i^{\mathrm{obs}}$ — observable labels (business events, excluding administrative steps)
- $\xrightarrow{}_i^{\mathrm{obs}}$ — observable transition relation

### 2.2 Lift relation

Each projection supplies an explicit **lift relation**:

$$\operatorname{Lift}_i : \mathrm{Derivation}_{(C,R)} \rightharpoonup \mathrm{ObsLTS}_i$$

that maps $(C,R)$ rewriting derivations to observable transitions, satisfying:

1. **Administrative transparency**: Internal structural steps (reassociation, symmetry, unit laws) are hidden
2. **Congruence preservation**: $g_1 \equiv_i g_2 \Rightarrow \operatorname{Lift}_i(d_1) = \operatorname{Lift}_i(d_2)$ for congruent states
3. **Compositionality**: Observable trace of $d_1 ; d_2$ equals concatenation of lifted traces (modulo silent steps)

### 2.3 Design principles

**P1. Target-semantics grounding**: Each projection's observable LTS is defined in terms of the target formalism (DAG nodes, Petri transitions, π communications, morphism rewrites), not in terms of $(C,R)$ or other projections.

**P2. Granularity independence**: Different projections may observe the same $(C,R)$ derivation at different granularities (e.g., Petri sees token flows; π sees communication actions).

**P3. Non-vacuity**: At least one $(C,R)$ derivation must lift to non-empty observable traces (proven via P1c reference witnesses).

---

## 3. DAG Projection: Node Execution Observable LTS

### 3.1 Observable states

$$[g]_{\mathrm{DAG}} := g / {\equiv_{\mathrm{DAG}}}$$

**State congruence** $\equiv_{\mathrm{DAG}}$:
- Graphs are congruent if they have the same control-flow dependencies and node completion status
- Administrative differences (wire labels, monoidal structure witnesses) are hidden

**Formal definition**:
$$g_1 \equiv_{\mathrm{DAG}} g_2 \iff \exists \text{ SMC isomorphism } \phi : g_1 \xrightarrow{\sim} g_2 \text{ preserving node IDs and execution state}$$

### 3.2 Observable labels

$$\mathcal{L}_{\mathrm{DAG}}^{\mathrm{obs}} = \{ \mathrm{exec}(n, \rho) \mid n \in \mathrm{Nodes}, \rho \in R_{\mathrm{productive}} \}$$

**Observable events**: Node execution (applying productive rewrite rule $\rho$ at node $n$)

**Hidden administrative steps**:
- Structural rules: $\sigma$ (symmetry), $\alpha$ (associator), $\lambda, \rho$ (unitors)
- Wire routing changes that don't affect control flow
- Monoidal identity insertions/removals

### 3.3 Observable transitions

$$[g_1]_{\mathrm{DAG}} \xrightarrow{\mathrm{exec}(n,\rho)}_{\mathrm{DAG}}^{\mathrm{obs}} [g_2]_{\mathrm{DAG}}$$

**Semantics**: Executing node $n$ with rule $\rho$ transforms the DAG from state $g_1$ to $g_2$, where:
- Node $n$ is ready (all predecessors completed)
- Rule $\rho$ is a productive computation (not structural)
- Resulting state $g_2$ reflects updated control dependencies

### 3.4 Lift from $(C,R)$

$$\operatorname{Lift}_{\mathrm{DAG}}(g_1 \xrightarrow{\rho} g_2) = \begin{cases}
\mathrm{exec}(n, \rho) & \text{if } \rho \in R_{\mathrm{productive}} \\
\epsilon \text{ (silent)} & \text{if } \rho \in R_{\mathrm{structural}}
\end{cases}$$

**Granularity policy**: One observable step = one node execution (productive rule application)

### 3.5 Example

**Scenario**: Three-node pipeline `planner → executor → reporter`

**$(C,R)$ derivations**:
1. Initial: All nodes pending
2. Apply $\rho_{\mathrm{plan}}$ at `planner` → produces `TaskPlan`
3. Wire routing (administrative)
4. Apply $\rho_{\mathrm{exec}}$ at `executor` → produces `Result`
5. Apply symmetry (administrative)
6. Apply $\rho_{\mathrm{report}}$ at `reporter` → produces `Report`

**Observable DAG trace**:
$$\mathrm{exec}(\texttt{planner}, \rho_{\mathrm{plan}}) \cdot \mathrm{exec}(\texttt{executor}, \rho_{\mathrm{exec}}) \cdot \mathrm{exec}(\texttt{reporter}, \rho_{\mathrm{report}})$$

Administrative steps 3 and 5 are hidden.

---

## 4. Petri Projection: Token Flow Observable LTS

### 4.1 Observable states

$$[M]_{\mathrm{Petri}} := M / {\equiv_{\mathrm{Petri}}}$$

**State congruence** $\equiv_{\mathrm{Petri}}$:
- Markings are congruent if they have the same token distribution across places
- Individual token identities matter (per D8): tokens carry provenance metadata
- Administrative differences (internal structural transformations) are hidden

**Formal definition**:
$$M_1 \equiv_{\mathrm{Petri}} M_2 \iff \forall p \in \mathrm{Places}.\ \mathrm{tokens}(M_1, p) = \mathrm{tokens}(M_2, p)$$

where token equality includes provenance metadata.

### 4.2 Observable labels

$$\mathcal{L}_{\mathrm{Petri}}^{\mathrm{obs}} = \{ \mathrm{fire}(t, \theta) \mid t \in \mathrm{Transitions}, \theta : \mathrm{Vars} \to \mathrm{Tokens} \}$$

**Observable events**: Transition firing with token binding $\theta$

**Hidden administrative steps**:
- Internal Petri net fold/unfold operations
- Monoidal tensor product reordering (symmetry on token multisets)
- Administrative place insertions (e.g., for structural encoding)

### 4.3 Observable transitions

$$[M_1]_{\mathrm{Petri}} \xrightarrow{\mathrm{fire}(t, \theta)}_{\mathrm{Petri}}^{\mathrm{obs}} [M_2]_{\mathrm{Petri}}$$

**Semantics**: Firing transition $t$ with binding $\theta$ consumes tokens from input places and produces tokens in output places:
- $t$ is enabled under $M_1$ (all input places contain required tokens)
- $M_2 = (M_1 \setminus \mathrm{pre}(t, \theta)) \cup \mathrm{post}(t, \theta)$
- Token provenance is preserved/extended per firing

### 4.4 Lift from $(C,R)$

$$\operatorname{Lift}_{\mathrm{Petri}}(g_1 \xrightarrow{\rho} g_2) = \begin{cases}
\mathrm{fire}(t_\rho, \theta_\rho) & \text{if } \rho \text{ corresponds to productive transition } t_\rho \\
\epsilon \text{ (silent)} & \text{if } \rho \text{ is structural or internal}
\end{cases}$$

**Granularity policy**: One observable step = one transition firing (token consumption/production)

### 4.5 Example

**Scenario**: Request processing with fork/join

**$(C,R)$ derivations**:
1. Initial marking: 1 token at `request` place
2. Fire `accept` transition → consumes request token, produces `task` token
3. Fire `fork` transition → produces 2 tokens at `subtask_A`, `subtask_B`
4. Internal symmetry (administrative)
5. Fire `process_A` and `process_B` (parallel)
6. Fire `join` transition → consumes both result tokens, produces `response` token

**Observable Petri trace**:
$$\mathrm{fire}(\texttt{accept}) \cdot \mathrm{fire}(\texttt{fork}) \cdot \mathrm{fire}(\texttt{process\_A}) \parallel \mathrm{fire}(\texttt{process\_B}) \cdot \mathrm{fire}(\texttt{join})$$

Administrative step 4 is hidden; parallel firings at step 5 may be interleaved.

---

## 5. π-Projection: Communication Observable LTS

### 5.1 Observable states

$$[\mathcal{P}]_\pi := \mathcal{P} / {\equiv_\pi}$$

**State congruence** $\equiv_\pi$:
- Processes are congruent under structural congruence (standard π-calculus $\equiv$)
- Includes: parallel commutativity $P \parallel Q \equiv Q \parallel P$, scope extrusion, nil identity
- Does NOT include: reduction (that produces observable steps)

**Formal definition**:
$$\mathcal{P}_1 \equiv_\pi \mathcal{P}_2 \iff \mathcal{P}_1 \equiv \mathcal{P}_2 \text{ (standard structural congruence)}$$

### 5.2 Observable labels

$$\mathcal{L}_\pi^{\mathrm{obs}} = \{ \tau \} \cup \{ a(x), \overline{a}\langle v \rangle, \overline{a}(b) \mid a, b \in \mathrm{Names}, x \in \mathrm{Vars}, v \in \mathrm{Values} \}$$

**Observable events**:
- $\tau$ — internal communication (synchronized send/receive)
- $a(x)$ — input on channel $a$
- $\overline{a}\langle v \rangle$ — output of value $v$ on channel $a$
- $\overline{a}(b)$ — bound output (name extrusion)

**Hidden administrative steps**:
- Structural rearrangements ($\equiv$ steps)
- Metadata updates (runtime version tracking per D4)
- Fresh name allocation (internal to π machinery)

### 5.3 Observable transitions

$$[\mathcal{P}_1]_\pi \xrightarrow{\alpha}_\pi^{\mathrm{obs}} [\mathcal{P}_2]_\pi$$

**Semantics**: Standard π-calculus reduction semantics
- Communication: $\overline{a}\langle v \rangle.P \parallel a(x).Q \xrightarrow{\tau} P \parallel Q\{v/x\}$
- Input: $a(x).P \xrightarrow{a(v)} P\{v/x\}$
- Output: $\overline{a}\langle v \rangle.P \xrightarrow{\overline{a}\langle v \rangle} P$
- Scope: $(νb)(\overline{a}\langle b \rangle.P) \xrightarrow{\overline{a}(b)} P$

### 5.4 Lift from $(C,R)$

$$\operatorname{Lift}_\pi(g_1 \xrightarrow{\rho} g_2) = \alpha \text{ where } \pi(g_1) \xrightarrow{\alpha} \pi(g_2)$$

**Granularity policy**: One observable step = one π-reduction (communication action or $\tau$)

**Metadata handling** (per D6-B): Runtime metadata layer is separate; π states are pure process terms. The lift relation projects out metadata before applying standard π semantics.

### 5.5 Multi-state protocol (D7-A)

For **P1c multi-state reflection** of reconnect/delete operations:

**Extended observable labels**:
$$\mathcal{L}_\pi^{\mathrm{P1c}} = \mathcal{L}_\pi^{\mathrm{obs}} \cup \{ \mathrm{reconnect}(a, b), \mathrm{delete}(a), \mathrm{mismatch}(a, b) \}$$

**Multi-state protocol**:
- State 1: Request initiated
- State 2: External acknowledgment awaited
- State 3: Completed (or failed)

Each P1c admitted operation has a **3+ state protocol** ensuring full reflection of non-standard operations. This is proven in the **60×60 P1c operational matrix** (see RFC-0002 §4.3 and P1c specification).

### 5.6 Example

**Scenario**: Agent communication with reconnection

**$(C,R)$ derivations**:
1. Initial: `agent_A` prepares message, `agent_B` listens on channel `ch`
2. Apply send rule → morphism-level communication
3. Metadata update (administrative, per D4)
4. Apply receive rule → message delivered
5. Connection failure detected → reconnect initiated
6. Fresh channel allocated (administrative)
7. Reconnection successful → new channel established

**Observable π trace**:
$$\overline{\texttt{ch}}\langle \texttt{msg} \rangle \cdot \tau \cdot \mathrm{reconnect}(\texttt{ch}, \texttt{ch'})$$

Administrative steps 3 and 6 are hidden; metadata updates don't appear in pure π semantics.

---

## 6. Morphism Projection: Rewrite Observable LTS

### 6.1 Observable states

$$[g]_{\mathrm{Mor}} := g / {\equiv_{\mathrm{Mor}}}$$

**State congruence** $\equiv_{\mathrm{Mor}}$:
- Morphisms are congruent if they are equal as morphisms in the SMC $C$
- Includes all coherence isomorphisms (associator, unitor, symmetry)
- Different presentations of the same morphism are congruent

**Formal definition**:
$$g_1 \equiv_{\mathrm{Mor}} g_2 \iff [g_1] = [g_2] \text{ in } \mathrm{Hom}_C(A, B)$$

### 6.2 Observable labels

$$\mathcal{L}_{\mathrm{Mor}}^{\mathrm{obs}} = \{ \rho \mid \rho \in R \}$$

**Observable events**: Rewrite rule applications (all rules are observable at morphism level)

**Hidden administrative steps**: NONE at this level — morphism projection sees all $(C,R)$ rewriting directly

**Rationale**: The morphism projection is the "finest-grained" view; it observes every rule application. Other projections quotient this view.

### 6.3 Observable transitions

$$[g_1]_{\mathrm{Mor}} \xrightarrow{\rho}_{\mathrm{Mor}}^{\mathrm{obs}} [g_2]_{\mathrm{Mor}}$$

**Semantics**: Direct correspondence to $(C,R)$ rewriting
- Rule $\rho \in R$ matches in state $g_1$
- Rewrite produces state $g_2$
- Morphism-level coherence is automatic (SMC quotient)

### 6.4 Lift from $(C,R)$

$$\operatorname{Lift}_{\mathrm{Mor}}(g_1 \xrightarrow{\rho} g_2) = \rho$$

**Granularity policy**: One observable step = one $(C,R)$ rewrite step (no hiding)

### 6.5 Example

**Scenario**: Multi-agent parallel execution with rule applications

**$(C,R)$ derivations**:
1. Initial morphism: $f_1 \otimes f_2 \otimes f_3$
2. Apply rule $\rho_1$ to $f_1$ → produces $f_1'$
3. Apply associator (coherence)
4. Apply rule $\rho_2$ to $f_2$ → produces $f_2'$
5. Apply symmetry (coherence)
6. Apply rule $\rho_3$ to $f_3$ → produces $f_3'$

**Observable Morphism trace**:
$$\rho_1 \cdot \alpha_{-, -, -} \cdot \rho_2 \cdot \sigma_{-, -} \cdot \rho_3$$

ALL steps are observable (including coherence isomorphisms $\alpha$, $\sigma$). The congruence quotient ensures different derivation orders of coherence isomorphisms produce equivalent states.

---

## 7. Granularity comparison table

| Projection | One Observable Step | Hidden Steps | Congruence Basis |
|------------|-------------------|--------------|------------------|
| **DAG** | Node execution (productive rule) | Structural rules, wire routing | Control dependencies + node status |
| **Petri** | Transition firing (token flow) | Fold/unfold, token reordering | Token distribution with provenance |
| **π** | Communication action ($\tau$, I/O) | Structural $\equiv$, metadata, fresh names | Structural congruence |
| **Morphism** | Any $(C,R)$ rewrite step | NONE (finest granularity) | SMC homomorphism equality |

**Granularity ordering**: $\mathrm{Morphism} \leq \mathrm{DAG} \approx \mathrm{Petri} \approx \pi$

The morphism projection is finest-grained; DAG, Petri, and π projections quotient morphism-level derivations by hiding administrative steps.

---

## 8. Non-circularity proofs

### 8.1 DAG independence

**Claim**: DAG observable semantics does not depend on Petri, π, or Morphism projections.

**Proof**: DAG observable LTS is defined purely in terms of:
- Control-flow graph structure (nodes, edges)
- Node execution readiness (predecessor completion)
- Productive rule classification (intrinsic to $R$)

No reference to token markings, π processes, or morphism structure. ∎

### 8.2 Petri independence

**Claim**: Petri observable semantics does not depend on DAG, π, or Morphism projections.

**Proof**: Petri observable LTS is defined purely in terms of:
- Pre-net structure (places, transitions, arcs)
- Token distribution and provenance
- Transition enabling and firing rules (standard Petri semantics)

No reference to DAG execution, π communications, or morphism rewrites. ∎

### 8.3 π independence

**Claim**: π observable semantics does not depend on DAG, Petri, or Morphism projections.

**Proof**: π observable LTS is defined purely in terms of:
- Process syntax (standard π-calculus grammar)
- Structural congruence (standard $\equiv$ relation)
- Reduction semantics (standard communication/scope rules)

No reference to DAG nodes, Petri tokens, or morphism structure. ∎

### 8.4 Morphism independence

**Claim**: Morphism observable semantics does not depend on DAG, Petri, or π projections.

**Proof**: Morphism observable LTS is defined purely in terms of:
- SMC structure ($C$ with $\otimes$, $\circ$, $\sigma$)
- Rewriting relation $R$
- Morphism equality in the quotient category

No reference to DAG control flow, Petri markings, or π processes. ∎

---

## 9. Consistency relationship

**RFC-0002 Four-Projection Consistency Theorem** states that for every $(C,R)$ derivation:

$$\operatorname{Lift}_{\mathrm{DAG}}(d) \sim \operatorname{Lift}_{\mathrm{Petri}}(d) \sim \operatorname{Lift}_\pi(d) \sim \operatorname{Lift}_{\mathrm{Mor}}(d)$$

where $\sim$ denotes **observational equivalence** after appropriate granularity alignment.

**This document defines the left-hand side terms** (the four lift relations). The consistency theorem USES these definitions; it does not DEFINE them. This ensures non-circularity.

---

## 10. FCP acceptance criteria

Per D9 decision (RFC-0002 §23), the following must be complete before FCP entry:

### 10.1 Required deliverables

- [x] Observable state spaces $\mathcal{S}_i / {\equiv_i}$ defined for all four projections
- [x] Observable label sets $\mathcal{L}_i^{\mathrm{obs}}$ specified with hidden-step policies
- [x] Observable transition relations $\xrightarrow{}_i^{\mathrm{obs}}$ formalized
- [x] Lift relations $\operatorname{Lift}_i$ from $(C,R)$ to each observable LTS
- [x] Non-circularity proofs (§8)
- [x] Granularity comparison table (§7)

### 10.2 Integration with proof obligations

**P1a (DAG ↔ Petri)**: Uses DAG and Petri observable LTS definitions from §3-4

**P1b (Petri ↔ π)**: Uses Petri and π observable LTS definitions from §4-5

**P1c (π ↔ Morphism)**: Uses π and Morphism observable LTS definitions from §5-6, including multi-state protocol per D7-A

**Terminal observation consistency** (RFC-0002 clause 4): Uses observable stuck states from each projection, combined with success predicates from `success-predicates-interface.md` (D10)

### 10.3 Open work

**Lean formalization**: Mechanize observable LTS definitions and lift relations (part of broader P1 formalization)

**Reference witnesses**: Instantiate observable traces for P1c admitted operations (60×60 matrix)

**Independent review**: Process semantics reviewer must validate observable semantics definitions (governance gap)

---

## 11. Related specifications

- **`formal-semantics.md`**: Defines $(C,R)$ source semantics (what this document lifts FROM)
- **`success-predicates-interface.md`**: Defines terminal success predicates (uses observable stuck states from this document)
- **RFC-0002**: States consistency theorem (uses lift relations defined in this document)
- **ADR-0001 D7-A**: Multi-state π protocol for P1c reflection
- **ADR-0001 D4**: Separate metadata layer for π projection
- **ADR-0001 D8**: Individual token provenance for Petri projection

---

## 12. Summary

This specification fulfills the D9 mandatory FCP gate by providing:

1. **Four independent observable LTS definitions** grounded in target formalisms (DAG, Petri, π, morphism theories)
2. **Explicit granularity policies** distinguishing observable vs. administrative steps per projection
3. **Lift relations** from $(C,R)$ to each observable semantics
4. **Non-circularity proofs** ensuring each projection's semantics is self-contained

These definitions enable RFC-0002 Four-Projection Consistency Theorem to be meaningfully stated and proven. The consistency theorem USES these observable semantics; it does not DEFINE them.

**Status**: Draft specification ready for process semantics review and Lean mechanization.
