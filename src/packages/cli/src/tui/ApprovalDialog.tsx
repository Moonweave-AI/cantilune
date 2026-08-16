/**
 * Human authorization prompt for a side-effecting tool.
 *
 * The prompt's job is to make the decision answerable: it names the tool, its
 * side-effect tier, and the exact canonical arguments that will be dispatched.
 * A prompt that says only "run shell?" is not a control — the operator would be
 * approving something they cannot see.
 */
import React from "react";
import { Box, Text, useInput } from "ink";
import type { ToolApprovalRequest, ToolExecutionTier } from "@cantilune/syscall";
import { useTheme } from "../theme/themeContext.js";
import { border, fg, type Theme, type TextStyle } from "../theme/theme.js";

/** What the operator chose. `always` allows this tool for the rest of the run. */
export type ApprovalChoice = "once" | "always" | "deny";

export interface ApprovalDialogProps {
  readonly request: ToolApprovalRequest;
  readonly onDecide: (choice: ApprovalChoice) => void;
  /** Columns available; long argument values are truncated to fit. */
  readonly width?: number;
}

/** Lines of argument detail shown before the rest is summarized. */
const MAX_ARG_ROWS = 8;

/** How a tier reads to a human, and how loudly it should be presented. */
function describeTier(
  theme: Theme,
  tier: ToolExecutionTier,
): {
  readonly label: string;
  readonly style: TextStyle;
} {
  if (tier === "non-idempotent") {
    return { label: "irreversible — cannot be safely retried", style: theme.text.danger };
  }
  if (tier === "idempotent") {
    return { label: "repeatable — safe to retry", style: theme.text.warning };
  }
  return { label: "read-only", style: theme.text.info };
}

/** Render one argument value on a single line, truncated to the width budget. */
export function formatArgValue(value: unknown, budget: number): string {
  const rendered = typeof value === "string" ? value : (JSON.stringify(value) ?? String(value));
  const flattened = rendered.replace(/\s*\n\s*/g, " ");
  return flattened.length <= budget ? flattened : `${flattened.slice(0, Math.max(1, budget - 1))}…`;
}

export function ApprovalDialog({
  request,
  onDecide,
  width = 100,
}: ApprovalDialogProps): React.ReactElement {
  const theme = useTheme();
  const { colors, glyphs, text } = theme;
  const tier = describeTier(theme, request.tier);

  useInput((input, key) => {
    const pressed = input.toLowerCase();
    if (key.return || pressed === "y") {
      onDecide("once");
      return;
    }
    if (pressed === "a") {
      onDecide("always");
      return;
    }
    if (key.escape || pressed === "n") {
      onDecide("deny");
    }
  });

  const entries = Object.entries(request.args);
  const shown = entries.slice(0, MAX_ARG_ROWS);
  const hidden = entries.length - shown.length;
  const keyWidth = Math.max(0, ...shown.map(([name]) => name.length));
  const valueBudget = Math.max(20, width - keyWidth - 8);

  return (
    <Box
      flexDirection="column"
      borderStyle={theme.border}
      {...border(request.tier === "non-idempotent" ? colors.danger : colors.warning)}
      paddingX={1}
    >
      <Box>
        <Text {...text.warning}>{glyphs.warn} Authorize tool </Text>
        <Text bold {...fg(colors.accent)}>
          {request.toolName}
        </Text>
      </Box>
      <Text {...tier.style}>
        {glyphs.sep} {tier.label}
      </Text>

      {shown.length > 0 ? (
        <Box flexDirection="column" marginTop={1}>
          {shown.map(([name, value]) => (
            <Box key={name}>
              <Box width={keyWidth + 2} flexShrink={0}>
                <Text {...text.muted}>{name}</Text>
              </Box>
              <Text wrap="truncate-end">{formatArgValue(value, valueBudget)}</Text>
            </Box>
          ))}
          {hidden > 0 ? (
            <Text {...text.muted}>
              {glyphs.ellipsis} {hidden} more argument{hidden === 1 ? "" : "s"}
            </Text>
          ) : null}
        </Box>
      ) : (
        <Text {...text.muted}>(no arguments)</Text>
      )}

      <Box marginTop={1}>
        <Text {...text.muted}>
          Y/Enter run once {glyphs.sep} A allow {request.toolName} for this run {glyphs.sep} N/Esc
          deny
        </Text>
      </Box>
    </Box>
  );
}
