import React from "react";
import { Box, Text } from "ink";

export interface ProgressBarProps {
  readonly label: string;
  readonly progress: number;
  readonly width?: number;
}

export function ProgressBar({ label, progress, width = 30 }: ProgressBarProps): React.ReactElement {
  const clamped = Math.max(0, Math.min(1, progress));
  const filled = Math.round(clamped * width);
  const bar = `${"█".repeat(filled)}${"░".repeat(width - filled)}`;
  const pct = Math.round(clamped * 100);

  return (
    <Box flexDirection="column">
      <Text>
        {label} [{bar}] {pct}%
      </Text>
    </Box>
  );
}
