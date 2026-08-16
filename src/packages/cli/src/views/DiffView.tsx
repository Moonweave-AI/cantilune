import React from "react";
import { Box, Text } from "ink";
import { useTheme } from "../theme/themeContext.js";
import { fg } from "../theme/theme.js";
import { alignLineDiff, type AlignedDiffKind } from "../render/lineDiff.js";

function leftSigil(kind: AlignedDiffKind): string {
  return kind === "delete" || kind === "replace" ? "− " : "  ";
}

function rightSigil(kind: AlignedDiffKind): string {
  return kind === "insert" || kind === "replace" ? "+ " : "  ";
}

export interface DiffViewProps {
  readonly left: string;
  readonly right: string;
  readonly leftLabel: string;
  readonly rightLabel: string;
}

/**
 * Side-by-side comparison aligned by LCS so moved lines stay paired.
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
  const rows = alignLineDiff(left, right);

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
      {rows.map((row, i) => {
        const same = row.kind === "equal";
        return (
          <Box key={i}>
            <Box width="50%" marginRight={1}>
              <Text {...(same ? {} : fg(colors.danger))}>
                {leftSigil(row.kind)}
                {row.left || " "}
              </Text>
            </Box>
            <Box width="50%">
              <Text {...(same ? {} : fg(colors.success))}>
                {rightSigil(row.kind)}
                {row.right || " "}
              </Text>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

export default DiffView;
