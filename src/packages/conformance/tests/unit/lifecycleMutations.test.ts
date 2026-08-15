import { describe, expect, it } from "vitest";
import { revokeCertificate, isRevokedState } from "../../src/lifecycle/revocation.js";
import { supersedeCertificate, isSupersededState } from "../../src/lifecycle/supersession.js";
import type { CertificateLifecycleRecord } from "../../src/lifecycle/certificateLifecycle.js";
import type { PackageConformanceCertificate } from "../../src/certificate/packageConformanceCertificate.js";
import { certificateId } from "../../src/foundation/conformanceId.js";

const issued: CertificateLifecycleRecord = {
  certificateId: "cert-001",
  state: "issued",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("certificate lifecycle mutations", () => {
  it("revokes issued certificate", () => {
    const result = revokeCertificate(issued, {
      certificateId: certificateId("cert-001"),
      reason: "policy rotation",
      checkpoint: "trust/v2",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(isRevokedState(result.value.record)).toBe(true);
    }
  });

  it("rejects revocation with certificate id mismatch", () => {
    const result = revokeCertificate(issued, {
      certificateId: certificateId("cert-other"),
      reason: "test",
      checkpoint: "trust/v2",
    });
    expect(result.ok).toBe(false);
  });

  it("supersedes issued certificate when successor references prior", () => {
    const successor = {
      certificateId: "cert-002",
      supersedes: "cert-001",
      issuedAt: "2026-02-01T00:00:00.000Z",
    } as PackageConformanceCertificate;
    const result = supersedeCertificate(issued, {
      priorCertificateId: certificateId("cert-001"),
      successor,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(isSupersededState(result.value)).toBe(true);
    }
  });
});
