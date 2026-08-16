/**
 * Operator-supplied HMAC key material. Never hardcoded.
 * Env `CANTILUNE_COMMS_HMAC_KEY` wins; otherwise `{storeDir}/hmac.key`.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { type Result, err, ok } from "@cantilune/core";
import { commsViolation, type CommsViolation } from "../foundation/commsViolation.js";
import { type KeyResolver } from "./identityVerifier.js";

export const COMMS_HMAC_KEY_ENV = "CANTILUNE_COMMS_HMAC_KEY";
export const COMMS_HMAC_KEY_FILE = "hmac.key";

export function resolveCommsHmacKey(input?: {
  readonly storeDir?: string;
  readonly env?: NodeJS.ProcessEnv;
}): string | undefined {
  const env = input?.env ?? process.env;
  const fromEnv = env[COMMS_HMAC_KEY_ENV]?.trim();
  if (fromEnv !== undefined && fromEnv.length > 0) {
    return fromEnv;
  }
  const storeDir = input?.storeDir;
  if (storeDir === undefined) {
    return undefined;
  }
  const path = join(storeDir, COMMS_HMAC_KEY_FILE);
  if (!existsSync(path)) {
    return undefined;
  }
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch (error) {
    throw new Error(`Cantilune comms HMAC key file is unreadable: ${path}`, { cause: error });
  }
  const fromFile = raw.trim();
  return fromFile.length > 0 ? fromFile : undefined;
}

export function createHmacKeyResolver(secret: string): KeyResolver {
  return {
    resolveVerificationKey(): Result<string, CommsViolation> {
      if (secret.length === 0) {
        return err(commsViolation("identity_unverified", "authenticate", "HMAC key empty"));
      }
      return ok(secret);
    },
  };
}
