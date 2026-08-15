import type { ActorRef, CoordinationIntent } from "@cantilune/core";

export type PrincipalValidationError =
  | { readonly kind: "principal_initiator_mismatch" }
  | { readonly kind: "principal_from_mismatch" }
  | { readonly kind: "principal_source_mismatch" };

/** Ensures the authenticated caller matches intent initiator and delegate from-role. */
export function validateAdmissionPrincipal(
  intent: CoordinationIntent,
  principal: ActorRef,
): PrincipalValidationError | undefined {
  if (principal.actorId !== intent.initiator.actorId || principal.kind !== intent.initiator.kind) {
    return { kind: "principal_initiator_mismatch" };
  }

  const fromBinding = intent.matchBindings.find((binding) => binding.role === "from");
  if (fromBinding?.role === "from") {
    if (fromBinding.actorId !== principal.actorId) {
      return { kind: "principal_from_mismatch" };
    }
  }

  return undefined;
}

/** Ensures the authenticated caller matches the observation source attribution. */
export function validateObservePrincipal(
  source: ActorRef,
  principal: ActorRef,
): PrincipalValidationError | undefined {
  if (principal.actorId !== source.actorId || principal.kind !== source.kind) {
    return { kind: "principal_source_mismatch" };
  }
  return undefined;
}
