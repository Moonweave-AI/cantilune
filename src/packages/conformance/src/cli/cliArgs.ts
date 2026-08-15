import { readFileSync } from "node:fs";
import type { CliResult } from "./exitCodes.js";

export interface ParsedArgs {
  readonly command: string;
  readonly flags: ReadonlyMap<string, string | true>;
  readonly positional: readonly string[];
}

export function parseArgs(argv: readonly string[]): ParsedArgs {
  const flags = new Map<string, string | true>();
  const positional: string[] = [];
  let index = 0;
  while (index < argv.length) {
    const token = argv[index]!;
    if (token.startsWith("--")) {
      const key = token.slice(2);
      const next = argv[index + 1];
      if (next !== undefined && !next.startsWith("--")) {
        flags.set(key, next);
        index += 2;
      } else {
        flags.set(key, true);
        index += 1;
      }
      continue;
    }
    positional.push(token);
    index += 1;
  }
  const command = positional[0] ?? "";
  return { command, flags, positional: positional.slice(1) };
}

export function requireFlag(
  flags: ReadonlyMap<string, string | true>,
  name: string,
): CliResult | { readonly value: string } {
  const value = flags.get(name);
  if (value === undefined || value === true) {
    return { kind: "usage", message: `missing required flag --${name}` };
  }
  return { value };
}

export function optionalStoreDir(flags: ReadonlyMap<string, string | true>): string | undefined {
  const value = flags.get("store-dir");
  if (value === undefined || value === true) {
    return undefined;
  }
  return value;
}

export function readJsonFile(path: string): CliResult | { readonly value: unknown } {
  try {
    const raw = readFileSync(path, "utf8");
    return { value: JSON.parse(raw) as unknown };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { kind: "tool_failure", message: `failed to read JSON at ${path}: ${message}` };
  }
}
