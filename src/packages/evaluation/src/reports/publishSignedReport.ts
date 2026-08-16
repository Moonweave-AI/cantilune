import { createHash, createHmac, randomBytes, createCipheriv, createDecipheriv } from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { ContentDigest } from "@cantilune/core";
import { contentDigest } from "@cantilune/core";
import {
  ok,
  violations,
  violation,
  type EvaluationResult,
} from "../foundation/evaluationResult.js";
import type { EvaluationReport } from "../reports/evaluationReport.js";
import { isReportPublished } from "../reports/evaluationReport.js";
import type { ClaimLedger, ClaimLedgerEntry } from "../ports/stateGovernance.js";
import {
  evaluationClaimId,
  type EvaluationClaimId,
  type ReportId,
} from "../foundation/evaluationIds.js";

const ENV_KEY = "CANTILUNE_EVAL_CREDENTIAL_KEY";

export interface SignedReportPublication {
  readonly report: EvaluationReport;
  readonly signature: string;
  readonly signedAt: string;
  readonly reportPath: string;
}

/**
 * Publish a signed EvaluationReport to disk and append a claim-ledger entry.
 * Signature is HMAC-SHA256 over reportDigest using the env credential key.
 */
export async function publishSignedEvaluationReport(options: {
  readonly report: EvaluationReport;
  readonly outputDir: string;
  readonly claimLedger: ClaimLedger;
  readonly signingKey?: string;
}): Promise<EvaluationResult<SignedReportPublication>> {
  const { report, outputDir, claimLedger } = options;
  if (!isReportPublished(report) && report.status !== "approved") {
    return violations([
      violation(
        "report_signature_invalid",
        "report.status",
        `Report must be approved or published before signing (status=${report.status})`,
      ),
    ]);
  }

  const key = options.signingKey ?? process.env[ENV_KEY];
  if (key === undefined || key.length < 16) {
    return violations([
      violation(
        "security_secret_exposure",
        ENV_KEY,
        `${ENV_KEY} must be set (min 16 chars) to sign evaluation reports`,
      ),
    ]);
  }

  const signedAt = new Date().toISOString();
  const signature = createHmac("sha256", key)
    .update(`${report.reportDigest as string}|${signedAt}`)
    .digest("hex");

  const published: EvaluationReport = {
    ...report,
    status: "published",
    publishedAt: report.publishedAt ?? signedAt,
    signatureRefs: [...report.signatureRefs, `hmac-sha256:${signature}`],
  };

  await fs.mkdir(outputDir, { recursive: true });
  const reportPath = path.join(outputDir, `${report.reportId as string}.json`);
  const tmp = `${reportPath}.tmp.${Date.now()}`;
  await fs.writeFile(tmp, JSON.stringify(published, null, 2));
  await fs.rename(tmp, reportPath);

  const history = await claimLedger.getHistory(report.claimRef);
  const previousDigest =
    history.length > 0 ? history[history.length - 1]!.entryDigest : undefined;
  const entryBody = {
    claimRef: report.claimRef,
    action: "published" as const,
    reportId: report.reportId,
    signature,
    signedAt,
  };
  const entryDigest = contentDigest(
    createHash("sha256").update(JSON.stringify(entryBody)).digest("hex"),
  );
  const entry: ClaimLedgerEntry = {
    claimRef: report.claimRef,
    action: "published",
    decision: undefined,
    previousDigest,
    entryDigest,
    timestamp: signedAt,
  };
  const append = await claimLedger.append(entry);
  if (!append.ok) return append as EvaluationResult<SignedReportPublication>;

  return ok({
    report: published,
    signature,
    signedAt,
    reportPath,
  });
}

export interface EncryptedCredentialStore {
  put(alias: string, plaintext: string): Promise<EvaluationResult<void>>;
  get(alias: string): Promise<EvaluationResult<string>>;
  has(alias: string): Promise<boolean>;
}

/**
 * AES-256-GCM encrypted credential store keyed from CANTILUNE_EVAL_CREDENTIAL_KEY
 * (ADR-0011 restricted encrypted store). Never writes plaintext secrets to CAS.
 */
export function createEncryptedCredentialStore(baseDir: string): EncryptedCredentialStore {
  const dir = path.join(baseDir, "credentials");

  function resolveKey(): Buffer | undefined {
    const raw = process.env[ENV_KEY];
    if (raw === undefined || raw.length < 16) return undefined;
    return createHash("sha256").update(raw).digest();
  }

  return {
    async put(alias: string, plaintext: string): Promise<EvaluationResult<void>> {
      if (!/^[a-zA-Z0-9._-]+$/.test(alias)) {
        return violations([violation("invalid_input", "alias", "Invalid credential alias")]);
      }
      const key = resolveKey();
      if (key === undefined) {
        return violations([
          violation(
            "security_secret_exposure",
            ENV_KEY,
            `${ENV_KEY} must be set to use the encrypted credential store`,
          ),
        ]);
      }
      await fs.mkdir(dir, { recursive: true });
      const iv = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", key, iv);
      const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
      const tag = cipher.getAuthTag();
      const payload = JSON.stringify({
        v: 1,
        iv: iv.toString("hex"),
        tag: tag.toString("hex"),
        ct: ciphertext.toString("hex"),
      });
      const target = path.join(dir, `${alias}.enc`);
      const tmp = `${target}.tmp.${Date.now()}`;
      await fs.writeFile(tmp, payload, { mode: 0o600 });
      await fs.rename(tmp, target);
      return ok(undefined);
    },

    async get(alias: string): Promise<EvaluationResult<string>> {
      const key = resolveKey();
      if (key === undefined) {
        return violations([
          violation(
            "security_secret_exposure",
            ENV_KEY,
            `${ENV_KEY} must be set to decrypt credentials`,
          ),
        ]);
      }
      try {
        const raw = await fs.readFile(path.join(dir, `${alias}.enc`), "utf8");
        const parsed = JSON.parse(raw) as { iv: string; tag: string; ct: string };
        const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(parsed.iv, "hex"));
        decipher.setAuthTag(Buffer.from(parsed.tag, "hex"));
        const plaintext = Buffer.concat([
          decipher.update(Buffer.from(parsed.ct, "hex")),
          decipher.final(),
        ]).toString("utf8");
        return ok(plaintext);
      } catch (err) {
        return violations([
          violation(
            "store_read_failed",
            alias,
            `Credential decrypt failed: ${err instanceof Error ? err.message : String(err)}`,
          ),
        ]);
      }
    },

    async has(alias: string): Promise<boolean> {
      try {
        await fs.access(path.join(dir, `${alias}.enc`));
        return true;
      } catch {
        return false;
      }
    },
  };
}

export function evaluationCredentialEnvKey(): string {
  return ENV_KEY;
}

/** @internal helper for tests */
export function claimIdForReport(reportId: ReportId): EvaluationClaimId {
  return evaluationClaimId(`claim-for-${reportId as string}`);
}
