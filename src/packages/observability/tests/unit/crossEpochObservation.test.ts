import { describe, expect, it } from "vitest";
import { buildConfigT0 } from "@cantilune/test-fixtures";
import {
  buildCrossEpochObservationInput,
  mergeValidatedHistories,
  segmentObservationByEpoch,
} from "../../src/input/crossEpochObservation.js";
import {
  activationDomainId,
  admissionTombstoneId,
  bindingGeneration,
  contentDigest,
  correlationId,
  epochId,
  epochOrdinal,
  handlerManifestDigest,
  handlerManifestId,
  handlerManifestRef,
  idempotencyKey,
  occurrenceId,
  policyId,
  policyRevisionId,
  policyRef,
  schemaAdmissionId,
  planDigest,
  schemaDigest,
  schemaId,
  schemaRevisionId,
  snapshotRef,
  storeSequence,
} from "@cantilune/core";

describe("cross-epoch observation segmentation", () => {
  it("segments admissions by target epoch and merges validated histories", () => {
    const t0 = buildConfigT0();
    const receipt = {
      admissionId: schemaAdmissionId("adm-obs-1"),
      activationDomainId: activationDomainId("default"),
      fromBinding: {
        activationDomainId: activationDomainId("default"),
        bindingGeneration: bindingGeneration(1),
        epochId: epochId("42"),
        epochOrdinal: epochOrdinal(1),
        schemaRef: {
          schemaId: schemaId("default-v1"),
          revisionId: schemaRevisionId("rev-001"),
          digest: schemaDigest("d1"),
        },
        policyRef: policyRef(policyId("p"), policyRevisionId("1"), contentDigest("p1")),
        handlerManifestRef: handlerManifestRef(handlerManifestId("h"), handlerManifestDigest("h1")),
        runtimeHead: snapshotRef("snap-S0"),
        admissionId: schemaAdmissionId("bootstrap"),
        activatedBy: "bootstrap",
        activatedAt: "2026-08-11T00:00:00Z",
      },
      toBinding: {
        activationDomainId: activationDomainId("default"),
        bindingGeneration: bindingGeneration(2),
        epochId: epochId("43"),
        epochOrdinal: epochOrdinal(2),
        schemaRef: {
          schemaId: schemaId("default-v1"),
          revisionId: schemaRevisionId("rev-002"),
          digest: schemaDigest("d2"),
        },
        policyRef: policyRef(policyId("p"), policyRevisionId("1"), contentDigest("p1")),
        handlerManifestRef: handlerManifestRef(handlerManifestId("h"), handlerManifestDigest("h1")),
        runtimeHead: snapshotRef("snap-E1"),
        admissionId: schemaAdmissionId("adm-obs-1"),
        activatedBy: "operator",
        activatedAt: "2026-08-11T01:00:00Z",
      },
      beforeSnapshotRef: snapshotRef("snap-S0"),
      afterSnapshotRef: snapshotRef("snap-E1"),
      extensionPlanRef: "{}",
      admissionTombstoneId: admissionTombstoneId("tomb-1"),
      committedBy: "operator",
      committedAt: "2026-08-11T01:00:00Z",
      storeSequence: storeSequence(2),
      correlationId: correlationId("corr-1"),
      occurrenceId: occurrenceId("occ-1"),
      idempotencyKey: idempotencyKey("idem-1"),
      planDigest: planDigest("plan-1"),
    };

    const segmented = segmentObservationByEpoch([receipt]);
    expect(segmented.get(epochId("43"))).toBe(schemaAdmissionId("adm-obs-1"));

    const history = buildCrossEpochObservationInput({
      epochs: [
        { epochId: epochId("42"), history: { kind: "validated", segments: [] } },
        { epochId: epochId("43"), history: { kind: "validated", segments: [] } },
      ],
      admissions: [receipt],
      windows: [
        {
          headRef: t0.snapshotRef,
          sinceRef: t0.snapshotRef,
          snapshot: t0,
          changes: [],
          validatedHistory: { kind: "validated", segments: [] },
        },
      ],
    });
    expect(history.admissions).toHaveLength(1);

    const merged = mergeValidatedHistories([
      { kind: "validated", segments: [] },
      { kind: "validated", segments: [] },
    ]);
    expect(merged.segments).toHaveLength(0);
  });
});
