import React from "react";
import { Box, Text } from "ink";
import type { ChatMessage } from "../store.js";
import { useTheme } from "../theme/themeContext.js";
import { fg, type Color, type Theme } from "../theme/theme.js";
import { ToolCard } from "./ToolCard.js";
import { Markdown } from "./Markdown.js";
import { looksLikeMarkdown, normalizeAssistantMarkdown } from "../render/markdown.js";
import { describeToolCard } from "./formatToolCard.js";
import { ActivityBlock } from "./ActivityBlock.js";
import { groupTranscript, turnKey, visibleTools, type TranscriptItem } from "./transcriptItems.js";

export interface ChatPanelProps {
  readonly messages: readonly ChatMessage[];
  /** Visible rows available to the transcript; drives the scrollback window. */
  readonly height?: number;
  readonly width?: number;
  readonly detail?: "focus" | "observe";
  /** Rows scrolled back from the bottom. 0 pins to the newest item. */
  readonly scrollOffset?: number;
  /** Turn keys whose activity stack is expanded. Observe layout expands all. */
  readonly expandedTurns?: readonly number[];
}

/** Width of the gutter column, so wrapped text stays aligned under itself. */
const GUTTER = 2;

function roleGutter(theme: Theme, role: ChatMessage["role"]): string {
  switch (role) {
    case "user":
      return theme.glyphs.userGutter;
    case "error":
      return theme.glyphs.fail;
    case "system":
      return theme.glyphs.info;
    default:
      return theme.glyphs.assistantGutter;
  }
}

function roleColor(theme: Theme, role: ChatMessage["role"]): Color {
  switch (role) {
    case "user":
      return theme.colors.roleUser;
    case "system":
      return theme.colors.roleSystem;
    case "error":
      return theme.colors.roleError;
    default:
      return theme.colors.roleAssistant;
  }
}

/**
 * Gutter tint, which is not always the body tint.
 *
 * Agent prose stays in the terminal's own foreground so it reads like normal
 * output, but its gutter marker is accented — that marker is the only thing
 * making turn boundaries scannable in a long transcript.
 */
function gutterColor(theme: Theme, role: ChatMessage["role"]): Color {
  return role === "assistant" ? theme.colors.accent : roleColor(theme, role);
}

function assistantSource(content: string): string {
  return normalizeAssistantMarkdown(content);
}

/**
 * Whether a message's body should go through the markdown renderer.
 *
 * Only assistant prose is markdown. A user turn is rendered verbatim so the
 * text a person typed is the text they see back — reformatting their own
 * underscores or asterisks would be surprising. System and error lines are
 * status text, not documents, and stay plain so they cannot grow a heading or
 * a code fence in the middle of the transcript.
 */
function renderAsMarkdown(message: ChatMessage): boolean {
  return message.role === "assistant" && looksLikeMarkdown(assistantSource(message.content));
}

function isConversational(message: ChatMessage): boolean {
  if (message.content.trim().length === 0) return false;
  return message.role === "user" || message.role === "assistant" || message.role === "error";
}

function estimateProseRows(content: string, width: number): number {
  const prose = content.trim();
  if (prose.length === 0) return 0;
  return prose
    .split("\n")
    .reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / Math.max(20, width))), 0);
}

function estimateToolRows(tools: ChatMessage["toolCalls"]): number {
  return (tools ?? []).reduce((sum, tool) => {
    const model = describeToolCard(tool);
    if (model.compact) return sum + 1;
    const bodyLines =
      model.body.length === 0 ? 0 : Math.min(16, model.body.split(/\r?\n/).length + 1);
    return sum + 3 + model.fields.length + bodyLines;
  }, 0);
}

/**
 * Estimate how many terminal rows a message occupies so the window can hold a
 * roughly constant amount of visible content regardless of message length.
 */
export function estimateRows(message: ChatMessage, width: number): number {
  const source = message.role === "assistant" ? assistantSource(message.content) : message.content;
  const textRows = estimateProseRows(source, width);
  const toolRows = estimateToolRows(message.toolCalls);
  return Math.max(1, textRows + toolRows + 1);
}

function lastConversationalIndex(messages: readonly ChatMessage[], end: number): number {
  for (let i = end - 1; i >= 0; i--) {
    const message = messages[i];
    if (message !== undefined && isConversational(message)) return i;
  }
  return -1;
}

function windowByBudget(
  messages: readonly ChatMessage[],
  from: number,
  end: number,
  height: number,
  width: number,
): { readonly visible: readonly ChatMessage[]; readonly hiddenAbove: number } {
  let budget = height;
  let start = end;
  while (start > from) {
    const message = messages[start - 1];
    if (message === undefined) break;
    const rows = estimateRows(message, width);
    if (budget - rows < 0 && start < end) break;
    budget -= rows;
    start--;
  }
  return { visible: messages.slice(start, end), hiddenAbove: start };
}

/**
 * Select the trailing slice of messages that fits the available height.
 *
 * The last conversational bubble (user / assistant prose / error) is kept even
 * when a trailing tool card would otherwise spend the whole budget.
 */
export function windowMessages(
  messages: readonly ChatMessage[],
  height: number,
  width: number,
  scrollOffset = 0,
): { readonly visible: readonly ChatMessage[]; readonly hiddenAbove: number } {
  if (messages.length === 0) return { visible: [], hiddenAbove: 0 };

  const end = Math.max(1, messages.length - scrollOffset);
  const lastProse = lastConversationalIndex(messages, end);
  if (lastProse < 0) {
    return windowByBudget(messages, 0, end, height, width);
  }

  const prose = messages[lastProse];
  if (prose === undefined) return windowByBudget(messages, 0, end, height, width);

  const include = new Set<number>([lastProse]);
  let budget = height - estimateRows(prose, width);

  for (let i = lastProse + 1; i < end && budget > 0; i++) {
    const message = messages[i];
    if (message === undefined) break;
    const rows = estimateRows(message, width);
    if (budget - rows < 0) break;
    include.add(i);
    budget -= rows;
  }

  for (let i = lastProse - 1; i >= 0 && budget > 0; i--) {
    const message = messages[i];
    if (message === undefined) break;
    const rows = estimateRows(message, width);
    if (budget - rows < 0) break;
    include.add(i);
    budget -= rows;
  }

  const start = Math.min(...include);
  const lastIncluded = Math.max(...include);
  return { visible: messages.slice(start, lastIncluded + 1), hiddenAbove: start };
}

function itemIsConversational(item: TranscriptItem): boolean {
  if (item.kind === "turn") return item.assistant.content.trim().length > 0;
  return isConversational(item.message);
}

function activityWindowRows(
  tools: ReturnType<typeof visibleTools>,
  lifecycleCount: number,
  expanded: boolean,
): number {
  if (expanded) return estimateToolRows(tools) + Math.min(8, lifecycleCount);
  return tools.length > 0 ? 1 : 0;
}

function estimateItemRows(item: TranscriptItem, width: number, expanded: boolean): number {
  if (item.kind === "message") return estimateRows(item.message, width);
  const source = assistantSource(item.assistant.content);
  const textRows = estimateProseRows(source, width);
  const tools = visibleTools(item.tools, item.assistant.content);
  return Math.max(1, textRows + activityWindowRows(tools, item.lifecycle.length, expanded) + 1);
}

function lastConversationalItemIndex(items: readonly TranscriptItem[], end: number): number {
  for (let i = end - 1; i >= 0; i--) {
    const item = items[i];
    if (item !== undefined && itemIsConversational(item)) return i;
  }
  return -1;
}

/**
 * Window grouped transcript cells so the painted height stays inside the
 * allocated rows. Ink will otherwise overpaint the input bar when a wrap box
 * and a lifecycle rail share one overflow.
 */
export function windowTranscript(
  items: readonly TranscriptItem[],
  height: number,
  width: number,
  scrollOffset: number,
  expanded: (item: TranscriptItem) => boolean,
): { readonly visible: readonly TranscriptItem[]; readonly hiddenAbove: number } {
  if (items.length === 0) return { visible: [], hiddenAbove: 0 };
  const end = Math.max(1, items.length - scrollOffset);
  const lastProse = lastConversationalItemIndex(items, end);

  const walk = (from: number, until: number, budget: number): number => {
    let start = until;
    let remaining = budget;
    while (start > from) {
      const item = items[start - 1];
      if (item === undefined) break;
      const rows = estimateItemRows(item, width, expanded(item));
      if (remaining - rows < 0 && start < until) break;
      remaining -= rows;
      start--;
    }
    return start;
  };

  if (lastProse < 0) {
    const start = walk(0, end, height);
    return { visible: items.slice(start, end), hiddenAbove: start };
  }

  const prose = items[lastProse];
  if (prose === undefined) {
    const start = walk(0, end, height);
    return { visible: items.slice(start, end), hiddenAbove: start };
  }

  const include = new Set<number>([lastProse]);
  let budget = height - estimateItemRows(prose, width, expanded(prose));

  for (let i = lastProse + 1; i < end && budget > 0; i++) {
    const item = items[i];
    if (item === undefined) break;
    const rows = estimateItemRows(item, width, expanded(item));
    if (budget - rows < 0) break;
    include.add(i);
    budget -= rows;
  }
  for (let i = lastProse - 1; i >= 0 && budget > 0; i--) {
    const item = items[i];
    if (item === undefined) break;
    const rows = estimateItemRows(item, width, expanded(item));
    if (budget - rows < 0) break;
    include.add(i);
    budget -= rows;
  }

  const start = Math.min(...include);
  const lastIncluded = Math.max(...include);
  return { visible: items.slice(start, lastIncluded + 1), hiddenAbove: start };
}

function MessageBody({
  message,
  width,
}: {
  readonly message: ChatMessage;
  readonly width: number;
}): React.ReactElement | null {
  const theme = useTheme();
  const tint = roleColor(theme, message.role);
  const gutter = roleGutter(theme, message.role);
  const dim = message.role === "system";
  const source = message.role === "assistant" ? assistantSource(message.content) : message.content;
  if (source.length === 0) return null;

  return (
    <Box>
      <Box width={GUTTER} flexShrink={0}>
        <Text bold {...fg(gutterColor(theme, message.role))}>
          {gutter}
        </Text>
      </Box>
      <Box flexGrow={1} flexDirection="column">
        {renderAsMarkdown(message) ? (
          <Markdown source={source} width={width - GUTTER} />
        ) : (
          <Text {...fg(tint)} dimColor={dim} wrap="wrap">
            {source}
          </Text>
        )}
        {message.streaming === true ? (
          <Text {...fg(theme.colors.accent)}>{theme.glyphs.caret}</Text>
        ) : null}
      </Box>
    </Box>
  );
}

function MessageBlock({
  message,
  width,
}: {
  readonly message: ChatMessage;
  readonly width: number;
}): React.ReactElement {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <MessageBody message={message} width={width} />
      {message.toolCalls !== undefined && message.toolCalls.length > 0 ? (
        <Box flexDirection="column" marginLeft={GUTTER}>
          {message.toolCalls.map((toolCall) => (
            <ToolCard key={toolCall.id} toolCall={toolCall} detail="focus" width={width - GUTTER} />
          ))}
        </Box>
      ) : null}
    </Box>
  );
}

function TurnBlock({
  item,
  expanded,
  width,
}: {
  readonly item: Extract<TranscriptItem, { kind: "turn" }>;
  readonly expanded: boolean;
  readonly width: number;
}): React.ReactElement {
  const tools = visibleTools(item.tools, item.assistant.content);
  return (
    <Box flexDirection="column" marginBottom={1}>
      <MessageBody message={item.assistant} width={width} />
      <ActivityBlock
        tools={tools}
        lifecycle={item.lifecycle}
        expanded={expanded}
        width={width - GUTTER}
        {...(item.assistant.turn !== undefined ? { turn: item.assistant.turn } : {})}
      />
    </Box>
  );
}

/** Empty-state copy shown before the first turn, doubling as a keybinding cheat sheet. */
function EmptyState(): React.ReactElement {
  const theme = useTheme();
  const { colors, glyphs, text } = theme;
  const key = (label: string): React.ReactElement => (
    <Text bold {...fg(colors.accentAlt)}>
      {label}
    </Text>
  );
  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text {...text.accent}>cantilune</Text>
        <Text {...text.muted}> {glyphs.sep} coordination OS for agent clusters</Text>
      </Box>
      <Text {...text.muted}>
        Describe a task to boot the world, or press {key("/")} for commands.
      </Text>
      <Text {...text.muted}>
        {key("Ctrl+O")} observe {glyphs.sep} {key("Ctrl+T")} tools {glyphs.sep} {key("PgUp")} scroll{" "}
        {glyphs.sep} {key("Ctrl+C")} interrupt
      </Text>
    </Box>
  );
}

export function ChatPanel({
  messages,
  height = 20,
  width = 100,
  detail = "focus",
  scrollOffset = 0,
  expandedTurns = [],
}: ChatPanelProps): React.ReactElement {
  const theme = useTheme();
  const items = groupTranscript(messages);
  const expandedOf = (item: TranscriptItem): boolean => {
    if (item.kind !== "turn") return false;
    if (detail === "observe") return true;
    return expandedTurns.includes(turnKey(item));
  };
  const { visible, hiddenAbove } = windowTranscript(items, height, width, scrollOffset, expandedOf);

  return (
    <Box flexDirection="column" height={height} flexShrink={0} paddingX={1}>
      {messages.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {hiddenAbove > 0 ? (
            <Text {...theme.text.muted}>
              {theme.glyphs.ellipsis} {hiddenAbove} earlier message
              {hiddenAbove === 1 ? "" : "s"} (PgUp to scroll)
            </Text>
          ) : null}
          {visible.map((item, index) =>
            item.kind === "turn" ? (
              <TurnBlock
                key={`turn-${turnKey(item)}-${hiddenAbove + index}`}
                item={item}
                expanded={expandedOf(item)}
                width={width}
              />
            ) : (
              <MessageBlock
                key={`${item.message.timestamp}-${hiddenAbove + index}`}
                message={item.message}
                width={width}
              />
            ),
          )}
          {scrollOffset > 0 ? (
            <Text {...theme.text.warning}>
              {theme.glyphs.ellipsis} scrolled back {scrollOffset} (Esc to return)
            </Text>
          ) : null}
        </>
      )}
    </Box>
  );
}
