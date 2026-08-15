/**
 * Glyph sets for the TUI.
 *
 * Unicode box-drawing and braille characters carry most of the visual language,
 * but they turn into replacement boxes on terminals stuck in a legacy code page
 * (still common on Windows consoles). Every glyph therefore has an ASCII twin,
 * and the chrome is designed to stay readable in either set.
 */

export interface Glyphs {
  /** Leading marker on the input line when the CLI is accepting input. */
  readonly prompt: string;
  /** Leading marker on the input line while a run holds the input lock. */
  readonly promptBusy: string;
  /** Gutter marker in front of a user turn in the transcript. */
  readonly userGutter: string;
  /** Gutter marker in front of an agent turn, so turn boundaries are scannable. */
  readonly assistantGutter: string;

  readonly ok: string;
  readonly fail: string;
  readonly pending: string;
  /** Notice markers, kept distinct from {@link dot} so status never reads as a warning. */
  readonly warn: string;
  readonly info: string;
  /** Filled dot used for liveness and connection state. */
  readonly dot: string;
  /** Hollow dot used for inactive liveness. */
  readonly dotOpen: string;

  /** Block caret appended to text that is still streaming in. */
  readonly caret: string;
  /** Appended to truncated text. Also used standalone as a "more follows" marker. */
  readonly ellipsis: string;
  /** Inline separator between metric fields in the status bar. */
  readonly sep: string;
  /** Em dash for prose inside the chrome. */
  readonly dash: string;
  readonly arrow: string;
  /** Vertical rule used to indent nested/tool content. */
  readonly rule: string;
  /** Horizontal rule used by full-width dividers. */
  readonly hRule: string;
  /** Rendered in key hints for the history and selection keys. */
  readonly arrowUp: string;
  readonly arrowDown: string;
  /** Combined up/down hint, since the two almost always appear as a pair. */
  readonly upDown: string;

  readonly spinner: readonly string[];
}

const UNICODE: Glyphs = {
  prompt: "›",
  promptBusy: "⋯",
  userGutter: "›",
  assistantGutter: "⏺",
  ok: "✓",
  fail: "✗",
  pending: "○",
  warn: "▲",
  info: "•",
  dot: "●",
  dotOpen: "○",
  caret: "▍",
  ellipsis: "…",
  sep: "·",
  dash: "—",
  arrow: "→",
  rule: "│",
  hRule: "─",
  arrowUp: "↑",
  arrowDown: "↓",
  upDown: "↑↓",
  spinner: ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"],
};

const ASCII: Glyphs = {
  prompt: ">",
  promptBusy: "*",
  userGutter: ">",
  assistantGutter: "*",
  ok: "+",
  fail: "x",
  pending: "o",
  warn: "!",
  info: "i",
  dot: "*",
  dotOpen: "o",
  caret: "_",
  ellipsis: "...",
  sep: "-",
  dash: "--",
  arrow: "->",
  rule: "|",
  hRule: "-",
  arrowUp: "Up",
  arrowDown: "Dn",
  upDown: "Up/Dn",
  spinner: ["|", "/", "-", "\\"],
};

export const GLYPH_SETS = { unicode: UNICODE, ascii: ASCII } as const;

export type GlyphSetName = keyof typeof GLYPH_SETS;
