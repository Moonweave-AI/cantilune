/**
 * Cursor-aware text buffer for the input bar.
 *
 * Kept separate from the React component so the editing semantics (word jumps,
 * line navigation, kill-to-end) are plain functions that can be unit tested
 * without a terminal.
 */

export interface TextBuffer {
  readonly text: string;
  /** Caret position as a character offset into `text`. */
  readonly cursor: number;
}

export const EMPTY_BUFFER: TextBuffer = { text: "", cursor: 0 };

export function fromText(text: string): TextBuffer {
  return { text, cursor: text.length };
}

export function insert(buffer: TextBuffer, chunk: string): TextBuffer {
  const text = buffer.text.slice(0, buffer.cursor) + chunk + buffer.text.slice(buffer.cursor);
  return { text, cursor: buffer.cursor + chunk.length };
}

export function backspace(buffer: TextBuffer): TextBuffer {
  if (buffer.cursor === 0) return buffer;
  const text = buffer.text.slice(0, buffer.cursor - 1) + buffer.text.slice(buffer.cursor);
  return { text, cursor: buffer.cursor - 1 };
}

export function deleteForward(buffer: TextBuffer): TextBuffer {
  if (buffer.cursor >= buffer.text.length) return buffer;
  const text = buffer.text.slice(0, buffer.cursor) + buffer.text.slice(buffer.cursor + 1);
  return { text, cursor: buffer.cursor };
}

export function moveLeft(buffer: TextBuffer): TextBuffer {
  return buffer.cursor === 0 ? buffer : { ...buffer, cursor: buffer.cursor - 1 };
}

export function moveRight(buffer: TextBuffer): TextBuffer {
  return buffer.cursor >= buffer.text.length ? buffer : { ...buffer, cursor: buffer.cursor + 1 };
}

/** Start of the current visual line (after the preceding newline). */
export function lineStart(text: string, cursor: number): number {
  const index = text.lastIndexOf("\n", Math.max(0, cursor - 1));
  return index === -1 ? 0 : index + 1;
}

/** End of the current visual line (before the next newline). */
export function lineEnd(text: string, cursor: number): number {
  const index = text.indexOf("\n", cursor);
  return index === -1 ? text.length : index;
}

export function moveHome(buffer: TextBuffer): TextBuffer {
  return { ...buffer, cursor: lineStart(buffer.text, buffer.cursor) };
}

export function moveEnd(buffer: TextBuffer): TextBuffer {
  return { ...buffer, cursor: lineEnd(buffer.text, buffer.cursor) };
}

const WORD_BOUNDARY = /\s/;

export function moveWordLeft(buffer: TextBuffer): TextBuffer {
  let cursor = buffer.cursor;
  while (cursor > 0 && WORD_BOUNDARY.test(buffer.text[cursor - 1] ?? "")) cursor--;
  while (cursor > 0 && !WORD_BOUNDARY.test(buffer.text[cursor - 1] ?? "")) cursor--;
  return { ...buffer, cursor };
}

export function moveWordRight(buffer: TextBuffer): TextBuffer {
  let cursor = buffer.cursor;
  const length = buffer.text.length;
  while (cursor < length && WORD_BOUNDARY.test(buffer.text[cursor] ?? "")) cursor++;
  while (cursor < length && !WORD_BOUNDARY.test(buffer.text[cursor] ?? "")) cursor++;
  return { ...buffer, cursor };
}

export function deleteWordLeft(buffer: TextBuffer): TextBuffer {
  const target = moveWordLeft(buffer).cursor;
  if (target === buffer.cursor) return buffer;
  return {
    text: buffer.text.slice(0, target) + buffer.text.slice(buffer.cursor),
    cursor: target,
  };
}

/** Ctrl+K — delete from the caret to the end of the line. */
export function killToLineEnd(buffer: TextBuffer): TextBuffer {
  const end = lineEnd(buffer.text, buffer.cursor);
  if (end === buffer.cursor) return buffer;
  return {
    text: buffer.text.slice(0, buffer.cursor) + buffer.text.slice(end),
    cursor: buffer.cursor,
  };
}

/** Ctrl+U — delete from the start of the line to the caret. */
export function killToLineStart(buffer: TextBuffer): TextBuffer {
  const start = lineStart(buffer.text, buffer.cursor);
  if (start === buffer.cursor) return buffer;
  return {
    text: buffer.text.slice(0, start) + buffer.text.slice(buffer.cursor),
    cursor: start,
  };
}

export function newline(buffer: TextBuffer): TextBuffer {
  return insert(buffer, "\n");
}

/** Split the buffer for rendering: text before the caret, at it, and after. */
export function splitAtCursor(buffer: TextBuffer): {
  readonly before: string;
  readonly at: string;
  readonly after: string;
} {
  const at = buffer.text[buffer.cursor] ?? " ";
  return {
    before: buffer.text.slice(0, buffer.cursor),
    at: at === "\n" ? " " : at,
    after: buffer.text.slice(buffer.cursor + 1),
  };
}

/**
 * Detect a bracketed-paste-sized chunk.
 *
 * Ink delivers pasted text as one large `input` string rather than per-keypress.
 * Treating those as literal insertions (rather than command triggers) keeps
 * pasted content intact, including embedded newlines.
 */
export function looksLikePaste(input: string): boolean {
  return input.length > 1 && (input.includes("\n") || input.length > 8);
}
