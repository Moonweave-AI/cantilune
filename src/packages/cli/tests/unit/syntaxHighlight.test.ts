/**
 * Syntax highlighter tests.
 *
 * The lexer's contract is that it never loses or reorders source text: joining
 * a line's tokens must reproduce the line exactly, whatever it classified. That
 * property is asserted for every language, because a highlighter that silently
 * drops a character corrupts the code an agent asked a human to read.
 */
import { describe, it, expect } from "vitest";
import {
  highlightLine,
  resolveLanguage,
  supportedLanguages,
  type Token,
  type TokenKind,
} from "../../src/render/syntaxHighlight.js";

function join(tokens: readonly Token[]): string {
  return tokens.map((t) => t.value).join("");
}

function kindsOf(tokens: readonly Token[], kind: TokenKind): readonly string[] {
  return tokens.filter((t) => t.kind === kind).map((t) => t.value);
}

describe("language resolution", () => {
  it("resolves canonical names and aliases", () => {
    expect(resolveLanguage("typescript")).toBe("typescript");
    expect(resolveLanguage("ts")).toBe("typescript");
    expect(resolveLanguage("TS")).toBe("typescript");
    expect(resolveLanguage("py")).toBe("python");
    expect(resolveLanguage("bash")).toBe("shell");
    expect(resolveLanguage("yml")).toBe("yaml");
    expect(resolveLanguage("cpp")).toBe("c");
  });

  it("returns undefined for an unknown or absent tag", () => {
    expect(resolveLanguage(undefined)).toBeUndefined();
    expect(resolveLanguage("brainfuck")).toBeUndefined();
  });

  it("covers the languages an assistant commonly emits", () => {
    const supported = supportedLanguages();
    for (const language of ["typescript", "python", "go", "rust", "shell", "json", "sql"]) {
      expect(supported).toContain(language);
    }
  });
});

describe("lossless tokenization", () => {
  const samples: readonly (readonly [string, string])[] = [
    ["typescript", `export const x: Record<string, number> = { a: 1 }; // note`],
    ["python", `def run(self, n: int = 0) -> str:  # comment`],
    ["go", 'func main() { fmt.Println("hi") }'],
    ["rust", "let v: Vec<u8> = vec![1, 2]; /* block */"],
    ["shell", `pnpm --filter '@scope/pkg' build # run it`],
    ["json", '{"key": [1, 2.5, true, null]}'],
    ["sql", "SELECT id FROM users WHERE name = 'x' -- trailing"],
    ["yaml", "key: value # comment"],
    ["java", "public static void main(String[] args) {}"],
    ["c", "#include <stdio.h>\tint main(void) { return 0; }"],
    ["css", ".cls { color: #fff; /* c */ }"],
  ];

  for (const [language, line] of samples) {
    it(`reproduces the source exactly for ${language}`, () => {
      expect(join(highlightLine(line, language))).toBe(line);
    });
  }

  it("reproduces a line with no language as one plain token", () => {
    expect(highlightLine("anything at all", undefined)).toEqual([
      { kind: "plain", value: "anything at all" },
    ]);
  });

  it("emits nothing for an empty unhighlighted line", () => {
    expect(highlightLine("", undefined)).toEqual([]);
  });

  it("reproduces a line whose language is unsupported", () => {
    expect(join(highlightLine("weird ++ syntax", "brainfuck"))).toBe("weird ++ syntax");
  });
});

describe("token classification", () => {
  it("classifies keywords, strings, numbers, and comments", () => {
    const tokens = highlightLine("const n = 42; // why", "typescript");
    expect(kindsOf(tokens, "keyword")).toContain("const");
    expect(kindsOf(tokens, "number")).toContain("42");
    expect(kindsOf(tokens, "comment")).toContain("// why");
  });

  it("treats a quoted run as one string token, honouring escapes", () => {
    const tokens = highlightLine('const s = "a \\" b";', "typescript");
    expect(kindsOf(tokens, "string")).toEqual(['"a \\" b"']);
  });

  it("does not read markup inside a string as code", () => {
    const tokens = highlightLine('x = "const if while"', "python");
    expect(kindsOf(tokens, "keyword")).not.toContain("const");
  });

  it("classifies a call site as a function", () => {
    const tokens = highlightLine("doThing(1)", "typescript");
    expect(kindsOf(tokens, "function")).toContain("doThing");
  });

  it("does not classify a call site where the language has none", () => {
    const tokens = highlightLine('{"doThing": 1}', "json");
    expect(kindsOf(tokens, "function")).toHaveLength(0);
  });

  it("classifies a capitalized identifier as a type", () => {
    expect(kindsOf(highlightLine("let a: Widget", "typescript"), "type")).toContain("Widget");
  });

  it("does not read a digit inside an identifier as a number", () => {
    const tokens = highlightLine("let sha256 = 1", "typescript");
    expect(kindsOf(tokens, "number")).toEqual(["1"]);
  });

  it("handles hex, binary, exponent, and bigint literals", () => {
    for (const literal of ["0xFF", "0b1010", "1e10", "1_000", "9n"]) {
      const tokens = highlightLine(`x = ${literal}`, "typescript");
      expect(kindsOf(tokens, "number")).toEqual([literal]);
    }
  });

  it("treats an unterminated block comment as running to end of line", () => {
    const tokens = highlightLine("code /* open", "typescript");
    expect(kindsOf(tokens, "comment")).toEqual(["/* open"]);
  });

  it("treats an unterminated string as running to end of line", () => {
    const tokens = highlightLine('const s = "open', "typescript");
    expect(kindsOf(tokens, "string")).toEqual(['"open']);
  });
});

describe("diff highlighting", () => {
  it("colours added, removed, and hunk-header lines whole", () => {
    expect(highlightLine("+added", "diff")).toEqual([{ kind: "added", value: "+added" }]);
    expect(highlightLine("-removed", "diff")).toEqual([{ kind: "removed", value: "-removed" }]);
    expect(highlightLine("@@ -1 +1 @@", "diff")).toEqual([{ kind: "meta", value: "@@ -1 +1 @@" }]);
    expect(highlightLine("+++ b/file", "patch")).toEqual([{ kind: "meta", value: "+++ b/file" }]);
    expect(highlightLine(" context", "diff")).toEqual([{ kind: "plain", value: " context" }]);
  });
});
