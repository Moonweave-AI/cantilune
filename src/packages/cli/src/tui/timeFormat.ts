/**
 * Format a timestamp relative to a base as a compact `+Ns` / `+Nms` offset.
 *
 * Shared by the inline lifecycle rail (ChatPanel) and the live event stream
 * (EventView) so the two presentations of the same process stay in sync.
 */
export function formatRelative(ts: number, base: number): string {
  const delta = Math.max(0, ts - base);
  if (delta < 1000) return `+${delta}ms`;
  if (delta < 60_000) return `+${(delta / 1000).toFixed(1)}s`;
  return `+${Math.floor(delta / 60_000)}m${Math.floor((delta % 60_000) / 1000)}s`;
}
