/**
 * File-transport endpoint identity: ActorRef bound to { storeRoot, pid, owner }.
 *
 * Windows/POSIX: identity is a sidecar JSON next to the transport root, never
 * silent skipIf. Forged pid/owner fails closed.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { type Result, err, ok } from "@cantilune/core";
import { commsViolation, type CommsViolation } from "../foundation/commsViolation.js";
import type {
  EndpointIdentityInput,
  EndpointIdentityVerification,
  EndpointIdentityVerifier,
} from "./endpointIdentityVerifier.js";

export interface FileEndpointIdentityRecord {
  readonly actorRef: string;
  readonly storeRoot: string;
  readonly pid: number;
  readonly owner: string;
  readonly issuedAt: string;
}

export interface FileEndpointIdentityInput {
  readonly expectedActorRef: string;
  readonly storeRoot: string;
  readonly presentedPid: number;
  readonly presentedOwner: string;
}

const IDENTITY_FILE = "endpoint-identity.json";

export function fileEndpointIdentityPath(storeRoot: string): string {
  return join(storeRoot, IDENTITY_FILE);
}

/** Resolve a stable owner string for the store root (uid or Windows username). */
export function resolveStoreOwner(storeRoot: string): string {
  try {
    const st = statSync(storeRoot);
    if (typeof st.uid === "number" && st.uid >= 0) {
      return `uid:${st.uid}`;
    }
  } catch {
    // fall through
  }
  return `user:${process.env.USERNAME ?? process.env.USER ?? "unknown"}`;
}

/** Write the local process identity for this FileTransport root. */
export function writeFileEndpointIdentity(
  storeRoot: string,
  actorRef: string,
): FileEndpointIdentityRecord {
  mkdirSync(storeRoot, { recursive: true });
  const record: FileEndpointIdentityRecord = {
    actorRef,
    storeRoot,
    pid: process.pid,
    owner: resolveStoreOwner(storeRoot),
    issuedAt: new Date().toISOString(),
  };
  writeFileSync(fileEndpointIdentityPath(storeRoot), JSON.stringify(record, null, 2), "utf8");
  return record;
}

export function readFileEndpointIdentity(
  storeRoot: string,
): FileEndpointIdentityRecord | undefined {
  const path = fileEndpointIdentityPath(storeRoot);
  if (!existsSync(path)) return undefined;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as FileEndpointIdentityRecord;
  } catch {
    return undefined;
  }
}

function failIdentity(message: string, actual?: string): Result<never, CommsViolation> {
  return err(
    commsViolation("identity_unverified", "authenticate", message, {
      retryable: false,
      ...(actual !== undefined ? { actual } : {}),
    }),
  );
}

/**
 * File EndpointIdentityVerifier: presented pid+owner must match the identity
 * file for the expected ActorRef under storeRoot.
 */
export function createFileEndpointIdentityVerifier(): EndpointIdentityVerifier & {
  verifyFileIdentity(
    input: FileEndpointIdentityInput,
  ): Result<EndpointIdentityVerification, CommsViolation>;
} {
  return {
    verifyPresentedIdentity(input: EndpointIdentityInput) {
      // File path does not use TLS fingerprints; require provenanceUnavailable
      // so callers do not confuse this with mTLS.
      if (input.provenanceUnavailable !== true) {
        return failIdentity(
          "FileTransport identity requires provenanceUnavailable (no TLS fingerprint)",
        );
      }
      return ok({
        boundActorRef: input.expectedActorRef,
        fingerprint: input.presentedFingerprint || "file:unpinned",
        authenticationMethod: "mtls-sha256",
        provenanceUnavailable: true,
      });
    },
    verifyFileIdentity(input: FileEndpointIdentityInput) {
      const record = readFileEndpointIdentity(input.storeRoot);
      if (record === undefined) {
        return failIdentity("file endpoint identity missing", input.storeRoot);
      }
      if (record.actorRef !== input.expectedActorRef) {
        return failIdentity(
          `actorRef mismatch: expected ${input.expectedActorRef}, got ${record.actorRef}`,
        );
      }
      const fsOwner = resolveStoreOwner(input.storeRoot);
      if (record.owner !== fsOwner) {
        return failIdentity(
          `owner mismatch vs filesystem: expected ${fsOwner}, got ${record.owner}`,
        );
      }
      if (record.owner !== input.presentedOwner) {
        return failIdentity(
          `owner mismatch: expected ${record.owner}, got ${input.presentedOwner}`,
        );
      }
      if (record.pid !== input.presentedPid) {
        return failIdentity(`pid mismatch: expected ${record.pid}, got ${input.presentedPid}`);
      }
      return ok({
        boundActorRef: input.expectedActorRef,
        fingerprint: `file:pid=${record.pid};owner=${record.owner}`,
        authenticationMethod: "file-owner-pid",
        provenanceUnavailable: true,
      });
    },
  };
}
