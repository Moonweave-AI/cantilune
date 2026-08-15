import {
  type Result,
  ok,
  type SchemaAdmissionReceipt,
  type SchemaEpochBinding,
  type ActivationDomainId,
  type SessionId,
  type OperationTemplateRef,
} from "@cantilune/core";
import { MemoryCommsStore } from "../memory/memoryCommsStore.js";
import { CommsIngress } from "./commsIngress.js";
import { CommsPeerService } from "./commsPeerService.js";
import { CommsSessionService } from "./commsSessionService.js";
import { CommsMessagingService } from "./commsMessagingService.js";
import { CommsMobilityService } from "./commsMobilityService.js";
import {
  CommsAdministrationService,
  CommsQueryService,
  CloseCoordinator,
} from "../close/closeCoordinator.js";
import { ReconnectCoordinator } from "../reconnect/reconnectCoordinator.js";
import { createAdmissionReceiptResolver } from "../reconnect/admissionReceiptResolver.js";
import { LoopbackTransport } from "../memory/loopbackTransport.js";
import { OutboxDispatcher } from "../recovery/outboxDispatcher.js";
import { DeliveryRecovery } from "../recovery/deliveryRecovery.js";
import { ReconnectRecovery } from "../recovery/reconnectRecovery.js";
import { SessionReconciler } from "../recovery/sessionReconciler.js";
import { MessagingSagaCoordinator } from "../recovery/messagingSagaCoordinator.js";
import {
  type CommunicationTransport,
  type MessageConsumer,
} from "../ports/communicationTransport.js";
import {
  createObservabilityCommsEventSink,
  ObservabilityCommsEventBridge,
} from "../observability/commsEventBridge.js";
import { type CommsStore } from "../ports/commsStore.js";
import { createFileCommsStore } from "../file/fileCommsStore.js";
import { testRuntimeCommitPort } from "./testRuntimeCommitPort.js";
import { denyByDefaultAuthorizer } from "../security/denyByDefaultAuthorizer.js";
import {
  denyByDefaultEndpointPolicy,
  permissiveEndpointPolicy,
} from "../security/endpointPolicy.js";
import {
  type IdentityVerifier,
  type CommsAuthorizer,
  type ReplayProtector,
  type EndpointPolicy,
} from "../security/identityVerifier.js";
import {
  type RuntimeObservationPort,
  type AdmissionReceiptResolver,
  type SessionAuthority,
  type RuntimeCommitPort,
  type QuiescenceProbe,
} from "../ports/runtimePorts.js";
import { commsViolation, type CommsViolation } from "../foundation/commsViolation.js";
import {
  descriptorRef,
  channelId,
  channelGeneration,
  type DescriptorRef,
} from "../foundation/messageId.js";
import {
  type AdmissionReconnectPlan,
  type AdmissionReconnectReceipt,
} from "../reconnect/admissionReconnectPlan.js";
import { type CommsEventEnvelope } from "../events/commsEvent.js";
import { type PeerDescriptor } from "../peer/peerDescriptor.js";
import { type FreshEndpointAllocation } from "../mobility/endpointDelegation.js";

class MemoryEStopGate {
  private frozen = false;
  isFrozen(): boolean {
    return this.frozen;
  }
  setFrozen(frozen: boolean): void {
    this.frozen = frozen;
  }
}

class MemoryEventSink {
  readonly events: CommsEventEnvelope[] = [];
  emit(event: CommsEventEnvelope): void {
    this.events.push(event);
  }
}

class MemoryReplayProtector {
  private readonly seen = new Set<string>();
  checkReplay(input: { readonly messageDigest: string }): Result<void, CommsViolation> {
    if (this.seen.has(input.messageDigest)) {
      return {
        ok: false,
        error: commsViolation("replay_detected", "ingress", "duplicate frame digest"),
      };
    }
    return ok(undefined);
  }
  recordSeen(digest: string): void {
    this.seen.add(digest);
  }
}

class MemoryPeerDirectory {
  private readonly peers = new Map<string, PeerDescriptor>();
  resolve(ref: DescriptorRef) {
    return Promise.resolve(this.peers.get(ref as string));
  }
  register(descriptor: PeerDescriptor): void {
    this.peers.set(descriptor.descriptorRef as string, descriptor);
  }
}

class MemoryFreshAllocator {
  private counter = 0;
  allocate(): Result<FreshEndpointAllocation, CommsViolation> {
    this.counter += 1;
    return ok({
      endpointRef: descriptorRef(`endpoint-fresh-${this.counter}`),
      channelId: channelId(`channel-fresh-${this.counter}`),
      channelGeneration: channelGeneration(1),
      allocatedAt: new Date().toISOString(),
    });
  }
}

export interface CommsServices {
  readonly store: CommsStore;
  readonly ingress: CommsIngress;
  readonly peer: CommsPeerService;
  readonly session: CommsSessionService;
  readonly messaging: CommsMessagingService;
  readonly mobility: CommsMobilityService;
  readonly admin: CommsAdministrationService;
  readonly query: CommsQueryService;
  readonly reconnect: ReconnectCoordinator;
  readonly close: CloseCoordinator;
  readonly receiptResolver: AdmissionReceiptResolver;
  readonly events: MemoryEventSink;
  readonly transport: CommunicationTransport;
  readonly recovery: {
    readonly outbox: OutboxDispatcher;
    readonly delivery: DeliveryRecovery;
    readonly reconnect: ReconnectRecovery;
    readonly session: SessionReconciler;
  };
  readonly messagingSaga: MessagingSagaCoordinator;
  readonly observabilityBridge: ObservabilityCommsEventBridge;
}

export interface CommsServicesDeps {
  /** `test` enables in-memory defaults; `production` requires real security/runtime ports. */
  readonly mode?: "test" | "production";
  readonly endpointPolicy?: EndpointPolicy;
  readonly bindingResolver: {
    getActiveBinding(domainId: ActivationDomainId): SchemaEpochBinding | undefined;
  };
  readonly sessionAuthority: SessionAuthority;
  readonly runtimeCommit?: RuntimeCommitPort;
  readonly quiescence: QuiescenceProbe;
  readonly clock?: { now(): string };
  readonly transport?: CommunicationTransport;
  readonly storeDir?: string;
  readonly observation?: RuntimeObservationPort;
  readonly identity?: IdentityVerifier;
  readonly authorizer?: CommsAuthorizer;
  readonly replay?: ReplayProtector;
  readonly runtimeConsumer?: MessageConsumer;
}

export function createCommsServices(deps: CommsServicesDeps): CommsServices {
  const mode = deps.mode ?? "production";
  if (
    mode === "production" &&
    (deps.runtimeCommit === undefined ||
      deps.observation === undefined ||
      deps.identity === undefined ||
      deps.authorizer === undefined)
  ) {
    throw new Error(
      "createCommsServices(production) requires identity, authorizer, observation, and runtimeCommit",
    );
  }

  const memory = new MemoryCommsStore();
  const store: CommsStore =
    deps.storeDir !== undefined ? createFileCommsStore(deps.storeDir, memory) : memory;
  const eStop = new MemoryEStopGate();
  const events = new MemoryEventSink();
  const observabilitySink = createObservabilityCommsEventSink();
  const observabilityBridge = new ObservabilityCommsEventBridge(observabilitySink);
  const clock = deps.clock ?? { now: () => new Date().toISOString() };
  const directory = new MemoryPeerDirectory();
  const transport = deps.transport ?? new LoopbackTransport();
  const receiptResolver = createAdmissionReceiptResolver();
  const runtimeCommit =
    deps.runtimeCommit ?? (mode === "test" ? testRuntimeCommitPort() : undefined);
  if (runtimeCommit === undefined) {
    throw new Error("createCommsServices requires runtimeCommit");
  }
  const observation =
    deps.observation ??
    (mode === "test"
      ? ({
          observe: async () => ({ ok: true, value: { snapshotRef: "snap-obs-test" as never } }),
        } satisfies RuntimeObservationPort)
      : undefined);
  if (observation === undefined) {
    throw new Error("createCommsServices requires observation");
  }

  const replay =
    deps.replay ??
    (mode === "test"
      ? new MemoryReplayProtector()
      : {
          checkReplay: () => ({
            ok: false,
            error: commsViolation("replay_detected", "ingress", "replay protector required"),
          }),
          recordSeen: () => undefined,
        });

  const identity: IdentityVerifier =
    deps.identity ??
    (mode === "test"
      ? {
          verifyPeer: async () => ({
            ok: false,
            error: commsViolation(
              "identity_unverified",
              "authenticate",
              "identity verifier not configured in test mode",
            ),
          }),
        }
      : {
          verifyPeer: async () => ({
            ok: false,
            error: commsViolation(
              "identity_unverified",
              "authenticate",
              "identity verifier required",
            ),
          }),
        });

  const authorizer: CommsAuthorizer =
    deps.authorizer ??
    (mode === "test" ? { authorize: () => ok(undefined) } : denyByDefaultAuthorizer());

  const endpointPolicy =
    deps.endpointPolicy ??
    (mode === "test" ? permissiveEndpointPolicy() : denyByDefaultEndpointPolicy());

  const ingress = new CommsIngress({
    store,
    identity,
    authorizer,
    replay: {
      checkReplay: (input) => replay.checkReplay(input),
      recordSeen: (digest, expires) => replay.recordSeen(digest, expires),
    },
    eStop,
    events,
    clock,
    ...(deps.runtimeConsumer !== undefined ? { runtimeConsumer: deps.runtimeConsumer } : {}),
  });

  const reconnectCoordinator = new ReconnectCoordinator({
    store,
    bindingResolver: deps.bindingResolver,
    runtimeCommit,
    events,
    clock,
    eStop,
  });
  const outboxDispatcher = new OutboxDispatcher({ store, transport, eStop, clock });
  const deliveryRecovery = new DeliveryRecovery({
    store,
    outboxDispatcher,
    eStop,
    events,
    clock,
  });
  const reconnectRecovery = new ReconnectRecovery({
    store,
    coordinator: reconnectCoordinator,
    eStop,
    events,
    clock,
  });
  const sessionReconciler = new SessionReconciler({
    store,
    sessionAuthority: deps.sessionAuthority,
    eStop,
  });
  const messagingSaga = new MessagingSagaCoordinator({
    store,
    transport,
    observation,
    runtimeCommit,
    events: {
      emit(event) {
        events.emit(event);
        observabilityBridge.emit(event);
      },
    },
    eStop,
    clock,
  });

  return {
    store,
    ingress,
    peer: new CommsPeerService({
      directory,
      identity,
      endpointPolicy,
    }),
    session: new CommsSessionService({
      store,
      sessionAuthority: deps.sessionAuthority,
      eStop,
      clock,
    }),
    messaging: new CommsMessagingService({
      store,
      transport,
      sessionAuthority: deps.sessionAuthority,
      bindingResolver: deps.bindingResolver,
      eStop,
      events,
      clock,
      saga: messagingSaga,
    }),
    mobility: new CommsMobilityService({
      store,
      allocator: new MemoryFreshAllocator(),
      sessionAuthority: deps.sessionAuthority,
      eStop,
      clock,
    }),
    admin: new CommsAdministrationService(eStop),
    query: new CommsQueryService(store),
    reconnect: reconnectCoordinator,
    close: new CloseCoordinator({ store, quiescence: deps.quiescence, eStop, events, clock }),
    receiptResolver,
    events,
    transport,
    recovery: {
      outbox: outboxDispatcher,
      delivery: deliveryRecovery,
      reconnect: reconnectRecovery,
      session: sessionReconciler,
    },
    messagingSaga,
    observabilityBridge,
  };
}

export async function executeAdmissionReconnect(input: {
  readonly services: CommsServices;
  readonly plan: AdmissionReconnectPlan;
}): Promise<Result<AdmissionReconnectReceipt, CommsViolation>> {
  const proposed = await input.services.reconnect.propose(input.plan);
  if (!proposed.ok) {
    return proposed;
  }
  const authorized = await input.services.reconnect.authorize(proposed.value);
  if (!authorized.ok) {
    return authorized;
  }
  const accepted = await input.services.reconnect.peerAccept(
    authorized.value,
    input.plan.planDigest as string,
  );
  if (!accepted.ok) {
    return accepted;
  }
  return input.services.reconnect.runtimeCommit(accepted.value);
}

export function buildReconnectPlanFromReceipt(input: {
  readonly resolver: AdmissionReceiptResolver;
  readonly receipt: SchemaAdmissionReceipt;
  readonly sessionId: SessionId;
  readonly operationTemplateRef: OperationTemplateRef;
  readonly oldEndpointRef?: DescriptorRef;
  readonly newEndpointRef?: DescriptorRef;
}): Result<AdmissionReconnectPlan, CommsViolation> {
  return input.resolver.buildReconnectPlan({
    receipt: input.receipt,
    sessionId: input.sessionId,
    operationTemplateRef: input.operationTemplateRef,
    oldEndpointRef: input.oldEndpointRef ?? descriptorRef("endpoint-old"),
    newEndpointRef: input.newEndpointRef ?? descriptorRef("endpoint-new"),
    authorizationRef: input.receipt.authorizationEvidenceRef ?? "auth-evidence",
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
  });
}
