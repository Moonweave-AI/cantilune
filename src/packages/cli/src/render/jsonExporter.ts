export function exportJson(data: unknown, indent = 2): string {
  return JSON.stringify(data, null, indent);
}
