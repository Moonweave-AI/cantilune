import { createHash, timingSafeEqual, X509Certificate } from "node:crypto";

const SHA256_HEX_LENGTH = 64;
const HEX_PAIR = /[^0-9a-f]/g;

/**
 * Normalize a certificate fingerprint to lowercase hex without separators.
 * Accepts `aa:bb:...` (Node `X509Certificate.fingerprint256`) or bare hex.
 */
export function normalizeCertificateFingerprint(value: string): string {
  return value.trim().toLowerCase().replace(HEX_PAIR, "");
}

export function isSha256Fingerprint(value: string): boolean {
  const normalized = normalizeCertificateFingerprint(value);
  return normalized.length === SHA256_HEX_LENGTH && /^[0-9a-f]+$/.test(normalized);
}

/** SHA-256 of the certificate DER, lowercase hex (the pin form used in receipts). */
export function fingerprintCertificateDer(der: Uint8Array | Buffer): string {
  return createHash("sha256").update(der).digest("hex");
}

/** SHA-256 of a PEM-encoded X.509 certificate. */
export function fingerprintCertificatePem(pem: string): string {
  const cert = new X509Certificate(pem);
  return fingerprintCertificateDer(cert.raw);
}

/**
 * Timing-safe equality after normalization. Different lengths are not equal
 * (no throw) so a truncated pin cannot be used as an oracle.
 */
export function fingerprintsEqual(left: string, right: string): boolean {
  const a = normalizeCertificateFingerprint(left);
  const b = normalizeCertificateFingerprint(right);
  if (a.length !== SHA256_HEX_LENGTH || b.length !== SHA256_HEX_LENGTH) {
    return false;
  }
  const leftBuf = Buffer.from(a, "hex");
  const rightBuf = Buffer.from(b, "hex");
  if (leftBuf.length !== rightBuf.length) {
    return false;
  }
  return timingSafeEqual(leftBuf, rightBuf);
}

export function fingerprintInPinnedSet(presented: string, pinned: readonly string[]): boolean {
  for (const pin of pinned) {
    if (fingerprintsEqual(presented, pin)) {
      return true;
    }
  }
  return false;
}
