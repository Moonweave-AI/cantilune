import React from "react";
import { Box, Text } from "ink";
import type { ToolCallDisplay } from "../store.js";
import { useTheme } from "../theme/themeContext.js";
import { border, fg, type Color, type Theme } from "../theme/theme.js";
import { Spinner, formatDuration } from "./Spinner.js";

export interface ToolCardProps {
  readonly toolCall: ToolCallDisplay;
  /** `focus` collapses to a single line; `observe` shows args and full output. */
  readonly detail?: "focus" | "observe";
  readonly width?: number;
}

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

/** Clip to `budget` columns, marking the cut with the theme's ellipsis. */
function clip(value: string, budget: number, ellipsis: string): string {
  if (value.length <= budget) return value;
  return `${value.slice(0, Math.max(0, budget - ellipsis.length))}${ellipsis}`;
}

/** Condense arguments into a single readable line: `key=value key=value`. */
function summarizeArgs(args: Record<string, unknown>, budget: number, ellipsis: string): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(args)) {
    const rendered = typeof value === "string" ? value : JSON.stringify(value);
    const flat = rendered.replace(/\s+/g, " ").trim();
    parts.push(`${key}=${flat}`);
  }
  return clip(parts.join(" "), budget, ellipsis);
}

function firstLine(text: string, budget: number, ellipsis: string): string {
  return clip(text.split("\n", 1)[0] ?? "", budget, ellipsis);
}

/**
 * Resolve the marker tint: coordination tools take the cluster accent
 * (`accentAlt`) so cluster activity is visually distinct from ordinary
 * read/write/`tool:` dispatches; everything else uses its status colour.
 */
function markerTint(theme: Theme, toolCall: ToolCallDisplay): Color {
  if (toolCall.coordination === true) return theme.colors.accentAlt;
  return statusColor(theme, toolCall.status);
}

/**
 * Resolve the expanded-card border colour: a failure always wins (danger),
 * otherwise a coordination tool uses the cluster accent, else the default.
 */
function borderTint(theme: Theme, failed: boolean, coordination: boolean): Color {
  if (failed) return theme.colors.danger;
  if (coordination) return theme.colors.accentAlt;
  return theme.colors.border;
}

/**
 * One tool invocation in the transcript.
 *
 * Collapsed to a single dim line by default so a long tool chain reads as a
 * quiet checklist rather than drowning the conversation. Failures always
 * expand — a collapsed error is the thing users most need to see.
 *
 * Coordination (cluster-affecting) tools render in the secondary accent
 * (purple) so cluster activity is visually distinct from ordinary
 * read/write/`tool:` dispatches — the colour is the signal that this call
 * changed the coordination world, not just the content store.
 */
export function ToolCard({
  toolCall,
  detail = "focus",
  width = 100,
}: ToolCardProps): React.ReactElement {
  const theme = useTheme();
  const { ellipsis } = theme.glyphs;
  const coordination = toolCall.coordination === true;
  const tint = markerTint(theme, toolCall);
  const running = toolCall.status === "running";
  const duration =
    toolCall.startedAt !== undefined && toolCall.endedAt !== undefined
      ? formatDuration(toolCall.endedAt - toolCall.startedAt)
      : undefined;

  const failed = toolCall.status === "error" || toolCall.result?.ok === false;
  const expanded = detail === "observe" || failed;

  const marker = running ? (
    <Spinner color={tint} />
  ) : (
    <Text {...fg(tint)}>{statusGlyph(theme, toolCall.status)}</Text>
  );

  if (!expanded) {
    const budget = Math.max(20, width - toolCall.name.length - 16);
    return (
      <Box>
        {marker}
        <Text {...fg(tint)}> {toolCall.name}</Text>
        <Text {...theme.text.muted}> {summarizeArgs(toolCall.args, budget, ellipsis)}</Text>
        {duration !== undefined ? (
          <Text {...theme.text.muted}>
            {" "}
            {theme.glyphs.sep} {duration}
          </Text>
        ) : null}
      </Box>
    );
  }

  // Successful output is clipped to one line; failures print in full and in red.
  const result = toolCall.result;
  let resultLine: React.ReactElement | null = null;
  if (result !== undefined) {
    const resultTint = result.ok ? undefined : theme.colors.danger;
    const body = result.ok
      ? firstLine(result.output, Math.max(60, width - 4), ellipsis)
      : result.output;
    resultLine = (
      <Text {...fg(resultTint)} wrap="wrap">
        {body}
      </Text>
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
          {toolCall.name}
        </Text>
        {duration !== undefined ? (
          <Text {...theme.text.muted}>
            {" "}
            {theme.glyphs.sep} {duration}
          </Text>
        ) : null}
      </Box>

      {Object.keys(toolCall.args).length > 0 ? (
        <Text {...theme.text.muted} wrap="truncate-end">
          {summarizeArgs(toolCall.args, Math.max(40, width - 4), ellipsis)}
        </Text>
      ) : null}

      {resultLine}
    </Box>
  );
}
