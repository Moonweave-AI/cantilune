export type SignatureDomain = "certificate" | "attestation";

export const SIGNATURE_DOMAINS: Record<SignatureDomain, string> = {
  certificate: "cantilune/conformance/certificate/v1",
  attestation: "cantilune/conformance/attestation/v1",
};

export function signatureDomainBytes(domain: SignatureDomain): Uint8Array {
  return new TextEncoder().encode(`${SIGNATURE_DOMAINS[domain]}\0`);
}

export function domainSeparatedPayload(domain: SignatureDomain, payload: Uint8Array): Uint8Array {
  const prefix = signatureDomainBytes(domain);
  const combined = new Uint8Array(prefix.length + payload.length);
  combined.set(prefix, 0);
  combined.set(payload, prefix.length);
  return combined;
}
