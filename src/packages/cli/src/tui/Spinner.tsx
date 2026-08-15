import React, { useEffect, useState } from "react";
import { Text } from "ink";
import { useTheme } from "../theme/themeContext.js";
import { fg, type Color } from "../theme/theme.js";

const FRAME_MS = 80;

export interface SpinnerProps {
  /** Overrides the theme accent; pass a resolved colour, not a token name. */
  readonly color?: Color;
  /** Pause animation without unmounting, so layout stays stable. */
  readonly active?: boolean;
}

/** Spinner shown wherever the agent is working with nothing to render yet. */
export function Spinner({ color, active = true }: SpinnerProps): React.ReactElement {
  const theme = useTheme();
  const frames = theme.glyphs.spinner;
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => {
      setFrame((current) => (current + 1) % frames.length);
    }, FRAME_MS);
    // A cosmetic animation must never be the reason the process stays alive.
    timer.unref?.();
    return () => {
      clearInterval(timer);
    };
  }, [active, frames.length]);

  const tint = color ?? theme.colors.accent;
  return <Text {...fg(tint)}>{active ? frames[frame % frames.length] : theme.glyphs.sep}</Text>;
}

/** Format a duration for inline display: `1.4s`, `12s`, `2m03s`. */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 10) return `${seconds.toFixed(1)}s`;
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return `${minutes}m${String(rest).padStart(2, "0")}s`;
}
