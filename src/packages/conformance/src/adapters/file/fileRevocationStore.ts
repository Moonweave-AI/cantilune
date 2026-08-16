import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { RevocationStore } from "../../ports/revocationStore.js";
import { withFileLock } from "./fileLock.js";

const REVOCATION_FILE = "revocation.json";

interface RevocationFilePayload {
  readonly checkpoint: string;
  readonly revokedIds: readonly string[];
}

export interface FileRevocationStore extends RevocationStore {
  /** Persist a revocation so a later process observes it. */
  readonly revoke: (certificateId: string) => void;
}

export interface FileRevocationStoreOptions {
  readonly dir: string;
  readonly checkpoint?: string;
}

function revocationPath(dir: string): string {
  return join(dir, REVOCATION_FILE);
}

function readPayload(dir: string, fallbackCheckpoint: string): RevocationFilePayload {
  const path = revocationPath(dir);
  if (!existsSync(path)) {
    return { checkpoint: fallbackCheckpoint, revokedIds: [] };
  }
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as Partial<RevocationFilePayload>;
    return {
      checkpoint: typeof raw.checkpoint === "string" ? raw.checkpoint : fallbackCheckpoint,
      revokedIds: Array.isArray(raw.revokedIds)
        ? raw.revokedIds.filter((id): id is string => typeof id === "string")
        : [],
    };
  } catch {
    return { checkpoint: fallbackCheckpoint, revokedIds: [] };
  }
}

function writePayload(dir: string, payload: RevocationFilePayload): void {
  writeFileSync(revocationPath(dir), JSON.stringify(payload), "utf8");
}

export function createFileRevocationStore(
  options: FileRevocationStoreOptions,
): FileRevocationStore {
  const { dir, checkpoint = "revocation/m2" } = options;
  mkdirSync(dir, { recursive: true });
  const initial = readPayload(dir, checkpoint);
  const revoked = new Set(initial.revokedIds);
  const resolvedCheckpoint = initial.revokedIds.length > 0 ? initial.checkpoint : checkpoint;

  return {
    checkpoint: resolvedCheckpoint,
    async isRevoked(certificateId: string) {
      return withFileLock(dir, () => {
        const latest = readPayload(dir, resolvedCheckpoint);
        for (const id of latest.revokedIds) revoked.add(id);
        return revoked.has(certificateId);
      });
    },
    revoke(certificateId: string) {
      withFileLock(dir, () => {
        const latest = readPayload(dir, resolvedCheckpoint);
        const nextIds = latest.revokedIds.includes(certificateId)
          ? latest.revokedIds
          : [...latest.revokedIds, certificateId];
        for (const id of nextIds) revoked.add(id);
        writePayload(dir, { checkpoint: resolvedCheckpoint, revokedIds: nextIds });
      });
    },
  };
}
