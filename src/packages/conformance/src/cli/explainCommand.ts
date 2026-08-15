import { createCliConformanceEngine } from "./cliStores.js";
import type { VerificationDecision } from "../foundation/verificationDecision.js";
import type { CliResult } from "./exitCodes.js";
import { parseArgs, readJsonFile, requireFlag } from "./cliArgs.js";

export function explainCommand(argv: readonly string[]): CliResult {
  const { flags } = parseArgs(argv);
  const decisionPath = requireFlag(flags, "decision");
  if ("kind" in decisionPath) {
    return decisionPath;
  }

  const decisionJson = readJsonFile(decisionPath.value);
  if ("kind" in decisionJson) {
    return decisionJson;
  }

  const engine = createCliConformanceEngine(flags);
  const explanation = engine.explainDecision(decisionJson.value as VerificationDecision);
  return { kind: "ok", output: explanation };
}

export function explainUsage(): string {
  return "explain --decision <path> [--store-dir <path>]";
}
