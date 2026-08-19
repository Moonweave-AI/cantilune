import { describe, expect, it } from "vitest";
import { ContextTokenMeter, estimateRequestTokens } from "../../src/context/tokenMeter.js";
import { pruneToolResults, TOOL_RESULT_PRUNE_MARKER } from "../../src/context/toolResultPruner.js";
import type { LlmMessage } from "../../src/types.js";

describe("context management primitives", () => {
  it("reprices only the changed surface after a provider usage anchor", () => {
    const meter = new ContextTokenMeter();
    const original: LlmMessage[] = [{ role: "user", content: "a".repeat(400) }];
    meter.recordSuccessfulRequest(original, [], { prompt: 37, completion: 2, total: 39 });
    const next = [...original, { role: "assistant" as const, content: "b".repeat(80) }];

    const measurement = meter.measure(next, []);
    expect(measurement.source).toBe("provider_usage");
    expect(measurement.promptTokens).toBe(
      37 + estimateRequestTokens(next, []) - estimateRequestTokens(original, []),
    );
  });

  it("prunes only the middle of oversized tool results", () => {
    const content = `HEAD${"x".repeat(9_000)}TAIL`;
    const result = pruneToolResults([
      { role: "tool", toolCallId: "call-1", content },
      { role: "user", content: "unchanged" },
    ]);

    expect(result.prunedResults).toBe(1);
    const tool = result.messages[0];
    expect(tool?.role).toBe("tool");
    expect(tool?.content).toContain(TOOL_RESULT_PRUNE_MARKER);
    expect(tool?.content.startsWith("HEAD")).toBe(true);
    expect(tool?.content.endsWith("TAIL")).toBe(true);
    expect(result.messages[1]).toEqual({ role: "user", content: "unchanged" });
  });
});
