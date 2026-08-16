# @cantilune/boot

> Minimal bootstrap: boot Cantilune OS + connect any LLM + run the agent loop.

## What it does

```
User instruction (natural language)
  │
  ▼
bootCantilune(deps) → CantilunOS
  │
  ▼
os.run("Build feature X", { signal, onProgress })
  │
  ▼
Agent Loop: while (!done) {
  perceive(world) → give LLM context
  LLM outputs tool_calls
  dispatch: done / read_content / write_content / syscall.act()
  sliding window trims old messages
  check abort / max_turns / max_time
}
```

## Key design

- **No orchestration logic**: The loop is `while (!done) { ask LLM; do what it says }`. All intelligence is in the LLM.
- **All governance in runtime**: Every operation goes through admission. Illegal ops are rejected with explanations the LLM can read and recover from.
- **"done" is the only completion signal**: `finishReason: "stop"` does NOT mean task done — LLM may just be thinking. Only the explicit `done` tool call terminates the loop successfully.
- **Provider agnostic**: Any LLM with function calling works — implement `LlmAdapter` interface.
- **Truthful completion**: every content, external, and coordination tool call is tallied. `done`
  is rejected when a failed tool/target has not subsequently succeeded, and its `tool_end.ok`
  matches the final `RunResult.ok`.
- **Bounded orchestration**: AbortSignal and `maxTimeMs` stop admission into new turns and locally
  bound an LLM wait; `maxTurns` and the strict context budget prevent unbounded model iteration.
  An already-running external side effect cannot yet be safely preempted (ADR-0012 SS-03).
- **Typed closure**: phase errors and closed `tool_start` / `tool_end` event pairs are preserved
  even when dispatch throws.
- **Dependency injection**: `bootCantilune()` accepts a pre-built runtime + content store.

## Private conversation history

Each booted OS owns a private `AgentLoopHistory` and reuses it across calls to `os.run()`. After
ADR-0021, completed assistant+tool groups are also committed into
`CollaborationSnapshot.transcripts` (same Namespace full text; cross-Namespace summary). Seed a
resumed CLI transcript with `BootConfig.initialMessages`; incomplete or orphaned tool protocol is
discarded and cannot be used as evidence that work ran.

Low-level callers can own the same state explicitly:

```typescript
import { createAgentLoopHistory, runAgentLoop } from "@cantilune/boot";

const history = createAgentLoopHistory(previousTranscript);
await runAgentLoop(syscall, llm, "first goal", detector, config, { history });
await runAgentLoop(syscall, llm, "follow-up goal", detector, config, { history });
```

`maxContextMessages` is a hard per-request message limit, including the current world context. The
loop retains the current run's initial user goal, emits at most one compaction marker, and never
splits an assistant message containing `toolCalls` from its ordered tool results. With a one-message
budget, only the initial goal is sent.

Every loop-produced result includes both tallies:

- `operations`: backward-compatible coordination-only `{ committed, rejected }` counts.
- `toolCalls`: all calls, including content/external tools and `done`, as
  `{ total, succeeded, failed, unresolved }`.

Thrown `perceive`, `availableActions`, LLM, or tool-dispatch failures return `ok: false` with a
structured `RunResult.error` instead of rejecting the run promise.

## Quick start (development/testing)

```typescript
import { bootMemoryOS } from "@cantilune/boot";

// WARNING: bootMemoryOS has NO admission governance — for testing only
const os = bootMemoryOS(myLlmAdapter, { principalId: "dev-agent" });
const result = await os.run("Add OAuth to the login page");
console.log(result.summary, `(${result.turns} turns, ${result.elapsedMs}ms)`);
```

## Production usage

`bootFileOS(adapter, { storagePath, llm })` is the production factory: file
content plus `resolveProductionDurable` (file / Postgres HA / official etcd).

```typescript
import { bootCantilune } from "@cantilune/boot";
import { buildMyRuntime } from "./my-runtime-setup";
import { createFileContentStore } from "@cantilune/content/file";

const os = bootCantilune({
  runtime: buildMyRuntime(), // Full @cantilune/runtime with admission
  contentStore: createFileContentStore(".cantilune/content"),
  llmAdapter: myOpenAIAdapter,
  config: {
    durable: "file",
    contentStore: "file",
    llm: { provider: "openai", model: "gpt-4o", apiKey: () => process.env.OPENAI_API_KEY! },
    maxTurns: 50,
    maxTimeMs: 300_000,
    maxContextMessages: 30,
  },
});

const controller = new AbortController();
const result = await os.run("Implement user registration", {
  signal: controller.signal,
  onProgress: ({ turn, elapsedMs, lastAction }) => {
    console.log(`Turn ${turn} (${elapsedMs}ms): ${lastAction}`);
  },
});

if (!result.ok) {
  console.error(`Failed: ${result.terminationReason} — ${result.summary}`);
}
```

## Implementing LlmAdapter

```typescript
import type { LlmAdapter, LlmChatRequest, LlmChatResponse } from "@cantilune/boot";

const myAdapter: LlmAdapter = {
  async chat(request: LlmChatRequest): Promise<LlmChatResponse> {
    // Call your LLM provider API
    // Map provider response → { text, toolCalls, finishReason }
    // Throw on unrecoverable errors (network, auth)
    return { text, toolCalls, finishReason };
  },
};
```

## Connecting to @cantilune/runtime

To use real admission governance, construct a full runtime:

```typescript
import { createCoordinationRuntime, createDefaultSchema } from "@cantilune/runtime";
import { runtimeDependenciesWithStaticSchema } from "@cantilune/runtime";
// ... (see @cantilune/runtime tests/support/buildTestRuntime.ts for full setup)

const runtime = createCoordinationRuntime(
  runtimeDependenciesWithStaticSchema({
    durable: myDurableStore,
    clock: systemClock(),
    idGen: uuidIdGenerator(),
    schema: createDefaultSchema(),
    handlers: createDefaultHandlers(),
    locks: new MemoryResourceLockTable(),
    policy: myPolicyEvaluator, // admission rules here
  }),
);
```

## Optional comms HMAC identity

Production `createAgentCommsServices` calls `createCommsServices`, which uses
ActorId pinning unless operator key material is present: env
`CANTILUNE_COMMS_HMAC_KEY`, or `{storagePath}/comms/{agentId}/hmac.key`.
When a key exists, HMAC-SHA256 is required; the key is never hardcoded.

## Environment

Node.js only.
