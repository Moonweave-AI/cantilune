import {
  conformanceViolation,
  type ConformanceViolation,
} from "../foundation/conformanceViolation.js";
import { isSha256HexDigest } from "../canonical/evidenceDigest.js";

const OBLIGATION_STATUSES = new Set([
  "missing",
  "partial_scaffold",
  "implemented_unverified",
  "proved",
  "reviewed",
]);

export interface ProofObligationEntry {
  readonly id: string;
  readonly theorem: string;
  readonly status: string;
  readonly leanSymbol: string;
  readonly verifiedCommit: string;
  readonly buildEvidence: string;
  readonly buildEvidenceSha256: string;
}

export interface ProofObligationsManifest {
  readonly schemaVersion: number;
  readonly requiredGate: string;
  readonly obligations: readonly ProofObligationEntry[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(
  record: Record<string, unknown>,
  key: string,
  path: string,
  violations: ConformanceViolation[],
): string | undefined {
  const value = record[key];
  if (typeof value !== "string" || value.length === 0) {
    violations.push(
      conformanceViolation(
        "proof_manifest_invalid",
        `${path}.${key} must be a non-empty string`,
        path,
      ),
    );
    return undefined;
  }
  return value;
}

function validateObligationEntry(
  entry: unknown,
  index: number,
  violations: ConformanceViolation[],
  seenIds: Set<string>,
): void {
  const path = `obligations[${index}]`;
  if (!isRecord(entry)) {
    violations.push(
      conformanceViolation("proof_manifest_invalid", "obligation entry must be an object", path),
    );
    return;
  }
  const id = requireString(entry, "id", path, violations);
  if (id !== undefined) {
    if (seenIds.has(id)) {
      violations.push(
        conformanceViolation("proof_manifest_invalid", `duplicate obligation id ${id}`, path),
      );
    }
    seenIds.add(id);
  }
  requireString(entry, "theorem", path, violations);
  const status = requireString(entry, "status", path, violations);
  if (status !== undefined && !OBLIGATION_STATUSES.has(status)) {
    violations.push(
      conformanceViolation(
        "proof_manifest_invalid",
        `unknown obligation status ${status}`,
        `${path}.status`,
      ),
    );
  }
  requireString(entry, "leanSymbol", path, violations);
  const verifiedCommit = requireString(entry, "verifiedCommit", path, violations);
  if (verifiedCommit !== undefined && !/^[a-f0-9]{40}$/.test(verifiedCommit)) {
    violations.push(
      conformanceViolation(
        "proof_manifest_invalid",
        "verifiedCommit must be git sha hex",
        `${path}.verifiedCommit`,
      ),
    );
  }
  requireString(entry, "buildEvidence", path, violations);
  const buildEvidenceSha256 = requireString(entry, "buildEvidenceSha256", path, violations);
  if (buildEvidenceSha256 !== undefined && !isSha256HexDigest(buildEvidenceSha256)) {
    violations.push(
      conformanceViolation(
        "proof_manifest_invalid",
        "buildEvidenceSha256 must be sha256 hex",
        `${path}.buildEvidenceSha256`,
      ),
    );
  }
}

export function validateProofObligationsManifest(value: unknown): ConformanceViolation[] {
  const violations: ConformanceViolation[] = [];
  if (!isRecord(value)) {
    violations.push(
      conformanceViolation("proof_manifest_invalid", "proof obligations root must be an object"),
    );
    return violations;
  }

  if (typeof value.schemaVersion !== "number" || value.schemaVersion < 1) {
    violations.push(
      conformanceViolation(
        "proof_manifest_invalid",
        "schemaVersion must be a positive number",
        "schemaVersion",
      ),
    );
  }
  requireString(value, "requiredGate", "root", violations);

  if (!Array.isArray(value.obligations)) {
    violations.push(
      conformanceViolation("proof_manifest_invalid", "obligations must be an array", "obligations"),
    );
    return violations;
  }

  const seenIds = new Set<string>();
  for (let index = 0; index < value.obligations.length; index += 1) {
    validateObligationEntry(value.obligations[index], index, violations, seenIds);
  }

  return violations;
}

export function parseProofObligationsManifest(
  value: unknown,
): ProofObligationsManifest | undefined {
  const violations = validateProofObligationsManifest(value);
  if (violations.length > 0 || !isRecord(value) || !Array.isArray(value.obligations)) {
    return undefined;
  }
  return {
    schemaVersion: value.schemaVersion as number,
    requiredGate: value.requiredGate as string,
    obligations: value.obligations as ProofObligationEntry[],
  };
}
