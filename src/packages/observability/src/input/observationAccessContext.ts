import type { ActorRef, Footprint, ChangeVisibility } from "@cantilune/core";

/**
 * Access context required for production-facing observability reads (ADR-0005).
 * SDK/UI callers MUST supply this once reads leave the trusted operator zone.
 */
export interface ObservationAccessContext {
  readonly principal: ActorRef;
  /** Readable scope — policy-derived or explicit footprint. */
  readonly scope: Footprint;
  /** Which ChangeVisibility classes participate in read-angle deltas. */
  readonly visibilityPolicy: ObservableLtsPolicy;
}

export interface ObservableLtsPolicy {
  readonly includeVisibility: readonly ChangeVisibility[];
}

export const EXTERNAL_ONLY_LTS_POLICY: ObservableLtsPolicy = {
  includeVisibility: ["external"],
};

export const EXTERNAL_AND_INTERNAL_LTS_POLICY: ObservableLtsPolicy = {
  includeVisibility: ["external", "internal"],
};

export function allowsVisibility(
  policy: ObservableLtsPolicy,
  visibility: ChangeVisibility,
): boolean {
  return policy.includeVisibility.includes(visibility);
}

export function requireAccessContext(
  context: ObservationAccessContext | undefined,
): ObservationAccessContext {
  if (context === undefined) {
    throw new Error(
      "ObservationAccessContext is required for production-facing observability reads (ADR-0005)",
    );
  }
  if (context.principal === undefined || context.scope === undefined) {
    throw new Error("ObservationAccessContext.principal and scope are required");
  }
  return context;
}
