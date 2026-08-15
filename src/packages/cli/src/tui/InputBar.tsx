import React, { useCallback, useMemo, useState } from "react";
import { Box, Text, useInput, type Key } from "ink";
import type { SlashCommand } from "../commands/registry.js";
import { acceptSuggestion, suggestCommands, type SuggestResult } from "../commands/suggest.js";
import { useTheme } from "../theme/themeContext.js";
import { border, fg } from "../theme/theme.js";
import { CommandPalette } from "./CommandPalette.js";
import * as buf from "./textBuffer.js";
import type { TextBuffer } from "./textBuffer.js";

export interface InputBarProps {
  readonly disabled?: boolean;
  readonly onSubmit: (value: string) => void;
  readonly history?: readonly string[];
  readonly width?: number;
  /** Registered commands, used to build the inline slash suggestion overlay. */
  readonly commands?: readonly SlashCommand[];
  readonly placeholder?: string;
  /** Suggestion rows shown at once before scrolling. */
  readonly suggestionRows?: number;
}

/** Caret movements, keyed by the letter pressed with Ctrl. */
const CTRL_MOVES: Readonly<Record<string, (current: TextBuffer) => TextBuffer>> = {
  a: buf.moveHome,
  e: buf.moveEnd,
  b: buf.moveLeft,
  f: buf.moveRight,
};

/** Ctrl shortcuts that change the text. */
const CTRL_EDITS: Readonly<Record<string, (current: TextBuffer) => TextBuffer>> = {
  k: buf.killToLineEnd,
  u: buf.killToLineStart,
  w: buf.deleteWordLeft,
};

const NO_SUGGESTIONS: SuggestResult = { suggestions: [], usage: null, runnable: false };

/**
 * Whether the text reads as an attempt at a command.
 *
 * A command's first segment never contains a second slash, which separates
 * `/wor` from a pasted `/usr/local/bin` — the latter must not raise an overlay
 * claiming no command matched.
 */
function looksLikeCommand(text: string): boolean {
  if (!text.startsWith("/")) return false;
  const firstSegment = text.split(/\s/, 1)[0] ?? "";
  return !firstSegment.slice(1).includes("/");
}

/**
 * One step through the history ring. A `null` index means "typing fresh text";
 * walking forward past the newest entry returns there rather than wrapping.
 * `null` as a whole means the keypress should be ignored.
 */
export function historyStep(
  history: readonly string[],
  index: number | null,
  direction: -1 | 1,
): { readonly index: number | null; readonly text: string } | null {
  if (history.length === 0) return null;
  if (direction === -1) {
    const next = index === null ? history.length - 1 : Math.max(0, index - 1);
    return { index: next, text: history[next] ?? "" };
  }
  if (index === null) return null;
  const next = index + 1;
  if (next >= history.length) return { index: null, text: "" };
  return { index: next, text: history[next] ?? "" };
}

/** The footer line, which doubles as the keymap for the current input state. */
function hintLine(
  glyphs: ReturnType<typeof useTheme>["glyphs"],
  state: { readonly disabled: boolean; readonly overlayOpen: boolean; readonly lineCount: number },
): string {
  const sep = glyphs.sep;
  if (state.disabled) return `running ${sep} Ctrl+C to interrupt`;
  if (state.lineCount > 1) {
    return `${state.lineCount} lines ${sep} Enter sends ${sep} Shift+Enter newline`;
  }
  if (state.overlayOpen) {
    return `${glyphs.upDown} select ${sep} Tab complete ${sep} Enter run ${sep} Esc dismiss`;
  }
  return `/ commands ${sep} ${glyphs.arrowUp} history ${sep} Ctrl+O observe`;
}

export function InputBar({
  disabled = false,
  onSubmit,
  history = [],
  width = 100,
  commands = [],
  placeholder,
  suggestionRows = 8,
}: InputBarProps): React.ReactElement {
  const theme = useTheme();
  const [buffer, setBuffer] = useState<TextBuffer>(buf.EMPTY_BUFFER);
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const [selected, setSelected] = useState(0);
  /** Set by Esc, so the overlay can be hidden without clearing the text. */
  const [dismissed, setDismissed] = useState(false);

  /**
   * Text edits invalidate the highlighted suggestion and re-open a dismissed
   * overlay; bare caret movement does neither, so the two have separate paths.
   */
  const editText = useCallback((next: (current: TextBuffer) => TextBuffer) => {
    setBuffer(next);
    setSelected(0);
    setDismissed(false);
    setHistoryIndex(null);
  }, []);

  const replaceText = useCallback(
    (text: string) => {
      editText(() => buf.fromText(text));
    },
    [editText],
  );

  const commandLike = looksLikeCommand(buffer.text);

  const suggest = useMemo(
    () => (looksLikeCommand(buffer.text) ? suggestCommands(commands, buffer.text) : NO_SUGGESTIONS),
    [buffer.text, commands],
  );

  // Kept open even with nothing to show, so a mistyped command says so instead
  // of silently offering nothing.
  const overlayOpen = !disabled && !dismissed && commandLike;
  const safeSelected =
    suggest.suggestions.length === 0 ? 0 : Math.min(selected, suggest.suggestions.length - 1);
  const active = suggest.suggestions[safeSelected];

  const submit = useCallback(
    (value: string) => {
      const trimmed = value.trim();
      if (trimmed.length === 0) return;
      onSubmit(trimmed);
      setBuffer(buf.EMPTY_BUFFER);
      setHistoryIndex(null);
      setSelected(0);
      setDismissed(false);
    },
    [onSubmit],
  );

  const recallHistory = useCallback(
    (direction: -1 | 1) => {
      const step = historyStep(history, historyIndex, direction);
      if (step === null) return;
      setHistoryIndex(step.index);
      setBuffer(buf.fromText(step.text));
    },
    [history, historyIndex],
  );

  const handleReturn = (key: Key): void => {
    // Shift+Enter (and Meta+Enter on terminals that send it) inserts a newline.
    if (key.shift || key.meta) {
      editText(buf.newline);
      return;
    }
    // A trailing backslash continues onto the next line, shell-style.
    if (buffer.text.endsWith("\\")) {
      editText((prev) => buf.newline({ text: prev.text.slice(0, -1), cursor: prev.cursor - 1 }));
      return;
    }
    // Enter runs the highlighted row when it can run as typed. A pure parent
    // segment, or one still missing arguments, completes instead — that is what
    // stops a palette pick from failing with "Missing required argument".
    if (overlayOpen && active !== undefined) {
      if (active.command !== undefined && active.requiredArgs.length === 0) {
        submit(active.name);
      } else {
        replaceText(acceptSuggestion(active));
      }
      return;
    }
    submit(buffer.text);
  };

  const handleArrow = (key: Key): boolean => {
    if (key.leftArrow) {
      setBuffer(key.meta ? buf.moveWordLeft : buf.moveLeft);
      return true;
    }
    if (key.rightArrow) {
      setBuffer(key.meta ? buf.moveWordRight : buf.moveRight);
      return true;
    }
    if (!key.upArrow && !key.downArrow) return false;

    // The arrows drive the suggestion list while it is open, and history recall
    // otherwise. Multiline text keeps its own navigation.
    if (overlayOpen && suggest.suggestions.length > 0) {
      const limit = suggest.suggestions.length - 1;
      setSelected(key.upArrow ? Math.max(0, safeSelected - 1) : Math.min(limit, safeSelected + 1));
    } else if (!buffer.text.includes("\n")) {
      recallHistory(key.upArrow ? -1 : 1);
    }
    return true;
  };

  /**
   * Ink reports the physical Backspace key as `key.delete`, because the
   * terminal sends DEL (0x7f) and Ink maps that alongside the real Delete key's
   * `ESC [ 3 ~`. Routing `key.delete` to a forward delete therefore made
   * Backspace a no-op at the end of a line — the common case. The two are
   * indistinguishable through `useInput`, so both delete backwards; Ctrl+K
   * covers deleting forward.
   */
  const handleErase = (key: Key): boolean => {
    if (!key.backspace && !key.delete) return false;
    editText(buf.backspace);
    return true;
  };

  const handleCtrl = (input: string): void => {
    const move = CTRL_MOVES[input];
    if (move !== undefined) {
      setBuffer(move);
      return;
    }
    const edit = CTRL_EDITS[input];
    if (edit !== undefined) editText(edit);
  };

  useInput(
    (input, key) => {
      if (disabled) return;

      // Paste arrives as one chunk; insert verbatim before any key interpretation.
      if (buf.looksLikePaste(input) && !key.ctrl && !key.meta) {
        editText((prev) => buf.insert(prev, input));
        return;
      }

      if (key.escape) {
        if (overlayOpen) setDismissed(true);
        return;
      }

      if (key.return) {
        handleReturn(key);
        return;
      }

      if (key.tab) {
        // Tab only ever completes, so drilling into a subcommand tree can never
        // run something by accident.
        if (overlayOpen && active !== undefined) replaceText(acceptSuggestion(active));
        return;
      }

      if (key.ctrl) {
        handleCtrl(input);
        return;
      }

      if (handleArrow(key) || handleErase(key)) return;
      if (input.length === 0) return;

      editText((prev) => buf.insert(prev, input));
    },
    { isActive: !disabled },
  );

  const { before, at, after } = buf.splitAtCursor(buffer);
  const { colors, glyphs, text } = theme;
  // Defaulted here rather than in the signature so the hint can use the
  // theme's ellipsis, which differs between the unicode and ASCII glyph sets.
  const hint = placeholder ?? `Ask anything${glyphs.ellipsis}`;
  const isEmpty = buffer.text.length === 0;
  const lineCount = buffer.text.split("\n").length;
  const isCommand = buffer.text.startsWith("/");

  // Ghost text completes the highlighted suggestion inline, so the next keypress
  // is predictable without reading the overlay.
  const ghost =
    overlayOpen && active !== undefined && active.name.startsWith(buffer.text)
      ? active.name.slice(buffer.text.length)
      : "";

  // The frame colour is the primary "can I type?" signal: accent while the
  // prompt is live, receding to the border colour whenever a run holds it.
  const liveFrame = isCommand ? colors.accentAlt : colors.accent;
  const frame = disabled ? colors.border : liveFrame;
  const footer = hintLine(glyphs, { disabled, overlayOpen, lineCount });

  return (
    <Box flexDirection="column">
      {overlayOpen ? (
        <CommandPalette
          suggestions={suggest.suggestions}
          usage={suggest.usage}
          selected={safeSelected}
          visibleRows={suggestionRows}
        />
      ) : null}

      <Box paddingX={1} borderStyle={theme.border} {...border(frame)}>
        <Text {...fg(frame)}>{disabled ? `${glyphs.promptBusy} ` : `${glyphs.prompt} `}</Text>
        <Box flexGrow={1}>
          {isEmpty && !disabled ? (
            <Text {...text.muted}>{hint}</Text>
          ) : (
            <Text wrap="wrap">
              {before}
              <Text inverse>{at}</Text>
              {after}
              {ghost.length > 0 ? <Text {...text.muted}>{ghost}</Text> : null}
            </Text>
          )}
        </Box>
      </Box>

      <Box paddingX={1} justifyContent="space-between">
        <Text {...text.muted}>{footer}</Text>
        {width >= 80 && !isEmpty ? <Text {...text.muted}>{buffer.text.length} chars</Text> : null}
      </Box>
    </Box>
  );
}
