import React from "react";
import { Box, Text } from "ink";
import { useTheme } from "../theme/themeContext.js";
import { fg, type Color, type Theme } from "../theme/theme.js";

/**
 * Accent family for a view.
 *
 * Each view family keeps a stable hue so the header colour alone tells you
 * which part of the system you are looking at, without reading the title.
 */
export type ViewTone = "accent" | "accentAlt" | "info" | "success" | "warning" | "danger";

export function toneColor(theme: Theme, tone: ViewTone): Color {
  return theme.colors[tone];
}

export interface ViewFrameProps {
  readonly title: string;
  /** Metadata line under the title: epoch, counts, filters. */
  readonly subtitle?: string | undefined;
  readonly tone?: ViewTone;
  /** Replaces the body with a de-emphasised message, e.g. "no runtime yet". */
  readonly empty?: string | undefined;
  readonly children?: React.ReactNode;
}

/**
 * Shared chrome for every full-screen view.
 *
 * Views used to hand-roll their own header with a hardcoded colour each, which
 * drifted apart over time. Routing them through one frame keeps titles,
 * spacing, and empty states identical no matter which command opened them.
 */
export function ViewFrame({
  title,
  subtitle,
  tone = "accent",
  empty,
  children,
}: ViewFrameProps): React.ReactElement {
  const theme = useTheme();
  const tint = toneColor(theme, tone);

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box>
        <Text {...fg(tint)}>{theme.glyphs.rule} </Text>
        <Text bold {...fg(tint)}>
          {title}
        </Text>
      </Box>

      {subtitle !== undefined && subtitle.length > 0 ? (
        <Text {...theme.text.muted}>{subtitle}</Text>
      ) : null}

      {empty !== undefined ? <Text {...theme.text.muted}>{empty}</Text> : children}
    </Box>
  );
}
