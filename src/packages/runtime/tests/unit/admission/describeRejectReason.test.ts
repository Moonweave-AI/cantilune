import { describe, expect, it } from "vitest";
import { epochId } from "@cantilune/core";
import {
  describeRejectReason,
  type AdmissionRejectReason,
} from "../../../src/admission/admissionGateway.js";

/**
 * Callers used to surface `reason.kind` alone. The consumer of this text is an
 * LLM expected to correct itself from it, so a bare tag meant the same rejected
 * operation was retried unchanged until the turn limit.
 */
const REASONS: readonly AdmissionRejectReason[] = [
  { kind: "template_not_found" },
  { kind: "missing_role", role: "participant" },
  { kind: "requires_failed", condition: { kind: "participant.registered", bindings: {} } },
  { kind: "policy_denied", reason: "initiator status is retired, not active" },
  { kind: "resource_conflict" },
  { kind: "epoch_mismatch", headEpochId: epochId("head-1"), activeEpochId: epochId("active-9") },
  { kind: "snapshot_invalid", cause: { code: "snapshot_integrity", message: "dangling ref" } },
  { kind: "head_not_found" },
  { kind: "principal_invalid", reason: "principal does not match 'from' binding" },
] as unknown as readonly AdmissionRejectReason[];

describe("describeRejectReason", () => {
  it("names the kind and stays non-empty for every variant", () => {
    for (const reason of REASONS) {
      const text = describeRejectReason(reason);
      expect(text).toContain(reason.kind);
      expect(text.length).toBeGreaterThan(reason.kind.length);
    }
  });

  it("reports both epochs so the mismatched side is identifiable", () => {
    const text = describeRejectReason({
      kind: "epoch_mismatch",
      headEpochId: epochId("head-1"),
      activeEpochId: epochId("active-9"),
    });
    expect(text).toContain("head-1");
    expect(text).toContain("active-9");
  });

  it("keeps the payload of the variants that carry one", () => {
    expect(describeRejectReason({ kind: "missing_role", role: "participant" })).toContain(
      "participant",
    );
    expect(
      describeRejectReason({ kind: "policy_denied", reason: "initiator is retired" }),
    ).toContain("initiator is retired");
    expect(
      describeRejectReason({ kind: "principal_invalid", reason: "principal_mismatch" }),
    ).toContain("principal_mismatch");
    expect(
      describeRejectReason({
        kind: "requires_failed",
        condition: { kind: "participant.registered", bindings: {} },
      } as AdmissionRejectReason),
    ).toContain("participant.registered");
  });
});
