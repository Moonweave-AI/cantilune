import { generateKeyPairSync, randomBytes, sign, type KeyObject } from "node:crypto";
import { fingerprintCertificateDer } from "../certificateFingerprint.js";
import {
  derBitString,
  derBool,
  derContextExplicit,
  derIntegerBytes,
  derIntegerNumber,
  derIa5,
  derOid,
  derOctetString,
  derSeq,
  derSet,
  derTlv,
  derUtcTime,
  derUtf8,
  encodePem,
} from "./der.js";

const OID_CN = "2.5.4.3";
const OID_ECDSA_SHA256 = "1.2.840.10045.4.3.2";
const OID_BASIC_CONSTRAINTS = "2.5.29.19";
const OID_KEY_USAGE = "2.5.29.15";
const OID_EXT_KEY_USAGE = "2.5.29.37";
const OID_SAN = "2.5.29.17";
const OID_SERVER_AUTH = "1.3.6.1.5.5.7.3.1";
const OID_CLIENT_AUTH = "1.3.6.1.5.5.7.3.2";

const DEFAULT_VALID_MS = 365 * 24 * 60 * 60 * 1000;

export interface IssuedTlsIdentity {
  readonly cert: string;
  readonly key: string;
  readonly fingerprint: string;
  readonly actorRef: string;
}

export interface IssuedMtlsPair {
  readonly ca: IssuedTlsIdentity;
  readonly a: IssuedTlsIdentity;
  readonly b: IssuedTlsIdentity;
}

export interface IssueMtlsPairOptions {
  readonly validForMs?: number;
  readonly commonNamePrefix?: string;
  readonly hostnames?: readonly string[];
  readonly ipAddresses?: readonly string[];
}

interface EcKeyPair {
  readonly publicKey: KeyObject;
  readonly privateKey: KeyObject;
}

function generateP256(): EcKeyPair {
  return generateKeyPairSync("ec", { namedCurve: "P-256" });
}

function algorithmId(): Uint8Array {
  return derSeq(derOid(OID_ECDSA_SHA256));
}

function nameCn(cn: string): Uint8Array {
  return derSeq(derSet(derSeq(derOid(OID_CN), derUtf8(cn))));
}

function extension(oid: string, critical: boolean, value: Uint8Array): Uint8Array {
  if (critical) {
    return derSeq(derOid(oid), derBool(true), derOctetString(value));
  }
  return derSeq(derOid(oid), derOctetString(value));
}

function basicConstraints(ca: boolean): Uint8Array {
  const body = ca ? derSeq(derBool(true)) : derSeq();
  return extension(OID_BASIC_CONSTRAINTS, true, body);
}

function keyUsage(ca: boolean): Uint8Array {
  // Bit 0 is the high bit of the first byte.
  // CA: keyCertSign (5) + cRLSign (6) → 0x06, 1 unused bit.
  // Leaf: digitalSignature (0) + keyEncipherment (2) → 0xa0, 5 unused bits.
  const bits = ca ? Uint8Array.of(0x06) : Uint8Array.of(0xa0);
  const unused = ca ? 1 : 5;
  return extension(OID_KEY_USAGE, true, derBitString(bits, unused));
}

function extendedKeyUsage(): Uint8Array {
  return extension(
    OID_EXT_KEY_USAGE,
    false,
    derSeq(derOid(OID_SERVER_AUTH), derOid(OID_CLIENT_AUTH)),
  );
}

function parseIpv4(address: string): Uint8Array | undefined {
  const parts = address.split(".");
  if (parts.length !== 4) {
    return undefined;
  }
  const bytes = new Uint8Array(4);
  for (let i = 0; i < 4; i += 1) {
    const n = Number(parts[i]);
    if (!Number.isInteger(n) || n < 0 || n > 255) {
      return undefined;
    }
    bytes[i] = n;
  }
  return bytes;
}

function subjectAltName(hostnames: readonly string[], ipAddresses: readonly string[]): Uint8Array {
  const names: Uint8Array[] = [];
  for (const host of hostnames) {
    names.push(derTlv(0x82, derIa5(host)));
  }
  for (const ip of ipAddresses) {
    const bytes = parseIpv4(ip);
    if (bytes !== undefined) {
      names.push(derTlv(0x87, bytes));
    }
  }
  return extension(OID_SAN, false, derSeq(...names));
}

function randomSerial(): Uint8Array {
  const bytes = new Uint8Array(randomBytes(16));
  bytes[0] = (bytes[0] ?? 0) & 0x7f;
  if (bytes[0] === 0) {
    bytes[0] = 1;
  }
  return bytes;
}

function signTbs(tbs: Uint8Array, issuerKey: KeyObject): Uint8Array {
  const signature = sign("sha256", tbs, { key: issuerKey, dsaEncoding: "der" });
  return derSeq(tbs, algorithmId(), derBitString(signature));
}

function issueCertificate(input: {
  readonly subjectCn: string;
  readonly issuerCn: string;
  readonly subjectKeys: EcKeyPair;
  readonly issuerKey: KeyObject;
  readonly ca: boolean;
  readonly notBefore: Date;
  readonly notAfter: Date;
  readonly hostnames: readonly string[];
  readonly ipAddresses: readonly string[];
}): { readonly pem: string; readonly der: Uint8Array } {
  const spki = new Uint8Array(input.subjectKeys.publicKey.export({ type: "spki", format: "der" }));
  const extensions = input.ca
    ? [basicConstraints(true), keyUsage(true)]
    : [
        basicConstraints(false),
        keyUsage(false),
        extendedKeyUsage(),
        subjectAltName(input.hostnames, input.ipAddresses),
      ];
  const tbs = derSeq(
    derContextExplicit(0, derIntegerNumber(2)),
    derIntegerBytes(randomSerial()),
    algorithmId(),
    nameCn(input.issuerCn),
    derSeq(derUtcTime(input.notBefore), derUtcTime(input.notAfter)),
    nameCn(input.subjectCn),
    spki,
    derContextExplicit(3, derSeq(...extensions)),
  );
  const der = signTbs(tbs, input.issuerKey);
  return { pem: encodePem("CERTIFICATE", der), der };
}

function toIdentity(
  cn: string,
  keys: EcKeyPair,
  cert: { pem: string; der: Uint8Array },
): IssuedTlsIdentity {
  const exported = keys.privateKey.export({ type: "pkcs8", format: "pem" });
  const key = typeof exported === "string" ? exported : exported.toString("utf8");
  return {
    cert: cert.pem,
    key,
    fingerprint: fingerprintCertificateDer(cert.der),
    actorRef: cn,
  };
}

/**
 * Issue a private CA plus two mTLS leaf certificates (serverAuth + clientAuth).
 * Production multi-host deployments should use operator-supplied PEMs; this
 * helper is the real X.509 path for localhost pairs, tests, and private swarms.
 */
export function issueSelfSignedMtlsPair(options: IssueMtlsPairOptions = {}): IssuedMtlsPair {
  const prefix = options.commonNamePrefix ?? "cantilune-mtls";
  const hostnames = options.hostnames ?? ["localhost"];
  const ipAddresses = options.ipAddresses ?? ["127.0.0.1"];
  const validForMs = options.validForMs ?? DEFAULT_VALID_MS;
  const notBefore = new Date(Date.now() - 60_000);
  const notAfter = new Date(Date.now() + validForMs);

  const caKeys = generateP256();
  const aKeys = generateP256();
  const bKeys = generateP256();
  const caCn = `${prefix}-ca`;
  const aCn = `${prefix}-a`;
  const bCn = `${prefix}-b`;

  const caCert = issueCertificate({
    subjectCn: caCn,
    issuerCn: caCn,
    subjectKeys: caKeys,
    issuerKey: caKeys.privateKey,
    ca: true,
    notBefore,
    notAfter,
    hostnames,
    ipAddresses,
  });
  const aCert = issueCertificate({
    subjectCn: aCn,
    issuerCn: caCn,
    subjectKeys: aKeys,
    issuerKey: caKeys.privateKey,
    ca: false,
    notBefore,
    notAfter,
    hostnames,
    ipAddresses,
  });
  const bCert = issueCertificate({
    subjectCn: bCn,
    issuerCn: caCn,
    subjectKeys: bKeys,
    issuerKey: caKeys.privateKey,
    ca: false,
    notBefore,
    notAfter,
    hostnames,
    ipAddresses,
  });

  return {
    ca: toIdentity(caCn, caKeys, caCert),
    a: toIdentity(aCn, aKeys, aCert),
    b: toIdentity(bCn, bKeys, bCert),
  };
}
