/** Approval and retry posture stored in the snapshot (evaluation logic lives in runtime). */
export interface PolicyContext {
  readonly approvalState: ApprovalState;
  readonly retryState: RetryState;
}

export type ApprovalState =
  | { readonly kind: "none" }
  | { readonly kind: "awaiting_review"; readonly reviewers: readonly string[] }
  | { readonly kind: "approved"; readonly evidenceRef: string }
  | { readonly kind: "rejected"; readonly evidenceRef: string };

export type RetryState =
  | { readonly kind: "idle" }
  | { readonly kind: "awaiting_feedback"; readonly attempt: number }
  | { readonly kind: "exhausted" };

export const emptyPolicyContext: PolicyContext = {
  approvalState: { kind: "none" },
  retryState: { kind: "idle" },
};

export function withApprovalState(
  context: PolicyContext,
  approvalState: ApprovalState,
): PolicyContext {
  return { ...context, approvalState };
}
