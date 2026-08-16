import { type Result, err, ok } from "@cantilune/core";
import { commsViolation, type CommsViolation } from "../foundation/commsViolation.js";
import { type PeerDirectory } from "../ports/communicationTransport.js";
import {
  fingerprintInPinnedSet,
  isSha256Fingerprint,
  normalizeCertificateFingerprint,
} from "./certificateFingerprint.js";
import { type EStopGate } from "./identityVerifier.js";

/**
 * Transport-level identity binding (ADR-0018 §2). Confirms the presented peer
 * identity matches the `ActorRef` the admission receipt committed.
 *
 * `NetTransport` uses the mTLS certificate fingerprint pinned in the receipt.
 * `FileTransport` does not call this port (filesystem ACL + process identity).
 */
export interface EndpointIdentityVerifier {
  verifyPresentedIdentity(
    input: EndpointIdentityInput,
  ): Result<EndpointIdentityVerification, CommsViolation>;
}

export interface EndpointIdentityInput {
  /** ActorRef the receipt committed for this peer. */
  readonly expectedActorRef: string;
  /** SHA-256 of the peer certificate DER (hex, optional colon separators). */
  readonly presentedFingerprint: string;
  /** Receipt-pinned fingerprints. Empty only when provenance is unavailable. */
  readonly pinnedFingerprints: readonly string[];
  /** True only after a successful TLS handshake with a verified peer cert. */
  readonly tlsVerified: boolean;
  /**
   * Required when the peer cannot be pinned (RFC-0004 §11.2). Such a session
   * MUST NOT carry publishable superiority claims without reviewer exception.
   */
  readonly provenanceUnavailable?: boolean;
  /** Peer key for live directory pins after admission-bound rotation. */
  readonly peerRef?: string;
}

export interface EndpointIdentityVerification {
  readonly boundActorRef: string;
  readonly fingerprint: string;
  readonly authenticationMethod: "mtls-sha256" | "file-owner-pid";
  readonly provenanceUnavailable: boolean;
}

export interface MtlsEndpointIdentityVerifierOptions {
  readonly eStop?: EStopGate;
  readonly directory?: PeerDirectory;
  readonly peerRef?: string;
}

function failIdentity(
  message: string,
  eStop: EStopGate | undefined,
  actual?: string,
): Result<never, CommsViolation> {
  eStop?.setFrozen(true);
  return err(
    commsViolation("identity_unverified", "authenticate", message, {
      retryable: false,
      ...(actual !== undefined ? { actual } : {}),
    }),
  );
}

/**
 * Production mTLS path: the presented certificate fingerprint must be in the
 * receipt-pinned set. Unpinned peers are fail-closed unless the caller sets
 * `provenanceUnavailable` (and then the result carries that flag).
 *
 * When a peer directory is supplied, live pins (after `rotateEndpointPin`)
 * replace the caller's snapshot. A pin miss freezes E-Stop when provided.
 */
export function createMtlsEndpointIdentityVerifier(
  options?: MtlsEndpointIdentityVerifierOptions,
): EndpointIdentityVerifier {
  return {
    verifyPresentedIdentity(input) {
      if (!input.tlsVerified) {
        return failIdentity("mTLS peer certificate was not verified by TLS", options?.eStop);
      }
      if (!isSha256Fingerprint(input.presentedFingerprint)) {
        return failIdentity("presented fingerprint is not a SHA-256 hex digest", options?.eStop);
      }
      const fingerprint = normalizeCertificateFingerprint(input.presentedFingerprint);
      const peerRef = input.peerRef ?? options?.peerRef;
      const pins =
        options?.directory !== undefined && peerRef !== undefined
          ? options.directory.getPinnedFingerprints(peerRef)
          : input.pinnedFingerprints;
      if (pins.length === 0) {
        if (input.provenanceUnavailable !== true) {
          return failIdentity(
            "peer fingerprint is not pinned; set provenanceUnavailable to proceed without publishable claims",
            options?.eStop,
          );
        }
        return ok({
          boundActorRef: input.expectedActorRef,
          fingerprint,
          authenticationMethod: "mtls-sha256",
          provenanceUnavailable: true,
        });
      }
      if (!fingerprintInPinnedSet(fingerprint, pins)) {
        return failIdentity(
          "presented certificate fingerprint is not in the receipt pin set",
          options?.eStop,
        );
      }
      return ok({
        boundActorRef: input.expectedActorRef,
        fingerprint,
        authenticationMethod: "mtls-sha256",
        provenanceUnavailable: false,
      });
    },
  };
}
