# RFC-0002: Projection Consistency — What the Proof Buys, and the Four-Projection Consistency Theorem

| Field | Value |
|---|---|
| Status | **Draft** (pre-FCP) |
| Type | Architecture / Formal |
| Risk | S2 |
| Champion / Decision Owner | Joker-of-Gotham (DRI) |
| Required Reviewers | Architecture (second reader — **TBD, gap**), Formal-math reviewer (required for §4 proof — **TBD, gap**) |
| Created | 2026-07-23 |
| Related | RFC-0001, ADR-0001, `docs/spec/formal-semantics.md` |

> **Governance note:** This RFC is the **生死线 (project life-line)** identified in ADR-0001. It is *not* primarily a proof document — the proofs live in `docs/spec/formal-semantics.md`. Its job in the main line is to state **what cantilune's runtime gains if the four projections are consistent**, why that gain is the whole point of the unified structure, and then the theorem + phased proof that must earn it. Per the DRI's decisions, π-projection consistency is **NOT by construction** and is proven on a **phased plan** (§4); all π-side claims are **待证 / unverified** until a proof exists.

---

## 1. Summary (capabilities first)

The unified structure of RFC-0001 says: a `CantiluneGraph` is one object $(C, R)$, and DAG / Petri / π / morphism are four *readings* of it. That claim is only worth anything if the four readings agree — otherwise "one object" is a polite name for "four disconnected models held together by hope," which is precisely the OpenClaw failure mode. **This RFC is the work that makes "one object" true** (or, on the π line, honestly reports how true it can be made).

But the point of this RFC is not the proof itself. The point is **what cantilune's runtime gets if the proof succeeds**:

- **Deterministic, multi-view execution.** If each projection $P_i$ is a *rewriting functor* — it maps a rewrite step $g \to_\rho h$ in $(C, R)$ to a step $P_i(g) \to P_i(h)$ in its target — then a single execution step is, provably, *the same step* seen as a data-flow advance (DAG), a token firing (Petri), a channel interaction (π), and a composition (morphism). There is no second "reconciliation" pass that could disagree with the real execution.
- **Observability that cannot drift.** Because trace/replay are the rewrite sequence and every view is a functor of it, the trace you see in the DAG view, the Petri view, the π view, and the morphism view are *provably* the same run. This is the formal content of RFC-0001 §6.3's "observability-as-structure": it is not a claim, it is what rewriting-functor consistency *is*.
- **Falsifiable claims become measurable.** C1 (expressiveness), C2 (step-bounded predictability), C3 (control-plane slimness) are all measured *off of* these consistent traces. Without consistency, the metrics would measure four divergent stories; with it, they measure one.

So the theorem in §3 is not mathematical decoration — it is the load-bearing wall under cantilune's three biggest selling points. If it fails on three of the four lines, the project as framed cannot stand; if it fails on the π line, the π projection is reduced to a proven sublanguage (§6) and the rest stands.

## 2. How this advances cantilune (the logic, not the proof)

The progression that this RFC sits inside is:

1. **RFC-0001 §6.1** identifies orchestration with $(C, R)$ and claims four projections are one object.
2. **That claim has a hidden cost**: "four projections of one object" is either a theorem or a lie. ADR-0001 makes it a gate (the 生死线) rather than an assumption.
3. **This RFC** pays that cost — by stating the theorem, splitting it by projection (three by construction, one 待证), and giving a phased proof plan with binding fallback.
4. **What is bought** is exactly the runtime capabilities in §1: multi-view execution, drift-free observability, measurable claims.

The reason the proof is split by projection, and the reason the split matters to the *project* (not just the math), is that each line buys a different capability, and each fails differently:

| Projection | If consistent, cantilune gains... | Status | If it fails... |
|---|---|---|---|
| DAG | data-dependency view $=$ execution view; traceable workflows | by construction | (won't fail) |
| Petri | concurrency/resource view $=$ execution view; bounded, deadlock-detectable runs (C2) | by construction, *pending the §4.1 Eckmann–Hilton resolution* | adopt pre-net/SSMC, or lose $\circ$/$\otimes$ distinction |
| Morphism | composition/refactor view $=$ execution view; reusable, swappable pieces | by construction | (won't fail) |
| π | communication view $=$ execution view; agent-to-agent runs are replayable across the comms lens (C3-adjacent) | **待证** | reduce π to a proven sublanguage; free conversation deferred |

Read the table this way: **the math is not a separate concern from the product — each row of mathematics buys a specific row of capability, and each failure mode costs a specific row of capability.** That is why this RFC exists in the main line and not only in the spec: the capability table *is* the answer to "what does the proof do for cantilune."

## 3. The theorem (statement; proof in the spec)

**Theorem (Four-Projection Consistency, v0.1).** Let $\text{CantiluneGraph} = (C, R)$ as defined in `docs/spec/formal-semantics.md`. For each projection $P_i \in \{P_{DAG}, P_{Petri}, P_\pi, P_{Mor}\}$:

1. $P_i$ is an SMC-functor from $C$ to a target category $T_i$ (preserves $\otimes$, $\circ$, $\sigma$, $I$).
2. $P_i$ is a **rewriting functor**: for every rewrite step $g \to_\rho h$ in $R$, there is a rewrite step $P_i(g) \to_{\rho_i} P_i(h)$ in $T_i$'s rewriting theory.
3. **Cross-projection consistency**: a single rewrite step $g \to_\rho h$ in $C$ has images $\{P_i(g) \to P_i(h)\}_i$ that are **the same step** read in four formalisms.

Clauses (1)–(2) are the "each view is a faithful reading" part; clause (3) is the "all readings agree on each step" part. It is clause (3), translated to capabilities, that yields the §1 gains.

### 3.1 Proof status by projection

| Projection | Clause (1) SMC-functor | Clause (2) rewriting functor | Clause (3) cross-consistency | Overall |
|---|---|---|---|---|
| DAG | by construction | by construction (node-advance = local rewrite) | follows | **按构造一致** |
| Petri | by construction (Meseguer–Montanari) — **but see pre-net caveat §4.1** | by construction (firing = rewrite) | follows | **按构造一致** (modulo net-level checkers §5, and the §4.1 Eckmann–Hilton resolution) |
| Morphism | by construction (identity view) | by construction | follows | **按构造一致** |
| π (half-π II) | **待证** (presheaf bridge) | **待证** | **待证** | **待证** |

## 4. Phased proof plan (DRI decision: 明示分期)

The proof is phased not for mathematical convenience but because **each phase unlocks a different capability**, so the project can move forward on what is proven without waiting on the hardest line.

### 4.1 P1a — Three-projection by-construction consistency (write-up)

- State $P_{DAG}$, $P_{Petri}$, $P_{Mor}$ as SMC-functors explicitly.
- Show each preserves $\otimes$, $\circ$, $\sigma$, $I$.
- Show each lifts $R$ to its target rewriting (node-advance / firing / identity-redex).
- **Petri caveat (load-bearing):** the naive "Petri nets are commutative monoidal categories" reading collapses $\circ$ and $\otimes$ via Eckmann–Hilton, conflicting with cantilune's need to keep sequential dependency and parallelism distinct. P1a must use the **pre-net / free-SSMC semantics** (Bruni–Meseguer–Montanari–Sassone), not the commutative-monoidal reading, or justify the collapse. See `docs/spec/formal-semantics.md` §10.8, §8.6. This is no longer "expected clean" without resolving it.
- **Capability unlocked:** the DAG, Petri, and morphism views become provably the same execution — i.e., the §1 multi-view execution and drift-free observability hold *on three of the four lenses*. This is enough to ship a traceable, replayable, bounded-concurrency runtime even before π is proven.
- **Output:** a written proof. **Status: to be written.** (Unverified until written and reviewed.)

### 4.2 P1b — π consistency for the request/accept channel-creation sublanguage

- Construct the embedding $C \to [\text{some presheaf category}]$ for the **structured** part of half-π (II): channels created by request/accept, with typed handshake but **no commitment on post-handshake conversation shape** beyond what the sublanguage fixes.
- Prove the embedding is an SMC-functor and a rewriting functor **for this sublanguage**.
- **Capability unlocked:** agent-to-agent communication becomes replayable across the comms lens — runs that use request/accept addressing are as traceable and replayable as data-flow runs. This is what makes multi-agent execution a first-class citizen rather than an opaque side-channel.
- **Output:** a proof for the sublanguage. **Status: 待证.** May require adding conditions or granularity alignment. If it fails, invoke §6 fallback.

### 4.3 P1c (deferred) — π consistency for free conversation / unrestricted mobility

- Extend P1b's bridge to **full** half-π (II): untyped post-handshake conversation, unrestricted delegation/mobility.
- **Capability (if proven):** the open-ecosystem case — agents that, at runtime, talk to partners unknown at authoring time — becomes fully consistent too.
- **Status: 待证, explicitly deferred beyond P1.** This is the part where the presheaf bridge is heaviest and where a clean theorem is least guaranteed. Per ADR-0001, this may be permanently reduced to a sublanguage — in which case the *open-ecosystem* capability is the one not bought, and the project says so honestly rather than overclaiming.

## 5. Petri net-level property checkers (declared obligation)

Per the spec §6.2 / §7, boundedness / liveness / reachability are **not** given by bare SMC; they are checked **on the Petri projection**. This is the bridge from "the math is consistent" to "the C2 predictability claim is measurable": consistency says the Petri view *is* the execution; the checkers then read properties off that view.

- **Boundedness checker** (marking reachability finiteness) — required for RFC-0001 C2 "predictability" (step-bounded).
- **Liveness checker** (workflow-net soundness variant) — required for deadlock claims.
- **Reachability checker** — required for trace completeness.

These are **future tooling** (formal simulator, post-FCP), not part of this RFC's proof. Marked **unverified** until the simulator exists and passes.

## 6. Fallback (per ADR-0001)

If P1b cannot be proven (even for the request/accept sublanguage):

1. **Reduce** the π-projection to the largest sublanguage for which a rewriting-functor bridge **can** be proven.
2. **Document** the reduction in this RFC (which π constructs are dropped, which retained).
3. **Mark** all dropped constructs **unsupported in P1** and all retained-but-unproven constructs **unverified**.
4. Do **not** claim four-projection consistency for the full half-π (II); claim it only for the proven subset.

This fallback is the honest expression of ADR-0001's "reduce to the consistent subset" clause under the half-π (II) decision. Its product-meaning, per §2's table: if P1b fails, the **agent-to-agent replayability** capability is what is not fully bought, and the project ships without it rather than pretending otherwise.

## 7. Security / correctness implications

- No runtime, no I/O in this RFC's scope; no threat-model gate triggered yet.
- **Correctness risk:** if the theorem (esp. §4.2/4.3) fails and fallback is not honestly applied, the project's core claim ("unified structure") is false — this is the strategic risk ADR-0001 flags. This RFC's discipline (phased proof, fallback, unverified marking) is the mitigation. Concretely: the risk is not "a proof is hard" but "we ship a multi-view runtime whose views silently disagree," which would reproduce the observability-diverges-from-truth failure that §1 says consistency is meant to prevent.

## 8. Open questions

1. The precise presheaf category for the π bridge (which name-generation model).
2. Granularity alignment: does one π interaction step correspond to one rewrite, or many? (affects clause 2/3 for π, and hence the granularity at which "same step" is claimed).
3. Whether P1b's sublanguage is expressive enough to be useful (if not, re-evaluate half-π (II) vs session-typed — the §1 capability table is the arbiter: if the sublanguage buys no useful agent-to-agent replayability, the choice must be revisited, not quietly shrunk).
4. Second reviewer / formal-math reviewer assignment (governance gap).
5. **Petri projection resolution**: pre-net/SSMC vs commutative-monoidal (Eckmann–Hilton $\circ$/$\otimes$ collapse) — must be resolved before the Petri "by construction" claim stands (§4.1, spec §10.8).

## 9. FCP summary (not yet entered)

Pre-FCP. Entering FCP requires: P1a write-up complete (with the §4.1 Petri resolution), P1b proof or honest fallback applied, formal-math reviewer assigned, Q1–Q5 addressed.

## 10. Decision record

- **Phased proof adopted** (DRI decision 2026-07-23): P1a (by-construction 3 projections) + P1b (π sublanguage) + P1c (deferred π full).
- **π projection is 待证 by design** (half-π (II) decision); no by-construction claim for π.
- **Fallback discipline** binding: unproven ⇒ reduced subset + unverified marking.
- **RFC reframed (this revision):** from a proof document to a "what the proof buys" document; proofs remain in the spec, capability mappings added per phase (§1, §2, §4).

## 11. Tracking

| Artifact | Status |
|---|---|
| `docs/spec/formal-semantics.md` (definitions + proofs) | Draft |
| P1a proof write-up (+ §4.1 Petri resolution) | To produce |
| P1b proof (or fallback) | To produce |
| Formal-math reviewer | To assign |
| Formal simulator (§5 checkers) | Post-FCP |

## Next Steps

| Action | Owner | Due/Review | Canonical Link |
|---|---|---|---|
| Produce P1a by-construction write-up (with Petri resolution) | DRI (Claude drafts) | Next | this RFC §4.1 |
| Construct P1b π bridge (or invoke fallback) | DRI + formal-math reviewer | Pre-FCP | this RFC §4.2 |
| Assign formal-math reviewer | DRI | Pre-FCP | RFC §0 |
| Enter FCP once §9 gates met | DRI | post-review | this RFC §9 |
