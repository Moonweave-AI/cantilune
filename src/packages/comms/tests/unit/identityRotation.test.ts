import { describe, expect, it } from "vitest";
import {
  correlationId,
  epochId,
  epochOrdinal,
  idempotencyKey,
  occurrenceId,
  schemaAdmissionId,
  type SchemaAdmissionReceipt,
} from "@cantilune/core";
import { createProcessEStopGate } from "../../src/adapters/process/processEStopGate.js";
import { createFilePeerDirectory } from "../../src/adapters/file/filePeerDirectory.js";
import { createMtlsEndpointIdentityVerifier } from "../../src/security/endpointIdentityVerifier.js";
import { rotateEndpointPin } from "../../src/security/identityRotation.js";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const OLD_PIN = "aa".repeat(32);
const NEW_PIN = "bb".repeat(32);

function receipt(overrides: Partial<SchemaAdmissionReceipt> = {}): SchemaAdmissionReceipt {
  const binding = {
    activationDomainId: "default" as never,
    bindingGeneration: 1 as never,
    epochId: epochId("42"),
    epochOrdinal: epochOrdinal(1),
    schemaRef: { schemaId: "s", revisionId: "r", digest: "d" as never } as never,
    policyRef: { policyId: "p", revisionId: "1", digest: "d" as never } as never,
    handlerManifestRef: { manifestId: "m", digest: "d" as never } as never,
    runtimeHead: "snap" as never,
    admissionId: schemaAdmissionId("adm-pin"),
    activatedBy: "operator",
    activatedAt: "2026-08-11T15:00:00Z",
  };
  return {
    admissionId: schemaAdmissionId("adm-pin"),
    activationDomainId: "default" as never,
    fromBinding: binding,
    toBinding: binding,
    beforeSnapshotRef: "snap-0" as never,
    afterSnapshotRef: "snap-1" as never,
    extensionPlanRef: "plan",
    admissionTombstoneId: "tomb" as never,
    committedBy: "operator",
    committedAt: "2026-08-11T15:00:00Z",
    storeSequence: 1 as never,
    correlationId: correlationId("corr-pin"),
    occurrenceId: occurrenceId("occ-pin"),
    idempotencyKey: idempotencyKey("idem-pin"),
    planDigest: "pd" as never,
    authorizationEvidenceRef: "auth-pin",
    ...overrides,
  };
}

describe("rotateEndpointPin", () => {
  it("rejects a missing receipt and freezes E-Stop", async () => {
    const dir = mkdtempSync(join(tmpdir(), "cantilune-pin-miss-"));
    try {
      const directory = createFilePeerDirectory(dir);
      const eStop = createProcessEStopGate();
      const result = await rotateEndpointPin({
        peerRef: "peer-a",
        oldFingerprint: OLD_PIN,
        newFingerprint: NEW_PIN,
        admissionReceiptRef: "missing",
        directory,
        eStop,
        resolveReceipt: async () => undefined,
      });
      expect(result.ok).toBe(false);
      expect(eStop.isFrozen()).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects an unusable receipt and a resolver throw", async () => {
    const dir = mkdtempSync(join(tmpdir(), "cantilune-pin-bad-"));
    try {
      const directory = createFilePeerDirectory(dir);
      const eStop = createProcessEStopGate();
      const unusable = await rotateEndpointPin({
        peerRef: "peer-a",
        oldFingerprint: OLD_PIN,
        newFingerprint: NEW_PIN,
        admissionReceiptRef: "bad",
        directory,
        eStop,
        resolveReceipt: async () => receipt({ authorizationEvidenceRef: "" }),
      });
      expect(unusable.ok).toBe(false);
      expect(eStop.isFrozen()).toBe(true);

      const thrownStop = createProcessEStopGate();
      const thrown = await rotateEndpointPin({
        peerRef: "peer-a",
        oldFingerprint: OLD_PIN,
        newFingerprint: NEW_PIN,
        admissionReceiptRef: "boom",
        directory,
        eStop: thrownStop,
        resolveReceipt: async () => {
          throw new Error("resolver down");
        },
      });
      expect(thrown.ok).toBe(false);
      expect(thrownStop.isFrozen()).toBe(true);

      const emptyRef = await rotateEndpointPin({
        peerRef: "peer-a",
        oldFingerprint: OLD_PIN,
        newFingerprint: NEW_PIN,
        admissionReceiptRef: "  ",
        directory,
        eStop: createProcessEStopGate(),
        resolveReceipt: async () => receipt(),
      });
      expect(emptyRef.ok).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rotates with a valid receipt; old pin then fails closed", async () => {
    const dir = mkdtempSync(join(tmpdir(), "cantilune-pin-ok-"));
    try {
      const directory = createFilePeerDirectory(dir);
      directory.setPinnedFingerprints("peer-a", [OLD_PIN]);
      const eStop = createProcessEStopGate();
      const rotated = await rotateEndpointPin({
        peerRef: "peer-a",
        oldFingerprint: OLD_PIN,
        newFingerprint: NEW_PIN,
        admissionReceiptRef: "receipt-1",
        directory,
        eStop,
        resolveReceipt: async () => receipt(),
      });
      expect(rotated.ok).toBe(true);
      expect(eStop.isFrozen()).toBe(false);
      if (!rotated.ok) return;
      expect(rotated.value.pinnedFingerprints).toEqual([NEW_PIN]);
      expect(directory.getPinnedFingerprints("peer-a")).toEqual([NEW_PIN]);

      const verifier = createMtlsEndpointIdentityVerifier({
        eStop,
        directory,
        peerRef: "peer-a",
      });
      const oldPin = verifier.verifyPresentedIdentity({
        expectedActorRef: "peer-a",
        presentedFingerprint: OLD_PIN,
        pinnedFingerprints: [OLD_PIN],
        tlsVerified: true,
      });
      expect(oldPin.ok).toBe(false);
      expect(eStop.isFrozen()).toBe(true);

      const liveStop = createProcessEStopGate();
      const live = createMtlsEndpointIdentityVerifier({
        eStop: liveStop,
        directory,
        peerRef: "peer-a",
      });
      const next = live.verifyPresentedIdentity({
        expectedActorRef: "peer-a",
        presentedFingerprint: NEW_PIN,
        pinnedFingerprints: [OLD_PIN],
        tlsVerified: true,
      });
      expect(next.ok).toBe(true);
      expect(liveStop.isFrozen()).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects rotating a pin that is not current", async () => {
    const dir = mkdtempSync(join(tmpdir(), "cantilune-pin-stale-"));
    try {
      const directory = createFilePeerDirectory(dir);
      directory.setPinnedFingerprints("peer-a", [NEW_PIN]);
      const eStop = createProcessEStopGate();
      const result = await rotateEndpointPin({
        peerRef: "peer-a",
        oldFingerprint: OLD_PIN,
        newFingerprint: "cc".repeat(32),
        admissionReceiptRef: "receipt-1",
        directory,
        eStop,
        resolveReceipt: async () => receipt(),
      });
      expect(result.ok).toBe(false);
      expect(eStop.isFrozen()).toBe(true);
      expect(directory.getPinnedFingerprints("peer-a")).toEqual([NEW_PIN]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("pins an initial fingerprint when the directory has no current pin", async () => {
    const dir = mkdtempSync(join(tmpdir(), "cantilune-pin-first-"));
    try {
      const directory = createFilePeerDirectory(dir);
      const eStop = createProcessEStopGate();
      const result = await rotateEndpointPin({
        peerRef: "peer-a",
        oldFingerprint: OLD_PIN,
        newFingerprint: NEW_PIN,
        admissionReceiptRef: "receipt-1",
        directory,
        eStop,
        resolveReceipt: async () => receipt(),
      });
      expect(result.ok).toBe(true);
      expect(directory.getPinnedFingerprints("peer-a")).toEqual([NEW_PIN]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("treats same-pin rotation with a receipt as idempotent", async () => {
    const dir = mkdtempSync(join(tmpdir(), "cantilune-pin-same-"));
    try {
      const directory = createFilePeerDirectory(dir);
      const first = await rotateEndpointPin({
        peerRef: "peer-a",
        oldFingerprint: OLD_PIN,
        newFingerprint: OLD_PIN,
        admissionReceiptRef: "receipt-0",
        directory,
        eStop: createProcessEStopGate(),
        resolveReceipt: async () => receipt(),
      });
      expect(first.ok).toBe(true);
      expect(directory.getPinnedFingerprints("peer-a")).toEqual([OLD_PIN]);
      directory.setPinnedFingerprints("peer-a", [OLD_PIN]);
      const eStop = createProcessEStopGate();
      const result = await rotateEndpointPin({
        peerRef: "peer-a",
        oldFingerprint: OLD_PIN,
        newFingerprint: OLD_PIN,
        admissionReceiptRef: "receipt-1",
        directory,
        eStop,
        resolveReceipt: async () => receipt(),
      });
      expect(result.ok).toBe(true);
      expect(eStop.isFrozen()).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects malformed fingerprints even with a receipt", async () => {
    const dir = mkdtempSync(join(tmpdir(), "cantilune-pin-fmt-"));
    try {
      const directory = createFilePeerDirectory(dir);
      const eStop = createProcessEStopGate();
      const result = await rotateEndpointPin({
        peerRef: "peer-a",
        oldFingerprint: "short",
        newFingerprint: NEW_PIN,
        admissionReceiptRef: "receipt-1",
        directory,
        eStop,
        resolveReceipt: async () => receipt(),
      });
      expect(result.ok).toBe(false);
      expect(eStop.isFrozen()).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
