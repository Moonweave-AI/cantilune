/**
 * Render the CLI chrome to stdout for visual inspection.
 *
 * Ink normally needs a live TTY, so this drives it through the testing renderer
 * and prints the resulting frame with ANSI intact. Run one theme at a time:
 *
 *   pnpm preview moonlight
 *   pnpm preview mono ascii
 *
 * This exists because palette and spacing decisions cannot be judged from a
 * DOM assertion — they have to be looked at.
 */
import React from "react";
import { Box } from "ink";
import { render } from "ink-testing-library";
import { ThemeProvider } from "../src/theme/themeContext.js";
import { createTheme, isThemeName, type ThemeName } from "../src/theme/theme.js";
import type { GlyphSetName } from "../src/theme/glyphs.js";
import { StatusBar } from "../src/tui/StatusBar.js";
import { ChatPanel } from "../src/tui/ChatPanel.js";
import { InputBar } from "../src/tui/InputBar.js";
import { ObservePanel } from "../src/tui/ObservePanel.js";
import { CommandPalette } from "../src/tui/CommandPalette.js";
import { Divider } from "../src/tui/Divider.js";
import { ToolCard } from "../src/tui/ToolCard.js";
import type { ChatMessage, RuntimeState, SessionState } from "../src/store.js";
import type { SlashCommand } from "../src/commands/registry.js";
import { suggestCommands } from "../src/commands/suggest.js";

const WIDTH = 100;

const SESSION: SessionState = {
  sessionId: "sess:preview",
  startTime: Date.now() - 187_000,
  turnCount: 7,
  tokenUsage: { prompt: 18_400, completion: 3_100, total: 21_500 },
};

const RUNTIME: RuntimeState = {
  snapshot: {
    snapshotRef: "snap:0f3a",
    epochId: "epoch:2",
    participants: [
      { id: "agent:initiator", kind: "agent", status: "active" },
      { id: "agent:market-research", kind: "agent", status: "active" },
      { id: "agent:filings-analyst", kind: "agent", status: "waiting" },
      { id: "agent:risk-review", kind: "agent", status: "registered" },
    ],
    artifacts: [
      { id: "art:market-brief", kind: "doc", lifecycle: "draft" },
      { id: "art:10k-extract", kind: "doc", lifecycle: "draft" },
    ],
    sessions: [{ id: "sess:a", initiator: "agent:initiator", status: "open" }],
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
    {
      changeId: "chg:2",
      operationTypeId: "emit_heartbeat",
      initiator: "agent:market-research",
      beforeRef: "snap:1",
      afterRef: "snap:2",
      timestamp: "2026-08-13T05:00:12Z",
    },
    {
      changeId: "chg:3",
      operationTypeId: "write_artifact",
      initiator: "agent:market-research",
      beforeRef: "snap:2",
      afterRef: "snap:3",
      timestamp: "2026-08-13T05:00:31Z",
    },
  ],
};

const MESSAGES: ChatMessage[] = [
  {
    role: "user",
    content: "Research the semiconductor supply chain and flag the three biggest risks.",
    timestamp: 1,
  },
  {
    role: "assistant",
    content:
      "I will split this across three peers: one on market structure, one on filings, and one on geopolitical risk.",
    timestamp: 2,
    toolCalls: [
      {
        id: "t1",
        name: "register_participant",
        args: { agentId: "agent:market-research", kind: "agent" },
        status: "done",
        startedAt: 1000,
        endedAt: 1240,
        result: { ok: true, output: "registered agent:market-research" },
      },
      {
        id: "t2",
        name: "write_content",
        args: { path: "brief.md", bytes: 4820 },
        status: "done",
        startedAt: 1240,
        endedAt: 1310,
        result: { ok: true, output: "sha256:9f2c…" },
      },
      {
        id: "t3",
        name: "fetch_filings",
        args: { ticker: "TSM", form: "20-F" },
        status: "error",
        startedAt: 1310,
        endedAt: 3120,
        result: { ok: false, output: "HTTP 429 rate limited by upstream after 3 retries" },
      },
    ],
  },
  {
    role: "assistant",
    content: "Retrying the filings fetch with a backoff",
    timestamp: 3,
    streaming: true,
  },
];

const COMMANDS: SlashCommand[] = [
  { name: "/world", description: "Inspect the coordination snapshot", category: "view" },
  { name: "/world actors", description: "List participants and status", category: "view" },
  { name: "/world artifacts", description: "List work artifacts", category: "view" },
  { name: "/cluster", description: "Agent cluster status and topology", category: "view" },
  { name: "/cluster status", description: "Liveness per agent", category: "view" },
  { name: "/theme", description: "Switch the colour theme", category: "control" },
  { name: "/provider", description: "Choose the LLM provider", category: "control" },
  { name: "/export", description: "Export the world as DOT or PNML", category: "export" },
  { name: "/replay", description: "Replay a change from the log", category: "operation" },
] as unknown as SlashCommand[];

// The palette is presentational, so the preview runs the same suggestion
// derivation the input bar does rather than hand-writing rows.
const SUGGEST = suggestCommands(COMMANDS, "/w");

function Preview(): React.ReactElement {
  return (
    <Box flexDirection="column" width={WIDTH}>
      <StatusBar
        provider="anthropic"
        model="claude-sonnet-4"
        session={SESSION}
        participants={4}
        phase={{ kind: "tool", name: "fetch_filings", since: Date.now() - 2400 }}
        layout="observe"
        connected
        width={WIDTH}
        notice={{ level: "warn", text: "filings endpoint rate limited, backing off" }}
      />
      <Divider width={WIDTH} />
      <Box>
        <Box flexDirection="column" width={WIDTH - 34}>
          <ChatPanel messages={MESSAGES} height={24} width={WIDTH - 36} detail="focus" />
        </Box>
        <ObservePanel
          runtime={RUNTIME}
          phase={{ kind: "thinking", since: Date.now() }}
          width={34}
          height={26}
        />
      </Box>
      <Divider width={WIDTH} label="expanded tool call" />
      <ToolCard toolCall={MESSAGES[1]!.toolCalls![2]!} detail="observe" width={WIDTH} />
      <CommandPalette suggestions={SUGGEST.suggestions} usage={SUGGEST.usage} selected={0} />
      <InputBar onSubmit={() => undefined} commands={COMMANDS} width={WIDTH} />
    </Box>
  );
}

const [nameArg, glyphArg] = process.argv.slice(2);
const themeName: ThemeName = isThemeName(nameArg) ? nameArg : "moonlight";
const glyphSet: GlyphSetName = glyphArg === "ascii" ? "ascii" : "unicode";

const { lastFrame } = render(
  <ThemeProvider theme={createTheme(themeName, glyphSet)}>
    <Preview />
  </ThemeProvider>,
);

process.stdout.write(`\n=== theme: ${themeName} / glyphs: ${glyphSet} ===\n`);
process.stdout.write(`${lastFrame() ?? "(no frame)"}\n`);
process.exit(0);
