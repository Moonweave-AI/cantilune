import { describe, expect, it } from "vitest";
import type { RunResultEvent } from "@shared/protocol";
import type { ConversationNode } from "./nodes";
import {
  classifyRunOutcome,
  findLatestRunResultIndex,
  hasAssistantReplyBeforeRunResult,
  presentRunOutcome,
} from "./runOutcome";

const baseResult: RunResultEvent = {
  type: "run_result",
  ok: true,
  summary: "done",
  turns: 2,
  elapsedMs: 1200,
  producedRefs: [],
  terminationReason: "controller",
  operations: { committed: 0, rejected: 0 },
  toolCalls: { total: 1, succeeded: 1, failed: 0, unresolved: 0 },
};

describe("runOutcome", () => {
  it("treats unresolved retryable tool failures with assistant text as partial", () => {
    const result: RunResultEvent = {
      ...baseResult,
      ok: false,
      terminationReason: "error",
      summary: "answer\n\n[Run failed] 1 unresolved tool failure(s) remain (tool:web_fetch).",
      toolCalls: { total: 3, succeeded: 2, failed: 1, unresolved: 1 },
      error: { phase: "tool", message: "1 unresolved tool failure(s) remain (tool:web_fetch).", retryable: true },
    };
    expect(classifyRunOutcome(result, true)).toBe("partial");
    expect(presentRunOutcome(result, true).badge).toBe("⚠ 部分完成");
  });

  it("keeps hard failures when no assistant reply was rendered", () => {
    const result: RunResultEvent = {
      ...baseResult,
      ok: false,
      terminationReason: "error",
      toolCalls: { total: 1, succeeded: 0, failed: 1, unresolved: 1 },
      error: { phase: "tool", message: "network down", retryable: true },
    };
    expect(classifyRunOutcome(result, false)).toBe("partial");
    expect(classifyRunOutcome({ ...result, error: { ...result.error!, retryable: false } }, false)).toBe(
      "failed",
    );
  });

  it("finds assistant reply in the segment before run_result", () => {
    const nodes: ConversationNode[] = [
      { id: "u1", kind: "user", turn: 0, text: "hello" },
      { id: "a1", kind: "assistant", turn: 1, text: "world" },
      { id: "r1", kind: "run_result", turn: 0, runResult: baseResult },
      { id: "u2", kind: "user", turn: 0, text: "again" },
      { id: "r2", kind: "run_result", turn: 0, runResult: baseResult },
    ];
    expect(hasAssistantReplyBeforeRunResult(nodes, 2)).toBe(true);
    expect(hasAssistantReplyBeforeRunResult(nodes, 4)).toBe(false);
    expect(findLatestRunResultIndex(nodes)).toBe(4);
  });
});
