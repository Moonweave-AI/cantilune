import { describe, it, expect } from "vitest";
import type { ChatMessage, ToolCallDisplay } from "../../src/store.js";
import {
  activityHeadline,
  groupTranscript,
  isRedundantDone,
  turnKey,
  visibleTools,
} from "../../src/tui/transcriptItems.js";
import { windowTranscript } from "../../src/tui/ChatPanel.js";

function tool(name: string, extra: Partial<ToolCallDisplay> = {}): ToolCallDisplay {
  return {
    id: extra.id ?? name,
    name,
    args: extra.args ?? {},
    status: extra.status ?? "done",
    startedAt: extra.startedAt ?? 1,
    ...extra,
  };
}

function message(
  role: ChatMessage["role"],
  content: string,
  extra: Partial<ChatMessage> = {},
): ChatMessage {
  return { role, content, timestamp: extra.timestamp ?? 1, ...extra };
}

describe("groupTranscript", () => {
  it("folds a tool-only system row into the preceding assistant turn", () => {
    const items = groupTranscript([
      message("user", "hi", { timestamp: 1 }),
      message("assistant", "answer", { timestamp: 2, turn: 1 }),
      message("system", "", {
        timestamp: 3,
        toolCalls: [tool("done", { args: { summary: "answer" } })],
      }),
    ]);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ kind: "message" });
    expect(items[1]).toMatchObject({ kind: "turn" });
    if (items[1]?.kind !== "turn") throw new Error("expected turn");
    expect(items[1].tools).toHaveLength(1);
    expect(turnKey(items[1])).toBe(1);
  });

  it("keeps a system note with its own text as a separate cell", () => {
    const items = groupTranscript([
      message("assistant", "ok", { timestamp: 1 }),
      message("system", "epoch advanced", { timestamp: 2 }),
    ]);
    expect(items.map((item) => item.kind)).toEqual(["turn", "message"]);
  });
});

describe("isRedundantDone / visibleTools", () => {
  it("hides a done card that restates the assistant bubble", () => {
    const prose = "我是Cantilune协调系统中的自主代理，负责执行用户指令。";
    expect(isRedundantDone(prose, prose)).toBe(true);
    expect(isRedundantDone("任务完成", prose)).toBe(false);
    const tools = visibleTools(
      [tool("done", { args: { summary: prose } }), tool("shell", { args: { command: "ls" } })],
      prose,
    );
    expect(tools.map((entry) => entry.name)).toEqual(["shell"]);
  });
});

describe("activityHeadline", () => {
  it("summarises one tool and counts several", () => {
    expect(activityHeadline([tool("done", { args: { summary: "ok" } })])).toContain("Done");
    expect(activityHeadline([tool("shell"), tool("done")])).toBe("2 tools");
    expect(activityHeadline([])).toBe("Activity");
  });
});

describe("windowTranscript", () => {
  it("keeps the last conversational turn when tools would spend the budget", () => {
    const items = groupTranscript([
      message("user", "你好", { timestamp: 1 }),
      message("assistant", "你好，我是助手。", {
        timestamp: 2,
        turn: 1,
        lifecycle: Array.from({ length: 12 }, (_, i) => ({
          stage: "llm" as const,
          label: `stage ${i}`,
          ts: i,
        })),
      }),
      message("system", "", {
        timestamp: 3,
        toolCalls: [tool("done", { args: { summary: "成功回复用户的问候，任务完成。" } })],
      }),
    ]);
    const { visible } = windowTranscript(items, 6, 40, 0, () => false);
    expect(
      visible.some((item) => item.kind === "turn" && item.assistant.content.includes("我是助手")),
    ).toBe(true);
  });
});
