import { describe, it, expect } from "vitest";
import type { ChatMessage } from "../../src/store.js";
import { planRunSummary } from "../../src/tui/planRunSummary.js";
import { windowMessages } from "../../src/tui/ChatPanel.js";
import { clipPaletteText, formatPaletteRow } from "../../src/tui/CommandPalette.js";
import type { CommandSuggestion } from "../../src/commands/suggest.js";
import {
  chatBodyHeight,
  chromeRows,
  dialogReserveRows,
  estimatePaletteOverlayRows,
  paletteVisibleRows,
} from "../../src/tui/layoutBudget.js";

function message(
  role: ChatMessage["role"],
  content: string,
  extra: Partial<ChatMessage> = {},
): ChatMessage {
  return { role, content, timestamp: extra.timestamp ?? 1, ...extra };
}

describe("planRunSummary", () => {
  it("does nothing when the last assistant already has prose", () => {
    expect(
      planRunSummary(
        [message("user", "hi"), message("assistant", "你好，需要我做什么？")],
        "成功回复用户的问候，任务完成。",
        true,
      ),
    ).toEqual({ action: "none" });
  });

  it("fills an empty assistant bubble instead of appending", () => {
    expect(
      planRunSummary(
        [
          message("user", "hi"),
          message("assistant", ""),
          message("system", "", {
            toolCalls: [
              {
                id: "d",
                name: "done",
                args: { summary: "任务完成" },
                status: "done",
                startedAt: 1,
                endedAt: 2,
              },
            ],
          }),
        ],
        "任务完成",
        true,
      ),
    ).toEqual({ action: "fill", content: "任务完成" });
  });

  it("appends when the run produced no assistant bubble", () => {
    expect(planRunSummary([message("user", "hi")], "done", true)).toEqual({
      action: "append",
      role: "assistant",
      content: "done",
    });
    expect(planRunSummary([message("user", "hi")], "boom", false)).toEqual({
      action: "append",
      role: "error",
      content: "boom",
    });
  });

  it("ignores a blank summary", () => {
    expect(planRunSummary([message("user", "hi")], "   ", true)).toEqual({ action: "none" });
  });
});

describe("windowMessages", () => {
  it("keeps assistant prose visible when a trailing tool card would spend the budget", () => {
    const lifecycle = Array.from({ length: 12 }, (_, i) => ({
      stage: "llm" as const,
      label: `stage ${i}`,
      ts: i,
    }));
    const messages: ChatMessage[] = [
      message("user", "你好", { timestamp: 1 }),
      message("assistant", "你好，我是助手。", { timestamp: 2, lifecycle }),
      message("system", "", {
        timestamp: 3,
        toolCalls: [
          {
            id: "d",
            name: "done",
            args: { summary: "成功回复用户的问候，任务完成。" },
            status: "done",
            startedAt: 1,
            endedAt: 2,
          },
        ],
      }),
    ];

    const { visible, hiddenAbove } = windowMessages(messages, 6, 40, 0);
    expect(visible.some((entry) => entry.content.includes("我是助手"))).toBe(true);
    expect(hiddenAbove).toBeGreaterThanOrEqual(0);
  });

  it("still reports messages scrolled out of a short window", () => {
    const messages = Array.from({ length: 40 }, (_, i) =>
      message("user", `message ${i}`, { timestamp: i }),
    );
    const { hiddenAbove } = windowMessages(messages, 6, 40, 0);
    expect(hiddenAbove).toBeGreaterThan(0);
  });

  it("falls back to a trailing budget walk when nothing has prose", () => {
    const messages: ChatMessage[] = [
      message("assistant", "", { timestamp: 1 }),
      message("system", "", {
        timestamp: 2,
        toolCalls: [
          {
            id: "d",
            name: "done",
            args: {},
            status: "done",
            startedAt: 1,
            endedAt: 2,
          },
        ],
      }),
    ];
    const { visible } = windowMessages(messages, 4, 40, 0);
    expect(visible.length).toBeGreaterThan(0);
    expect(visible.at(-1)?.role).toBe("system");
  });

  it("honours scrollOffset when pinning away from the newest message", () => {
    const messages = Array.from({ length: 8 }, (_, i) =>
      message("user", `message ${i}`, { timestamp: i }),
    );
    const { visible } = windowMessages(messages, 20, 40, 2);
    expect(visible.at(-1)?.content).toBe("message 5");
  });
});

describe("clipPaletteText / formatPaletteRow", () => {
  it("clips with an ellipsis and never exceeds the budget", () => {
    expect(clipPaletteText("hello", 10)).toBe("hello");
    expect(clipPaletteText("hello world", 8)).toBe("hello w…");
    expect(clipPaletteText("hello", 0)).toBe("");
    expect(clipPaletteText("hello", 1)).toBe("…");
    expect(clipPaletteText("hello", 2, "...")).toBe("..");
  });

  it("packs a long description into one row", () => {
    const entry: CommandSuggestion = {
      name: "/cluster",
      label: "/cluster",
      description: "Show the cluster overview (supervisor + world projection view)",
      category: "view",
      command: { name: "/cluster", description: "d", category: "view", handler: () => undefined },
      childCount: 5,
      requiredArgs: [],
    };
    const row = formatPaletteRow(entry, 48, "›");
    const packed = `${row.name}${row.child}${row.description}${row.category}`;
    expect(packed.length).toBeLessThanOrEqual(48);
    expect(row.category).toBe("view");
    expect(row.description.includes("projection view")).toBe(false);
  });

  it("reserves columns for required-argument hints", () => {
    const entry: CommandSuggestion = {
      name: "/base-url",
      label: "/base-url",
      description: "Override the API base URL for the current provider",
      category: "control",
      command: undefined,
      childCount: 0,
      requiredArgs: ["url"],
    };
    const row = formatPaletteRow(entry, 40, ">", "...");
    expect(row.name).toContain("/base-url");
    expect(row.child.trim()).toBe("");
    expect(row.description.includes("current provider")).toBe(false);
  });
});

describe("layoutBudget", () => {
  it("keeps chrome + overlay + chat inside the terminal", () => {
    expect(chromeRows(false)).toBe(6);
    expect(chromeRows(true)).toBe(7);
    expect(dialogReserveRows("chat")).toBe(0);
    expect(dialogReserveRows("picker")).toBe(8);
    expect(paletteVisibleRows(24, false)).toBeLessThanOrEqual(8);
    const overlay = estimatePaletteOverlayRows(true, 31, 6, false);
    const body = chatBodyHeight({
      rows: 24,
      notice: false,
      overlayRows: overlay,
      dialogRows: 0,
    });
    expect(6 + overlay + body).toBeLessThanOrEqual(24);
    expect(estimatePaletteOverlayRows(false, 31, 8, false)).toBe(0);
    expect(estimatePaletteOverlayRows(true, 0, 8, true)).toBeGreaterThan(4);
    expect(dialogReserveRows("ask")).toBe(8);
    expect(dialogReserveRows("approve")).toBe(8);
    expect(dialogReserveRows("confirm")).toBe(8);
    expect(paletteVisibleRows(16, true)).toBeGreaterThanOrEqual(3);
    expect(
      chatBodyHeight({ rows: 16, notice: true, overlayRows: 8, dialogRows: 8 }),
    ).toBeGreaterThanOrEqual(3);
  });
});
