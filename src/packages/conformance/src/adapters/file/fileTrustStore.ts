import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { TrustRootEntry, TrustStore } from "../../ports/trustStore.js";

const TRUST_FILE = "trust.json";

interface TrustFilePayload {
  readonly version: string;
  readonly roots: readonly TrustRootEntry[];
}

function trustPath(dir: string): string {
  return join(dir, TRUST_FILE);
}

function readTrustFile(dir: string): TrustFilePayload {
  const path = trustPath(dir);
  if (!existsSync(path)) {
    return { version: "trust/m2", roots: [] };
  }
  const raw = JSON.parse(readFileSync(path, "utf8")) as TrustFilePayload;
  return {
    version: typeof raw.version === "string" ? raw.version : "trust/m2",
    roots: Array.isArray(raw.roots) ? raw.roots : [],
  };
}

export interface FileTrustStoreOptions {
  readonly dir: string;
  readonly version?: string;
}

export function createFileTrustStore(options: FileTrustStoreOptions): TrustStore {
  const { dir, version = "trust/m2" } = options;
  mkdirSync(dir, { recursive: true });
  const path = trustPath(dir);
  if (!existsSync(path)) {
    writeFileSync(path, JSON.stringify({ version, roots: [] }), "utf8");
  }
  const payload = readTrustFile(dir);

  return {
    version: payload.version,
    getRoots(scope: string) {
      return payload.roots.filter((root) => root.scope.includes(scope));
    },
  };
}
