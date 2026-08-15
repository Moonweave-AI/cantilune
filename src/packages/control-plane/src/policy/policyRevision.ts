import {
  policyRef,
  type ContentDigest,
  type PolicyId,
  type PolicyRef,
  type PolicyRevisionId,
  type SchemaRef,
} from "@cantilune/core";
import { digestOfCanonical } from "../schema/schemaDigest.js";
import type { PolicyEvaluator } from "@cantilune/runtime";

export type PolicyDecision = "allow" | "deny";

export interface PolicyRule {
  readonly ruleId: string;
  readonly principalRole?: string;
  readonly operationTypeId?: string;
  readonly templateRevision?: string;
  readonly decision: PolicyDecision;
}

export interface PolicyRevision {
  readonly policyRef: PolicyRef;
  readonly compatibleSchemaRefs: readonly SchemaRef[];
  readonly rules: readonly PolicyRule[];
  readonly defaultDecision: "deny";
  readonly canonicalDigest: ContentDigest;
  readonly createdBy: string;
  readonly createdAt: string;
}

function ownDataProperty<Value>(source: object, key: PropertyKey): Value {
  const descriptor = Object.getOwnPropertyDescriptor(source, key);
  if (descriptor === undefined || !("value" in descriptor)) {
    throw new TypeError(`Expected own policy data property ${String(key)}`);
  }
  return descriptor.value as Value;
}

function optionalOwnDataProperty<Value>(source: object, key: PropertyKey): Value | undefined {
  const descriptor = Object.getOwnPropertyDescriptor(source, key);
  if (descriptor === undefined) return undefined;
  if (!("value" in descriptor)) {
    throw new TypeError(`Expected optional policy data property ${String(key)}`);
  }
  return descriptor.value as Value;
}

function snapshotSchemaRef(ref: SchemaRef): SchemaRef {
  if (ref === null || typeof ref !== "object" || Array.isArray(ref)) {
    throw new TypeError("Expected policy-compatible schema ref object");
  }
  return Object.freeze({
    schemaId: ownDataProperty<SchemaRef["schemaId"]>(ref, "schemaId"),
    revisionId: ownDataProperty<SchemaRef["revisionId"]>(ref, "revisionId"),
    digest: ownDataProperty<SchemaRef["digest"]>(ref, "digest"),
  });
}

function snapshotPolicyRule(rule: PolicyRule): PolicyRule {
  if (rule === null || typeof rule !== "object" || Array.isArray(rule)) {
    throw new TypeError("Expected policy rule object");
  }
  const ruleId = ownDataProperty<unknown>(rule, "ruleId");
  const principalRole = optionalOwnDataProperty<unknown>(rule, "principalRole");
  const operationTypeId = optionalOwnDataProperty<unknown>(rule, "operationTypeId");
  const templateRevision = optionalOwnDataProperty<unknown>(rule, "templateRevision");
  const decision = ownDataProperty<unknown>(rule, "decision");
  if (
    typeof ruleId !== "string" ||
    ruleId === "" ||
    (principalRole !== undefined && typeof principalRole !== "string") ||
    (operationTypeId !== undefined && typeof operationTypeId !== "string") ||
    (templateRevision !== undefined && typeof templateRevision !== "string") ||
    (decision !== "allow" && decision !== "deny")
  ) {
    throw new TypeError("Invalid policy rule");
  }
  return Object.freeze({
    ruleId,
    ...(principalRole === undefined ? {} : { principalRole }),
    ...(operationTypeId === undefined ? {} : { operationTypeId }),
    ...(templateRevision === undefined ? {} : { templateRevision }),
    decision,
  });
}

/** Detach and freeze every policy authority field at an ingress/egress boundary. */
export function snapshotPolicyRevision(revision: PolicyRevision): PolicyRevision {
  if (revision === null || typeof revision !== "object" || Array.isArray(revision)) {
    throw new TypeError("Expected policy revision object");
  }
  const policyRefValue = ownDataProperty<PolicyRef>(revision, "policyRef");
  const compatibleSchemaRefs = ownDataProperty<readonly SchemaRef[]>(
    revision,
    "compatibleSchemaRefs",
  );
  const rules = ownDataProperty<readonly PolicyRule[]>(revision, "rules");
  const defaultDecision = ownDataProperty<unknown>(revision, "defaultDecision");
  if (
    policyRefValue === null ||
    typeof policyRefValue !== "object" ||
    Array.isArray(policyRefValue) ||
    !Array.isArray(compatibleSchemaRefs) ||
    !Array.isArray(rules) ||
    defaultDecision !== "deny"
  ) {
    throw new TypeError("Invalid policy revision");
  }
  return Object.freeze({
    policyRef: Object.freeze({
      policyId: ownDataProperty<PolicyRef["policyId"]>(policyRefValue, "policyId"),
      revisionId: ownDataProperty<PolicyRef["revisionId"]>(policyRefValue, "revisionId"),
      digest: ownDataProperty<PolicyRef["digest"]>(policyRefValue, "digest"),
    }),
    compatibleSchemaRefs: Object.freeze(compatibleSchemaRefs.map(snapshotSchemaRef)),
    rules: Object.freeze(rules.map(snapshotPolicyRule)),
    defaultDecision,
    canonicalDigest: ownDataProperty<ContentDigest>(revision, "canonicalDigest"),
    createdBy: ownDataProperty<string>(revision, "createdBy"),
    createdAt: ownDataProperty<string>(revision, "createdAt"),
  });
}

export function verifyPolicyRevisionIntegrity(revision: PolicyRevision): boolean {
  try {
    const snapshot = snapshotPolicyRevision(revision);
    const digest = digestOfCanonical({
      policyId: snapshot.policyRef.policyId,
      revisionId: snapshot.policyRef.revisionId,
      compatibleSchemaRefs: snapshot.compatibleSchemaRefs,
      rules: snapshot.rules,
      defaultDecision: snapshot.defaultDecision,
    });
    return digest === snapshot.canonicalDigest && snapshot.policyRef.digest === digest;
  } catch {
    return false;
  }
}

export function createPolicyRevision(input: {
  readonly policyId: PolicyId;
  readonly revisionId: PolicyRevisionId;
  readonly compatibleSchemaRefs: readonly SchemaRef[];
  readonly rules: readonly PolicyRule[];
  readonly createdBy: string;
  readonly createdAt: string;
}): PolicyRevision {
  const canonicalDigest = digestOfCanonical({
    policyId: input.policyId,
    revisionId: input.revisionId,
    compatibleSchemaRefs: input.compatibleSchemaRefs,
    rules: input.rules,
    defaultDecision: "deny",
  });
  return snapshotPolicyRevision({
    policyRef: policyRef(input.policyId, input.revisionId, canonicalDigest),
    compatibleSchemaRefs: input.compatibleSchemaRefs,
    rules: input.rules,
    defaultDecision: "deny",
    canonicalDigest,
    createdBy: input.createdBy,
    createdAt: input.createdAt,
  });
}

export function createPolicyEvaluatorFromRevision(revision: PolicyRevision): PolicyEvaluator {
  const policy = snapshotPolicyRevision(revision);
  if (!verifyPolicyRevisionIntegrity(policy)) {
    throw new TypeError("policy_revision_integrity_violation");
  }
  return {
    evaluate({ intent, template }) {
      const principalRole = template.requiredRoles[0];
      const decision = evaluatePolicyRevision(policy, {
        operationTypeId: intent.operationTypeId as string,
        ...(principalRole !== undefined ? { principalRole } : {}),
      });
      if (decision === "allow") {
        return { kind: "allow", authorization: [] };
      }
      return { kind: "deny", reason: "control_plane_policy_denied" };
    },
  };
}

export function evaluatePolicyRevision(
  revision: PolicyRevision,
  context: { readonly operationTypeId?: string; readonly principalRole?: string },
): PolicyDecision {
  for (const rule of revision.rules) {
    if (rule.principalRole !== undefined && rule.principalRole !== context.principalRole) {
      continue;
    }
    if (rule.operationTypeId !== undefined && rule.operationTypeId !== context.operationTypeId) {
      continue;
    }
    return rule.decision;
  }
  return revision.defaultDecision;
}
