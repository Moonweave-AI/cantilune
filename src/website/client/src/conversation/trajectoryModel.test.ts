import { describe, expect, it } from "vitest";
import type { ConversationNode } from "./nodes";
import { buildTrajectory, displayToolName, summaryFor } from "./trajectoryModel";

const nodes: readonly ConversationNode[] = [
  {
    id: "turn-start",
    kind: "turn",
    turn: 1,
    lastAction: "turn_start",
    elapsedMs: 120_000,
    startedAt: 1_000,
  },
  {
    id: "tool-1",
    kind: "tool_call",
    turn: 1,
    toolName: "tool:web_search",
    arguments: { query: "cantilune" },
    output: "two public sources",
    ok: true,
    startedAt: 1_050,
    endedAt: 1_250,
  },
  {
    id: "turn-end",
    kind: "turn",
    turn: 1,
    lastAction: "tool:web_search",
    elapsedMs: 120_000,
    startedAt: 1_300,
  },
];

describe("trajectoryModel", () => {
  it("keeps turn boundaries out of the visible timeline and duration budget", () => {
    const model = buildTrajectory(nodes, "duration", 1_300);
    expect(model.spans.map((span) => span.id)).toEqual(["tool-1"]);
    expect(model.stats.steps).toBe(1);
    expect(model.domainMs).toBe(180);
  });

  it("ignores wall-clock idle gaps when packing duration mode", () => {
    const idleNodes: readonly ConversationNode[] = [
      {
        id: "u1",
        kind: "user",
        turn: 0,
        text: "first",
        startedAt: 0,
        endedAt: 0,
      },
      {
        id: "tool-1",
        kind: "tool_call",
        turn: 1,
        toolName: "tool:web_search",
        arguments: { query: "a" },
        output: "ok",
        ok: true,
        startedAt: 1_000,
        endedAt: 1_000 + 3_600_000,
      },
      {
        id: "u2",
        kind: "user",
        turn: 0,
        text: "second",
        startedAt: 7_200_000,
        endedAt: 7_200_000,
      },
      {
        id: "asst-1",
        kind: "assistant",
        turn: 2,
        text: "reply",
        startedAt: 7_200_500,
        endedAt: 7_201_000,
      },
    ];
    const model = buildTrajectory(idleNodes, "duration", 7_201_000);
    expect(model.domainMs).toBeLessThan(5_000);
    expect(model.spans.at(-1)?.start).toBeGreaterThan(0.5);
  });

  it("renders a tool request and result without internal transport prefixes", () => {
    expect(displayToolName("tool:tool:web_search")).toBe("web_search");
    expect(summaryFor(nodes[1]!)).toBe(
      'web_search {"query":"cantilune"} -> two public sources',
    );
  });
});
