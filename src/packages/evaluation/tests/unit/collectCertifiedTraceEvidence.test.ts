import { describe, expect, it } from "vitest";
import {
  collectCertifiedTraceEvidence,
  collectCertifiedTraceEvidenceFromBundle,
  type CertifiedTraceDraft,
} from "../../src/collection/collectCertifiedTraceEvidence.js";

const consistent = {
  status: "consistent" as const,
  evidenceRef: "ev-1",
  detail: undefined,
};

function draft(overrides: Partial<CertifiedTraceDraft> = {}): CertifiedTraceDraft {
  return {
    coreEventRef: "chg-1",
    coreChangeDigest: "digest-1",
    beforeRef: "snap-a",
    afterRef: "snap-b",
    executionEpoch: "42",
    views: {
      dag: { mapState: consistent, mapEvent: consistent },
      petri: { mapState: consistent },
      piCalc: { mapState: consistent },
      morphism: { mapState: consistent },
    },
    ...overrides,
  };
}

describe("collectCertifiedTraceEvidence", () => {
  it("collects four independent views from one event", () => {
    const result = collectCertifiedTraceEvidence(draft());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.dagView.viewName).toBe("dag");
    expect(result.value.petriView.viewName).toBe("petri");
    expect(result.value.piCalcView.viewName).toBe("piCalc");
    expect(result.value.morphismView.viewName).toBe("morphism");
    expect(result.value.sharedExecutionDigest).toBeTruthy();
  });

  it("accepts a 64-char change digest and a mismatched read-model angle", () => {
    const hex = "ab".repeat(32);
    const hashed = collectCertifiedTraceEvidence(
      draft({
        coreChangeDigest: hex,
        sourceConfigDigest: hex,
        targetConfigDigest: hex,
        admissionEvidence: {
          fromVersion: "1",
          toVersion: "2",
          extensionRef: undefined,
          tombstoneRef: undefined,
          fourViewCertificateRef: undefined,
        },
      }),
    );
    expect(hashed.ok).toBe(true);

    const mismatch = collectCertifiedTraceEvidenceFromBundle({
      spine: {
        events: [{ change: { changeId: "chg-m", beforeRef: "a", afterRef: "b", epochId: "1" } }],
      },
      evidence: {
        byEvent: {
          getByChangeId: () => ({
            dependency: { snapshotsResolved: true, rederivedDeltaMatches: false },
            resource: { snapshotsResolved: false, rederivedDeltaMatches: false },
            communication: { snapshotsResolved: true, rederivedDeltaMatches: true },
            structure: { snapshotsResolved: true, rederivedDeltaMatches: true },
          }),
        },
      },
    });
    expect(mismatch.ok).toBe(true);
  });

  it("fail-closes on a missing event id or missing view", () => {
    expect(collectCertifiedTraceEvidence(draft({ coreEventRef: "  " })).ok).toBe(false);
    const missing = collectCertifiedTraceEvidence(
      draft({ views: { dag: { mapState: consistent }, petri: undefined as never, piCalc: {}, morphism: {} } }),
    );
    expect(missing.ok).toBe(false);
  });

  it("fail-closes when an inconsistent step has no evidence ref", () => {
    const result = collectCertifiedTraceEvidence(
      draft({
        views: {
          dag: { mapState: { status: "inconsistent", evidenceRef: undefined, detail: "bad" } },
          petri: {},
          piCalc: {},
          morphism: {},
        },
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.violations[0]?.code).toBe("evidence_incomplete");
  });

  it("collects from a FourView-shaped bundle and rejects an empty spine", () => {
    const empty = collectCertifiedTraceEvidenceFromBundle({});
    expect(empty.ok).toBe(false);

    const byEvent = {
      getByChangeId: (id: unknown) =>
        id === "chg-1"
          ? {
              dependency: { snapshotsResolved: true, rederivedDeltaMatches: true },
              resource: { snapshotsResolved: true, rederivedDeltaMatches: true },
              communication: { snapshotsResolved: true, rederivedDeltaMatches: true },
              structure: { snapshotsResolved: true, rederivedDeltaMatches: true },
            }
          : undefined,
    };
    const result = collectCertifiedTraceEvidenceFromBundle({
      spine: {
        events: [
          {
            change: {
              changeId: "chg-1",
              beforeRef: "a",
              afterRef: "b",
              epochId: "1",
              visibility: "external",
              operationTypeId: "introduce_artifact",
            },
          },
        ],
      },
      evidence: { byEvent },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(1);
      expect(result.value[0]?.classification).toBe("external");
    }

    const unresolved = collectCertifiedTraceEvidenceFromBundle({
      spine: {
        events: [{ change: { changeId: "chg-2", beforeRef: "a", afterRef: "b", epochId: "1" } }],
      },
      evidence: { byEvent },
    });
    expect(unresolved.ok).toBe(true);

    const noChange = collectCertifiedTraceEvidenceFromBundle({
      spine: { events: [{}] },
    });
    expect(noChange.ok).toBe(false);
  });
});
