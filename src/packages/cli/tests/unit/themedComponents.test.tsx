// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import React from "react";
import "../setup/inkSetup.js";
import { ThemeProvider } from "../../src/theme/themeContext.js";
import { createTheme, type ThemeName } from "../../src/theme/theme.js";
import { Divider } from "../../src/tui/Divider.js";
import { ViewFrame } from "../../src/views/ViewFrame.js";
import { scrollWindow } from "../../src/tui/CommandPalette.js";
import { ObservePanel } from "../../src/tui/ObservePanel.js";
import { StatusBar } from "../../src/tui/StatusBar.js";
import { ToolCard } from "../../src/tui/ToolCard.js";
import { ChatPanel } from "../../src/tui/ChatPanel.js";
import { createEmptyRuntime, createEmptySession, type SnapshotData } from "../../src/store.js";

function withTheme(name: ThemeName, node: React.ReactElement): React.ReactElement {
  return <ThemeProvider theme={createTheme(name, "unicode")}>{node}</ThemeProvider>;
}

const THEMES: readonly ThemeName[] = ["moonlight", "daylight", "ansi", "mono"];

describe("Divider", () => {
  it("draws a rule of the requested width", () => {
    const { container } = render(withTheme("moonlight", <Divider width={10} />));
    expect(container.textContent).toBe("─".repeat(10));
  });

  it("insets a label into the rule", () => {
    const { container } = render(withTheme("moonlight", <Divider width={20} label="World" />));
    expect(container.textContent).toContain("World");
    expect(container.textContent).toHaveLength(20);
  });

  it("switches to ascii dashes when the theme has no box drawing", () => {
    const ascii = createTheme("ansi", "ascii");
    const { container } = render(
      <ThemeProvider theme={ascii}>
        <Divider width={6} />
      </ThemeProvider>,
    );
    expect(container.textContent).toBe("------");
  });

  it("renders nothing for a non-positive width", () => {
    const { container } = render(withTheme("moonlight", <Divider width={0} />));
    expect(container.textContent).toBe("");
  });
});

describe("ViewFrame", () => {
  it("renders title, subtitle, and body together", () => {
    const { container } = render(
      withTheme(
        "moonlight",
        <ViewFrame title="Graph" subtitle="depth=2" tone="success">
          <span>body</span>
        </ViewFrame>,
      ),
    );
    expect(container.textContent).toContain("Graph");
    expect(container.textContent).toContain("depth=2");
    expect(container.textContent).toContain("body");
  });

  it("replaces the body with the empty message when one is given", () => {
    const { container } = render(
      withTheme(
        "moonlight",
        <ViewFrame title="Graph" empty="no runtime">
          <span>body</span>
        </ViewFrame>,
      ),
    );
    expect(container.textContent).toContain("no runtime");
    expect(container.textContent).not.toContain("body");
  });

  it("omits an empty subtitle rather than leaving a blank row", () => {
    const { container } = render(withTheme("moonlight", <ViewFrame title="Graph" subtitle="" />));
    expect(container.textContent).toContain("Graph");
  });

  it("renders under every theme", () => {
    for (const name of THEMES) {
      const { container } = render(withTheme(name, <ViewFrame title={`T-${name}`} />));
      expect(container.textContent).toContain(`T-${name}`);
    }
  });
});

describe("scrollWindow", () => {
  it("shows everything when the list fits", () => {
    expect(scrollWindow(0, 3, 8)).toEqual({ start: 0, end: 3 });
  });

  it("centres the cursor once the list overflows", () => {
    expect(scrollWindow(10, 40, 8)).toEqual({ start: 6, end: 14 });
  });

  it("clamps to the top of the list", () => {
    expect(scrollWindow(0, 40, 8)).toEqual({ start: 0, end: 8 });
  });

  it("clamps to the bottom of the list", () => {
    expect(scrollWindow(39, 40, 8)).toEqual({ start: 32, end: 40 });
  });
});

const SNAPSHOT: SnapshotData = {
  snapshotRef: "snap:1",
  epochId: "epoch:1",
  participants: [
    { id: "agent:a", kind: "agent", status: "active" },
    { id: "agent:b", kind: "agent", status: "waiting" },
    { id: "agent:c", kind: "agent", status: "retired" },
    { id: "agent:d", kind: "agent", status: "failed" },
  ],
  artifacts: [{ id: "art:1", kind: "doc", lifecycle: "draft" }],
  sessions: [],
  capabilities: [],
  links: [],
  auditTail: [],
  retired: [],
};

describe("ObservePanel", () => {
  it("prompts to boot when there is no snapshot yet", () => {
    const { container } = render(
      withTheme(
        "moonlight",
        <ObservePanel
          runtime={createEmptyRuntime()}
          phase={{ kind: "idle" }}
          width={30}
          height={20}
        />,
      ),
    );
    expect(container.textContent).toContain("No runtime yet");
  });

  it("lists participants, artifacts, and changes once a snapshot exists", () => {
    const runtime = {
      ...createEmptyRuntime(),
      snapshot: SNAPSHOT,
      epoch: { epochId: "epoch:1", ordinal: 1, schemaId: "schema:1" },
      changeLog: [
        {
          changeId: "chg:1",
          operationTypeId: "register_participant",
          initiator: "agent:a",
          beforeRef: "snap:0",
          afterRef: "snap:1",
          timestamp: "2026-01-01T00:00:00Z",
        },
      ],
    };
    const { container } = render(
      withTheme(
        "moonlight",
        <ObservePanel
          runtime={runtime}
          phase={{ kind: "thinking", turn: 1, since: Date.now() }}
          width={40}
          height={30}
        />,
      ),
    );
    expect(container.textContent).toContain("Participants");
    expect(container.textContent).toContain("agent:a");
    expect(container.textContent).toContain("register_participant");
    expect(container.textContent).toContain("epoch");
  });
});

describe("StatusBar", () => {
  it("shows the live phase while the agent is thinking", () => {
    const { container } = render(
      withTheme(
        "moonlight",
        <StatusBar
          provider="dashscope"
          model="qwen-max"
          session={createEmptySession()}
          phase={{ kind: "thinking", turn: 1, since: Date.now() }}
          width={120}
        />,
      ),
    );
    expect(container.textContent).toContain("thinking");
    expect(container.textContent).toContain("qwen-max");
    expect(container.textContent).toContain("dashscope");
  });

  it("labels the running tool instead of a generic spinner", () => {
    const { container } = render(
      withTheme(
        "moonlight",
        <StatusBar
          provider="openai"
          model="gpt-4o"
          session={createEmptySession()}
          phase={{ kind: "tool", turn: 1, name: "write_content", since: Date.now() }}
          width={120}
        />,
      ),
    );
    expect(container.textContent).toContain("write_content");
  });

  it("drops the provider and participant fields on a narrow terminal", () => {
    const { container } = render(
      withTheme(
        "moonlight",
        <StatusBar
          provider="dashscope"
          model="qwen-max"
          session={createEmptySession()}
          width={70}
        />,
      ),
    );
    expect(container.textContent).not.toContain("dashscope");
    expect(container.textContent).not.toContain("focus");
  });

  it("surfaces a notice under the status line", () => {
    for (const level of ["info", "warn", "error"] as const) {
      const { container } = render(
        withTheme(
          "moonlight",
          <StatusBar
            provider="openai"
            model="gpt-4o"
            session={createEmptySession()}
            notice={{ level, text: `notice-${level}` }}
            width={120}
          />,
        ),
      );
      expect(container.textContent).toContain(`notice-${level}`);
    }
  });

  it("abbreviates large token counts", () => {
    const session = {
      ...createEmptySession(),
      tokenUsage: { prompt: 1_500_000, completion: 500_000, total: 2_000_000 },
    };
    const { container } = render(
      withTheme(
        "moonlight",
        <StatusBar provider="openai" model="gpt-4o" session={session} width={120} />,
      ),
    );
    expect(container.textContent).toContain("2.0M");
  });
});

describe("ToolCard", () => {
  it("collapses to one line in focus mode", () => {
    const { container } = render(
      withTheme(
        "moonlight",
        <ToolCard
          toolCall={{
            id: "1",
            name: "read_content",
            args: { ref: "sha256:abc" },
            status: "done",
            result: { ok: true, output: "first\nsecond" },
            startedAt: 0,
            endedAt: 1200,
          }}
          detail="focus"
        />,
      ),
    );
    // The collapsed form shows arguments but never the tool output body.
    expect(container.textContent).toContain("read_content");
    expect(container.textContent).toContain("ref=sha256:abc");
    expect(container.textContent).not.toContain("second");
    expect(container.textContent).toContain("1.2s");
  });

  it("expands in observe mode", () => {
    const { container } = render(
      withTheme(
        "moonlight",
        <ToolCard
          toolCall={{
            id: "1",
            name: "read",
            args: {},
            status: "done",
            result: { ok: true, output: "body" },
          }}
          detail="observe"
        />,
      ),
    );
    expect(container.textContent).toContain("body");
  });

  it("expands a failure even in focus mode", () => {
    const { container } = render(
      withTheme(
        "moonlight",
        <ToolCard
          toolCall={{
            id: "1",
            name: "write",
            args: {},
            status: "error",
            result: { ok: false, output: "permission denied" },
          }}
          detail="focus"
        />,
      ),
    );
    expect(container.textContent).toContain("permission denied");
  });
});

describe("ChatPanel", () => {
  it("shows the keybinding cheat sheet before the first turn", () => {
    const { container } = render(withTheme("moonlight", <ChatPanel messages={[]} />));
    expect(container.textContent).toContain("cantilune");
    expect(container.textContent).toContain("Ctrl+O");
  });

  it("marks a streaming message with a caret", () => {
    const { container } = render(
      withTheme(
        "moonlight",
        <ChatPanel
          messages={[{ role: "assistant", content: "partial", timestamp: 1, streaming: true }]}
        />,
      ),
    );
    expect(container.textContent).toContain("partial");
    expect(container.textContent).toContain("▍");
  });

  it("reports how many messages are scrolled out of view", () => {
    const messages = Array.from({ length: 40 }, (_, i) => ({
      role: "user" as const,
      content: `message ${i}`,
      timestamp: i,
    }));
    const { container } = render(
      withTheme("moonlight", <ChatPanel messages={messages} height={6} width={40} />),
    );
    expect(container.textContent).toContain("earlier message");
  });

  it("tells the user how to return from a scrollback position", () => {
    const messages = Array.from({ length: 10 }, (_, i) => ({
      role: "user" as const,
      content: `message ${i}`,
      timestamp: i,
    }));
    const { container } = render(
      withTheme(
        "moonlight",
        <ChatPanel messages={messages} height={6} width={40} scrollOffset={3} />,
      ),
    );
    expect(container.textContent).toContain("scrolled back 3");
  });
});
