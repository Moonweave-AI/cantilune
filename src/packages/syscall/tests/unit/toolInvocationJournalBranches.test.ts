/**
 * Branch coverage for the ADR-0016 invocation-journal helpers (strictIntent /
 * readIntent / intentRef) and the useTool reconcile / reuseCompletedOutput
 * fall-through paths.
 *
 * The pure validators (strictIntent, intentRef) are unit-tested directly — this
 * is the only way to reach their defensive rejection branches, because a
 * content-addressed store never returns a blob whose bytes hash to a ref other
 * than the one asked for, so several of those branches are unreachable through
 * the public useTool entry point with an honest store. readIntent's metadata /
 * hash / JSON rejection arms are exercised through a fake SyscallContentStore
 * that returns crafted malformed blobs at the computed ref.
 */
import { describe, it, expect } from "vitest";
import { contentRef } from "@cantilune/core";
import { createMemoryContentStore } from "@cantilune/content/memory";
import { createContentHasher } from "@cantilune/content";
import type { ContentRef } from "@cantilune/core";
import { createSyscall } from "../../src/createSyscall.js";
import {
  intentRef,
  readIntent,
  strictIntent,
  useTool,
} from "../../src/act.js";
import type {
  SyscallRuntime,
  SyscallPrincipal,
  ToolExecutor,
  ToolInvocationKey,
  SyscallContentStore,
} from "../../src/syscall.js";

function principal(): SyscallPrincipal {
  return { actorId: "planner", kind: "agent" };
}

function runtime(): SyscallRuntime {
  return {
    getHead: () => undefined,
    observe: () => ({ ok: true }),
    changes: () => [],
    proposeAndCommit: () => ({ ok: true, newHeadRef: "s" }),
  };
}

const validKey: ToolInvocationKey = {
  principal: { actorId: "planner", kind: "agent" },
  toolName: "write_file",
  argumentsDigest: "sha256:0000000000000000000000000000000000000000000000000000000000000000",
  originalToolCallId: "call-1",
};

describe("strictIntent rejection arms", () => {
  it("rejects null / non-object / array roots", () => {
    expect(strictIntent(null)).toBeUndefined();
    expect(strictIntent(42)).toBeUndefined();
    expect(strictIntent("x")).toBeUndefined();
    expect(strictIntent([])).toBeUndefined();
  });

  it("rejects a record missing expected keys (wrong key set)", () => {
    const almost = {
      kind: "cantilune.external-tool-invocation-intent",
      version: 1,
      principal: { actorId: "planner", kind: "agent" },
      toolName: "write_file",
      originalToolCallId: "call-1",
      argumentsDigest: "sha256:0000000000000000000000000000000000000000000000000000000000000000",
      status: "dispatched",
      // missing: nothing — this is the complete dispatched set → accepted
    };
    expect(strictIntent(almost)).not.toBeUndefined();
    // Remove one field → rejected
    const { toolName, ...withoutToolName } = almost;
    expect(strictIntent(withoutToolName)).toBeUndefined();
    // Add an unexpected field → rejected (exact keys)
    const extra = { ...almost, surprise: 1 };
    expect(strictIntent(extra)).toBeUndefined();
    void toolName;
  });

  it("accepts a completed entry that omits outputRef (output since lost)", () => {
    // strictIntent keys on whether outputRef is PRESENT, not on status. A
    // completed entry whose output blob is gone still validates as a 7-field
    // intent (the findable dispatched entry is what drives recovery, not this).
    const completedNoOutput = {
      kind: "cantilune.external-tool-invocation-intent",
      version: 1,
      principal: { actorId: "planner", kind: "agent" },
      toolName: "write_file",
      originalToolCallId: "call-1",
      argumentsDigest: "sha256:0000000000000000000000000000000000000000000000000000000000000000",
      status: "completed",
    };
    const parsed = strictIntent(completedNoOutput);
    expect(parsed).not.toBeUndefined();
    expect(parsed?.status).toBe("completed");
    expect(parsed?.outputRef).toBeUndefined();
  });

  it("rejects a non-object / array principal", () => {
    const base = {
      kind: "cantilune.external-tool-invocation-intent",
      version: 1,
      principal: null,
      toolName: "write_file",
      originalToolCallId: "call-1",
      argumentsDigest: "sha256:0000000000000000000000000000000000000000000000000000000000000000",
      status: "dispatched",
    };
    expect(strictIntent(base)).toBeUndefined();
    expect(strictIntent({ ...base, principal: [] })).toBeUndefined();
    expect(strictIntent({ ...base, principal: "planner" })).toBeUndefined();
  });

  it("rejects a principal with the wrong key set", () => {
    const base = {
      kind: "cantilune.external-tool-invocation-intent",
      version: 1,
      principal: { actorId: "planner" },
      toolName: "write_file",
      originalToolCallId: "call-1",
      argumentsDigest: "sha256:0000000000000000000000000000000000000000000000000000000000000000",
      status: "dispatched",
    };
    expect(strictIntent(base)).toBeUndefined();
    expect(strictIntent({ ...base, principal: { actorId: "p", kind: "k", extra: 1 } })).toBeUndefined();
  });

  it("rejects wrong-typed scalar fields", () => {
    const good = {
      kind: "cantilune.external-tool-invocation-intent",
      version: 1,
      principal: { actorId: "planner", kind: "agent" },
      toolName: "write_file",
      originalToolCallId: "call-1",
      argumentsDigest: "sha256:0000000000000000000000000000000000000000000000000000000000000000",
      status: "dispatched",
    };
    // wrong kind
    expect(strictIntent({ ...good, kind: "other" })).toBeUndefined();
    // wrong version
    expect(strictIntent({ ...good, version: 2 })).toBeUndefined();
    // wrong status
    expect(strictIntent({ ...good, status: "queued" })).toBeUndefined();
    // non-string actorId
    expect(strictIntent({ ...good, principal: { actorId: 5, kind: "agent" } })).toBeUndefined();
    // non-string kind
    expect(strictIntent({ ...good, principal: { actorId: "p", kind: 3 } })).toBeUndefined();
    // non-string toolName
    expect(strictIntent({ ...good, toolName: 5 })).toBeUndefined();
    // non-string originalToolCallId
    expect(strictIntent({ ...good, originalToolCallId: 5 })).toBeUndefined();
    // non-string argumentsDigest
    expect(strictIntent({ ...good, argumentsDigest: 5 })).toBeUndefined();
  });

  it("rejects a completed entry whose outputRef is not a string", () => {
    const completed = {
      kind: "cantilune.external-tool-invocation-intent",
      version: 1,
      principal: { actorId: "planner", kind: "agent" },
      toolName: "write_file",
      originalToolCallId: "call-1",
      argumentsDigest: "sha256:0000000000000000000000000000000000000000000000000000000000000000",
      status: "completed",
      outputRef: 99,
    };
    expect(strictIntent(completed)).toBeUndefined();
  });

  it("accepts a well-formed completed entry with outputRef", () => {
    const completed = {
      kind: "cantilune.external-tool-invocation-intent",
      version: 1,
      principal: { actorId: "planner", kind: "agent" },
      toolName: "write_file",
      originalToolCallId: "call-1",
      argumentsDigest: "sha256:0000000000000000000000000000000000000000000000000000000000000000",
      status: "completed",
      outputRef: "sha256:abc",
    };
    const parsed = strictIntent(completed);
    expect(parsed).not.toBeUndefined();
    expect(parsed?.status).toBe("completed");
    expect(parsed?.outputRef).toBe("sha256:abc");
  });
});

describe("readIntent defensive arms (via fake store)", () => {
  /** Build a minimal fake SyscallContentStore that returns a crafted blob. */
  function fakeStore(
    blob:
      | {
          ref: ContentRef;
          bytes: Uint8Array;
          metadata: { size: number; mimeType: string; createdAt: string; createdBy: string | undefined };
        }
      | undefined,
  ): SyscallContentStore {
    return {
      async put(_content, _opts) {
        return contentRef("sha256:0000000000000000000000000000000000000000000000000000000000000000") as ContentRef;
      },
      async get(_ref) {
        return blob;
      },
      async exists() {
        return blob !== undefined;
      },
    };
  }

  /** Craft a blob with correct mime/creator/size and a given payload. */
  function intentBlob(bytes: Uint8Array, opts?: { mimeType?: string; createdBy?: string; size?: number }) {
    return {
      ref: contentRef("sha256:0000000000000000000000000000000000000000000000000000000000000000") as ContentRef,
      bytes,
      metadata: {
        size: opts?.size ?? bytes.length,
        mimeType: opts?.mimeType ?? "application/vnd.cantilune.tool-invocation-intent+json",
        createdAt: "2026-08-14T00:00:00.000Z",
        createdBy: opts?.createdBy ?? "cantilune:tool-invocation-intent:v1",
      },
    };
  }

  it("returns undefined when contentStore.get throws", async () => {
    const throwing: SyscallContentStore = {
      async put() {
        return contentRef("sha256:0000000000000000000000000000000000000000000000000000000000000000") as ContentRef;
      },
      async get() {
        throw new Error("transient");
      },
      async exists() {
        return false;
      },
    };
    expect(await readIntent(throwing, contentRef("sha256:0000000000000000000000000000000000000000000000000000000000000000") as ContentRef)).toBeUndefined();
  });

  it("returns undefined when the blob is absent", async () => {
    expect(await readIntent(fakeStore(undefined), contentRef("sha256:0000000000000000000000000000000000000000000000000000000000000000") as ContentRef)).toBeUndefined();
  });

  it("returns undefined when the metadata mime / creator is wrong", async () => {
    const ref = intentRef(validKey, "dispatched");
    const bytes = new TextEncoder().encode("{}");
    const bad = intentBlob(bytes, { mimeType: "text/plain", createdBy: "someone-else" });
    expect(await readIntent(fakeStore(bad), ref)).toBeUndefined();
  });

  it("returns undefined when the recorded size disagrees with the bytes", async () => {
    const ref = intentRef(validKey, "dispatched");
    const bytes = new TextEncoder().encode("{}");
    const bad = intentBlob(bytes, { size: bytes.length + 1 });
    expect(await readIntent(fakeStore(bad), ref)).toBeUndefined();
  });

  it("returns undefined when the blob hash does not match the ref", async () => {
    // Correct mime/creator/size, but bytes that hash to a DIFFERENT ref.
    const wrongRef = contentRef("sha256:0000000000000000000000000000000000000000000000000000000000000000") as ContentRef;
    const bytes = new TextEncoder().encode('{"x":1}');
    const blob = intentBlob(bytes);
    expect(await readIntent(fakeStore(blob), wrongRef)).toBeUndefined();
  });

  it("returns undefined when the bytes are not valid JSON", async () => {
    // Plant bytes that hash to the ref we pass. We compute the ref from the
    // actual bytes so the hash check passes, then break the JSON.
    const bytes = new TextEncoder().encode("{ not json");
    const ref = createContentHasher()(bytes);
    const blob = intentBlob(bytes);
    expect(await readIntent(fakeStore(blob), ref)).toBeUndefined();
  });

  it("returns undefined when the parsed JSON fails strictIntent", async () => {
    // Valid JSON, correct mime/creator, hash matches — but content fails strict
    // validation (wrong kind).
    const payload = JSON.stringify({
      argumentsDigest: "sha256:0000000000000000000000000000000000000000000000000000000000000000",
      kind: "wrong.kind",
      originalToolCallId: "call-1",
      principal: { actorId: "planner", kind: "agent" },
      status: "dispatched",
      toolName: "write_file",
      version: 1,
    });
    const bytes = new TextEncoder().encode(payload);
    const ref = createContentHasher()(bytes);
    const blob = intentBlob(bytes);
    expect(await readIntent(fakeStore(blob), ref)).toBeUndefined();
  });

  it("returns the parsed intent when the blob is fully valid", async () => {
    const intentJson = JSON.stringify({
      argumentsDigest: "sha256:0000000000000000000000000000000000000000000000000000000000000000",
      kind: "cantilune.external-tool-invocation-intent",
      originalToolCallId: "call-1",
      principal: { actorId: "planner", kind: "agent" },
      status: "dispatched",
      toolName: "write_file",
      version: 1,
    });
    const bytes = new TextEncoder().encode(intentJson);
    const ref = createContentHasher()(bytes);
    const blob = intentBlob(bytes);
    const parsed = await readIntent(fakeStore(blob), ref);
    expect(parsed?.status).toBe("dispatched");
    expect(parsed?.toolName).toBe("write_file");
  });
});

describe("intentRef determinism", () => {
  it("is stable for the same key and differs by status", () => {
    const d = intentRef(validKey, "dispatched");
    const c = intentRef(validKey, "completed", contentRef("sha256:abc") as ContentRef);
    expect(String(d)).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(d).not.toEqual(c);
    // Same inputs → same ref (deterministic, no randomness).
    expect(intentRef(validKey, "dispatched")).toEqual(d);
  });
});

describe("useTool recovery semantics (ADR-0016 §4, corrected)", () => {
  it("idempotent completed clean-restart: dispatched entry + reconcile(known) reuses the prior output", async () => {
    // A prior run dispatched and completed (side effect landed, output durable).
    // The `completed` journal entry is NOT findable from the key (it carries
    // the outputRef, so its content-addressed ref depends on the output). The
    // findable artifact is the `dispatched` entry, so on restart the run
    // reconciles rather than re-executing.
    const store = createMemoryContentStore();
    let executeCalls = 0;
    let reconcileCalls = 0;
    const exec = {
      tier: "idempotent" as const,
      async execute() {
        executeCalls++;
        return { ok: true, output: "first-output" };
      },
      async listTools() {
        return [];
      },
      async reconcile() {
        reconcileCalls++;
        return { status: "known", output: "first-output" };
      },
    } as unknown as ToolExecutor;
    const syscall = createSyscall({
      runtime: runtime(),
      contentStore: store,
      principal: principal(),
      schemaProvider: { getTemplates: () => [] },
      toolExecutor: exec,
    });
    const first = await syscall.useTool({ callId: "clean-1", toolName: "write_file", args: { path: "/z" } });
    expect(first.ok).toBe(true);
    expect(executeCalls).toBe(1);
    // Second identical call: dispatched entry found → reconcile(known) → reuse.
    const restart = await syscall.useTool({ callId: "clean-1", toolName: "write_file", args: { path: "/z" } });
    expect(restart.ok).toBe(true);
    expect(restart.output).toBe("first-output");
    expect(executeCalls).toBe(1); // NOT re-executed
    expect(reconcileCalls).toBe(1); // reconciled instead
  });

  it("non-idempotent completed clean-restart: dispatched entry → ambiguous (fail safe)", async () => {
    // A non-idempotent tool completed in a prior run. The findable `dispatched`
    // entry cannot prove the side effect landed (no findable completed entry),
    // so the run fails safe with `ambiguous` rather than re-dispatching. The
    // operator resolves via the durable receipt (retryToolObservation) out of
    // the audit tail. This is the honest recovery for Tier 2.
    const store = createMemoryContentStore();
    let executeCalls = 0;
    const exec = {
      tier: "non-idempotent" as const,
      async execute() {
        executeCalls++;
        return { ok: true, output: "side-effected" };
      },
      async listTools() {
        return [];
      },
    } as unknown as ToolExecutor;
    const syscall = createSyscall({
      runtime: runtime(),
      contentStore: store,
      principal: principal(),
      schemaProvider: { getTemplates: () => [] },
      toolExecutor: exec,
    });
    const first = await syscall.useTool({ callId: "ni-clean", toolName: "shell", args: { cmd: "rm" } });
    expect(first.ok).toBe(true);
    expect(executeCalls).toBe(1);
    const restart = await syscall.useTool({ callId: "ni-clean", toolName: "shell", args: { cmd: "rm" } });
    expect(restart.ok).toBe(false);
    expect(restart.disposition).toBe("ambiguous");
    expect(executeCalls).toBe(1); // NOT re-dispatched
  });
});


describe("useTool tiered boundary branches", () => {
  it("non-idempotent default tier (no tier declared) executes once", async () => {
    const store = createMemoryContentStore();
    let executeCalls = 0;
    const exec = {
      async execute() {
        executeCalls++;
        return { ok: true, output: "default-tier" };
      },
      async listTools() {
        return [];
      },
    } as unknown as ToolExecutor;
    const syscall = createSyscall({
      runtime: runtime(),
      contentStore: store,
      principal: principal(),
      schemaProvider: { getTemplates: () => [] },
      toolExecutor: exec,
    });
    const result = await syscall.useTool({ callId: "default-tier", toolName: "shell", args: { cmd: "ls" } });
    expect(result.ok).toBe(true);
    expect(result.output).toBe("default-tier");
    expect(executeCalls).toBe(1);
  });

  it("executor returns ok:false (tool-level failure) → not observed", async () => {
    const store = createMemoryContentStore();
    let executeCalls = 0;
    const exec = {
      tier: "idempotent" as const,
      async execute() {
        executeCalls++;
        return { ok: false, output: "tool said no" };
      },
      async listTools() {
        return [];
      },
      async reconcile() {
        return { status: "unknown" };
      },
    } as unknown as ToolExecutor;
    const syscall = createSyscall({
      runtime: runtime(),
      contentStore: store,
      principal: principal(),
      schemaProvider: { getTemplates: () => [] },
      toolExecutor: exec,
    });
    const result = await syscall.useTool({ callId: "tool-fail", toolName: "write_file", args: { path: "/f" } });
    expect(result.ok).toBe(false);
    expect(result.output).toBe("tool said no");
    expect(executeCalls).toBe(1);
  });

  it("idempotent with no reconcile declared → ambiguous", async () => {
    const store = createMemoryContentStore();
    let executeCalls = 0;
    const exec = {
      tier: "idempotent" as const,
      async execute() {
        executeCalls++;
        return { ok: true, output: "x" };
      },
      async listTools() {
        return [];
      },
      // reconcile intentionally omitted
    } as unknown as ToolExecutor;
    const syscall = createSyscall({
      runtime: runtime(),
      contentStore: store,
      principal: principal(),
      schemaProvider: { getTemplates: () => [] },
      toolExecutor: exec,
    });
    // First call: executes (no prior dispatched entry). Second identical call
    // sees the completed entry and reuses — so we need a crash between. Simulate
    // by planting a dispatched-only entry via a throw-on-execute first call.
    const crashExec = {
      tier: "idempotent" as const,
      async execute() {
        executeCalls++;
        throw new Error("killed mid-execute");
      },
      async listTools() {
        return [];
      },
    } as unknown as ToolExecutor;
    const crashSyscall = createSyscall({
      runtime: runtime(),
      contentStore: store,
      principal: principal(),
      schemaProvider: { getTemplates: () => [] },
      toolExecutor: crashExec,
    });
    await crashSyscall.useTool({ callId: "no-recon", toolName: "write_file", args: { path: "/x" } });
    // Now the dispatched entry exists, no completed, executor has no reconcile
    // → ambiguous on restart.
    const restart = createSyscall({
      runtime: runtime(),
      contentStore: store,
      principal: principal(),
      schemaProvider: { getTemplates: () => [] },
      toolExecutor: exec, // idempotent, NO reconcile
    });
    const retried = await restart.useTool({ callId: "no-recon", toolName: "write_file", args: { path: "/x" } });
    expect(retried.ok).toBe(false);
    expect(retried.disposition).toBe("ambiguous");
    expect(retried.output).toContain("no reconcile");
  });

  it("reconcile throws → ambiguous (not a re-dispatch)", async () => {
    const store = createMemoryContentStore();
    const crashExec = {
      tier: "idempotent" as const,
      async execute() {
        throw new Error("killed");
      },
      async listTools() {
        return [];
      },
    } as unknown as ToolExecutor;
    const crashSyscall = createSyscall({
      runtime: runtime(),
      contentStore: store,
      principal: principal(),
      schemaProvider: { getTemplates: () => [] },
      toolExecutor: crashExec,
    });
    await crashSyscall.useTool({ callId: "recon-throw", toolName: "write_file", args: { path: "/t" } });

    const throwingReconcile = {
      tier: "idempotent" as const,
      async execute() {
        return { ok: true, output: "should-not-happen" };
      },
      async listTools() {
        return [];
      },
      async reconcile() {
        throw new Error("reconcile backend down");
      },
    } as unknown as ToolExecutor;
    const restart = createSyscall({
      runtime: runtime(),
      contentStore: store,
      principal: principal(),
      schemaProvider: { getTemplates: () => [] },
      toolExecutor: throwingReconcile,
    });
    const retried = await restart.useTool({ callId: "recon-throw", toolName: "write_file", args: { path: "/t" } });
    expect(retried.ok).toBe(false);
    expect(retried.disposition).toBe("ambiguous");
    expect(retried.output).toContain("reconcile raised an error");
  });

  it("read tier re-dispatches after a prior dispatched entry", async () => {
    const store = createMemoryContentStore();
    let executeCalls = 0;
    const readExec = {
      tier: "read" as const,
      async execute() {
        executeCalls++;
        return { ok: true, output: "read-result" };
      },
      async listTools() {
        return [];
      },
    } as unknown as ToolExecutor;
    const syscall = createSyscall({
      runtime: runtime(),
      contentStore: store,
      principal: principal(),
      schemaProvider: { getTemplates: () => [] },
      toolExecutor: readExec,
    });
    // Two identical calls; read tier re-dispatches on the second call (the
    // dispatched entry is found, read tier has no side effect, so re-dispatch is
    // safe). Execute is called twice — read tier idempotency is by nature, not
    // by suppression.
    await syscall.useTool({ callId: "read-1", toolName: "read_file", args: { path: "/r" } });
    const second = await syscall.useTool({ callId: "read-1", toolName: "read_file", args: { path: "/r" } });
    expect(second.ok).toBe(true);
    expect(second.output).toBe("read-result");
    expect(executeCalls).toBe(2);
  });
});
