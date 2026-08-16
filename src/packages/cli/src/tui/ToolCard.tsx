import React from "react";
import { Box, Text } from "ink";
import type { ToolCallDisplay } from "../store.js";
import { useTheme } from "../theme/themeContext.js";
import { border, fg, type Color, type TextStyle, type Theme } from "../theme/theme.js";
import { Spinner, formatDuration } from "./Spinner.js";
import { describeToolCard, type ToolCardModel, type ToolFamily } from "./formatToolCard.js";

export interface ToolCardProps {
  readonly toolCall: ToolCallDisplay;
  /** `focus` caps the body; `observe` shows a longer excerpt. */
  readonly detail?: "focus" | "observe";
  readonly width?: number;
}

const FOCUS_BODY_LINES = 16;
const OBSERVE_BODY_LINES = 40;

function statusColor(theme: Theme, status: ToolCallDisplay["status"]): Color {
  switch (status) {
    case "done":
      return theme.colors.success;
    case "running":
      return theme.colors.warning;
    case "error":
      return theme.colors.danger;
    default:
      return theme.colors.muted;
  }
}

function statusGlyph(theme: Theme, status: ToolCallDisplay["status"]): string {
  switch (status) {
    case "done":
      return theme.glyphs.ok;
    case "error":
      return theme.glyphs.fail;
    default:
      return theme.glyphs.pending;
  }
}

function markerTint(theme: Theme, toolCall: ToolCallDisplay): Color {
  if (toolCall.coordination === true) return theme.colors.accentAlt;
  return statusColor(theme, toolCall.status);
}

function borderTint(theme: Theme, failed: boolean, coordination: boolean): Color {
  if (failed) return theme.colors.danger;
  if (coordination) return theme.colors.accentAlt;
  return theme.colors.border;
}

function prefixFor(family: ToolFamily): string {
  return family === "shell" ? "$ " : "";
}

function headlineStyle(theme: Theme, family: ToolFamily): TextStyle {
  return family === "shell" ? theme.text.accent : theme.text.heading;
}

function clipBody(
  text: string,
  maxLines: number,
): { readonly lines: readonly string[]; readonly hidden: number } {
  if (text.length === 0) return { lines: [], hidden: 0 };
  const all = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  if (all.length <= maxLines) return { lines: all, hidden: 0 };
  return { lines: all.slice(0, maxLines), hidden: all.length - maxLines };
}

function clip(value: string, budget: number, ellipsis: string): string {
  if (value.length <= budget) return value;
  return `${value.slice(0, Math.max(0, budget - ellipsis.length))}${ellipsis}`;
}

/**
 * One tool invocation in the transcript.
 *
 * Successful calls show the command/query and the real result — not a
 * collapsed `key=json` line. `done` stays a single completion claim.
 * Failures always expand and tint danger.
 */
export function ToolCard({
  toolCall,
  detail = "focus",
  width = 100,
}: ToolCardProps): React.ReactElement {
  const theme = useTheme();
  const model = describeToolCard(toolCall);
  const coordination = toolCall.coordination === true;
  const tint = markerTint(theme, toolCall);
  const running = toolCall.status === "running";
  const failed = toolCall.status === "error" || toolCall.result?.ok === false;
  const duration =
    toolCall.startedAt !== undefined && toolCall.endedAt !== undefined
      ? formatDuration(toolCall.endedAt - toolCall.startedAt)
      : undefined;
  const inner = Math.max(24, width - 4);
  const maxLines = detail === "observe" ? OBSERVE_BODY_LINES : FOCUS_BODY_LINES;
  const compact = model.compact && !failed && !running;

  const marker = running ? (
    <Spinner color={tint} />
  ) : (
    <Text {...fg(tint)}>{statusGlyph(theme, toolCall.status)}</Text>
  );

  if (compact) {
    return (
      <Box>
        {marker}
        <Text {...fg(tint)}> {model.title}</Text>
        {model.headline.length > 0 ? (
          <Text {...theme.text.muted}>
            {" "}
            {clip(model.headline, Math.max(16, inner - 12), theme.glyphs.ellipsis)}
          </Text>
        ) : null}
        {duration !== undefined ? (
          <Text {...theme.text.muted}>
            {" "}
            {theme.glyphs.sep} {duration}
          </Text>
        ) : null}
      </Box>
    );
  }

  return (
    <Box
      flexDirection="column"
      paddingX={1}
      borderStyle={theme.border}
      {...border(borderTint(theme, failed, coordination))}
    >
      <Box>
        {marker}
        <Text bold {...fg(tint)}>
          {" "}
          {model.title}
        </Text>
        {duration !== undefined ? (
          <Text {...theme.text.muted}>
            {" "}
            {theme.glyphs.sep} {duration}
          </Text>
        ) : null}
        {running ? <Text {...theme.text.muted}> running</Text> : null}
      </Box>

      {model.headline.length > 0 ? (
        <Text {...headlineStyle(theme, model.family)}>
          {prefixFor(model.family)}
          {model.headline}
        </Text>
      ) : null}

      {model.fields.map((field) => (
        <Text key={field.label} {...theme.text.muted}>
          {field.label}
          {theme.glyphs.sep} {field.value}
        </Text>
      ))}

      <ToolBody model={model} failed={failed} maxLines={maxLines} />
    </Box>
  );
}

function ToolBody({
  model,
  failed,
  maxLines,
}: {
  readonly model: ToolCardModel;
  readonly failed: boolean;
  readonly maxLines: number;
}): React.ReactElement | null {
  const theme = useTheme();
  if (model.body.length === 0) return null;
  const { lines, hidden } = clipBody(model.body, maxLines);
  const style = failed ? theme.text.danger : theme.text.muted;

  return (
    <Box
      flexDirection="column"
      marginTop={model.headline.length > 0 || model.fields.length > 0 ? 1 : 0}
    >
      {lines.map((line, index) => (
        <Text key={index} {...style} wrap="wrap">
          {line.length === 0 ? " " : line}
        </Text>
      ))}
      {hidden > 0 ? (
        <Text {...theme.text.muted}>
          {theme.glyphs.ellipsis} {hidden} more line{hidden === 1 ? "" : "s"}
        </Text>
      ) : null}
    </Box>
  );
}
