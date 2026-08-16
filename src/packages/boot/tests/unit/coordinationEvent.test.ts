import { describe, expect, it } from "vitest";
import { contentRef } from "@cantilune/core";
import type { Syscall } from "@cantilune/syscall";
import { createTerminationController } from "../../src/termination/index.js";
import { runAgentLoop } from "../../src/agentLoop.js";
import type {
  AgentEvent,
  LlmAdapter,
  LlmChatResponse,
  LlmToolCallResult,
} from "../../src/types.js";

const WRITTEN_REF = contentRef(
  "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
);

/**
 * Own-property probe over an event that may not have been found.
 *
 * Returns `undefined` for a missing event so the assertion fails loudly rather
 * than reporting "no such property" as if the event had been inspected.
 */
function hasOwnKey(value: object | undefined, key: string): boolean | undefined {
  return value === undefined ? undefined : Object.hasOwn(value, key);
}

function baseSyscall(overrides: Partial<Syscall> = {}): Syscall {
  return {
    perceive: async () => ({
      worldSummary: "world",
      recentObservations: "observations",
      availableOperations: [],
      headRef: "snapshot-1",
    }),
    act: async () => ({ ok: true, message: "committed", newHeadRef: "snapshot-2" }),
    readContent: async (ref) => ({
      found: String(ref) === "sha256:good",
      text: String(ref) === "sha256:good" ? "recovered" : undefined,
      mimeType: String(ref) === "sha256:good" ? "text/plain" : undefined,
    }),
    writeContent: async () => WRITTEN_REF,
    useTool: async () => ({
      ok: true,
      output: "tool output",
      contentRef: undefined,
      observeWarning: undefined,
      observationRecovery: undefined,
    }),
    retryToolObservation: async (recovery) => ({
      ok: true,
      outputRef: recovery.outputRef,
      message: "Observation committed.",
      observeWarning: undefined,
    }),
    availableActions: async () => [],
    ...overrides,
  };
}

function scriptedAdapter(script: readonly LlmChatResponse[]): LlmAdapter {
  let index = 0;
  return {
    async chat(): Promise<LlmChatResponse> {
      const step = script[index];
      index++;
      if (step === undefined) throw new Error("LLM script exhausted");
      return step;
    },
  };
}

function toolResponse(call: LlmToolCallResult): LlmChatResponse {
  return { text: undefined, toolCalls: [call], finishReason: "tool_calls" };
}

function done(id = "done"): LlmChatResponse {
  return toolResponse({ id, name: "done", arguments: { summary: "claimed complete" } });
}

const config = { maxTurns: 100, maxTimeMs: 600_000, maxContextMessages: 40 } as const;

function collectEvents(syscall: Syscall, adapter: LlmAdapter): Promise<AgentEvent[]> {
  const events: AgentEvent[] = [];
  const run = runAgentLoop(syscall, adapter, "test", createTerminationController({}), config, {
    onEvent: (event) => events.push(event),
  }).then(() => events);
  return run;
}

describe("agent loop coordination event flag", () => {
  it("marks a coordination action (introduce_artifact) with coordination:true on tool_start and tool_end", async () => {
    const events = await collectEvents(
      baseSyscall(),
      scriptedAdapter([
        toolResponse({ id: "intro", name: "introduce_artifact", arguments: { target: "x" } }),
        done(),
      ]),
    );
    const start = events.find(
      (e) => e.kind === "tool_start" && "name" in e && e.name === "introduce_artifact",
    );
    const end = events.find(
      (e) => e.kind === "tool_end" && "name" in e && e.name === "introduce_artifact",
    );
    expect(start).toEqual(expect.objectContaining({ kind: "tool_start", coordination: true }));
    expect(end).toEqual(expect.objectContaining({ kind: "tool_end", coordination: true }));
  });

  it("omits coordination from read_content tool_start and tool_end", async () => {
    const events = await collectEvents(
      baseSyscall(),
      scriptedAdapter([
        toolResponse({ id: "read", name: "read_content", arguments: { ref: "sha256:good" } }),
        done(),
      ]),
    );
    const start = events.find(
      (e) => e.kind === "tool_start" && "name" in e && e.name === "read_content",
    );
    const end = events.find(
      (e) => e.kind === "tool_end" && "name" in e && e.name === "read_content",
    );
    expect(start).toBeDefined();
    expect(end).toBeDefined();
    expect(hasOwnKey(start, "coordination")).toBe(false);
    expect(hasOwnKey(end, "coordination")).toBe(false);
  });

  it("omits coordination from write_content tool_start and tool_end", async () => {
    const events = await collectEvents(
      baseSyscall(),
      scriptedAdapter([
        toolResponse({ id: "write", name: "write_content", arguments: { content: "x" } }),
        done(),
      ]),
    );
    const start = events.find(
      (e) => e.kind === "tool_start" && "name" in e && e.name === "write_content",
    );
    const end = events.find(
      (e) => e.kind === "tool_end" && "name" in e && e.name === "write_content",
    );
    expect(start).toBeDefined();
    expect(end).toBeDefined();
    expect(hasOwnKey(start, "coordination")).toBe(false);
    expect(hasOwnKey(end, "coordination")).toBe(false);
  });

  it("omits coordination from a tool: prefixed external tool", async () => {
    const events = await collectEvents(
      baseSyscall(),
      scriptedAdapter([
        toolResponse({ id: "ext", name: "tool:search", arguments: { query: "q" } }),
        done(),
      ]),
    );
    const start = events.find(
      (e) => e.kind === "tool_start" && "name" in e && e.name === "tool:search",
    );
    const end = events.find(
      (e) => e.kind === "tool_end" && "name" in e && e.name === "tool:search",
    );
    expect(start).toBeDefined();
    expect(end).toBeDefined();
    expect(hasOwnKey(start, "coordination")).toBe(false);
    expect(hasOwnKey(end, "coordination")).toBe(false);
  });

  it("omits coordination from done tool_end", async () => {
    const events = await collectEvents(baseSyscall(), scriptedAdapter([done()]));
    const doneEnd = events.find((e) => e.kind === "tool_end" && "name" in e && e.name === "done");
    expect(doneEnd).toBeDefined();
    expect(hasOwnKey(doneEnd, "coordination")).toBe(false);
  });

  it("marks coordination:true on tool_end even when the coordination action fails", async () => {
    const events = await collectEvents(
      baseSyscall({
        act: async () => ({ ok: false, message: "rejected", newHeadRef: undefined }),
      }),
      scriptedAdapter([
        toolResponse({ id: "fail", name: "introduce_artifact", arguments: { target: "x" } }),
        done("must-fail"),
      ]),
    );
    const end = events.find(
      (e) => e.kind === "tool_end" && "name" in e && e.name === "introduce_artifact",
    );
    expect(end).toEqual(
      expect.objectContaining({
        kind: "tool_end",
        name: "introduce_artifact",
        ok: false,
        coordination: true,
      }),
    );
  });
});
