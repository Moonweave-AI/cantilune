import React, { useEffect, useState } from "react";
import { Box, Text } from "ink";
import type { AgentPhase, LayoutMode, SessionState } from "../store.js";
import { useTheme } from "../theme/themeContext.js";
import { fg, type TextStyle, type Theme } from "../theme/theme.js";
import { Spinner, formatDuration } from "./Spinner.js";

export type NoticeLevel = "info" | "warn" | "error";

export interface StatusBarNotice {
  readonly level: NoticeLevel;
  readonly text: string;
}

export interface StatusBarProps {
  readonly provider: string;
  readonly model: string;
  readonly session: SessionState;
  readonly maxTurns?: number;
  readonly participants?: number;
  readonly phase?: AgentPhase;
  readonly layout?: LayoutMode;
  readonly connected?: boolean;
  readonly notice?: StatusBarNotice | null;
  readonly width?: number;
}

function formatElapsed(startTime: number): string {
  const elapsedSec = Math.floor((Date.now() - startTime) / 1000);
  const mm = String(Math.floor(elapsedSec / 60)).padStart(2, "0");
  const ss = String(elapsedSec % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function formatTokens(total: number): string {
  if (total < 1000) return String(total);
  if (total < 1_000_000) return `${(total / 1000).toFixed(1)}k`;
  return `${(total / 1_000_000).toFixed(1)}M`;
}

function noticeStyle(theme: Theme, level: NoticeLevel): TextStyle {
  if (level === "error") return theme.text.danger;
  if (level === "warn") return theme.text.warning;
  return theme.text.info;
}

/** Notices get their own markers so they never read as the connection dot. */
function noticeGlyph(theme: Theme, level: NoticeLevel): string {
  if (level === "error") return theme.glyphs.fail;
  if (level === "warn") return theme.glyphs.warn;
  return theme.glyphs.info;
}

/**
 * Live description of what the agent is doing right now.
 *
 * This is the single most important piece of feedback in the whole UI: without
 * it a long model call is indistinguishable from a hang.
 */
function PhaseIndicator({ phase }: { readonly phase: AgentPhase }): React.ReactElement | null {
  const theme = useTheme();
  // Ticks on a timer so the elapsed counter advances during long calls.
  const [now, setNow] = useState(() => Date.now());
  const animating = phase.kind !== "idle";

  useEffect(() => {
    if (!animating) return;
    setNow(Date.now());
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 200);
    timer.unref?.();
    return () => {
      clearInterval(timer);
    };
  }, [animating]);

  if (phase.kind === "idle") return null;

  if (phase.kind === "perceiving") {
    return (
      <Box>
        <Spinner color={theme.colors.muted} />
        <Text {...theme.text.muted}> perceiving</Text>
      </Box>
    );
  }

  if (phase.kind === "asking") {
    return (
      <Box>
        <Spinner color={theme.colors.accent} />
        <Text bold {...fg(theme.colors.accent)}>
          {" "}
          asking{" "}
        </Text>
        <Text {...theme.text.muted}>paused for your reply</Text>
      </Box>
    );
  }

  const elapsed = formatDuration(Math.max(0, now - phase.since));
  const tint = phase.kind === "thinking" ? theme.colors.accent : theme.colors.warning;
  const label = phase.kind === "thinking" ? "thinking" : phase.name;

  return (
    <Box>
      <Spinner color={tint} />
      <Text bold {...fg(tint)}>
        {" "}
        {label}{" "}
      </Text>
      <Text {...theme.text.muted}>{elapsed}</Text>
    </Box>
  );
}

/**
 * Top chrome: identity on the left, live activity in the middle, budget on the
 * right. Fields drop out as the terminal narrows rather than wrapping, so the
 * bar always occupies exactly one row.
 */
export function StatusBar({
  provider,
  model,
  session,
  maxTurns = 100,
  participants = 1,
  phase = { kind: "idle" },
  layout = "focus",
  connected = false,
  notice = null,
  width,
}: StatusBarProps): React.ReactElement {
  const theme = useTheme();
  const { glyphs, text } = theme;
  const tokens = formatTokens(session.tokenUsage.total);
  const columns = width ?? 100;
  const compact = columns < 100;
  const tiny = columns < 72;
  const peers = `${participants} agent${participants === 1 ? "" : "s"}`;

  return (
    <Box flexDirection="column">
      <Box paddingX={1} justifyContent="space-between">
        <Box>
          <Text {...(connected ? text.success : text.muted)}>
            {connected ? glyphs.dot : glyphs.dotOpen}
          </Text>
          <Text {...text.heading}> {model}</Text>
          {compact ? null : <Text {...text.muted}> @{provider}</Text>}
        </Box>

        <Box>
          <PhaseIndicator phase={phase} />
        </Box>

        <Box>
          <Text {...text.muted}>
            {session.turnCount}/{maxTurns} {glyphs.sep} {formatElapsed(session.startTime)}
            {tiny ? "" : ` ${glyphs.sep} ${tokens} tok`}
            {compact ? "" : ` ${glyphs.sep} ${peers} ${glyphs.sep} ${layout}`}
          </Text>
        </Box>
      </Box>

      {notice !== null ? (
        <Box paddingX={1}>
          <Text {...noticeStyle(theme, notice.level)}>
            {noticeGlyph(theme, notice.level)} {notice.text}
          </Text>
        </Box>
      ) : null}
    </Box>
  );
}
