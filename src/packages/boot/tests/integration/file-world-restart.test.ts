import { describe, expect, it, afterEach } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { artifactId, type ContentRef } from "@cantilune/core";
import { createFileContentStore } from "@cantilune/content/file";
import { createFileRuntimePersistence } from "@cantilune/runtime/memory";
import { bootFileOS } from "../../src/bootCantilune.js";
import type { LlmAdapter, LlmChatResponse, RunResult } from "../../src/types.js";
import { mockLlmConfig } from "../support/mockLlmConfig.js";

const dirs: string[] = [];

function storage(): string {
  const dir = mkdtempSync(join(tmpdir(), "cantilune-restart-"));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** Issues one coordination operation as `from`, then finishes. */
function coordinatingAdapter(from: string, operation: string): LlmAdapter {
  let called = false;
  return {
    async chat(): Promise<LlmChatResponse> {
      if (!called) {
        called = true;
        return {
          text: undefined,
          toolCalls: [{ id: "op", name: operation, arguments: { from } }],
          finishReason: "tool_calls",
        };
      }
      return {
        text: undefined,
        toolCalls: [{ id: "d", name: "done", arguments: { summary: "ok" } }],
        finishReason: "tool_calls",
      };
    },
  };
}

async function runOnce(
  storagePath: string,
  principalId: string,
  operation: string,
): Promise<{ readonly rejections: readonly string[]; readonly result: RunResult }> {
  const os = bootFileOS(coordinatingAdapter(principalId, operation), {
    llm: mockLlmConfig,
    storagePath,
    principalId,
    maxTurns: 3,
  });
  const rejections: string[] = [];
  const result = await os.run(`Perform ${operation}`, {
    onEvent: (event) => {
      if (event.kind === "tool_end" && !event.ok) rejections.push(event.output);
    },
  });
  await os.shutdown();
  return { rejections, result };
}

/** Reads the actor id from the system prompt instead of guessing a boot-* id. */
function selfCoordinatingAdapter(operation: string): LlmAdapter {
  let called = false;
  return {
    async chat(request): Promise<LlmChatResponse> {
      if (!called) {
        called = true;
        const prompt = request.messages.find((message) => message.role === "system")?.content ?? "";
        const from = /Your actor id is "([^"]+)"/.exec(prompt)?.[1];
        if (from === undefined) throw new Error("actor id missing from system prompt");
        return {
          text: undefined,
          toolCalls: [{ id: "op", name: operation, arguments: { from } }],
          finishReason: "tool_calls",
        };
      }
      return {
        text: undefined,
        toolCalls: [{ id: "d", name: "done", arguments: { summary: "ok" } }],
        finishReason: "tool_calls",
      };
    },
  };
}

function artifactWriterAdapter(from: string, task: string, body: string): LlmAdapter {
  let turn = 0;
  return {
    async chat(request): Promise<LlmChatResponse> {
      turn++;
      if (turn === 1) {
        return {
          text: undefined,
          toolCalls: [{ id: "write", name: "write_content", arguments: { content: body } }],
          finishReason: "tool_calls",
        };
      }
      if (turn === 2) {
        const writeResult = request.messages.find(
          (message) => message.role === "tool" && message.toolCallId === "write",
        );
        const contentRef = /ref=(sha256:[0-9a-f]{64})/u.exec(writeResult?.content ?? "")?.[1];
        if (contentRef === undefined) throw new Error("write_content did not return a ContentRef");
        return {
          text: undefined,
          toolCalls: [
            {
              id: "introduce",
              name: "introduce_artifact",
              arguments: { from, task, contentRef },
            },
          ],
          finishReason: "tool_calls",
        };
      }
      return {
        text: undefined,
        toolCalls: [{ id: "done", name: "done", arguments: { summary: "stored" } }],
        finishReason: "tool_calls",
      };
    },
  };
}

function artifactReaderAdapter(
  task: string,
  observed: { ref?: string; body?: string },
): LlmAdapter {
  let turn = 0;
  return {
    async chat(request): Promise<LlmChatResponse> {
      turn++;
      if (turn === 1) {
        const world = request.messages.map((message) => message.content).join("\n");
        const escapedTask = task.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
        const ref = new RegExp(`- ${escapedTask}[^\\n]*contentRef=(sha256:[0-9a-f]{64})`, "u").exec(
          world,
        )?.[1];
        if (ref === undefined) throw new Error("artifact ContentRef missing from perception");
        observed.ref = ref;
        return {
          text: undefined,
          toolCalls: [{ id: "read", name: "read_content", arguments: { ref } }],
          finishReason: "tool_calls",
        };
      }
      const readBody = request.messages.find(
        (message) => message.role === "tool" && message.toolCallId === "read",
      )?.content;
      if (readBody === undefined) throw new Error("read_content result missing");
      observed.body = readBody;
      return {
        text: undefined,
        toolCalls: [{ id: "done", name: "done", arguments: { summary: "read" } }],
        finishReason: "tool_calls",
      };
    },
  };
}

/**
 * `createFileRuntimePersistence` ignores its `initial` snapshot when a bundle
 * already exists on disk, which is correct — the stored world wins. The
 * consequence is that the boot participant is only ever registered in the
 * snapshot a *fresh* world starts from, so on every later launch the agent was
 * absent from the world it is acting in and every operation it issued was
 * refused.
 */
describe("file-backed world across restarts", () => {
  it("keeps the agent able to act in a world it resumes", async () => {
    const dir = storage();

    const first = await runOnce(dir, "restart-agent", "create_session");
    expect(first.rejections).toEqual([]);
    expect(first.result).toMatchObject({ ok: true, turns: 2 });
    expect(first.result.operations.committed).toBe(1);

    // Same identity, second boot instance, world now loaded from disk.
    const second = await runOnce(dir, "restart-agent", "create_session");
    expect(second.rejections).toEqual([]);
    expect(second.result).toMatchObject({ ok: true, turns: 2 });
    expect(second.result.operations.committed).toBe(1);
  });

  it("refuses an unregistered explicit identity before entering the loop", async () => {
    const dir = storage();

    await runOnce(dir, "first-agent", "create_session");

    expect(() =>
      bootFileOS(coordinatingAdapter("second-agent", "create_session"), {
        llm: mockLlmConfig,
        storagePath: dir,
        principalId: "second-agent",
        maxTurns: 3,
      }),
    ).toThrow(/not registered/);
  });

  it("persists and reuses the generated default principal", async () => {
    const dir = storage();

    const runDefault = async (): Promise<RunResult> => {
      const os = bootFileOS(selfCoordinatingAdapter("create_session"), {
        llm: mockLlmConfig,
        storagePath: dir,
        maxTurns: 3,
      });
      const result = await os.run("Open a session as yourself");
      await os.shutdown();
      return result;
    };

    const first = await runDefault();
    const identity = JSON.parse(readFileSync(join(dir, "principal.json"), "utf8")) as {
      actorId: string;
    };
    const second = await runDefault();

    expect(identity.actorId).toMatch(/^boot-/);
    expect(first).toMatchObject({ ok: true, operations: { committed: 1, rejected: 0 } });
    expect(second).toMatchObject({ ok: true, operations: { committed: 1, rejected: 0 } });
  });

  it("writes an artifact, restarts, and reads its exact body by the perceived ContentRef", async () => {
    const dir = storage();
    const principalId = "artifact-agent";
    const task = "financial-ecosystem-overview";
    const body = "Financial industry chain overview — exact durable bytes.";

    const writer = bootFileOS(artifactWriterAdapter(principalId, task, body), {
      llm: mockLlmConfig,
      storagePath: dir,
      principalId,
      maxTurns: 4,
    });
    const written = await writer.run("Store the financial industry overview");
    await writer.shutdown();

    expect(written).toMatchObject({
      ok: true,
      operations: { committed: 1, rejected: 0 },
      toolCalls: { total: 3, succeeded: 3, failed: 0, unresolved: 0 },
    });

    const observed: { ref?: string; body?: string } = {};
    const reader = bootFileOS(artifactReaderAdapter(task, observed), {
      llm: mockLlmConfig,
      storagePath: dir,
      principalId,
      maxTurns: 3,
    });
    const read = await reader.run("Recall the stored financial overview");
    await reader.shutdown();

    expect(read.ok).toBe(true);
    expect(observed.body).toBe(body);
    expect(observed.ref).toMatch(/^sha256:[0-9a-f]{64}$/u);

    const persistence = createFileRuntimePersistence({ dir: join(dir, "runtime") });
    const headRef = persistence.durable.head();
    const head = headRef === undefined ? undefined : persistence.durable.get(headRef);
    const storedRef = head?.artifacts.get(artifactId(task))?.contentRef;
    expect(String(storedRef)).toBe(observed.ref);

    const contentStore = createFileContentStore(join(dir, "content"));
    const blob = await contentStore.get(storedRef as ContentRef);
    expect(new TextDecoder().decode(blob?.bytes)).toBe(body);
  });
});
