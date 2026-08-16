import { describe, expect, it } from "vitest";
import { X509Certificate } from "node:crypto";
import {
  fingerprintCertificateDer,
  fingerprintCertificatePem,
  fingerprintInPinnedSet,
  fingerprintsEqual,
  isSha256Fingerprint,
  normalizeCertificateFingerprint,
} from "../../src/security/certificateFingerprint.js";
import { issueSelfSignedMtlsPair } from "../../src/security/mtlsMaterial.js";

describe("certificateFingerprint", () => {
  it("normalizes colon-separated and bare hex to the same pin", () => {
    const pair = issueSelfSignedMtlsPair();
    const cert = new X509Certificate(pair.a.cert);
    const fromPem = fingerprintCertificatePem(pair.a.cert);
    const fromDer = fingerprintCertificateDer(cert.raw);
    expect(fromPem).toBe(fromDer);
    expect(fromPem).toBe(pair.a.fingerprint);
    expect(normalizeCertificateFingerprint(cert.fingerprint256)).toBe(fromPem);
    expect(isSha256Fingerprint(fromPem)).toBe(true);
    expect(isSha256Fingerprint("not-a-fingerprint")).toBe(false);
  });

  it("compares fingerprints timing-safely and rejects truncated pins", () => {
    const pair = issueSelfSignedMtlsPair();
    expect(fingerprintsEqual(pair.a.fingerprint, pair.a.fingerprint.toUpperCase())).toBe(true);
    expect(fingerprintsEqual(pair.a.fingerprint, pair.b.fingerprint)).toBe(false);
    expect(fingerprintsEqual(pair.a.fingerprint.slice(0, 16), pair.a.fingerprint)).toBe(false);
    expect(
      fingerprintInPinnedSet(pair.a.fingerprint, [pair.b.fingerprint, pair.a.fingerprint]),
    ).toBe(true);
    expect(fingerprintInPinnedSet(pair.a.fingerprint, [pair.b.fingerprint])).toBe(false);
  });
});
