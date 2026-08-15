import { parseLeanAttestationFixture } from "../adapters/lean/leanAttestationFixture.js";
import { computeLeanBuildAttestationDigest } from "../evidence/leanBuildAttestation.js";
import { verifyLeanBuildAttestation } from "../verifier/leanAttestationVerifier.js";
import { conformanceViolation } from "../foundation/conformanceViolation.js";
import { createMemoryCryptoVerifier, createMemoryTrustStore } from "../adapters/memory/index.js";
import type { CliResult } from "./exitCodes.js";
import { parseArgs, readJsonFile, requireFlag } from "./cliArgs.js";

export async function verifyLeanAttestationCommand(argv: readonly string[]): Promise<CliResult> {
  const { flags } = parseArgs(argv);
  const attestationPath = requireFlag(flags, "attestation");
  if ("kind" in attestationPath) {
    return attestationPath;
  }

  const attestationJson = readJsonFile(attestationPath.value);
  if ("kind" in attestationJson) {
    return attestationJson;
  }

  const attestation = parseLeanAttestationFixture(attestationJson.value as Record<string, unknown>);
  if (attestation === undefined) {
    return {
      kind: "violations",
      violations: [conformanceViolation("missing_evidence", "invalid lean attestation fixture")],
    };
  }

  const proofManifestRef =
    typeof flags.get("proof-manifest-ref") === "string"
      ? (flags.get("proof-manifest-ref") as string)
      : `proof-manifest/${attestation.proofManifestDigest as string}`;

  const payloadDigest =
    typeof flags.get("payload-digest") === "string"
      ? (flags.get("payload-digest") as string)
      : (computeLeanBuildAttestationDigest(attestation) as string);

  const trustStore = createMemoryTrustStore("trust/cli-lean");
  const result = await verifyLeanBuildAttestation({
    attestation,
    proofManifestRef,
    payloadDigest,
    trustStore,
    crypto: createMemoryCryptoVerifier(),
  });
  if (!result.ok) {
    return { kind: "violations", violations: result.error };
  }
  return {
    kind: "ok",
    output: JSON.stringify(
      {
        attestationDigest: result.value.attestationDigest,
        verified: result.value.verified,
      },
      null,
      2,
    ),
  };
}

export function verifyLeanAttestationUsage(): string {
  return "verify-lean-attestation --attestation <path> [--proof-manifest-ref <ref>] [--payload-digest <digest>]";
}
