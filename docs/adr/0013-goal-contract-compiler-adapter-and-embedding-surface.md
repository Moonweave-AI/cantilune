# ADR-0013: Goal-Contract Compiler Adapter Separation and Embedding Surface

| Field              | Value                                                                                                             |
| ------------------ | ----------------------------------------------------------------------------------------------------------------- |
| Status             | **Accepted** (2026-08-15 Owner + independent Architecture/Security: Joker-of-Gotham, COI disclosed)               |
| Created            | 2026-08-14                                                                                                        |
| Updated            | 2026-08-14                                                                                                        |
| Last reviewed      | 2026-08-14                                                                                                        |
| Decision Owner     | Joker-of-Gotham                                                                                                   |
| Implementation DRI | Codex implementation team                                                                                         |
| Reviewers          | Joker-of-Gotham (DRI interim Architecture); Security review pending                                               |
| Summary            | Give goal-contract compilation a dedicated LLM adapter; make the embedding adapter an optional, degradable sensor |
| Canonical          | This ADR; RFC-0001 remains the architectural authority                                                            |
| Related            | RFC-0001, ADR-0002, ADR-0012, `@cantilune/boot` (termination controller), `@cantilune/adapter`                    |
| Supersedes         | None                                                                                                              |
| Superseded by      | None                                                                                                              |

## Context

Phase B of the Goal Contract Math Termination Controller (P0) landed a zero-training,
math-first controller that replaces LLM-owned termination. The controller evaluates the
complete state $x_t = (S_t, A_t, E_t, T_{\le t}, R_t)$ and drives the agent loop through a
six-state machine (DONE / CONTINUE / VERIFY / ASK_USER / REPLAN / STALLED) with lexicographic
precedence. The LLM is demoted to three non-authoritative roles: goal decomposition, candidate
action generation, and decision explanation. It never owns the "are we done?" verdict.

Two interface seams in that controller need an explicit architectural record, because each
has a non-obvious correctness or billing consequence that a future maintainer could quietly
regress:

1. **Goal-contract compilation reuses an LLM call.** `GoalContractCompiler.compileContract`
   drafts acceptance criteria once per run by sending one structured prompt to an LLM. The
   first implementation wired the compiler to the same `LlmAdapter` that drives the agent
   loop. That sharing has two failure modes:
   - In **tests**, every scripted LLM response is a positionally-indexed sequence. The
     compiler consumes the first response before the loop's first turn, shifting every
     subsequent response by one. Tests that asserted "turn N sees response N" silently
     broke, and the breakage looked like a controller-logic failure rather than an
     adapter-sharing failure.
   - In **production**, the compiler adds one billed LLM call per run _to the loop's own
     latency budget_, because it reuses the loop's adapter and therefore its connection /
     rate-limit / billing envelope. A contract draft and an agent turn are different work
     with different cost/latency profiles; coupling them makes the contract draft
     non-substitutable (you cannot point it at a smaller/faster model without also
     downgrading the loop).

2. **The semantic residual engine needs embeddings, but must never depend on them.** The
   engine solves a constrained optimal-transport match between goal criteria and
   evidence/artifact text. With an `EmbeddingAdapter` it uses cosine similarity; without one
   it degrades to a Jaccard fallback. The controller's termination safety must not depend on
   an embedding round-trip succeeding, so the embedder is an _optional semantic sensor_, and
   the adapter package must expose a way to build one that degrades cleanly (`undefined` →
   Jaccard) rather than throwing when a provider has no embeddings surface.

The hard rule from the design contract — **no instruction-type preset / no hardcoding** —
governs both: the compiler must not branch on instruction text to pick a contract, and the
embedder must not branch on instruction text to pick a model. Both seams are type-driven,
not content-driven.

## Decision

### 1. The contract compiler gets a dedicated adapter (`BootConfig.contractLlm`)

- `BootConfig` gains an optional `contractLlm?: LlmAdapter` used **only** by
  `GoalContractCompiler.compileContract`. It is never forwarded to the agent loop.
- When `contractLlm` is **absent**, the controller compiles the default system contract
  **without any LLM call** — it never falls back to the loop's adapter. The default system
  contract is a single `no_infinite_loop` hard criterion for every instruction, compiled by
  `defaultSystemContract(instruction, frozenAt)` with `compiledBy: "system"`. There is no
  instruction-type preset: one path for every instruction.
- `AgentInstanceConfig` gains the same `contractLlm` field for cluster-owned instances, so a
  cluster can point contract drafting at a different model from the loop without the loop
  adapter knowing.
- The loop adapter and the contract adapter are deliberately distinct objects. Passing the
  same object to both is legal but re-introduces the test-shift and billing-coupling failure
  modes; the contract does not prevent it, the documentation discourages it.

### 2. The embedding adapter is an optional, degradable sensor (`createEmbedder`)

- `@cantilune/adapter` exports `createEmbedder(config, options?): EmbeddingAdapter | undefined`.
- For `openai-compatible` providers (and any custom `baseUrl` fallback) it returns a real
  embedder against `POST {baseUrl}/embeddings` (`{ model, input }` → `{ data: [{ embedding }] }`),
  reusing the chat adapter's key resolution and `fetchWithRetry` plumbing.
- For **native** providers with no uniform embeddings surface (anthropic, google, bedrock),
  it returns **`undefined`** — it does not throw, and it does not pick a vendor-specific
  embedding path. The boot runtime passes `undefined` through to the semantic residual
  engine, which degrades to Jaccard. Termination safety is therefore never contingent on an
  embedding round-trip.
- The embedder reuses the same `LlmConfig` (apiKey, baseUrl) as the chat adapter; it does
  **not** consume the loop's chat adapter and does not consume `contractLlm`.
- Dimensionality is discovered lazily from the first successful response and exposed via a
  getter; it reports `0` until then. The residual engine tolerates an approximate/zero
  dimension because it uses it only for capacity bookkeeping, not for correctness.

### 3. `EmbeddingAdapter` interface (boot) — unchanged

```ts
export interface EmbeddingAdapter {
  embed(texts: readonly string[]): Promise<readonly number[][]>;
  readonly dimensions: number;
}
```

`computeResidual(contract, state, embedder)` wraps the embed call in `try/catch`; any throw
falls through to Jaccard. This makes the embedder a pure optimization: it improves semantic
matching when available and is invisible when not.

## Consequences

- **Tests**: the contract adapter is `undefined` in every boot test, so the compiler issues
  no LLM call and scripted response sequences start at the loop's first turn. The repeated-
  reply / `stop != done` regression tests can assert the _math result_ (a single distinct
  plain-text reply satisfies the default contract → `VOC* = -λ·cost_text - μ·risk_text ≤ ε`
  → DONE) rather than a hardcoded stop heuristic.
- **Production**: a deployment can point `contractLlm` at a smaller/faster model to draft
  contracts cheaply without affecting the loop's model or latency. Omitting it is the
  zero-config default and still produces a safe (if minimal) contract.
- **Security**: the embedder reuses the chat adapter's key resolution — same secret, same
  header path, no new credential surface. `/embeddings` carries the same `Authorization`
  header as `/chat/completions`; no new secret is introduced.
- **Offline / native providers**: anthropic/google/bedrock runs use Jaccard residual, which
  is sufficient for the `no_infinite_loop` / `duplicate_reply` verifiers that directly remove
  the repeated-reply failure. Embeddings are an accuracy improvement for open-text criteria,
  not a gate.

## Alternatives considered

- **Share the loop adapter for compilation (rejected).** The original implementation. It
  shifts every scripted response sequence in tests and couples contract-draft billing to
  loop latency. The failure mode is silent and looks like a controller bug. Separating is
  strictly better.
- **Fall back to the loop adapter when `contractLlm` is absent (rejected).** This preserves
  the test-shift and billing-coupling failures under the default configuration — exactly the
  case most users run. The default must be the safe, no-LLM-call path.
- **Throw for native providers with no embeddings (rejected).** Termination safety would
  then depend on the caller catching. The contract requires the embedder to be a degradable
  sensor; `undefined` → Jaccard is the contract. Throwing would make a missing embeddings
  surface a hard runtime failure for anthropic/google/bedrock, which is unacceptable.
- **Per-vendor embedding paths inside `createEmbedder` (rejected).** Would couple the
  adapter package to each native vendor's embedding API and require instruction-agnostic
  model selection per vendor. The uniform `/embeddings` surface is an OpenAI-compatible
  property; native vendors are out of scope until a separate ADR proposes a shared surface.

## Open questions

- Whether to later allow a dedicated embedding provider/model distinct from the chat model
  (e.g., chat on anthropic, embeddings on an openai-compatible endpoint). Feasible today by
  constructing an `EmbeddingAdapter` manually and passing it to `BootConfig.embedder`; no
  config-plumbing change needed until users ask for it.
- Whether `contractLlm` should default to a pinned small model in the CLI config rather than
  remain opt-in. Deferred until Phase 5 CLI integration validates the wiring.

## Compliance

This decision is implemented and verified:

- `@cantilune/boot`: `BootConfig.contractLlm` and `AgentInstanceConfig.contractLlm` added;
  `bootCantilune` and `AgentInstance.executeLoop` pass `contractLlm` (not the loop adapter)
  to `createTerminationController`; absent → no LLM call → default system contract.
- `@cantilune/adapter`: `createEmbedder` + `createOpenAiEmbedder` added; 12 unit tests pass;
  native providers return `undefined`.
- `@cantilune/boot` tests: 341/341 pass with the contract adapter separated.
- No-instruction-hardcoding verified: `decide()`, the verifiers, and the VOC estimator never
  branch on instruction text; "plain-text → DONE" is an algebraic result, not a rule.
