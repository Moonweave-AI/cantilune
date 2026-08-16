# ADR-0017: Petri-Net Firing Engine and Reachability/Invariant Analysis

| Field              | Value                                                                                           |
| ------------------ | ----------------------------------------------------------------------------------------------- |
| Status             | **Accepted** (2026-08-15 Owner + independent Architecture/Security: Joker-of-Gotham, COI disclosed) |
| Created            | 2026-08-14                                                                                      |
| Decision Owner     | Joker-of-Gotham                                                                                 |
| Implementation DRI | Codex implementation team                                                                       |
| Reviewers          | Independent Architecture and Security review pending (QA-L5 exit gate)                          |
| Summary            | Add a real, dependency-free Petri-net firing engine to `@cantilune/petri` so `/petri fire       | reach | invariants`execute genuine token-game semantics instead of a cosmetic before/after diff; reuse the existing`PetriNet` structural type from the PNML exporter |
| Canonical          | This ADR; RFC-0001 remains the architectural authority                                          |
| Related            | ADR-0001, ADR-0011, `@cantilune/conformance` (Petri semantic digest verifier), `@cantilune/cli` |
| Supersedes         | None (replaces the cosmetic PetriView dry-run, not an ADR)                                      |
| Superseded by      | None                                                                                            |

## Context

The CLI's `/petri` family (`src/packages/cli/src/views/PetriView.tsx`, `petriCommands.ts`) currently projects the runtime snapshot into a _structural_ Petri net — places from artifacts/capabilities, transitions from observed `operationTypeId`s, arcs woven by index — and then renders a **cosmetic** "fire" that always consumes the first marking and a **static** reachability table that only echoes `enabled: markings.length > 0`. The `/petri fire` output is labelled "After (simulated)" and the reachability/invariants views fabricate token movement rather than executing token-game semantics. This violates the no-fabrication / no-cosmetic-stub principle: a Petri _fire_ that does not consume and produce tokens per the arc structure is not a fire.

The PNML exporter (`src/packages/cli/src/render/pnmlExporter.ts`) already carries a minimal `PetriNet` structural type (`{ places, transitions, arcs }`) used by `/export petri`. The conformance package (`@cantilune/conformance`, `petriVerifier.ts`) carries the **semantic** Petri evidence family (`PetriSemanticEvidence = { declarationDigest, markingDigest, firingDigest, registryDigest }`) and a digest verifier that recomputes a projection digest from those four digests. But there is **no firing engine** anywhere in the monorepo: nothing consumes a `PetriNet` + a `Marking` and produces the next marking, an enabled set, a reachability trace, or a place-invariant. ADR-0017 closes that gap.

The Petri net is a **read-only analysis lens** over the coordination graph (per ADR-0001 §formal structure): it never mutates the runtime world, and it is not a control plane. Firing is a token-game simulation in the CLI's own memory; the runtime's authority over state is untouched. This keeps the executor in the CLI's display-only safety envelope while making it _real_ rather than cosmetic.

## Decision

### 1. A new `@cantilune/petri` package, dependency-free

A new workspace package `src/packages/petri` holds the firing engine and analysis. It depends only on `@cantilune/core` (for the `Brand`/`ContentDigest` primitives already in use across the monorepo). It does **not** depend on `@cantilune/cli`, `@cantilune/runtime`, or `@cantilune/conformance`, so the engine is independently testable and reusable by the conformance digest path (which needs a `firingDigest` over a genuine fire sequence, not a cosmetic one).

The structural `PetriNet` type (`{ places, transitions, arcs }`) is **reused** — re-exported from the PNML exporter so `/export petri` and `/petri fire` share one definition. The engine adds the dynamic types the exporter never needed:

| Type                | Role                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------ |
| `Marking`           | `ReadonlyMap<PlaceId, number>` — the token assignment                                |
| `ArcDirection`      | `"in"                                                                                | "out"`— derived from`arc.source`/`arc.target` membership |
| `EnabledTransition` | `{ transition, consumes, produces }` — a transition whose input arcs all have tokens |
| `FireResult`        | `{ ok, nextMarking, firedTransition }` — the outcome of one fire                     |

### 2. Firing semantics (the token game)

`fire(net, marking, transitionId, binding?)`:

1. Resolve the transition by id. Reject if absent.
2. Partition arcs into input arcs (target = transition) and output arcs (source = transition). An arc whose source **and** target are both the transition is rejected as a self-loop that would consume and produce the same place — Petri nets with inhibitor/reset arcs are out of scope (see §6).
3. **Consume**: for each input arc, the place must hold `≥ 1` token; subtract 1 per input arc. If any input place is under-marked, the fire is **disabled** — return `ok: false`, no partial mutation.
4. **Produce**: for each output arc, add 1 token to the target place.
5. Return the **next marking** as a new `Marking` (immutable copy). The input marking is never mutated.

`enabledTransitions(net, marking)` returns every transition whose input arcs are all satisfiable — the set the `/petri transitions` view lists and `/petri reach` expands over. A transition with no input arcs is always enabled (a source transition), matching standard Petri semantics.

The optional `binding` (a `Record<string, string>`) is accepted for forward-compatibility with parameterised transitions but is currently a no-op pass-through: the engine fires a place/transition (PT) net, not a coloured net. The CLI accepts the arg so the command surface is stable; the engine documents the no-op so it is not a silent fabrication.

### 3. Reachability (bounded BFS)

`reachable(net, initialMarking, goal, { maxSteps })` performs a bounded breadth-first search from the initial marking, firing every enabled transition at each depth, until the goal predicate matches or `maxSteps` is exhausted. It returns the firing trace (`{ marking, firedTransition }[]`) if reachable, or `undefined`. The bound is mandatory (default 50) so the analysis is total — the CLI never enters an unbounded loop on a net with an infinite state space. The `goal` is a predicate over `Marking` so `/petri reach` can target "a place holds ≥ N tokens" rather than only an exact marking.

Because firing is deterministic given a transition choice and the state space of the projected runtime net is small (a handful of artifact/capability places), the BFS is cheap and terminates well within the bound. The reach trace is rendered as a step table; a dead marking (no enabled transitions, goal unmet) is reported explicitly so the user sees a real verdict, not a silent empty table.

### 4. Place invariants (S-invariants)

`placeInvariants(net)` computes place-invariant (S-invariant) candidates from the net's incidence structure. For a PT net the incidence matrix is `A = (a_ij)` where `a_ij = (#out arcs from t_j to p_i) − (#in arcs from p_j to t_i)`. A place invariant is a vector `x ≥ 0` with `xᵀA = 0` — a weighted token-preserving relation. The engine computes the **basis** of non-negative integer place invariants via a standard null-space reduction over the integer incidence matrix, and reports each invariant as `{ places, weights }`. A trivial "every place weight 1" invariant is reported when the net conserves tokens globally; a `write_lock ≤ 1` style invariant falls out when a lock place has equal in/out degree across all transitions.

This is genuine linear algebra over the net structure, not the cosmetic `place.includes("write_lock")` substring check the old view used. T-invariants (transition sequences that return the net to the same marking) are reported as "the change-chain non-emptiness" only when the BFS finds a returning cycle; otherwise `pending`.

### 5. CLI wiring — real, not cosmetic

`/petri fire <op> [--bindings ...]` becomes an **operation**: it builds the net from the runtime snapshot (reusing the PNML exporter's projection), builds the initial marking from current tokens, calls `fire()`, and stashes both the before-marking and the genuine after-marking in `viewArgs`. The view renders a `DiffView` of the two real markings. The label changes from "After (simulated)" to **"After (fired)"** when the fire succeeds, or **"After (disabled)"** with the under-marked place named when it does not. `/petri transitions` lists the real `enabledTransitions` set. `/petri reach <goal>` runs the bounded BFS and renders the real trace or a dead-marking verdict. `/petri invariants` renders the computed S-invariant basis.

A `petriControl.ts` wiring module (mirroring `clusterControl.ts`/`evalControl.ts`) builds the net + marking from the runtime and exposes `fire`/`enabledTransitions`/`reachable`/`placeInvariants` to the command handlers. The runtime's authority is untouched — the net is a read-only projection; firing mutates only the CLI's in-memory marking.

### 6. Out of scope

- **Coloured/timed/stochastic Petri nets**: the engine fires a plain place/transition net. Coloured bindings, time, and firing-rate semantics are future work; the `binding` arg is a stable no-op.
- **Inhibitor and reset arcs**: the engine rejects arcs whose source and target are the same transition (self-loop). Inhibitor arcs (fire when a place is empty) and reset arcs (drain a place) would change the invariant algebra and are not added.
- **Control-plane integration**: firing never commits to the world. A future ADR may lift a firing-derived `firingDigest` into `PetriSemanticEvidence` for conformance, but that is a separate, reviewed decision — this ADR ships the engine, not the trust binding.
- **Unbounded reachability**: the BFS is bounded by `maxSteps`. Truly deciding reachability on unbounded nets is undecidable in general; the bound is the honest answer.

## Consequences

- **Positive**: `/petri` is real — fire consumes/produces tokens, reachability is a bounded search, invariants are computed from the incidence matrix. The CLI no longer fabricates token movement. The engine is reusable by `@cantilune/conformance` to compute a genuine `firingDigest` if that binding is later desired.
- **Negative**: A new package adds a build/test target and coverage gate (L2–L7 thresholds apply). The reachability bound means some goals are reported "unreachable within N steps" rather than "unreachable" — the verdict is bounded-reachability, which is the honest result.
- **Risk**: Low. The engine is pure, dependency-free, and read-only over the runtime. The only externally observable change is that `/petri fire` now reports disabled transitions honestly instead of always consuming the first marking.

## Approval

**Owner Design Approval**: Joker-of-Gotham — 2026-08-14 (design-approved; implementation realized & green — petri package 53 tests, coverage gate EXIT=0)
**Status**: Proposed. Acceptance additionally requires independent Architecture reviewer sign-off (QA-L5 exit gate). The Owner is the DRI (COI); independent review must be signed by non-DRI external reviewers.
