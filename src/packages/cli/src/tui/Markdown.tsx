/**
 * Renders parsed markdown into Ink elements using the active theme.
 *
 * Every visual decision here degrades: emphasis is bold/dim/inverse before it
 * is colour, glyphs come from the theme's glyph set so an ASCII terminal gets
 * ASCII, and an unknown code language simply renders uncoloured. That keeps the
 * transcript readable on a monochrome 16-colour SSH session and on a truecolor
 * local terminal without branching in this file.
 */
import React from "react";
import { Box, Text } from "ink";
import type { InlineNode, ListItem, MarkdownBlock } from "../render/markdown.js";
import { parseMarkdown } from "../render/markdown.js";
import { highlightLine, resolveLanguage, type TokenKind } from "../render/syntaxHighlight.js";
import { useTheme } from "../theme/themeContext.js";
import { fg, type Theme, type TextStyle } from "../theme/theme.js";

export interface MarkdownProps {
  readonly source: string;
  /** Columns available to the block; drives code-fence and table widths. */
  readonly width: number;
}

/** Indent applied per list nesting level. */
const LIST_INDENT = 2;
/** Left padding inside a code fence, so text does not touch the rule. */
const CODE_PAD = 1;

/**
 * Map a syntax token onto a theme role.
 *
 * Reusing the semantic roles rather than adding palette entries is what makes
 * highlighting work in the monochrome theme for free: every role there resolves
 * to "inherit the terminal foreground", so the code simply renders plain.
 */
function tokenStyle(theme: Theme, kind: TokenKind): TextStyle {
  switch (kind) {
    case "comment":
      return theme.text.muted;
    case "string":
      return theme.text.success;
    case "number":
      return theme.text.warning;
    case "keyword":
      return { ...fg(theme.colors.accentAlt), bold: true };
    case "type":
      return theme.text.info;
    case "function":
      return fg(theme.colors.accent);
    case "punctuation":
      return theme.text.muted;
    case "added":
      return theme.text.success;
    case "removed":
      return theme.text.danger;
    case "meta":
      return theme.text.accent;
    default:
      return {};
  }
}

function Inline({ spans }: { readonly spans: readonly InlineNode[] }): React.ReactElement {
  const theme = useTheme();
  return (
    <Text wrap="wrap">
      {spans.map((span, index) => (
        <InlineSpan key={index} span={span} theme={theme} />
      ))}
    </Text>
  );
}

function InlineSpan({
  span,
  theme,
}: {
  readonly span: InlineNode;
  readonly theme: Theme;
}): React.ReactElement {
  switch (span.kind) {
    case "strong":
      return <Text bold>{span.value}</Text>;
    case "emphasis":
      return <Text italic>{span.value}</Text>;
    case "strike":
      return <Text strikethrough>{span.value}</Text>;
    case "code":
      // Inline code is tinted rather than boxed: a border inside a paragraph
      // would break the wrap and cost a row per occurrence.
      return <Text {...theme.text.info}>{span.value}</Text>;
    case "link":
      // The label carries the meaning; the URL follows dimmed so it stays
      // copyable without competing with the sentence.
      return (
        <Text>
          <Text {...fg(theme.colors.accent)} underline>
            {span.value}
          </Text>
          <Text {...theme.text.muted}> ({span.href})</Text>
        </Text>
      );
    default:
      return <Text>{span.value}</Text>;
  }
}

function Heading({
  level,
  spans,
}: {
  readonly level: number;
  readonly spans: readonly InlineNode[];
}): React.ReactElement {
  const theme = useTheme();
  // Only the top two levels get a marker. Deeper headings in a chat reply are
  // usually sub-points, and a stack of hashes reads as noise at terminal width.
  const marker = level <= 2 ? `${theme.glyphs.headingMarker} ` : "";
  return (
    <Box marginTop={level <= 2 ? 1 : 0}>
      <Text {...theme.text.heading} bold={level <= 3}>
        {marker}
        {spans.map((span, index) => (
          <InlineSpan key={index} span={span} theme={theme} />
        ))}
      </Text>
    </Box>
  );
}

function CodeBlock({
  language,
  lines,
  width,
}: {
  readonly language: string | undefined;
  readonly lines: readonly string[];
  readonly width: number;
}): React.ReactElement {
  const theme = useTheme();
  const resolved = resolveLanguage(language);
  const gutterWidth = String(lines.length).length;

  return (
    <Box flexDirection="column" marginY={1}>
      <Box>
        <Text {...theme.text.muted}>
          {theme.glyphs.codeFence} {language ?? "text"}
        </Text>
      </Box>
      <Box
        flexDirection="column"
        borderStyle={theme.border}
        borderColor={theme.colors.border}
        paddingX={CODE_PAD}
        width={width}
      >
        {lines.map((line, index) => (
          <Box key={index}>
            <Box width={gutterWidth + 1} flexShrink={0}>
              <Text {...theme.text.muted}>{String(index + 1).padStart(gutterWidth)}</Text>
            </Box>
            <Box flexGrow={1}>
              <Text wrap="wrap">
                {highlightLine(line, resolved).map((token, tokenIndex) => (
                  <Text key={tokenIndex} {...tokenStyle(theme, token.kind)}>
                    {token.value}
                  </Text>
                ))}
              </Text>
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function ListBlock({ items }: { readonly items: readonly ListItem[] }): React.ReactElement {
  const theme = useTheme();
  return (
    <Box flexDirection="column">
      {items.map((item, index) => (
        <Box key={index} marginLeft={item.depth * LIST_INDENT}>
          <Box width={3} flexShrink={0}>
            <Text {...fg(theme.colors.accent)}>{itemMarker(theme, item)}</Text>
          </Box>
          <Box flexGrow={1}>
            <Inline spans={item.spans} />
          </Box>
        </Box>
      ))}
    </Box>
  );
}

function itemMarker(theme: Theme, item: ListItem): string {
  if (item.checked !== undefined) {
    return item.checked ? `${theme.glyphs.ok} ` : `${theme.glyphs.pending} `;
  }
  if (item.ordinal !== undefined) return `${item.ordinal}.`;
  return `${theme.glyphs.bullet} `;
}

function Quote({ blocks }: { readonly blocks: readonly MarkdownBlock[] }): React.ReactElement {
  const theme = useTheme();
  return (
    <Box flexDirection="row" marginY={1}>
      <Box width={2} flexShrink={0}>
        <Text {...fg(theme.colors.accentAlt)}>{theme.glyphs.quoteBar}</Text>
      </Box>
      <Box flexDirection="column" flexGrow={1}>
        {blocks.map((block, index) => (
          <BlockView key={index} block={block} width={0} />
        ))}
      </Box>
    </Box>
  );
}

/**
 * Column widths for a table, sized to content and then scaled down together
 * when the total exceeds the terminal width.
 */
export function tableColumnWidths(
  header: readonly (readonly InlineNode[])[],
  rows: readonly (readonly (readonly InlineNode[])[])[],
  width: number,
): readonly number[] {
  const columns = header.length;
  if (columns === 0) return [];
  const natural = header.map((cell, index) =>
    Math.max(plainWidth(cell), ...rows.map((row) => plainWidth(row[index] ?? []))),
  );
  // Separators cost `columns + 1` cells; leave at least three characters per
  // column so a narrow terminal truncates rather than collapsing to nothing.
  const budget = Math.max(columns * 3, width - (columns + 1));
  const total = natural.reduce((sum, value) => sum + value, 0);
  if (total <= budget) return natural;
  const scale = budget / total;
  return natural.map((value) => Math.max(3, Math.floor(value * scale)));
}

function plainWidth(spans: readonly InlineNode[]): number {
  return spans.reduce((sum, span) => sum + span.value.length, 0);
}

function TableBlock({
  header,
  rows,
  alignments,
  width,
}: {
  readonly header: readonly (readonly InlineNode[])[];
  readonly rows: readonly (readonly (readonly InlineNode[])[])[];
  readonly alignments: readonly ("left" | "center" | "right")[];
  readonly width: number;
}): React.ReactElement {
  const theme = useTheme();
  const widths = tableColumnWidths(header, rows, width);

  const renderRow = (
    cells: readonly (readonly InlineNode[])[],
    bold: boolean,
    key: React.Key,
  ): React.ReactElement => (
    <Box key={key}>
      {widths.map((columnWidth, index) => (
        <Box
          key={index}
          width={columnWidth + 1}
          flexShrink={0}
          justifyContent={justifyFor(alignments[index])}
        >
          <Text bold={bold} wrap="truncate-end">
            {(cells[index] ?? []).map((span, spanIndex) => (
              <InlineSpan key={spanIndex} span={span} theme={theme} />
            ))}
          </Text>
        </Box>
      ))}
    </Box>
  );

  return (
    <Box flexDirection="column" marginY={1}>
      {renderRow(header, true, "header")}
      <Text {...theme.text.muted}>
        {widths.map((columnWidth) => theme.glyphs.hRule.repeat(columnWidth)).join(" ")}
      </Text>
      {rows.map((row, index) => renderRow(row, false, index))}
    </Box>
  );
}

function justifyFor(
  alignment: "left" | "center" | "right" | undefined,
): "flex-start" | "center" | "flex-end" {
  if (alignment === "center") return "center";
  if (alignment === "right") return "flex-end";
  return "flex-start";
}

function BlockView({
  block,
  width,
}: {
  readonly block: MarkdownBlock;
  readonly width: number;
}): React.ReactElement {
  const theme = useTheme();
  switch (block.kind) {
    case "heading":
      return <Heading level={block.level} spans={block.spans} />;
    case "code":
      return <CodeBlock language={block.language} lines={block.lines} width={width} />;
    case "list":
      return <ListBlock items={block.items} />;
    case "quote":
      return <Quote blocks={block.blocks} />;
    case "table":
      return (
        <TableBlock
          header={block.header}
          rows={block.rows}
          alignments={block.alignments}
          width={width}
        />
      );
    case "rule":
      return (
        <Box marginY={1}>
          <Text {...theme.text.muted}>{theme.glyphs.hRule.repeat(Math.max(4, width))}</Text>
        </Box>
      );
    default:
      return <Inline spans={block.spans} />;
  }
}

/** Render a markdown document. */
export function Markdown({ source, width }: MarkdownProps): React.ReactElement {
  // Parsing on every render is cheap relative to Ink's own reconcile pass for a
  // transcript-sized document, and it keeps streaming updates correct: the last
  // partial fence re-parses as its closing backticks arrive.
  const blocks = React.useMemo(() => parseMarkdown(source), [source]);
  const safeWidth = Math.max(20, width);

  return (
    <Box flexDirection="column">
      {blocks.map((block, index) => (
        <BlockView key={index} block={block} width={safeWidth} />
      ))}
    </Box>
  );
}
