import { describe, expect, it, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bootFileOS } from "../../src/bootCantilune.js";
import type { LlmAdapter, LlmChatResponse, LlmToolCallResult } from "../../src/types.js";
import { mockLlmConfig } from "../support/mockLlmConfig.js";

const dirs: string[] = [];

function storage(): string {
  const dir = mkdtempSync(join(tmpdir(), "cantilune-reporting-"));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function scriptedAdapter(script: readonly LlmToolCallResult[]): LlmAdapter {
  let turn = 0;
  return {
    async chat(request): Promise<LlmChatResponse> {
      const step = script[turn];
      turn++;
      let call =
        step ??
        ({
          id: "d",
          name: "done",
          arguments: { summary: "Analysis complete. Swarm designed successfully." },
        } satisfies LlmToolCallResult);
      if (call.name === "introduce_artifact") {
        const writeResult = request.messages.find(
          (message) => message.role === "tool" && message.toolCallId === "content",
        );
        const ref = writeResult?.content.match(/ref=(sha256:[0-9a-f]{64})/u)?.[1];
        if (ref !== undefined) {
          call = { ...call, arguments: { ...call.arguments, contentRef: ref } };
        }
      }
      return { text: undefined, toolCalls: [call], finishReason: "tool_calls" };
    },
  };
}

/**
 * The reported symptom: every coordination operation was refused, yet the run
 * finished with `ok: true` because the agent called `done` with a confident
 * summary. Operations here name a participant that was never registered, so
 * admission refuses each one for a reason unrelated to any single defect.
 */
describe("a run whose operations were all rejected is not reported as a success", () => {
  it("fails the run and says so when nothing was committed", async () => {
    const script: LlmToolCallResult[] = [
      { id: "1", name: "create_session", arguments: { from: "ghost-agent" } },
      {
        id: "content",
        name: "write_content",
        arguments: { content: "Ghost task body", mimeType: "text/plain" },
      },
      { id: "2", name: "introduce_artifact", arguments: { from: "ghost-agent", task: "t" } },
      {
        id: "3",
        name: "emit_heartbeat",
        arguments: { from: "ghost-agent", turnCount: "2", lastAction: "introduce_artifact" },
      },
    ];

    const os = bootFileOS(scriptedAdapter(script), {
      llm: mockLlmConfig,
      storagePath: storage(),
      principalId: "real-agent",
      maxTurns: script.length + 2,
    });
    const result = await os.run("Design an agent swarm");
    await os.shutdown();

    expect(result.operations).toEqual({ committed: 0, rejected: 3 });
    expect(result.ok).toBe(false);
    expect(result.terminationReason).toBe("error");
    expect(result.summary).toContain("nothing was committed");
  });

  it("keeps the agent's own summary alongside the correction", async () => {
    const os = bootFileOS(
      scriptedAdapter([{ id: "1", name: "create_session", arguments: { from: "ghost-agent" } }]),
      {
        llm: mockLlmConfig,
        storagePath: storage(),
        principalId: "real-agent",
        maxTurns: 4,
      },
    );
    const result = await os.run("Design an agent swarm");
    await os.shutdown();

    expect(result.summary).toContain("Swarm designed successfully");
    expect(result.summary).toContain("[Run failed]");
  });

  it("does not let an unrelated success conceal an unresolved rejection", async () => {
    const pid = "real-agent";
    const os = bootFileOS(
      scriptedAdapter([
        { id: "1", name: "create_session", arguments: { from: "ghost-agent" } },
        {
          id: "2",
          name: "emit_heartbeat",
          arguments: { from: pid, turnCount: "1", lastAction: "create_session" },
        },
      ]),
      { llm: mockLlmConfig, storagePath: storage(), principalId: pid, maxTurns: 5 },
    );
    const result = await os.run("Design an agent swarm");
    await os.shutdown();

    expect(result.operations).toEqual({ committed: 1, rejected: 1 });
    expect(result.ok).toBe(false);
    expect(result.summary).toContain("[Run failed]");
    expect(result.toolCalls).toEqual({ total: 3, succeeded: 1, failed: 2, unresolved: 1 });
  });

  /** A run that only reads and writes content attempts no coordination at all. */
  it("does not penalise a run that attempted no coordination", async () => {
    const os = bootFileOS(
      scriptedAdapter([
        { id: "1", name: "write_content", arguments: { content: "notes", mimeType: "text/plain" } },
      ]),
      {
        llm: mockLlmConfig,
        storagePath: storage(),
        principalId: "real-agent",
        maxTurns: 4,
      },
    );
    const result = await os.run("Write some notes");
    await os.shutdown();

    expect(result.operations).toEqual({ committed: 0, rejected: 0 });
    expect(result.toolCalls).toEqual({ total: 2, succeeded: 2, failed: 0, unresolved: 0 });
    expect(result.ok).toBe(true);
  });
});
