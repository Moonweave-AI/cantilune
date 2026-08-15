import type { ActivationDomainId, BindingGeneration, PolicyRef, SchemaRef } from "@cantilune/core";
import type { PolicyRevision } from "./policyRevision.js";
import type { AdministrationContext } from "../administration/administrationContext.js";

export interface PolicyActivationReceipt {
  readonly policyRef: PolicyRef;
  readonly compatibleSchemaRefs: readonly SchemaRef[];
  readonly activationDomainId: ActivationDomainId;
  readonly fromBindingGeneration: BindingGeneration;
  readonly toBindingGeneration: BindingGeneration;
  readonly activatedBy: string;
  readonly activatedAt: string;
  readonly storeSequence: number;
}

export interface ActivatePolicyRevisionCommand {
  readonly context: AdministrationContext;
  readonly policyRevision: PolicyRevision;
  readonly activationDomainId: ActivationDomainId;
  readonly expectedBindingGeneration: BindingGeneration;
  readonly activatedAt: string;
}
