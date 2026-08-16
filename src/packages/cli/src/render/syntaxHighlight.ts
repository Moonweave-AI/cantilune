/**
 * Dependency-free syntax highlighter for fenced code blocks.
 *
 * A code block an agent writes is usually the most information-dense part of a
 * reply, and an unhighlighted one is the hardest part to read. A full grammar
 * engine would be the wrong trade here: it would pull a large dependency into
 * an OS runtime closure to colour a few dozen lines in a terminal.
 *
 * So this is a lexer, not a parser. It recognises the token classes that carry
 * almost all of the readability benefit — comments, strings, numbers, keywords,
 * types, and call sites — from a per-language table. Anything it cannot
 * classify stays plain, which is always a legible outcome.
 *
 * Token colours are mapped onto the theme's existing semantic roles rather than
 * new palette entries, so the monochrome and 16-colour themes degrade with no
 * extra work.
 */

/** Semantic class of a highlighted token; the view maps these onto theme roles. */
export type TokenKind =
  | "plain"
  | "comment"
  | "string"
  | "number"
  | "keyword"
  | "type"
  | "function"
  | "punctuation"
  /** A `+`/`-` line in a diff, coloured whole-line. */
  | "added"
  | "removed"
  | "meta";

export interface Token {
  readonly kind: TokenKind;
  readonly value: string;
}

interface LanguageSpec {
  readonly keywords: ReadonlySet<string>;
  readonly types: ReadonlySet<string>;
  readonly lineComment?: readonly string[];
  readonly blockComment?: readonly [string, string];
  readonly quotes: readonly string[];
  /** Whether an identifier followed by `(` is coloured as a call site. */
  readonly callSites: boolean;
}

const words = (source: string): ReadonlySet<string> => new Set(source.split(/\s+/).filter(Boolean));

const JS_KEYWORDS = words(`
  abstract as async await break case catch class const continue debugger declare default delete do
  else enum export extends finally for from function get if implements import in infer instanceof
  interface is keyof let new of package private protected public readonly return satisfies set
  static super switch this throw try type typeof var void while with yield
`);
const JS_TYPES = words(`
  any bigint boolean never null number object string symbol undefined unknown Array Promise Record
  Map Set Date RegExp Error true false
`);

const PY_KEYWORDS = words(`
  and as assert async await break class continue def del elif else except finally for from global
  if import in is lambda nonlocal not or pass raise return try while with yield match case
`);
const PY_TYPES = words(`
  bool bytes dict float int list None object set str tuple True False self cls Any Optional Union
`);

const GO_KEYWORDS = words(`
  break case chan const continue default defer else fallthrough for func go goto if import
  interface map package range return select struct switch type var
`);
const GO_TYPES = words(`
  bool byte complex64 complex128 error float32 float64 int int8 int16 int32 int64 rune string uint
  uint8 uint16 uint32 uint64 uintptr any nil true false
`);

const RUST_KEYWORDS = words(`
  as async await break const continue crate dyn else enum extern fn for if impl in let loop match
  mod move mut pub ref return self Self static struct super trait type unsafe use where while
`);
const RUST_TYPES = words(`
  bool char f32 f64 i8 i16 i32 i64 i128 isize str String u8 u16 u32 u64 u128 usize Vec Option
  Result Box Some None Ok Err true false
`);

const C_KEYWORDS = words(`
  auto break case catch class const constexpr continue default delete do else enum explicit extern
  for friend goto if inline namespace new operator private protected public register return sizeof
  static struct switch template this throw try typedef typename union using virtual volatile while
`);
const C_TYPES = words(`
  bool char double float int long short signed unsigned void size_t uint8_t uint16_t uint32_t
  uint64_t int8_t int16_t int32_t int64_t std string vector map true false nullptr NULL
`);

const JAVA_KEYWORDS = words(`
  abstract assert break case catch class const continue default do else enum extends final finally
  for goto if implements import instanceof interface native new package private protected public
  return static strictfp super switch synchronized this throw throws transient try volatile while
  var record sealed permits yield
`);
const JAVA_TYPES = words(`
  boolean byte char double float int long short void String Integer Boolean Object List Map Set
  Optional true false null
`);

const SHELL_KEYWORDS = words(`
  if then else elif fi for while until do done case esac function select in return break continue
  export local readonly declare set unset source alias trap exit shift eval exec
`);
const SHELL_TYPES = words(`
  echo cd ls cat grep sed awk find git npm pnpm yarn node docker kubectl curl wget make cargo go
  python python3 pip mkdir rm cp mv chmod chown test true false
`);

const SQL_KEYWORDS = words(`
  ADD ALL ALTER AND AS ASC BETWEEN BY CASE CHECK COLUMN CONSTRAINT CREATE CROSS DEFAULT DELETE DESC
  DISTINCT DROP ELSE END EXISTS FOREIGN FROM FULL GROUP HAVING IN INDEX INNER INSERT INTO IS JOIN
  KEY LEFT LIKE LIMIT NOT NULL OFFSET ON OR ORDER OUTER PRIMARY REFERENCES RIGHT SELECT SET TABLE
  THEN UNION UNIQUE UPDATE VALUES VIEW WHEN WHERE WITH
`);
const SQL_TYPES = words(`
  BIGINT BOOLEAN CHAR DATE DECIMAL DOUBLE FLOAT INT INTEGER JSON JSONB NUMERIC REAL SERIAL SMALLINT
  TEXT TIME TIMESTAMP UUID VARCHAR
`);

const JS_SPEC: LanguageSpec = {
  keywords: JS_KEYWORDS,
  types: JS_TYPES,
  lineComment: ["//"],
  blockComment: ["/*", "*/"],
  quotes: ['"', "'", "`"],
  callSites: true,
};

const LANGUAGES: Readonly<Record<string, LanguageSpec>> = {
  typescript: JS_SPEC,
  javascript: JS_SPEC,
  tsx: JS_SPEC,
  jsx: JS_SPEC,
  json: {
    keywords: words("true false null"),
    types: new Set<string>(),
    quotes: ['"'],
    callSites: false,
  },
  python: {
    keywords: PY_KEYWORDS,
    types: PY_TYPES,
    lineComment: ["#"],
    quotes: ['"', "'"],
    callSites: true,
  },
  go: {
    keywords: GO_KEYWORDS,
    types: GO_TYPES,
    lineComment: ["//"],
    blockComment: ["/*", "*/"],
    quotes: ['"', "`"],
    callSites: true,
  },
  rust: {
    keywords: RUST_KEYWORDS,
    types: RUST_TYPES,
    lineComment: ["//"],
    blockComment: ["/*", "*/"],
    quotes: ['"'],
    callSites: true,
  },
  c: {
    keywords: C_KEYWORDS,
    types: C_TYPES,
    lineComment: ["//"],
    blockComment: ["/*", "*/"],
    quotes: ['"', "'"],
    callSites: true,
  },
  java: {
    keywords: JAVA_KEYWORDS,
    types: JAVA_TYPES,
    lineComment: ["//"],
    blockComment: ["/*", "*/"],
    quotes: ['"', "'"],
    callSites: true,
  },
  shell: {
    keywords: SHELL_KEYWORDS,
    types: SHELL_TYPES,
    lineComment: ["#"],
    quotes: ['"', "'"],
    callSites: false,
  },
  sql: {
    keywords: SQL_KEYWORDS,
    types: SQL_TYPES,
    lineComment: ["--"],
    blockComment: ["/*", "*/"],
    quotes: ["'", '"'],
    callSites: true,
  },
  yaml: {
    keywords: words("true false null yes no on off"),
    types: new Set<string>(),
    lineComment: ["#"],
    quotes: ['"', "'"],
    callSites: false,
  },
  toml: {
    keywords: words("true false"),
    types: new Set<string>(),
    lineComment: ["#"],
    quotes: ['"', "'"],
    callSites: false,
  },
  css: {
    keywords: words("important media import from to keyframes supports"),
    types: new Set<string>(),
    blockComment: ["/*", "*/"],
    quotes: ['"', "'"],
    callSites: true,
  },
};

/** Aliases an agent is likely to write on a fence. */
const ALIASES: Readonly<Record<string, string>> = {
  ts: "typescript",
  mts: "typescript",
  cts: "typescript",
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  py: "python",
  rs: "rust",
  golang: "go",
  sh: "shell",
  bash: "shell",
  zsh: "shell",
  console: "shell",
  shell_session: "shell",
  postgres: "sql",
  psql: "sql",
  yml: "yaml",
  "c++": "c",
  cpp: "c",
  h: "c",
  hpp: "c",
  kt: "java",
  scss: "css",
  jsonc: "json",
};

/** Resolve a fence tag onto a known language, or `undefined` when unsupported. */
export function resolveLanguage(tag: string | undefined): string | undefined {
  if (tag === undefined) return undefined;
  const lower = tag.toLowerCase();
  const canonical = ALIASES[lower] ?? lower;
  return canonical in LANGUAGES ? canonical : undefined;
}

/** Languages this highlighter can colour, for `/help` and tests. */
export function supportedLanguages(): readonly string[] {
  return Object.keys(LANGUAGES).sort();
}

const IDENTIFIER_START = /[A-Za-z_$]/;
const IDENTIFIER_PART = /[A-Za-z0-9_$]/;
const DIGIT = /[0-9]/;
const PUNCTUATION = /[{}()[\].,;:?!<>=+\-*/%&|^~]/;

/**
 * Tokenize one line.
 *
 * Lines are independent: a block comment or template literal spanning lines is
 * re-opened on each one. Carrying lexer state across lines would let a single
 * unbalanced quote in generated code miscolour the rest of the block, which is
 * a worse failure than losing colour on a continuation line.
 */
export function highlightLine(line: string, language: string | undefined): readonly Token[] {
  if (language === "diff" || language === "patch") return [diffToken(line)];

  const spec = language === undefined ? undefined : LANGUAGES[language];
  if (spec === undefined) return line.length === 0 ? [] : [{ kind: "plain", value: line }];

  const tokens: Token[] = [];
  let index = 0;
  let plainStart = 0;

  while (index < line.length) {
    const hit = scanToken(line, index, spec);
    if (hit === undefined) {
      index += 1;
      continue;
    }
    // A run the scanner classified as plain is merged into the surrounding
    // plain text rather than emitted, so adjacent unclassified characters stay
    // one token instead of fragmenting the line.
    if (hit.kind === "plain") {
      index += hit.length;
      continue;
    }
    if (index > plainStart) {
      tokens.push({ kind: "plain", value: line.slice(plainStart, index) });
    }
    tokens.push({ kind: hit.kind, value: line.slice(index, index + hit.length) });
    index += hit.length;
    plainStart = index;
  }

  if (line.length > plainStart) {
    tokens.push({ kind: "plain", value: line.slice(plainStart) });
  }
  return tokens;
}

/** A classified run starting at `index`, or `undefined` when nothing matches. */
interface Scan {
  readonly kind: TokenKind;
  readonly length: number;
}

/**
 * Classify the run starting at `index`.
 *
 * The scanners are ordered by precedence: comment and string content is
 * literal, so those must win before a keyword or number inside them can be
 * seen.
 */
function scanToken(line: string, index: number, spec: LanguageSpec): Scan | undefined {
  const rest = line.slice(index);

  if (lineCommentLength(rest, spec) > 0) return { kind: "comment", length: rest.length };

  const blockLength = blockCommentLength(rest, spec);
  if (blockLength > 0) return { kind: "comment", length: blockLength };

  const char = line[index]!;

  if (spec.quotes.includes(char)) {
    return { kind: "string", length: stringLength(rest, char) };
  }
  // A digit directly after an identifier character belongs to that identifier
  // (`sha256`), not to a numeric literal.
  if (DIGIT.test(char) && !isIdentifierChar(line[index - 1])) {
    return { kind: "number", length: numberLength(rest) };
  }
  if (IDENTIFIER_START.test(char)) {
    const length = identifierLength(rest);
    return { kind: classifyWord(rest.slice(0, length), rest.slice(length), spec), length };
  }
  if (PUNCTUATION.test(char)) {
    return { kind: "punctuation", length: 1 };
  }
  return undefined;
}

/** Colour a whole diff line by its leading marker. */
function diffToken(line: string): Token {
  if (line.startsWith("+++") || line.startsWith("---") || line.startsWith("@@")) {
    return { kind: "meta", value: line };
  }
  if (line.startsWith("+")) return { kind: "added", value: line };
  if (line.startsWith("-")) return { kind: "removed", value: line };
  return { kind: "plain", value: line };
}

function isIdentifierChar(char: string | undefined): boolean {
  return char !== undefined && IDENTIFIER_PART.test(char);
}

function lineCommentLength(rest: string, spec: LanguageSpec): number {
  for (const marker of spec.lineComment ?? []) {
    if (rest.startsWith(marker)) return rest.length;
  }
  return 0;
}

function blockCommentLength(rest: string, spec: LanguageSpec): number {
  const block = spec.blockComment;
  if (block === undefined || !rest.startsWith(block[0])) return 0;
  const close = rest.indexOf(block[1], block[0].length);
  // An unterminated block comment runs to end of line; it re-opens next line.
  return close === -1 ? rest.length : close + block[1].length;
}

/** Length of a quoted run, honouring backslash escapes. */
function stringLength(rest: string, quote: string): number {
  let index = 1;
  while (index < rest.length) {
    const char = rest[index]!;
    if (char === "\\") {
      index += 2;
      continue;
    }
    index += 1;
    if (char === quote) return index;
  }
  return rest.length;
}

function numberLength(rest: string): number {
  const match = /^(0[xXbBoO][0-9a-fA-F_]+|\d[\d_]*(\.\d[\d_]*)?([eE][+-]?\d+)?)n?/.exec(rest);
  return match === null ? 1 : match[0].length;
}

function identifierLength(rest: string): number {
  let index = 1;
  while (index < rest.length && IDENTIFIER_PART.test(rest[index]!)) index += 1;
  return index;
}

function classifyWord(word: string, after: string, spec: LanguageSpec): TokenKind {
  if (spec.keywords.has(word)) return "keyword";
  if (spec.types.has(word)) return "type";
  // A leading capital is a strong type signal in every language here that has
  // a naming convention at all, and harmless where it does not.
  if (/^[A-Z][A-Za-z0-9_]*$/.test(word) && word.length > 1) return "type";
  if (spec.callSites && after.startsWith("(")) return "function";
  return "plain";
}
