import {
  type CorrelationId,
  type OccurrenceId,
  type OperationTemplateRef,
  type SchemaAdmissionReceipt,
  type SessionId,
  type EpochId,
  type EpochOrdinal,
} from "@cantilune/core";
import { type DescriptorRef } from "../foundation/messageId.js";
import { type AdmissionReconnectReceipt } from "../reconnect/admissionReconnectPlan.js";
import {
  buildReconnectPlanFromReceipt,
  createCommsServices,
  executeAdmissionReconnect,
  type CommsServices,
  type CommsServicesDeps,
} from "../engine/createCommsServices.js";

/** @deprecated Use AdmissionReconnectPlan — kept for transitional API compatibility. */
export interface ReconnectHandoffContext {
  readonly targetEpochId: EpochId;
  readonly targetEpochOrdinal: EpochOrdinal;
  readonly operationTemplateRef: OperationTemplateRef;
  readonly sessionId: SessionId;
  readonly correlationId: CorrelationId;
  readonly occurrenceId: OccurrenceId;
}

/** @deprecated Use AdmissionReconnectPlan + descriptorRef. */
export interface InstanceReconnectRequest {
  readonly handoff: ReconnectHandoffContext; // NOSONAR — transitional API self-reference
  readonly peerDescriptorRef: string;
  readonly admissionReceipt?: SchemaAdmissionReceipt;
}

export interface InstanceReconnectReceipt {
  readonly sessionId: SessionId;
  readonly correlationId: CorrelationId;
  readonly occurrenceId: OccurrenceId;
  readonly reconnectedAt: string;
  readonly planDigest?: string;
  readonly storeSequence?: number;
}

export interface CommsReconnectService {
  instanceReconnect(request: InstanceReconnectRequest): Promise<InstanceReconnectReceipt>; // NOSONAR — transitional API self-reference
}

export type CommsReconnectServiceDeps = { readonly services: CommsServices } | CommsServicesDeps;

export function createCommsReconnectService(
  deps: CommsReconnectServiceDeps,
): CommsReconnectService {
  const services = "services" in deps ? deps.services : createCommsServices(deps);

  return {
    async instanceReconnect(request) {
      if (request.admissionReceipt === undefined) {
        throw new Error("admission receipt required — legacy echo reconnect removed");
      }
      const planResult = buildReconnectPlanFromReceipt({
        resolver: services.receiptResolver,
        receipt: request.admissionReceipt,
        sessionId: request.handoff.sessionId,
        operationTemplateRef: request.handoff.operationTemplateRef,
        oldEndpointRef: request.peerDescriptorRef as DescriptorRef,
        newEndpointRef: request.peerDescriptorRef as DescriptorRef,
      });
      if (!planResult.ok) {
        throw new Error(planResult.error.message);
      }
      const committed = await executeAdmissionReconnect({ services, plan: planResult.value });
      if (!committed.ok) {
        throw new Error(committed.error.message);
      }
      return toInstanceReceipt(request, committed.value);
    },
  };
}

function toInstanceReceipt(
  request: InstanceReconnectRequest, // NOSONAR — transitional API self-reference
  receipt: AdmissionReconnectReceipt,
): InstanceReconnectReceipt {
  return {
    sessionId: request.handoff.sessionId,
    correlationId: request.handoff.correlationId,
    occurrenceId: request.handoff.occurrenceId,
    reconnectedAt: receipt.committedAt,
    planDigest: receipt.planDigest as string,
    storeSequence: receipt.storeSequence as number,
  };
}

export type { CommsServices, CommsServicesDeps };
