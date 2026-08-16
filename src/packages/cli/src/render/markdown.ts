/**
 * Markdown parser producing a terminal-oriented AST.
 *
 * Agent replies are markdown. Rendering them as raw text loses every structural
 * cue the model spent tokens producing — headings, list nesting, code fences,
 * tables — which is the difference between a transcript you can skim and a wall
 * of characters.
 *
 * This is deliberately not a CommonMark implementation. It covers the
 * constructs an assistant actually emits, and anything it does not recognise
 * degrades to a paragraph rather than being dropped, so no output is ever lost
 * to a parse gap. It has no dependencies: the CLI ships as part of an OS and
 * should not pull a markdown stack into the runtime closure.
 */

/** Inline span, the leaves of a paragraph, heading, list item, or table cell. */
export type InlineNode =
  | { readonly kind: "text"; readonly value: string }
  | { readonly kind: "strong"; readonly value: string }
  | { readonly kind: "emphasis"; readonly value: string }
  | { readonly kind: "strike"; readonly value: string }
  | { readonly kind: "code"; readonly value: string }
  | { readonly kind: "link"; readonly value: string; readonly href: string };

export interface ListItem {
  /** Nesting depth; 0 is the outermost list. */
  readonly depth: number;
  /** Marker to draw: the ordinal for an ordered item, undefined for a bullet. */
  readonly ordinal?: number;
  readonly spans: readonly InlineNode[];
  /** Rendered as a checkbox when the item used GitHub task-list syntax. */
  readonly checked?: boolean;
}

export type MarkdownBlock =
  | { readonly kind: "heading"; readonly level: number; readonly spans: readonly InlineNode[] }
  | { readonly kind: "paragraph"; readonly spans: readonly InlineNode[] }
  | {
      readonly kind: "code";
      readonly language: string | undefined;
      readonly lines: readonly string[];
    }
  | { readonly kind: "list"; readonly items: readonly ListItem[] }
  | { readonly kind: "quote"; readonly blocks: readonly MarkdownBlock[] }
  | { readonly kind: "rule" }
  | {
      readonly kind: "table";
      readonly header: readonly (readonly InlineNode[])[];
      readonly rows: readonly (readonly (readonly InlineNode[])[])[];
      readonly alignments: readonly ("left" | "center" | "right")[];
    };

const FENCE = /^(\s*)(`{3,}|~{3,})\s*([\w+-]*)\s*$/;
const HEADING = /^(#{1,6})\s+(.*)$/;
const RULE = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/;
const QUOTE = /^\s*>\s?(.*)$/;
const BULLET = /^(\s*)[-*+]\s+(.*)$/;
const ORDERED = /^(\s*)(\d+)[.)]\s+(.*)$/;
const TASK = /^\[([ xX])\]\s+(.*)$/;
const TABLE_DIVIDER = /^\s*\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)*\|?\s*$/;

/** Spaces per nesting level; two is what assistants emit most often. */
const INDENT_WIDTH = 2;

/** Parse a markdown document into renderable blocks. */
export function parseMarkdown(source: string): readonly MarkdownBlock[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks: MarkdownBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index]!;

    if (line.trim().length === 0) {
      index += 1;
      continue;
    }

    const fence = FENCE.exec(line);
    if (fence !== null) {
      index = consumeFence(lines, index, fence, blocks);
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading !== null) {
      blocks.push({
        kind: "heading",
        level: heading[1]!.length,
        spans: parseInline(heading[2]!),
      });
      index += 1;
      continue;
    }

    // A rule check must follow the list check in intent but precede it in code:
    // `---` also matches nothing in BULLET, so order here is safe and the
    // explicit test keeps a horizontal rule from becoming an empty bullet.
    if (RULE.test(line)) {
      blocks.push({ kind: "rule" });
      index += 1;
      continue;
    }

    if (QUOTE.test(line)) {
      index = consumeQuote(lines, index, blocks);
      continue;
    }

    if (isTableStart(lines, index)) {
      index = consumeTable(lines, index, blocks);
      continue;
    }

    if (BULLET.test(line) || ORDERED.test(line)) {
      index = consumeList(lines, index, blocks);
      continue;
    }

    index = consumeParagraph(lines, index, blocks);
  }

  return blocks;
}

/** Consume a fenced code block; an unterminated fence runs to end of input. */
function consumeFence(
  lines: readonly string[],
  start: number,
  fence: RegExpExecArray,
  blocks: MarkdownBlock[],
): number {
  const marker = fence[2]!;
  const language = fence[3] === undefined || fence[3].length === 0 ? undefined : fence[3];
  const body: string[] = [];
  let index = start + 1;
  while (index < lines.length) {
    const line = lines[index]!;
    if (line.trimEnd().startsWith(marker.slice(0, 3)) && /^\s*(`{3,}|~{3,})\s*$/.test(line)) {
      index += 1;
      break;
    }
    body.push(line);
    index += 1;
  }
  blocks.push({ kind: "code", language, lines: body });
  return index;
}

/** Consume consecutive `>` lines and parse their contents as nested blocks. */
function consumeQuote(lines: readonly string[], start: number, blocks: MarkdownBlock[]): number {
  const inner: string[] = [];
  let index = start;
  while (index < lines.length) {
    const match = QUOTE.exec(lines[index]!);
    if (match === null) break;
    inner.push(match[1]!);
    index += 1;
  }
  blocks.push({ kind: "quote", blocks: parseMarkdown(inner.join("\n")) });
  return index;
}

/** Consume a run of list items, tracking indentation as nesting depth. */
function consumeList(lines: readonly string[], start: number, blocks: MarkdownBlock[]): number {
  const items: ListItem[] = [];
  let index = start;

  while (index < lines.length) {
    const line = lines[index]!;
    const ordered = ORDERED.exec(line);
    const bullet = ordered === null ? BULLET.exec(line) : null;
    if (ordered === null && bullet === null) break;

    const indent = (ordered?.[1] ?? bullet?.[1] ?? "").length;
    const rawText = ordered?.[3] ?? bullet?.[2] ?? "";
    const task = TASK.exec(rawText);
    const text = task !== null ? task[2]! : rawText;

    items.push({
      depth: Math.floor(indent / INDENT_WIDTH),
      ...(ordered !== null ? { ordinal: Number.parseInt(ordered[2]!, 10) } : {}),
      ...(task !== null ? { checked: task[1]!.toLowerCase() === "x" } : {}),
      spans: parseInline(text),
    });
    index += 1;
  }

  blocks.push({ kind: "list", items });
  return index;
}

/** A table needs a header row and a delimiter row directly beneath it. */
function isTableStart(lines: readonly string[], index: number): boolean {
  const header = lines[index];
  const divider = lines[index + 1];
  if (header === undefined || divider === undefined) return false;
  if (!header.includes("|")) return false;
  return TABLE_DIVIDER.test(divider) && divider.includes("-");
}

function consumeTable(lines: readonly string[], start: number, blocks: MarkdownBlock[]): number {
  const header = splitRow(lines[start]!).map(parseInline);
  const alignments = splitRow(lines[start + 1]!).map(readAlignment);
  const rows: (readonly InlineNode[])[][] = [];

  let index = start + 2;
  while (index < lines.length) {
    const line = lines[index]!;
    if (line.trim().length === 0 || !line.includes("|")) break;
    rows.push(splitRow(line).map(parseInline));
    index += 1;
  }

  blocks.push({ kind: "table", header, rows, alignments });
  return index;
}

/** Split a pipe-delimited row, tolerating optional leading/trailing pipes. */
function splitRow(line: string): readonly string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((cell) => cell.trim());
}

function readAlignment(spec: string): "left" | "center" | "right" {
  const startsWithColon = spec.startsWith(":");
  const endsWithColon = spec.endsWith(":");
  if (startsWithColon && endsWithColon) return "center";
  if (endsWithColon) return "right";
  return "left";
}

/** Consume a paragraph: consecutive lines until a blank line or a new block. */
function consumeParagraph(
  lines: readonly string[],
  start: number,
  blocks: MarkdownBlock[],
): number {
  const body: string[] = [];
  let index = start;
  while (index < lines.length) {
    const line = lines[index]!;
    if (line.trim().length === 0) break;
    if (FENCE.test(line) || HEADING.test(line) || RULE.test(line) || QUOTE.test(line)) break;
    if (BULLET.test(line) || ORDERED.test(line)) break;
    body.push(line.trim());
    index += 1;
  }
  // A paragraph is joined with spaces: the source line breaks are soft wraps,
  // and the terminal re-wraps to its own width anyway.
  blocks.push({ kind: "paragraph", spans: parseInline(body.join(" ")) });
  return index === start ? start + 1 : index;
}

/**
 * Inline patterns, tried in order.
 *
 * Code comes first because its content is literal: `**not bold**` inside
 * backticks must stay as written. Strong precedes emphasis so `**x**` is not
 * read as an emphasis of `*x*`.
 */
const INLINE_RULES: readonly {
  readonly pattern: RegExp;
  readonly build: (match: RegExpExecArray) => InlineNode;
}[] = [
  { pattern: /`([^`]+)`/, build: (m) => ({ kind: "code", value: m[1]! }) },
  {
    pattern: /\[([^\]]+)\]\(([^)\s]+)\)/,
    build: (m) => ({ kind: "link", value: m[1]!, href: m[2]! }),
  },
  { pattern: /\*\*([^*]+)\*\*/, build: (m) => ({ kind: "strong", value: m[1]! }) },
  { pattern: /__([^_]+)__/, build: (m) => ({ kind: "strong", value: m[1]! }) },
  { pattern: /~~([^~]+)~~/, build: (m) => ({ kind: "strike", value: m[1]! }) },
  { pattern: /\*([^*]+)\*/, build: (m) => ({ kind: "emphasis", value: m[1]! }) },
  { pattern: /(?<![\w_])_([^_]+)_(?![\w_])/, build: (m) => ({ kind: "emphasis", value: m[1]! }) },
];

/** Parse inline emphasis, code, links, and strike-through within one text run. */
export function parseInline(source: string): readonly InlineNode[] {
  if (source.length === 0) return [];
  const nodes: InlineNode[] = [];
  let rest = source;

  while (rest.length > 0) {
    const hit = firstMatch(rest);
    if (hit === undefined) {
      nodes.push({ kind: "text", value: rest });
      break;
    }
    if (hit.index > 0) {
      nodes.push({ kind: "text", value: rest.slice(0, hit.index) });
    }
    nodes.push(hit.node);
    rest = rest.slice(hit.index + hit.length);
  }

  return nodes;
}

/** Find the earliest inline match, preferring earlier rules on a tie. */
function firstMatch(
  source: string,
): { readonly index: number; readonly length: number; readonly node: InlineNode } | undefined {
  let best: { index: number; length: number; node: InlineNode } | undefined;
  for (const rule of INLINE_RULES) {
    const match = rule.pattern.exec(source);
    if (match === null) continue;
    if (best !== undefined && match.index >= best.index) continue;
    best = { index: match.index, length: match[0].length, node: rule.build(match) };
  }
  return best;
}

/** Whether a string contains any construct worth rendering as markdown. */
export function looksLikeMarkdown(source: string): boolean {
  return /(^|\n)\s*(#{1,6}\s|[-*+]\s|\d+[.)]\s|>\s|```|~~~|\|)|[*_`~]|\[[^\]]+\]\([^)]+\)/.test(
    source,
  );
}

/**
 * Models often emit `能力：1. foo 2. bar` as one paragraph. Split numbered
 * items onto their own lines so the existing list renderer can pick them up.
 * Only break after punctuation or whitespace so `GPT-4. then` stays intact.
 */
export function normalizeAssistantMarkdown(source: string): string {
  return source.replace(/([：:。；;！!？?\s])(\d{1,2}[.)]\s+)/g, "$1\n$2");
}
