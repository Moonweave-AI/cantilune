/**
 * The active theme: colours, glyphs, and border style resolved together.
 *
 * Themes are chosen explicitly (config or `/theme`) or detected from the
 * environment. Detection is deliberately conservative — when we cannot prove a
 * terminal supports something, we pick the variant that degrades gracefully
 * rather than the one that looks best.
 */
import { GLYPH_SETS, type GlyphSetName, type Glyphs } from "./glyphs.js";
import { PALETTES, isThemeName, type Color, type ThemeColors, type ThemeName } from "./palette.js";

export type { Color, ThemeColors, ThemeName } from "./palette.js";
export type { Glyphs } from "./glyphs.js";
export { THEME_NAMES, isThemeName } from "./palette.js";
export { GLYPH_SETS } from "./glyphs.js";

/** Ink border styles used across panels, kept in one place for consistency. */
export type BorderStyle = "round" | "single" | "classic";

/**
 * Ink `<Text>` props describing one level of emphasis.
 *
 * Spread directly onto a `<Text>`. Absent keys are genuinely absent rather than
 * explicitly `undefined`, which `exactOptionalPropertyTypes` requires.
 */
export interface TextStyle {
  readonly color?: string;
  readonly dimColor?: boolean;
  readonly bold?: boolean;
  readonly inverse?: boolean;
}

/**
 * Emphasis levels, resolved per theme.
 *
 * Colour alone cannot carry hierarchy: the monochrome theme has none, and the
 * 16-colour theme has too few shades to spare one for de-emphasis. Expressing
 * emphasis as a style rather than a colour lets those themes fall back to the
 * terminal's dim, bold and inverse attributes, so the layout still reads as a
 * hierarchy instead of a flat wall of text.
 */
export interface ThemeText {
  /** Hints, metrics, timestamps — legible but never competing with content. */
  readonly muted: TextStyle;
  /** Panel titles and section captions. */
  readonly heading: TextStyle;
  readonly accent: TextStyle;
  readonly success: TextStyle;
  readonly warning: TextStyle;
  readonly danger: TextStyle;
  readonly info: TextStyle;
  /** The highlighted row in a list or picker. */
  readonly selected: TextStyle;
}

export interface Theme {
  readonly name: ThemeName;
  readonly colors: ThemeColors;
  readonly text: ThemeText;
  readonly glyphs: Glyphs;
  /** Border style for panels; `classic` avoids box-drawing in ASCII mode. */
  readonly border: BorderStyle;
}

export interface DetectEnv {
  /** Raw environment, injected so detection is testable. */
  readonly env: Record<string, string | undefined>;
  /** Bit depth reported by the stream, as `getColorDepth()` returns it. */
  readonly colorDepth?: number;
}

/**
 * Resolve which glyph set is safe.
 *
 * Windows consoles running a non-UTF-8 code page render box-drawing characters
 * as garbage, and there is no reliable capability query, so we treat an
 * explicit opt-out or a non-UTF-8 locale as the signal.
 */
export function detectGlyphSet(env: Record<string, string | undefined>): GlyphSetName {
  if (env["CANTILUNE_ASCII"] === "1") return "ascii";
  const locale = env["LC_ALL"] ?? env["LC_CTYPE"] ?? env["LANG"] ?? "";
  // An empty locale on Windows Terminal is normal and does support unicode;
  // only a locale that names a non-UTF encoding is evidence against it.
  if (locale.length > 0 && !/utf-?8/i.test(locale)) return "ascii";
  return "unicode";
}

/**
 * Resolve a theme name from the environment.
 *
 * Precedence: NO_COLOR / FORCE_COLOR=0 disable colour outright, an explicit
 * `CANTILUNE_THEME` wins next, and otherwise colour depth decides between the
 * truecolor and 16-colour palettes.
 */
export function detectThemeName({ env, colorDepth }: DetectEnv): ThemeName {
  if (env["NO_COLOR"] !== undefined && env["NO_COLOR"] !== "") return "mono";
  if (env["FORCE_COLOR"] === "0") return "mono";

  const requested = env["CANTILUNE_THEME"];
  if (isThemeName(requested)) return requested;

  // `COLORFGBG`'s trailing field is the background colour index; a light
  // background is the one case where the dark-tuned palette is unreadable.
  const fgbg = env["COLORFGBG"];
  const light = fgbg !== undefined && /;(7|15)$/.test(fgbg);

  const depth = colorDepth ?? 24;
  if (depth <= 1) return "mono";
  if (depth < 24) return "ansi";
  return light ? "daylight" : "moonlight";
}

/**
 * Derive the emphasis levels a palette can actually express.
 *
 * Each level falls back independently: a palette that leaves `muted` unset gets
 * the terminal's dim attribute, and one that leaves `accent` unset marks the
 * selected row with inverse video. Palettes that do define those colours use
 * them and never invert — a full-width inverted bar is far too loud sitting
 * next to bordered panels.
 */
function buildText(colors: ThemeColors): ThemeText {
  const tinted = (color: Color, extra: TextStyle = {}): TextStyle => ({ ...fg(color), ...extra });

  return {
    muted: colors.muted === undefined ? { dimColor: true } : tinted(colors.muted),
    heading: tinted(colors.heading, { bold: true }),
    accent: tinted(colors.accent, { bold: true }),
    success: tinted(colors.success),
    warning: tinted(colors.warning),
    danger: tinted(colors.danger, { bold: true }),
    info: tinted(colors.info),
    selected:
      colors.accent === undefined ? { inverse: true } : tinted(colors.accent, { bold: true }),
  };
}

export function createTheme(name: ThemeName, glyphSet: GlyphSetName = "unicode"): Theme {
  const colors = PALETTES[name];
  return {
    name,
    colors,
    text: buildText(colors),
    glyphs: GLYPH_SETS[glyphSet],
    border: glyphSet === "ascii" ? "classic" : "round",
  };
}

/** Build the theme implied by the current process environment. */
export function detectTheme(
  env: Record<string, string | undefined> = process.env,
  colorDepth?: number,
): Theme {
  const depth = colorDepth ?? readColorDepth();
  return createTheme(
    detectThemeName({ env, ...(depth !== undefined ? { colorDepth: depth } : {}) }),
    detectGlyphSet(env),
  );
}

function readColorDepth(): number | undefined {
  const stdout: unknown = process.stdout;
  if (typeof stdout !== "object" || stdout === null) return undefined;
  const getter = (stdout as { getColorDepth?: () => number }).getColorDepth;
  return typeof getter === "function" ? getter.call(stdout) : undefined;
}

/** The theme used when no provider is mounted, e.g. in unit tests. */
export const DEFAULT_THEME: Theme = createTheme("moonlight", "unicode");

/**
 * Spread a colour into Ink props.
 *
 * `exactOptionalPropertyTypes` rejects `color={undefined}`, and "inherit the
 * terminal foreground" is a real state in every palette, so colour always
 * travels as a spread rather than a direct prop.
 */
export function fg(color: Color): { color?: string } {
  return color !== undefined ? { color } : {};
}

/** Same as {@link fg} for the `borderColor` prop. */
export function border(color: Color): { borderColor?: string } {
  return color !== undefined ? { borderColor: color } : {};
}
