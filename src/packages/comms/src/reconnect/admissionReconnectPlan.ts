import {
  type PlanDigest,
  type SchemaAdmissionReceipt,
  type SchemaEpochBinding,
  type SessionId,
  type SnapshotRef,
  type OperationTemplateRef,
} from "@cantilune/core";
import {
  type DescriptorRef,
  type ReconnectRecordId,
  type ChannelGeneration,
  type CommsStoreSequence,
} from "../foundation/messageId.js";
import { type StableCommunicationMetadata } from "../foundation/stableCommunicationMetadata.js";

/** Binds authoritative admission receipt to session/rule/endpoint seam (ADR-0004 option 2). */
export interface AdmissionReconnectPlan {
  readonly planId: ReconnectRecordId;
  readonly admissionReceipt: SchemaAdmissionReceipt;
  readonly admissionReceiptDigest: PlanDigest;
  readonly fromBinding: SchemaEpochBinding;
  readonly toBinding: SchemaEpochBinding;
  readonly metadata: StableCommunicationMetadata;
  readonly sessionId: SessionId;
  readonly operationTemplateRef: OperationTemplateRef;
  readonly oldEndpointRef: DescriptorRef;
  readonly newEndpointRef: DescriptorRef;
  readonly expectedChannelGeneration: ChannelGeneration;
  readonly expectedRuntimeHead: SnapshotRef;
  readonly authorizationRef: string;
  readonly planDigest: PlanDigest;
  readonly expiresAt: string;
}

export type ReconnectCoordinatorState =
  | "proposed"
  | "validated"
  | "authorized"
  | "prepared"
  | "peerAccepted"
  | "runtimeCommitted"
  | "bindingSwitched"
  | "oldChannelDraining"
  | "completed"
  | "failed"
  | "recoveryRequired";

export interface AdmissionReconnectReceipt {
  readonly planId: ReconnectRecordId;
  readonly planDigest: PlanDigest;
  readonly runtimeReceiptRef?: string;
  readonly storeSequence: CommsStoreSequence;
  readonly newChannelGeneration: ChannelGeneration;
  readonly committedAt: string;
}

export interface ReconnectCoordinatorRecord {
  readonly plan: AdmissionReconnectPlan;
  readonly state: ReconnectCoordinatorState;
  readonly peerAckDigest?: string;
  readonly runtimeReceiptRef?: string;
  readonly updatedAt: string;
}
