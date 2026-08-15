import React from "react";
import { Box, Text } from "ink";
import type { AppStore, TimelineEntry, ViewType } from "../store.js";
import { useAppStore } from "../storeContext.js";
import { useTheme } from "../theme/themeContext.js";
import { fg, type Color, type Theme } from "../theme/theme.js";
import { ViewFrame, type ViewTone } from "./ViewFrame.js";
import { formatRelative } from "../tui/timeFormat.js";

/** The live event stream is the informational, read-only lens — info hue. */
const EVENT_TONE: ViewTone = "info";

/** Per-kind glyph + tint, so the timeline is scannable at a glance. */
function kindStyle(theme: Theme, kind: TimelineEntry["kind"]): { glyph: string; color: Color } {
  switch (kind) {
    case "turn_start":
      return { glyph: "╭", color: theme.colors.muted };
    case "llm_start":
      return { glyph: "◆", color: theme.colors.accentAlt };
    case "llm_delta":
      return { glyph: "·", color: theme.colors.muted };
    case "llm_end":
      return { glyph: "◆", color: theme.colors.accent };
    case "tool_start":
      return { glyph: "▶", color: theme.colors.warning };
    case "tool_end":
      return { glyph: "■", color: theme.colors.success };
    case "turn_end":
      return { glyph: "╰", color: theme.colors.muted };
    case "error":
      return { glyph: "✗", color: theme.colors.danger };
    case "control_verdict":
      return { glyph: "⊕", color: theme.colors.accentAlt };
    case "ask_user":
      return { glyph: "?", color: theme.colors.warning };
    case "diagnostic":
      return { glyph: "⚠", color: theme.colors.warning };
    default:
      return { glyph: " ", color: theme.colors.muted };
  }
}

export interface ViewProps {
  readonly store: AppStore;
}

/**
 * Live event-stream view: renders the agent loop's per-event timeline as it
 * happens. This is the always-on, intermediate-process surface that makes the
 * loop observable turn-by-turn — complementing the post-hoc aggregated
 * `observe` four-view bundle. Opened via `/events`.
 */
export function EventView({ store }: ViewProps): React.ReactElement {
  const theme = useTheme();
  const entries = store.eventLog;
  const base = entries.length > 0 ? entries[0]!.ts : Date.now();
  // Pin to the newest entries; the store ring-buffers at EVENT_LOG_CAPACITY.
  const visible = entries.slice(-200);

  return (
    <ViewFrame
      title="Live Event Stream"
      tone={EVENT_TONE}
      subtitle={`${entries.length} event(s) this session · newest at bottom`}
      empty="No events yet — send a message to start the agent loop."
    >
      {visible.length === 0 ? null : (
        <Box flexDirection="column">
          {visible.map((entry) => {
            const style = kindStyle(theme, entry.kind);
            return (
              <Box key={entry.seq} flexDirection="column">
                <Box>
                  <Text {...fg(style.color)}>{style.glyph} </Text>
                  <Text {...theme.text.muted}>
                    t{entry.turn} {formatRelative(entry.ts, base).padEnd(8)}{" "}
                  </Text>
                  <Text>{entry.label}</Text>
                </Box>
                {entry.detail !== undefined && entry.detail.length > 0 ? (
                  <Box marginLeft={4}>
                    <Text {...theme.text.muted}>{entry.detail}</Text>
                  </Box>
                ) : null}
              </Box>
            );
          })}
        </Box>
      )}
    </ViewFrame>
  );
}

export interface ViewContainerProps {
  readonly viewArgs?: Record<string, unknown>;
  readonly activeView?: ViewType;
}

export default function EventViewContainer(props: ViewContainerProps): React.ReactElement {
  const store = useAppStore({
    activeView: props.activeView ?? "events",
    viewArgs: props.viewArgs ?? {},
  });
  return <EventView store={store} />;
}
