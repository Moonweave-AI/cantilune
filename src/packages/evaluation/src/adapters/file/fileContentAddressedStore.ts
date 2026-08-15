import * as fs from "node:fs/promises";
import * as path from "node:path";
import { contentDigest, type ContentDigest } from "@cantilune/core";
import {
  ok,
  violations,
  violation,
  type EvaluationResult,
} from "../../foundation/evaluationResult.js";
import type { ContentAddressedStore } from "../../ports/stateGovernance.js";

export function createFileContentAddressedStore(baseDir: string): ContentAddressedStore {
  return {
    async put(data: Uint8Array): Promise<EvaluationResult<ContentDigest>> {
      const digest = await computeDigest(data);
      const filePath = digestToPath(baseDir, digest);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, data);

      const written = await fs.readFile(filePath);
      const verifyDigest = await computeDigest(new Uint8Array(written));
      if (verifyDigest !== digest) {
        return violations([
          violation("evidence_digest_mismatch", "cas.put", "Written content digest mismatch"),
        ]);
      }

      return ok(contentDigest(digest));
    },

    async get(digest: ContentDigest): Promise<EvaluationResult<Uint8Array>> {
      const filePath = digestToPath(baseDir, digest);
      try {
        const data = await fs.readFile(filePath);
        const actual = await computeDigest(new Uint8Array(data));
        if (actual !== digest) {
          return violations([
            violation(
              "evidence_digest_mismatch",
              "cas.get",
              `Stored content digest mismatch for ${digest}`,
            ),
          ]);
        }
        return ok(new Uint8Array(data));
      } catch {
        return violations([
          violation("evidence_digest_mismatch", "cas.get", `Content not found: ${digest}`),
        ]);
      }
    },

    async has(digest: ContentDigest): Promise<boolean> {
      const filePath = digestToPath(baseDir, digest);
      try {
        await fs.access(filePath);
        return true;
      } catch {
        return false;
      }
    },
  };
}

function digestToPath(baseDir: string, digest: string): string {
  const prefix = digest.slice(0, 2);
  const rest = digest.slice(2);
  return path.join(baseDir, prefix, rest);
}

async function computeDigest(data: Uint8Array): Promise<string> {
  const hashBuffer = await globalThis.crypto.subtle.digest("SHA-256", data);
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
