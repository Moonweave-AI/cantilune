/** Compact relative time for sidebar rows (DSH: "7小时"). */

export function formatRelativeTime(fromMs: number, nowMs = Date.now()): string {
  const delta = Math.max(0, nowMs - fromMs);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (delta < minute) return "刚刚";
  if (delta < hour) return `${Math.floor(delta / minute)} 分钟`;
  if (delta < day) return `${Math.floor(delta / hour)} 小时`;
  if (delta < 7 * day) return `${Math.floor(delta / day)} 天`;
  return new Date(fromMs).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
}
