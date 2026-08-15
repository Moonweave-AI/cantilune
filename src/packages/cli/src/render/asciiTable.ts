export interface TableColumn {
  header: string;
  width?: number;
  align?: "left" | "right" | "center";
}

function padCell(value: string, width: number, align: TableColumn["align"]): string {
  if (value.length >= width) return value.slice(0, width);
  const padding = width - value.length;
  if (align === "right") return " ".repeat(padding) + value;
  if (align === "center") {
    const left = Math.floor(padding / 2);
    return " ".repeat(left) + value + " ".repeat(padding - left);
  }
  return value + " ".repeat(padding);
}

export function renderTable(columns: TableColumn[], rows: string[][]): string {
  if (columns.length === 0) return "";

  const widths = columns.map((col, idx) => {
    const dataWidth = rows.reduce((max, row) => Math.max(max, (row[idx] ?? "").length), 0);
    return Math.max(col.width ?? 0, col.header.length, dataWidth);
  });

  const hLine = (left: string, mid: string, right: string, sep: string) =>
    left + widths.map((w) => "─".repeat(w + 2)).join(sep) + right;

  const renderRow = (cells: string[], isHeader = false) => {
    const parts = widths.map((w, idx) => {
      const col = columns[idx];
      const cell = cells[idx] ?? "";
      const align = isHeader ? "center" : (col?.align ?? "left");
      return ` ${padCell(cell, w, align)} `;
    });
    return "│" + parts.join("│") + "│";
  };

  const lines: string[] = [];
  lines.push(
    hLine("┌", "┬", "┐", "┬"),
    renderRow(
      columns.map((c) => c.header),
      true,
    ),
    hLine("├", "┼", "┤", "┼"),
  );
  for (const row of rows) {
    lines.push(renderRow(row));
  }
  lines.push(hLine("└", "┴", "┘", "┴"));
  return lines.join("\n");
}
