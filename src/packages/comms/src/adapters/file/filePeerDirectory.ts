/**
 * File-backed PeerDirectory under a store directory.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { PeerDirectory } from "../../ports/communicationTransport.js";
import type { PeerDescriptor } from "../../peer/peerDescriptor.js";
import type { DescriptorRef } from "../../foundation/messageId.js";
import {
  isSha256Fingerprint,
  normalizeCertificateFingerprint,
} from "../../security/certificateFingerprint.js";

export function createFilePeerDirectory(storeDir: string): PeerDirectory {
  const dir = join(storeDir, "peers");
  mkdirSync(dir, { recursive: true });

  function safeName(ref: string): string {
    return ref.replace(/[^A-Za-z0-9._-]/g, "_");
  }

  function pathFor(ref: string): string {
    return join(dir, `${safeName(ref)}.json`);
  }

  function pinPathFor(ref: string): string {
    return join(dir, `${safeName(ref)}.pins.json`);
  }

  return {
    async resolve(descriptorRef: DescriptorRef) {
      const path = pathFor(descriptorRef as string);
      if (!existsSync(path)) return undefined;
      try {
        return JSON.parse(readFileSync(path, "utf8")) as PeerDescriptor;
      } catch {
        return undefined;
      }
    },
    register(descriptor: PeerDescriptor) {
      writeFileSync(
        pathFor(descriptor.descriptorRef as string),
        JSON.stringify(descriptor),
        "utf8",
      );
    },
    getPinnedFingerprints(peerRef: string) {
      const path = pinPathFor(peerRef);
      if (!existsSync(path)) return [];
      try {
        const raw = JSON.parse(readFileSync(path, "utf8")) as { fingerprints?: unknown };
        if (!Array.isArray(raw.fingerprints)) return [];
        return raw.fingerprints
          .filter(
            (value): value is string => typeof value === "string" && isSha256Fingerprint(value),
          )
          .map((value) => normalizeCertificateFingerprint(value));
      } catch {
        return [];
      }
    },
    setPinnedFingerprints(peerRef: string, fingerprints: readonly string[]) {
      const normalized = fingerprints
        .filter((value) => isSha256Fingerprint(value))
        .map((value) => normalizeCertificateFingerprint(value));
      writeFileSync(pinPathFor(peerRef), JSON.stringify({ fingerprints: normalized }), "utf8");
    },
  };
}
