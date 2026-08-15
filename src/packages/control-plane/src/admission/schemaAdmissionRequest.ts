import type {
  ActivationDomainId,
  BindingGeneration,
  EpochId,
  EpochOrdinal,
  HandlerManifestRef,
  IdempotencyKey,
  PolicyRef,
  SchemaAdmissionId,
  SchemaRef,
  SchemaRevisionId,
  SnapshotRef,
} from "@cantilune/core";
import type { OrchestrationSchema } from "@cantilune/runtime";
import type { SchemaAdmissionState } from "./schemaAdmissionState.js";
import type { SchemaExtensionPlan } from "../schema/monotoneExtensionValidator.js";
import type { AdministrationContext } from "../administration/administrationContext.js";
import type { QualificationEvidence } from "../administration/qualificationEvaluator.js";
import type { AuthorizationEvidence } from "../administration/administrationAuthorizer.js";
import type { VerifiedFourViewEvidence } from "@cantilune/conformance";

export interface SchemaAdmissionRequest {
  readonly admissionId: SchemaAdmissionId;
  readonly activationDomainId: ActivationDomainId;
  readonly expectedBindingGeneration: BindingGeneration;
  readonly expectedSchemaRef: SchemaRef;
  readonly expectedEpochId: EpochId;
  readonly expectedEpochOrdinal: EpochOrdinal;
  readonly expectedRuntimeHead: SnapshotRef;
  readonly candidateSchemaRef: SchemaRef;
  readonly requestedBy: string;
  readonly requestedAt: string;
  readonly reasonRef?: string;
  readonly evidenceRefs?: readonly string[];
  readonly idempotencyKey: IdempotencyKey;
}

export interface SchemaAdmissionRecord {
  readonly request: SchemaAdmissionRequest;
  readonly state: SchemaAdmissionState;
  readonly extensionPlan?: SchemaExtensionPlan;
  readonly targetSchemaRef?: SchemaRef;
  readonly targetEpochId?: EpochId;
  readonly targetEpochOrdinal?: EpochOrdinal;
  readonly targetPolicyRef?: PolicyRef;
  readonly targetHandlerManifestRef?: HandlerManifestRef;
  readonly qualification?: QualificationEvidence;
  readonly authorization?: AuthorizationEvidence;
  readonly fourView?: VerifiedFourViewEvidence;
  readonly updatedAt: string;
}

export interface RegisterSchemaRevisionCommand {
  readonly context: AdministrationContext;
  readonly schema: OrchestrationSchema;
  readonly revisionId: SchemaRevisionId;
  readonly parentRef?: SchemaRef;
  readonly createdAt: string;
}

export interface SubmitSchemaAdmissionCommand {
  readonly context: AdministrationContext;
  readonly request: SchemaAdmissionRequest;
}

export interface ApproveSchemaAdmissionCommand {
  readonly context: AdministrationContext;
  readonly admissionId: SchemaAdmissionId;
}
