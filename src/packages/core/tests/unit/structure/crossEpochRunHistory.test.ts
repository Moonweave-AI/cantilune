import { describe, expect, it } from "vitest";
import { validateCrossEpochRunHistory } from "../../../src/structure/crossEpochRunHistory.js";
import { emptyRunHistory, validateRunHistory } from "../../../src/structure/trace.js";
import { epochId } from "../../../src/primitives/ids.js";
import { snapshotRef } from "../../../src/primitives/refs.js";
import {
  activationDomainId,
  admissionTombstoneId,
  bindingGeneration,
  contentDigest,
  correlationId,
  epochOrdinal,
  handlerManifestDigest,
  handlerManifestId,
  handlerManifestRef,
  idempotencyKey,
  occurrenceId,
  planDigest,
  policyId,
  policyRef,
  policyRevisionId,
  schemaAdmissionId,
  schemaDigest,
  schemaId,
  schemaRevisionId,
  storeSequence,
} from "../../../src/primitives/controlPlaneIds.js";
import type { SchemaAdmissionReceipt } from "../../../src/coordination/schemaAdmissionReceipt.js";

describe("validateCrossEpochRunHistory", () => {
  const epoch42 = { epochId: epochId("42"), history: validateRunHistory(emptyRunHistory()) };
  const epoch43 = { epochId: epochId("43"), history: validateRunHistory(emptyRunHistory()) };
  const binding = {
    activationDomainId: activationDomainId("default"),
    bindingGeneration: bindingGeneration(1),
    epochId: epochId("42"),
    epochOrdinal: epochOrdinal(1),
    schemaRef: {
      schemaId: schemaId("default-v1"),
      revisionId: schemaRevisionId("rev-001"),
      digest: schemaDigest("d1"),
    },
    policyRef: policyRef(policyId("p1"), policyRevisionId("pr1"), contentDigest("pd1")),
    handlerManifestRef: handlerManifestRef(handlerManifestId("h1"), handlerManifestDigest("hd1")),
    runtimeHead: snapshotRef("snap-S0"),
    admissionId: schemaAdmissionId("bootstrap"),
    activatedBy: "bootstrap",
    activatedAt: "2026-08-11T00:00:00Z",
  };

  function receipt(overrides: Partial<SchemaAdmissionReceipt> = {}): SchemaAdmissionReceipt {
    return {
      admissionId: schemaAdmissionId("adm-1"),
      activationDomainId: activationDomainId("default"),
      fromBinding: binding,
      toBinding: { ...binding, epochId: epochId("43"), epochOrdinal: epochOrdinal(2) },
      beforeSnapshotRef: snapshotRef("snap-S0"),
      afterSnapshotRef: snapshotRef("snap-E1"),
      extensionPlanRef: "plan-ref-1",
      admissionTombstoneId: admissionTombstoneId("tomb-1"),
      committedBy: "test",
      committedAt: "2026-08-11T00:00:00Z",
      storeSequence: storeSequence(1),
      correlationId: correlationId("corr-1"),
      occurrenceId: occurrenceId("occ-1"),
      idempotencyKey: idempotencyKey("idem-1"),
      planDigest: planDigest("pd-1"),
      ...overrides,
    };
  }

  it("accepts consistent admissions between epochs", () => {
    expect(() =>
      validateCrossEpochRunHistory({
        epochs: [epoch42, epoch43],
        admissions: [receipt()],
      }),
    ).not.toThrow();
  });

  it("rejects admission count mismatch", () => {
    expect(() =>
      validateCrossEpochRunHistory({
        epochs: [epoch42, epoch43],
        admissions: [],
      }),
    ).toThrow(/cross_epoch_history_invalid/);
  });

  it("rejects epoch binding mismatch", () => {
    expect(() =>
      validateCrossEpochRunHistory({
        epochs: [epoch42, epoch43],
        admissions: [receipt({ fromBinding: { ...binding, epochId: epochId("99") } })],
      }),
    ).toThrow(/from epoch mismatch/);
  });
});
