/**
 * Markdown parser tests.
 *
 * The parser's contract is that assistant prose survives it: every construct it
 * recognises is structured, and everything else degrades to a paragraph rather
 * than being dropped. These cases pin both halves.
 */
import { describe, it, expect } from "vitest";
import {
  parseMarkdown,
  parseInline,
  looksLikeMarkdown,
  normalizeAssistantMarkdown,
} from "../../src/render/markdown.js";
import type { MarkdownBlock } from "../../src/render/markdown.js";

function kinds(blocks: readonly MarkdownBlock[]): readonly string[] {
  return blocks.map((b) => b.kind);
}

/** Assert a block's kind and narrow it, so the assertions below stay typed. */
function expectBlock<K extends MarkdownBlock["kind"]>(
  block: MarkdownBlock | undefined,
  kind: K,
): Extract<MarkdownBlock, { kind: K }> {
  expect(block?.kind).toBe(kind);
  return block as Extract<MarkdownBlock, { kind: K }>;
}

describe("block parsing", () => {
  it("parses headings with their level", () => {
    const blocks = parseMarkdown("# One\n\n### Three");
    expect(kinds(blocks)).toEqual(["heading", "heading"]);
    expect(blocks[0]).toMatchObject({ level: 1 });
    expect(blocks[1]).toMatchObject({ level: 3 });
  });

  it("keeps a heading as its own block without a blank line after it", () => {
    const blocks = parseMarkdown("### src/pickDirectory.ts\nWindows uses Add-Type");
    expect(kinds(blocks)).toEqual(["heading", "paragraph"]);
  });

  it("starts a table immediately after a heading", () => {
    const blocks = parseMarkdown("### 集成测试\n|脚本|端口|\n|---|---|\n|smoke|7475|");
    expect(kinds(blocks)).toEqual(["heading", "table"]);
    const table = expectBlock(blocks[1], "table");
    expect(table.header).toHaveLength(2);
    expect(table.rows).toHaveLength(1);
  });

  it("does not swallow a table into the preceding paragraph", () => {
    const blocks = parseMarkdown("简介如下\n|脚本|端口|\n|---|---|\n|smoke|7475|");
    expect(kinds(blocks)).toEqual(["paragraph", "table"]);
  });

  it("parses a fenced code block with its language and keeps lines verbatim", () => {
    const blocks = parseMarkdown("```ts\nconst x = 1;\n  indented\n```");
    expect(blocks[0]).toEqual({
      kind: "code",
      language: "ts",
      lines: ["const x = 1;", "  indented"],
    });
  });

  it("treats an unterminated fence as running to the end of input", () => {
    const code = expectBlock(parseMarkdown("```\nstill code\nmore code")[0], "code");
    expect(code.language).toBeUndefined();
    expect(code.lines).toEqual(["still code", "more code"]);
  });

  it("does not interpret markdown inside a fence", () => {
    const blocks = parseMarkdown("```\n# not a heading\n- not a list\n```");
    expect(kinds(blocks)).toEqual(["code"]);
  });

  it("parses bullet and ordered lists, recording nesting depth", () => {
    const list = expectBlock(parseMarkdown("- one\n  - nested\n- two")[0], "list");
    expect(list.items.map((i) => i.depth)).toEqual([0, 1, 0]);
  });

  it("records ordinals for an ordered list", () => {
    const list = expectBlock(parseMarkdown("1. first\n2. second")[0], "list");
    expect(list.items.map((i) => i.ordinal)).toEqual([1, 2]);
  });

  it("records task-list checkbox state", () => {
    const list = expectBlock(parseMarkdown("- [x] done\n- [ ] todo")[0], "list");
    expect(list.items.map((i) => i.checked)).toEqual([true, false]);
  });

  it("parses a blockquote by re-parsing its contents", () => {
    const quote = expectBlock(parseMarkdown("> # quoted heading\n> body")[0], "quote");
    expect(kinds(quote.blocks)).toEqual(["heading", "paragraph"]);
  });

  it("parses a horizontal rule rather than reading it as a list", () => {
    expect(kinds(parseMarkdown("---"))).toEqual(["rule"]);
    expect(kinds(parseMarkdown("***"))).toEqual(["rule"]);
  });

  it("parses a pipe table with alignments", () => {
    const table = expectBlock(
      parseMarkdown("| a | b | c |\n| :- | :-: | -: |\n| 1 | 2 | 3 |")[0],
      "table",
    );
    expect(table.header).toHaveLength(3);
    expect(table.rows).toHaveLength(1);
    expect(table.alignments).toEqual(["left", "center", "right"]);
  });

  it("joins a soft-wrapped paragraph into one block", () => {
    const blocks = parseMarkdown("first line\nsecond line\n\nnew paragraph");
    expect(kinds(blocks)).toEqual(["paragraph", "paragraph"]);
    const paragraph = expectBlock(blocks[0], "paragraph");
    expect(paragraph.spans[0]?.value).toBe("first line second line");
  });

  it("returns nothing for empty or whitespace-only input", () => {
    expect(parseMarkdown("")).toEqual([]);
    expect(parseMarkdown("\n\n  \n")).toEqual([]);
  });

  it("keeps unrecognised text as a paragraph rather than dropping it", () => {
    const blocks = parseMarkdown("<<< nothing recognises this >>>");
    expect(kinds(blocks)).toEqual(["paragraph"]);
  });
});

describe("inline parsing", () => {
  it("parses strong, emphasis, strike, code, and links", () => {
    expect(parseInline("**b**")).toEqual([{ kind: "strong", value: "b" }]);
    expect(parseInline("*i*")).toEqual([{ kind: "emphasis", value: "i" }]);
    expect(parseInline("__b__")).toEqual([{ kind: "strong", value: "b" }]);
    expect(parseInline("~~s~~")).toEqual([{ kind: "strike", value: "s" }]);
    expect(parseInline("`c`")).toEqual([{ kind: "code", value: "c" }]);
    expect(parseInline("[t](u)")).toEqual([{ kind: "link", value: "t", href: "u" }]);
  });

  it("keeps markup inside inline code literal", () => {
    expect(parseInline("`**not bold**`")).toEqual([{ kind: "code", value: "**not bold**" }]);
  });

  it("reads ** as strong rather than nested emphasis", () => {
    expect(parseInline("**x**")).toEqual([{ kind: "strong", value: "x" }]);
  });

  it("does not treat snake_case as emphasis", () => {
    expect(parseInline("some_var_name")).toEqual([{ kind: "text", value: "some_var_name" }]);
  });

  it("interleaves plain text around markup", () => {
    expect(parseInline("a **b** c")).toEqual([
      { kind: "text", value: "a " },
      { kind: "strong", value: "b" },
      { kind: "text", value: " c" },
    ]);
  });

  it("returns nothing for an empty run", () => {
    expect(parseInline("")).toEqual([]);
  });
});

describe("looksLikeMarkdown", () => {
  it("detects structural and inline markup", () => {
    expect(looksLikeMarkdown("# heading")).toBe(true);
    expect(looksLikeMarkdown("- item")).toBe(true);
    expect(looksLikeMarkdown("text with `code`")).toBe(true);
    expect(looksLikeMarkdown("a [link](url)")).toBe(true);
    expect(looksLikeMarkdown("```\ncode\n```")).toBe(true);
  });

  it("leaves ordinary prose to the plain renderer", () => {
    expect(looksLikeMarkdown("Just a sentence about the runtime.")).toBe(false);
  });
});

describe("normalizeAssistantMarkdown", () => {
  it("breaks inline numbered items after punctuation", () => {
    const source = normalizeAssistantMarkdown("我具备以下能力：1. 创建工件 2. 协调参与者");
    expect(source).toContain("\n1. 创建工件");
    expect(source).toContain("\n2. 协调参与者");
    expect(looksLikeMarkdown(source)).toBe(true);
    const list = expectBlock(
      parseMarkdown(source).find((block) => block.kind === "list"),
      "list",
    );
    expect(list.items).toHaveLength(2);
  });

  it("does not split a model name like GPT-4. then", () => {
    expect(normalizeAssistantMarkdown("Use GPT-4. then retry.")).toBe("Use GPT-4. then retry.");
  });
});
