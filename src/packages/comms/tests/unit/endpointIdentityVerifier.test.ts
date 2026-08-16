import { describe, expect, it } from "vitest";
import { createMtlsEndpointIdentityVerifier } from "../../src/security/endpointIdentityVerifier.js";
import { issueSelfSignedMtlsPair } from "../../src/security/mtlsMaterial.js";

describe("createMtlsEndpointIdentityVerifier", () => {
  const verifier = createMtlsEndpointIdentityVerifier();

  it("binds a receipt-pinned fingerprint to the expected ActorRef", () => {
    const pair = issueSelfSignedMtlsPair();
    const result = verifier.verifyPresentedIdentity({
      expectedActorRef: pair.b.actorRef,
      presentedFingerprint: pair.b.fingerprint,
      pinnedFingerprints: [pair.b.fingerprint],
      tlsVerified: true,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.boundActorRef).toBe(pair.b.actorRef);
    expect(result.value.authenticationMethod).toBe("mtls-sha256");
    expect(result.value.provenanceUnavailable).toBe(false);
  });

  it("accepts colon-separated Node fingerprint256 form", () => {
    const pair = issueSelfSignedMtlsPair();
    const colon = pair.a.fingerprint.match(/.{2}/g)?.join(":").toUpperCase() ?? "";
    const result = verifier.verifyPresentedIdentity({
      expectedActorRef: pair.a.actorRef,
      presentedFingerprint: colon,
      pinnedFingerprints: [pair.a.fingerprint],
      tlsVerified: true,
    });
    expect(result.ok).toBe(true);
  });

  it("fails closed when TLS did not verify the peer certificate", () => {
    const pair = issueSelfSignedMtlsPair();
    const result = verifier.verifyPresentedIdentity({
      expectedActorRef: pair.a.actorRef,
      presentedFingerprint: pair.a.fingerprint,
      pinnedFingerprints: [pair.a.fingerprint],
      tlsVerified: false,
    });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.code).toBe("identity_unverified");
  });

  it("fails closed on an unpinned peer unless provenanceUnavailable is set", () => {
    const pair = issueSelfSignedMtlsPair();
    const denied = verifier.verifyPresentedIdentity({
      expectedActorRef: pair.a.actorRef,
      presentedFingerprint: pair.a.fingerprint,
      pinnedFingerprints: [],
      tlsVerified: true,
    });
    expect(denied.ok).toBe(false);

    const allowed = verifier.verifyPresentedIdentity({
      expectedActorRef: pair.a.actorRef,
      presentedFingerprint: pair.a.fingerprint,
      pinnedFingerprints: [],
      tlsVerified: true,
      provenanceUnavailable: true,
    });
    expect(allowed.ok).toBe(true);
    if (!allowed.ok) {
      return;
    }
    expect(allowed.value.provenanceUnavailable).toBe(true);
  });

  it("rejects a pin mismatch even when provenanceUnavailable is set", () => {
    const pair = issueSelfSignedMtlsPair();
    const result = verifier.verifyPresentedIdentity({
      expectedActorRef: pair.a.actorRef,
      presentedFingerprint: pair.a.fingerprint,
      pinnedFingerprints: [pair.b.fingerprint],
      tlsVerified: true,
      provenanceUnavailable: true,
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a presented value that is not a SHA-256 hex digest", () => {
    const result = verifier.verifyPresentedIdentity({
      expectedActorRef: "peer",
      presentedFingerprint: "short",
      pinnedFingerprints: ["aa".repeat(32)],
      tlsVerified: true,
    });
    expect(result.ok).toBe(false);
  });

  it("freezes E-Stop when a presented pin misses the live directory set", () => {
    const pair = issueSelfSignedMtlsPair();
    const directory = {
      resolve: async () => undefined,
      register: () => undefined,
      getPinnedFingerprints: () => [pair.b.fingerprint],
      setPinnedFingerprints: () => undefined,
    };
    let frozen = false;
    const gated = createMtlsEndpointIdentityVerifier({
      directory,
      peerRef: "peer-a",
      eStop: {
        isFrozen: () => frozen,
        setFrozen: (next) => {
          frozen = next;
        },
      },
    });
    const miss = gated.verifyPresentedIdentity({
      expectedActorRef: pair.a.actorRef,
      presentedFingerprint: pair.a.fingerprint,
      pinnedFingerprints: [pair.a.fingerprint],
      tlsVerified: true,
    });
    expect(miss.ok).toBe(false);
    expect(frozen).toBe(true);
  });
});
