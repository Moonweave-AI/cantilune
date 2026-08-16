/**
 * Production IdentityVerifier: HMAC when operator key material is present.
 */
import { HmacIdentityVerifier } from "./hmacIdentityVerifier.js";
import { createHmacKeyResolver, resolveCommsHmacKey } from "./hmacKeyMaterial.js";
import { type IdentityVerifier } from "./identityVerifier.js";

export function composeProductionIdentityVerifier(input?: {
  readonly storeDir?: string;
  readonly env?: NodeJS.ProcessEnv;
  readonly clock?: { now(): string };
}): IdentityVerifier | undefined {
  const secret = resolveCommsHmacKey({
    ...(input?.storeDir !== undefined ? { storeDir: input.storeDir } : {}),
    ...(input?.env !== undefined ? { env: input.env } : {}),
  });
  if (secret === undefined) {
    return undefined;
  }
  return new HmacIdentityVerifier({
    keyResolver: createHmacKeyResolver(secret),
    clock: input?.clock ?? { now: () => new Date().toISOString() },
  });
}
