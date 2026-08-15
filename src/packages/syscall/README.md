# @cantilune/syscall

> LLM ↔ Cantilune OS system call layer. Pure translation, zero strategy.

## What it does

```
LLM (tool_call JSON) ──→ syscall.act() ──→ runtime.proposeAndCommit()
LLM (reads context)  ←── syscall.perceive() ←── runtime.getHead()
```

Six system calls:

| syscall            | direction           | what                                                    |
| ------------------ | ------------------- | ------------------------------------------------------- |
| `perceive`         | OS → LLM            | Serialize snapshot + observations → structured text     |
| `act`              | LLM → OS            | Parse tool_call → CoordinationIntent → admit/commit     |
| `readContent`      | OS → LLM            | Resolve ContentRef → text                               |
| `writeContent`     | LLM → OS            | Store text → ContentRef                                 |
| `useTool`          | LLM → external → OS | Invoke MCP tool → store result → observe                |
| `availableActions` | OS → LLM            | Generate function calling schema from runtime templates |

## Key design decisions

- **Zero policy**: syscall does no decision-making. LLM says do X, syscall translates X to runtime calls. Runtime admission blocks illegal operations.
- **Dynamic schema**: Available operations are derived from `OperationSchemaProvider` (which reads from runtime's active schema), not hardcoded.
- **Content/evidence separation**: templates declare ordered `contentRefInputs`; `act` validates stored `sha256:` refs and forwards them as `CoordinationIntent.inputContentRefs`, never as entity bindings or external evidence.
- **Discoverable content**: perceptions print each artifact `contentRef` and observation `payloadRef` with the exact `read_content` tool name.
- **All async**: Every method returns a Promise for forward-compatibility.
- **Observe check**: `useTool` checks `runtime.observe()` return and reports warnings.

## Usage

```typescript
import { createSyscall, createStaticSchemaProvider } from "@cantilune/syscall";

const syscall = createSyscall({
  runtime,
  contentStore,
  principal: { actorId: "my-agent", kind: "agent" },
  schemaProvider: createStaticSchemaProvider(templates),
  toolExecutor, // optional
});

const perception = await syscall.perceive();
const contentRef = await syscall.writeContent("Task body");
const result = await syscall.act({
  operation: "introduce_artifact",
  args: { task: "t1", from: "my-agent", contentRef },
});
```

## Environment

Node.js only (inherits from runtime + content).
