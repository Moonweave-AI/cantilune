import {
  activationDomainId,
  bindingGeneration,
  epochId,
  epochOrdinal,
  err,
  idempotencyKey,
  policyId,
  policyRevisionId,
  schemaAdmissionId,
  schemaDigest,
  schemaId,
  schemaRevisionId,
  schemaRef,
  snapshotRef,
  type Result,
} from "@cantilune/core";
import type { AdministrationContext } from "../administration/administrationContext.js";
import {
  controlPlaneViolation,
  type ControlPlaneViolation,
} from "../errors/controlPlaneViolation.js";
import type { ActivatePolicyRevisionCommand } from "../policy/policyActivation.js";
import type {
  ApproveSchemaAdmissionCommand,
  RegisterSchemaRevisionCommand,
  SchemaAdmissionRequest,
  SubmitSchemaAdmissionCommand,
} from "../admission/schemaAdmissionRequest.js";
import {
  decodeOrchestrationSchema,
  type WireOrchestrationSchema,
} from "../schema/schemaWireCodec.js";
import { createPolicyRevision } from "../policy/policyRevision.js";
import { rejectUnknownKeys, requireNumber, requireObject, requireString } from "./wireHelpers.js";

const SCHEMA_REF_KEYS = ["schemaId", "revisionId", "digest"] as const;

function parseSchemaRef(
  value: unknown,
  path: string,
): Result<ReturnType<typeof schemaRef>, ControlPlaneViolation> {
  const object = requireObject(value, path);
  if (!object.ok) {
    return object;
  }
  const keys = rejectUnknownKeys(object.value, [...SCHEMA_REF_KEYS], path);
  if (!keys.ok) {
    return keys;
  }
  const schemaIdValue = requireString(object.value, "schemaId", path);
  if (!schemaIdValue.ok) {
    return schemaIdValue;
  }
  const revisionId = requireString(object.value, "revisionId", path);
  if (!revisionId.ok) {
    return revisionId;
  }
  const digest = requireString(object.value, "digest", path);
  if (!digest.ok) {
    return digest;
  }
  return {
    ok: true,
    value: schemaRef(
      schemaId(schemaIdValue.value),
      schemaRevisionId(revisionId.value),
      schemaDigest(digest.value),
    ),
  };
}

export function decodeSubmitSchemaAdmissionWire(
  wire: unknown,
  context: AdministrationContext,
): Result<SubmitSchemaAdmissionCommand, ControlPlaneViolation> {
  const root = requireObject(wire, "submit");
  if (!root.ok) {
    return root;
  }
  const allowed = [
    "admissionId",
    "activationDomainId",
    "expectedBindingGeneration",
    "expectedSchemaRef",
    "expectedEpochId",
    "expectedEpochOrdinal",
    "expectedRuntimeHead",
    "candidateSchemaRef",
    "requestedBy",
    "requestedAt",
    "idempotencyKey",
    "reasonRef",
    "evidenceRefs",
  ];
  const keys = rejectUnknownKeys(root.value, allowed, "submit");
  if (!keys.ok) {
    return keys;
  }
  const admissionId = requireString(root.value, "admissionId", "submit");
  if (!admissionId.ok) {
    return admissionId;
  }
  const domainId = requireString(root.value, "activationDomainId", "submit");
  if (!domainId.ok) {
    return domainId;
  }
  const generation = requireNumber(root.value, "expectedBindingGeneration", "submit");
  if (!generation.ok) {
    return generation;
  }
  const expectedSchemaRef = parseSchemaRef(
    root.value.expectedSchemaRef,
    "submit.expectedSchemaRef",
  );
  if (!expectedSchemaRef.ok) {
    return expectedSchemaRef;
  }
  const expectedEpochId = requireString(root.value, "expectedEpochId", "submit");
  if (!expectedEpochId.ok) {
    return expectedEpochId;
  }
  const expectedEpochOrdinal = requireNumber(root.value, "expectedEpochOrdinal", "submit");
  if (!expectedEpochOrdinal.ok) {
    return expectedEpochOrdinal;
  }
  const expectedRuntimeHead = requireString(root.value, "expectedRuntimeHead", "submit");
  if (!expectedRuntimeHead.ok) {
    return expectedRuntimeHead;
  }
  const candidateSchemaRef = parseSchemaRef(
    root.value.candidateSchemaRef,
    "submit.candidateSchemaRef",
  );
  if (!candidateSchemaRef.ok) {
    return candidateSchemaRef;
  }
  const requestedBy = requireString(root.value, "requestedBy", "submit");
  if (!requestedBy.ok) {
    return requestedBy;
  }
  const requestedAt = requireString(root.value, "requestedAt", "submit");
  if (!requestedAt.ok) {
    return requestedAt;
  }
  const idem = requireString(root.value, "idempotencyKey", "submit");
  if (!idem.ok) {
    return idem;
  }
  const request: SchemaAdmissionRequest = {
    admissionId: schemaAdmissionId(admissionId.value),
    activationDomainId: activationDomainId(domainId.value),
    expectedBindingGeneration: bindingGeneration(generation.value),
    expectedSchemaRef: expectedSchemaRef.value,
    expectedEpochId: epochId(expectedEpochId.value),
    expectedEpochOrdinal: epochOrdinal(expectedEpochOrdinal.value),
    expectedRuntimeHead: snapshotRef(expectedRuntimeHead.value),
    candidateSchemaRef: candidateSchemaRef.value,
    requestedBy: requestedBy.value,
    requestedAt: requestedAt.value,
    idempotencyKey: idempotencyKey(idem.value),
  };
  return { ok: true, value: { context, request } };
}

export function decodeApproveSchemaAdmissionWire(
  wire: unknown,
  context: AdministrationContext,
): Result<ApproveSchemaAdmissionCommand, ControlPlaneViolation> {
  const root = requireObject(wire, "approve");
  if (!root.ok) {
    return root;
  }
  const keys = rejectUnknownKeys(root.value, ["admissionId"], "approve");
  if (!keys.ok) {
    return keys;
  }
  const admissionId = requireString(root.value, "admissionId", "approve");
  if (!admissionId.ok) {
    return admissionId;
  }
  return {
    ok: true,
    value: { context, admissionId: schemaAdmissionId(admissionId.value) },
  };
}

export function decodeRegisterSchemaRevisionWire(
  wire: unknown,
  context: AdministrationContext,
): Result<RegisterSchemaRevisionCommand, ControlPlaneViolation> {
  const root = requireObject(wire, "register");
  if (!root.ok) {
    return root;
  }
  const keys = rejectUnknownKeys(
    root.value,
    ["schema", "revisionId", "parentRef", "createdAt"],
    "register",
  );
  if (!keys.ok) {
    return keys;
  }
  const schemaWire = requireObject(root.value.schema, "register.schema");
  if (!schemaWire.ok) {
    return schemaWire;
  }
  const schemaKeys = rejectUnknownKeys(
    schemaWire.value,
    ["schemaId", "wireVersion", "objectTypes", "operationTypes", "templates", "resourceRules"],
    "register.schema",
  );
  if (!schemaKeys.ok) {
    return schemaKeys;
  }
  const revisionId = requireString(root.value, "revisionId", "register");
  if (!revisionId.ok) {
    return revisionId;
  }
  const createdAt = requireString(root.value, "createdAt", "register");
  if (!createdAt.ok) {
    return createdAt;
  }
  const schema = decodeOrchestrationSchema({
    schemaId: typeof schemaWire.value.schemaId === "string" ? schemaWire.value.schemaId : "",
    wireVersion: Number(schemaWire.value.wireVersion),
    objectTypes: schemaWire.value.objectTypes as WireOrchestrationSchema["objectTypes"],
    operationTypes: schemaWire.value.operationTypes as WireOrchestrationSchema["operationTypes"],
    templates: schemaWire.value.templates as WireOrchestrationSchema["templates"],
    resourceRules: schemaWire.value.resourceRules as WireOrchestrationSchema["resourceRules"],
  });
  let parentRef: RegisterSchemaRevisionCommand["parentRef"];
  if (root.value.parentRef !== undefined) {
    const parsed = parseSchemaRef(root.value.parentRef, "register.parentRef");
    if (!parsed.ok) {
      return parsed;
    }
    parentRef = parsed.value;
  }
  return {
    ok: true,
    value: {
      context,
      schema,
      revisionId: schemaRevisionId(revisionId.value),
      createdAt: createdAt.value,
      ...(parentRef !== undefined ? { parentRef } : {}),
    },
  };
}

export function decodeActivatePolicyRevisionWire(
  wire: unknown,
  context: AdministrationContext,
): Result<ActivatePolicyRevisionCommand, ControlPlaneViolation> {
  const root = requireObject(wire, "activatePolicy");
  if (!root.ok) {
    return root;
  }
  const keys = rejectUnknownKeys(
    root.value,
    [
      "policyId",
      "revisionId",
      "activationDomainId",
      "expectedBindingGeneration",
      "compatibleSchemaRefs",
      "rules",
      "createdBy",
      "createdAt",
      "activatedAt",
    ],
    "activatePolicy",
  );
  if (!keys.ok) {
    return keys;
  }
  const pid = requireString(root.value, "policyId", "activatePolicy");
  if (!pid.ok) {
    return pid;
  }
  const rev = requireString(root.value, "revisionId", "activatePolicy");
  if (!rev.ok) {
    return rev;
  }
  const domainId = requireString(root.value, "activationDomainId", "activatePolicy");
  if (!domainId.ok) {
    return domainId;
  }
  const generation = requireNumber(root.value, "expectedBindingGeneration", "activatePolicy");
  if (!generation.ok) {
    return generation;
  }
  const createdBy = requireString(root.value, "createdBy", "activatePolicy");
  if (!createdBy.ok) {
    return createdBy;
  }
  const createdAt = requireString(root.value, "createdAt", "activatePolicy");
  if (!createdAt.ok) {
    return createdAt;
  }
  const activatedAt = requireString(root.value, "activatedAt", "activatePolicy");
  if (!activatedAt.ok) {
    return activatedAt;
  }
  if (!Array.isArray(root.value.compatibleSchemaRefs) || !Array.isArray(root.value.rules)) {
    return err(
      controlPlaneViolation("invalid_input", "validate", "rules and compatibleSchemaRefs required"),
    );
  }
  const compatibleSchemaRefs: ReturnType<typeof schemaRef>[] = [];
  for (let index = 0; index < root.value.compatibleSchemaRefs.length; index += 1) {
    const parsed = parseSchemaRef(
      root.value.compatibleSchemaRefs[index],
      `activatePolicy.compatibleSchemaRefs[${index}]`,
    );
    if (!parsed.ok) {
      return parsed;
    }
    compatibleSchemaRefs.push(parsed.value);
  }
  const rules = root.value.rules as ActivatePolicyRevisionCommand["policyRevision"]["rules"];
  const policyRevision = createPolicyRevision({
    policyId: policyId(pid.value),
    revisionId: policyRevisionId(rev.value),
    compatibleSchemaRefs,
    rules,
    createdBy: createdBy.value,
    createdAt: createdAt.value,
  });
  return {
    ok: true,
    value: {
      context,
      policyRevision,
      activationDomainId: activationDomainId(domainId.value),
      expectedBindingGeneration: bindingGeneration(generation.value),
      activatedAt: activatedAt.value,
    },
  };
}
