import React from "react";
import { Box, Text } from "ink";
import type { LifecycleLine } from "../store.js";
import { useTheme } from "../theme/themeContext.js";
import { fg, type Color, type Theme } from "../theme/theme.js";
import { formatRelative } from "./timeFormat.js";

export interface LifecycleRailProps {
  readonly lines: readonly LifecycleLine[];
  /** Turn number, shown as the rail header (`t3 lifecycle`). */
  readonly turn?: number;
  readonly width?: number;
}

/**
 * The vertical lifecycle rail rendered inline beneath an assistant message.
 *
 * This is what makes the default transcript a complete lifecycle view: every
 * stage the agent went through — turn open, LLM thinking, each tool dispatch
 * (coordination tools in the cluster accent), diagnostics, errors, turn close
 * — is shown by default, in time order, indented under a rule so it reads as
 * one turn's work. No slash-command switch is needed to see it; `/events`
 * remains as the pure-stream alternative lens on the same process.
 *
 * Each line: `│ glyph  +0.4s  label`. The glyph and tint are chosen per stage;
 * coordination lines use the secondary accent (purple) so cluster activity is
 * visually distinct. A `detail` line indents further in muted text.
 */
export function LifecycleRail({
  lines,
  turn,
  width = 100,
}: LifecycleRailProps): React.ReactElement | null {
  const theme = useTheme();
  if (lines.length === 0) return null;
  const base = lines[0]!.ts;
  const rule = theme.glyphs.rule;
  const labelBudget = Math.max(20, width - 18);

  return (
    <Box flexDirection="column" marginTop={0}>
      {turn !== undefined ? (
        <Text {...theme.text.muted}>
          {rule} t{turn} lifecycle
        </Text>
      ) : null}
      {lines.map((line, index) => {
        const { glyph, color } = stageStyle(theme, line.stage, line.coordination === true);
        const indent = index === lines.length - 1 ? theme.glyphs.rule : rule;
        return (
          <Box key={index} flexDirection="column">
            <Box>
              <Text {...theme.text.muted}>{indent} </Text>
              <Text {...fg(color)}>{glyph}</Text>
              <Text {...theme.text.muted}> {formatRelative(line.ts, base).padEnd(7)} </Text>
              <Text {...fg(color)} wrap="truncate-end">
                {clipLabel(line.label, labelBudget, theme.glyphs.ellipsis)}
              </Text>
            </Box>
            {line.detail !== undefined && line.detail.length > 0 ? (
              <Box marginLeft={4}>
                <Text {...theme.text.muted} wrap="truncate-end">
                  {clipLabel(line.detail, Math.max(20, labelBudget - 2), theme.glyphs.ellipsis)}
                </Text>
              </Box>
            ) : null}
          </Box>
        );
      })}
    </Box>
  );
}

/** Per-stage glyph + tint. Coordination overrides with the cluster accent. */
function stageStyle(
  theme: Theme,
  stage: LifecycleLine["stage"],
  coordination: boolean,
): { glyph: string; color: Color } {
  switch (stage) {
    case "turn_open":
      return { glyph: "╭", color: theme.colors.muted };
    case "llm":
      return { glyph: "◆", color: theme.colors.accentAlt };
    case "tool_start":
      return {
        glyph: "▶",
        color: coordination ? theme.colors.accentAlt : theme.colors.warning,
      };
    case "tool_end":
      return {
        glyph: "■",
        color: coordination ? theme.colors.accentAlt : theme.colors.success,
      };
    case "diagnostic":
      return { glyph: "⚠", color: theme.colors.warning };
    case "error":
      return { glyph: "✗", color: theme.colors.danger };
    case "turn_close":
      return { glyph: "╰", color: theme.colors.muted };
    default:
      return { glyph: "·", color: theme.colors.muted };
  }
}

function clipLabel(value: string, budget: number, ellipsis: string): string {
  if (value.length <= budget) return value;
  return `${value.slice(0, Math.max(0, budget - ellipsis.length))}${ellipsis}`;
}
