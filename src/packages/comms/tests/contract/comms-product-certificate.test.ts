import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { contentDigest } from "@cantilune/core";
import { canonicalJsonBytes } from "../../src/conformance/canonicalJson.js";
import {
  verifyCommsProductCertificate,
  type CommsProductCertificate,
} from "../../src/conformance/commsProductCertificate.js";

function digest(value: unknown): string {
  return createHash("sha256").update(canonicalJsonBytes(value)).digest("hex");
}

describe("comms product certificate", () => {
  it("accepts complete comms product instance certificate with computed digest", () => {
    const subject = {
      packageName: "@cantilune/comms" as const,
      packageVersion: "0.0.1",
      registryVersion: 1,
      wireVersion: 1,
      a2aProfile: "a2a/0.1",
      occurrenceCount: 1,
      reconnectEvidenceDigest: contentDigest(digest("reconnect")),
      messagingSagaDigest: contentDigest(digest("saga")),
      fileStoreDigest: contentDigest(digest("file")),
    };
    const proofManifestRef = "proof://comms/m4-evidence";
    const verifierBuild = "comms-conformance/0.0.1";
    const certificate: CommsProductCertificate = {
      subject,
      claimScope: "reference",
      verifierBuild,
      evidenceDigest: contentDigest(
        digest({
          profile: "canonicalProtocol",
          claimScope: "reference",
          subject,
          proofManifestRef,
          verifierBuild,
        }),
      ),
      proofManifestRef,
    };
    expect(verifyCommsProductCertificate(certificate)).toBe(true);
  });

  it("rejects hand-filled non-hex digests", () => {
    const certificate: CommsProductCertificate = {
      subject: {
        packageName: "@cantilune/comms",
        packageVersion: "0.0.1",
        registryVersion: 1,
        wireVersion: 1,
        a2aProfile: "a2a/0.1",
        occurrenceCount: 1,
        reconnectEvidenceDigest: "reconnect-digest" as never,
        messagingSagaDigest: "saga-digest" as never,
        fileStoreDigest: "file-digest" as never,
      },
      claimScope: "reference",
      verifierBuild: "comms-conformance/0.0.1",
      evidenceDigest: "cert-digest" as never,
      proofManifestRef: "proof-manifest/comms",
    };
    expect(verifyCommsProductCertificate(certificate)).toBe(false);
  });
});
