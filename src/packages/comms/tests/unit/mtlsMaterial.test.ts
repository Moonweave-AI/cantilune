import { describe, expect, it } from "vitest";
import { X509Certificate, createPublicKey } from "node:crypto";
import { issueSelfSignedMtlsPair } from "../../src/security/mtlsMaterial.js";
import {
  concatBytes,
  derBool,
  derOid,
  derIntegerBytes,
  derIntegerNumber,
  encodeDerLength,
  encodePem,
} from "../../src/security/x509/der.js";

describe("issueSelfSignedMtlsPair", () => {
  it("issues a CA and two leaves that Node can parse and verify", () => {
    const pair = issueSelfSignedMtlsPair({ commonNamePrefix: "unit-mtls" });
    const ca = new X509Certificate(pair.ca.cert);
    const leafA = new X509Certificate(pair.a.cert);
    const leafB = new X509Certificate(pair.b.cert);
    expect(ca.ca).toBe(true);
    expect(leafA.checkIssued(ca)).toBe(true);
    expect(leafB.checkIssued(ca)).toBe(true);
    expect(leafA.verify(createPublicKey(pair.ca.cert))).toBe(true);
    expect(leafB.verify(createPublicKey(pair.ca.cert))).toBe(true);
    expect(pair.a.fingerprint).not.toBe(pair.b.fingerprint);
    expect(pair.a.key.includes("PRIVATE KEY")).toBe(true);
  });

  it("skips malformed IP SANs and still issues a usable pair", () => {
    const pair = issueSelfSignedMtlsPair({
      ipAddresses: ["not-an-ip", "1.2.3", "256.0.0.1", "127.0.0.1"],
      hostnames: ["localhost"],
    });
    const leaf = new X509Certificate(pair.a.cert);
    expect(leaf.checkIP("127.0.0.1")).toBe("127.0.0.1");
  });

  it("embeds localhost and 127.0.0.1 in the leaf SAN", () => {
    const pair = issueSelfSignedMtlsPair();
    const leaf = new X509Certificate(pair.a.cert);
    expect(leaf.checkHost("localhost")).toBe("localhost");
    expect(leaf.checkIP("127.0.0.1")).toBe("127.0.0.1");
  });
});

describe("DER encoder branches", () => {
  it("encodes short, 0x81, and 0x82 lengths", () => {
    expect(Array.from(encodeDerLength(10))).toEqual([10]);
    expect(Array.from(encodeDerLength(200))).toEqual([0x81, 200]);
    expect(Array.from(encodeDerLength(300))).toEqual([0x82, 1, 44]);
  });

  it("rejects negative and oversized lengths", () => {
    expect(() => encodeDerLength(-1)).toThrow("non-negative");
    expect(() => encodeDerLength(70_000)).toThrow("65535");
  });

  it("encodes multi-byte OID arcs and high-bit integers", () => {
    const oid = derOid("1.2.840.10045.4.3.2");
    expect(oid[0]).toBe(0x06);
    const high = derIntegerBytes(Uint8Array.of(0xff, 0x01));
    expect(high[2]).toBe(0x00);
    expect(derIntegerNumber(2)[2]).toBe(2);
    expect(() => derIntegerNumber(-1)).toThrow("0..255");
    expect(() => derOid("not-an-oid")).toThrow("invalid OID");
  });

  it("encodes false booleans and empty PEM bodies", () => {
    expect(Array.from(derBool(false))).toEqual([0x01, 0x01, 0x00]);
    expect(encodePem("X", new Uint8Array()).includes("BEGIN X")).toBe(true);
    expect(concatBytes(Uint8Array.of(1), Uint8Array.of(2))[1]).toBe(2);
    expect(derOid("2.5")[0]).toBe(0x06);
  });

  it("strips leading zeros from integers and keeps a zero value", () => {
    const stripped = derIntegerBytes(Uint8Array.of(0, 0, 5));
    expect(Array.from(stripped)).toEqual([0x02, 0x01, 0x05]);
    const zero = derIntegerBytes(new Uint8Array());
    expect(Array.from(zero)).toEqual([0x02, 0x01, 0x00]);
  });
});
