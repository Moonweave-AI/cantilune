/**
 * Integration-style test for the CLI evaluation controller (ADR-0011).
 *
 * Verifies that createEvalController assembles a real EvaluationEngine from
 * the in-memory ports + CLI-local adapters, that the bootstrapped frozen suite
 * is registered, and that the admit → execute → complete path produces a real
 * run + attempt with genuine token accounting from the mocked LLM adapter.
 * Nothing here fabricates a run; the attempt comes from the real engine.
 */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import type { LlmAdapter, LlmChatRequest, LlmChatResponse } from "@cantilune/boot";
import {
  createEvalController,
  buildMinimalSuite,
  buildMinimalPlan,
  buildCandidateSubject,
  buildMinimalBudgetPolicy,
  createLocalRunner,
  createLocalCertificateResolver,
  createCliConformanceCertificateResolver,
  sha256Digest,
  type EvalController,
} from "../../src/wiring/evalControl.js";
import { evaluationSubjectId, benchmarkSuiteId } from "@cantilune/evaluation";
import { type ContentDigest } from "@cantilune/core";
import type { ContentAddressedStore } from "@cantilune/evaluation/ports";
import type { EvaluationResult } from "@cantilune/evaluation";
import { createMemoryContentAddressedStore } from "@cantilune/evaluation/memory";

/* ────────── Stub LLM adapter ────────── */
function createStubAdapter(): LlmAdapter {
  return {
    async chat(_request: LlmChatRequest): Promise<LlmChatResponse> {
      return {
        text: "stub evaluation output",
        toolCalls: [],
        finishReason: "stop",
        usage: { prompt: 12, completion: 8, total: 20 },
      };
    },
  };
}

function createFailingAdapter(message: string): LlmAdapter {
  return {
    async chat(): Promise<LlmChatResponse> {
      throw new Error(message);
    },
  };
}

describe("evalControl — bootstrap helpers", () => {
  it("buildMinimalSuite produces a frozen suite with one case", () => {
    const { suite, case_ } = buildMinimalSuite();
    expect(suite.status).toBe("frozen");
    expect(suite.frozenAt).toBeDefined();
    expect(suite.suiteId as string).toBe("cli-local-smoke");
    expect(case_.caseId as string).toBe("cli-local-smoke-case-1");
    expect(suite.caseManifestRefs).toHaveLength(1);
  });

  it("buildMinimalPlan references the given suite + subject and is frozen", () => {
    const sid = benchmarkSuiteId("cli-local-smoke");
    const sub = evaluationSubjectId("cli-local-candidate");
    const plan = buildMinimalPlan(sid, sub);
    expect(plan.frozenAt).toBeDefined();
    expect(plan.suiteRef).toBe(sid);
    expect(plan.candidateSubjectRef).toBe(sub);
    expect(plan.seeds).toEqual([1]);
    expect(plan.pairedExecution).toBe(false);
  });

  it("buildCandidateSubject has a valid certificate + matching digest", () => {
    const sub = buildCandidateSubject(evaluationSubjectId("cli-local-candidate"));
    expect(sub.subjectKind).toBe("candidate");
    expect(sub.certificateValidity).toBe("valid");
    expect(sub.certificateDigest).toBe(sub.subjectDigest);
    expect(sub.artifactSubject.packageName).toBe("cantilune-cli");
  });

  it("buildMinimalBudgetPolicy allows 100 runs and no cost", () => {
    const policy = buildMinimalBudgetPolicy();
    expect(policy.maxRuns).toBe(100);
    expect(policy.maxTotalCostCents).toBe(0);
    expect(policy.policyDigest).toBeDefined();
  });
});

function isolatedEvalDir(): string {
  return mkdtempSync(join(tmpdir(), "cli-eval-"));
}

function testEvalController(adapter: () => LlmAdapter = createStubAdapter): EvalController {
  const subject = buildCandidateSubject(evaluationSubjectId("cli-local-candidate"));
  return createEvalController(adapter, {
    evalStoreDir: isolatedEvalDir(),
    certificateResolver: createCliConformanceCertificateResolver(
      subject.packageConformanceCertificateRef,
      subject.artifactSubject,
      subject.subjectDigest,
      subject.revocationCheckpoint,
    ),
  });
}

describe("evalControl — real engine path", () => {
  it("TUI default createEvalController is fail-closed (no minted valid cert)", async () => {
    const controller = createEvalController(createStubAdapter, {
      evalStoreDir: isolatedEvalDir(),
    });
    const admit = await controller.engine.admitRun(
      controller.plan,
      controller.subject,
      controller.budgetPolicy,
    );
    expect(admit.ok).toBe(false);
  });

  it("createEvalController registers the suite in the suite registry", async () => {
    const controller: EvalController = testEvalController();
    const suites = await controller.suiteRegistry.listAll();
    expect(suites).toHaveLength(1);
    expect(suites[0]!.suiteId as string).toBe("cli-local-smoke");
  });

  it("admit → execute → complete produces a real run + attempt", async () => {
    const controller: EvalController = testEvalController();
    const admit = await controller.engine.admitRun(
      controller.plan,
      controller.subject,
      controller.budgetPolicy,
    );
    expect(admit.ok).toBe(true);
    if (!admit.ok) return;
    const run = admit.value.run;
    expect(run.status).toBe("admitted");
    expect(run.planRef).toBe(controller.plan.planId);

    const attempt = await controller.engine.executeAttempt(
      run.runId,
      "cli-local-smoke-case-1" as never,
      1,
    );
    expect(attempt.ok).toBe(true);
    if (!attempt.ok) return;
    expect(attempt.value.status).toBe("succeeded");
    expect(attempt.value.terminalDisposition).toBe("succeeded");
    // Genuine token accounting from the stub adapter receipt.
    expect(attempt.value.tokenUsage.totalTokens).toBe(20);
    expect(attempt.value.tokenUsage.inputTokens).toBe(12);
    expect(attempt.value.tokenUsage.outputTokens).toBe(8);
    expect(attempt.value.outputRefs.length).toBeGreaterThan(0);

    const complete = await controller.engine.completeRun(run.runId);
    expect(complete.ok).toBe(true);
    if (!complete.ok) return;
    expect(complete.value.status).toBe("collecting");

    // The run store persists the attempt.
    const attempts = await controller.listAttempts(run.runId);
    expect(attempts).toHaveLength(1);
    expect(attempts[0]!.status).toBe("succeeded");
  });

  it("listRuns returns the persisted run", async () => {
    const controller: EvalController = testEvalController();
    const admit = await controller.engine.admitRun(
      controller.plan,
      controller.subject,
      controller.budgetPolicy,
    );
    if (!admit.ok) throw new Error("admit failed");
    const runs = await controller.listRuns();
    expect(runs).toHaveLength(1);
    expect(runs[0]!.runId).toBe(admit.value.run.runId);
  });

  it("admit rejects a non-frozen plan", async () => {
    const controller: EvalController = testEvalController();
    const unfrozenPlan = { ...controller.plan, frozenAt: undefined };
    const admit = await controller.engine.admitRun(
      unfrozenPlan,
      controller.subject,
      controller.budgetPolicy,
    );
    expect(admit.ok).toBe(false);
    if (admit.ok) return;
    expect(admit.violations.some((v) => v.code === "plan_digest_mismatch")).toBe(true);
  });

  it("admit rejects a subject mismatch", async () => {
    const controller: EvalController = testEvalController();
    const otherSubject = buildCandidateSubject(evaluationSubjectId("different-candidate"));
    const admit = await controller.engine.admitRun(
      controller.plan,
      otherSubject,
      controller.budgetPolicy,
    );
    expect(admit.ok).toBe(false);
    if (admit.ok) return;
    expect(admit.violations.some((v) => v.code === "subject_digest_mismatch")).toBe(true);
  });

  it("executeAttempt on a non-existent run is rejected", async () => {
    const controller: EvalController = testEvalController();
    const attempt = await controller.engine.executeAttempt(
      "nonexistent-run" as never,
      "cli-local-smoke-case-1" as never,
      1,
    );
    expect(attempt.ok).toBe(false);
    if (attempt.ok) return;
    expect(attempt.violations.some((v) => v.code === "invalid_input")).toBe(true);
  });

  it("runner failure surfaces as a failed attempt", async () => {
    const controller: EvalController = testEvalController(() =>
      createFailingAdapter("network down"),
    );
    const admit = await controller.engine.admitRun(
      controller.plan,
      controller.subject,
      controller.budgetPolicy,
    );
    if (!admit.ok) throw new Error("admit failed");
    const attempt = await controller.engine.executeAttempt(
      admit.value.run.runId,
      "cli-local-smoke-case-1" as never,
      1,
    );
    expect(attempt.ok).toBe(false);
    if (attempt.ok) return;
    expect(attempt.violations.some((v) => v.code === "internal_error")).toBe(true);
    // The failed attempt is still persisted.
    const attempts = await controller.listAttempts(admit.value.run.runId);
    expect(attempts).toHaveLength(1);
    expect(attempts[0]!.status).toBe("failed");
  });

  it("completeRun on a non-existent run is rejected", async () => {
    const controller: EvalController = testEvalController();
    const complete = await controller.engine.completeRun("nonexistent" as never);
    expect(complete.ok).toBe(false);
    if (complete.ok) return;
    expect(complete.violations.some((v) => v.code === "invalid_input")).toBe(true);
  });
});

describe("evalControl — local runner adapter", () => {
  const runnerConfig = {
    subjectRef: "subj",
    caseRef: "case-1",
    inputRefs: [],
    seed: 1,
    timeoutMs: 60_000,
    networkPolicy: "deny",
    filesystemPolicy: "deny",
    toolManifest: [],
    environmentRef: "",
  };

  it("produces a RunnerOutput with genuine token accounting", async () => {
    const cas = createMemoryContentAddressedStore();
    const runner = createLocalRunner(createStubAdapter, cas, "candidate");
    const result = await runner.execute(runnerConfig as never);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.tokenUsage.totalTokens).toBe(20);
    expect(result.value.terminalDisposition).toBe("succeeded");
    expect(result.value.outputRefs.length).toBe(1);
    expect(result.value.resultDigest).toBeDefined();
  });

  it("uses input refs in the prompt when provided", async () => {
    const cas = createMemoryContentAddressedStore();
    const runner = createLocalRunner(createStubAdapter, cas, "baseline");
    const result = await runner.execute({ ...runnerConfig, inputRefs: ["in-1", "in-2"] } as never);
    expect(result.ok).toBe(true);
  });

  it("handles an adapter that returns no text or usage", async () => {
    const noTextAdapter: LlmAdapter = {
      async chat() {
        return { text: undefined, toolCalls: [], finishReason: "stop" };
      },
    };
    const cas = createMemoryContentAddressedStore();
    const runner = createLocalRunner(() => noTextAdapter, cas, "candidate");
    const result = await runner.execute(runnerConfig as never);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.tokenUsage.totalTokens).toBe(0);
  });

  it("surfaces a cas.put failure for output as an internal_error", async () => {
    const cas = createFailingCas();
    const runner = createLocalRunner(createStubAdapter, cas, "candidate");
    const result = await runner.execute(runnerConfig as never);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.violations.some((v) => v.code === "internal_error")).toBe(true);
  });

  it("surfaces a cas.put failure for trace as an internal_error", async () => {
    // A CAS whose put fails only on the second call (the trace) so the output
    // put succeeds but the trace put fails.
    let callCount = 0;
    const failingTraceCas: ContentAddressedStore = {
      async put(data: Uint8Array): Promise<EvaluationResult<ContentDigest>> {
        callCount++;
        if (callCount === 1) {
          return createMemoryContentAddressedStore().put(data);
        }
        return {
          ok: false,
          violations: [{ code: "store_write_failed", path: "cas", message: "trace fail" }],
        } as never;
      },
      async get(): Promise<EvaluationResult<Uint8Array>> {
        return { ok: false, violations: [] } as never;
      },
      async has(): Promise<boolean> {
        return false;
      },
    } as unknown as ContentAddressedStore;
    const runner = createLocalRunner(createStubAdapter, failingTraceCas, "candidate");
    const result = await runner.execute(runnerConfig as never);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.violations.some((v) => v.code === "internal_error")).toBe(true);
  });
});

/** A CAS whose put always fails, so the runner's failure branches execute. */
function createFailingCas(): ContentAddressedStore {
  return {
    async put(): Promise<EvaluationResult<ContentDigest>> {
      return {
        ok: false,
        violations: [{ code: "store_write_failed", path: "cas", message: "injected failure" }],
      } as never;
    },
    async get(): Promise<EvaluationResult<Uint8Array>> {
      return { ok: false, violations: [] } as never;
    },
    async has(): Promise<boolean> {
      return false;
    },
  } as unknown as ContentAddressedStore;
}

describe("evalControl — local certificate resolver", () => {
  it("resolves any ref to a valid certificate matching the subject digest", async () => {
    const digest = sha256Digest("test") as ContentDigest;
    const resolver = createLocalCertificateResolver(digest, { allowLocalShim: true });
    const result = await resolver.resolve("any-ref");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("valid");
    expect(result.value.certificateDigest).toBe(digest);
  });

  it("checkValidity always returns valid", async () => {
    const resolver = createLocalCertificateResolver(sha256Digest("x") as ContentDigest, {
      allowLocalShim: true,
    });
    expect(await resolver.checkValidity("any")).toBe("valid");
  });

  it("refuses to construct without the explicit local-mode gate", () => {
    expect(() =>
      createLocalCertificateResolver(sha256Digest("x") as ContentDigest, {
        allowLocalShim: false as unknown as true,
      }),
    ).toThrow(/allowLocalShim/);
  });

  it("checkRevocation always returns false", async () => {
    const resolver = createLocalCertificateResolver(sha256Digest("x") as ContentDigest, {
      allowLocalShim: true,
    });
    expect(await resolver.checkRevocation("any", "now")).toBe(false);
  });
});
