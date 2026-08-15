import React from "react";
import { Box, Text } from "ink";
import { useTheme } from "../theme/themeContext.js";
import { fg } from "../theme/theme.js";

export interface DiffViewProps {
  readonly left: string;
  readonly right: string;
  readonly leftLabel: string;
  readonly rightLabel: string;
}

function diffLines(left: string, right: string): { leftLines: string[]; rightLines: string[] } {
  const leftLines = left.split("\n");
  const rightLines = right.split("\n");
  return { leftLines, rightLines };
}

/**
 * Side-by-side comparison.
 *
 * Removals and additions carry both a colour and a `−`/`+` sigil, so the diff
 * stays readable under the monochrome theme and for colour-blind users.
 */
export function DiffView({
  left,
  right,
  leftLabel,
  rightLabel,
}: DiffViewProps): React.ReactElement {
  const { colors } = useTheme();
  const { leftLines, rightLines } = diffLines(left, right);
  const maxRows = Math.max(leftLines.length, rightLines.length);

  return (
    <Box flexDirection="column">
      <Box>
        <Box width="50%" marginRight={1}>
          <Text bold {...fg(colors.danger)}>
            − {leftLabel}
          </Text>
        </Box>
        <Box width="50%">
          <Text bold {...fg(colors.success)}>
            + {rightLabel}
          </Text>
        </Box>
      </Box>
      {Array.from({ length: maxRows }, (_, i) => {
        const l = leftLines[i] ?? "";
        const r = rightLines[i] ?? "";
        const same = l === r;
        return (
          <Box key={i}>
            <Box width="50%" marginRight={1}>
              <Text {...(same ? {} : fg(colors.danger))}>
                {same ? "  " : "− "}
                {l || " "}
              </Text>
            </Box>
            <Box width="50%">
              <Text {...(same ? {} : fg(colors.success))}>
                {same ? "  " : "+ "}
                {r || " "}
              </Text>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

export default DiffView;
