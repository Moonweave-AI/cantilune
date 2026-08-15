import { describe, expect, it } from "vitest";
import { emptyPolicyContext, withApprovalState } from "../../../src/nodes/policyContext.js";

describe("policyContext", () => {
  it("starts with no approval and idle retry", () => {
    expect(emptyPolicyContext.approvalState).toEqual({ kind: "none" });
    expect(emptyPolicyContext.retryState).toEqual({ kind: "idle" });
  });

  it("updates approval state immutably", () => {
    const awaiting = withApprovalState(emptyPolicyContext, {
      kind: "awaiting_review",
      reviewers: ["reviewer-r"],
    });
    expect(emptyPolicyContext.approvalState.kind).toBe("none");
    expect(awaiting.approvalState).toEqual({
      kind: "awaiting_review",
      reviewers: ["reviewer-r"],
    });
  });
});
