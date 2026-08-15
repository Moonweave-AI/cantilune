import { createCliConformanceEngine } from "./cliStores.js";
import type { ConformanceTargetManifest } from "../manifest/conformanceTargetManifest.js";
import type { CliResult } from "./exitCodes.js";
import { parseArgs, readJsonFile, requireFlag } from "./cliArgs.js";

export function inspectCommand(argv: readonly string[]): CliResult {
  const { flags } = parseArgs(argv);
  const manifestPath = requireFlag(flags, "manifest");
  if ("kind" in manifestPath) {
    return manifestPath;
  }
  const parsed = readJsonFile(manifestPath.value);
  if ("kind" in parsed) {
    return parsed;
  }
  const engine = createCliConformanceEngine(flags);
  const result = engine.inspectCandidate(parsed.value as ConformanceTargetManifest);
  if (!result.ok) {
    return { kind: "violations", violations: result.error };
  }
  return { kind: "ok", output: JSON.stringify(result.value, null, 2) };
}

export function inspectUsage(): string {
  return "inspect --manifest <path> [--store-dir <path>]";
}
