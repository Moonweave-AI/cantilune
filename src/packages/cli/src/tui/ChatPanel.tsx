import React from "react";
import { Box, Text } from "ink";
import type { ChatMessage } from "../store.js";
import { useTheme } from "../theme/themeContext.js";
import { fg, type Color, type Theme } from "../theme/theme.js";
import { ToolCard } from "./ToolCard.js";
import { LifecycleRail } from "./LifecycleRail.js";

export interface ChatPanelProps {
  readonly messages: readonly ChatMessage[];
  /** Visible rows available to the transcript; drives the scrollback window. */
  readonly height?: number;
  readonly width?: number;
  readonly detail?: "focus" | "observe";
  /** Rows scrolled back from the bottom. 0 pins to the newest message. */
  readonly scrollOffset?: number;
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

/** Conditionally spread the optional turn prop onto the LifecycleRail. */
function lifecycleRailProps(message: ChatMessage): { turn?: number } {
  return message.turn !== undefined ? { turn: message.turn } : {};
}

/**
 * Estimate how many terminal rows a message occupies so the window can hold a
 * roughly constant amount of visible content regardless of message length.
 */
function estimateRows(message: ChatMessage, width: number): number {
  const textRows = message.content
    .split("\n")
    .reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / Math.max(20, width))), 0);
  const toolRows = (message.toolCalls?.length ?? 0) * 2;
  // Each lifecycle line is roughly one row, plus an optional detail row.
  const lifecycleRows = (message.lifecycle ?? []).reduce(
    (sum, line) => sum + (line.detail !== undefined ? 2 : 1),
    0,
  );
  return textRows + toolRows + lifecycleRows + 1;
}

/**
 * Select the trailing slice of messages that fits the available height.
 *
 * Ink has no native scroll region, so the transcript is windowed: we walk
 * backwards accumulating estimated rows until the budget is spent.
 */
export function windowMessages(
  messages: readonly ChatMessage[],
  height: number,
  width: number,
  scrollOffset = 0,
): { readonly visible: readonly ChatMessage[]; readonly hiddenAbove: number } {
  if (messages.length === 0) return { visible: [], hiddenAbove: 0 };

  const end = Math.max(1, messages.length - scrollOffset);
  let budget = height;
  let start = end;

  while (start > 0) {
    const message = messages[start - 1];
    if (message === undefined) break;
    const rows = estimateRows(message, width);
    if (budget - rows < 0 && start < end) break;
    budget -= rows;
    start--;
  }

  return { visible: messages.slice(start, end), hiddenAbove: start };
}

function MessageBlock({
  message,
  detail,
  width,
}: {
  readonly message: ChatMessage;
  readonly detail: "focus" | "observe";
  readonly width: number;
}): React.ReactElement {
  const theme = useTheme();
  const tint = roleColor(theme, message.role);
  const gutter = roleGutter(theme, message.role);
  const hasText = message.content.length > 0;
  const dim = message.role === "system";
  const hasLifecycle = message.lifecycle !== undefined && message.lifecycle.length > 0;

  return (
    <Box flexDirection="column" marginBottom={1}>
      {hasText ? (
        <Box>
          <Box width={GUTTER} flexShrink={0}>
            <Text bold {...fg(gutterColor(theme, message.role))}>
              {gutter}
            </Text>
          </Box>
          <Box flexGrow={1}>
            <Text {...fg(tint)} dimColor={dim} wrap="wrap">
              {message.content}
              {message.streaming === true ? (
                <Text {...fg(theme.colors.accent)}>{theme.glyphs.caret}</Text>
              ) : null}
            </Text>
          </Box>
        </Box>
      ) : null}

      {hasLifecycle ? (
        <Box marginLeft={GUTTER}>
          <LifecycleRail
            lines={message.lifecycle!}
            {...lifecycleRailProps(message)}
            width={width - GUTTER}
          />
        </Box>
      ) : null}

      {message.toolCalls !== undefined && message.toolCalls.length > 0 ? (
        <Box flexDirection="column" marginLeft={GUTTER}>
          {message.toolCalls.map((toolCall) => (
            <ToolCard
              key={toolCall.id}
              toolCall={toolCall}
              detail={detail}
              width={width - GUTTER}
            />
          ))}
        </Box>
      ) : null}
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
        {key("Ctrl+O")} observe layout {glyphs.sep} {key("Ctrl+C")} interrupt {glyphs.sep}{" "}
        {key("PgUp")} scroll back
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
}: ChatPanelProps): React.ReactElement {
  const theme = useTheme();
  const { visible, hiddenAbove } = windowMessages(messages, height, width, scrollOffset);

  return (
    <Box flexDirection="column" flexGrow={1} paddingX={1}>
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
          {visible.map((message, index) => (
            <MessageBlock
              key={`${message.timestamp}-${hiddenAbove + index}`}
              message={message}
              detail={detail}
              width={width}
            />
          ))}
          {scrollOffset > 0 ? (
            <Text {...theme.text.warning}>
              {theme.glyphs.ellipsis} scrolled back {scrollOffset} (End to return)
            </Text>
          ) : null}
        </>
      )}
    </Box>
  );
}
