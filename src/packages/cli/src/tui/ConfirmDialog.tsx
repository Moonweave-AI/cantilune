import React from "react";
import { Box, Text, useInput } from "ink";
import { useTheme } from "../theme/themeContext.js";
import { border } from "../theme/theme.js";

export interface ConfirmDialogProps {
  readonly message: string;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

export function ConfirmDialog({
  message,
  onConfirm,
  onCancel,
}: ConfirmDialogProps): React.ReactElement {
  const theme = useTheme();
  const { colors, glyphs, text } = theme;

  useInput((input, key) => {
    if (key.return || input.toLowerCase() === "y") {
      onConfirm();
      return;
    }
    if (key.escape || input.toLowerCase() === "n") {
      onCancel();
    }
  });

  return (
    <Box flexDirection="column" borderStyle={theme.border} {...border(colors.danger)} paddingX={1}>
      <Box>
        <Text {...text.danger}>{glyphs.fail} Confirm</Text>
      </Box>
      <Text>{message}</Text>
      <Text {...text.muted}>Y/Enter confirm {glyphs.sep} N/Esc cancel</Text>
    </Box>
  );
}
