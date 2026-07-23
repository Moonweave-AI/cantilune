# RFC-0001: Cantilune — Unified-Structure Agent Orchestration Framework

| Field | Value |
|---|---|
| Status | **Draft** (pre-FCP) |
| Type | Architecture |
| Risk | S2 (architectural/strategic; elevates to S3 at runtime/comms/network) |
| Champion / Decision Owner | Joker-of-Gotham (DRI) |
| Required Reviewers | Architecture (second reader — **TBD, gap**), Security/Threat Model (pre-runtime), AI Eval (pre-benchmark-claims) |
| Created | 2026-07-23 |
| Related | ADR-0001 (unified formal structure), GitHub Issue TBD |

> **Governance note:** This RFC is the canonical source of truth for the `cantilune` goal. Chat discussion is not authoritative. Reviewer assignment is deferred to FCP entry (acceptable at M0/M1; flagged as a gate, not a blocker to drafting).

---

## 1. Summary

`cantilune` is an open, model-capability-decoupled agent-orchestration framework whose core is a **unified formal structure** that subsumes four formalisms as aspects: **DAG** (presentation / data-flow clarity), **Petri nets** (distributed-system / concurrency essence), **π-calculus** (communication essence), and **category-theoretic morphisms** (composition/mapping essence). The framework targets four documented failure modes in existing orchestrators (Cursor, Codex, Claude Code, OpenClaw-family) and makes its superiority falsifiable across four measurable axes.

## 2. Motivation

### 2.1 Problem

Current agent orchestration systems exhibit four named failure modes, each tied to a disregard for mathematical/logical structure:

| System | Failure mode | Structural root cause (hypothesis) |
|---|---|---|
| Cursor | Fixed plan→subagent→loop ⇒ limited expressiveness | Fixed workflow shape; no decoupled data-dependency graph |
| Codex | A2A + leader/presenter ⇒ uncontrollable flow, unpredictable duration | No formal concurrency/termination semantics; leader is a model-driven bottleneck |
| Claude Code | Thick control plane constrains agents ⇒ underwhelming results | No clean boundary between structural scheduling and model decision |
| OpenClaw-family | Bloated/redundant code ⇒ engineering stall | No parsimonious formal core; ad-hoc accumulation |

### 2.2 Who benefits / why now / cost of inaction

- **Beneficiaries:** agent-system builders needing a portable, vendor-neutral orchestration core; teams hitting the ceiling of fixed-loop tools; the broader ecosystem as agent branches diversify.
- **Why now:** the ecosystem is branching fast; the window to establish a principled reference before closed de-facto standards ossify is closing.
- **Cost of inaction:** continued vendor lock-in; every team re-implementing ad-hoc orchestration; the structural failures above get copied rather than solved.

### 2.3 Consequence

Without a formally-grounded core, `cantilune` would reproduce the very failures it critiques (especially OpenClaw's bloat). The structure *is* the product.

## 3. Goals

1. Define a **unified formal structure** in which DAG, Petri, π-calculus, and morphisms are projections/aspects, not alternatives.
2. **Decouple orchestration from model capability**: scheduling/routing is structural + policy-driven; the model is confined to node-internal work.
3. Make **observability a structural property**: every execution is a deterministic projection of the graph; trace/replay are first-class.
4. Establish **four falsifiable superiority claims** vs the named baselines, with an eval plan to measure each.
5. Maintain **engineering parsimony**: a minimal viable core, phased extension, to avoid the OpenClaw failure mode.

## 4. Non-goals

- Not a wrapper around a single vendor's agent loop.
- Not a re-implementation of a heavy redundant codebase; no "complete framework" scope-creep without phased justification.
- Not closed-source or fixed-workflow.
- Not a model-training or model-hosting system.
- Not an end-user product UI (reference implementations may have minimal CLI/tooling; UX is out of scope for this RFC).

## 5. Background

### 5.1 Unified-structure thesis (from triage decision)

The four formalisms each own a facet; `cantilune` is the higher-order structure they are facets *of*:

| Formalism | Facet | What it gives |
|---|---|---|
| DAG | Presentation / data-flow clarity | Readable topology, explicit data deps, "what depends on what" |
| Petri net | Distributed-system / concurrency essence | Concurrency, resource-bounding, termination/liveness |
| π-calculus | Communication essence | Formal A2A messaging, dynamic topology, channel mobility |
| Morphisms (category theory) | Composition / mapping essence | Minimal precise definition of how agents/operations compose |

Each is a **lens**; the unified structure is what the lenses are lenses *of*. The framework must define this higher structure concretely (not just assert it) — this is ADR-0001's central task.

### 5.2 Related work (positioning — to be expanded during review)

**Unverified** — positions are facts about each system's *stated* shape, not endorsements; must be validated during review.

| System | Relation | Cantilune wedge |
|---|---|---|
| **LangGraph** | Closest prior art (graph-based agent graphs) | LangGraph is *only* the DAG facet; cantilune unifies DAG + Petri (resource/concurrency) + π-calculus (comms) + morphisms (composition). Combinatorial wedge: (a) typed data-contract edges + resource places, (b) model-decoupled structural routing, (c) observability-as-structure. |
| **AutoGen / CrewAI** | Multi-agent A2A | π-calculus facet gives formal comms semantics AutoGen/CrewAI lack; structural routing vs leader-bottleneck addresses the Codex failure mode. |
| **A2A protocol** | Comms standard | Cantilune's comms facet should be **A2A-compatible** as a transport, with π-calculus as the formal semantics on top. |
| **MCP** | Tool-call standard | Cantilune nodes should be able to invoke MCP tools; MCP is a node-internal capability, not an orchestration primitive. |
| **Temporal / Airflow / Dagster** | DAG workflows (non-agent) | Cantilune shares DAG topology but adds agent-specific facets (comms, model-decoupled routing, agent observability). These systems are data-plane references for scheduler design. |

> **Critical gap to close before FCP:** validate the LangGraph differential concretely. "LangGraph lacks X" must be checked against LangGraph's actual current capabilities, not assumed.

## 6. Proposal

### 6.1 The unified structure (high-level; concretized in ADR-0001)

The `cantilune` core is a single formal object — working name **`CantiluneGraph`** — that admits four well-defined projections:

```
                    CantiluneGraph  (unified)
                   /        |        |        \
             DAG proj   Petri proj  π-calc proj  Morphism proj
            (data flow) (concurrency)  (comms)     (composition)
```

- **DAG projection** = the data-dependency graph: typed edges carry data *contracts* (schema + pre/post-conditions), giving expressiveness + observability.
- **Petri projection** = the control/concurrency layer: places model **resources** (context window, tool rate limits, human-attention slots); transitions fire on token readiness, giving **bounded concurrency, resource-bounding, termination/liveness guarantees**.
- **π-calculus projection** = the communications layer: inter-agent channels as named processes with formal semantics for dynamic topology and mobility.
- **Morphism projection** = the composition layer: agents/operations as morphisms in a category; orchestration = composition; gives minimal, precise semantics for substitution, reuse, and refactor.

The framework defines:
- A **type system** for nodes, edges, places, transitions, channels, and morphisms.
- **Functorial mappings** between projections (e.g., a DAG edge corresponds to a Petri token flow corresponds to a π-calculus channel message) so the four projections are consistent views of one object, not four disconnected models.
- A **scheduler/executor** that operates on the unified object, not on any single projection.

### 6.2 Decoupled control plane

The **structural vs. model-decided boundary** (addresses Claude Code failure mode):

| Layer | Decided by | Mechanism |
|---|---|---|
| Topology, data dependencies, concurrency bound, resources | **Structure** (declarative graph + policy) | CantiluneGraph + policy DSL |
| Routing/ordering where structure is underspecified | **Policy** (deterministic, inspectable) | Policy rules, not model |
| What a node does internally (the actual work) | **Model** | LLM/agent inside a node |
| When to fork/admit new sub-graphs | **Structure + policy**, with model *proposing* | Model proposes, policy/structure disposes |

Rule of thumb: **the model proposes within a node; the structure disposes between nodes.** This is the crisp boundary the RFC commits to and ADR-0002 will formalize.

### 6.3 Observability as structure

Because every execution is a **deterministic projection of the CantiluneGraph** under a fixed policy + recorded model outputs, every run is:
- **Traceable:** each node/edge/transition has a stable identity; traces are first-class.
- **Replayable:** given the graph, policy, and recorded model I/O at each node, a run can be replayed.
- **Auditable:** structural invariants (termination, resource bounds, data-contract conformance) are checkable on the graph *before* execution (static) and *during* (runtime).

This is not a telemetry bolt-on; it falls out of the formal model.

### 6.4 Interfaces (to be specified in ADRs)

- **Graph definition API:** declarative construction of `CantiluneGraph` (nodes, typed data edges, places/transitions, channels, morphisms).
- **Policy DSL:** declarative concurrency/resource/routing policy layered over the graph.
- **Node contract:** the interface a node (model-backed or deterministic) must satisfy; MCP tools are invokable from within a node.
- **Executor API:** runs the graph under a policy; emits traces.
- **Comms transport:** A2A-compatible; π-calculus semantics layered above.

## 7. Alternatives

| Option | Pros | Cons | Verdict |
|---|---|---|---|
| **Do nothing** | No work | Failures persist; lock-in; ecosystem stalls | Reject |
| **Minimal: DAG only** | Simplest to ship/eval; clear observability | No formal concurrency/termination (weak vs Codex); no comms essence (weak vs A2A); reproduces "just DAG" like LangGraph | Reject (too weak vs the stated baselines) |
| **Single formalism (Petri / π / morphism)** | Focused | Loses the other facets; each facet maps to a different failure mode | Reject (you explicitly want all four) |
| **Unified structure (DAG+Petri+π+morphism)** | Addresses all four failure modes; defensible vs all baselines; matches triage decision | Most complex to specify; scope/bloat risk; needs functorial consistency proof | **Accept** — with phased plan (§10) to control bloat |

## 8. Falsifiable claims & eval plan (gates the "more capable" assertions)

Governance forbids "more capable" claims without eval. Each claim maps to a baseline failure mode and a measurable criterion. **All criteria below are unverified until an eval harness exists.**

| # | Claim | Baseline | Metric / success criterion (to be made precise in Eval ADR) |
|---|---|---|---|
| C1 | Expressiveness | Cursor | Existence of workflows representable in CantiluneGraph that Cursor's fixed shape cannot express without contortion; count + classification |
| C2 | Controllability/predictability | Codex | Bounded step/time (Petri termination) on a benchmark suite; deterministic progress under fixed policy |
| C3 | Control-plane slimness | Claude Code | Ratio of structural-decision code to model-decision code; human-rated "constraint overhead" |
| C4 | Engineering parsimony | OpenClaw | Feature-surface / core-code-complexity ratio; cyclomatic complexity of the core vs comparable feature set |

These four claims are **the bar `cantilune` must clear** to be considered successful. Failure to meet any is a valid reason to terminate the project (per idea-triage exit discipline).

## 9. Security / Privacy / IP

- **Threat Model:** required before any runtime/comms/network implementation (gate, not yet applicable).
- **Untrusted inputs:** graphs, node payloads, MCP tool outputs, A2A messages are untrusted data; the executor must enforce node-internal capability boundaries (least privilege per node).
- **IP:** framework to be open-sourced (license TBD); no third-party code incorporated without provenance review.
- **Secrets:** no secrets in graphs/traces; traces must not leak node-internal model prompts that may contain user data (to be addressed in the Observability/Data-handling ADR).

## 10. AI/Agent considerations

- Agent behavior is **bounded by structure + policy**, not by a thick control plane (direct contrast to Claude Code).
- High-impact agent actions (network, file write, tool use) require **permission boundaries per node** and integrate with the governance E-Stop / safe-state principle (per Moonweave baseline).
- Model autonomy is confined to node-internal proposals; structure disposes.

## 11. Observability

See §6.3. Traces are first-class; replay is a structural property. Evaluation (§8) consumes traces. The trace schema is a normative deliverable (TBD ADR).

## 12. Test / Eval

- **Eval harness** is a first-class deliverable, not an afterthought — it is what makes the falsifiable claims testable.
- Core invariants (termination, resource bounds, data-contract conformance) get **static checks** (graph-level) and **runtime checks** (executor-level).
- No fabricated results: any claim not measured is marked **unverified**.

## 13. Rollout / Rollback

- **Phased plan** (to control bloat — the OpenClaw failure mode):
  1. **P1 — Core formal model + ADR-0001:** define CantiluneGraph + the four projections + functorial consistency. No runtime.
  2. **P2 — Minimal executor + DAG/Petri projections + static checks.** Eval C1, C2 partially.
  3. **P3 — π-calculus comms facet + A2A transport.** Eval comms.
  4. **P4 — Observability (trace/replay) + Eval harness complete.** Eval C1–C4.
  5. **P5 — Morphism composition facet + refactor tooling.**
- **Rollback:** each phase is independently abandonable; failure of a phase's eval claims triggers re-scope or terminate (per idea-triage).

## 14. Compatibility / Migration

- Greenfield; no legacy migration. Interop targets (A2A, MCP) are compatibility surfaces, not migration.
- LangGraph/AutoGen interop is a **non-goal for P1–P2**; revisit if eval requires.

## 15. Open questions (to resolve before FCP)

1. **Q1:** Concrete definition of the unified `CantiluneGraph` and the functorial mappings between projections (ADR-0001 scope). *Largest open item.*
2. **Q2:** LangGraph differential — validate concretely against current LangGraph capabilities.
3. **Q3:** Does the policy DSL need to be Turing-complete or deliberately restricted? (affects termination guarantees).
4. **Q4:** License choice.
5. **Q5:** Eval benchmark suite selection (existing suites vs bespoke).
6. **Q6:** Second reviewer assignment (governance gap).

## 16. FCP summary (not yet entered)

Not entered. Pre-FCP. Open questions Q1–Q6 must be addressed, and a second reviewer assigned, before Final Comment Period.

## 17. Decision record

- **Triage:** idea cleared (exit: Discovery → RFC), 2026-07-23.
- **Structural decision:** unified structure (DAG+Petri+π+morphism) — recorded as ADR-0001.
- **RFC status:** Draft, awaiting review and second-reader assignment.

## 18. Implementation / ADR tracking

| Artifact | Status | Blocks |
|---|---|---|
| ADR-0001 Unified formal structure | **To author** (next) | P1 |
| ADR-0002 Structural-vs-model control-plane boundary | Pending | P2 |
| ADR-0003 Comms facet + A2A transport | Pending | P3 |
| ADR-0004 Trace/replay schema (observability) | Pending | P4 |
| ADR-0005 Eval harness & metrics | Pending | P4 |
| ADR-0006 Morphism composition facet | Pending | P5 |
| GitHub Issue (kickoff) | To create | — |
| Implementation Project board | To create post-FCP | — |

## Next Steps

| Action | Owner | Due/Review | Canonical Link |
|---|---|---|---|
| Author ADR-0001 (unified formal structure) | Joker-of-Gotham (DRI), Claude drafts | Now | `docs/adr/0001-unified-formal-structure.md` |
| Resolve Q2 (LangGraph differential) | DRI + reviewer | Pre-FCP | this RFC §5.2 |
| Assign second reviewer | DRI | Pre-FCP | RFC §0 |
| Enter FCP once Q1–Q6 addressed | DRI | post-review | this RFC §16 |
