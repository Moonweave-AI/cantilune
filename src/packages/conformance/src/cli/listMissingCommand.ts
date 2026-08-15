import { createCliConformanceEngine } from "./cliStores.js";
import type { RuleInventory } from "../manifest/ruleInventory.js";
import type { CliResult } from "./exitCodes.js";
import { parseArgs, readJsonFile, requireFlag } from "./cliArgs.js";

function parseObservedRuleIds(value: unknown): CliResult | { readonly value: readonly string[] } {
  if (!Array.isArray(value) || !value.every((entry) => typeof entry === "string")) {
    return { kind: "usage", message: "--observed must be a JSON array of rule id strings" };
  }
  return { value };
}

export function listMissingCommand(argv: readonly string[]): CliResult {
  const { flags } = parseArgs(argv);
  const inventoryPath = requireFlag(flags, "inventory");
  if ("kind" in inventoryPath) {
    return inventoryPath;
  }
  const observedPath = requireFlag(flags, "observed");
  if ("kind" in observedPath) {
    return observedPath;
  }

  const inventoryJson = readJsonFile(inventoryPath.value);
  if ("kind" in inventoryJson) {
    return inventoryJson;
  }
  const observedJson = readJsonFile(observedPath.value);
  if ("kind" in observedJson) {
    return observedJson;
  }
  const observed = parseObservedRuleIds(observedJson.value);
  if ("kind" in observed) {
    return observed;
  }

  const engine = createCliConformanceEngine(flags);
  const missing = engine.listMissingEvidence({
    inventory: inventoryJson.value as RuleInventory,
    observedRuleIds: observed.value,
  });
  return { kind: "ok", output: JSON.stringify(missing, null, 2) };
}

export function listMissingUsage(): string {
  return "list-missing --inventory <path> --observed <path> [--store-dir <path>]";
}
