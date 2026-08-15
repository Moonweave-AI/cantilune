import React from "react";
import { Box, Text } from "ink";
import type { AgentPhase, RuntimeState } from "../store.js";
import { useTheme } from "../theme/themeContext.js";
import { border, fg, type Color, type Theme } from "../theme/theme.js";

export interface ObservePanelProps {
  readonly runtime: RuntimeState;
  readonly phase: AgentPhase;
  readonly width: number;
  readonly height: number;
}

function Section({
  title,
  count,
  children,
}: {
  readonly title: string;
  readonly count?: number;
  readonly children: React.ReactNode;
}): React.ReactElement {
  const { text } = useTheme();
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        <Text {...text.heading}>{title}</Text>
        {count !== undefined ? <Text {...text.muted}> {count}</Text> : null}
      </Box>
      {children}
    </Box>
  );
}

/** Participation status drives the dot colour, mirroring the lifecycle ramp. */
function participantColor(theme: Theme, status: string): Color {
  switch (status) {
    case "active":
      return theme.colors.success;
    case "registered":
    case "waiting":
      return theme.colors.warning;
    case "failed":
      return theme.colors.danger;
    default:
      return theme.colors.muted;
  }
}

/** Drop a redundant type prefix, so a labelled field does not read `epoch epoch:2`. */
function stripPrefix(value: string, prefix: string): string {
  return value.startsWith(prefix) ? value.slice(prefix.length) : value;
}

function truncate(value: string, budget: number, ellipsis: string): string {
  if (value.length <= budget) return value;
  return `${value.slice(0, Math.max(0, budget - ellipsis.length))}${ellipsis}`;
}

/**
 * Live side panel for the `observe` layout.
 *
 * Mirrors the coordination world as the run progresses: who is participating,
 * what artifacts exist, and the tail of the change log. This is the orca-style
 * half of the hybrid layout — always-on situational awareness rather than an
 * explicit `/world` invocation.
 */
export function ObservePanel({
  runtime,
  phase,
  width,
  height,
}: ObservePanelProps): React.ReactElement {
  const theme = useTheme();
  const { colors, glyphs, text } = theme;
  const snapshot = runtime.snapshot;
  const budget = Math.max(12, width - 4);
  // Split the vertical budget across the three sections.
  const perSection = Math.max(2, Math.floor((height - 8) / 3));
  const live = phase.kind !== "idle";

  return (
    <Box
      flexDirection="column"
      width={width}
      paddingX={1}
      borderStyle={theme.border}
      {...border(live ? colors.borderActive : colors.border)}
    >
      <Box marginBottom={1}>
        <Text bold {...fg(colors.accentAlt)}>
          World
        </Text>
        <Text {...(live ? text.success : text.muted)}> {live ? glyphs.dot : glyphs.dotOpen}</Text>
      </Box>

      {snapshot === null ? (
        <Text {...text.muted}>No runtime yet {glyphs.dash} send a message to boot the OS.</Text>
      ) : (
        <>
          <Section title="Participants" count={snapshot.participants.length}>
            {snapshot.participants.slice(0, perSection).map((p) => (
              <Text key={p.id}>
                <Text {...fg(participantColor(theme, p.status))}>{glyphs.dot}</Text>{" "}
                <Text>{truncate(p.id, budget - 4, glyphs.ellipsis)}</Text>
              </Text>
            ))}
            {snapshot.participants.length > perSection ? (
              <Text {...text.muted}>+{snapshot.participants.length - perSection} more</Text>
            ) : null}
          </Section>

          <Section title="Artifacts" count={snapshot.artifacts.length}>
            {snapshot.artifacts.length === 0 ? (
              <Text {...text.muted}>none</Text>
            ) : (
              snapshot.artifacts.slice(0, perSection).map((a) => (
                <Text key={a.id} {...text.muted}>
                  {truncate(a.id, budget - 2, glyphs.ellipsis)}
                </Text>
              ))
            )}
            {snapshot.artifacts.length > perSection ? (
              <Text {...text.muted}>+{snapshot.artifacts.length - perSection} more</Text>
            ) : null}
          </Section>

          <Section title="Changes" count={runtime.changeLog.length}>
            {runtime.changeLog.length === 0 ? (
              <Text {...text.muted}>none</Text>
            ) : (
              runtime.changeLog.slice(-perSection).map((c) => (
                <Text key={c.changeId} {...text.muted}>
                  {glyphs.arrow} {truncate(c.operationTypeId, budget - 4, glyphs.ellipsis)}
                </Text>
              ))
            )}
          </Section>

          {runtime.epoch !== null ? (
            <Text {...text.muted}>
              epoch{" "}
              {truncate(stripPrefix(runtime.epoch.epochId, "epoch:"), budget - 6, glyphs.ellipsis)}
            </Text>
          ) : null}
        </>
      )}
    </Box>
  );
}
