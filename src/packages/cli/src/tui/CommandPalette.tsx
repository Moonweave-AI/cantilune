import React from "react";
import { Box, Text } from "ink";
import type { CommandCategory } from "../commands/registry.js";
import type { CommandSuggestion, CommandUsage } from "../commands/suggest.js";
import { useTheme } from "../theme/themeContext.js";
import { border, fg, type Color, type Theme } from "../theme/theme.js";

export interface CommandPaletteProps {
  readonly suggestions: readonly CommandSuggestion[];
  /** Shown instead of rows once the caret is past a command's name. */
  readonly usage?: CommandUsage | null;
  readonly selected: number;
  /** Rows of results to show at once before scrolling. */
  readonly visibleRows?: number;
  /** Terminal columns; each suggestion is clipped to one row of this width. */
  readonly width?: number;
}

/** Category tint, so the eye can group a long list without reading every row. */
function categoryColor(theme: Theme, category: CommandCategory): Color {
  switch (category) {
    case "view":
      return theme.colors.info;
    case "control":
      return theme.colors.accent;
    case "operation":
      return theme.colors.warning;
    case "session":
      return theme.colors.accentAlt;
    case "export":
      return theme.colors.success;
    default:
      return theme.colors.muted;
  }
}

/** Keep the cursor inside a fixed-height window as the selection moves. */
export function scrollWindow(
  selected: number,
  total: number,
  rows: number,
): { readonly start: number; readonly end: number } {
  if (total <= rows) return { start: 0, end: total };
  const start = Math.max(0, Math.min(selected - Math.floor(rows / 2), total - rows));
  return { start, end: start + rows };
}

/** `<url>` style placeholders for the arguments a row still needs. */
function argHint(suggestion: CommandSuggestion): string {
  if (suggestion.requiredArgs.length === 0) return "";
  return ` ${suggestion.requiredArgs.map((name) => `<${name}>`).join(" ")}`;
}

/** Clip a palette cell so a row cannot wrap and push the frame off-screen. */
export function clipPaletteText(value: string, budget: number, ellipsis = "…"): string {
  if (budget <= 0) return "";
  if (value.length <= budget) return value;
  if (budget <= ellipsis.length) return ellipsis.slice(0, budget);
  return `${value.slice(0, budget - ellipsis.length)}${ellipsis}`;
}

export interface PaletteRowCells {
  readonly name: string;
  readonly child: string;
  readonly description: string;
  readonly category: string;
}

/**
 * Pack one suggestion into a single terminal row.
 *
 * Name, description, and category share `width` minus chrome; leftover
 * description is dropped rather than wrapped.
 */
export function formatPaletteRow(
  entry: CommandSuggestion,
  width: number,
  childMark: string,
  ellipsis = "…",
): PaletteRowCells {
  const inner = Math.max(16, width - 4);
  const marker = 2;
  const nameRaw = `${entry.label}${argHint(entry)}`;
  const nameBudget = Math.min(Math.max(nameRaw.length, 10), Math.max(10, Math.floor(inner * 0.36)));
  const child = entry.childCount > 0 ? `${childMark}${entry.childCount}` : " ";
  const reserved = marker + nameBudget + 1 + child.length + 1 + entry.category.length;
  const descBudget = Math.max(0, inner - reserved - 1);
  return {
    name: clipPaletteText(nameRaw, nameBudget, ellipsis).padEnd(nameBudget),
    child,
    description: clipPaletteText(entry.description, descBudget, ellipsis),
    category: entry.category,
  };
}

function UsageLine({
  usage,
  width,
}: {
  readonly usage: CommandUsage;
  readonly width: number;
}): React.ReactElement {
  const { colors, text, glyphs } = useTheme();
  const inner = Math.max(16, width - 4);
  const signature = usage.args
    .map((arg) => (arg.required ? `<${arg.name}>` : `[${arg.name}]`))
    .join(" ");
  const current = usage.args[usage.argIndex];
  const ellipsis = glyphs.ellipsis;

  return (
    <Box flexDirection="column" width={inner}>
      <Box width={inner}>
        <Text bold {...fg(colors.accentAlt)}>
          {clipPaletteText(usage.name, inner, ellipsis)}
        </Text>
        {signature.length > 0 ? (
          <Text {...text.muted}>
            {" "}
            {clipPaletteText(signature, Math.max(0, inner - usage.name.length - 1), ellipsis)}
          </Text>
        ) : null}
      </Box>
      <Text {...text.muted}>{clipPaletteText(usage.description, inner, ellipsis)}</Text>
      {current !== undefined ? (
        <Text {...text.accent}>
          {clipPaletteText(
            `${current.name} — ${current.description}${current.required ? " (required)" : " (optional)"}`,
            inner,
            ellipsis,
          )}
        </Text>
      ) : null}
    </Box>
  );
}

/**
 * Inline suggestion overlay for slash input.
 *
 * Deliberately has no input handling of its own: {@link InputBar} owns every
 * keystroke and passes the resolved selection down. When both this and the
 * input bar listened for keys, typing after `/` went to the buffer while the
 * palette kept showing unfiltered results, and Enter was handled twice.
 */
export function CommandPalette({
  suggestions,
  usage = null,
  selected,
  visibleRows = 8,
  width = 100,
}: CommandPaletteProps): React.ReactElement {
  const theme = useTheme();
  const { colors, glyphs, text } = theme;

  const safeSelected = suggestions.length === 0 ? 0 : Math.min(selected, suggestions.length - 1);
  const { start, end } = scrollWindow(safeSelected, suggestions.length, visibleRows);
  const inner = Math.max(16, width - 4);

  return (
    <Box
      flexDirection="column"
      width={width}
      borderStyle={theme.border}
      {...border(colors.accentAlt)}
      paddingX={1}
    >
      {usage !== null && suggestions.length === 0 ? (
        <UsageLine usage={usage} width={width} />
      ) : (
        <>
          <Box width={inner} justifyContent="space-between">
            <Text bold {...fg(colors.accentAlt)}>
              Commands
            </Text>
            {suggestions.length > 0 ? (
              <Text {...text.muted}>
                {safeSelected + 1}/{suggestions.length}
              </Text>
            ) : null}
          </Box>

          {suggestions.length === 0 ? (
            <Text {...text.warning}>No matching commands.</Text>
          ) : (
            suggestions.slice(start, end).map((entry, index) => {
              const isActive = start + index === safeSelected;
              const row = formatPaletteRow(entry, width, glyphs.prompt, glyphs.ellipsis);
              return (
                <Box key={entry.name} width={inner} flexWrap="nowrap">
                  <Text {...(isActive ? text.accent : {})}>{isActive ? glyphs.prompt : " "} </Text>
                  <Text {...(isActive ? text.selected : text.muted)}>{row.name}</Text>
                  <Text {...text.muted}> {row.child}</Text>
                  {row.description.length > 0 ? (
                    <Text {...text.muted}> {row.description}</Text>
                  ) : null}
                  <Text {...fg(categoryColor(theme, entry.category))}> {row.category}</Text>
                </Box>
              );
            })
          )}

          <Text {...text.muted}>
            {clipPaletteText(
              `${glyphs.upDown} select ${glyphs.sep} Tab complete ${glyphs.sep} Enter run ${glyphs.sep} Esc dismiss${end < suggestions.length ? ` ${glyphs.sep} ${suggestions.length - end} more` : ""}`,
              inner,
              glyphs.ellipsis,
            )}
          </Text>
        </>
      )}
    </Box>
  );
}
