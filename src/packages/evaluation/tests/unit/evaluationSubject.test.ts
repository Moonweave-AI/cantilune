import { describe, it, expect } from "vitest";
import {
  isCandidate,
  isBaseline,
  isCandidateCertificateValid,
} from "../../src/subjects/evaluationSubject.js";
import type { CandidateSubject, BaselineSubject } from "../../src/subjects/evaluationSubject.js";
import { evaluationSubjectId } from "../../src/foundation/evaluationIds.js";
import type { ContentDigest } from "@cantilune/core";

const d = (s: string) => s as ContentDigest;

const candidate: CandidateSubject = {
  subjectId: evaluationSubjectId("s1"),
  subjectKind: "candidate",
  packageConformanceCertificateRef: "cert-1",
  certificateDigest: d("cd"),
  artifactSubject: {
    packageName: "@cantilune/core",
    packageVersion: "0.0.1",
    commitSha: "abc",
    treeDigest: d("td"),
    artifactDigest: d("ad"),
    lockfileDigest: d("ld"),
    toolchainDigest: d("tcd"),
    buildProvenanceDigest: d("bpd"),
  },
  packageConfigurationRef: "config-1",
  schemaBindingRef: "schema-1",
  policyRef: "policy-1",
  runtimeConfigRef: "runtime-1",
  controlPlaneConfigRef: "cp-1",
  commsConfigRef: "comms-1",
  adapterBuild: "build-1",
  adapterDigest: d("adapter-d"),
  certificateValidity: "valid",
  revocationCheckpoint: "checkpoint-1",
  subjectDigest: d("subject-d"),
};

const baseline: BaselineSubject = {
  subjectId: evaluationSubjectId("s2"),
  subjectKind: "baseline",
  productName: "cursor",
  productVersion: "1.0",
  commitOrServiceVersion: "v1.0.0",
  artifactDigest: undefined,
  adapterVersion: "1.0",
  adapterDigest: d("ba"),
  modelConfig: "gpt-4",
  providerConfig: "openai",
  toolConfig: "default",
  promptConfig: "default",
  policyConfig: "default",
  capabilityManifest: ["read", "write"],
  licenseOrTos: "MIT",
  versionVerifiedAt: "2026-01-01",
  knownLimitations: ["no replay"],
  provenanceUnavailable: false,
  subjectDigest: d("bs"),
};

describe("EvaluationSubject", () => {
  it("discriminates candidate", () => {
    expect(isCandidate(candidate)).toBe(true);
    expect(isCandidate(baseline)).toBe(false);
  });

  it("discriminates baseline", () => {
    expect(isBaseline(baseline)).toBe(true);
    expect(isBaseline(candidate)).toBe(false);
  });

  it("checks candidate certificate validity", () => {
    expect(isCandidateCertificateValid(candidate)).toBe(true);
    const revoked: CandidateSubject = { ...candidate, certificateValidity: "revoked" };
    expect(isCandidateCertificateValid(revoked)).toBe(false);
  });
});
