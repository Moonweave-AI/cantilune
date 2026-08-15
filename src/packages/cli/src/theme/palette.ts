/**
 * Semantic colour tokens and the built-in palettes that realise them.
 *
 * Components never name a colour directly. They ask for a role — `success`,
 * `border`, `roleUser` — and the active theme decides what that looks like.
 * This keeps a palette swap to a single file and lets the CLI degrade to
 * 16-colour and no-colour terminals without touching component code.
 *
 * A token resolving to `undefined` means "leave the terminal's own foreground
 * alone", which is what makes the monochrome and light themes readable on
 * backgrounds we cannot inspect.
 */

/** A resolved colour, or `undefined` to inherit the terminal foreground. */
export type Color = string | undefined;

export type ThemeName = "moonlight" | "daylight" | "ansi" | "mono";

export interface ThemeColors {
  /** Primary brand / interactive accent: prompts, focus rings, live carets. */
  readonly accent: Color;
  /** Secondary accent used to separate structure from interaction. */
  readonly accentAlt: Color;

  readonly success: Color;
  readonly warning: Color;
  readonly danger: Color;
  readonly info: Color;

  /** De-emphasised text that still needs to be legible (metrics, hints). */
  readonly muted: Color;
  /** Section titles and panel captions. */
  readonly heading: Color;

  readonly border: Color;
  readonly borderActive: Color;

  /** Transcript roles. `roleAssistant` is normally the terminal default. */
  readonly roleUser: Color;
  readonly roleAssistant: Color;
  readonly roleSystem: Color;
  readonly roleError: Color;
}

export type ColorTokenName = keyof ThemeColors;

/**
 * Tokyo-Night derived palette. The default: tuned for dark terminals, which is
 * what the overwhelming majority of terminal sessions use.
 *
 * `muted` and `border` sit deliberately above Tokyo Night's own comment and
 * selection shades. Those are picked to recede behind syntax highlighting, but
 * here they carry status metrics and panel edges that have to stay legible.
 */
const MOONLIGHT: ThemeColors = {
  accent: "#7AA2F7",
  accentAlt: "#BB9AF7",
  success: "#9ECE6A",
  warning: "#E0AF68",
  danger: "#F7768E",
  info: "#7DCFFF",
  muted: "#8A92B2",
  heading: "#C0CAF5",
  border: "#414868",
  borderActive: "#7AA2F7",
  roleUser: "#7DCFFF",
  roleAssistant: undefined,
  roleSystem: "#8A92B2",
  roleError: "#F7768E",
};

/**
 * Light-background counterpart. Every hue is darkened well past the contrast
 * floor so it survives a white terminal, where MOONLIGHT would wash out.
 */
const DAYLIGHT: ThemeColors = {
  accent: "#2563EB",
  accentAlt: "#7C3AED",
  success: "#15803D",
  warning: "#B45309",
  danger: "#BE123C",
  info: "#0369A1",
  muted: "#64748B",
  heading: "#1E293B",
  border: "#94A3B8",
  borderActive: "#2563EB",
  roleUser: "#0369A1",
  roleAssistant: undefined,
  roleSystem: "#64748B",
  roleError: "#BE123C",
};

/**
 * 16-colour fallback. Named ANSI colours resolve against whatever palette the
 * user configured in their terminal, so this adapts where hex cannot.
 *
 * `muted` and `heading` are left unset on purpose: bright-black is unreadably
 * dark in several popular 16-colour schemes, so de-emphasis falls through to
 * the terminal's own dim attribute and headings fall through to bold.
 */
const ANSI: ThemeColors = {
  accent: "cyan",
  accentAlt: "magenta",
  success: "green",
  warning: "yellow",
  danger: "red",
  // Plain `blue` is near-black in most dark 16-colour schemes.
  info: "blueBright",
  muted: undefined,
  heading: undefined,
  border: "gray",
  borderActive: "cyan",
  roleUser: "cyan",
  roleAssistant: undefined,
  roleSystem: "gray",
  roleError: "red",
};

/** No colour at all: hierarchy comes from bold, dim and inverse only. */
const MONO: ThemeColors = {
  accent: undefined,
  accentAlt: undefined,
  success: undefined,
  warning: undefined,
  danger: undefined,
  info: undefined,
  muted: undefined,
  heading: undefined,
  border: undefined,
  borderActive: undefined,
  roleUser: undefined,
  roleAssistant: undefined,
  roleSystem: undefined,
  roleError: undefined,
};

export const PALETTES: Record<ThemeName, ThemeColors> = {
  moonlight: MOONLIGHT,
  daylight: DAYLIGHT,
  ansi: ANSI,
  mono: MONO,
};

export const THEME_NAMES: readonly ThemeName[] = ["moonlight", "daylight", "ansi", "mono"];

export function isThemeName(value: unknown): value is ThemeName {
  return typeof value === "string" && (THEME_NAMES as readonly string[]).includes(value);
}
