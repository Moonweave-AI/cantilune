import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { contentDigest } from "@cantilune/core";
import {
  createEncryptedCredentialStore,
  publishSignedEvaluationReport,
} from "../../src/reports/publishSignedReport.js";
import { createMemoryClaimLedger } from "../../src/adapters/memory/memoryClaimLedger.js";
import type { EvaluationReport } from "../../src/reports/evaluationReport.js";
import {
  aggregateAnalysisId,
  benchmarkSuiteId,
  evaluationClaimId,
  evaluationProtocolId,
  reportId,
} from "../../src/foundation/evaluationIds.js";
import type { ContentDigest } from "@cantilune/core";

const d = (s: string) => s as ContentDigest;

function makeReport(overrides: Partial<EvaluationReport> = {}): EvaluationReport {
  return {
    reportId: reportId("r-sign-1"),
    reportVersion: 1,
    claimRef: evaluationClaimId("c-sign-1"),
    protocolRef: evaluationProtocolId("p1"),
    suiteRef: benchmarkSuiteId("s1"),
    analysisRefs: [aggregateAnalysisId("a1")],
    candidateSubjectDigest: d("csd"),
    baselineSubjectDigests: [d("bsd")],
    evidenceRoot: d("er"),
    summary: {
      claimStatement: "local fixture",
      decisionStatus: "supported",
      primaryEffectEstimate: 0,
      primaryConfidenceInterval: [0, 0],
      populationDescription: "fixture",
      sampleSize: 1,
      baselineDescription: "in-process",
    },
    metricRows: [],
    limitations: ["not a public superiority claim"],
    negativeResults: [],
    status: "approved",
    publishedAt: undefined,
    supersedes: undefined,
    retractionReason: undefined,
    signatureRefs: [],
    reportDigest: contentDigest("report-body"),
    ...overrides,
  };
}

describe("publishSignedEvaluationReport", () => {
  let outputDir: string;

  beforeEach(async () => {
    outputDir = await fs.mkdtemp(path.join(os.tmpdir(), "eval-report-"));
  });

  afterEach(async () => {
    await fs.rm(outputDir, { recursive: true, force: true });
  });

  it("refuses to sign a draft report", async () => {
    const result = await publishSignedEvaluationReport({
      report: makeReport({ status: "draft" }),
      outputDir,
      claimLedger: createMemoryClaimLedger(),
      signingKey: "0123456789abcdef",
    });
    expect(result.ok).toBe(false);
  });

  it("fail-closes without a signing key", async () => {
    const previous = process.env.CANTILUNE_EVAL_CREDENTIAL_KEY;
    delete process.env.CANTILUNE_EVAL_CREDENTIAL_KEY;
    const result = await publishSignedEvaluationReport({
      report: makeReport(),
      outputDir,
      claimLedger: createMemoryClaimLedger(),
    });
    expect(result.ok).toBe(false);
    if (previous === undefined) {
      delete process.env.CANTILUNE_EVAL_CREDENTIAL_KEY;
    } else {
      process.env.CANTILUNE_EVAL_CREDENTIAL_KEY = previous;
    }
  });

  it("writes a signed report and appends the claim ledger", async () => {
    const ledger = createMemoryClaimLedger();
    const result = await publishSignedEvaluationReport({
      report: makeReport(),
      outputDir,
      claimLedger: ledger,
      signingKey: "0123456789abcdef",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const raw = await fs.readFile(result.value.reportPath, "utf8");
    const parsed = JSON.parse(raw) as EvaluationReport;
    expect(parsed.status).toBe("published");
    expect(parsed.signatureRefs.length).toBeGreaterThan(0);
    const history = await ledger.getHistory(makeReport().claimRef);
    expect(history).toHaveLength(1);
    expect(history[0]?.action).toBe("published");
  });
});

describe("createEncryptedCredentialStore", () => {
  let baseDir: string;
  const previous = process.env.CANTILUNE_EVAL_CREDENTIAL_KEY;

  beforeEach(async () => {
    baseDir = await fs.mkdtemp(path.join(os.tmpdir(), "eval-cred-"));
    process.env.CANTILUNE_EVAL_CREDENTIAL_KEY = "0123456789abcdef";
  });

  afterEach(async () => {
    await fs.rm(baseDir, { recursive: true, force: true });
    if (previous === undefined) {
      delete process.env.CANTILUNE_EVAL_CREDENTIAL_KEY;
    } else {
      process.env.CANTILUNE_EVAL_CREDENTIAL_KEY = previous;
    }
  });

  it("round-trips secrets without writing plaintext", async () => {
    const store = createEncryptedCredentialStore(baseDir);
    const put = await store.put("judge-key", "super-secret");
    expect(put.ok).toBe(true);
    const files = await fs.readdir(path.join(baseDir, "credentials"));
    const raw = await fs.readFile(path.join(baseDir, "credentials", files[0]!), "utf8");
    expect(raw).not.toContain("super-secret");
    const got = await store.get("judge-key");
    expect(got.ok).toBe(true);
    if (got.ok) expect(got.value).toBe("super-secret");
  });

  it("rejects invalid aliases and missing keys", async () => {
    const store = createEncryptedCredentialStore(baseDir);
    const badAlias = await store.put("../escape", "x");
    expect(badAlias.ok).toBe(false);
    delete process.env.CANTILUNE_EVAL_CREDENTIAL_KEY;
    const missing = await store.put("ok-alias", "x");
    expect(missing.ok).toBe(false);
  });
});
