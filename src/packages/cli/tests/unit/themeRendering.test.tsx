/**
 * Renders the interactive chrome through the real Ink renderer.
 *
 * The other component tests mock Ink away, which is fast but blind to anything
 * that only exists in the emitted frame: ANSI attributes, box drawing, and the
 * exact characters a glyph set produces. These tests look at the frame itself,
 * which is the only way to catch a unicode character leaking into ASCII mode.
 */
import { describe, it, expect, vi } from "vitest";

// Chalk locks its colour level in at import time, so the truecolor hint has to
// land before Ink is loaded. `vi.hoisted` is the only place that runs early
// enough.
vi.hoisted(() => {
  delete process.env["NO_COLOR"];
  process.env["FORCE_COLOR"] = "3";
});

// The shared setup swaps Ink for DOM elements, which is what the rest of the
// suite wants. This file needs the real reconciler to inspect actual frames.
vi.unmock("ink");

import React from "react";
import { Box } from "ink";
import { render } from "ink-testing-library";
import { ThemeProvider } from "../../src/theme/themeContext.js";
import { createTheme, type ThemeName } from "../../src/theme/theme.js";
import type { GlyphSetName } from "../../src/theme/glyphs.js";
import { StatusBar } from "../../src/tui/StatusBar.js";
import { ChatPanel } from "../../src/tui/ChatPanel.js";
import { InputBar } from "../../src/tui/InputBar.js";
import { ObservePanel } from "../../src/tui/ObservePanel.js";
import { CommandPalette } from "../../src/tui/CommandPalette.js";
import { PickerPanel } from "../../src/tui/PickerPanel.js";
import { ConfirmDialog } from "../../src/tui/ConfirmDialog.js";
import { Divider } from "../../src/tui/Divider.js";
import { ToolCard } from "../../src/tui/ToolCard.js";
import type { ChatMessage, RuntimeState, SessionState, ToolCallDisplay } from "../../src/store.js";
import type { SlashCommand } from "../../src/commands/registry.js";
import type { CommandSuggestion } from "../../src/commands/suggest.js";

const SESSION: SessionState = {
  messages: [],
  startTime: Date.now() - 187_000,
  turnCount: 7,
  tokenUsage: { prompt: 18_400, completion: 3_100, total: 21_500 },
  costUsd: 0.42,
};

const FAILED_TOOL: ToolCallDisplay = {
  id: "t3",
  name: "fetch_filings",
  args: { ticker: "TSM", form: "20-F", note: "a".repeat(200) },
  status: "error",
  startedAt: 1310,
  endedAt: 3120,
  result: { ok: false, output: "HTTP 429 rate limited by upstream" },
};

const MESSAGES: ChatMessage[] = [
  { role: "user", content: "Map the supply chain risks.", timestamp: 1 },
  {
    role: "assistant",
    content: "Splitting the work across three peers.",
    timestamp: 2,
    toolCalls: [
      {
        id: "t1",
        name: "register_participant",
        args: { agentId: "agent:market-research-with-a-very-long-identifier" },
        status: "done",
        startedAt: 1000,
        endedAt: 1240,
        result: { ok: true, output: "registered" },
      },
      FAILED_TOOL,
    ],
  },
  { role: "system", content: "epoch advanced", timestamp: 3 },
  { role: "error", content: "adapter timed out", timestamp: 4 },
  { role: "assistant", content: "Retrying", timestamp: 5, streaming: true },
];

const RUNTIME: RuntimeState = {
  snapshot: {
    snapshotRef: "snap:0f3a",
    epochId: "epoch:2",
    participants: [
      { id: "agent:initiator", kind: "agent", status: "active" },
      {
        id: "agent:with-an-extremely-long-name-that-must-be-truncated",
        kind: "agent",
        status: "waiting",
      },
      { id: "agent:broken", kind: "agent", status: "failed" },
    ],
    artifacts: [{ id: "art:market-brief-with-a-long-identifier", kind: "doc", lifecycle: "draft" }],
    sessions: [],
    capabilities: [],
    links: [],
    auditTail: [],
    retired: [],
  },
  epoch: { epochId: "epoch:2", ordinal: 2, schemaId: "schema:v1" },
  changeLog: [
    {
      changeId: "chg:1",
      operationTypeId: "register_participant",
      initiator: "agent:initiator",
      beforeRef: "snap:0",
      afterRef: "snap:1",
      timestamp: "2026-08-13T05:00:00Z",
    },
  ],
};

const COMMANDS = [
  { name: "/world", description: "Inspect the snapshot", category: "view" },
  { name: "/theme", description: "Switch the theme", category: "control" },
  { name: "/export", description: "Export the world", category: "export" },
  { name: "/replay", description: "Replay a change", category: "operation" },
  { name: "/resume", description: "Resume a session", category: "session" },
  { name: "/unknown", description: "Uncategorised", category: "other" },
] as unknown as SlashCommand[];

/** One suggestion per category, so the palette frame covers every tint. */
const SUGGESTIONS: CommandSuggestion[] = COMMANDS.map((command) => ({
  name: command.name,
  label: command.name,
  description: command.description,
  category: command.category,
  command,
  childCount: 0,
  requiredArgs: [],
}));

/** Every piece of chrome at once, so one frame covers the whole visual surface. */
function Chrome(): React.ReactElement {
  return (
    <Box flexDirection="column" width={100}>
      <StatusBar
        provider="anthropic"
        model="claude-sonnet-4"
        session={SESSION}
        participants={3}
        phase={{ kind: "tool", turn: 7, name: "fetch_filings", since: Date.now() - 2400 }}
        layout="observe"
        connected
        width={100}
        notice={{ level: "warn", text: "rate limited" }}
      />
      <Divider width={40} label="tools" />
      <ChatPanel messages={MESSAGES} height={40} width={64} detail="focus" />
      <ToolCard toolCall={FAILED_TOOL} detail="observe" width={64} />
      <ObservePanel
        runtime={RUNTIME}
        phase={{ kind: "thinking", turn: 7, since: Date.now() }}
        width={34}
        height={26}
      />
      <CommandPalette suggestions={SUGGESTIONS} selected={2} />
      <PickerPanel
        title="Provider"
        options={[{ id: "openai", label: "OpenAI", description: "GPT models" }]}
        onSelect={vi.fn()}
        onCancel={vi.fn()}
      />
      <ConfirmDialog message="Discard the session?" onConfirm={vi.fn()} onCancel={vi.fn()} />
      <InputBar onSubmit={vi.fn()} width={100} />
    </Box>
  );
}

function frameFor(name: ThemeName, glyphSet: GlyphSetName): string {
  const { lastFrame, unmount } = render(
    <ThemeProvider theme={createTheme(name, glyphSet)}>
      <Chrome />
    </ThemeProvider>,
  );
  const frame = lastFrame() ?? "";
  unmount();
  return frame;
}

/** Strip SGR sequences so assertions see the characters, not the styling. */
function plain(frame: string): string {
  // eslint-disable-next-line no-control-regex
  return frame.replace(/\u001B\[[0-9;]*m/g, "");
}

describe("chrome rendering", () => {
  const themes: ThemeName[] = ["moonlight", "daylight", "ansi", "mono"];

  it.each(themes)("renders the whole chrome under the %s theme", (name) => {
    const frame = frameFor(name, "unicode");
    expect(frame.length).toBeGreaterThan(0);
    const body = plain(frame);
    expect(body).toContain("claude-sonnet-4");
    expect(body).toContain("fetch_filings");
    expect(body).toContain("Commands");
    expect(body).toContain("Discard the session?");
  });

  it("emits no character outside ASCII when the ASCII glyph set is active", () => {
    for (const name of themes) {
      const body = plain(frameFor(name, "ascii"));
      const offenders = [...new Set(body.split("").filter((c) => c.charCodeAt(0) > 126))];
      expect(offenders, `${name} leaked non-ASCII characters`).toEqual([]);
    }
  });

  it("uses box-drawing borders under the unicode glyph set", () => {
    expect(plain(frameFor("moonlight", "unicode"))).toContain("╭");
  });

  it("falls back to ASCII borders under the ASCII glyph set", () => {
    const body = plain(frameFor("moonlight", "ascii"));
    expect(body).toContain("+---");
    expect(body).not.toContain("╭");
  });
});

describe("emphasis fallbacks", () => {
  /** SGR 2 is dim, 1 is bold, 7 is inverse. */
  const hasSgr = (frame: string, code: number): boolean =>
    new RegExp(`\\u001B\\[(?:[0-9;]*;)?${String(code)}(?:;[0-9;]*)?m`).test(frame);

  it("expresses de-emphasis with dim when the palette has no muted colour", () => {
    expect(hasSgr(frameFor("mono", "unicode"), 2)).toBe(true);
    expect(hasSgr(frameFor("ansi", "unicode"), 2)).toBe(true);
  });

  it("marks the selected row with inverse only when there is no accent colour", () => {
    expect(hasSgr(frameFor("mono", "unicode"), 7)).toBe(true);
  });

  it("keeps hierarchy through bold in every theme", () => {
    for (const name of ["moonlight", "daylight", "ansi", "mono"] as ThemeName[]) {
      expect(hasSgr(frameFor(name, "unicode"), 1), `${name} lost bold`).toBe(true);
    }
  });

  it("colours the truecolor themes and leaves mono uncoloured", () => {
    expect(frameFor("moonlight", "unicode")).toContain("\u001B[38;2;");
    expect(frameFor("mono", "unicode")).not.toContain("\u001B[38;2;");
  });
});

describe("theme-aware truncation", () => {
  it("clips overlong text with the unicode ellipsis", () => {
    expect(plain(frameFor("moonlight", "unicode"))).toContain("…");
  });

  it("clips overlong text with the ASCII ellipsis", () => {
    const body = plain(frameFor("moonlight", "ascii"));
    expect(body).toContain("...");
    expect(body).not.toContain("…");
  });

  it("drops the redundant type prefix from the epoch label", () => {
    const body = plain(frameFor("moonlight", "unicode"));
    expect(body).toContain("epoch 2");
    expect(body).not.toContain("epoch epoch:2");
  });
});
