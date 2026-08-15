import { describe, expect, it } from "vitest";
import {
  computeDpoReplayExecutionDigest,
  verifyDpoReplayWithPort,
} from "../../src/verifier/dpoReplayVerifier.js";
import { buildCommittedDpoReplayFixture } from "../support/dpoReplayFixture.js";
import type { RuleOccurrenceSubject } from "../../src/subject/admissionSubject.js";

describe("dpoReplayVerifier", () => {
  it("computeDpoReplayExecutionDigest binds changeCount and endpoints", () => {
    const { t0, changes, recipeChainRef } = buildCommittedDpoReplayFixture();
    const last = changes.at(-1)!;
    const subject: RuleOccurrenceSubject = {
      artifactSubjectRef: "artifact://conformance/1",
      signatureVersion: "sig-v1",
      epochId: "42",
      ruleId: "introduce_artifact",
      occurrenceId: "occ-001",
      beforeSnapshotRef: t0.snapshotRef as string,
      eventRef: changes[0]!.changeId as string,
      afterSnapshotRef: last.afterRef as string,
      replayRecipeRef: recipeChainRef,
    };
    const digest = computeDpoReplayExecutionDigest({
      evidence: {
        recipeRef: recipeChainRef,
        deterministic: true,
        changeCount: changes.length,
        fromSnapshotRef: t0.snapshotRef,
        toSnapshotRef: last.afterRef,
      },
      subject,
    });
    const wrongCount = computeDpoReplayExecutionDigest({
      evidence: {
        recipeRef: recipeChainRef,
        deterministic: true,
        changeCount: changes.length + 1,
        fromSnapshotRef: t0.snapshotRef,
        toSnapshotRef: last.afterRef,
      },
      subject,
    });
    expect(digest).not.toEqual(wrongCount);
  });

  it("accepts runtime DPO replay when evidence binds recipe chain and port succeeds", async () => {
    const { t0, changes, replayPort, recipeChainRef } = buildCommittedDpoReplayFixture();
    const last = changes.at(-1)!;
    const subject: RuleOccurrenceSubject = {
      artifactSubjectRef: "artifact://conformance/1",
      signatureVersion: "sig-v1",
      epochId: "42",
      ruleId: "introduce_artifact",
      occurrenceId: "occ-001",
      beforeSnapshotRef: t0.snapshotRef as string,
      eventRef: changes[0]!.changeId as string,
      afterSnapshotRef: last.afterRef as string,
      replayRecipeRef: recipeChainRef,
    };
    const digest = computeDpoReplayExecutionDigest({
      evidence: {
        recipeRef: recipeChainRef,
        deterministic: true,
        changeCount: changes.length,
        fromSnapshotRef: t0.snapshotRef,
        toSnapshotRef: last.afterRef,
      },
      subject,
    });
    expect(
      await verifyDpoReplayWithPort({
        evidence: {
          recipeRef: recipeChainRef,
          deterministic: true,
          replayDigest: digest,
          fromSnapshotRef: t0.snapshotRef,
          toSnapshotRef: last.afterRef,
          changes,
        },
        subject,
        replayPort,
      }),
    ).toEqual([]);
  });

  it("rejects legacy recipe:// ref for DPO execution", async () => {
    const { t0, changes, replayPort, recipeChainRef } = buildCommittedDpoReplayFixture();
    const last = changes.at(-1)!;
    const subject: RuleOccurrenceSubject = {
      artifactSubjectRef: "artifact://conformance/1",
      signatureVersion: "sig-v1",
      epochId: "42",
      ruleId: "introduce_artifact",
      occurrenceId: "occ-001",
      beforeSnapshotRef: t0.snapshotRef as string,
      eventRef: changes[0]!.changeId as string,
      afterSnapshotRef: last.afterRef as string,
      replayRecipeRef: "recipe://legacy",
    };
    const violations = await verifyDpoReplayWithPort({
      evidence: {
        recipeRef: "recipe://legacy",
        deterministic: true,
        replayDigest: computeDpoReplayExecutionDigest({
          evidence: {
            recipeRef: "recipe://legacy",
            deterministic: true,
            changeCount: changes.length,
            fromSnapshotRef: t0.snapshotRef,
            toSnapshotRef: last.afterRef,
          },
          subject,
        }),
        fromSnapshotRef: t0.snapshotRef,
        toSnapshotRef: last.afterRef,
        changes,
      },
      subject,
      replayPort,
    });
    expect(violations.some((v) => v.message.includes("recipe-chain:sha256"))).toBe(true);
    expect(recipeChainRef.startsWith("recipe-chain:")).toBe(true);
  });

  it("rejects replayDigest that omits changeCount binding", async () => {
    const { t0, changes, replayPort, recipeChainRef } = buildCommittedDpoReplayFixture();
    const last = changes.at(-1)!;
    const subject: RuleOccurrenceSubject = {
      artifactSubjectRef: "artifact://conformance/1",
      signatureVersion: "sig-v1",
      epochId: "42",
      ruleId: "introduce_artifact",
      occurrenceId: "occ-001",
      beforeSnapshotRef: t0.snapshotRef as string,
      eventRef: changes[0]!.changeId as string,
      afterSnapshotRef: last.afterRef as string,
      replayRecipeRef: recipeChainRef,
    };
    const violations = await verifyDpoReplayWithPort({
      evidence: {
        recipeRef: recipeChainRef,
        deterministic: true,
        replayDigest: computeDpoReplayExecutionDigest({
          evidence: {
            recipeRef: recipeChainRef,
            deterministic: true,
            changeCount: 999,
            fromSnapshotRef: t0.snapshotRef,
            toSnapshotRef: last.afterRef,
          },
          subject,
        }),
        fromSnapshotRef: t0.snapshotRef,
        toSnapshotRef: last.afterRef,
        changes,
      },
      subject,
      replayPort,
    });
    expect(violations.some((v) => v.code === "digest_mismatch")).toBe(true);
  });

  it("rejects snapshot mismatch and replay port failures", async () => {
    const { t0, changes, recipeChainRef } = buildCommittedDpoReplayFixture();
    const last = changes.at(-1)!;
    const subject: RuleOccurrenceSubject = {
      artifactSubjectRef: "artifact://conformance/1",
      signatureVersion: "sig-v1",
      epochId: "42",
      ruleId: "introduce_artifact",
      occurrenceId: "occ-001",
      beforeSnapshotRef: t0.snapshotRef as string,
      eventRef: changes[0]!.changeId as string,
      afterSnapshotRef: last.afterRef as string,
      replayRecipeRef: recipeChainRef,
    };
    const digest = computeDpoReplayExecutionDigest({
      evidence: {
        recipeRef: recipeChainRef,
        deterministic: true,
        changeCount: changes.length,
        fromSnapshotRef: t0.snapshotRef,
        toSnapshotRef: last.afterRef,
      },
      subject,
    });
    expect(
      (
        await verifyDpoReplayWithPort({
          evidence: {
            recipeRef: recipeChainRef,
            deterministic: true,
            replayDigest: digest,
            fromSnapshotRef: t0.snapshotRef,
            toSnapshotRef: last.afterRef,
            changes,
          },
          subject,
          replayPort: {
            async execute() {
              return {
                ok: true,
                value: { terminalSnapshotRef: "snap-wrong" as never, stepCount: changes.length },
              };
            },
          },
        })
      ).some((v) => v.code === "replay_failed"),
    ).toBe(true);

    expect(
      (
        await verifyDpoReplayWithPort({
          evidence: {
            recipeRef: recipeChainRef,
            deterministic: true,
            replayDigest: digest,
            fromSnapshotRef: t0.snapshotRef,
            toSnapshotRef: last.afterRef,
            changes,
          },
          subject,
          replayPort: {
            async execute() {
              return {
                ok: true,
                value: { terminalSnapshotRef: last.afterRef, stepCount: changes.length - 1 },
              };
            },
          },
        })
      ).some((v) => v.message.includes("step count")),
    ).toBe(true);
  });
});
