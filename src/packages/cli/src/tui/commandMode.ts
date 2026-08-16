/**
 * The confirmation prompt a command requested, or `null` when none is pending.
 *
 * A command signals one by switching to `confirm` mode and putting its copy in
 * `viewArgs.message`; that is the only channel a command handler has, since
 * handlers receive the store rather than React state.
 */
export function readConfirmMessage(mode: string, viewArgs: Record<string, unknown>): string | null {
  if (mode !== "confirm") return null;
  const message = viewArgs.message;
  return typeof message === "string" && message.length > 0 ? message : "Are you sure?";
}

/**
 * Modes a command owns after it returns. `/quit` sets `confirm`; `/provider`
 * sets `picker`. Resetting those to `chat` is what made `/quit` a no-op:
 * the dialog never stayed mounted, and the only way out was Ctrl+C.
 */
export function commandRetainsMode(mode: string): boolean {
  return mode === "picker" || mode === "confirm" || mode === "ask" || mode === "approve";
}

/** Mode to commit after a slash command, given what the handler left behind. */
export function modeAfterCommand(mode: string, activeView: string | null): string {
  if (commandRetainsMode(mode)) return mode;
  return activeView !== null ? "view" : "chat";
}
