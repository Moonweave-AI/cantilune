declare const brand: unique symbol;

/** Branded string wrapper — prevents mixing incompatible identifiers at compile time. */
export type Brand<T, B extends string> = T & { readonly [brand]: B };

export function asBrand<T extends string, B extends string>(value: T): Brand<T, B> {
  return value as Brand<T, B>;
}

export type ActorId = Brand<string, "ActorId">;
export type ChangeId = Brand<string, "ChangeId">;
export type ArtifactId = Brand<string, "ArtifactId">;
export type LinkId = Brand<string, "LinkId">;
export type SessionId = Brand<string, "SessionId">;
export type CapabilityId = Brand<string, "CapabilityId">;
export type EpochId = Brand<string, "EpochId">;
export type OperationTypeId = Brand<string, "OperationTypeId">;
export type CompositionId = Brand<string, "CompositionId">;
export type EvidenceId = Brand<string, "EvidenceId">;

export const actorId = (value: string): ActorId => asBrand(value);
export const changeId = (value: string): ChangeId => asBrand(value);
export const artifactId = (value: string): ArtifactId => asBrand(value);
export const linkId = (value: string): LinkId => asBrand(value);
export const sessionId = (value: string): SessionId => asBrand(value);
export const capabilityId = (value: string): CapabilityId => asBrand(value);
export const epochId = (value: string): EpochId => asBrand(value);
export const operationTypeId = (value: string): OperationTypeId => asBrand(value);
export const compositionId = (value: string): CompositionId => asBrand(value);
export const evidenceId = (value: string): EvidenceId => asBrand(value);
