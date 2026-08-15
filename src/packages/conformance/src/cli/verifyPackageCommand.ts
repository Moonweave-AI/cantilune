import { createCliVerificationContext } from "./cliStores.js";
import { canonicalJsonBytes } from "../canonical/canonicalEncoding.js";
import type { ConformanceTargetManifest } from "../manifest/conformanceTargetManifest.js";
import type { RuleInventory } from "../manifest/ruleInventory.js";
import type { CliResult } from "./exitCodes.js";
import { parseArgs, readJsonFile, requireFlag } from "./cliArgs.js";
import { isSha256HexDigest } from "../canonical/evidenceDigest.js";

function parseObservedRuleIds(value: unknown): CliResult | { readonly value: readonly string[] } {
  if (!Array.isArray(value) || !value.every((entry) => typeof entry === "string")) {
    return { kind: "usage", message: "--observed must be a JSON array of rule id strings" };
  }
  return { value };
}

function parseArtifactDigests(value: unknown): CliResult | { readonly value: readonly string[] } {
  if (
    !Array.isArray(value) ||
    !value.every((entry) => typeof entry === "string" && isSha256HexDigest(entry))
  ) {
    return { kind: "usage", message: "--artifacts must be a JSON array of sha256 hex digests" };
  }
  return { value };
}

export async function verifyPackageCommand(argv: readonly string[]): Promise<CliResult> {
  const { flags } = parseArgs(argv);
  const manifestPath = requireFlag(flags, "manifest");
  if ("kind" in manifestPath) {
    return manifestPath;
  }
  const inventoryPath = requireFlag(flags, "inventory");
  if ("kind" in inventoryPath) {
    return inventoryPath;
  }
  const observedPath = requireFlag(flags, "observed");
  if ("kind" in observedPath) {
    return observedPath;
  }
  const artifactsPath = requireFlag(flags, "artifacts");
  if ("kind" in artifactsPath) {
    return artifactsPath;
  }

  const manifestJson = readJsonFile(manifestPath.value);
  if ("kind" in manifestJson) {
    return manifestJson;
  }
  const inventoryJson = readJsonFile(inventoryPath.value);
  if ("kind" in inventoryJson) {
    return inventoryJson;
  }
  const observedJson = readJsonFile(observedPath.value);
  if ("kind" in observedJson) {
    return observedJson;
  }
  const artifactsJson = readJsonFile(artifactsPath.value);
  if ("kind" in artifactsJson) {
    return artifactsJson;
  }
  const observed = parseObservedRuleIds(observedJson.value);
  if ("kind" in observed) {
    return observed;
  }
  const artifacts = parseArtifactDigests(artifactsJson.value);
  if ("kind" in artifacts) {
    return artifacts;
  }

  const { evidenceStore, engine } = createCliVerificationContext(flags);
  for (const digest of artifacts.value) {
    const put = await evidenceStore.put(digest, canonicalJsonBytes({ artifactDigest: digest }));
    if (!put.ok) {
      return { kind: "tool_failure", message: `failed to seed evidence artifact ${digest}` };
    }
  }

  const result = await engine.verifyPackage({
    manifest: manifestJson.value as ConformanceTargetManifest,
    inventory: inventoryJson.value as RuleInventory,
    observedRuleIds: observed.value,
    evidenceArtifactDigests: artifacts.value,
  });
  if (!result.ok) {
    return { kind: "violations", violations: result.error };
  }
  return { kind: "ok", output: JSON.stringify(result.value, null, 2) };
}

export function verifyPackageUsage(): string {
  return "verify-package --manifest <path> --inventory <path> --observed <path> --artifacts <path> [--store-dir <path>]";
}
