import type { TuiMode } from "../store.js";

/** Status line. */
export const STATUS_ROWS = 1;
/** Hairline under the status bar. */
export const DIVIDER_ROWS = 1;
/** Bordered single-line prompt (top rule, text, bottom rule). */
export const INPUT_BOX_ROWS = 3;
/** Keybinding hint under the prompt. */
export const HINT_ROWS = 1;
/** Palette border + header + footer, excluding suggestion rows. */
export const PALETTE_CHROME_ROWS = 4;
/** Minimum transcript rows kept when the palette or a dialog is open. */
export const MIN_CHAT_ROWS = 3;
/** Suggestion rows shown at once; never more than this. */
export const MAX_PALETTE_ROWS = 8;

/** Fixed chrome below the transcript when the palette is closed. */
export function chromeRows(notice: boolean): number {
  return STATUS_ROWS + (notice ? 1 : 0) + DIVIDER_ROWS + INPUT_BOX_ROWS + HINT_ROWS;
}

/** Rows reserved so stacked dialogs cannot push the prompt off-screen. */
export function dialogReserveRows(mode: TuiMode): number {
  if (mode === "picker" || mode === "ask" || mode === "approve" || mode === "confirm") {
    return 8;
  }
  return 0;
}

/** How many command rows the overlay may show without collapsing the chat. */
export function paletteVisibleRows(rows: number, notice: boolean): number {
  const reserved = chromeRows(notice) + MIN_CHAT_ROWS + PALETTE_CHROME_ROWS;
  return Math.max(MIN_CHAT_ROWS, Math.min(MAX_PALETTE_ROWS, rows - reserved));
}

/** Transcript height that keeps the whole frame inside the terminal. */
export function chatBodyHeight(options: {
  readonly rows: number;
  readonly notice: boolean;
  readonly overlayRows: number;
  readonly dialogRows: number;
}): number {
  return Math.max(
    MIN_CHAT_ROWS,
    options.rows - chromeRows(options.notice) - options.overlayRows - options.dialogRows,
  );
}

/** Overlay height reported by InputBar so App can shrink the transcript. */
export function estimatePaletteOverlayRows(
  overlayOpen: boolean,
  suggestionCount: number,
  visibleRows: number,
  hasUsage: boolean,
): number {
  if (!overlayOpen) return 0;
  if (suggestionCount === 0) {
    return PALETTE_CHROME_ROWS + (hasUsage ? 3 : 1);
  }
  return PALETTE_CHROME_ROWS + Math.min(visibleRows, suggestionCount);
}
