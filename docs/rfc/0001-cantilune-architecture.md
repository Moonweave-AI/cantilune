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
| Cursor | Fixed plan→subagent→loop $\Rightarrow$ limited expressiveness | Fixed workflow shape; no decoupled data-dependency graph |
| Codex | A2A + leader/presenter $\Rightarrow$ uncontrollable flow, unpredictable duration | No formal concurrency/termination semantics; leader is a model-driven bottleneck |
| Claude Code | Thick control plane constrains agents $\Rightarrow$ underwhelming results | No clean boundary between structural scheduling and model decision |
| OpenClaw-family | Bloated/redundant code $\Rightarrow$ engineering stall | No parsimonious formal core; ad-hoc accumulation |

### 2.2 Who benefits / why now / cost of inaction

- **Beneficiaries:** agent-system builders needing a portable, vendor-neutral orchestration core; teams hitting the ceiling of fixed-loop tools; the broader ecosystem as agent branches diversify.
- **Why now:** the ecosystem is branching fast; the window to establish a principled reference before closed de-facto standards ossify is closing.
- **Cost of inaction:** continued vendor lock-in; every team re-implementing ad-hoc orchestration; the structural failures above get copied rather than solved.

### 2.3 Consequence

Without a formally-grounded core, `cantilune` would reproduce the very failures it critiques (especially OpenClaw's bloat). The structure *is* the product. What that structure actually *is* — and why it is not an arbitrary choice of graph formalism but the mathematical essence of orchestration itself — is the subject of §6.1.

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
| Petri net | Distributed-system / concurrency essence | Concurrency/resource invariants and termination/liveness proof obligations |
| π-calculus | Communication essence | Formal A2A messaging, dynamic topology, channel mobility |
| Morphisms (category theory) | Composition / mapping essence | Minimal precise definition of how agents/operations compose |

Each is a **lens**; the unified structure is what the lenses are lenses *of*. The framework must define this higher structure concretely (not just assert it) — this is ADR-0001's central task.

Two things are easy to misread about this thesis, and worth stating up front so §6.1 lands correctly. First, "each formalism owns a facet" does **not** mean "we bolt four modules together." The recurring failure mode this project exists to avoid is treating DAG, Petri, π, and morphisms as four separate code modules glued by adapters — that reproduces OpenClaw's bloat and, worse, leaves the question "do the four views agree?" with no formal answer. The thesis is the opposite: there is *one* object, and the four formalisms are four *readings* of it. §6.1 makes this precise — orchestration *is* a symmetric monoidal category, the four projections are structure-preserving functors out of it, and "they agree" becomes a theorem (the subject of RFC-0002), not a hope.

Second, the table above is a *map of the territory*, not the territory. It says which formalism illuminates which facet, so a reader knows where each piece of the formal story will come from; the actual definitions, the proof that the four readings agree, and the precise objects are in `docs/spec/formal-semantics.md`. Readers who prefer intuition before formalism may start with the **primer** (`docs/primer/for-the-curious.md`), which explains the same ideas without the notation and links back here.

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

### 6.1 Why orchestration is a mathematical object (the unified structure)

The diagnosis in §2 lists four failure modes, but they share a root deeper than any single defect: **existing orchestrators have no unified formal semantic layer**. The *structure* of an orchestration — what depends on what, what runs in parallel, who talks to whom — and its *execution* — how it steps, whether it can stall, whether it can be replayed — are described in two unrelated languages: structure as a graph or config file, execution as ad-hoc scheduler code someone wrote that week. The consequence is that every new capability must re-invent its own execution semantics, and every guarantee ("no deadlock", "replayable", "auditable") must be argued from scratch, with the argument and the code routinely drifting apart. This is exactly why these systems end up either rigid (Cursor), uncontrolled (Codex), wedged open by a thick control plane (Claude Code), or crushed under their own semantic debt (OpenClaw). The missing thing is not a better graph model; it is a single object that *is* both the structure and the execution at once.

What could unify structure and execution? The answer is not "pick a stronger graph formalism" but a more elementary observation: **orchestration is already a symmetric monoidal category (SMC)**. The two most basic things one does when orchestrating — "do two things in parallel" and "do two things in sequence" — are precisely the tensor product $\otimes$ and the composition $\circ$; and the laws they already obey (parallel work can be reordered, sequence is associative, doing-nothing is a unit) are exactly the SMC axioms. This is not "we chose SMC as a tool for orchestration"; it is "**orchestration *is* an SMC**" — SMC is the mathematical essence of orchestration, the way relational algebra is the mathematical essence of a database. This identification is the fulcrum of the whole project: once orchestration is an SMC, its execution should be a *dynamics on that SMC*, not a second body of scheduler code talking about the first.

An SMC alone gives only the static structure — *which* compositions are legal. To say *how* it runs, we add a dynamics. We choose **string-diagram rewriting**: one execution step is "replace one small sub-diagram with another, by a rule". Why rewriting, rather than a plainer state machine? Because only rewriting turns "the four projections all see the *same* execution step" from a hand-aligned compromise between four state machines into a single theorem — and that hand-alignment is precisely the "four disconnected models" failure mode ADR-0001 warns against. So the unified object is fixed as $\text{CantiluneGraph} = (C, R)$: the SMC $C$ is the structure, the rewriting $R$ is the execution. One object, both roles; no second language.

Now what are DAG, Petri, π, and morphisms, then? Not four modules — **four viewpoints on the same $(C, R)$**, the way one database can be looked at through relational algebra, through transactions, through storage, and through concurrency. The DAG view reads off data dependencies (what produces what); the Petri view reads off concurrency and resources (what may run together, what is holding a resource); the π view reads off communication (who is talking to whom); the morphism view reads off composition and refactor (how small pieces form large ones, how to swap one piece for another). The same $(C, R)$, four readings:

```
                    CantiluneGraph  =  ( C, R )
                   /        |        |        \
             DAG proj   Petri proj  π-calc proj  Morphism proj
            (data flow) (concurrency)  (comms)     (composition)
```

This is the precise meaning of "the four theories are four observation dimensions, not four modules" (§5.1) — it is not a slogan but a direct consequence of $(C, R)$: each projection is an SMC-functor $P_i : (C, R) \to \text{Target}_i$, a structure-preserving reading of the one object into one target formalism.

What does this identification buy the cantilune *runtime*? It turns "how does the scheduler decide?" from "the model improvises" into "the structure decides": scheduling two nodes in parallel is applying $\otimes$; enforcing a data dependency is applying $\circ$; a resource being held is a Petri place whose tokens are exhausted, so the transition does not fire; one agent messaging another is one interaction on a π channel; one execution step is one rewrite. Most importantly, **observability becomes a by-product of structure**: since an execution is a rewrite sequence, a trace *is* that sequence, replay *is* re-running it, and "the four views see the same run" is exactly what the rewriting-functor consistency guarantees — the subject of §6.3 and RFC-0002. The control-plane boundary (§6.2) is where this structure-driven scheduling meets the model's node-internal work.

This must be stated honestly. Only the static free presentation and the
morphism identity view are definitional. DAG and Petri still need explicit
native step, reflection, terminal, resource, and signature-extension proofs;
the cited categorical Petri results do not automatically prove those
Cantilune-specific clauses. The π line additionally needs the typed-open/FMS
commuting bridge selected for half-π (II). Therefore all four runtime readings
must be earned through complete projection certificates, even though their
remaining obligations have very different difficulty. The finite reference
certificates in `formal/` are nonempty witnesses, not the full P1a–P1c result.
The formal definitions and proof obligations live in
`docs/spec/formal-semantics.md`; their exact mechanical status lives in
`formal/proof-obligations.json`.

### 6.2 Where the model ends and the structure begins (decoupled control plane)

The Claude Code failure mode is not "the control plane is too thick" in some measurable sense; it is that **nobody can say where the model's judgment ends and the structure's authority begins**. When every routing decision, every retry, every "should I fork a sub-agent" is decided by a prompt that nobody but the model reads, the system has no inspectable boundary — and "thinner" does not fix that; *drawing the line* does. cantilune's commitment is a single, crisp line, stated in one sentence:

> **The model proposes within a node; the structure disposes between nodes.**

What this means concretely: the LLM is confined to *what a node does internally* — reading its inputs, producing its output, deciding which MCP tool to call to get the job done. Everything *between* nodes — which nodes run in parallel ($\otimes$), which must wait on which ($\circ$), whether a resource is available (a Petri place with tokens), how an agent reaches another (a π channel) — is decided by $(C, R)$ plus a declarative policy, not by the model. When the model wants more autonomy than a single node — to spawn a sub-graph, to open a new channel — it does so by *proposing* a structural change that the policy/structure then accepts or rejects; it never silently rewrites the topology. The boundary is therefore not a heuristic but a property of the object:

| Decision | Decided by | Mechanism |
|---|---|---|
| Topology, data dependencies, concurrency bound, resources | **Structure** | $(C, R)$ (typed edges, places, channels) |
| Routing/ordering where the structure underspecifies | **Policy** (deterministic, inspectable) | policy rules over $(C, R)$ |
| What a node does internally (the actual work) | **Model** | LLM/agent inside one node |
| Forking / admitting new sub-graphs | **Structure + policy**, model *proposes* | model proposes a rewrite; policy/structure disposes |

This is what "control-plane slimness" (the C3 claim in §8) actually measures: not lines of code, but *how many between-node decisions are model-driven*. cantilune's answer is "as few as the structure allows, and the structure says which." ADR-0002 will formalize the line; this RFC only commits to where it is drawn.

### 6.3 Why observability is not a feature but a consequence

Most systems treat observability as something you add after the fact:
instrument the code, emit spans, hope you logged enough. Cantilune instead
makes observability a proof obligation of the execution package. Once every
step carries a complete event record, stable identities/tombstones, policy and
external evidence, three capabilities can be derived rather than assumed:

- **Traceability** follows when the emitted trace is the complete sequence of
  certified events; a rule name or partial log is insufficient.
- **Replayability** follows only after event-result uniqueness,
  canonicalization, and all model/external inputs are recorded. It is not a
  consequence of $(C,R)$ alone.
- **Auditability** follows for each invariant that has an actual certificate.
  Resource bounds, finite-epoch termination, and contract conformance are
  separate theorems; boundedness by itself does not imply termination.

The reason this matters is not that it saves engineering work (though it does); it is that in other systems, telemetry and truth *diverge* — the trace says one thing, the code did another, and nobody can tell which was right. Here the trace *is* the execution, because both are the same rewrite sequence. This is the direct payoff of the §6.1 identification: observability-as-structure is not a design choice, it is what "execution $=$ rewriting" buys you. It is also the foundation of the C1/C2/C3 evidence — the falsifiable claims in §8 are measured *off of* these traces, which is why they become testable rather than rhetorical.

### 6.4 What the runtime exposes (interfaces)

The four interfaces below are how the formal object meets the outside world. They are listed here as *capabilities*; their precise contracts are deferred to later ADRs, but each maps to a facet of $(C, R)$:

- **Graph definition API** — declare a `CantiluneGraph`: nodes, typed contract edges, places/transitions, channels, morphisms. This is how a user writes the static structure $C$.
- **Policy DSL** — declare concurrency / resource / routing policy layered over the graph. This is how the underspecified space *between* nodes (§6.2) is filled deterministically rather than by the model.
- **Node contract** — the interface a node (model-backed or deterministic) must satisfy; MCP tools are invoked *from within* a node, never as orchestration primitives. This is the formalization of "the model proposes within a node."
- **Executor API** — run $(C, R)$ under a policy and emit traces. This is rewriting-driven execution; the traces it emits are the ones §6.3 says come for free.
- **Comms transport** — A2A-compatible wire protocol, with π-calculus (half-π (II)) as the formal semantics layered above. This is the π projection becoming real network messages.

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
| C2 | Controllability/predictability | Codex | Certified finite-epoch step rank and explicit resource caps on a benchmark suite; deterministic progress under fixed policy (time bounds are out of scope for v0.1) |
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
