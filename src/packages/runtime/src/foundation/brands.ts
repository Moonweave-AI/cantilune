import type { Brand, ChangeId } from "@cantilune/core";

/** Opaque admission ticket id — minted only by AdmissionGateway. */
export type AdmittedId = Brand<string, "AdmittedId">;

/** Brand for a change that has been atomically committed. */
export type CommittedChangeId = Brand<ChangeId, "CommittedChangeId">;

/** @internal Runtime admission minting — not for external ticket forgery. */
export function admittedId(value: string): AdmittedId {
  return value as AdmittedId;
}

export function committedChangeId(value: ChangeId): CommittedChangeId {
  return value as CommittedChangeId;
}
