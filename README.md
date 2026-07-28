<div align="center">
  <img src="./assets/banner.png" alt="Cantilune banner" width="720">

  <h1>Cantilune</h1>

  <p><strong>Compose intent into visible, evolvable coordination.</strong></p>
  <p><sub>让意图成为可见、可演化、可验证的协同行动。</sub></p>

  <p>
    <img alt="Status: pre-alpha" src="https://img.shields.io/badge/status-pre--alpha-D97706">
    <img alt="Formal core: proved, review pending" src="https://img.shields.io/badge/formal%20core-proved%20%2F%20review--pending-4F46E5">
    <img alt="Runtime: not released" src="https://img.shields.io/badge/runtime-not%20released-64748B">
    <a href="https://github.com/Moonweave-AI/cantilune/actions/workflows/formal.yml?query=branch%3Acodex%2Ftheory-foundation">
      <img alt="Formal theory CI" src="https://github.com/Moonweave-AI/cantilune/actions/workflows/formal.yml/badge.svg?branch=codex%2Ftheory-foundation">
    </a>
  </p>

  <p>English · <a href="docs/README.zh-CN.md">简体中文</a></p>
</div>

> [!IMPORTANT]
> **Cantilune is pre-alpha.** It is a formal-semantics and orchestration
> research project, not yet a released runtime, SDK, scheduler, or agent
> product. Features marked `†` below are architecture and theory targets, not
> a claim of released feature parity or measured superiority.

## The goal

Cantilune is a proposed **general-purpose language and control substrate for
agent orchestration**. It is meant to coordinate agents, tools, people,
services, permissions, sessions, and scarce resources in one inspectable model.

The project starts from a simple observation: a capable agent is not enough for
a capable *system*. Once several agents share work, the hard questions are
coordination questions:

- Who may do what, with which budget, lock, credential, or approval?
- Which agent owns a task; when is work delegated, accepted, rejected, or
  escalated?
- Which conversations are private sessions, and when may a session or
  capability be transferred?
- What changed in the collaboration graph, why was that change valid, and can
  it be replayed?

Existing frameworks make it much easier to build useful agent workflows.
Cantilune aims at the missing semantic layer: an evolving **coordination world
model** in which topology, authority, resources, protocols, and feedback are
first-class rather than implicit in prompts, callbacks, and mutable state.

```text
intent + constraints
        → visible collaboration graph
        → typed composition + protocol + authority + resource checks
        → agents + tools + people + services + external systems
        → identified events + replay + feedback + controlled reconfiguration
```

“Arbitrary orchestration” does not mean arbitrary untyped side effects. It
means that any topology or protocol satisfying declared contracts may be
constructed, composed, and changed.

## The mathematical model

The semantic target is a rewriting system

\[
  \mathsf{CantiluneGraph}=(\mathcal C,\mathcal R),
\]

where \(\mathcal C\) defines legal composition and \(\mathcal R\) defines
identified reconfiguration events. The mathematics is an internal kernel; it
should make orchestration easier to understand, inspect, and control—not force
application authors to write category theory.

| Component | Orchestration meaning | What it protects or explains |
|---|---|---|
| Free symmetric monoidal category | Typed sequential, parallel, and rewired composition | Illegal connections and hidden copy/discard are distinct from legal composition |
| Typed open hypergraphs + DPOI rewriting | Add, replace, reconnect, or delete a collaboration subgraph | A change has explicit boundary, freshness, dangling, and quiescence conditions |
| Late \(\pi\)-calculus | Create, hide, transfer, and close communication sessions | Delegation and handoff are protocols, not merely shared-state mutations |
| Individual-token Petri semantics | Represent unique permission, quota, lock, budget, and session tokens | Authority and resources cannot silently duplicate or disappear |
| FMS-style denotational research branch | Give a compositional account of supported concurrent behavior | Operational and denotational views can be related within a documented scope |
| Projection certificates | Relate graph, dependency, resource, communication, and identity views | One source event has corresponding target events and a replay identity |

For a certified event \(e\), the intended consistency condition is

\[
  C \xrightarrow{e} C'
  \quad\Longrightarrow\quad
  P_i(C)\xrightarrow{\Phi_i(e)}P_i(C')
  \qquad
  (i\in\{\mathrm{DAG},\mathrm{Petri},\pi,\mathrm{morphism}\}).
\]

In plain terms: an event is not four dashboards that happen to agree after the
fact. It is one identified change with native counterparts in four useful
views.

## What a user should be able to see

| View | Question answered |
|---|---|
| Collaboration structure | Which agents, tools, people, and services are connected now? What changed? |
| Dependency view | What is runnable, blocked, cyclic, completed, or awaiting an external input? |
| Resource and authority view | Who holds a unique permission, budget, lock, session, or approval? |
| Communication view | Who delegated what to whom, on which session, with which acknowledgement? |
| Replay and feedback view | Which precise events led here, what evidence arrived, and why was the next action chosen? |

The important distinction is that an LLM saying “done” is not by itself a
completed protocol transition. Success, rejection, waiting, deadlock, and
productive infinite operation are different states.

## Orchestration-framework landscape

This is a scope comparison, **not a benchmark**. The horizontal axis contains
orchestration frameworks—not coding-agent products. The cells summarize linked
official documentation as reviewed on 2026-07-28:

- `✓` — documented first-class capability or primary design goal;
- `△` — available through integration, custom composition, or an adjacent
  feature, but not the same first-class semantic guarantee;
- `✗` — not a documented primary guarantee in the sources reviewed;
- `✓†` — Cantilune’s specified formal target, not a released runtime feature.

| Capability / primary scope | [LangChain](https://docs.langchain.com/oss/python/langchain/multi-agent/) | [LangGraph](https://docs.langchain.com/oss/python/langgraph/overview) | [CrewAI](https://docs.crewai.com/) | [AutoGen](https://microsoft.github.io/autogen/stable/) | [OpenAI<br>Agents SDK](https://openai.github.io/openai-agents-python/agents/) | [Google<br>ADK](https://adk.dev/) | [Pydantic<br>AI](https://pydantic.dev/docs/ai/overview/) | [Mastra](https://mastra.ai/ai-workflows) | [Microsoft Agent<br>Framework](https://learn.microsoft.com/en-us/agent-framework/) | **Cantilune** |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| General-purpose agent/workflow orchestration | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓† |
| Explicit workflow topology: branch, loop, parallel work | △ | ✓ | ✓ | ✓ | △ | ✓ | ✓ | ✓ | ✓ | ✓† |
| Multi-agent teams, routing, delegation, or handoff | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | △ | ✓ | ✓ | ✓† |
| Durable state, pause/resume, or human approval | △ | ✓ | ✓ | △ | △ | ✓ | ✓ | ✓ | ✓ | ✓† |
| Model, tool, and MCP integration | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓† |
| Trace, logging, or execution observability | △ | ✓ | ✓ | △ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓† |
| Provider-independent **semantic** composition calculus | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓† |
| Native scoped sessions and transferable channels | ✗ | ✗ | ✗ | △ | △ | ✗ | ✗ | ✗ | ✗ | ✓† |
| Linear semantics for unique resources and authority | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓† |
| Dynamic graph change admitted by structural, resource, and authorization conditions | ✗ | △ | ✗ | △ | ✗ | △ | △ | △ | △ | ✓† |
| One event synchronized across graph, dependency, resource, and protocol views | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓† |
| Semantic replay of identified reconfiguration events | ✗ | △ | △ | △ | △ | △ | △ | △ | △ | ✓† |
| Released runtime, ecosystem, and production track record | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |

Existing frameworks are strong at the workflow-runtime layer. LangGraph focuses
on stateful graphs, durable execution, streaming, human-in-the-loop control,
and long-running agents; Google ADK provides graph and multi-agent workflows,
sessions, observability, evaluation, and A2A/MCP integration; Mastra provides
typed workflow steps, persistent state, branching, parallelism, and traces.
Cantilune is designed to add a common coordination model around such runtimes.

Its semantic focus is distinct: **topology change, communication scope,
exclusive authority, and replay are objects of the orchestration semantics
itself.** This complements frameworks that supply agent roles, prompts, tools,
and workflow APIs.

## Coordinating specialized agents

Cantilune is designed to coordinate specialized agents such as
[Claude Code](https://code.claude.com/docs/),
[OpenAI Codex](https://openai.com/codex/), and
[OpenCode](https://opencode.ai/docs/agents), alongside research agents, review
agents, tools, services, and human participants. Each participant contributes
its own expertise; Cantilune records how responsibilities, permissions,
sessions, and evidence move between them.

For a software task, a coding agent can implement a change while a reviewer
checks it, a researcher supplies evidence, and a human retains approval for a
high-impact action:

```text
goal, policy, budget, ownership
               │
               ▼
       Cantilune coordination graph
     ┌─────────┼──────────┐
     ▼         ▼          ▼
research   coding agent   reviewer / human
agent      (Codex,        agent
           Claude Code,
           OpenCode, …)
     └─────────┼──────────┘
               ▼
  evidence, approvals, resource release, replayable result
```

Cantilune supplies the shared system context: clear ownership, limited
authority, explicit collaboration protocols, safe parallel work, controlled
handoff, and feedback that changes the graph visibly.

## Architecture in one page

```text
intent + goals + roles + policy
              │
              ▼
typed collaboration graph ── reconfiguration events ── certificates + replay
              │
              ├── dependency / scheduling view
              ├── resource + authorization view
              ├── session + delegation view
              └── feedback + evidence view
              │
              ▼
agents · coding agents · tools · MCP/A2A services · people · external systems
```

The planned public capability family is deliberately separable:

| Capability | Concern |
|---|---|
| **Notation** | Shared references, commands, observations, events, schemas, and provider boundaries |
| **Libretto** | Intent, goals, plans, dependencies, and completion criteria |
| **Cast** | Roles, responsibility, custody, and ownership |
| **Baton** | Delegation, acceptance, rejection, handoff, and control transfer |
| **Cue** | Routing, gates, retries, stop conditions, and next-step selection |
| **Chorus** | Sequential, parallel, hierarchical, voting, merge, and convergence structures |
| **Reprise** | Evidence-driven revision, rerouting, escalation, and improvement |

No package release is available yet. The family describes the intended public
decomposition, not an installation promise.

## Formal boundary and current status

The generic core theory and one substantive reference execution package are
kernel-checked and classified as **`proved / review-pending`**. This is a
formal-proof milestone, not a runtime release or a governance approval.

| Verification fact | Current record |
|---|---|
| Immutable theory chain | Source S `59a1a6885ef6a2774b2731f487f83228e67d15dc` → evidence E `ed26cb74c4425b0d3025521f939695fd3fb8dee5` → pointer P `0382b74074c546abe1bf3f37f3c03d7e4d2c3611` |
| Lean source and kernel audit | 565 maintained source files; 1,624 audited declarations; 18/18 central proof obligations recorded as `proved` |
| Build artifacts | `formal/.lake` was deleted after verification, is ignored, and is not tracked; a fresh checkout can reconstruct it with the pinned Lean toolchain |
| Remote review | [PR #1](https://github.com/Moonweave-AI/cantilune/pull/1) targets `main`; the live workflow badge and PR checks are authoritative, and no passing result is claimed until the current PR-head run succeeds |
| Governance | Independent QA-L4 review, FCP approval, and ADR acceptance remain pending |
| Published branch baseline | `9375a2edafd5a7d7574a6a3d527f806122292051` records repository artifact cleanup; this README is a subsequent documentation-only update |

The [proof-obligation manifest](formal/proof-obligations.json), [canonical
kernel/build evidence](docs/qa/evidence/2026-07-28-cantilune-theory-source-59a1a688.md),
and [theory-closure delivery report](docs/THEORY-CLOSURE-DELIVERY-2026-07-27.md)
are the review entry points.

The formal work is deliberately explicit about its scope and limits.

- The generic theorem is parameterized by rule families carrying projection,
  admission, resource, authorization, fairness, and replay certificates. This
  does **not** instantiate the eight planned production packages; their
  per-rule Product Conformance certificates are deferred to a separate phase.
- The selected D1-A effect model keeps symmetric Fubini by identifying
  divergence and deadlock at the denotational effect bottom; the native
  operational layer still distinguishes them.
- The project does **not** claim constructor-sensitive strong-bisimulation full
  abstraction for that unseparated effect, nor definability of every element of
  every \(\omega\)-CPO. Recorded no-go results delimit those claims.
- Proof status does not imply that the formal-semantics RFC or ADR has completed
  its human governance lifecycle.

Read the authoritative details in the [formal semantics
specification](docs/spec/formal-semantics.md), [projection consistency
RFC](docs/rfc/0002-projection-consistency.md), and [FMS research
boundary](docs/research/0021-fms-primary-source-boundary-2026-07-27.md).

## Interoperability

Cantilune is intended to interoperate with established boundaries rather than
replace them:

- [MCP](https://modelcontextprotocol.io/) for tools, resources, and external
  capabilities;
- [A2A](https://a2a-protocol.org/latest/specification/) for remote
  agent-to-agent interaction;
- [AG-UI](https://docs.ag-ui.com/introduction) for user-facing agent events;
- [OpenTelemetry](https://opentelemetry.io/docs/specs/semconv/) for telemetry.

These standards carry tools, transport, interfaces, or telemetry. Cantilune’s
role is to make the coordination relation between them explicit and evolvable.

## Explore, status, and contribution

There is no stable installation or quick-start command yet. Start with the
[formal semantics specification](docs/spec/formal-semantics.md), the
[projection consistency RFC](docs/rfc/0002-projection-consistency.md), and the
[Open-π/FMS compatibility boundary](docs/research/0022-open-pi-wiring-and-fms-compatibility-boundary-2026-07-27.md).

- **Status:** pre-alpha research and contract design; no stable API, schema,
  compatibility promise, or runtime release. The generic formal core is
  `proved / review-pending`; the eight production packages are deferred.
- **Owner:** Moonweave AI; current DRI and review status are recorded in the
  formal documents.
- **Contributing:** changes to contracts, protocols, schemas, or state
  semantics require the applicable RFC/ADR path. Contributions must state their
  evidence and scope.
- **Comparison review:** framework capabilities evolve quickly; re-check the
  linked official sources whenever this positioning changes.

## License

Cantilune is intended for an open-source release. The applicable license will
be declared in the repository's `LICENSE` file before the first public code
release.

---

<div align="center">
  <p>
    <strong>Moonweave defines how meanings are woven.<br>Cantilune decides how actions move together.</strong>
  </p>
  <p>
    <img src="./assets/logo.png" alt="Cantilune logo" width="140">
  </p>
  <p><sub>Moonweave AI · Kaguya Moonweave Project</sub></p>
</div>
