export interface TimelineEntry {
  timestamp: number;
  label: string;
  detail?: string;
  kind: string;
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  const ms = String(d.getMilliseconds()).padStart(3, "0");
  return `${hh}:${mm}:${ss}.${ms}`;
}

export function renderTimeline(entries: TimelineEntry[]): string {
  if (entries.length === 0) return "(empty timeline)";

  const sorted = [...entries].sort((a, b) => a.timestamp - b.timestamp);
  const tsWidth = Math.max(...sorted.map((e) => formatTimestamp(e.timestamp).length));
  const kindWidth = Math.max(4, ...sorted.map((e) => e.kind.length));

  const lines: string[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const entry = sorted[i];
    if (entry === undefined) continue;
    const ts = formatTimestamp(entry.timestamp).padEnd(tsWidth);
    const kind = entry.kind.padEnd(kindWidth);
    const connector = i < sorted.length - 1 ? "│" : " ";
    lines.push(`${ts}  ${connector}  [${kind}] ${entry.label}`);
    if (entry.detail !== undefined && entry.detail.length > 0) {
      lines.push(`${" ".repeat(tsWidth)}  ${connector}    ${entry.detail}`);
    }
  }
  return lines.join("\n");
}
