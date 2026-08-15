export {
  createCommsReconnectService,
  type CommsReconnectService,
  type CommsReconnectServiceDeps,
  type InstanceReconnectRequest,
  type InstanceReconnectReceipt,
  type ReconnectHandoffContext,
} from "./reconnect/reconnectHandoff.js";

export {
  createCommsServices,
  executeAdmissionReconnect,
  buildReconnectPlanFromReceipt,
  type CommsServices,
  type CommsServicesDeps,
} from "./engine/createCommsServices.js";

export {
  ReconnectCoordinator,
  buildAdmissionReconnectPlanDigest,
} from "./reconnect/reconnectCoordinator.js";
export { createAdmissionReceiptResolver } from "./reconnect/admissionReceiptResolver.js";
export type {
  AdmissionReconnectPlan,
  AdmissionReconnectReceipt,
  ReconnectCoordinatorRecord,
  ReconnectCoordinatorState,
} from "./reconnect/admissionReconnectPlan.js";

export { CommsIngress } from "./engine/commsIngress.js";
export { CommsPeerService } from "./engine/commsPeerService.js";
export { CommsSessionService } from "./engine/commsSessionService.js";
export { CommsMessagingService } from "./engine/commsMessagingService.js";
export { CommsMobilityService } from "./engine/commsMobilityService.js";
export {
  CloseCoordinator,
  CommsAdministrationService,
  CommsQueryService,
} from "./close/closeCoordinator.js";

export {
  deriveOperationFamily,
  resolveOperationBinding,
  isCommunicationOperationCode,
  ALL_OPERATION_CODES,
  type CommunicationOperationCode,
  type CommunicationOperationFamily,
  type CommunicationOperationBinding,
} from "./protocol/communicationOperationRegistry.js";
export type { CommunicationOccurrenceRecord } from "./protocol/communicationOccurrenceRecord.js";
export type { NativeCommunicationAction } from "./protocol/nativeCommunicationAction.js";

export type {
  PeerDescriptor,
  PeerEndpoint,
  PeerCompatibilityResult,
} from "./peer/peerDescriptor.js";
export type {
  AuthenticatedPeerContext,
  AuthenticatedCommsContext,
} from "./peer/authenticatedPeerContext.js";
export type { NegotiatedProtocol } from "./peer/negotiatedProtocol.js";

export type {
  CommunicationEnvelope,
  VerifiedEnvelope,
  AckMode,
} from "./envelope/communicationEnvelope.js";
export type { PayloadDescriptor } from "./envelope/payloadDescriptor.js";

export type {
  SessionTransportBinding,
  SessionHandshake,
} from "./session/sessionTransportBinding.js";

export type {
  DeliveryRecord,
  DeliveryAcknowledgement,
  RetryPolicy,
  DeadLetterRecord,
} from "./delivery/deliveryRecord.js";

export type {
  EndpointDelegationPlan,
  EndpointDelegationReceipt,
  FreshEndpointAllocation,
} from "./mobility/endpointDelegation.js";

export type {
  QuiescentClosePlan,
  QuiescentCloseReceipt,
  ForceCloseRecord,
} from "./close/quiescentClosePlan.js";

export {
  commsViolation,
  isCommsViolation,
  type CommsViolation,
  type CommsViolationCode,
} from "./foundation/commsViolation.js";
export {
  COMMS_LIMITS,
  COMMS_WIRE_VERSION_V1,
  COMMS_REGISTRY_VERSION_V1,
  A2A_PROFILE_PINNED,
} from "./foundation/commsLimits.js";
export type { StableCommunicationMetadata } from "./foundation/stableCommunicationMetadata.js";
export type {
  CommunicationProtocolPhase,
  OccurrenceLifecycle,
  EndpointDisposition,
  TransportDeliveryState,
  DeliveryAckLevel,
} from "./foundation/communicationStateAxes.js";

export {
  messageId,
  channelId,
  connectionId,
  descriptorRef,
  wireVersion,
  registryVersion,
  type MessageId,
  type ChannelId,
  type DescriptorRef,
} from "./foundation/messageId.js";

export {
  parseCommunicationWireFrame,
  encodeCommunicationWireFrame,
  digestCommunicationFrame,
  computeEnvelopeIntegrityDigest,
  verifyEnvelopeIntegrityDigest,
} from "./codec/strictWireCodec.js";

export {
  HmacIdentityVerifier,
  createHmacBindingMaterial,
} from "./security/hmacIdentityVerifier.js";
export {
  allowlistEndpointPolicy,
  denylistEndpointPolicy,
  denyByDefaultEndpointPolicy,
  permissiveEndpointPolicy,
  matchEndpointPattern,
  PermissiveEndpointPolicy,
} from "./security/endpointPolicy.js";
export { denyByDefaultAuthorizer } from "./security/denyByDefaultAuthorizer.js";
export type {
  EndpointPolicy,
  CommsAuthorizer,
  IdentityVerifier,
  EStopGate,
  ReplayProtector,
} from "./security/identityVerifier.js";
export {
  ObservabilityCommsEventBridge,
  createObservabilityCommsEventSink,
  createObservabilityCommsEventBridge,
} from "./observability/commsEventBridge.js";
export { createRuntimeCommsPorts, type RuntimeCommsPorts } from "./integration/index.js";

export type { CommsStore, CommsSnapshot } from "./ports/commsStore.js";
export type { CommsEventEnvelope, CommsEventKind } from "./events/commsEvent.js";

export {
  FileTransport,
  connectFileTransportPair,
  type FileTransportOptions,
} from "./transports/file/fileTransport.js";
