import React from "react";
import { Box, Text } from "ink";
import type { LifecycleLine, ToolCallDisplay } from "../store.js";
import { useTheme } from "../theme/themeContext.js";
import { ToolCard } from "./ToolCard.js";
import { LifecycleRail } from "./LifecycleRail.js";
import { activityHeadline } from "./transcriptItems.js";

export interface ActivityBlockProps {
  readonly tools: readonly ToolCallDisplay[];
  readonly lifecycle: readonly LifecycleLine[];
  readonly expanded: boolean;
  readonly width: number;
  readonly turn?: number;
}

/**
 * One turn's process, in the Claude Code / Codex / OpenCode style:
 * a single collapsed line by default, full tool bodies only when expanded.
 *
 * The lifecycle rail never shares a wrap box with assistant prose — that is
 * what made `t1 lifecycleshell命令` collide with the answer.
 */
function railTurnProp(turn: number | undefined): { readonly turn?: number } {
  return turn === undefined ? {} : { turn };
}

function ExpandedActivity({
  tools,
  lifecycle,
  width,
  turn,
}: Omit<ActivityBlockProps, "expanded">): React.ReactElement {
  return (
    <Box flexDirection="column" marginTop={0}>
      {tools.map((toolCall) => (
        <ToolCard key={toolCall.id} toolCall={toolCall} detail="observe" width={width} />
      ))}
      {lifecycle.length > 0 ? (
        <LifecycleRail lines={lifecycle} {...railTurnProp(turn)} width={width} />
      ) : null}
    </Box>
  );
}

export function ActivityBlock({
  tools,
  lifecycle,
  expanded,
  width,
  turn,
}: ActivityBlockProps): React.ReactElement | null {
  const theme = useTheme();
  if (tools.length === 0 && lifecycle.length === 0) return null;
  // Focus default: hide process chrome when the only leftover is the rail.
  if (!expanded && tools.length === 0) return null;

  const marker = expanded ? theme.glyphs.arrowDown : theme.glyphs.arrow;
  const headline = activityHeadline(tools, theme.glyphs.ellipsis);
  const running = tools.some((tool) => tool.status === "running");

  return (
    <Box flexDirection="column" width={width} marginLeft={2} marginTop={0}>
      <Box>
        <Text {...theme.text.muted}>{marker} </Text>
        <Text {...(running ? theme.text.warning : theme.text.muted)}>{headline}</Text>
        <Text {...theme.text.muted}> {theme.glyphs.sep} Ctrl+T</Text>
      </Box>
      {expanded ? (
        <ExpandedActivity
          tools={tools}
          lifecycle={lifecycle}
          width={width}
          {...railTurnProp(turn)}
        />
      ) : null}
    </Box>
  );
}
