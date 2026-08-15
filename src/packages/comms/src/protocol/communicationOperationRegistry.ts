import { type HandlerManifestRef, type OperationTemplateRef } from "@cantilune/core";
import { type RegistryVersion, registryVersion } from "../foundation/messageId.js";

/** Closed registry of native communication operation codes (P1c 60-item audit set). */
export type CommunicationOperationCode =
  | "send"
  | "sendPrefix"
  | "asyncSend"
  | "syncSend"
  | "quiescentSend"
  | "boundOutput"
  | "receive"
  | "receivePrefix"
  | "boundInput"
  | "syncReceive"
  | "quiescentReceive"
  | "comm"
  | "commData"
  | "commChannel"
  | "parLeft"
  | "parRight"
  | "parComm"
  | "fork"
  | "join"
  | "parZero"
  | "quiescentComm"
  | "parAssocLeft"
  | "parAssocRight"
  | "parSymmetry"
  | "scopeOpen"
  | "scopeClose"
  | "scopeExtrusion"
  | "scopeIntrusion"
  | "scopeReordering"
  | "scopeUnused"
  | "delegation"
  | "handoff"
  | "reconnectDelegation"
  | "reconnectHandoff"
  | "choiceLeft"
  | "choiceRight"
  | "choiceComm"
  | "choiceZero"
  | "choiceAssocLeft"
  | "choiceAssocRight"
  | "choiceSymmetry"
  | "tauPrefix"
  | "zeroElim"
  | "contextSwitch"
  | "stateSnapshot"
  | "eventLog"
  | "matchEqTrue"
  | "matchNeFalse"
  | "matchEqFalse"
  | "matchNeTrue"
  | "mismatch"
  | "guardedMismatch"
  | "mismatchGuarded"
  | "mismatchReport"
  | "newChannel"
  | "reconnect"
  | "delete"
  | "quiescentDelete"
  | "deleteWithCleanup"
  | "deleteImmediate";

/** Fifteen canonical π families — derived from operationCode, never caller-supplied. */
export type CommunicationOperationFamily =
  | "freeOutput"
  | "boundOutput"
  | "lateInput"
  | "communication"
  | "openClose"
  | "restriction"
  | "scopeExtrusion"
  | "delegation"
  | "choiceLeft"
  | "choiceRight"
  | "matchSuccess"
  | "mismatchGuard"
  | "dynamicPartnerAdmission"
  | "instanceReconnect"
  | "instanceDeleteQuiescent";

export interface CommunicationOperationBinding {
  readonly registryVersion: RegistryVersion;
  readonly operationCode: CommunicationOperationCode;
  readonly operationTemplateRef: OperationTemplateRef;
  readonly codecRef: string;
  readonly handlerManifestRef: HandlerManifestRef;
  readonly protocolVersion: string;
  readonly family: CommunicationOperationFamily;
}

const FAMILY_BY_CODE: Record<CommunicationOperationCode, CommunicationOperationFamily> = {
  send: "freeOutput",
  sendPrefix: "freeOutput",
  asyncSend: "freeOutput",
  syncSend: "freeOutput",
  quiescentSend: "freeOutput",
  boundOutput: "boundOutput",
  receive: "lateInput",
  receivePrefix: "lateInput",
  boundInput: "lateInput",
  syncReceive: "lateInput",
  quiescentReceive: "lateInput",
  comm: "communication",
  commData: "communication",
  commChannel: "communication",
  parLeft: "communication",
  parRight: "communication",
  parComm: "communication",
  fork: "communication",
  join: "communication",
  parZero: "communication",
  quiescentComm: "communication",
  parAssocLeft: "communication",
  parAssocRight: "communication",
  parSymmetry: "communication",
  scopeOpen: "openClose",
  scopeClose: "restriction",
  scopeExtrusion: "scopeExtrusion",
  scopeIntrusion: "scopeExtrusion",
  scopeReordering: "scopeExtrusion",
  scopeUnused: "scopeExtrusion",
  delegation: "delegation",
  handoff: "delegation",
  reconnectDelegation: "delegation",
  reconnectHandoff: "delegation",
  choiceLeft: "choiceLeft",
  choiceComm: "choiceLeft",
  choiceZero: "choiceLeft",
  choiceAssocLeft: "choiceLeft",
  choiceAssocRight: "choiceLeft",
  choiceSymmetry: "choiceLeft",
  tauPrefix: "choiceLeft",
  zeroElim: "choiceLeft",
  contextSwitch: "choiceLeft",
  stateSnapshot: "choiceLeft",
  eventLog: "choiceLeft",
  choiceRight: "choiceRight",
  matchEqTrue: "matchSuccess",
  matchNeFalse: "matchSuccess",
  matchEqFalse: "mismatchGuard",
  matchNeTrue: "mismatchGuard",
  mismatch: "mismatchGuard",
  guardedMismatch: "mismatchGuard",
  mismatchGuarded: "mismatchGuard",
  mismatchReport: "mismatchGuard",
  newChannel: "dynamicPartnerAdmission",
  reconnect: "instanceReconnect",
  delete: "instanceDeleteQuiescent",
  quiescentDelete: "instanceDeleteQuiescent",
  deleteWithCleanup: "instanceDeleteQuiescent",
  deleteImmediate: "instanceDeleteQuiescent",
};

export function deriveOperationFamily(
  code: CommunicationOperationCode,
): CommunicationOperationFamily {
  return FAMILY_BY_CODE[code];
}

export function isCommunicationOperationCode(value: string): value is CommunicationOperationCode {
  return Object.hasOwn(FAMILY_BY_CODE, value);
}

export function resolveOperationBinding(input: {
  readonly operationCode: CommunicationOperationCode;
  readonly operationTemplateRef: OperationTemplateRef;
  readonly codecRef: string;
  readonly handlerManifestRef: HandlerManifestRef;
  readonly protocolVersion: string;
  readonly registryVersion?: RegistryVersion;
}): CommunicationOperationBinding {
  return {
    registryVersion: input.registryVersion ?? registryVersion(1),
    operationCode: input.operationCode,
    operationTemplateRef: input.operationTemplateRef,
    codecRef: input.codecRef,
    handlerManifestRef: input.handlerManifestRef,
    protocolVersion: input.protocolVersion,
    family: deriveOperationFamily(input.operationCode),
  };
}

export const ALL_OPERATION_CODES = Object.keys(FAMILY_BY_CODE) as CommunicationOperationCode[];
