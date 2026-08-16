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
  A2A_PROFILE_V1,
  A2A_PROTOCOL_VERSION_V1,
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
  resolveCommsHmacKey,
  createHmacKeyResolver,
  COMMS_HMAC_KEY_ENV,
  COMMS_HMAC_KEY_FILE,
} from "./security/hmacKeyMaterial.js";
export { composeProductionIdentityVerifier } from "./security/composeProductionIdentity.js";
export {
  rotateEndpointPin,
  type RotateEndpointPinInput,
  type EndpointPinRotation,
} from "./security/identityRotation.js";
export {
  transferChannelCapability,
  type TransferChannelCapabilityInput,
  type ChannelCapabilityTransfer,
} from "./security/typedMobility.js";
export { assertVerifiedEnvelope, sealVerifiedEnvelope } from "./security/commsCapability.js";
export { createProcessEStopGate } from "./adapters/process/processEStopGate.js";
export {
  createProcessEventSink,
  type ProcessEventSink,
} from "./adapters/process/processEventSink.js";
export { createProcessReplayProtector } from "./adapters/process/processReplayProtector.js";
export { createFilePeerDirectory } from "./adapters/file/filePeerDirectory.js";
export { createFileFreshAllocator } from "./adapters/file/fileFreshAllocator.js";
export type { CommunicationTransport, PeerDirectory } from "./ports/communicationTransport.js";
export type {
  RuntimeObservationPort,
  RuntimeCommitPort,
  QuiescenceProbe,
  SessionAuthority,
  EventSink,
} from "./ports/runtimePorts.js";
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

export {
  NetTransport,
  createNetTransportPair,
  connectNetTransportPair,
  type NetTransportOptions,
  type NetTransportPairOptions,
  type NetListenAddress,
} from "./transports/net/netTransport.js";
export { NET_TLS_MIN_VERSION, type NetTransportTlsMaterial } from "./transports/net/netTls.js";
export {
  createFileEndpointIdentityVerifier,
  writeFileEndpointIdentity,
  readFileEndpointIdentity,
  resolveStoreOwner,
  fileEndpointIdentityPath,
  type FileEndpointIdentityRecord,
  type FileEndpointIdentityInput,
} from "./security/fileEndpointIdentity.js";
export {
  createMtlsEndpointIdentityVerifier,
  type EndpointIdentityVerifier,
  type EndpointIdentityInput,
  type EndpointIdentityVerification,
  type MtlsEndpointIdentityVerifierOptions,
} from "./security/endpointIdentityVerifier.js";
export {
  fingerprintCertificatePem,
  fingerprintCertificateDer,
  fingerprintsEqual,
  normalizeCertificateFingerprint,
} from "./security/certificateFingerprint.js";
export {
  issueSelfSignedMtlsPair,
  type IssuedMtlsPair,
  type IssuedTlsIdentity,
} from "./security/mtlsMaterial.js";
export {
  runA2AConformanceHarness,
  A2A_CONFORMANCE_CASE_IDS,
  type A2AConformanceReport,
  type A2AConformanceHarnessInput,
} from "./conformance/a2aConformanceHarness.js";
export {
  replayDeadLetter,
  type DlqReplayAuthorization,
  type DlqReplayResult,
} from "./recovery/dlqAuthorizedReplay.js";
export {
  A2ATransportAdapter,
  createHttpA2AFrameHandlers,
  type A2ATransportAdapterOptions,
} from "./transports/a2a/index.js";
export {
  parseA2AAgentCard,
  parseA2ASecurityScheme,
  agentInterfaceFromPeerEndpoint,
  isA2AProtocolBinding,
  A2A_AGENT_CARD_WELL_KNOWN_PATH,
  A2A_JSON_CONTENT_TYPE,
  A2A_PROTOCOL_BINDINGS,
  type A2AAgentCard,
  type A2AAgentInterface,
  type A2AAgentCapabilities,
  type A2AAgentSkill,
  type A2AProtocolBinding,
} from "./transports/a2a/v1/agentCard.js";
export {
  parseA2AMessage,
  parseA2APart,
  parseA2ASendMessageRequest,
  a2aProtocolError,
  a2aErrorReason,
  isA2ARole,
  type A2AMessage,
  type A2APart,
  type A2ARole,
  type A2ASendMessageRequest,
  type A2AProtocolError,
  type A2AErrorName,
} from "./transports/a2a/v1/a2aMessage.js";
export {
  parseA2ATask,
  parseA2AArtifact,
  parseA2AStreamResponse,
  parseA2AGetTaskRequest,
  parseA2AListTasksRequest,
  parseA2ACancelTaskRequest,
  applyA2AHistoryLength,
  isA2ATaskState,
  isA2ATerminalTaskState,
  isA2AInterruptedTaskState,
  isA2ACancelableTaskState,
  A2A_TASK_STATES,
  A2A_TERMINAL_TASK_STATES,
  type A2ATask,
  type A2ATaskState,
  type A2AArtifact,
  type A2AStreamResponse,
  type A2AListTasksRequest,
  type A2AListTasksResponse,
} from "./transports/a2a/v1/a2aTask.js";
export {
  A2AOperationEngine,
  dispatchA2AOperation,
  parseA2AServiceParameters,
  assertA2AVersionSupported,
  normalizeA2AVersion,
  type A2AOperationName,
  type A2AOperationEngineOptions,
  type A2AServiceParameters,
  type A2APushNotificationConfig,
  type A2ASendMessageResult,
  type A2ATaskProcessor,
} from "./transports/a2a/v1/a2aOperations.js";
export {
  handleA2AJsonRpc,
  encodeA2AJsonRpcRequest,
  decodeA2AJsonRpcRequest,
  encodeA2AJsonRpcSuccess,
  encodeA2AJsonRpcError,
  decodeA2AJsonRpcResponse,
  a2aJsonRpcErrorCode,
  isA2AJsonRpcMethod,
  A2A_JSONRPC_METHODS,
  A2A_JSONRPC_VERSION,
  type A2AJsonRpcMethod,
  type A2AJsonRpcRequest,
  type A2AJsonRpcResponse,
} from "./transports/a2a/v1/a2aJsonRpcBinding.js";
export {
  handleA2ARestRequest,
  matchA2ARestRoute,
  parseA2ARestQuery,
  encodeA2ARestError,
  a2aRestStatus,
  A2A_REST_ROUTES,
  A2A_REST_CONTENT_TYPE,
  type A2ARestRequest,
  type A2ARestResponse,
} from "./transports/a2a/v1/a2aRestBinding.js";
export {
  encodeA2ASseEvent,
  encodeA2ASseStream,
  decodeA2ASseStream,
  a2aStreamKind,
  A2A_SSE_CONTENT_TYPE,
} from "./transports/a2a/v1/a2aSseBinding.js";
export {
  createA2AGrpcService,
  invokeA2AGrpc,
  encodeA2AGrpcRequest,
  decodeA2AGrpcRequest,
  encodeA2AGrpcResponse,
  decodeA2AGrpcResponse,
  mapA2AErrorToGrpcStatus,
  isA2AGrpcMethod,
  grpcMetadataToServiceParameters,
  A2A_GRPC_SERVICE_NAME,
  A2A_GRPC_METHODS,
  type A2AGrpcService,
  type A2AGrpcFrame,
  type A2AGrpcMethod,
} from "./transports/a2a/v1/a2aGrpcBinding.js";
export {
  createA2AGrpcServer,
  createA2AGrpcClient,
  loadA2AGrpcPackage,
  officialA2AGrpcMethodNames,
  a2aProtoFile,
  a2aProtoRootDir,
  A2A_GRPC_PROTO_SERVICE_NAME,
  A2A_GRPC_PROTO_PACKAGE,
  A2A_GRPC_PROTO_METHODS,
  type A2AGrpcServer,
  type A2AGrpcClient,
  type A2AGrpcListenOptions,
  type A2AGrpcClientOptions,
} from "./transports/a2a/v1/a2aGrpcJs.js";
export {
  protoMessageToJson,
  jsonToProtoMessage,
  timestampToIso,
  isoToTimestamp,
  objectToStruct,
  structToObject,
} from "./transports/a2a/v1/a2aProtoJson.js";
