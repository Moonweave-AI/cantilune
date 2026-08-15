import React from "react";
import { Text } from "ink";
import { useTheme } from "../theme/themeContext.js";
import { fg, type Color } from "../theme/theme.js";

export interface DividerProps {
  readonly width: number;
  readonly color?: Color;
  /** Optional caption rendered flush left, inset into the rule. */
  readonly label?: string;
}

/**
 * Full-width horizontal rule.
 *
 * Ink has no border-bottom, so structural separation between the chrome and
 * the transcript is drawn explicitly. Uses the theme's border colour so the
 * rule recedes rather than competing with content.
 */
export function Divider({ width, color, label }: DividerProps): React.ReactElement {
  const theme = useTheme();
  const tint = color ?? theme.colors.border;
  const glyph = theme.glyphs.hRule;
  const usable = Math.max(0, width);

  if (label === undefined || label.length === 0) {
    return <Text {...fg(tint)}>{glyph.repeat(usable)}</Text>;
  }

  const caption = ` ${label} `;
  const remaining = Math.max(0, usable - caption.length - 1);
  return (
    <Text {...fg(tint)}>
      {glyph}
      <Text {...theme.text.muted}>{caption}</Text>
      {glyph.repeat(remaining)}
    </Text>
  );
}
