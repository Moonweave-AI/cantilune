import {
  ok,
  planDigest,
  type SchemaAdmissionReceipt,
  type SessionId,
  type OperationTemplateRef,
} from "@cantilune/core";
import { type AdmissionReceiptResolver } from "../ports/runtimePorts.js";
import { type AdmissionReconnectPlan } from "../reconnect/admissionReconnectPlan.js";
import { buildAdmissionReconnectPlanDigest } from "../reconnect/reconnectCoordinator.js";
import {
  channelGeneration,
  reconnectRecordId,
  type DescriptorRef,
} from "../foundation/messageId.js";

export function createAdmissionReceiptResolver(): AdmissionReceiptResolver {
  const cache = new Map<string, SchemaAdmissionReceipt>();

  return {
    async resolve(receiptRef) {
      return cache.get(receiptRef);
    },
    buildReconnectPlan(input) {
      const receiptDigest = planDigest(JSON.stringify(input.receipt));
      const metadata = {
        epochId: input.receipt.toBinding.epochId,
        epochOrdinal: input.receipt.toBinding.epochOrdinal,
        bindingGeneration: input.receipt.toBinding.bindingGeneration,
        bindingRef: input.receipt.toBinding,
        operationTemplateRef: input.operationTemplateRef,
        sessionId: input.sessionId,
        correlationId: input.receipt.correlationId,
        occurrenceId: input.receipt.occurrenceId,
        idempotencyKey: input.receipt.idempotencyKey,
      };
      const partial = {
        planId: reconnectRecordId(`reconnect-${input.receipt.admissionId as string}`),
        admissionReceipt: input.receipt,
        admissionReceiptDigest: receiptDigest,
        fromBinding: input.receipt.fromBinding,
        toBinding: input.receipt.toBinding,
        metadata,
        sessionId: input.sessionId,
        operationTemplateRef: input.operationTemplateRef,
        oldEndpointRef: input.oldEndpointRef,
        newEndpointRef: input.newEndpointRef,
        expectedChannelGeneration: channelGeneration(1),
        expectedRuntimeHead: input.receipt.afterSnapshotRef,
        authorizationRef: input.authorizationRef,
        expiresAt: input.expiresAt,
      };
      const plan: AdmissionReconnectPlan = {
        ...partial,
        planDigest: buildAdmissionReconnectPlanDigest(partial),
      };
      cache.set(receiptDigest as string, input.receipt);
      return ok(plan);
    },
  };
}

export function registerAdmissionReceipt(
  resolver: AdmissionReceiptResolver,
  receipt: SchemaAdmissionReceipt,
  receiptRef: string,
): void {
  const extended = resolver as AdmissionReceiptResolver & {
    cache?: Map<string, SchemaAdmissionReceipt>;
  };
  if (extended.cache === undefined) {
    return;
  }
  extended.cache.set(receiptRef, receipt);
}

export type BuildReconnectPlanInput = {
  readonly receipt: SchemaAdmissionReceipt;
  readonly sessionId: SessionId;
  readonly operationTemplateRef: OperationTemplateRef;
  readonly oldEndpointRef: DescriptorRef;
  readonly newEndpointRef: DescriptorRef;
  readonly authorizationRef: string;
  readonly expiresAt: string;
};
