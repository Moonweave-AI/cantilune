import type { ToolCallDisplay } from "../store.js";

export type ToolFamily =
  "done" | "shell" | "search" | "fetch" | "read" | "write" | "list" | "edit" | "mcp" | "generic";

export interface ToolField {
  readonly label: string;
  readonly value: string;
}

export interface ToolCardModel {
  readonly family: ToolFamily;
  readonly title: string;
  readonly headline: string;
  readonly fields: readonly ToolField[];
  readonly body: string;
  readonly compact: boolean;
}

const OUTPUT_KEYS = ["stdout", "output", "content", "text", "body", "result", "summary"] as const;

/** Classify a tool name into the family that drives layout. */
export function toolFamily(name: string): ToolFamily {
  const n = name.toLowerCase();
  if (n === "done") return "done";
  if (n.includes("shell") || n.includes("run_command")) return "shell";
  if (n.includes("web_search") || n.endsWith("_search") || n === "search") return "search";
  if (n.includes("web_fetch") || n.includes("fetch")) return "fetch";
  if (n.includes("read_file") || n.includes("read_content") || n.includes("readfile"))
    return "read";
  if (n.includes("write_file") || n.includes("write_content") || n.includes("writefile")) {
    return "write";
  }
  if (n.includes("list_dir") || n.includes("list_directory") || n.includes("listdir"))
    return "list";
  if (n.includes("edit_file") || n.includes("search_file") || n.includes("search_content")) {
    return "edit";
  }
  if (n.startsWith("mcp") || n.includes("mcp_")) return "mcp";
  return "generic";
}

/** Short chrome title; the raw tool id stays available as a field when useful. */
export function toolTitle(name: string, family: ToolFamily = toolFamily(name)): string {
  switch (family) {
    case "done":
      return "Done";
    case "shell":
      return "Shell";
    case "search":
      return "Search";
    case "fetch":
      return "Fetch";
    case "read":
      return "Read";
    case "write":
      return "Write";
    case "list":
      return "List";
    case "edit":
      return "Edit";
    case "mcp":
      return "MCP";
    default:
      return name;
  }
}

/** Render a tool argument without dumping nested JSON as one blob. */
export function formatArgValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) {
    return value
      .map((entry) => formatArgValue(entry))
      .filter((entry) => entry.length > 0)
      .join(", ");
  }
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, entry]) => {
        const rendered = formatArgValue(entry);
        return rendered.length > 0 ? `${humanizeName(key)}: ${rendered}` : "";
      })
      .filter((entry) => entry.length > 0)
      .join(" · ");
  }
  return "";
}

/**
 * Turn a tool output string into readable prose.
 *
 * Models and adapters often wrap a useful payload in a JSON object
 * (`{stdout}`, `{content}`, `{results}`). Unwrap those instead of printing
 * the braces.
 */
export function humanizeToolOutput(output: string): string {
  const trimmed = output.trim();
  if (trimmed.length === 0) return "";
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      return flattenJsonOutput(JSON.parse(trimmed));
    } catch {
      return output;
    }
  }
  return output;
}

export function firstNonEmptyLine(text: string, budget: number): string {
  const line = text.split(/\r?\n/).find((entry) => entry.trim().length > 0) ?? "";
  if (line.length <= budget) return line;
  return line.slice(0, Math.max(0, budget));
}

/** Build the presentational model for one tool card. */
export function describeToolCard(tool: ToolCallDisplay): ToolCardModel {
  const family = toolFamily(tool.name);
  const title = toolTitle(tool.name, family);
  const output = tool.result?.output !== undefined ? humanizeToolOutput(tool.result.output) : "";

  switch (family) {
    case "done":
      return {
        family,
        title,
        headline: stringArg(tool.args, "summary") || output,
        fields: [],
        body: "",
        compact: true,
      };
    case "shell":
      return {
        family,
        title,
        headline: stringArg(tool.args, "command"),
        fields: optionalFields(tool.args, ["cwd"]),
        body: output,
        compact: false,
      };
    case "search":
      return {
        family,
        title,
        headline: stringArg(tool.args, "query") || stringArg(tool.args, "text"),
        fields: optionalFields(tool.args, ["maxResults"]),
        body: output,
        compact: false,
      };
    case "fetch":
      return {
        family,
        title,
        headline: stringArg(tool.args, "url"),
        fields: [],
        body: output,
        compact: false,
      };
    case "read":
    case "write":
    case "list":
    case "edit":
      return {
        family,
        title,
        headline:
          stringArg(tool.args, "path") ||
          stringArg(tool.args, "ref") ||
          stringArg(tool.args, "target"),
        fields: optionalFields(tool.args, ["oldString", "newString", "pattern", "glob"]),
        body: output || stringArg(tool.args, "content"),
        compact: false,
      };
    default:
      return {
        family,
        title,
        headline: "",
        fields: genericFields(tool.args),
        body: output,
        compact: output.length === 0 && Object.keys(tool.args).length <= 2,
      };
  }
}

function humanizeName(name: string): string {
  return name
    .replace(/^(tool:|filesystem_|shell_|web_)/, "")
    .replace(/[_-]+/g, " ")
    .trim();
}

function stringArg(args: Record<string, unknown>, key: string): string {
  const value = args[key];
  return typeof value === "string" ? value : "";
}

function optionalFields(args: Record<string, unknown>, keys: readonly string[]): ToolField[] {
  const fields: ToolField[] = [];
  for (const key of keys) {
    const value = formatArgValue(args[key]);
    if (value.length > 0) fields.push({ label: humanizeName(key), value });
  }
  return fields;
}

function genericFields(args: Record<string, unknown>): ToolField[] {
  const fields: ToolField[] = [];
  for (const [key, raw] of Object.entries(args)) {
    const value = formatArgValue(raw);
    if (value.length > 0) fields.push({ label: humanizeName(key), value });
  }
  return fields;
}

function flattenJsonOutput(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) {
    return value
      .map((entry, index) => formatJsonItem(entry, index))
      .filter((entry) => entry.length > 0)
      .join("\n\n");
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of OUTPUT_KEYS) {
      const inner = record[key];
      if (typeof inner === "string" && inner.trim().length > 0) return inner;
    }
    if (Array.isArray(record.results)) return flattenJsonOutput(record.results);
    if (Array.isArray(record.items)) return flattenJsonOutput(record.items);
    return Object.entries(record)
      .map(([key, entry]) => {
        const rendered = flattenJsonOutput(entry);
        return rendered.length > 0 ? `${humanizeName(key)}\n${rendered}` : "";
      })
      .filter((entry) => entry.length > 0)
      .join("\n\n");
  }
  return "";
}

function formatJsonItem(value: unknown, index: number): string {
  if (typeof value === "string") return `${index + 1}. ${value}`;
  if (value === null || typeof value !== "object") return formatArgValue(value);
  const record = value as Record<string, unknown>;
  const title =
    pickString(record, ["title", "name", "heading"]) ||
    pickString(record, ["url", "path", "ref"]) ||
    `Result ${index + 1}`;
  const url = pickString(record, ["url", "link", "href"]);
  const snippet = pickString(record, ["snippet", "description", "content", "text"]);
  const lines = [`${index + 1}. ${title}`];
  if (url.length > 0 && url !== title) lines.push(`   ${url}`);
  if (snippet.length > 0) lines.push(`   ${snippet}`);
  return lines.join("\n");
}

function pickString(record: Record<string, unknown>, keys: readonly string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) return value;
  }
  return "";
}
