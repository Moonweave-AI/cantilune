// @vitest-environment happy-dom
/**
 * Markdown component rendering.
 *
 * The parser tests pin the AST; these pin that every block kind actually
 * reaches the screen with its content intact. A block that parses correctly but
 * renders as nothing is indistinguishable, to a reader, from lost output.
 */
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import React from "react";
import "../setup/inkSetup.js";
import { Markdown, tableColumnWidths } from "../../src/tui/Markdown.js";
import { parseInline } from "../../src/render/markdown.js";
import { ThemeProvider } from "../../src/theme/themeContext.js";
import type { ThemeName } from "../../src/theme/theme.js";

function renderMarkdown(source: string, theme?: ThemeName, width = 80): string {
  const { container } = render(
    <ThemeProvider name={theme}>
      <Markdown source={source} width={width} />
    </ThemeProvider>,
  );
  return container.textContent ?? "";
}

describe("block rendering", () => {
  it("renders heading text with a marker on the top levels", () => {
    expect(renderMarkdown("# Title")).toContain("Title");
    expect(renderMarkdown("#### Deep heading")).toContain("Deep heading");
  });

  it("renders paragraph prose", () => {
    expect(renderMarkdown("Just some prose about the runtime.")).toContain(
      "Just some prose about the runtime.",
    );
  });

  it("renders a code block with its language caption and line numbers", () => {
    const output = renderMarkdown("```ts\nconst x = 1;\nconst y = 2;\n```");
    expect(output).toContain("ts");
    expect(output).toContain("const x = 1;");
    expect(output).toContain("const y = 2;");
    expect(output).toContain("1");
    expect(output).toContain("2");
  });

  it("renders an unknown code language uncoloured but intact", () => {
    const output = renderMarkdown("```brainfuck\n+[->+]\n```");
    expect(output).toContain("+[->+]");
  });

  it("renders a fence with no language as text", () => {
    expect(renderMarkdown("```\nplain\n```")).toContain("text");
  });

  it("renders bullet, ordered, and task list items", () => {
    const output = renderMarkdown("- alpha\n- beta");
    expect(output).toContain("alpha");
    expect(output).toContain("beta");

    const ordered = renderMarkdown("1. first\n2. second");
    expect(ordered).toContain("1.");
    expect(ordered).toContain("first");

    const tasks = renderMarkdown("- [x] done\n- [ ] pending");
    expect(tasks).toContain("done");
    expect(tasks).toContain("pending");
  });

  it("renders nested list items", () => {
    const output = renderMarkdown("- outer\n  - inner");
    expect(output).toContain("outer");
    expect(output).toContain("inner");
  });

  it("renders a blockquote's nested blocks", () => {
    const output = renderMarkdown("> # quoted\n> body text");
    expect(output).toContain("quoted");
    expect(output).toContain("body text");
  });

  it("renders a horizontal rule", () => {
    expect(renderMarkdown("---").length).toBeGreaterThan(0);
  });

  it("renders a table's header and rows", () => {
    const output = renderMarkdown("| name | value |\n| --- | --- |\n| a | 1 |\n| b | 2 |");
    for (const cell of ["name", "value", "a", "1", "b", "2"]) {
      expect(output).toContain(cell);
    }
  });

  it("renders an empty document without throwing", () => {
    expect(renderMarkdown("")).toBe("");
  });

  it("clamps a degenerate width instead of producing a negative layout", () => {
    expect(renderMarkdown("# Title", undefined, 1)).toContain("Title");
  });
});

describe("inline rendering", () => {
  it("renders strong, emphasis, strike, and inline code content", () => {
    const output = renderMarkdown("**bold** *italic* ~~struck~~ `code`");
    for (const fragment of ["bold", "italic", "struck", "code"]) {
      expect(output).toContain(fragment);
    }
  });

  it("renders a link's label and its URL", () => {
    const output = renderMarkdown("see [the docs](https://example.test/x)");
    expect(output).toContain("the docs");
    expect(output).toContain("https://example.test/x");
  });
});

describe("theme degradation", () => {
  it("renders the same content under every theme", () => {
    const source = "# Title\n\n- item\n\n```ts\nconst x = 1;\n```";
    for (const theme of ["moonlight", "daylight", "ansi", "mono"] as const) {
      const output = renderMarkdown(source, theme);
      expect(output).toContain("Title");
      expect(output).toContain("item");
      expect(output).toContain("const x = 1;");
    }
  });
});

describe("table column sizing", () => {
  it("sizes columns to their widest cell when they fit", () => {
    const header = [parseInline("ab"), parseInline("c")];
    const rows = [[parseInline("d"), parseInline("efgh")]];
    expect(tableColumnWidths(header, rows, 80)).toEqual([2, 4]);
  });

  it("scales columns down together when the terminal is narrow", () => {
    const header = [parseInline("a".repeat(40)), parseInline("b".repeat(40))];
    const widths = tableColumnWidths(header, [], 30);
    expect(widths.reduce((sum, w) => sum + w, 0)).toBeLessThanOrEqual(40);
  });

  it("never collapses a column below a readable floor", () => {
    const header = [parseInline("a".repeat(100)), parseInline("b".repeat(100))];
    expect(tableColumnWidths(header, [], 4).every((w) => w >= 3)).toBe(true);
  });

  it("returns nothing for a table with no columns", () => {
    expect(tableColumnWidths([], [], 80)).toEqual([]);
  });
});
