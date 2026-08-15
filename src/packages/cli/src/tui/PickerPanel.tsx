import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { useTheme } from "../theme/themeContext.js";
import { border, fg } from "../theme/theme.js";
import { scrollWindow } from "./CommandPalette.js";

export interface PickerOption {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
}

export interface PickerPanelProps {
  readonly title: string;
  readonly options: readonly PickerOption[];
  readonly onSelect: (option: PickerOption) => void;
  readonly onCancel: () => void;
  /** Rows of options to show at once before scrolling. */
  readonly visibleRows?: number;
}

/** Modal single-choice list used by commands that need a value from the user. */
export function PickerPanel({
  title,
  options,
  onSelect,
  onCancel,
  visibleRows = 10,
}: PickerPanelProps): React.ReactElement {
  const theme = useTheme();
  const { colors, glyphs, text } = theme;
  const [selected, setSelected] = useState(0);
  const safeSelected = options.length === 0 ? 0 : Math.min(selected, options.length - 1);
  const active = options[safeSelected];

  useInput((_input, key) => {
    if (key.escape) {
      onCancel();
      return;
    }
    if (key.upArrow) {
      setSelected((prev) => Math.max(0, prev - 1));
      return;
    }
    if (key.downArrow) {
      setSelected((prev) => Math.min(options.length - 1, prev + 1));
      return;
    }
    if (key.return && active !== undefined) {
      onSelect(active);
    }
  });

  const { start, end } = scrollWindow(safeSelected, options.length, visibleRows);

  return (
    <Box flexDirection="column" borderStyle={theme.border} {...border(colors.accent)} paddingX={1}>
      <Box justifyContent="space-between">
        <Text bold {...fg(colors.accent)}>
          {title}
        </Text>
        {options.length > 0 ? (
          <Text {...text.muted}>
            {safeSelected + 1}/{options.length}
          </Text>
        ) : null}
      </Box>

      {options.length === 0 ? (
        <Text {...text.warning}>No options.</Text>
      ) : (
        options.slice(start, end).map((option, index) => {
          const isActive = start + index === safeSelected;
          return (
            <Box key={option.id}>
              <Text {...(isActive ? text.accent : {})}>{isActive ? glyphs.prompt : " "} </Text>
              <Text {...(isActive ? text.selected : {})}>{option.label}</Text>
              {option.description !== undefined ? (
                <Text {...text.muted}> {option.description}</Text>
              ) : null}
            </Box>
          );
        })
      )}

      <Text {...text.muted}>
        {glyphs.upDown} select {glyphs.sep} Enter confirm {glyphs.sep} Esc cancel
      </Text>
    </Box>
  );
}
